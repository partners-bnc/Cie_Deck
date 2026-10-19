# Applicant matching

Implementation uses existing applicant columns only. Resume links are never fetched or parsed.
The new feature is disabled unless `VITE_CANDIDATE_MATCHING_ENABLED=true`.

## Components

- `candidate-matching`: active-admin API for starting automatic matching, reading results and refreshing runs. Validates the bearer token with Supabase Auth and checks `admin_users.is_active` on every request.
- `applicant-embedding-worker`: secret-authenticated queue worker and restricted operational endpoint.
- `candidate-match-worker`: secret-authenticated worker; extracts requirements, retrieves 50 candidates, and makes one final batch assessment call scoring and summarizing every retrieved candidate, up to 50.
- Migration: four public RLS tables, a private operational reconciliation checkpoint, transactional change triggers, private hash helpers and service-role-only RPCs. Installing it does not backfill or schedule providers.

The source hash includes professional fields and matching attributes; the embedding hash contains professional fields only. Viewing, tagging and screening do not enqueue embeddings. Attribute-only changes reuse the existing vector. Profiles use the `cl100k_base` tokenizer, a 7,600-token budget, `text-embedding-3-large`, 3,072 dimensions, and version `applicant-v1`. Coverage includes cumulative provider-reported embedding input tokens for committed index updates; worker responses also include invocation input tokens, including superseded requests. Neither counter includes query embeddings/assessment charges or deleted records, so use provider billing for total cost.

Semantic retrieval obtains 400 approximate neighbors through a halfvec HNSW index, reranks them with full vectors, and retains 200. Keyword retrieval retains 200; reciprocal rank fusion selects 50 for OpenAI assessment. Exact search is used for eligible pools of 1,000 or fewer, and is available for evaluation. C++ and .NET receive keyword aliases. Confirmed minimum experience, exact locations, and maximum notice days apply within retrieval; unknown values stay eligible. Salary units and authorization are assessed from recorded evidence rather than guessed.

Matching pipeline version `matching-all-scored-v5` is separate from applicant embedding format `applicant-v1`. Retrieval commits the 50-candidate pool before the same worker invocation calls OpenAI once. The status API exposes the up to 50 `searchMatches` while `assessmentStatus` is pending or failed; `results` contains final recommendations. Cached vectors and automatically extracted requirements are reused on unchanged jobs within the same pipeline version.

The final call receives compact, requirement-relevant professional excerpts for all 50 candidates, numeric identifiers mapped server-side to UUIDs, and the full automatically extracted requirements. The input budget is 16,000 estimated cl100k tokens including instructions/framing, targeting up to 250 professional-context tokens per candidate; output allows 12,500 tokens for summaries on all retrieved candidates. Overlong requirements fail before a paid call and can be edited. This tokenizer is an estimate; actual OpenAI token accounting can differ. New final responses use strict Structured Outputs with exactly N objects containing candidate, integer score 0..100 and summary, where N is the retrieved pool size. The validator requires each expected numeric candidate ID exactly once and a nonempty summary of at most 600 characters. It maps IDs server-side and persists the summary in assessment.analysis plus a compatibility reason; evidence/gaps/unknowns arrays may be empty. Weak matches and direct requirement contradictions receive lower scores and explanatory summaries rather than being omitted. Saved older results remain readable. Opening candidate dropdowns and changing the 20–50 slider use local state and do not make extra AI calls.

The model is instructed to weigh mandatory requirements twice as strongly as preferences, score all profiles, identify missing information as unknown and avoid invented qualifications. Relevance scores are model judgments, not hiring probabilities. Results are sorted by score, then retrieval order. The database separately enforces exact pool coverage, unique IDs, numeric integer scores within 0..100 and nonempty bounded summaries before committing completion. It checks source and job hashes under locks, saves all rows atomically, and leaves suitable nullable because rank is not an automatic suitability decision. An incomplete batch cannot complete.

On a normal successful search there is one final OpenAI request, plus a separate cached requirement-extraction request when needed. Only transient failures retry automatically, at most three final requests per attempt, respecting Retry-After and backoff. Invalid/truncated or incomplete final output retries within the same three-call limit using the saved pool and vector, then fails visibly without per-applicant calls or fabricated scores. `retry-assessment` is an active-admin action that explicitly starts a new bounded attempt using the saved pool. `start` and `review-requirements` are retired API actions and return 409 with reload instructions. Correct unusable descriptions through Edit job. Search matches remain visible on AI failure; tagging uses validated, current final recommendations only.

## Configuration

Set `OPENAI_API_KEY` and `MATCH_WORKER_SECRET` in Supabase Edge Function Secrets. `MATCH_WORKER_SECRET` should be 32 random bytes encoded as 64 hex characters. Store its identical value in Vault under the exact name `MATCH_WORKER_SECRET` for schedules. Supabase injects URL and service-role credentials into deployed functions.

Requirement extraction and final assessment use `gpt-5-nano` through the OpenAI Chat Completions API. Requests use `reasoning_effort=minimal`, low verbosity, JSON mode, no temperature override, `store=false`, and a 60-second provider timeout. Embeddings continue to use `text-embedding-3-large`. Both calls read the server-only `OPENAI_API_KEY`. The local `VITE_OPENAI_API_KEY` matched that local server key; no key value was logged or added to source. Keys are never read from `VITE_*` variables by deployed matching code.

For local serving, copy `supabase/functions/matching.env.example` to an ignored `.env.local` file and use local-stack Supabase values. Frontend variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the feature flag. CLI management needs only `SUPABASE_URL` and `MATCH_WORKER_SECRET` in an ignored local environment file. Confirm existing provider keys in browser bundles are handled separately before publishing.

## Validation commands

```powershell
npm run test:matching
deno test --config supabase/functions/deno.json --allow-env tests/matching/runtime_test.ts tests/matching/worker_test.ts
deno check --config supabase/functions/deno.json supabase/functions/candidate-matching/index.ts supabase/functions/candidate-match-worker/index.ts supabase/functions/applicant-embedding-worker/index.ts
npm run build
node --env-file=.env.local tools/matching/preflight.mjs
```

The database tests use an isolated in-memory PostgreSQL runtime with pgvector 0.8.0 and a minimal existing-schema fixture. They do not contact production or AI providers. The provider preflight uses model metadata endpoints only; it cannot establish billing quota or candidate quality. The fictional UI fixture is `/tests/matching/ui.html` on the Vite development server; all matching and tagging calls there are stubbed.

## Authorized rollout sequence

1. Check project disk/compute headroom and migration compatibility. Float32 vector payload alone is approximately 1.09 GB for 88k applicants; HNSW, text, rows, and working space add overhead. Run database advisors after applying migrations in an authorized development environment.
2. Apply the additive migration in that environment, set secrets, deploy the three functions, and configure Vault. Keep the frontend feature flag off. Production requires separate rollout authorization.
3. Dry-run coverage/pilot. Enqueue only the 500-row stratified pilot after provider-call authorization. Tick the worker, measure real tokens/cost, throughput, failures, storage and index memory. No quality claims until actual recruiter judgments exist.
4. For matching against the pilot index, enable only `supabase/operations/enable_match_worker.sql` after authorization. It continues requested job runs every twenty seconds and skips worker calls when no eligible run is waiting. The API's immediate wakeup handles only one step; durable scheduling is required for assessments to finish. For ongoing embedding updates as well, use `supabase/operations/enable_candidate_matching.sql`. Match scheduling does not enqueue the full applicant pool. Four embedding tasks run per minute by default; full 88k processing at that rate can take roughly 15.4 days before retries. Adjust concurrency/frequency only after measuring provider and database capacity. The worker processes the complete 50-candidate pool in one final batch call, immediately following retrieval. Scheduling is recovery for expired leases and deferred retries; it is not required between successful retrieval and assessment. Qwen 3.8 uses reasoning_effort=none. Actual timing depends on provider token limits, model latency and contention.
5. Evaluate roughly ten jobs with known-positive candidates reviewed by recruiters. Existing tags are possible positives; untagged records are not negatives. Compare keyword-only, semantic-only and hybrid results, and exact/approximate recall. The script `tools/matching/evaluate.mjs` produces retrieval metrics without AI provider calls.
6. After full-backfill authorization, seed through UUID keyset pagination. Checkpoints resume interrupted seeding. Live triggers capture changes throughout backfill. Monitor coverage and retry failures explicitly.
7. Apply `supabase/operations/enable_matching_reconciliation.sql` only after full-backfill authorization. It scans 500 applicants per minute using a private checkpoint, resets at the end of each sweep, and queues missing or changed rows without re-embedding current profiles. The seeder with `--reset --enqueue --all` also supports a manual repair sweep. Enable the frontend feature flag after checks pass.

Operational commands (require deployed functions and the worker secret):

```powershell
node --env-file=.env.local tools/matching/manage.mjs coverage
node --env-file=.env.local tools/matching/manage.mjs pilot
node --env-file=.env.local tools/matching/manage.mjs pilot --enqueue
node --env-file=.env.local tools/matching/manage.mjs tick --pilot-only
node --env-file=.env.local tools/matching/manage.mjs seed --all
node --env-file=.env.local tools/matching/manage.mjs seed --enqueue --all
node --env-file=.env.local tools/matching/manage.mjs seed --reset --enqueue --all
node --env-file=.env.local tools/matching/manage.mjs retry-embeddings
node --env-file=.env.local tools/matching/manage.mjs retry-runs
```

Failed tasks stop after six claims with exponential backoff. Expired two-minute leases are reclaimable. Source/claim checks prevent stale writes and deletion resurrection. Model failures remain visible and never become candidate rejection. Relevant job edits invalidate confirmation; applicant edits/deletions mark saved results stale. A later refresh includes newly indexed profiles. Cached runs display generation time and coverage.

## Rollback

Set the frontend flag false, disable the API/immediate wakeups, and apply `supabase/operations/disable_candidate_matching.sql` to stop schedules. Keep tables for diagnosis. If removing the feature permanently, detach the three applicant/job matching triggers before dropping dependent objects; preserve applicants, jobs, tags, global scores, unrelated functions and existing storage-backup schedules. Do not drop the vector extension if another feature uses it.

## Remaining validation

Full backfill and recruiter quality evaluation remain separate from the completed pilot. Browser visual inspection depends on a connected browser; the local DOM tests cover interactive behavior.

Local validation passed 17 Node tests and 3 Deno tests, Edge Function type checks, and the Vite build. The existing ESLint configuration does not recognize JSX component references and also reports unrelated errors in `supabaseService.js`; focused checks on the new component/service/core pass. The build retains the existing large-bundle warning.

## Production deployment and pilot — 2026-10-09

The user authorized deployment and execution. The migration was applied to `bvvqyjqokvnttbgyjkrt`; all three matching Edge Functions are active. The Supabase plugin provided access after the project-specific MCP session expired. Vault and deployed worker authentication agree. Anonymous POSTs return 401 on all three endpoints. Deployed OpenAI/Groq model access checks returned 200, with `GROQ_MODEL=qwen/qwen3.8-27b` available.

A stratified 500-applicant pilot completed in 401.95 seconds: 491 current vectors, nine insufficient-data profiles, zero failed/pending tasks. All vectors have 3,072 dimensions. Committed embedding input usage was 65,896 tokens. The search index including indexes occupies 12,361,728 bytes (approximately 11.8 MiB). Hybrid retrieval returned a 50-candidate pool; this is a functional check, not recruiter quality validation. The organization is on Pro. Actual full-index disk and compute capacity still needs monitoring as the index grows.

Pilot records are marked in the embedding queue. `tick --pilot-only` processes only that cohort, preserving ordinary live queues. The temporary `applicant-embedding-pilot` schedule was stopped after all 500 records completed. Global embedding/reconciliation schedules and full backfill are not enabled. The matching worker's `health` action verifies configuration without claiming runs or sending applicant content to Groq; no job assessments were run without recruiter-confirmed requirements. Production frontend publication/feature activation remains pending.

Security advisors report intentional policy-free RLS on the service-only embedding queue/index and private checkpoint; browser grants are revoked. Existing unrelated project security advisories were left unchanged.

### Matching continuation fix — 2026-10-09

After the user confirmed requirements for the first job, its run stopped at assessment (50 retrieved, zero assessed) because no matching schedule was enabled. The user authorized fixing continuation. The `candidate-match-worker` schedule is now active every twenty seconds, using Vault authentication and an eligible-run guard. Applicant embedding and reconciliation schedules remain off. Successful assessments checkpoint independently.

Initial three-candidate bursts encountered Groq HTTP 429 rate limits. Worker version 4 processes one candidate per invocation, disables Qwen reasoning tokens, and sizes the completion allowance to the number of requirements. Rate-limit and fixed validation errors are now visible without exposing applicant/provider content. Production verification showed continued assessment progress and cleared retry errors; the deployed worker passed the Deno type check. Completion and recommendation quality must still be checked on the actual run.


### One-call batch cutover — 2026-10-09

The user superseded per-applicant assessment with one final call over 50 candidates. The old schedule was paused and pending claims invalidated before applying `matching_batch_v2`. Old completed records were preserved; old workers can no longer claim work. New runs reuse compatible query vectors and confirmed requirements without re-embedding applicants. The API and worker were deployed and the guarded twenty-second recovery schedule restored.

Thirty warm production database retrievals on the 491-vector pilot index measured median 48.21 ms, p95 54.61 ms, and maximum 79.48 ms. This measures SQL execution only and does not establish performance at the full applicant count. The successful live worker recorded a 174 ms retrieval RPC including network overhead, retrieved 50 candidates, and completed with one final AI request returning 15 supported recommendations. An initial test with verbose output reached the response token limit; compact tuples resolved it without raising the budget or introducing individual calls.

Vectors live in PostgreSQL `public.applicant_search_index`, with a 3,072-dimensional full vector and a halfvec HNSW expression index. No Storage vector bucket is used. Frontend source/build is updated; deployment to a separate frontend host remains outside this cutover unless requested. Reload the local development app to use the new search-match display.

Final verification passed 22 Node tests and four Deno tests, Edge Function type checks, focused ESLint, and the Vite build (existing chunk-size warning). Production security advisors did not flag new batch functions; existing unrelated notices and intentional service-only RLS remain. Worker version 7 and API version 3 are active, with the guarded recovery schedule verified active. The successful live run has one final AI request and no processing error.


### Automatic matching without requirement review — 2026-10-09

The user removed the HR requirement-review layer and selected detailed job-description precedence over conflicting structured fields. `matching-auto-v3` now interprets the job, persists requirements while retaining the claim, retrieves candidates, and makes the single final batch call in the same invocation. Interpretation warnings remain visible but never block matching. Contradictions within the description leave disputed restrictions unset and retain clear requirements; missing details remain unknown. Warnings are excluded from query embeddings and the final assessment prompt.

The frontend no longer contains requirement fields or a confirmation button. Find matching candidates starts the complete flow; opening a job only loads saved results. Old drafts are superseded on a new request and reinterpreted under the new policy. Completed historical results remain available. Automatic runs leave `confirmed_at` and `confirmed_by` null; requirement/vector caching uses job hash, model and pipeline version instead. New job-description changes invalidate cached interpretation normally. Empty/unusable descriptions show an actionable Edit job message.

Migration `matching_auto_v3`, worker version 8, and API version 4 are deployed. Recovery scheduling targets only eligible v3 runs every twenty seconds. Validation passed 23 Node tests, five Deno tests, Edge Function type checks, focused ESLint, and the frontend build (existing chunk-size warning). Tests verify automatic extraction-to-retrieval continuation, retained claims, nonblocking warnings, description-precedence instructions, old-draft supersession, no fabricated HR confirmation, caching, and one final batch request.

The previously blocked JPC completed automatically in production: 27 candidates retrieved, one final AI call, three informational interpretation notes, and no error. The extracted minimum total experience was ten years, following the detailed description; HR confirmation timestamps remained null. The model returned no supported final recommendations from this partial pilot pool, so the UI retains the top 20 search matches for manual inspection. This verifies flow completion, not recruiter quality or complete-database recall.

### Expandable AI analysis — 2026-10-11

Worker version 12 and API version 6 are deployed. Recommended rows expand beneath the row from the right-hand `>` control, with location, education, company, position and notice details, then a white AI analysis panel with green supporting evidence and separate gaps/unknowns. One row is open at a time. Pending search matches show analysis pending; older final results retain their brief evidence and a detailed-analysis refresh hint. Stale runs label explanations as historical. Expansion and collapse use local state and make no extra requests. The frontend source/build is ready; no separate frontend-host deployment was performed.

The live refreshed JPC-053 run `ce672bcb-8cbf-40cd-a9c5-b206056d954f` completed with 50 retrieved candidates, 20 recommendations, 20 saved analysis paragraphs and one final AI call. Maximum analysis length was 287 characters. The existing query vector was reused. Retrieval RPC took 11.911 seconds under the 20-second timeout; coverage took 4.756 seconds; matches were available after 17.472 seconds from worker invocation. From pool availability to completed ranking was approximately 5.609 seconds, including batch preparation, provider generation and persistence. Compared with the earlier approximately 3.6-second post-pool completion, this suggests modest added generation cost for this job, but is not a controlled before/after benchmark or an end-to-end latency guarantee.

Verification: the 31 existing Node checks passed, the added analysis/output-budget check passed, and the updated UI check passed after correcting its initial collapsed-state assumption (32 Node checks total). Seven Deno checks, worker/API type checks, focused lint and Vite build passed; the existing bundle-size warning remains. The local browser fixture was visually inspected at desktop size. Tests reject invalid/oversized analysis and unsupported quotes, preserve legacy responses, and confirm opening/closing panels does not add service calls. Saved source hashes and staleness behavior remain unchanged.

Before-analysis deployed bundles are retained in `supabase/operations/rollback-candidate-match-worker-before-analysis.json` and `rollback-candidate-matching-before-analysis.json`. Restore their relative file bundles to roll back the backend; worker bundle paths have a `functions/` prefix to strip when redeploying. No schema/data rollback is necessary. Completed historical results remain intact; refresh older recommendations to obtain the new detailed analysis.

### Full-index retrieval optimization — 2026-10-10

The subsequent migration `20261010205529_matching_retrieval_timeout_20s` raises only matching_search's Data API statement timeout to 20 seconds, as requested by the user. PostgREST caches were reloaded, the function configuration verified, and a saved-vector retrieval returned 50 candidates. The three-attempt retry limit remains unchanged. Earlier eight-second benchmark results are historical.

The compact keyword projection, filtered HNSW paths, coverage cache and API version 5 are deployed on all 88,003 indexed applicants. Worker version 11 preserves query vectors and bounded retries. Both reported JPC-053/JPC-054 runs completed with 50 candidates, 20 recommendations and one final AI call each. All 330 warm probes passed; semantic top-20 recall was 100% on five saved vectors. Full latency acceptance remains unmet: one accounting first request and five concurrent broad accounting searches timed out. See [the measured performance report](matching-retrieval-performance.md) for SQL versus live timings, remaining limits and rollback. Earlier pilot measurements do not establish full-index performance. Frontend source/build updates remain local.


### Description-only matching and result slider — 2026-10-19

New `matching-description-v4` runs send only `job_description` to requirement extraction; structured job title, experience, location, salary and other fields are not supplied or used as fallback requirements. Ambiguities inside the description remain conservatively handled. The job hash now covers only the description and pipeline input version, so structured-field edits do not invalidate matching. Description edits continue to invalidate runs. Existing applicant embeddings are unchanged.

The portal removes the interpretation-notes disclosure and adds a labelled native range slider from 20 through 50, step 1, default 20. It filters saved results locally in final score order (or retrieval order while pending), without provider requests or refetches. Retrieval and the final input pool remain bounded at 50. One final batch can return up to 50 supported recommendations; validation and atomic persistence permit 50, with a 12,500-token output allowance. Unsuitable candidates are not added to reach a selected count. Smaller pools show their actual available count.

Migration `20261019090916_matching_description_only_top50` advances the existing claim, retry and cache guards without changing RPC signatures or table counts. Historical results remain readable but stale, requiring refresh before tagging; cached v3 requirements/query vectors cannot be reused in new v4 runs. Rollback function definitions and API/worker bundles are retained under `supabase/operations/rollback-description-v4.sql` and `rollback-*-before-description-v4.json`. Restore the SQL together with both prior bundles. Completed historical results remain stale until refreshed.

Verification: 33 Node checks and 7 Deno checks passed, including description-only provider payloads, v3 cache isolation, description-only invalidation, 50-result atomic persistence, output-budget validation, and slider changes at 20/35/50 without service calls. Focused lint, Edge Function type checks and production build passed. The existing build chunk-size warning remains. The local browser fixture was checked at desktop and 390px widths. Returning analysis for up to 50 can increase final generation time and tokens; no new latency benchmark is claimed.

Deployment: the description-only migration is applied; `candidate-match-worker` version 13 and `candidate-matching` version 7 are ACTIVE. Downloaded worker code confirms the description-only payload, v4 pipeline and 12,500-token output budget. Live SQL confirms the 50-result guard, no remaining v3 RPC guards, preserved nine completed runs, restricted RPC permissions and unchanged 20-second retrieval timeout. The local worker health request returned 401 (the ignored local worker secret did not authenticate); no live paid search was started during this change. Frontend source and build are ready; hosting deployment was not performed.


### Supporting summaries instead of exact quotes — 2026-10-19

Removed substring checks against both supplied excerpts and original profile fields from the active batch validator. Groq may paraphrase supporting information while retaining the existing response shape (`evidence[].quote` remains the compatibility storage key). Candidate IDs, deduplication, score bounds, field references, nonempty text/length limits, analysis limits and transactional source-staleness checks remain enforced. The prompt explicitly permits paraphrasing and still instructs the model to base its assessment on supplied facts. The frontend calls this section Supporting information and does not wrap summaries in quotation marks. Legacy per-requirement validation in `core.js` is not used by the active batch pipeline.

Regression checks cover a full 50-result batch of paraphrases and worker persistence of paraphrased text, while rejecting invalid IDs, duplicates, scores and references. No database migration or re-embedding is required. Previously failed assessments can retry with their saved pool.

Deployment: `candidate-match-worker` version 15 is ACTIVE. Downloaded deployed files confirm that only `_shared/matching/batch.js` changed relative to deployed version 14 and that exact substring validation is absent. Version 14 is retained in `supabase/operations/rollback-worker-before-supporting-summaries.json`. All 33 Node checks, three focused Deno checks, worker type checking, UI lint and production build passed (the updated paraphrase-persistence worker test also passed). The previously failed JPC-052 run remains available for an explicit assessment retry using its saved candidate pool; no paid replay was started automatically. Frontend Supporting information wording is built locally and awaits hosting deployment.


### OpenAI gpt-5-nano assessment — 2026-10-19

The matching API selects `gpt-5-nano` for new runs and the match worker uses OpenAI for both description extraction and batch assessment. The historical `groq_model` database column and health-response key retain their names for compatibility but store the selected model ID; no new tables or schema migration are required. Existing Groq results remain readable, and matching_prepare separates model-specific caches. One final batch request, 50-candidate retrieval, slider behavior, paraphrase acceptance and retry limits remain in place. OpenAI 429/5xx errors retain Retry-After and bounded retries; 429 is a provider limit response, not a database retrieval timeout.

A fictional-input smoke request with the requested key returned HTTP 200 and valid JSON from `gpt-5-nano-2025-08-07` in 2.2 seconds; this is not a 50-candidate latency benchmark. All 33 Node checks, seven Deno checks and the Edge Function type checks passed. Tests assert the OpenAI endpoint, requested model, minimal reasoning, no temperature field, server-side authorization header, and retained rate-limit backoff.

Matching worker version 18 and API version 9 are deployed. The embedding worker deployment was deliberately left unchanged after automatic approval review rejected that unnecessary deployment. Its legacy preflight still describes the historical Groq provider; `tools/matching/preflight.mjs` now checks OpenAI model access. Setting a separate assessment secret through the local CLI was rejected by project privileges; it was unnecessary because the requested local key already matched the local OPENAI_API_KEY and production already has an embedding key. The temporary secret file was removed. Prior deployed bundles are retained as `rollback-*-before-openai-nano.json` in supabase/operations.

Live migration verification: resumed rate-limited run `fc4aa589-d2cc-4895-9594-3824d068ec7a` on OpenAI using its saved 50-candidate pool. Initial OpenAI responses exposed an 80-character optional-note rejection. Supporting gaps/unknowns now permit up to two strings of 500 characters and normalize whitespace-only strings to absence, while preserving supplied text and rejecting invalid types or unbounded lists. Safe batch-validation codes are logged without profile or provider content and surfaced through existing error fields. A regression test covers explanatory notes beyond 80 characters, whitespace, invalid types, list size and 500-character bounds.

After that correction, the same run completed with HTTP 200, no last_error, model `gpt-5-nano`, and zero recommendations. This verifies a successful live provider/validation/persistence round trip, not matching quality or a positive-result case. Its saved Groq-extracted requirements combine two distinct Cyber Security roles (Jeddah DLP and Riyadh senior cybersecurity) into one mandatory list; that ambiguity can suppress recommendations and needs separate product/requirements handling. The resumed run reused those saved requirements; new model-specific searches extract requirements through OpenAI. Two earlier live OpenAI attempts failed optional-note validation before the successful retry; counters reset per explicit assessment retry, so the final saved count of one is not the total across these migration probes. No embeddings were regenerated.

Final validation after the optional-note adjustment: 34 Node checks and seven Deno checks passed, all three matching function entrypoints type-check, and git diff --check is clean.


### Enforced requirement extraction response — 2026-10-19

JPC-050 run `794ac90f-f57b-481f-be13-27cc3fc0a258` failed before retrieval with a generic error incorrectly asking the recruiter to edit the job description. The raw failing response was not retained, so its exact malformed field is unknown. Re-extracting the unchanged 865-character description succeeded, demonstrating that it was not consistently uninterpretable.

Requirement extraction now uses OpenAI strict Structured Outputs rather than JSON mode alone. The schema requires all seven fields, enforces array/string/nullable numeric types, caps list/string sizes, and retains numeric ranges. Existing semantic validation still runs after generation. Final batch response handling is unchanged. A valid JSON object without the required field shapes no longer satisfies the provider contract. Provider HTTP errors and timeouts remain distinct from format failures; format failures say the AI returned an invalid response and request a retry, rather than telling the recruiter the description is wrong. Structured diagnostics identify the requirements stage and a safe format-error code without logging content.

A same-description strict-schema request succeeded with five mandatory requirements and fifteen keywords in 2.455 seconds. All 34 Node checks and eight Deno checks passed; matching function type checks and git diff --check passed. Worker version 19 is ACTIVE; prior version 18 is retained in `supabase/operations/rollback-worker-before-structured-requirements.json`. No schema migration, frontend deployment or re-embedding is required. The temporary local reproduction input was removed.

Live verification: the same JPC-050 run completed with HTTP 200, 50 retrieved candidates, one final OpenAI call, one recommendation, and no last_error. Retrieval RPC took 14.032 seconds under the existing 20-second timeout. The job description was not edited. This verifies the full extraction/retrieval/assessment/persistence path for this job, without claiming a minimum recommendation count or general latency guarantee.


### Full-pool scoring contract — 2026-10-19

Pipeline `matching-all-scored-v5` replaces optional shortlisting with complete scoring. Normal successful runs produce one final OpenAI request and exactly one score and summary per retrieved candidate, including zero-score/unsuitable profiles. There is no minimum of 40 and no evidence/quote requirement. Summaries explain both fit and important gaps/unknowns. Requirement extraction treats explicitly alternative roles as alternatives rather than a mandatory union. New pipeline guards prevent reuse of v4 partial results or interpretations.

Migration `20261019110750_matching_score_every_candidate` changes the pipeline default and service RPC guards, supersedes active old-version runs, and replaces atomic batch persistence with full-set validation and database-side ranking. Completed historical runs remain readable. No new tables or applicant embeddings are created. Prior SQL and deployed API/worker bundles are retained as rollback-all-scored-v5.sql and rollback-*-before-all-scored-v5.json. The embedding worker is untouched.

The UI displays saved zero scores, all summaries and actual scored counts, with local slider selection at 20/35/50. It labels completed legacy/unscored matches explicitly; Pending is reserved for active matching. A completed current-version response with missing scores/summaries surfaces an incomplete-scoring error rather than claiming success. Empty eligible pools show an empty-search message; pools below 50 are fully scored without padding.

Verification: 34 Node checks and nine Deno checks cover strong/weak/mixed/zero scores, smaller and empty pools, exact ID coverage, duplicates/foreign IDs, score bounds, empty summaries, atomic rejection, staleness, provider errors, and a three-attempt incomplete-output retry using the saved pool. Worker/API type checks, component lint and production build passed. Desktop/mobile fixture checks showed 20 default rows, 50 selected rows, a visible 0/100, an expanded summary and no Pending label after completion. Existing build chunk-size warnings remain.

Deployment: SQL migration applied; matching worker version 20 and API version 10 are ACTIVE. Production UI deployed to https://ciedeck.bncglobal.in via deployment dpl_4G362rGScMc2TxUznN7vnd17gsEj. A production asset fetch confirmed the v5 UI, legacy-state labels and incomplete-score warning. The existing retrieval timeout remains 20 seconds. Applicant embedding worker deployment and compute are unchanged.

Live acceptance checks completed on both fresh v5 runs:

- JPC-050 `200e289f-390a-4b28-875f-ad2121078923`: 50 retrieved, 50 scores, 50 nonempty summaries, 50 unique IDs, ranks 1–50, scores 50–78, one final AI call, no error. Retrieval 15.707s; run creation through completion 43.388s.
- JPC-052 `7fe05af0-2a10-489e-98f9-cfedc059f209`: 50 retrieved, 50 scores, 50 nonempty summaries, 50 unique IDs, ranks 1–50, scores 52–75, one final AI call, no error. Retrieval 3.108s; run creation through completion 26.068s.

These are two live observations, not warm medians/p95 or a latency guarantee. Full metadata is in matching-all-scored-v5-verification.json. Both reported jobs now meet the complete-scoring contract; the slider changes display count only.

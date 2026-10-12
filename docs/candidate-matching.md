# Applicant matching

Implementation uses existing applicant columns only. Resume links are never fetched or parsed.
The new feature is disabled unless `VITE_CANDIDATE_MATCHING_ENABLED=true`.

## Components

- `candidate-matching`: active-admin API for starting automatic matching, reading results and refreshing runs. Validates the bearer token with Supabase Auth and checks `admin_users.is_active` on every request.
- `applicant-embedding-worker`: secret-authenticated queue worker and restricted operational endpoint.
- `candidate-match-worker`: secret-authenticated worker; extracts requirements, retrieves 50 candidates, and makes one final batch assessment call selecting up to 20.
- Migration: four public RLS tables, a private operational reconciliation checkpoint, transactional change triggers, private hash helpers and service-role-only RPCs. Installing it does not backfill or schedule providers.

The source hash includes professional fields and matching attributes; the embedding hash contains professional fields only. Viewing, tagging and screening do not enqueue embeddings. Attribute-only changes reuse the existing vector. Profiles use the `cl100k_base` tokenizer, a 7,600-token budget, `text-embedding-3-large`, 3,072 dimensions, and version `applicant-v1`. Coverage includes cumulative provider-reported embedding input tokens for committed index updates; worker responses also include invocation input tokens, including superseded requests. Neither counter includes query embeddings/Groq charges or deleted records, so use provider billing for total cost.

Semantic retrieval obtains 400 approximate neighbors through a halfvec HNSW index, reranks them with full vectors, and retains 200. Keyword retrieval retains 200; reciprocal rank fusion selects 50 for Groq assessment. Exact search is used for eligible pools of 1,000 or fewer, and is available for evaluation. C++ and .NET receive keyword aliases. Confirmed minimum experience, exact locations, and maximum notice days apply within retrieval; unknown values stay eligible. Salary units and authorization are assessed from recorded evidence rather than guessed.

Matching pipeline version `matching-auto-v3` is separate from applicant embedding format `applicant-v1`. Retrieval commits the 50-candidate pool before the same worker invocation calls Groq once. The status API exposes the first 20 `searchMatches` while `assessmentStatus` is pending or failed; `results` contains final recommendations. Cached vectors and automatically extracted requirements are reused on unchanged jobs within the same pipeline version.

The final call receives compact, requirement-relevant professional excerpts for all 50 candidates, numeric identifiers mapped server-side to UUIDs, and the full automatically extracted requirements. The input budget is 4,500 estimated cl100k tokens including instructions/framing; output now allows 5,000 tokens for concise analysis on up to 20 recommendations. Overlong requirements fail before a paid call and can be edited. This tokenizer is an estimate for Groq; actual provider token accounting differs. New wire responses use eight-item arrays with an analysis paragraph of at most 600 characters/90 words, normalized to `reason`, `evidence`, `gaps`, `unknowns`, and `analysis` in the existing assessment JSON. Legacy seven-item responses and saved results remain readable. Opening the full-width candidate dropdown reads saved analysis without additional requests or AI calls. Existing results without detailed analysis show their brief reason and evidence with a refresh hint. New analysis increases final generation volume; retrieval and the one-call final assessment flow are unchanged.

The model is instructed to weigh mandatory requirements twice as strongly as preferences, exclude direct mandatory contradictions, preserve unknowns, and avoid padding unsuitable candidates. Relevance scores are model judgments, not deterministic per-requirement scores or hiring probabilities. Every returned quote must occur in both the supplied excerpt and its original allowed applicant field. Results are sorted by relevance score, then retrieval position, and saved atomically after checking all source hashes and the job hash. Unselected candidates remain unassessed; a completed batch does not wait for their assessment fields. No evidence percentage is displayed.

On a normal successful search there is one final Groq request, plus a separate cached requirement-extraction request when needed. Only transient failures retry automatically, at most three final requests per attempt, respecting Retry-After and backoff. Invalid/truncated output fails visibly without falling back to per-applicant calls. `retry-assessment` is an active-admin action that explicitly starts a new bounded attempt using the saved pool. `start` and `review-requirements` are retired API actions and return 409 with reload instructions. Correct unusable descriptions through Edit job. Search matches remain visible on AI failure; tagging uses validated, current final recommendations only.

## Configuration

Set `OPENAI_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, and `MATCH_WORKER_SECRET` in Supabase Edge Function Secrets. `MATCH_WORKER_SECRET` should be 32 random bytes encoded as 64 hex characters. Store its identical value in Vault under the exact name `MATCH_WORKER_SECRET` for schedules. Supabase injects URL and service-role credentials into deployed functions.

The existing repository Groq model is `qwen/qwen3.8-27b`. A read-only model lookup confirmed it was available on 2026-10-09; inference and JSON-output quality still require a pilot. Configure that model explicitly as `GROQ_MODEL`. Keys are never read from `VITE_*` variables by this feature.

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

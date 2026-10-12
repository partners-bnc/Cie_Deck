# Cie_Deck candidate matching — Codex CLI handoff

Prepared: 2026-10-09. This document transfers the decisions and read-only findings from a ChatGPT Work conversation to a local Codex CLI session.

## Start here

Repository: https://github.com/partners-bnc/Cie_Deck

Default branch observed: `master`.

Supabase project: `Bnc_Recruiter_portel`, reference `bvvqyjqokvnttbgyjkrt`, region `ap-south-1`.

Goal: A recruiter opens a client job (JPC), requests matching candidates, and receives up to 20 ranked recommendations with evidence from existing applicant records. HR reviews and tags candidates through the existing workflow.

**Current status: planning only. No application code, migrations, embeddings, deployments, or database records were changed in the originating conversation. Only this handoff artifact was created.**

Read local `AGENTS.md` instructions and inspect the current checkout before editing. Findings below are a snapshot, not a substitute for checking the current schema and code. Credentials and connector sessions do not transfer through this file; check local GitHub/Supabase access without exposing secrets.

## Firm user decisions

- Candidate content comes exclusively from `public.applicants`.
- DO NOT download, parse, OCR, enrich from, or reprocess resumes. This applies to the entire scope, not merely the first release. Resume links remain links in the existing UI.
- Keep applicants as the source of truth and add a separate search index in the same Supabase database.
- Use one embedding per applicant, assembled from relevant existing columns.
- Use OpenAI `text-embedding-3-large`. It supersedes the earlier Google/Gemini proposal completely.
- Combine semantic retrieval with exact/keyword matching, then assess a small retrieved pool and recommend up to 20 candidates.
- Reuse the existing server-side Groq provider for requirement extraction and final assessment, subject to checking its currently working configured model. OpenAI was selected for embeddings, not as a replacement for every AI call.
- Store results per client job. Do not overwrite the applicant's global AI score with job-specific rankings.
- Missing salary, notice period, or other information means unknown, not an automatic failure.
- Keep HR in control of tagging and submission. Recommendations must not automatically reject, tag, contact, or submit candidates.
- Give one concrete implementation path. The user dislikes large option lists and repeated requests to reconfirm settled decisions.

The original user requested read-only planning pending implementation approval. This file alone does not authorize production deployment or paid bulk processing. A new CLI instruction to implement authorizes the requested development work; distinguish that from production rollout and the full embedding backfill.

## Verified repository integration points

| Path | Observed responsibility / intended integration |
| --- | --- |
| `src/services/supabaseClient.js` | Supabase client; fallback URL identifies the project above |
| `src/services/jobService.js` | Re-exports `jobService` from `supabaseService.js` |
| `src/services/supabaseService.js` | Applicant filtering, row mapping, client jobs, tagging, stages, caching; add matching service methods here or a focused imported service |
| `src/pages/admin/AdminClientJobDetail.jsx` | Primary UI integration: Find matching candidates and Recommended candidates tab |
| `src/pages/admin/AdminApplicants.jsx` | Existing applicant directory; preserve manual browsing/search |
| `src/pages/admin/CandidateDetail.jsx` | Existing candidate detail destination |
| `src/services/aiService.js` | Legacy browser AI service referencing `VITE_GROQ_API_KEY`; do not copy browser-secret pattern |
| `api/admin/parse-resume.js` | Existing resume parser; outside this feature's processing scope |
| `supabase/functions/` | Existing Edge Function source location |
| `supabase/migrations/` | Existing migration location; also inspect legacy SQL under `database/` |

The UI calls applicant display codes `applicantId`; `mapApplicantRow` also exposes the database UUID as `_uuid`. The new search tables must reference `applicants.id` (UUID), not confuse it with `applicant_code`.

Client job routes use `jobCode` / `job_code` such as `JPC-001`. Use `client_jobs.id` internally for new records and retain job codes for current routes and display. Existing job fetches may need to include the UUID.

`AdminClientJobDetail.jsx` currently loads `fetchShortlistedCandidatesByJob(jobCode)` from `tagged_candidates`, then enriches those records with applicants. Its “Matching Applicants” count describes already tagged candidates, not semantic recommendations. Separate the two concepts in the UI.

Existing applicant filters use `ilike` for roles and skills and exact equality for experience categories. New hybrid search must not inherit broad keyword filters that eliminate semantic matches prematurely.

## Database snapshot from read-only inspection

| Item | Observed value |
| --- | --- |
| Applicant rows, exact count | 88,347 |
| Nonempty skills | 87,515 |
| Nonempty CV summary | 80,850 |
| Nonempty current role | 81,897 |
| Nonempty education | 87,225 |
| Nonempty total experience | 85,834 |
| Nonempty expected pay | 334 |
| Nonempty notice period | 377 |
| Populated `updated_on` | 2,640 |
| Client jobs | 56; 51 with nonempty descriptions |
| Approximate database size | 452 MB |
| Applicants including indexes | 293 MB |

`vector` was not installed; available default version was 0.8.0. `pg_trgm`, `pg_cron`, `pg_net`, and Vault were installed. Confirm current versions and compute/storage headroom before building indexes. A nonempty job description is not necessarily useful: inspected data included a test entry.

Relevant applicant columns:

- Identity: `id uuid`, `applicant_code text`.
- Semantic content: `current_position`, `skills`, `cv_summary`, `education`, `certification`, `total_experience`, `relevant_experience`, `process_knowledge` (text).
- Structured matching attributes: `current_location`, `expected_pay`, `notice_period`, `work_authorization` (text; normalize only supported facts).
- Other existing fields include contact details, company, recruiter comments, ratings, screening JSON, status, timestamps, and Aadhaar. Do not indiscriminately embed all columns.

Experience is commonly stored as `0`, `1`, `2`, `3`, `4`, `5`, `6-10`, `10+`, with some other free-text values. Preserve ranges and uncertainty: `6-10` is not exactly eight years and `10+` does not prove twelve years. Missing experience is not zero.

Summary length averaged about 366 characters; maximum was 39,694. Skills reached 13,341 characters. Input limits must be checked by token count, not assumed from typical profiles.

`client_jobs` has `id`, `job_code`, `job_title`, `job_description`, `experience`, `location`, `state`, `country`, `pay_rate`, `job_type`, `job_mode`, `status`, and management metadata. One inspected GRC job had `5+yrs` in the experience column but 10+ years overall and 5+ years GRC in its description. Distinguish domain experience and total experience; surface ambiguity instead of silently choosing.

`tagged_candidates.applicant_id` references applicants with delete cascade. A partial unique index covers `(applicant_code, job_code)` for nonempty codes. Reuse the existing tagging behavior and duplicate protection.

RLS policies on applicants, client jobs, and tagged candidates use `is_admin()`, checking `admin_users.auth_id = auth.uid()` and `is_active = true`. Match this active-admin access model; assignment-specific authorization was not established. Authenticate on the server and authorize database access. Worker service credentials must remain server-only.

There was no universal applicant update-timestamp trigger: inspected applicant triggers handled dashboard aggregates and applicant codes. Do not use `updated_on` alone for synchronization.

A deployed `score-candidate` Edge Function already exists. It loads individual `candidates` records and public `jobs`, invokes Groq, and writes global scores. It is protected by a server secret in its body. It is not the new client-job retrieval endpoint; do not call it across the full applicant pool. Its deployed source was obtained through Supabase and may not be tracked in this repository.

## Concrete implementation architecture

### Embedding configuration

Use `text-embedding-3-large` for both applicants and job queries. Keep the model, dimensions, and profile-format version in configuration and persisted metadata. Do not use Gemini task-type parameters with OpenAI.

The user selected the model but did not explicitly settle dimensions after switching providers. Proposed engineering default for the request for highest quality: retain the full 3,072-dimensional output. Verify the installed pgvector limits before migration: ordinary HNSW `vector` indexing has a 2,000-dimensional limit in the documented version, while `halfvec` indexing supports up to 4,000. Store full vectors and use an HNSW expression index over the 3,072-dimensional `halfvec` cast, with queries using the matching expression/operator. Rerank the retrieved vector pool against stored full vectors before downstream assessment. Benchmark recall against exact search. Do not blindly declare an HNSW index on `vector(3072)` or reuse the superseded 768-dimensional Google schema.

This is an implementation default, not a claim that any schema or benchmark already exists. Raw float32 values alone would occupy about 1.09 GB for 88,347 full-size vectors; index, text, row, and operational overhead are additional. Verify capacity before backfill.

API keys authenticate requests; embeddings are not bound to a particular key. An authorized replacement key can be used without re-embedding. Model/dimension changes require explicit index-version handling. Store `OPENAI_API_KEY` in server secrets, never a `VITE_*` variable, source control, or this file.

### Four new tables

1. `applicant_search_index`: applicant UUID PK/FK with delete cascade; deterministic profile text; full embedding; keyword `tsvector`; normalized matching attributes with unknown flags; source hash; model/dimension/format version; indexing time; completeness and shortening flags.
2. `applicant_embedding_jobs`: applicant UUID/requested source version; status; retry count; next retry time; lease/claim token; last error. Uniqueness/coalescing must prevent redundant processing.
3. `job_match_runs`: client-job UUID FK; job hash; confirmed/extracted requirement specification; cached query embedding or reference; configuration/model versions; requester; status; timestamps; coverage; error.
4. `job_match_results`: run ID and applicant UUID; source hash/version; ranking components; final rank; matched requirements; evidence references; gaps; unknowns. Unique per run/applicant.

Add RLS and explicit grants. Normal recruiters can read authorized results but cannot manufacture embeddings or assessments. Use parameterized RPC arguments. Restrict worker-only queue/claim functions and avoid exposing privileged functions to public roles.

### Profile generation and synchronization

Build labeled text from role, skills, summary, experience, qualifications, and process knowledge. No LLM is needed for ordinary formatting. Exclude names, email, phone, Aadhaar, nationality, and unrelated personal attributes from semantic relevance scoring. Avoid free-form recruiter opinions by default.

Retain location/pay/notice attributes separately. Unknown values must survive normalization. Use a deterministic token budget for overlength records, retain important sections, record shortening, and use original applicant fields for final evidence within bounded model inputs. Never silently drop applicants or fabricate details.

Capture relevant changes through database triggers that enqueue work inside the source transaction. The trigger must not call the embedding API. Separate semantic content changes from metadata-only changes; viewing, tagging, or screening a profile must not trigger paid re-embedding.

An Edge Function worker claims bounded batches with leases, calls OpenAI, validates dimensions and finite values, and writes only if the source hash and claim still match. Recover expired leases, retry transient failures with backoff, and surface exhausted failures. Handle duplicate delivery and edits during processing. Periodic reconciliation repairs drift. Deletions remove index data and dependent results, and workers cannot resurrect deleted profiles.

Pilot 500 representative rows, then seed the full backfill using UUID keyset pagination with checkpoints. Capture live changes before/during backfill. Account for indexed, pending, failed, and insufficient-data rows; report coverage honestly. Do not change applicants merely to mark indexing progress.

### Search and assessment

1. Authenticate and verify active-admin authorization. Load the selected `client_jobs` row server-side.
2. Extract a structured requirement specification through the existing server-side Groq integration. Separate mandatory requirements, preferences, and unresolved conflicts. Make requirements reviewable/editable; insufficient JDs need clarification.
3. Create/cache the OpenAI query embedding using the same embedding configuration as the applicant index.
4. Retrieve about 200 semantic candidates and 200 keyword candidates. Use meaningful skill/role query terms rather than treating an entire JD as an exact conjunction. Support punctuation-bearing skills such as C++ and .NET.
5. Apply confirmed eligibility and authorization constraints inside retrieval, not only after its LIMIT. Missing attributes remain unknown. Test selective filters with iterative HNSW scans and exact search for small eligible pools.
6. Deduplicate by applicant UUID and combine retrieval ranks with reciprocal rank fusion. Keep tentative person-duplicate flags separate; shared names/emails are not permission to merge records automatically.
7. Assess the top 50 unique candidates against the requirements in bounded Groq calls. Use a consistent rubric and validated structured output. Treat JD/profile text as untrusted data, never instructions. Check evidence against source fields; distinguish demonstrated facts from inferred relevance and unknowns.
8. Persist and return up to 20 strongest recommendations. Do not pad with known unsuitable candidates. Cosine similarity is not a hiring probability; show evidence coverage separately from relevance.

Run assessment as resumable work with bounded invocations if needed; do not assume 50 model calls fit within one HTTP/Edge Function lifetime. The frontend should receive a run ID, then poll authorized status/results. Reuse job hashes and request idempotency to prevent duplicate paid runs.

Cache unchanged query embeddings and results. Relevant job changes invalidate a run. Applicant edits mark affected evidence stale. Newly indexed applicants require a later refresh; displaying cached results must include generation time/coverage. Recheck current access and source status before rendering stale saved results or tagging.

### UI behavior

Add Find matching candidates and Recommended candidates to `AdminClientJobDetail.jsx`. Show progress, interpreted requirements, index coverage, errors, and refresh. Candidate cards show role, experience, matching skills, supporting evidence, gaps, and unknowns. Link to existing applicant details and tagging behavior.

Separate recommendations from already tagged candidates. Show already-tagged status and prevent duplicate tagging for the same job. Preserve current pipeline stages. Keep manual applicant search usable. Model failure must appear as a retryable failure, not zero suitable candidates or an invented score.

## Ordered implementation checklist

- [ ] Inspect current repo/AGENTS.md, package scripts, schema, policies, current extensions, provider access, and available compute. Do not redo broad research or change the applicants-only scope.
- [ ] Implement deterministic profile builder, normalization, hashing, and versioned configuration.
- [ ] Create version-controlled additive migrations for pgvector, the four tables, indexes, policies, triggers, and restricted queue/search RPCs. Test locally or in an authorized development environment first.
- [ ] Implement embedding worker, queue recovery, reconciliation, backfill seeder, dry-run accounting, and progress reporting.
- [ ] Implement requirement extraction, query embedding cache, hybrid retrieval, async assessment, and persisted results.
- [ ] Integrate matching UI and service methods without altering unrelated recruitment flows.
- [ ] Run focused automated tests and a local build using actual repository scripts.
- [ ] Validate the 500-row pilot when the user has authorized provider calls and supplied server-side credentials. Measure cost/throughput and indexing memory/storage.
- [ ] Evaluate approximately 10 real jobs with recruiter-reviewed known-positive candidates. Untagged profiles are not presumed negative. Compare keyword-only, vector-only, and hybrid retrieval; measure top-20 usefulness and candidate recall, including approximate-vs-exact retrieval.
- [ ] Provide a reviewable diff, migration/rollback plan, measured limitations, and remaining configuration. Production rollout/full paid backfill require authorization in the CLI session if not already given there.
- [ ] Once authorized, deploy additive components, seed the backfill, monitor coverage/errors, enable the feature flag after quality checks, and keep a reversible fallback to manual search.

## Required focused tests

- Missing experience vs fresher; experience ranges; unknown salary/notice; exact skills and domain relevance.
- Token overflow, empty profiles, source hash stability, and exclusion of identity fields.
- API timeouts/rate limits, invalid vectors, queue retries, duplicate tasks, worker crashes, update-during-embedding races, and delete-during-processing races.
- Invalid/anonymous/inactive-admin requests, unauthorized table writes and worker RPC access, and authorization on saved results.
- Selective filtered search recall, deduplication, requirement conflicts, prompt injection in source text, malformed assessments, and unsupported evidence.
- Job edit invalidation, applicant edit staleness, newly indexed profiles, duplicate match requests, existing tagging/stages, loading/error/empty-result distinctions.

Do not claim recruiter quality validation occurred without actual judgments. Existing tags provide possible positives, not a complete training set. API errors must not become candidate failures. Avoid storing raw PII in logs.

## Credentials and execution boundaries

Needed at implementation time: a valid server-side OpenAI key with embedding access/quota; the existing Groq server credential and a currently supported configured model; authorized Supabase access; GitHub access if pushing. No keys are included here. Use secure local environment configuration and deployed secrets; never ask for keys to be committed or echoed.

Supabase remains responsible for vector storage/search. OpenAI is called for initial/new/changed applicant embeddings and new/changed job-query embeddings. Groq is called for requirement extraction and the small retrieved candidate pool. Supabase vector lookup and displaying saved results do not require new OpenAI calls.

The original Work session's connectors may not be configured in local CLI. Use available authorized MCP tools or supported CLIs; check actual command help and installed versions. Do not invent tool access or treat a missing connection as a reason to abandon locally implementable work.

## Reference documentation

- https://developers.openai.com/api/docs/models/text-embedding-3-large
- https://developers.openai.com/api/docs/guides/embeddings
- https://developers.openai.com/api/docs/guides/production-best-practices
- https://supabase.com/docs/guides/ai/hybrid-search
- https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes
- https://supabase.com/docs/guides/ai/automatic-embeddings
- https://github.com/pgvector/pgvector

## Suggested first prompt in Codex CLI

After putting this file in the repository root, paste:

> Read handoff.md and applicable AGENTS.md files. Continue this project by implementing the agreed applicant-table-only candidate matcher locally. Use OpenAI text-embedding-3-large and the existing server-side Groq integration as described. Inspect the current code and schema, then build the migrations, workers, matching endpoint, and UI with focused tests. Preserve existing recruiter workflows. Do not process any resume files. Do not deploy to production, apply production migrations, or start paid embedding calls/backfill yet. Complete the locally testable work, then report the diff, tests, and exact remaining configuration needed for rollout. Follow the handoff's decisions rather than proposing multiple architectures again.

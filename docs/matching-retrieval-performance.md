# Candidate retrieval performance — 2026-10-11

**Subsequent timeout change:** At the user's request, matching_search now has a function-specific 20-second statement timeout. PostgREST schema/config caches were reloaded and the deployed setting verified. Other API timeouts and the three-attempt retry limit are unchanged. All measurements below were captured with the previous eight-second limit; the benchmark harness now uses 20 seconds for future runs.

The follow-up fixes are deployed on `bvvqyjqokvnttbgyjkrt` against all **88,003** indexed applicants. Both reported failed runs completed with 50 candidates, 20 final recommendations and one final AI call each. Current compute, embeddings, dimensions, mandatory filters and the eight-second database timeout were retained.

**Full performance acceptance is not met.** All 330 warm requests passed; semantic top-20 recall was 100% on all five saved vectors. One accounting first request and five simultaneous broad accounting queries still timed out. The subsecond target is achieved for some selective searches, but not broad searches. SQL retrieval timing excludes interpretation, embedding generation, coverage lookup, UI polling and final AI ranking.

## Deployed changes

Eight additive migrations, from `20261010191235_matching_compact_retrieval` through `20261010195755_matching_ordered_lexical_switch`, improve retrieval while preserving the response shape.

- Keyword ranking reads compressed inline tsvectors and typed filters from the private `applicant_lexical` projection, away from wide vector rows. Location ordering reduces scattered heap reads. Its GIN index supplies matching; only the best 200 lexical rows receive rank positions. Exact word scores, C++/.NET normalization and UUID tie-breaking are preserved.
- Source triggers atomically synchronize keywords/attributes, invalidations and deletions. The final comparison found 88,003 projected/indexed rows and zero keyword or attribute mismatches. Source hashes/details are fetched after candidate IDs are selected.
- Eligibility counting stops at 1,001 rows. At most 1,000 eligible applicants use exact scoring over materialized IDs. Larger semantic searches use halfvec HNSW, relaxed iterative scanning, ef_search 100, a 20,000-tuple scan bound and memory multiplier 4. Full-precision vectors rerank the retrieved pool. Planner settings are scoped to the semantic helper.
- Selective location searches combine disjoint unknown-location and Gurgaon HNSW pools with exact scoring of at most 4,000 qualifying other known-location rows. Larger other-location groups use global filtered HNSW. Experience/notice restrictions apply to every group, retaining unknown values. The merged semantic pool remains at most 400, then 200 semantic and 200 keyword candidates fuse into at most 50 assessment IDs. Modes execute only their requested branch.
- Metadata-only embedding refreshes preserve token accounting without writing embedding/keyword columns when their content and hashes are unchanged. Changed content still maintains indexes.
- Coverage snapshots are cached for 60 seconds with one aggregate pass and an advisory lock against parallel refreshes. API version 5 derives candidate/result counts from fetched rows and computes the newly indexed reminder after completion. Worker version 11 retains guarded vector persistence, structured diagnostics, SQL codes, backoff and the three-attempt retrieval limit.
- Statistics were refreshed. The global HNSW (687 MB), unknown-location HNSW (114 MB), Gurgaon HNSW (20 MB) and active projection GIN (41 MB) all record scans. Original indexes remain available. The inactive unordered projection, about 211 MB, remains inert after switching.

Partial HNSW indexes were built concurrently before registration; migrations check validity and refuse a populated nonconcurrent build. The ordered projection was backfilled with source locks and a dual-write trigger, verified and switched under short bounded locks. Operations and rollback definitions are retained in `supabase/operations`.

## SQL retrieval measurements

Every row has a separately observed first request and 30 warm requests. All 330 warm requests had zero timeouts and unique UUIDs. Nonempty scenarios returned 50 candidates; the absent keyword returned zero. No production caches were flushed. First observations are **not** controlled cold-cache measurements. Percentiles use nearest ranks.

Saved-vector probes used the management connection's postgres role. Additional scenarios used the worker's service_role. Role/query differences must not be interpreted as network overhead. The reproduction harness now explicitly uses service_role.

| Scenario | SQL role | First observed | Warm median | Warm p95 | Warm max |
| --- | --- | ---: | ---: | ---: | ---: |
| JPC053 | postgres | 4.830 s | 1.071 s | 1.100 s | 2.080 s |
| JPC054 | postgres | 7.143 s | 1.592 s | 1.879 s | 5.601 s |
| accounting_saved | postgres | timeout (8.625 s observed) | 2.858 s | 3.264 s | 4.148 s |
| cyber_saved | postgres | 3.010 s | 0.286 s | 0.314 s | 0.316 s |
| audit_saved | postgres | 3.904 s | 0.611 s | 0.651 s | 0.687 s |
| unrestricted | service_role | 7.330 s | 4.877 s | 5.191 s | 5.366 s |
| ten_years | service_role | 3.665 s | 2.360 s | 2.589 s | 2.679 s |
| location_notice | service_role | 4.801 s | 1.069 s | 1.165 s | 1.346 s |
| unknowns | service_role | 7.253 s | 0.307 s | 0.475 s | 1.256 s |
| empty | service_role | 0.010 s | 0.002 s | 0.009 s | 0.009 s |
| punctuation | service_role | 0.095 s | 0.010 s | 0.022 s | 0.026 s |

The accounting timeout is censored: 8.625 seconds is observed cancellation duration, not successful completion time. Additional scenarios reuse JPC-053's vector with varied filters; punctuation and empty results are keyword-only.

Earlier broad accounting keyword profiling took 34.485 seconds and read about 525 MiB through wide rows. The post-switch JPC-053 keyword plan took 1.254 seconds with 4,715 read blocks (about 36.8 MiB). The global HNSW probe returned 400 rows in 2.953 seconds. The isolated fusion probe with two 200-row rank inputs and source-hash lookup took 9.153 ms; this is not complete retrieval latency. Captured EXPLAIN ANALYZE/BUFFERS plans are retained in the follow-up JSON.

## Recall

The deployed matching_search semantic top 20 was compared with exhaustive full-precision scoring under identical mandatory filters and UUID tie-breaking. All five saved vectors—JPC-053, JPC-054, accounting, cybersecurity and audit—matched **20/20**, giving **100% average recall**, exceeding the 95% requirement with no case below 90%. Earlier audit/notice-zero diagnostics also matched 20/20 after the fixes. This demonstrates quality for tested jobs, not a guarantee for future descriptions.

Tests verify eligibility ranges, unknowns, punctuation, deduplication, branch isolation, staleness, projection synchronization and failed/incomplete switch recovery.

## Recovered live runs

| Run | Retrieval attempts | Successful RPC | Coverage | Until search matches available | Final result |
| --- | ---: | ---: | ---: | ---: | --- |
| 7043b969-f2f6-4ce7-b5cf-7e3593945359 / JPC-053 | 1 | 7.520 s | 1.677 s | 10.059 s | 50 candidates, 20 recommendations, one final AI call |
| 1f072e15-f392-47ec-b7bc-d3b16c2b63cc / JPC-054 | 2 | 7.951 s | 1.063 s | 9.267 s on successful attempt | 50 candidates, 20 recommendations, one final AI call |

Saved vectors were reused: vector stages took 3–4 ms without new interpretation/embedding calls. JPC-054's first RPC canceled with SQLSTATE 57014 at 8.085 seconds; its second succeeded. Resets were guarded by failed retrieval status, current job hash/version, no active lease, saved vector and zero previous final AI calls. Both completed with zero stale candidate rows.

JPC-053 finished its successful worker invocation in approximately 13.687 seconds including AI ranking. **5–8 seconds was demonstrated for retrieval, but not the complete top-20 response.** Warm SQL timing must not be presented as total user wait.

## Concurrency and capacity

Five saved accounting queries started on five distinct backends within 17 ms, proving actual overlap. All five canceled with 57014 after approximately 8.70 seconds. Cron final status is affected by self-unscheduling; structured PostgreSQL LOG records establish retrieval outcomes. All benchmark jobs were removed, verified remaining count zero. SQL, recall and concurrency probes made no provider calls.

The first self-unscheduling-at-entry harness canceled its own work and was discarded. Automatic review rejected a replacement that could repeat indefinitely. The executed harness removed each job after its single retrieval, including timeout paths. No benchmark worker API was deployed.

Residual cache/I/O and concurrency constraints remain; these results do not isolate CPU saturation from disk throttling. Shared buffers are 256 MB; effective_cache_size 768 MB is a planner estimate. The compute SKU and current disk I/O budget were not verified. Historical shared-block counters do not establish current physical disk bytes or contention. The large embedding call count reflects the completed backfill; no pending embedding workload was observed.

If currently on Micro, **Small (2 GB, about $15/month compute versus Micro's $10)** is the cheapest next memory/throughput experiment, approximately $5/month extra compute before credits/other charges. It doubles listed baseline throughput and IOPS, but remains shared CPU and does not establish five-query capacity. Large lists 8 GB/two dedicated vCPUs at about $110/month compute if dedicated capacity is needed. Verify the current SKU and fresh CPU/disk metrics before a separately approved capacity experiment, then rerun the suite. No billing/compute change was made. [Supabase compute prices and disk limits](https://supabase.com/docs/guides/platform/compute-and-disk).

Storage-managed indexes and redundant applicant indexes were not changed in this matching rollout. The stale backup-claim diagnostic took about 34 ms and was not a dominant measured retrieval cost. Storage reconciliation needs its own current plan before changes.

## Verification and rollback

Final verification passed **31 Node tests and seven Deno tests**, Edge Function type checks, benchmark syntax checking and the frontend build (existing Vite chunk-size warning). Advisors found no new matching-function security warnings. Private/service-only RLS tables intentionally have no browser policies. The frontend error-copy fix is local source/build; no separate frontend-host deployment was performed.

[Follow-up measurements](matching-retrieval-followup-measurements.json) contains samples, role labels, plans, recall, concurrency and recovery results without applicant content, vectors or credentials. [Earlier measurements](matching-retrieval-measurements.json) preserves prior implementation failures separately.

With an authorized psql connection and securely supplied PG variables, run `node tools/matching/benchmark.mjs --full --recall`. It uses existing vectors, the worker role and separate concurrency connections. Only exhaustive recall truth uses a connection-local 60-second diagnostic timeout; production retrieval now allows 20 seconds. Avoid casually repeating broad concurrent production load.

`monitor_matching_retrieval.sql` selects the first ten newly created real runs after the final switch. Those ten new runs have not occurred; recovered older runs do not satisfy that monitoring requirement. Monitoring and first-request/concurrency failures remain open acceptance items.

For rollback of this follow-up, apply retained definitions from `rollback_compact_retrieval.sql` as a new migration and restore API version 4 from `rollback-candidate-matching-api.json` if needed. Worker version 11 can retain vector-cache/retry fixes. Keep derived tables/indexes inert until rollback is verified; no vectors or completed results need removal. To also undo the earlier worker changes, restore its version-8 bundle before the earlier SQL rollback.

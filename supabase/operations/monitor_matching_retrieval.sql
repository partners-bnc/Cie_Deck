-- Inspect the first ten new real runs after this rollout; do not create paid test runs.
select r.id,j.job_code,r.status,r.phase,r.attempts,r.retrieval_ms,r.final_ai_calls,
  r.query_embedding is not null as query_vector_saved,
  (select count(*) from public.job_match_results t where t.run_id=r.id) as pool_count,
  r.last_error,r.created_at,r.updated_at
from public.job_match_runs r join public.client_jobs j on j.id=r.client_job_id
where r.created_at >= timestamptz '2026-10-10 19:57:55+00'
order by r.created_at limit 10;

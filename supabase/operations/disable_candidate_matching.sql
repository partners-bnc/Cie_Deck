-- Non-destructive rollback: stop paid background processing; preserve saved data for inspection.
do $$ declare job_id bigint; begin
  for job_id in select jobid from cron.job where jobname in ('applicant-embedding-worker','candidate-match-worker','applicant-index-reconciliation') loop
    perform cron.unschedule(job_id);
  end loop;
end $$;
-- Also set VITE_CANDIDATE_MATCHING_ENABLED=false and redeploy the frontend.
-- Disable candidate-matching endpoint/rotate MATCH_WORKER_SECRET to stop immediate worker wakeups.

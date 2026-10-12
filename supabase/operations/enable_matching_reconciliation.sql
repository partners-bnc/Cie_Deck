-- Apply only AFTER full-backfill authorization. Repairs drift in bounded UUID-keyset sweeps.
-- It can enqueue work that causes provider charges when embedding workers run.
do $$ declare job_id bigint; begin
  select jobid into job_id from cron.job where jobname='applicant-index-reconciliation';
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('applicant-index-reconciliation','* * * * *','select public.matching_reconcile(500)');
end $$;

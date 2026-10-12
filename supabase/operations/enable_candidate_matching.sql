-- Run only after deployment/pilot authorization. Scheduling can incur provider charges.
-- The project URL is public. Change it for an authorized development project.
do $$
declare worker_secret text; job_id bigint;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1;
  if worker_secret is null or length(worker_secret)<32 then raise exception 'Create Vault secret MATCH_WORKER_SECRET before scheduling'; end if;
  for job_id in select jobid from cron.job where jobname in ('applicant-embedding-worker','candidate-match-worker','applicant-index-reconciliation') loop
    perform cron.unschedule(job_id);
  end loop;
  perform cron.schedule('applicant-embedding-worker','* * * * *', $cron$
    select net.http_post(url:='https://bvvqyjqokvnttbgyjkrt.supabase.co/functions/v1/applicant-embedding-worker',
      headers:=jsonb_build_object('Content-Type','application/json','x-match-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1)),
      body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=45000);
  $cron$);
  perform cron.schedule('candidate-match-worker','20 seconds', $cron$
    select net.http_post(url:='https://bvvqyjqokvnttbgyjkrt.supabase.co/functions/v1/candidate-match-worker',
      headers:=jsonb_build_object('Content-Type','application/json','x-match-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1)),
      body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=45000)
    where exists(select 1 from public.job_match_runs
      where config_version='matching-auto-v3' and not is_stale and status in ('extracting','queued','running')
        and next_retry_at<=now() and (lease_until is null or lease_until<now()));
  $cron$);
end $$;
-- Full-index reconciliation is deliberately enabled separately AFTER full-backfill authorization.

-- Continue recruiter-requested job matching without enabling applicant backfill.
-- Run after deploying candidate-match-worker and configuring MATCH_WORKER_SECRET in Vault.
do $$
declare worker_secret text; job_id bigint;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1;
  if worker_secret is null or length(worker_secret)<32 then
    raise exception 'Create Vault secret MATCH_WORKER_SECRET before scheduling';
  end if;
  for job_id in select jobid from cron.job where jobname='candidate-match-worker' loop
    perform cron.unschedule(job_id);
  end loop;
  perform cron.schedule('candidate-match-worker','20 seconds', $cron$
    select net.http_post(
      url:='https://bvvqyjqokvnttbgyjkrt.supabase.co/functions/v1/candidate-match-worker',
      headers:=jsonb_build_object('Content-Type','application/json','x-match-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1)),
      body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=45000)
    where exists (
      select 1 from public.job_match_runs
      where status in ('extracting','queued','running')
        and config_version='matching-auto-v3' and not is_stale
        and next_retry_at<=now() and (lease_until is null or lease_until<now())
    );
  $cron$);
end $$;

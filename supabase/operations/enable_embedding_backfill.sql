-- Authorized full applicant backfill, using the concurrency measured in the 500-row pilot.
-- No resumes are downloaded. Existing current embeddings are reused.
do $$
declare worker_secret text; job_id bigint;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1;
  if worker_secret is null or length(worker_secret)<32 then raise exception 'MATCH_WORKER_SECRET is missing from Vault'; end if;
  for job_id in select jobid from cron.job where jobname in ('applicant-embedding-worker','applicant-index-reconciliation') loop
    perform cron.unschedule(job_id);
  end loop;
  perform cron.schedule('applicant-index-reconciliation','* * * * *','select public.matching_reconcile(500)');
  perform cron.schedule('applicant-embedding-worker','10 seconds', $cron$
    select net.http_post(
      url:='https://bvvqyjqokvnttbgyjkrt.supabase.co/functions/v1/applicant-embedding-worker',
      headers:=jsonb_build_object('Content-Type','application/json','x-match-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='MATCH_WORKER_SECRET' limit 1)),
      body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=45000)
    from generate_series(1,4)
    where exists(select 1 from public.applicant_embedding_jobs
      where status in ('pending','processing') and attempts<6 and next_retry_at<=now()
        and (lease_until is null or lease_until<now()));
  $cron$);
end $$;
-- Seed the first bounded page immediately; the persisted cursor continues through cron.
select public.matching_reconcile(500);

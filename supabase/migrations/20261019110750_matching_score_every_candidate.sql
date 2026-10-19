-- New scoring contract: every retrieved applicant needs a 0..100 score and summary.
-- Completed historical runs and all applicant vectors remain intact.
alter table public.job_match_runs alter column config_version set default 'matching-all-scored-v5';
do $$ declare f record; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname like 'matching\_%' escape '\'
      and position('matching-description-v4' in p.prosrc)>0
  loop execute replace(pg_get_functiondef(f.oid),'matching-description-v4','matching-all-scored-v5'); end loop;
end $$;
update public.job_match_runs set status='stale',is_stale=true,claim_token=null,lease_until=null,updated_at=now()
where config_version<>'matching-all-scored-v5' and status in ('extracting','draft','queued','running');

create or replace function public.matching_finish_batch(p_run uuid,p_claim uuid,p_pool jsonb,p_results jsonb) returns boolean
language plpgsql set search_path=public as $$
declare r public.job_match_runs; j public.client_jobs;
begin
  if jsonb_typeof(p_pool) is distinct from 'array' or jsonb_array_length(p_pool)>50
    or (select count(distinct x->>'applicant_id') from jsonb_array_elements(p_pool) x)<>jsonb_array_length(p_pool)
    then raise exception 'Invalid candidate pool'; end if;
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  perform 1 from applicants where id in (select (x->>'applicant_id')::uuid from jsonb_array_elements(p_pool) x) order by id for share;
  select * into r from job_match_runs where id=p_run and claim_token=p_claim and lease_until>now()
    and status='running' and phase='assessment' and config_version='matching-all-scored-v5' for update;
  if not found then return false; end if;
  if r.is_stale or r.job_hash<>matching_private.job_hash(j) or
    jsonb_array_length(p_pool)<>(select count(*) from job_match_results where run_id=p_run) or exists (
      select 1 from jsonb_array_elements(p_pool) x left join applicants a on a.id=(x->>'applicant_id')::uuid
      left join job_match_results t on t.run_id=p_run and t.applicant_id=a.id
      where a.id is null or t.applicant_id is null or t.stale or t.source_hash<>x->>'source_hash'
        or matching_private.applicant_hash(a)<>x->>'source_hash'
    ) then
    update job_match_runs set status='stale',is_stale=true,claim_token=null,lease_until=null,updated_at=now() where id=p_run;
    return false;
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)<>jsonb_array_length(p_pool)
    or jsonb_array_length(p_results)>50
    or (select count(distinct x->>'applicant_id') from jsonb_array_elements(p_results) x)<>jsonb_array_length(p_results)
    or exists(select 1 from jsonb_array_elements(p_results) x where not coalesce(
      exists(select 1 from job_match_results t where t.run_id=p_run and t.applicant_id=(x->>'applicant_id')::uuid and t.source_hash=x->>'source_hash')
      and case when jsonb_typeof(x->'score')='number' then (x->>'score')::numeric between 0 and 100
        and trunc((x->>'score')::numeric)=(x->>'score')::numeric else false end
      and jsonb_typeof(x#>'{assessment,analysis}')='string'
      and length(btrim(x#>>'{assessment,analysis}')) between 1 and 600,false))
    then raise exception 'Incomplete or invalid candidate scores'; end if;
  with ranked as (
    select x, row_number() over(order by (x->>'score')::numeric desc,(t.retrieval->>'rrf')::numeric desc,t.applicant_id) as rank
    from jsonb_array_elements(p_results) x join job_match_results t on t.run_id=p_run and t.applicant_id=(x->>'applicant_id')::uuid
  )
  update job_match_results t set assessment=ranked.x->'assessment',score=(ranked.x->>'score')::numeric,
    evidence_coverage=null,suitable=null,final_rank=ranked.rank
    from ranked where t.run_id=p_run and t.applicant_id=(ranked.x->>'applicant_id')::uuid;
  update job_match_runs set status='completed',phase='complete',completed_at=now(),updated_at=now(),
    claim_token=null,lease_until=null,attempts=0,last_error=null where id=p_run;
  return true;
end;
$$;


notify pgrst, 'reload schema';

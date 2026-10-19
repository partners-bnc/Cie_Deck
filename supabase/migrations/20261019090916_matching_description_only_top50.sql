-- Preserve applicant embeddings and historical results. New runs must re-extract
-- requirements from the description, never reuse structured-field requirements.
create or replace function matching_private.job_hash(j public.client_jobs) returns text
language sql immutable set search_path='' as $$
  select md5(jsonb_build_object('description',j.job_description,'version','description-only-v4')::text);
$$;

alter table public.job_match_runs alter column config_version set default 'matching-description-v4';

-- Preserve the current retry, claim, hash-check and access-control definitions;
-- advance only their pipeline guard and the atomic result-count ceiling.
do $$
declare f record; definition text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'matching\_%' escape '\'
      and p.prokind='f' and position('matching-auto-v3' in p.prosrc)>0
  loop
    definition := replace(pg_get_functiondef(f.oid),'matching-auto-v3','matching-description-v4');
    execute definition;
  end loop;
  definition := pg_get_functiondef('public.matching_finish_batch(uuid,uuid,jsonb,jsonb)'::regprocedure);
  if position('jsonb_array_length(p_results)>20' in definition)=0 then
    raise exception 'Unexpected batch result guard; inspect before deploying';
  end if;
  execute replace(definition,'jsonb_array_length(p_results)>20','jsonb_array_length(p_results)>50');
end $$;

-- Historical results stay readable, but must be refreshed before tagging.
update public.job_match_runs set is_stale=true,
  status=case when status in ('extracting','draft','queued','running') then 'stale' else status end,
  claim_token=null,lease_until=null,updated_at=now()
where config_version<>'matching-description-v4';

notify pgrst, 'reload schema';

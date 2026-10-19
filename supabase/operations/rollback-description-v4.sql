-- Restore with previous API/worker bundles. Historical results remain stale until refreshed.
set search_path=public,extensions;
CREATE OR REPLACE FUNCTION matching_private.job_hash(j client_jobs)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select md5(jsonb_build_object('title',j.job_title,'description',j.job_description,'experience',j.experience,
    'location',j.location,'state',j.state,'country',j.country,'pay_rate',j.pay_rate,
    'mode',j.job_mode,'type',j.job_type,'status',j.status)::text);
$function$
;
CREATE OR REPLACE FUNCTION public.matching_begin_batch(p_run uuid, p_claim uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare calls integer;
begin
  update job_match_runs set final_ai_calls=final_ai_calls+1,updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and phase='assessment' and status='running'
      and config_version='matching-auto-v3' and not is_stale and final_ai_calls<3
    returning final_ai_calls into calls;
  return calls;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_claim_batch_run(p_run uuid DEFAULT NULL::uuid)
 RETURNS job_match_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.job_match_runs;
begin
  update job_match_runs set status='failed',last_error='Retry limit exhausted',claim_token=null,lease_until=null
    where config_version='matching-auto-v3' and status in ('extracting','queued','running')
    and (p_run is null or id=p_run) and (attempts>=6 or (phase='retrieval' and attempts>=3) or (phase='assessment' and final_ai_calls>=3))
    and (lease_until is null or lease_until<now());
  select * into r from job_match_runs where config_version='matching-auto-v3' and status in ('extracting','queued','running')
    and not is_stale and (p_run is null or id=p_run) and attempts<6 and (phase<>'retrieval' or attempts<3) and (phase<>'assessment' or final_ai_calls<3)
    and next_retry_at<=now() and (lease_until is null or lease_until<now()) order by next_retry_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update job_match_runs set claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,
    status=case when status='queued' then 'running' else status end,updated_at=now() where id=r.id returning * into r;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_finish_batch(p_run uuid, p_claim uuid, p_pool jsonb, p_results jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.job_match_runs; j public.client_jobs;
begin
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  perform 1 from applicants where id in (select (x->>'applicant_id')::uuid from jsonb_array_elements(p_pool) x) order by id for share;
  select * into r from job_match_runs where id=p_run and claim_token=p_claim and lease_until>now()
    and status='running' and phase='assessment' and config_version='matching-auto-v3' for update;
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
  if jsonb_array_length(p_results)>20 or (select count(distinct x->>'applicant_id') from jsonb_array_elements(p_results) x)<>jsonb_array_length(p_results)
    or exists(select 1 from jsonb_array_elements(p_results) x where not exists(
      select 1 from job_match_results t where t.run_id=p_run and t.applicant_id=(x->>'applicant_id')::uuid and t.source_hash=x->>'source_hash')
      or (x->>'score')::numeric not between 40 and 100) then raise exception 'Invalid batch results'; end if;
  update job_match_results set assessment=null,score=null,evidence_coverage=null,suitable=null,final_rank=null where run_id=p_run;
  update job_match_results t set assessment=x.value->'assessment',score=(x.value->>'score')::numeric,
    suitable=true,final_rank=x.ordinality
    from jsonb_array_elements(p_results) with ordinality x where t.run_id=p_run and t.applicant_id=(x.value->>'applicant_id')::uuid;
  update job_match_runs set status='completed',phase='complete',completed_at=now(),updated_at=now(),
    claim_token=null,lease_until=null,attempts=0,last_error=null where id=p_run;
  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_prepare(p_job uuid, p_requester uuid, p_model text, p_refresh boolean DEFAULT false)
 RETURNS job_match_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare j public.client_jobs; r public.job_match_runs; h text;
begin
  select * into j from client_jobs where id=p_job for share;
  if not found then raise exception 'Job not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job::text,0));
  h:=matching_private.job_hash(j);
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and config_version='matching-auto-v3' and status in ('extracting','queued','running') order by created_at desc limit 1;
  if found then return r; end if;
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and config_version='matching-auto-v3' and status='completed' and not is_stale order by created_at desc limit 1;
  if found and not p_refresh then return r; end if;
  update job_match_runs set status='stale',is_stale=true,claim_token=null,lease_until=null
    where client_job_id=p_job and status in ('extracting','draft','queued','running');
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and requirements is not null and phase<>'requirements' and config_version='matching-auto-v3' order by created_at desc limit 1;
  insert into job_match_runs(client_job_id,job_hash,groq_model,requested_by,status,phase,requirements,query_embedding)
    values(p_job,h,p_model,p_requester,case when r.requirements is null then 'extracting' else 'queued' end,
      case when r.requirements is null then 'requirements' else 'retrieval' end,r.requirements,r.query_embedding)
    returning * into r;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_release_batch_run(p_run uuid, p_claim uuid, p_error text DEFAULT NULL::text, p_retry_seconds integer DEFAULT NULL::integer, p_transient boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update job_match_runs set
    status=case when p_error is not null and (not p_transient or attempts>=6 or (phase='retrieval' and attempts>=3) or (phase='assessment' and final_ai_calls>=3)) then 'failed' else status end,
    next_retry_at=case when p_error is null then now() else now()+make_interval(secs=>greatest(coalesce(p_retry_seconds,0),least(300,15*power(2,attempts)::integer))) end,
    last_error=p_error,attempts=case when p_error is null then 0 else attempts end,
    claim_token=null,lease_until=null,updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and config_version='matching-auto-v3';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_retry_batch(p_run uuid)
 RETURNS job_match_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.job_match_runs;
begin
  select * into r from job_match_runs where id=p_run for update;
  if r.id is null or r.config_version<>'matching-auto-v3' or r.status<>'failed' or r.is_stale or r.phase<>'assessment' then raise exception 'Refresh search before retrying'; end if;
  update job_match_runs set status='queued',attempts=0,final_ai_calls=0,next_retry_at=now(),last_error=null,
    claim_token=null,lease_until=null,updated_at=now() where id=p_run returning * into r;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_save_auto_requirements(p_run uuid, p_claim uuid, p_requirements jsonb)
 RETURNS job_match_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.job_match_runs; j public.client_jobs;
begin
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  update job_match_runs set requirements=p_requirements,status='running',phase='retrieval',attempts=1,last_error=null,updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and status='extracting' and config_version='matching-auto-v3'
      and not is_stale and job_hash=matching_private.job_hash(j) returning * into r;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_save_query_embedding(p_run uuid, p_claim uuid, p_vector vector)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare j public.client_jobs;
begin
  if p_vector is null or vector_dims(p_vector)<>3072 or vector_norm(p_vector)=0 then raise exception 'Invalid query vector'; end if;
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  update job_match_runs set query_embedding=coalesce(query_embedding,p_vector),updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and phase='retrieval' and status='running'
      and config_version='matching-auto-v3' and not is_stale and job_hash=matching_private.job_hash(j);
  return found;
end;
$function$
;
alter table public.job_match_runs alter column config_version set default 'matching-auto-v3';
notify pgrst, 'reload schema';


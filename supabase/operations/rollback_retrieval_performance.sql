-- Restore pre-optimization definitions. Roll back the worker first.
set search_path=public,extensions;
CREATE OR REPLACE FUNCTION public.matching_save_auto_requirements(p_run uuid, p_claim uuid, p_requirements jsonb)
 RETURNS job_match_runs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r public.job_match_runs; j public.client_jobs;
begin
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  update job_match_runs set requirements=p_requirements,status='running',phase='retrieval',attempts=0,last_error=null,updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and status='extracting' and config_version='matching-auto-v3'
      and not is_stale and job_hash=matching_private.job_hash(j) returning * into r;
  return r;
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
    and (p_run is null or id=p_run) and (attempts>=6 or (phase='assessment' and final_ai_calls>=3))
    and (lease_until is null or lease_until<now());
  select * into r from job_match_runs where config_version='matching-auto-v3' and status in ('extracting','queued','running')
    and not is_stale and (p_run is null or id=p_run) and attempts<6 and (phase<>'assessment' or final_ai_calls<3)
    and next_retry_at<=now() and (lease_until is null or lease_until<now()) order by next_retry_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update job_match_runs set claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,
    status=case when status='queued' then 'running' else status end,updated_at=now() where id=r.id returning * into r;
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
    status=case when p_error is not null and (not p_transient or attempts>=6 or (phase='assessment' and final_ai_calls>=3)) then 'failed' else status end,
    next_retry_at=case when p_error is null then now() else now()+make_interval(secs=>greatest(coalesce(p_retry_seconds,0),least(300,15*power(2,attempts)::integer))) end,
    last_error=p_error,attempts=case when p_error is null then 0 else attempts end,
    claim_token=null,lease_until=null,updated_at=now()
    where id=p_run and claim_token=p_claim and lease_until>now() and config_version='matching-auto-v3';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.matching_search(p_vector vector, p_keywords text[], p_min_years numeric DEFAULT NULL::numeric, p_exact boolean DEFAULT false, p_locations text[] DEFAULT '{}'::text[], p_max_notice_days integer DEFAULT NULL::integer, p_mode text DEFAULT 'hybrid'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare result jsonb; query tsquery; eligible_count integer;
begin
  if cardinality(p_keywords)=0 or cardinality(p_keywords)>30 then raise exception 'Invalid keywords'; end if;
  if p_mode not in ('hybrid','semantic','keyword') then raise exception 'Invalid retrieval mode'; end if;
  select string_agg('('||plainto_tsquery('simple',regexp_replace(regexp_replace(lower(term),'c\+\+',' cpp ','g'),'\.net',' dotnet ','g'))::text||')',' | ')::tsquery
    into query from unnest(p_keywords) term where numnode(plainto_tsquery('simple',term))>0 or term in ('C++','.NET');
  perform set_config('hnsw.iterative_scan','strict_order',true);
  perform set_config('hnsw.ef_search','100',true);
  select coalesce(array_agg(lower(trim(x))),'{}') into p_locations from unnest(p_locations) x;
  select count(*) into eligible_count from (select 1 from applicant_search_index i where i.is_current and i.embedding is not null
    and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days) limit 1001) eligible;
  if p_exact or eligible_count<=1000 then perform set_config('enable_indexscan','off',true); end if;
  with semantic_approx as materialized (
    select * from matching_semantic_pool(p_vector,p_min_years,p_exact or eligible_count<=1000,p_locations,p_max_notice_days)
  ), semantic as (
    select applicant_id,row_number() over(order by embedding<=>p_vector,applicant_id) as position,embedding<=>p_vector as distance
      from semantic_approx order by embedding<=>p_vector,applicant_id limit 200
  ), lexical as (
    select applicant_id,row_number() over(order by ts_rank_cd(keywords,query) desc,applicant_id) as position
      from applicant_search_index i where i.is_current and i.embedding is not null and keywords@@query
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days)
      order by ts_rank_cd(keywords,query) desc,applicant_id limit 200
  ), fused as (
    select coalesce(s.applicant_id,l.applicant_id) applicant_id,s.position semantic_rank,l.position keyword_rank,s.distance,
      coalesce(1.0/(60+s.position),0)+coalesce(1.0/(60+l.position),0) as rrf from semantic s full join lexical l using(applicant_id)
  ), pool as (
    select f.*,i.source_hash,case p_mode when 'semantic' then coalesce(1.0/(60+semantic_rank),0)
      when 'keyword' then coalesce(1.0/(60+keyword_rank),0) else rrf end retrieval_score
    from fused f join applicant_search_index i using(applicant_id)
    where p_mode='hybrid' or (p_mode='semantic' and semantic_rank is not null) or (p_mode='keyword' and keyword_rank is not null)
    order by retrieval_score desc,applicant_id limit 50
  ) select coalesce(jsonb_agg(to_jsonb(pool) order by retrieval_score desc,applicant_id),'[]') into result from pool;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.matching_semantic_pool(p_vector vector, p_min_years numeric, p_exact boolean, p_locations text[], p_max_notice_days integer)
 RETURNS TABLE(applicant_id uuid, embedding vector)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if p_exact then
    return query select i.applicant_id,i.embedding from applicant_search_index i where i.is_current and i.embedding is not null
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days) order by i.embedding<=>p_vector limit 400;
  else
    return query select i.applicant_id,i.embedding from applicant_search_index i where i.is_current and i.embedding is not null
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days)
      order by i.embedding::halfvec(3072)<=>p_vector::halfvec(3072) limit 400;
  end if;
end;
$function$
;

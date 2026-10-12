set search_path=public,extensions;
select '[1]'::extensions.vector;
CREATE OR REPLACE FUNCTION public.matching_search(p_vector vector, p_keywords text[], p_min_years numeric DEFAULT NULL::numeric, p_exact boolean DEFAULT false, p_locations text[] DEFAULT '{}'::text[], p_max_notice_days integer DEFAULT NULL::integer, p_mode text DEFAULT 'hybrid'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
declare result jsonb; query tsquery; eligible_count integer;
begin
  if cardinality(p_keywords)=0 or cardinality(p_keywords)>30 then raise exception 'Invalid keywords'; end if;
  if p_mode not in ('hybrid','semantic','keyword') then raise exception 'Invalid retrieval mode'; end if;
  select string_agg('('||plainto_tsquery('simple',regexp_replace(regexp_replace(lower(term),'c\+\+',' cpp ','g'),'\.net',' dotnet ','g'))::text||')',' | ')::tsquery
    into query from unnest(p_keywords) term where numnode(plainto_tsquery('simple',term))>0 or term in ('C++','.NET');
  select coalesce(array_agg(lower(trim(x))),'{}') into p_locations from unnest(p_locations) x;
  if p_mode<>'keyword' then
  select count(*) into eligible_count from (select 1 from applicant_search_index i where i.is_current and i.embedding is not null
    and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
    and (cardinality(p_locations)=0 or i.attributes->>'location' is null or lower(i.attributes->>'location')=any(p_locations))
    and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days) limit 1001) eligible;
  end if;
  with semantic_approx as materialized (
    select * from matching_semantic_pool(p_vector,p_min_years,p_exact or eligible_count<=1000,p_locations,p_max_notice_days) where p_mode<>'keyword'
  ), semantic as (
    select applicant_id,row_number() over(order by embedding<=>p_vector,applicant_id) as position,embedding<=>p_vector as distance
      from semantic_approx order by embedding<=>p_vector,applicant_id limit 200
  ), lexical as (
    select applicant_id,row_number() over(order by ts_rank_cd(keywords,query) desc,applicant_id) as position
      from applicant_search_index i where p_mode<>'semantic' and i.is_current and i.embedding is not null and keywords@@query
      and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
    and (cardinality(p_locations)=0 or i.attributes->>'location' is null or lower(i.attributes->>'location')=any(p_locations))
    and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days)
      order by ts_rank_cd(keywords,query) desc,applicant_id limit 200
  ), fused as (
    select coalesce(s.applicant_id,l.applicant_id) applicant_id,s.position semantic_rank,l.position keyword_rank,s.distance,
      coalesce(1.0/(60+s.position),0)+coalesce(1.0/(60+l.position),0) as rrf from semantic s full join lexical l using(applicant_id)
  ), pool as (
    select f.*,case p_mode when 'semantic' then coalesce(1.0/(60+semantic_rank),0)
      when 'keyword' then coalesce(1.0/(60+keyword_rank),0) else rrf end retrieval_score
    from fused f
    where p_mode='hybrid' or (p_mode='semantic' and semantic_rank is not null) or (p_mode='keyword' and keyword_rank is not null)
    order by retrieval_score desc,applicant_id limit 50
  ), detailed as (
    select pool.*,i.source_hash from pool join applicant_search_index i using(applicant_id)
  ) select coalesce(jsonb_agg(to_jsonb(detailed) order by retrieval_score desc,applicant_id),'[]') into result from detailed;
  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_coverage()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('total',(select count(*) from applicants),
    'indexed',(select count(*) from applicant_search_index where is_current and embedding is not null),
    'insufficient',(select count(*) from applicant_search_index where is_current and insufficient_data),
    'pending',(select count(*) from applicant_embedding_jobs where status in ('pending','processing')),
    'failed',(select count(*) from applicant_embedding_jobs where status='failed'),
    'embedding_input_tokens',(select coalesce(sum(embedding_input_tokens_total),0) from applicant_search_index));
$function$
;
CREATE OR REPLACE FUNCTION public.matching_semantic_pool(p_vector vector, p_min_years numeric, p_exact boolean, p_locations text[], p_max_notice_days integer)
 RETURNS TABLE(applicant_id uuid, embedding vector)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
 SET plan_cache_mode TO 'force_custom_plan'
 SET enable_seqscan TO 'on'
 SET "hnsw.iterative_scan" TO 'strict_order'
 SET "hnsw.ef_search" TO '100'
 SET "hnsw.max_scan_tuples" TO '20000'
 SET "hnsw.scan_mem_multiplier" TO '1'
AS $function$
begin
  if p_exact then
    -- Materialize only eligible IDs before touching full precision vectors.
    return query with eligible as materialized (
      select i.applicant_id from applicant_search_index i
      where i.is_current and i.embedding is not null and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
    and (cardinality(p_locations)=0 or i.attributes->>'location' is null or lower(i.attributes->>'location')=any(p_locations))
    and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days)
    )
    select i.applicant_id,i.embedding from eligible e join applicant_search_index i using(applicant_id)
    order by i.embedding<=>p_vector,i.applicant_id limit 400;
  else
    -- Scoped by the function SET clause; never disables GIN or the caller's scans.
    perform set_config('enable_seqscan','off',true);
    return query select i.applicant_id,i.embedding from applicant_search_index i
    where i.is_current and i.embedding is not null and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
    and (cardinality(p_locations)=0 or i.attributes->>'location' is null or lower(i.attributes->>'location')=any(p_locations))
    and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days)
    order by i.embedding::halfvec(3072)<=>p_vector::halfvec(3072) limit 400;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.matching_finish_embedding(p_applicant uuid, p_claim uuid, p_source_hash text, p_profile text, p_embedding vector, p_embedding_hash text, p_attributes jsonb, p_shortened boolean, p_completeness numeric, p_tokens integer DEFAULT 0, p_provider_tokens integer DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare a public.applicants;
begin
  -- Lock source first, matching the update trigger lock order. Edits/deletes cannot interleave this commit.
  select * into a from applicants where id=p_applicant for share;
  if not found or matching_private.applicant_hash(a)<>p_source_hash then return false; end if;
  perform 1 from applicant_embedding_jobs where applicant_id=p_applicant and claim_token=p_claim
    and source_hash=p_source_hash and status='processing' and lease_until>now() for update;
  if not found then return false; end if;
  if (p_profile='' and p_embedding is not null) or (p_profile<>'' and p_embedding is null) then raise exception 'Invalid empty profile'; end if;
  insert into applicant_search_index(applicant_id,profile_text,embedding,keywords,attributes,source_hash,embedding_hash,
    model,dimensions,format_version,shortened,completeness,insufficient_data,profile_tokens,embedding_input_tokens_total)
  values(p_applicant,p_profile,p_embedding,to_tsvector('simple',regexp_replace(lower(p_profile),'c\+\+',' cpp ','g') || ' ' ||
    regexp_replace(lower(p_profile),'\.net',' dotnet ','g')),p_attributes,p_source_hash,p_embedding_hash,
    'text-embedding-3-large',3072,'applicant-v1',p_shortened,p_completeness,p_profile='',p_tokens,p_provider_tokens)
  on conflict(applicant_id) do update set profile_text=excluded.profile_text,embedding=excluded.embedding,keywords=excluded.keywords,
    attributes=excluded.attributes,source_hash=excluded.source_hash,embedding_hash=excluded.embedding_hash,is_current=true,
    shortened=excluded.shortened,completeness=excluded.completeness,insufficient_data=excluded.insufficient_data,
    profile_tokens=excluded.profile_tokens,embedding_input_tokens_total=applicant_search_index.embedding_input_tokens_total+excluded.embedding_input_tokens_total,indexed_at=now();
  update applicant_embedding_jobs set status='done',claim_token=null,lease_until=null,last_error=null,updated_at=now() where applicant_id=p_applicant;
  return true;
end;
$function$
;
-- Leave the private projection and cache inert until a separate cleanup migration.


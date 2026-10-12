-- Switch only after the projection has been populated and checked.
set search_path=public,extensions;
select '[1]'::extensions.vector;
-- Idempotent catch-up also makes a clean migration replay populate existing rows.
-- Rows are locked so an applicant edit cannot race a stale projection insertion.
insert into matching_private.applicant_lexical(applicant_id,keywords,max_years,location,notice_days)
select applicant_id,keywords || ''::tsvector,(attributes#>>'{experience,max}')::numeric,
  lower(attributes->>'location'),(attributes->>'notice_days')::integer
from public.applicant_search_index i
where i.is_current and i.embedding is not null
  and not exists(select 1 from matching_private.applicant_lexical l where l.applicant_id=i.applicant_id)
for share of i
on conflict(applicant_id) do nothing;
analyze matching_private.applicant_lexical;
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
  select count(*) into eligible_count from (
    select 1 from matching_private.applicant_lexical i
    where (p_min_years is null or i.max_years is null or i.max_years>=p_min_years)
      and (cardinality(p_locations)=0 or i.location is null or i.location=any(p_locations))
      and (p_max_notice_days is null or i.notice_days is null or i.notice_days<=p_max_notice_days)
    limit 1001
  ) eligible;
  end if;
  with semantic_approx as materialized (
    select * from matching_semantic_pool(p_vector,p_min_years,p_exact or eligible_count<=1000,p_locations,p_max_notice_days) where p_mode<>'keyword'
  ), semantic as (
    select applicant_id,row_number() over(order by embedding<=>p_vector,applicant_id) as position,embedding<=>p_vector as distance
      from semantic_approx order by embedding<=>p_vector,applicant_id limit 200
  ), lexical_top as materialized (
    select i.applicant_id,ts_rank_cd(i.keywords,query) as score
    from matching_private.applicant_lexical i
    where p_mode<>'semantic' and i.keywords@@query
      and (p_min_years is null or i.max_years is null or i.max_years>=p_min_years)
      and (cardinality(p_locations)=0 or i.location is null or i.location=any(p_locations))
      and (p_max_notice_days is null or i.notice_days is null or i.notice_days<=p_max_notice_days)
    order by score desc,i.applicant_id limit 200
  ), lexical as (
    select applicant_id,row_number() over(order by score desc,applicant_id) as position from lexical_top
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
  -- A metadata-only refresh must not rewrite vectors or keyword TOAST values.
  if exists(select 1 from applicant_search_index i where i.applicant_id=p_applicant
    and i.embedding_hash=p_embedding_hash and i.profile_text=p_profile
    and (i.embedding is null)=(p_embedding is null)) then
    if exists(select 1 from applicant_search_index i where i.applicant_id=p_applicant
      and i.is_current and i.source_hash=p_source_hash and i.attributes=p_attributes
      and i.shortened=p_shortened and i.completeness=p_completeness and i.profile_tokens=p_tokens) then
      update applicant_search_index set
        embedding_input_tokens_total=embedding_input_tokens_total+p_provider_tokens,indexed_at=now()
      where applicant_id=p_applicant;
    else
      update applicant_search_index set attributes=p_attributes,source_hash=p_source_hash,is_current=true,
        shortened=p_shortened,completeness=p_completeness,insufficient_data=p_profile='',
        profile_tokens=p_tokens,embedding_input_tokens_total=embedding_input_tokens_total+p_provider_tokens,indexed_at=now()
      where applicant_id=p_applicant;
    end if;
  else
  insert into applicant_search_index(applicant_id,profile_text,embedding,keywords,attributes,source_hash,embedding_hash,
    model,dimensions,format_version,shortened,completeness,insufficient_data,profile_tokens,embedding_input_tokens_total)
  values(p_applicant,p_profile,p_embedding,to_tsvector('simple',regexp_replace(lower(p_profile),'c\+\+',' cpp ','g') || ' ' ||
    regexp_replace(lower(p_profile),'\.net',' dotnet ','g')),p_attributes,p_source_hash,p_embedding_hash,
    'text-embedding-3-large',3072,'applicant-v1',p_shortened,p_completeness,p_profile='',p_tokens,p_provider_tokens)
  on conflict(applicant_id) do update set profile_text=excluded.profile_text,embedding=excluded.embedding,keywords=excluded.keywords,
    attributes=excluded.attributes,source_hash=excluded.source_hash,embedding_hash=excluded.embedding_hash,is_current=true,
    shortened=excluded.shortened,completeness=excluded.completeness,insufficient_data=excluded.insufficient_data,
    profile_tokens=excluded.profile_tokens,embedding_input_tokens_total=applicant_search_index.embedding_input_tokens_total+excluded.embedding_input_tokens_total,indexed_at=now();
  end if;
  update applicant_embedding_jobs set status='done',claim_token=null,lease_until=null,last_error=null,updated_at=now() where applicant_id=p_applicant;
  return true;
end;
$function$
;
create or replace function public.matching_coverage() returns jsonb
language plpgsql volatile set search_path=public as $$
declare cached jsonb; refreshed timestamptz; result jsonb;
begin
  select value,refreshed_at into cached,refreshed from matching_private.coverage_cache where singleton;
  if cached is not null and refreshed>clock_timestamp()-interval '60 seconds' then return cached; end if;
  -- One refresher; concurrent callers reuse the last snapshot rather than queue.
  if cached is not null and not pg_try_advisory_xact_lock(hashtextextended('matching_coverage_cache',0)) then return cached; end if;
  if cached is null then perform pg_advisory_xact_lock(hashtextextended('matching_coverage_cache',0)); end if;
  select value,refreshed_at into cached,refreshed from matching_private.coverage_cache where singleton;
  if cached is not null and refreshed>clock_timestamp()-interval '60 seconds' then return cached; end if;
  select jsonb_build_object('total',(select count(*) from applicants),
    'indexed',count(*) filter(where is_current and embedding is not null),
    'insufficient',count(*) filter(where is_current and insufficient_data),
    'embedding_input_tokens',coalesce(sum(embedding_input_tokens_total),0),
    'pending',(select count(*) from applicant_embedding_jobs where status in ('pending','processing')),
    'failed',(select count(*) from applicant_embedding_jobs where status='failed'))
  into result from applicant_search_index;
  insert into matching_private.coverage_cache(singleton,value,refreshed_at) values(true,result,clock_timestamp())
    on conflict(singleton) do update set value=excluded.value,refreshed_at=excluded.refreshed_at;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.matching_semantic_pool(p_vector vector, p_min_years numeric, p_exact boolean, p_locations text[], p_max_notice_days integer)
 RETURNS TABLE(applicant_id uuid, embedding vector)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
 SET plan_cache_mode TO 'force_custom_plan'
 SET enable_seqscan TO 'on'
 SET "hnsw.iterative_scan" TO 'relaxed_order'
 SET "hnsw.ef_search" TO '100'
 SET "hnsw.max_scan_tuples" TO '20000'
 SET "hnsw.scan_mem_multiplier" TO '4'
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
-- Existing RPC grants are retained by CREATE OR REPLACE.


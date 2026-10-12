-- Run the ordered backfill and compare every row before this switch.
-- Once copying stops, both triggers maintain equality transactionally.
set search_path=public,extensions;
select '[1]'::extensions.vector;
analyze matching_private.applicant_lexical_ordered;
set lock_timeout='1s';
set statement_timeout='5s';
lock table public.applicant_search_index in share row exclusive mode;
lock table matching_private.applicant_lexical,matching_private.applicant_lexical_ordered in access exclusive mode;
-- Remove only stale staging rows introduced by a concurrent invalidation during copying.
delete from matching_private.applicant_lexical_ordered n
where not exists(select 1 from matching_private.applicant_lexical o where o.applicant_id=n.applicant_id);
do $$
begin
  if exists(select 1 from matching_private.applicant_lexical o
    full join matching_private.applicant_lexical_ordered n using(applicant_id)
    where o.applicant_id is null or n.applicant_id is null) then
    raise exception 'Ordered lexical backfill is incomplete; keep the existing matcher';
  end if;
end;
$$;
drop trigger matching_sync_ordered_lexical on public.applicant_search_index;
drop function matching_private.sync_ordered_lexical();
alter table matching_private.applicant_lexical rename to applicant_lexical_unordered;
alter table matching_private.applicant_lexical_ordered rename to applicant_lexical;
-- Recompile callers against the canonical table name after the atomic rename.
CREATE OR REPLACE FUNCTION matching_private.sync_lexical()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.is_current and new.embedding is not null then
    insert into matching_private.applicant_lexical(applicant_id,keywords,max_years,location,notice_days)
    values(new.applicant_id,new.keywords || ''::tsvector,(new.attributes#>>'{experience,max}')::numeric,
      lower(new.attributes->>'location'),(new.attributes->>'notice_days')::integer)
    on conflict(applicant_id) do update set keywords=excluded.keywords,max_years=excluded.max_years,
      location=excluded.location,notice_days=excluded.notice_days
    where (applicant_lexical.keywords,applicant_lexical.max_years,applicant_lexical.location,applicant_lexical.notice_days)
      is distinct from (excluded.keywords,excluded.max_years,excluded.location,excluded.notice_days);
  else
    delete from matching_private.applicant_lexical where applicant_id=new.applicant_id;
  end if;
  return new;
end;
$function$
;
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
declare known_count integer; other_locations text[];
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
    if cardinality(p_locations)>0 then
      other_locations:=array_remove(p_locations,'gurgaon');
      -- Keep the unknown-location group eligible. Exact scoring is bounded to
      -- at most 4,000 other known-location rows, never an arbitrary candidate cutoff.
      select count(*) into known_count from (
        select 1 from matching_private.applicant_lexical l
        where l.location=any(other_locations)
          and (p_min_years is null or l.max_years is null or l.max_years>=p_min_years)
          and (p_max_notice_days is null or l.notice_days is null or l.notice_days<=p_max_notice_days)
        limit 4001
      ) eligible_known;
      if known_count<=4000 then
        perform set_config('enable_seqscan','off',true);
        return query with unknown_pool as materialized (
          select i.applicant_id,i.embedding from applicant_search_index i
          where i.is_current and i.embedding is not null and i.attributes->>'location' is null
            and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
            and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days)
          order by i.embedding::halfvec(3072)<=>p_vector::halfvec(3072) limit 400
        ), gurgaon_pool as materialized (
          -- The measured hot location has its own small index. Filters are
          -- still mandatory; unknown locations remain in the separate pool.
          select i.applicant_id,i.embedding from applicant_search_index i
          where 'gurgaon'=any(p_locations) and i.is_current and i.embedding is not null
            and lower(i.attributes->>'location')='gurgaon'
            and (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
            and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days)
          order by i.embedding::halfvec(3072)<=>p_vector::halfvec(3072) limit 400
        ), known_ids as materialized (
          select l.applicant_id from matching_private.applicant_lexical l
          where l.location=any(other_locations)
            and (p_min_years is null or l.max_years is null or l.max_years>=p_min_years)
            and (p_max_notice_days is null or l.notice_days is null or l.notice_days<=p_max_notice_days)
        ), known_pool as materialized (
          select i.applicant_id,i.embedding from known_ids k join applicant_search_index i using(applicant_id)
          order by i.embedding<=>p_vector,i.applicant_id limit 400
        ), combined as (
          select * from unknown_pool union all select * from gurgaon_pool union all select * from known_pool
        )
        select c.applicant_id,c.embedding from combined c
          order by c.embedding<=>p_vector,c.applicant_id limit 400;
        return;
      end if;
    end if;
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
-- The old derived table remains private and inert for inspection/rollback.


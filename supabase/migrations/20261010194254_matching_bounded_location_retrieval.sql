-- Merge bounded location-specific ANN pools and exact small remaining groups.
-- Rerank to the original 400-row semantic pool, then 200 semantic and 50 fused.
set search_path=public,extensions;
select '[1]'::extensions.vector;
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



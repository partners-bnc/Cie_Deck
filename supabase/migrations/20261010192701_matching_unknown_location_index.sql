-- Populated deployments must build online with operations/build_matching_unknown_location_index.sql.
-- This migration only registers a valid online build, or builds on an empty install.
do $$
begin
  if exists(select 1 from pg_index where indexrelid=to_regclass('public.applicant_search_unknown_location_hnsw') and indisvalid and indisready) then
    return;
  end if;
  if to_regclass('public.applicant_search_unknown_location_hnsw') is not null then
    raise exception 'The unknown-location index exists but is invalid; repair the online build first';
  end if;
  if exists(select 1 from public.applicant_search_index limit 1) then
    raise exception 'Build the unknown-location index concurrently using the operations script first';
  end if;
  create index applicant_search_unknown_location_hnsw
    on public.applicant_search_index using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
    where is_current and embedding is not null and attributes->>'location' is null;
end;
$$;


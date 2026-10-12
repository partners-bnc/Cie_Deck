-- Build online first on populated deployments; never build a blocking index there.
do $$
begin
  if exists(select 1 from pg_index where indexrelid=to_regclass('public.applicant_search_gurgaon_hnsw') and indisvalid and indisready) then return; end if;
  if to_regclass('public.applicant_search_gurgaon_hnsw') is not null then
    raise exception 'Gurgaon index exists but is invalid; repair the online build first';
  end if;
  if exists(select 1 from public.applicant_search_index limit 1) then
    raise exception 'Run operations/build_matching_gurgaon_index.sql first';
  end if;
  create index applicant_search_gurgaon_hnsw on public.applicant_search_index
    using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
    where is_current and embedding is not null and lower(attributes->>'location')='gurgaon';
end;
$$;


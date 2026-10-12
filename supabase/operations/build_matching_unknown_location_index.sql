-- Run as one standalone statement outside a transaction. Check indisvalid before
-- applying the IF NOT EXISTS migration; an interrupted build can leave an invalid index.
create index concurrently if not exists applicant_search_unknown_location_hnsw
on public.applicant_search_index using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
where is_current and embedding is not null and attributes->>'location' is null;

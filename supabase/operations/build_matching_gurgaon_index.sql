-- Standalone online build; check indisvalid before applying the registration migration.
create index concurrently if not exists applicant_search_gurgaon_hnsw
on public.applicant_search_index using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
where is_current and embedding is not null and lower(attributes->>'location')='gurgaon';

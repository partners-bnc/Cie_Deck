-- Stage a compact, transactional search projection before switching retrieval.
-- Full vectors and source hashes remain in applicant_search_index.
create table matching_private.applicant_lexical (
  applicant_id uuid primary key references public.applicant_search_index(applicant_id) on delete cascade,
  keywords tsvector not null,
  max_years numeric,
  location text,
  notice_days integer
);
alter table matching_private.applicant_lexical alter column keywords set storage main;
alter table matching_private.applicant_lexical enable row level security;
revoke all on matching_private.applicant_lexical from public,anon,authenticated;
grant all on matching_private.applicant_lexical to service_role;
create index applicant_lexical_keywords on matching_private.applicant_lexical using gin(keywords);
create index applicant_lexical_location on matching_private.applicant_lexical(location);

create function matching_private.sync_lexical() returns trigger
language plpgsql security definer set search_path='' as $$
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
$$;
-- Applicant edits can originate in authenticated sessions. The private trigger
-- needs owner rights to invalidate the service-only projection atomically.
revoke all on function matching_private.sync_lexical() from public,anon,authenticated;
create trigger matching_sync_lexical after insert or update of keywords,attributes,is_current,embedding
  on public.applicant_search_index for each row execute function matching_private.sync_lexical();

create table matching_private.coverage_cache (
  singleton boolean primary key default true check(singleton),
  value jsonb not null,
  refreshed_at timestamptz not null
);
alter table matching_private.coverage_cache enable row level security;
revoke all on matching_private.coverage_cache from public,anon,authenticated;
grant all on matching_private.coverage_cache to service_role;

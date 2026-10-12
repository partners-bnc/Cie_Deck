-- Online ordered copy. Both projections are kept current until the brief switch.
create table matching_private.applicant_lexical_ordered (
  applicant_id uuid primary key references public.applicant_search_index(applicant_id) on delete cascade,
  keywords tsvector not null,max_years numeric,location text,notice_days integer
);
alter table matching_private.applicant_lexical_ordered alter column keywords set storage main;
alter table matching_private.applicant_lexical_ordered enable row level security;
revoke all on matching_private.applicant_lexical_ordered from public,anon,authenticated;
grant all on matching_private.applicant_lexical_ordered to service_role;
create index applicant_lexical_ordered_keywords on matching_private.applicant_lexical_ordered using gin(keywords);
create index applicant_lexical_ordered_location on matching_private.applicant_lexical_ordered(location,applicant_id);
create function matching_private.sync_ordered_lexical() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.is_current and new.embedding is not null then
    insert into matching_private.applicant_lexical_ordered(applicant_id,keywords,max_years,location,notice_days)
    values(new.applicant_id,new.keywords || ''::tsvector,(new.attributes#>>'{experience,max}')::numeric,
      lower(new.attributes->>'location'),(new.attributes->>'notice_days')::integer)
    on conflict(applicant_id) do update set keywords=excluded.keywords,max_years=excluded.max_years,
      location=excluded.location,notice_days=excluded.notice_days
    where (applicant_lexical_ordered.keywords,applicant_lexical_ordered.max_years,applicant_lexical_ordered.location,applicant_lexical_ordered.notice_days)
      is distinct from (excluded.keywords,excluded.max_years,excluded.location,excluded.notice_days);
  else
    delete from matching_private.applicant_lexical_ordered where applicant_id=new.applicant_id;
  end if;
  return new;
end;
$$;
revoke all on function matching_private.sync_ordered_lexical() from public,anon,authenticated;
create trigger matching_sync_ordered_lexical after insert or update of keywords,attributes,is_current,embedding
  on public.applicant_search_index for each row execute function matching_private.sync_ordered_lexical();


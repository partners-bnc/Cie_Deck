-- Dashboard aggregate tables and triggers for fast admin analytics.
-- Applied to production via Supabase MCP as migration: admin_dashboard_aggregates.

create table if not exists public.dashboard_hr_daily_stats (
  stat_date date not null,
  hr_name text not null,
  uploaded_count integer not null default 0,
  tagged_count integer not null default 0,
  calls_count integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  primary key (stat_date, hr_name)
);

create table if not exists public.dashboard_source_stats (
  source text primary key,
  candidate_count integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.dashboard_hr_source_daily_stats (
  stat_date date not null,
  hr_name text not null,
  source text not null,
  uploaded_count integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  primary key (stat_date, hr_name, source)
);

alter table public.dashboard_hr_daily_stats enable row level security;
alter table public.dashboard_source_stats enable row level security;
alter table public.dashboard_hr_source_daily_stats enable row level security;

drop policy if exists dashboard_hr_daily_stats_admin_read on public.dashboard_hr_daily_stats;
create policy dashboard_hr_daily_stats_admin_read
  on public.dashboard_hr_daily_stats
  for select
  to authenticated
  using (is_admin());

drop policy if exists dashboard_source_stats_admin_read on public.dashboard_source_stats;
create policy dashboard_source_stats_admin_read
  on public.dashboard_source_stats
  for select
  to authenticated
  using (is_admin());

drop policy if exists dashboard_hr_source_daily_stats_admin_read on public.dashboard_hr_source_daily_stats;
create policy dashboard_hr_source_daily_stats_admin_read
  on public.dashboard_hr_source_daily_stats
  for select
  to authenticated
  using (is_admin());

create or replace function public.dashboard_label(value text, fallback text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(btrim(value), ''), fallback);
$$;

create or replace function public.dashboard_bump_hr_daily(
  p_stat_date date,
  p_hr_name text,
  p_uploaded_delta integer default 0,
  p_tagged_delta integer default 0,
  p_calls_delta integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hr_name text := public.dashboard_label(p_hr_name, 'Portal / Unknown');
begin
  if p_stat_date is null then
    return;
  end if;

  insert into public.dashboard_hr_daily_stats as stats (
    stat_date,
    hr_name,
    uploaded_count,
    tagged_count,
    calls_count,
    updated_at
  ) values (
    p_stat_date,
    v_hr_name,
    greatest(p_uploaded_delta, 0),
    greatest(p_tagged_delta, 0),
    greatest(p_calls_delta, 0),
    now()
  )
  on conflict (stat_date, hr_name) do update set
    uploaded_count = greatest(stats.uploaded_count + p_uploaded_delta, 0),
    tagged_count = greatest(stats.tagged_count + p_tagged_delta, 0),
    calls_count = greatest(stats.calls_count + p_calls_delta, 0),
    updated_at = now();

  delete from public.dashboard_hr_daily_stats
  where stat_date = p_stat_date
    and hr_name = v_hr_name
    and uploaded_count = 0
    and tagged_count = 0
    and calls_count = 0;
end;
$$;

create or replace function public.dashboard_bump_source(
  p_source text,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := public.dashboard_label(p_source, 'Portal / Unknown');
begin
  insert into public.dashboard_source_stats as stats (
    source,
    candidate_count,
    updated_at
  ) values (
    v_source,
    greatest(p_delta, 0),
    now()
  )
  on conflict (source) do update set
    candidate_count = greatest(stats.candidate_count + p_delta, 0),
    updated_at = now();

  delete from public.dashboard_source_stats
  where source = v_source
    and candidate_count = 0;
end;
$$;

create or replace function public.refresh_dashboard_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.dashboard_hr_daily_stats;
  truncate table public.dashboard_source_stats;
  truncate table public.dashboard_hr_source_daily_stats;

  insert into public.dashboard_source_stats (source, candidate_count, updated_at)
  select public.dashboard_label(source, 'Portal / Unknown'),
         count(*)::integer,
         now()
  from public.applicants
  group by public.dashboard_label(source, 'Portal / Unknown');

  insert into public.dashboard_hr_source_daily_stats (stat_date, hr_name, source, uploaded_count, updated_at)
  select created_on::date as stat_date,
         public.dashboard_label(uploaded_by, 'Portal / Unknown') as hr_name,
         public.dashboard_label(source, 'Others') as source,
         count(*)::integer as uploaded_count,
         now()
  from public.applicants
  where created_on is not null
  group by created_on::date, public.dashboard_label(uploaded_by, 'Portal / Unknown'), public.dashboard_label(source, 'Others');

  insert into public.dashboard_hr_daily_stats (stat_date, hr_name, uploaded_count, tagged_count, calls_count, updated_at)
  with uploaded as (
    select created_on::date as stat_date,
           public.dashboard_label(uploaded_by, 'Portal / Unknown') as hr_name,
           count(*)::integer as uploaded_count,
           0::integer as tagged_count,
           0::integer as calls_count
    from public.applicants
    where created_on is not null
    group by created_on::date, public.dashboard_label(uploaded_by, 'Portal / Unknown')
  ),
  tagged as (
    select created_at::date as stat_date,
           public.dashboard_label(shortlisted_by, 'Portal / Unknown') as hr_name,
           0::integer as uploaded_count,
           count(*)::integer as tagged_count,
           0::integer as calls_count
    from public.tagged_candidates
    where created_at is not null
    group by created_at::date, public.dashboard_label(shortlisted_by, 'Portal / Unknown')
  ),
  calls as (
    select created_at::date as stat_date,
           public.dashboard_label(hr_name, 'Portal / Unknown') as hr_name,
           0::integer as uploaded_count,
           0::integer as tagged_count,
           count(*)::integer as calls_count
    from public.communication_logs
    where created_at is not null
    group by created_at::date, public.dashboard_label(hr_name, 'Portal / Unknown')
  )
  select stat_date,
         hr_name,
         sum(uploaded_count)::integer,
         sum(tagged_count)::integer,
         sum(calls_count)::integer,
         now()
  from (
    select * from uploaded
    union all
    select * from tagged
    union all
    select * from calls
  ) combined
  group by stat_date, hr_name;
end;
$$;

create or replace function public.dashboard_applicants_aggregate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dashboard_bump_source(new.source, 1);
    perform public.dashboard_bump_hr_daily(new.created_on::date, new.uploaded_by, 1, 0, 0);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.dashboard_bump_source(old.source, -1);
    perform public.dashboard_bump_hr_daily(old.created_on::date, old.uploaded_by, -1, 0, 0);
    return old;
  elsif tg_op = 'UPDATE' then
    if public.dashboard_label(old.source, 'Portal / Unknown') is distinct from public.dashboard_label(new.source, 'Portal / Unknown') then
      perform public.dashboard_bump_source(old.source, -1);
      perform public.dashboard_bump_source(new.source, 1);
    end if;

    if old.created_on::date is distinct from new.created_on::date
       or public.dashboard_label(old.uploaded_by, 'Portal / Unknown') is distinct from public.dashboard_label(new.uploaded_by, 'Portal / Unknown') then
      perform public.dashboard_bump_hr_daily(old.created_on::date, old.uploaded_by, -1, 0, 0);
      perform public.dashboard_bump_hr_daily(new.created_on::date, new.uploaded_by, 1, 0, 0);
    end if;

    return new;
  end if;

  return null;
end;
$$;

create or replace function public.dashboard_tagged_candidates_aggregate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dashboard_bump_hr_daily(new.created_at::date, new.shortlisted_by, 0, 1, 0);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.dashboard_bump_hr_daily(old.created_at::date, old.shortlisted_by, 0, -1, 0);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.created_at::date is distinct from new.created_at::date
       or public.dashboard_label(old.shortlisted_by, 'Portal / Unknown') is distinct from public.dashboard_label(new.shortlisted_by, 'Portal / Unknown') then
      perform public.dashboard_bump_hr_daily(old.created_at::date, old.shortlisted_by, 0, -1, 0);
      perform public.dashboard_bump_hr_daily(new.created_at::date, new.shortlisted_by, 0, 1, 0);
    end if;
    return new;
  end if;

  return null;
end;
$$;

create or replace function public.dashboard_communication_logs_aggregate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dashboard_bump_hr_daily(new.created_at::date, new.hr_name, 0, 0, 1);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.dashboard_bump_hr_daily(old.created_at::date, old.hr_name, 0, 0, -1);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.created_at::date is distinct from new.created_at::date
       or public.dashboard_label(old.hr_name, 'Portal / Unknown') is distinct from public.dashboard_label(new.hr_name, 'Portal / Unknown') then
      perform public.dashboard_bump_hr_daily(old.created_at::date, old.hr_name, 0, 0, -1);
      perform public.dashboard_bump_hr_daily(new.created_at::date, new.hr_name, 0, 0, 1);
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists dashboard_applicants_aggregate on public.applicants;
create trigger dashboard_applicants_aggregate
after insert or update of source, uploaded_by, created_on or delete on public.applicants
for each row execute function public.dashboard_applicants_aggregate_trigger();

drop trigger if exists dashboard_tagged_candidates_aggregate on public.tagged_candidates;
create trigger dashboard_tagged_candidates_aggregate
after insert or update of shortlisted_by, created_at or delete on public.tagged_candidates
for each row execute function public.dashboard_tagged_candidates_aggregate_trigger();

drop trigger if exists dashboard_communication_logs_aggregate on public.communication_logs;
create trigger dashboard_communication_logs_aggregate
after insert or update of hr_name, created_at or delete on public.communication_logs
for each row execute function public.dashboard_communication_logs_aggregate_trigger();

select public.refresh_dashboard_aggregates();

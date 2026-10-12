-- Additive only. Does not seed applicants, call providers, or schedule paid work.
create extension if not exists vector with schema extensions;
create schema if not exists matching_private;
revoke all on schema matching_private from public, anon, authenticated;
grant usage on schema matching_private to service_role;

-- Operational checkpoint; candidate content remains in the four public feature tables.
create table matching_private.reconciliation_cursor (
  singleton boolean primary key default true check(singleton),
  after_id uuid
);
insert into matching_private.reconciliation_cursor(singleton) values(true);
alter table matching_private.reconciliation_cursor enable row level security;
revoke all on matching_private.reconciliation_cursor from public,anon,authenticated;
grant all on matching_private.reconciliation_cursor to service_role;

create table public.applicant_search_index (
  applicant_id uuid primary key references public.applicants(id) on delete cascade,
  profile_text text not null,
  embedding extensions.vector(3072),
  keywords tsvector not null,
  attributes jsonb not null,
  source_hash text not null,
  embedding_hash text not null,
  model text not null check (model = 'text-embedding-3-large'),
  dimensions integer not null check (dimensions = 3072),
  format_version text not null check (format_version = 'applicant-v1'),
  is_current boolean not null default true,
  insufficient_data boolean not null default false,
  shortened boolean not null default false,
  completeness numeric not null check (completeness between 0 and 1),
  profile_tokens integer not null default 0,
  embedding_input_tokens_total bigint not null default 0,
  indexed_at timestamptz not null default now()
);
create index applicant_search_hnsw on public.applicant_search_index
  using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
  where is_current and embedding is not null;
create index applicant_search_keywords on public.applicant_search_index using gin(keywords) where is_current;

create table public.applicant_embedding_jobs (
  applicant_id uuid primary key references public.applicants(id) on delete cascade,
  source_hash text not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  pilot boolean not null default false,
  attempts integer not null default 0,
  next_retry_at timestamptz not null default now(),
  claim_token uuid,
  lease_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
create index applicant_embedding_pending on public.applicant_embedding_jobs(next_retry_at)
  where status in ('pending','processing');

create table public.job_match_runs (
  id uuid primary key default gen_random_uuid(),
  client_job_id uuid not null references public.client_jobs(id) on delete cascade,
  job_hash text not null,
  requirements jsonb,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  query_embedding extensions.vector(3072),
  config_version text not null default 'applicant-v1',
  embedding_model text not null default 'text-embedding-3-large',
  dimensions integer not null default 3072,
  groq_model text not null,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'extracting' check (status in ('extracting','draft','queued','running','completed','failed','stale')),
  phase text not null default 'requirements' check (phase in ('requirements','retrieval','assessment','complete')),
  claim_token uuid,
  lease_until timestamptz,
  next_retry_at timestamptz not null default now(),
  attempts integer not null default 0,
  coverage jsonb not null default '{}',
  is_stale boolean not null default false,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index job_match_runs_job on public.job_match_runs(client_job_id,created_at desc);
create index job_match_runs_pending on public.job_match_runs(next_retry_at) where status in ('extracting','queued','running');
create unique index job_match_runs_active on public.job_match_runs(client_job_id) where status in ('extracting','draft','queued','running');

create table public.job_match_results (
  run_id uuid not null references public.job_match_runs(id) on delete cascade,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  source_hash text not null,
  retrieval jsonb not null,
  assessment jsonb,
  score numeric,
  evidence_coverage numeric,
  suitable boolean,
  final_rank integer,
  stale boolean not null default false,
  primary key (run_id,applicant_id)
);
create index job_match_results_applicant on public.job_match_results(applicant_id);
create index job_match_results_rank on public.job_match_results(run_id,final_rank) where final_rank is not null;

alter table public.applicant_search_index enable row level security;
alter table public.applicant_embedding_jobs enable row level security;
alter table public.job_match_runs enable row level security;
alter table public.job_match_results enable row level security;
revoke all on public.applicant_search_index,public.applicant_embedding_jobs,public.job_match_runs,public.job_match_results from public,anon,authenticated;
grant all on public.applicant_search_index,public.applicant_embedding_jobs,public.job_match_runs,public.job_match_results to service_role;
-- Clients read only; authenticated writes are never granted.
grant select on public.job_match_runs,public.job_match_results to authenticated;
create policy matching_runs_admin_read on public.job_match_runs for select to authenticated using ((select public.is_admin()));
create policy matching_results_admin_read on public.job_match_results for select to authenticated using ((select public.is_admin()));

create function matching_private.applicant_content(a public.applicants) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('current_position',a.current_position,'skills',a.skills,
    'total_experience',a.total_experience,'relevant_experience',a.relevant_experience,
    'education',a.education,'certification',a.certification,'process_knowledge',a.process_knowledge,'cv_summary',a.cv_summary);
$$;
create function matching_private.applicant_hash(a public.applicants) returns text
language sql immutable set search_path = '' as $$
  select md5((matching_private.applicant_content(a) || jsonb_build_object(
    'current_location',a.current_location,'expected_pay',a.expected_pay,
    'notice_period',a.notice_period,'work_authorization',a.work_authorization,'version','applicant-v1'))::text);
$$;
create function matching_private.job_hash(j public.client_jobs) returns text
language sql immutable set search_path = '' as $$
  select md5(jsonb_build_object('title',j.job_title,'description',j.job_description,'experience',j.experience,
    'location',j.location,'state',j.state,'country',j.country,'pay_rate',j.pay_rate,
    'mode',j.job_mode,'type',j.job_type,'status',j.status)::text);
$$;
create function matching_private.enqueue_applicant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare source text;
begin
  source := matching_private.applicant_hash(new);
  if tg_op = 'UPDATE' and source = matching_private.applicant_hash(old) then return new; end if;
  insert into public.applicant_embedding_jobs(applicant_id,source_hash) values(new.id,source)
  on conflict(applicant_id) do update set source_hash=excluded.source_hash,status='pending',attempts=0,
    next_retry_at=now(),claim_token=null,lease_until=null,last_error=null,updated_at=now();
  update public.applicant_search_index set is_current=false where applicant_id=new.id;
  update public.job_match_results set stale=true where applicant_id=new.id;
  update public.job_match_runs set is_stale=true,updated_at=now()
    where id in (select run_id from public.job_match_results where applicant_id=new.id);
  return new;
end;
$$;
create trigger matching_applicant_change after insert or update of current_position,skills,total_experience,
  relevant_experience,education,certification,process_knowledge,cv_summary,current_location,expected_pay,notice_period,work_authorization
  on public.applicants for each row execute function matching_private.enqueue_applicant();

create function matching_private.invalidate_deleted_applicant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.job_match_runs set is_stale=true,updated_at=now()
    where id in (select run_id from public.job_match_results where applicant_id=old.id);
  return old;
end;
$$;
create trigger matching_applicant_delete before delete on public.applicants
  for each row execute function matching_private.invalidate_deleted_applicant();

create function matching_private.invalidate_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if matching_private.job_hash(new) <> matching_private.job_hash(old) then
    update public.job_match_runs set status='stale',is_stale=true,claim_token=null,lease_until=null,updated_at=now()
      where client_job_id=new.id;
  end if;
  return new;
end;
$$;
create trigger matching_job_change after update of job_title,job_description,experience,location,state,country,pay_rate,job_mode,job_type,status
  on public.client_jobs for each row execute function matching_private.invalidate_job();

create function public.matching_claim_embeddings(p_limit integer default 4,p_pilot_only boolean default false) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare result jsonb;
begin
  update applicant_embedding_jobs set status='failed',last_error='Retry limit exhausted',claim_token=null,lease_until=null
    where attempts>=6 and status in ('pending','processing') and (lease_until is null or lease_until<now());
  with selected as (
    select applicant_id from applicant_embedding_jobs where attempts<6 and next_retry_at<=now()
      and (not p_pilot_only or pilot)
      and (status='pending' or (status='processing' and lease_until<now()))
      order by next_retry_at,applicant_id for update skip locked limit greatest(1,least(p_limit,8))
  ), claimed as (
    update applicant_embedding_jobs q set status='processing',claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
      attempts=attempts+1,updated_at=now() from selected s where q.applicant_id=s.applicant_id returning q.*
  ) select coalesce(jsonb_agg(jsonb_build_object('applicant_id',q.applicant_id,'source_hash',q.source_hash,
    'claim_token',q.claim_token,'source',matching_private.applicant_content(a)||jsonb_build_object(
      'current_location',a.current_location,'expected_pay',a.expected_pay,'notice_period',a.notice_period,'work_authorization',a.work_authorization),
    'embedding_hash',md5(matching_private.applicant_content(a)::text),
    'existing_embedding',i.embedding::text,'existing_embedding_hash',i.embedding_hash)), '[]') into result
    from claimed q join applicants a on a.id=q.applicant_id left join applicant_search_index i on i.applicant_id=a.id;
  return result;
end;
$$;

create function public.matching_finish_embedding(p_applicant uuid,p_claim uuid,p_source_hash text,p_profile text,
  p_embedding extensions.vector(3072),p_embedding_hash text,p_attributes jsonb,p_shortened boolean,p_completeness numeric,
  p_tokens integer default 0,p_provider_tokens integer default 0)
returns boolean language plpgsql set search_path = public,extensions as $$
declare a public.applicants;
begin
  -- Lock source first, matching the update trigger lock order. Edits/deletes cannot interleave this commit.
  select * into a from applicants where id=p_applicant for share;
  if not found or matching_private.applicant_hash(a)<>p_source_hash then return false; end if;
  perform 1 from applicant_embedding_jobs where applicant_id=p_applicant and claim_token=p_claim
    and source_hash=p_source_hash and status='processing' and lease_until>now() for update;
  if not found then return false; end if;
  if (p_profile='' and p_embedding is not null) or (p_profile<>'' and p_embedding is null) then raise exception 'Invalid empty profile'; end if;
  insert into applicant_search_index(applicant_id,profile_text,embedding,keywords,attributes,source_hash,embedding_hash,
    model,dimensions,format_version,shortened,completeness,insufficient_data,profile_tokens,embedding_input_tokens_total)
  values(p_applicant,p_profile,p_embedding,to_tsvector('simple',regexp_replace(lower(p_profile),'c\+\+',' cpp ','g') || ' ' ||
    regexp_replace(lower(p_profile),'\.net',' dotnet ','g')),p_attributes,p_source_hash,p_embedding_hash,
    'text-embedding-3-large',3072,'applicant-v1',p_shortened,p_completeness,p_profile='',p_tokens,p_provider_tokens)
  on conflict(applicant_id) do update set profile_text=excluded.profile_text,embedding=excluded.embedding,keywords=excluded.keywords,
    attributes=excluded.attributes,source_hash=excluded.source_hash,embedding_hash=excluded.embedding_hash,is_current=true,
    shortened=excluded.shortened,completeness=excluded.completeness,insufficient_data=excluded.insufficient_data,
    profile_tokens=excluded.profile_tokens,embedding_input_tokens_total=applicant_search_index.embedding_input_tokens_total+excluded.embedding_input_tokens_total,indexed_at=now();
  update applicant_embedding_jobs set status='done',claim_token=null,lease_until=null,last_error=null,updated_at=now() where applicant_id=p_applicant;
  return true;
end;
$$;
create function public.matching_fail_embedding(p_applicant uuid,p_claim uuid,p_error text) returns void
language sql set search_path = public as $$
  update applicant_embedding_jobs set status=case when attempts>=6 then 'failed' else 'pending' end,
    next_retry_at=now()+make_interval(secs=>least(3600,15*power(2,attempts)::integer)),
    last_error=left(p_error,200),claim_token=null,lease_until=null,updated_at=now()
  where applicant_id=p_applicant and claim_token=p_claim;
$$;

-- Keyset checkpoint is returned to the caller; no source timestamps or applicant writes are needed.
create function public.matching_seed(p_after uuid default null,p_limit integer default 500,p_dry_run boolean default true) returns jsonb
language plpgsql set search_path = public as $$
declare a public.applicants; last_id uuid; scanned integer:=0; queued integer:=0;
begin
  for a in select * from applicants where p_after is null or id>p_after order by id limit greatest(1,least(p_limit,1000)) for share loop
    scanned:=scanned+1; last_id:=a.id;
    if not exists(select 1 from applicant_search_index where applicant_id=a.id and is_current
      and source_hash=matching_private.applicant_hash(a)) then
      queued:=queued+1;
      if not p_dry_run then
        insert into applicant_embedding_jobs(applicant_id,source_hash) values(a.id,matching_private.applicant_hash(a))
        on conflict(applicant_id) do update set source_hash=excluded.source_hash,status='pending',attempts=0,
          claim_token=null,lease_until=null,next_retry_at=now(),updated_at=now()
        where applicant_embedding_jobs.source_hash<>excluded.source_hash or applicant_embedding_jobs.status='done';
      end if;
    end if;
  end loop;
  return jsonb_build_object('scanned',scanned,'needs_indexing',queued,'next_cursor',last_id,'dry_run',p_dry_run);
end;
$$;
create function public.matching_coverage() returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('total',(select count(*) from applicants),
    'indexed',(select count(*) from applicant_search_index where is_current and embedding is not null),
    'insufficient',(select count(*) from applicant_search_index where is_current and insufficient_data),
    'pending',(select count(*) from applicant_embedding_jobs where status in ('pending','processing')),
    'failed',(select count(*) from applicant_embedding_jobs where status='failed'),
    'embedding_input_tokens',(select coalesce(sum(embedding_input_tokens_total),0) from applicant_search_index));
$$;

create function public.matching_reconcile(p_limit integer default 500) returns jsonb
language plpgsql set search_path = public as $$
declare cursor_id uuid; result jsonb;
begin
  select after_id into cursor_id from matching_private.reconciliation_cursor where singleton for update;
  result:=matching_seed(cursor_id,p_limit,false);
  update matching_private.reconciliation_cursor set after_id=case when (result->>'scanned')::integer<least(greatest(p_limit,1),1000)
    then null else (result->>'next_cursor')::uuid end where singleton;
  return result;
end;
$$;

create function public.matching_pilot(p_dry_run boolean default true) returns jsonb
language plpgsql set search_path = public as $$
declare a public.applicants; scanned integer:=0;
begin
  -- Spread the pilot over experience categories and missing/populated professional fields.
  for a in select x.* from applicants x join (
    select id,row_number() over(partition by coalesce(nullif(total_experience,''),'unknown'),
      coalesce(skills,'')<>'',coalesce(cv_summary,'')<>'' order by md5(id::text)) slot from applicants
  ) sample using(id) order by sample.slot,md5(x.id::text) limit 500 for share of x loop
    scanned:=scanned+1;
    if not p_dry_run then
      insert into applicant_embedding_jobs(applicant_id,source_hash,pilot) values(a.id,matching_private.applicant_hash(a),true)
      on conflict(applicant_id) do update set pilot=true;
    end if;
  end loop;
  return jsonb_build_object('sampled',scanned,'dry_run',p_dry_run);
end;
$$;
create function public.matching_retry_failed(p_kind text) returns integer
language plpgsql set search_path = public as $$
declare amount integer;
begin
  if p_kind='embeddings' then
    update applicant_embedding_jobs set status='pending',attempts=0,next_retry_at=now(),last_error=null where status='failed';
  elsif p_kind='runs' then
    update job_match_runs set status=case when confirmed_at is null then 'extracting' else 'queued' end,
      attempts=0,next_retry_at=now(),last_error=null where id in (
        select distinct on (failed.client_job_id) failed.id from job_match_runs failed
        where failed.status='failed' and not failed.is_stale and not exists(
          select 1 from job_match_runs active where active.client_job_id=failed.client_job_id and active.status in ('extracting','draft','queued','running'))
        order by failed.client_job_id,failed.created_at desc
      );
  else raise exception 'Unknown retry kind'; end if;
  get diagnostics amount=row_count;
  return amount;
end;
$$;

create function public.matching_prepare(p_job uuid,p_requester uuid,p_model text,p_refresh boolean default false) returns public.job_match_runs
language plpgsql set search_path = public as $$
declare j public.client_jobs; r public.job_match_runs; h text;
begin
  select * into j from client_jobs where id=p_job for share;
  if not found then raise exception 'Job not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job::text,0));
  h:=matching_private.job_hash(j);
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and status in ('extracting','draft','queued','running') order by created_at desc limit 1;
  if found then return r; end if;
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and status='completed' and not is_stale order by created_at desc limit 1;
  if found and not p_refresh then return r; end if;
  update job_match_runs set status='stale',is_stale=true,claim_token=null,lease_until=null
    where client_job_id=p_job and status in ('extracting','draft','queued','running');
  -- A refresh of an unchanged job reuses its confirmed interpretation and query vector.
  select * into r from job_match_runs where client_job_id=p_job and job_hash=h and groq_model=p_model
    and confirmed_at is not null order by created_at desc limit 1;
  insert into job_match_runs(client_job_id,job_hash,groq_model,requested_by,status,phase,requirements,confirmed_at,confirmed_by,query_embedding)
    values(p_job,h,p_model,p_requester,case when r.confirmed_at is null then 'extracting' else 'queued' end,
      case when r.confirmed_at is null then 'requirements' else 'retrieval' end,r.requirements,r.confirmed_at,r.confirmed_by,r.query_embedding)
    returning * into r;
  return r;
end;
$$;
create function public.matching_confirm(p_run uuid,p_requirements jsonb,p_requester uuid) returns public.job_match_runs
language plpgsql set search_path = public as $$
declare r public.job_match_runs; j public.client_jobs;
begin
  select j0.* into j from client_jobs j0 join job_match_runs r0 on r0.client_job_id=j0.id where r0.id=p_run for share of j0;
  select * into r from job_match_runs where id=p_run for update;
  if r.id is null or r.job_hash<>matching_private.job_hash(j) or r.status not in ('draft','queued','running','completed') then raise exception 'Requirements need refreshing'; end if;
  if r.status<>'draft' then return r; end if;
  if jsonb_array_length(p_requirements->'conflicts')>0 then raise exception 'Resolve conflicts first'; end if;
  update job_match_runs set requirements=p_requirements,confirmed_at=now(),confirmed_by=p_requester,
    status='queued',phase='retrieval',attempts=0,last_error=null,updated_at=now() where id=p_run returning * into r;
  return r;
end;
$$;
create function public.matching_claim_run() returns public.job_match_runs
language plpgsql set search_path = public as $$
declare r public.job_match_runs;
begin
  update job_match_runs set status='failed',last_error='Retry limit exhausted',claim_token=null,lease_until=null
    where attempts>=6 and status in ('extracting','queued','running') and (lease_until is null or lease_until<now());
  select * into r from job_match_runs where status in ('extracting','queued','running') and attempts<6
    and next_retry_at<=now() and (lease_until is null or lease_until<now()) order by next_retry_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update job_match_runs set claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,
    status=case when status='queued' then 'running' else status end,updated_at=now() where id=r.id returning * into r;
  return r;
end;
$$;
create function public.matching_run_context(p_run uuid) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('job',jsonb_build_object('job_title',j.job_title,'job_description',j.job_description,
    'experience',j.experience,'location',j.location,'state',j.state,'country',j.country,'pay_rate',j.pay_rate,'job_mode',j.job_mode,'job_type',j.job_type),
    'current_job_hash',matching_private.job_hash(j)) from job_match_runs r join client_jobs j on j.id=r.client_job_id where r.id=p_run;
$$;
create function public.matching_save_requirements(p_run uuid,p_claim uuid,p_requirements jsonb) returns boolean
language plpgsql set search_path = public as $$
begin
  update job_match_runs set requirements=p_requirements,status='draft',phase='requirements',attempts=0,claim_token=null,
    lease_until=null,last_error=null,updated_at=now() where id=p_run and claim_token=p_claim and lease_until>now() and status='extracting';
  return found;
end;
$$;

create function matching_private.eligible(i public.applicant_search_index,p_min_years numeric,p_locations text[],p_max_notice_days integer)
returns boolean language sql immutable set search_path = '' as $$
  select (p_min_years is null or i.attributes#>>'{experience,max}' is null or (i.attributes#>>'{experience,max}')::numeric>=p_min_years)
    and (cardinality(p_locations)=0 or i.attributes->>'location' is null or lower(i.attributes->>'location')=any(p_locations))
    and (p_max_notice_days is null or i.attributes->>'notice_days' is null or (i.attributes->>'notice_days')::integer<=p_max_notice_days);
$$;
create function public.matching_semantic_pool(p_vector extensions.vector(3072),p_min_years numeric,p_exact boolean,p_locations text[],p_max_notice_days integer)
returns table(applicant_id uuid,embedding extensions.vector(3072)) language plpgsql set search_path = public,extensions as $$
begin
  if p_exact then
    return query select i.applicant_id,i.embedding from applicant_search_index i where i.is_current and i.embedding is not null
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days) order by i.embedding<=>p_vector limit 400;
  else
    return query select i.applicant_id,i.embedding from applicant_search_index i where i.is_current and i.embedding is not null
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days)
      order by i.embedding::halfvec(3072)<=>p_vector::halfvec(3072) limit 400;
  end if;
end;
$$;
create function public.matching_search(p_vector extensions.vector(3072),p_keywords text[],p_min_years numeric default null,p_exact boolean default false,
  p_locations text[] default '{}',p_max_notice_days integer default null,p_mode text default 'hybrid')
returns jsonb language plpgsql set search_path = public,extensions as $$
declare result jsonb; query tsquery; eligible_count integer;
begin
  if cardinality(p_keywords)=0 or cardinality(p_keywords)>30 then raise exception 'Invalid keywords'; end if;
  if p_mode not in ('hybrid','semantic','keyword') then raise exception 'Invalid retrieval mode'; end if;
  select string_agg('('||plainto_tsquery('simple',regexp_replace(regexp_replace(lower(term),'c\+\+',' cpp ','g'),'\.net',' dotnet ','g'))::text||')',' | ')::tsquery
    into query from unnest(p_keywords) term where numnode(plainto_tsquery('simple',term))>0 or term in ('C++','.NET');
  perform set_config('hnsw.iterative_scan','strict_order',true);
  perform set_config('hnsw.ef_search','100',true);
  select coalesce(array_agg(lower(trim(x))),'{}') into p_locations from unnest(p_locations) x;
  select count(*) into eligible_count from (select 1 from applicant_search_index i where i.is_current and i.embedding is not null
    and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days) limit 1001) eligible;
  if p_exact or eligible_count<=1000 then perform set_config('enable_indexscan','off',true); end if;
  with semantic_approx as materialized (
    select * from matching_semantic_pool(p_vector,p_min_years,p_exact or eligible_count<=1000,p_locations,p_max_notice_days)
  ), semantic as (
    select applicant_id,row_number() over(order by embedding<=>p_vector,applicant_id) as position,embedding<=>p_vector as distance
      from semantic_approx order by embedding<=>p_vector,applicant_id limit 200
  ), lexical as (
    select applicant_id,row_number() over(order by ts_rank_cd(keywords,query) desc,applicant_id) as position
      from applicant_search_index i where i.is_current and i.embedding is not null and keywords@@query
      and matching_private.eligible(i,p_min_years,p_locations,p_max_notice_days)
      order by ts_rank_cd(keywords,query) desc,applicant_id limit 200
  ), fused as (
    select coalesce(s.applicant_id,l.applicant_id) applicant_id,s.position semantic_rank,l.position keyword_rank,s.distance,
      coalesce(1.0/(60+s.position),0)+coalesce(1.0/(60+l.position),0) as rrf from semantic s full join lexical l using(applicant_id)
  ), pool as (
    select f.*,i.source_hash,case p_mode when 'semantic' then coalesce(1.0/(60+semantic_rank),0)
      when 'keyword' then coalesce(1.0/(60+keyword_rank),0) else rrf end retrieval_score
    from fused f join applicant_search_index i using(applicant_id)
    where p_mode='hybrid' or (p_mode='semantic' and semantic_rank is not null) or (p_mode='keyword' and keyword_rank is not null)
    order by retrieval_score desc,applicant_id limit 50
  ) select coalesce(jsonb_agg(to_jsonb(pool) order by retrieval_score desc,applicant_id),'[]') into result from pool;
  return result;
end;
$$;

create function public.matching_save_pool(p_run uuid,p_claim uuid,p_vector extensions.vector(3072),p_pool jsonb,p_coverage jsonb) returns boolean
language plpgsql set search_path = public,extensions as $$
begin
  perform 1 from applicants where id in (select (item->>'applicant_id')::uuid from jsonb_array_elements(p_pool) item) order by id for share;
  perform 1 from job_match_runs where id=p_run and claim_token=p_claim and lease_until>now() and phase='retrieval' and status='running' for update;
  if not found then return false; end if;
  insert into job_match_results(run_id,applicant_id,source_hash,retrieval)
    select p_run,(item->>'applicant_id')::uuid,item->>'source_hash',item from jsonb_array_elements(p_pool) item
    join applicants a on a.id=(item->>'applicant_id')::uuid
    where matching_private.applicant_hash(a)=item->>'source_hash' on conflict do nothing;
  update job_match_runs set query_embedding=p_vector,phase='assessment',coverage=p_coverage,updated_at=now(),attempts=0 where id=p_run;
  return true;
end;
$$;
create function public.matching_assessment_batch(p_run uuid,p_limit integer default 3) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select r.applicant_id,r.source_hash,matching_private.applicant_hash(a) current_source_hash,
      matching_private.applicant_content(a)||jsonb_build_object('current_location',a.current_location,'expected_pay',a.expected_pay,
        'notice_period',a.notice_period,'work_authorization',a.work_authorization) as source
    from job_match_results r join applicants a on a.id=r.applicant_id where run_id=p_run and assessment is null and not stale
    order by (retrieval->>'rrf')::numeric desc,applicant_id limit greatest(1,least(p_limit,3))
  ) x;
$$;
create function public.matching_save_assessment(p_run uuid,p_claim uuid,p_applicant uuid,p_source_hash text,p_assessment jsonb) returns boolean
language plpgsql set search_path = public as $$
declare a public.applicants;
begin
  select * into a from applicants where id=p_applicant for share;
  if not found then return false; end if;
  perform 1 from job_match_runs where id=p_run and claim_token=p_claim and lease_until>now() and status='running' for update;
  if not found then return false; end if;
  if matching_private.applicant_hash(a)<>p_source_hash then
    update job_match_results set stale=true where run_id=p_run and applicant_id=p_applicant;
    return false;
  end if;
  update job_match_results set assessment=p_assessment,score=(p_assessment->>'score')::numeric,
    evidence_coverage=(p_assessment->>'coverage')::numeric,suitable=(p_assessment->>'suitable')::boolean
    where run_id=p_run and applicant_id=p_applicant and source_hash=p_source_hash and not stale;
  return found;
end;
$$;
create function public.matching_release_run(p_run uuid,p_claim uuid,p_error text default null) returns void
language plpgsql set search_path = public as $$
declare r public.job_match_runs;
begin
  select * into r from job_match_runs where id=p_run and claim_token=p_claim and lease_until>now() for update;
  if not found then return; end if;
  if p_error is not null then
    update job_match_runs set status=case when attempts>=6 then 'failed' else status end,
      next_retry_at=now()+make_interval(secs=>least(3600,15*power(2,attempts)::integer)),last_error=left(p_error,200),
      claim_token=null,lease_until=null,updated_at=now() where id=p_run;
    return;
  end if;
  if r.phase='assessment' and not exists(select 1 from job_match_results where run_id=p_run and assessment is null and not stale) then
    with ranked as (select applicant_id,row_number() over(order by score desc,evidence_coverage desc,(retrieval->>'rrf')::numeric desc,applicant_id) as rank
      from job_match_results where run_id=p_run and suitable and not stale)
    update job_match_results x set final_rank=ranked.rank from ranked where x.run_id=p_run and x.applicant_id=ranked.applicant_id and ranked.rank<=20;
    update job_match_runs set status='completed',phase='complete',completed_at=now() where id=p_run;
  end if;
  update job_match_runs set claim_token=null,lease_until=null,attempts=0,last_error=null,next_retry_at=now(),updated_at=now() where id=p_run;
end;
$$;
-- Worker functions remain unavailable to browser/anonymous clients even with the project API key.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname like 'matching\_%' escape '\') or n.nspname='matching_private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

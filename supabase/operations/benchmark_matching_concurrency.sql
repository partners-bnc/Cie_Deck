-- Five bounded, one-shot database queries; saved vectors only, no providers.
-- Each job removes itself AFTER retrieval, including error/timeout paths.
-- Cron can mark a self-unscheduled job canceled after retrieval. Read the
-- matching_retrieval_benchmark_v3 LOG fields for actual SQL outcome and duration.
-- Verify that no jobs with this benchmark prefix remain after the one-shot test.
select cron.schedule('matching-retrieval-benchmark-20261010-v3-1','1 second',$job1$set statement_timeout='8s';
do $bench$
declare v extensions.vector; k text[]; years numeric; locations text[]; notice integer;
  pool jsonb; t timestamptz; elapsed numeric; code text; n integer; u integer;
begin
  if not exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-1') then return; end if;
  select query_embedding,array(select jsonb_array_elements_text(requirements->'keywords')),
    (requirements->>'min_total_years')::numeric,array(select jsonb_array_elements_text(requirements->'eligible_locations')),
    (requirements->>'max_notice_days')::integer into v,k,years,locations,notice
  from public.job_match_runs where id='eb8ee07a-e520-4d0e-9064-24eaa0b52358';
  t:=clock_timestamp();
  begin
    if v is null then raise exception 'Saved vector missing'; end if;
    pool:=public.matching_search(v,k,years,false,locations,notice,'hybrid');
    n:=jsonb_array_length(pool);
    select count(distinct x->>'applicant_id') into u from jsonb_array_elements(pool) x;
    if n<>50 or u<>50 then raise exception 'Unexpected benchmark candidate count'; end if;
  exception when query_canceled then code:='57014';
    when others then get stacked diagnostics code=returned_sqlstate;
  end;
  elapsed:=extract(epoch from clock_timestamp()-t)*1000;
  perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-1');
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',1,'backend_pid',pg_backend_pid(),
    'elapsed_ms',elapsed,'error_code',code,'count',n,'unique_count',u)::text;
exception when query_canceled or others then
  -- A timeout while cleaning up must not leave a repeating job.
  if exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-1') then perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-1'); end if;
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',1,'backend_pid',pg_backend_pid(),
    'elapsed_ms',extract(epoch from clock_timestamp()-t)*1000,'error_code','cleanup_error')::text;
end;
$bench$;$job1$);
select cron.schedule('matching-retrieval-benchmark-20261010-v3-2','1 second',$job2$set statement_timeout='8s';
do $bench$
declare v extensions.vector; k text[]; years numeric; locations text[]; notice integer;
  pool jsonb; t timestamptz; elapsed numeric; code text; n integer; u integer;
begin
  if not exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-2') then return; end if;
  select query_embedding,array(select jsonb_array_elements_text(requirements->'keywords')),
    (requirements->>'min_total_years')::numeric,array(select jsonb_array_elements_text(requirements->'eligible_locations')),
    (requirements->>'max_notice_days')::integer into v,k,years,locations,notice
  from public.job_match_runs where id='eb8ee07a-e520-4d0e-9064-24eaa0b52358';
  t:=clock_timestamp();
  begin
    if v is null then raise exception 'Saved vector missing'; end if;
    pool:=public.matching_search(v,k,years,false,locations,notice,'hybrid');
    n:=jsonb_array_length(pool);
    select count(distinct x->>'applicant_id') into u from jsonb_array_elements(pool) x;
    if n<>50 or u<>50 then raise exception 'Unexpected benchmark candidate count'; end if;
  exception when query_canceled then code:='57014';
    when others then get stacked diagnostics code=returned_sqlstate;
  end;
  elapsed:=extract(epoch from clock_timestamp()-t)*1000;
  perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-2');
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',2,'backend_pid',pg_backend_pid(),
    'elapsed_ms',elapsed,'error_code',code,'count',n,'unique_count',u)::text;
exception when query_canceled or others then
  -- A timeout while cleaning up must not leave a repeating job.
  if exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-2') then perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-2'); end if;
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',2,'backend_pid',pg_backend_pid(),
    'elapsed_ms',extract(epoch from clock_timestamp()-t)*1000,'error_code','cleanup_error')::text;
end;
$bench$;$job2$);
select cron.schedule('matching-retrieval-benchmark-20261010-v3-3','1 second',$job3$set statement_timeout='8s';
do $bench$
declare v extensions.vector; k text[]; years numeric; locations text[]; notice integer;
  pool jsonb; t timestamptz; elapsed numeric; code text; n integer; u integer;
begin
  if not exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-3') then return; end if;
  select query_embedding,array(select jsonb_array_elements_text(requirements->'keywords')),
    (requirements->>'min_total_years')::numeric,array(select jsonb_array_elements_text(requirements->'eligible_locations')),
    (requirements->>'max_notice_days')::integer into v,k,years,locations,notice
  from public.job_match_runs where id='eb8ee07a-e520-4d0e-9064-24eaa0b52358';
  t:=clock_timestamp();
  begin
    if v is null then raise exception 'Saved vector missing'; end if;
    pool:=public.matching_search(v,k,years,false,locations,notice,'hybrid');
    n:=jsonb_array_length(pool);
    select count(distinct x->>'applicant_id') into u from jsonb_array_elements(pool) x;
    if n<>50 or u<>50 then raise exception 'Unexpected benchmark candidate count'; end if;
  exception when query_canceled then code:='57014';
    when others then get stacked diagnostics code=returned_sqlstate;
  end;
  elapsed:=extract(epoch from clock_timestamp()-t)*1000;
  perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-3');
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',3,'backend_pid',pg_backend_pid(),
    'elapsed_ms',elapsed,'error_code',code,'count',n,'unique_count',u)::text;
exception when query_canceled or others then
  -- A timeout while cleaning up must not leave a repeating job.
  if exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-3') then perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-3'); end if;
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',3,'backend_pid',pg_backend_pid(),
    'elapsed_ms',extract(epoch from clock_timestamp()-t)*1000,'error_code','cleanup_error')::text;
end;
$bench$;$job3$);
select cron.schedule('matching-retrieval-benchmark-20261010-v3-4','1 second',$job4$set statement_timeout='8s';
do $bench$
declare v extensions.vector; k text[]; years numeric; locations text[]; notice integer;
  pool jsonb; t timestamptz; elapsed numeric; code text; n integer; u integer;
begin
  if not exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-4') then return; end if;
  select query_embedding,array(select jsonb_array_elements_text(requirements->'keywords')),
    (requirements->>'min_total_years')::numeric,array(select jsonb_array_elements_text(requirements->'eligible_locations')),
    (requirements->>'max_notice_days')::integer into v,k,years,locations,notice
  from public.job_match_runs where id='eb8ee07a-e520-4d0e-9064-24eaa0b52358';
  t:=clock_timestamp();
  begin
    if v is null then raise exception 'Saved vector missing'; end if;
    pool:=public.matching_search(v,k,years,false,locations,notice,'hybrid');
    n:=jsonb_array_length(pool);
    select count(distinct x->>'applicant_id') into u from jsonb_array_elements(pool) x;
    if n<>50 or u<>50 then raise exception 'Unexpected benchmark candidate count'; end if;
  exception when query_canceled then code:='57014';
    when others then get stacked diagnostics code=returned_sqlstate;
  end;
  elapsed:=extract(epoch from clock_timestamp()-t)*1000;
  perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-4');
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',4,'backend_pid',pg_backend_pid(),
    'elapsed_ms',elapsed,'error_code',code,'count',n,'unique_count',u)::text;
exception when query_canceled or others then
  -- A timeout while cleaning up must not leave a repeating job.
  if exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-4') then perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-4'); end if;
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',4,'backend_pid',pg_backend_pid(),
    'elapsed_ms',extract(epoch from clock_timestamp()-t)*1000,'error_code','cleanup_error')::text;
end;
$bench$;$job4$);
select cron.schedule('matching-retrieval-benchmark-20261010-v3-5','1 second',$job5$set statement_timeout='8s';
do $bench$
declare v extensions.vector; k text[]; years numeric; locations text[]; notice integer;
  pool jsonb; t timestamptz; elapsed numeric; code text; n integer; u integer;
begin
  if not exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-5') then return; end if;
  select query_embedding,array(select jsonb_array_elements_text(requirements->'keywords')),
    (requirements->>'min_total_years')::numeric,array(select jsonb_array_elements_text(requirements->'eligible_locations')),
    (requirements->>'max_notice_days')::integer into v,k,years,locations,notice
  from public.job_match_runs where id='eb8ee07a-e520-4d0e-9064-24eaa0b52358';
  t:=clock_timestamp();
  begin
    if v is null then raise exception 'Saved vector missing'; end if;
    pool:=public.matching_search(v,k,years,false,locations,notice,'hybrid');
    n:=jsonb_array_length(pool);
    select count(distinct x->>'applicant_id') into u from jsonb_array_elements(pool) x;
    if n<>50 or u<>50 then raise exception 'Unexpected benchmark candidate count'; end if;
  exception when query_canceled then code:='57014';
    when others then get stacked diagnostics code=returned_sqlstate;
  end;
  elapsed:=extract(epoch from clock_timestamp()-t)*1000;
  perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-5');
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',5,'backend_pid',pg_backend_pid(),
    'elapsed_ms',elapsed,'error_code',code,'count',n,'unique_count',u)::text;
exception when query_canceled or others then
  -- A timeout while cleaning up must not leave a repeating job.
  if exists(select 1 from cron.job where jobname='matching-retrieval-benchmark-20261010-v3-5') then perform cron.unschedule('matching-retrieval-benchmark-20261010-v3-5'); end if;
  raise log 'matching_retrieval_benchmark_v3 %',jsonb_build_object('slot',5,'backend_pid',pg_backend_pid(),
    'elapsed_ms',extract(epoch from clock_timestamp()-t)*1000,'error_code','cleanup_error')::text;
end;
$bench$;$job5$);


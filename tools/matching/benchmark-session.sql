-- Per-connection diagnostic helper; no persistent schema or provider calls.
set statement_timeout='20s'; set search_path=public,extensions;
create or replace function pg_temp.bench_one(p_run uuid,p_years numeric,p_locations text[],p_notice integer,p_mode text,p_keywords text[] default null) returns jsonb language plpgsql as $$
declare v vector; k text[]; t timestamptz; pool jsonb; elapsed numeric;
begin
select query_embedding,coalesce(p_keywords,array(select jsonb_array_elements_text(requirements->'keywords'))) into v,k from job_match_runs where id=p_run;
t:=clock_timestamp();
begin
pool:=matching_search(v,k,p_years,false,p_locations,p_notice,p_mode);
return jsonb_build_object('ms',extract(epoch from clock_timestamp()-t)*1000,'count',jsonb_array_length(pool),'unique_count',(select count(distinct x->>'applicant_id') from jsonb_array_elements(pool)x),'code',null);
exception when query_canceled then return jsonb_build_object('ms',extract(epoch from clock_timestamp()-t)*1000,'code','57014');
end;
end $$;
-- Reproduce the production worker role rather than privileged planner behavior.
set role service_role;



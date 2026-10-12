-- Per-connection helper; call repeatedly with the returned location/id cursor.
-- Stop after a batch smaller than 4,000. A null location with a non-null ID
-- means the final unknown-location group, not the beginning of the scan.
set statement_timeout='30s';
set work_mem='32MB';
create function pg_temp.backfill_ordered_lexical(p_location text default null,p_after uuid default null)
returns jsonb language sql as $$
  with batch as materialized (
    select l.* from matching_private.applicant_lexical l
    join public.applicant_search_index i using(applicant_id)
    where i.is_current and i.embedding is not null and
      (p_after is null or (p_location is null and l.location is null and l.applicant_id>p_after)
       or (p_location is not null and (l.location>p_location or l.location is null or
         (l.location=p_location and l.applicant_id>p_after))))
    order by l.location nulls last,l.applicant_id limit 4000 for key share of i
  ), inserted as (
    insert into matching_private.applicant_lexical_ordered(applicant_id,keywords,max_years,location,notice_days)
    select applicant_id,keywords,max_years,location,notice_days from batch
    order by location nulls last,applicant_id on conflict(applicant_id) do nothing returning 1
  ) select jsonb_build_object('inserted',(select count(*) from inserted),'scanned',(select count(*) from batch),
    'cursor',(select jsonb_build_object('id',applicant_id,'location',location) from batch
       order by location desc nulls first,applicant_id desc limit 1));
$$;
-- select pg_temp.backfill_ordered_lexical();
-- select pg_temp.backfill_ordered_lexical(<returned location>,<returned id>);

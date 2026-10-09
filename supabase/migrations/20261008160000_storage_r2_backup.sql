create table if not exists public.backup_ledger (
  bucket_id text not null,
  name text not null,
  src_version text not null,
  size bigint,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  synced_at timestamptz,
  source_deleted_at timestamptz,
  primary key (bucket_id, name)
);

create index if not exists backup_ledger_queue_idx
  on public.backup_ledger (created_at, bucket_id, name)
  where status in ('pending', 'failed');
create index if not exists backup_ledger_synced_idx
  on public.backup_ledger (synced_at);

create table if not exists public.backup_cursor (
  id integer primary key default 1 check (id = 1),
  last_updated_at timestamptz not null default '-infinity',
  last_object_id uuid not null default '00000000-0000-0000-0000-000000000000'
);
insert into public.backup_cursor (id) values (1) on conflict (id) do nothing;

alter table public.backup_ledger enable row level security;
alter table public.backup_cursor enable row level security;
revoke all on public.backup_ledger, public.backup_cursor from public, anon, authenticated;
grant all on public.backup_ledger, public.backup_cursor to service_role;

create or replace function public.enqueue_storage_backup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  object_version text;
  object_size bigint;
begin
  object_version := coalesce(
    new.version,
    new.metadata ->> 'eTag',
    new.updated_at::text || ':' || coalesce(new.metadata ->> 'size', new.metadata ->> 'contentLength', '')
  );
  object_size := coalesce(
    nullif(new.metadata ->> 'size', '')::bigint,
    nullif(new.metadata ->> 'contentLength', '')::bigint
  );

  insert into public.backup_ledger as ledger (bucket_id, name, src_version, size, status)
  values (new.bucket_id, new.name, object_version, object_size, 'pending')
  on conflict (bucket_id, name) do update
    set src_version = excluded.src_version,
        size = excluded.size,
        attempts = case when ledger.src_version is distinct from excluded.src_version then 0 else ledger.attempts end,
        last_error = case when ledger.src_version is distinct from excluded.src_version then null else ledger.last_error end,
        claimed_at = case when ledger.src_version is distinct from excluded.src_version then null else ledger.claimed_at end,
        status = case when ledger.src_version is distinct from excluded.src_version then 'pending' else ledger.status end;
  return new;
end;
$$;

create or replace function public.mark_storage_backup_deleted()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.backup_ledger
     set source_deleted_at = now()
   where bucket_id = old.bucket_id and name = old.name;
  return old;
end;
$$;

drop trigger if exists storage_objects_enqueue_backup on storage.objects;
create trigger storage_objects_enqueue_backup
after insert or update on storage.objects
for each row execute function public.enqueue_storage_backup();

drop trigger if exists storage_objects_mark_backup_deleted on storage.objects;
create trigger storage_objects_mark_backup_deleted
after delete on storage.objects
for each row execute function public.mark_storage_backup_deleted();

create or replace function public.claim_backup_batch(batch_size integer default 20)
returns setof public.backup_ledger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if batch_size < 1 or batch_size > 100 then
    raise exception 'batch_size must be between 1 and 100';
  end if;

  update public.backup_ledger
     set status = 'pending', claimed_at = null
   where status = 'in_progress'
     and claimed_at < now() - interval '10 minutes';

  return query
  with candidates as (
    select bucket_id, name
      from public.backup_ledger
     where status in ('pending', 'failed') and attempts < 5
     order by created_at, bucket_id, name
     limit batch_size
     for update skip locked
  )
  update public.backup_ledger as ledger
     set status = 'in_progress', claimed_at = now(), attempts = ledger.attempts + 1
    from candidates
   where ledger.bucket_id = candidates.bucket_id and ledger.name = candidates.name
  returning ledger.*;
end;
$$;

create or replace function public.reconcile_storage_backup_batch(batch_size integer default 5000)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  cursor_row public.backup_cursor%rowtype;
  processed integer;
begin
  if batch_size < 1 or batch_size > 10000 then
    raise exception 'batch_size must be between 1 and 10000';
  end if;

  select * into cursor_row from public.backup_cursor where id = 1 for update;

  with source_batch as materialized (
    select o.id, o.bucket_id, o.name, o.version, o.updated_at, o.metadata
      from storage.objects o
     where (o.updated_at, o.id) > (cursor_row.last_updated_at, cursor_row.last_object_id)
     order by o.updated_at, o.id
     limit batch_size
  ), upserted as (
    insert into public.backup_ledger as ledger (bucket_id, name, src_version, size, status)
    select b.bucket_id,
           b.name,
           coalesce(b.version, b.metadata ->> 'eTag', b.updated_at::text || ':' || coalesce(b.metadata ->> 'size', b.metadata ->> 'contentLength', '')),
           coalesce(nullif(b.metadata ->> 'size', '')::bigint, nullif(b.metadata ->> 'contentLength', '')::bigint),
           'pending'
      from source_batch b
    on conflict (bucket_id, name) do update
      set src_version = excluded.src_version,
          size = excluded.size,
          attempts = case when ledger.src_version is distinct from excluded.src_version then 0 else ledger.attempts end,
          last_error = case when ledger.src_version is distinct from excluded.src_version then null else ledger.last_error end,
          claimed_at = case when ledger.src_version is distinct from excluded.src_version then null else ledger.claimed_at end,
          status = case when ledger.src_version is distinct from excluded.src_version then 'pending' else ledger.status end
    where ledger.src_version is distinct from excluded.src_version or ledger.size is distinct from excluded.size
    returning 1
  )
  select count(*)::integer into processed from source_batch;

  if processed < batch_size then
    update public.backup_cursor
       set last_updated_at = '-infinity',
           last_object_id = '00000000-0000-0000-0000-000000000000'
     where id = 1;
  else
    update public.backup_cursor c
       set last_updated_at = b.updated_at,
           last_object_id = b.id
      from (select updated_at, id from storage.objects
             where (updated_at, id) > (cursor_row.last_updated_at, cursor_row.last_object_id)
             order by updated_at, id limit 1 offset batch_size - 1) b
     where c.id = 1;
  end if;
  return processed;
end;
$$;

revoke all on function public.claim_backup_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_backup_batch(integer) to service_role;
revoke all on function public.reconcile_storage_backup_batch(integer) from public, anon, authenticated;
grant execute on function public.reconcile_storage_backup_batch(integer) to service_role;

create or replace function public.configure_storage_backup_cron()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, cron, net, vault
as $$
declare
  secret_value text;
  worker_job bigint;
  reconcile_job bigint;
  project_url constant text := 'https://bvvqyjqokvnttbgyjkrt.supabase.co';
begin
  select decrypted_secret into secret_value
    from vault.decrypted_secrets
   where name = 'backup_worker_jwt'
   limit 1;
  if secret_value is null then
    raise exception 'Create Vault secret backup_worker_jwt before enabling storage backup schedules';
  end if;

  select jobid into worker_job from cron.job where jobname = 'storage-backup-worker';
  if worker_job is not null then perform cron.unschedule(worker_job); end if;
  select jobid into reconcile_job from cron.job where jobname = 'storage-backup-reconcile';
  if reconcile_job is not null then perform cron.unschedule(reconcile_job); end if;

  perform cron.schedule(
    'storage-backup-worker', '* * * * *',
    format($job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'backup_worker_jwt')),
        body := '{}'::jsonb
      )
    $job$, project_url || '/functions/v1/sync-worker')
  );
  perform cron.schedule(
    'storage-backup-reconcile', '* * * * *',
    'select public.reconcile_storage_backup_batch(5000)'
  );
end;
$$;
revoke all on function public.configure_storage_backup_cron() from public, anon, authenticated;
grant execute on function public.configure_storage_backup_cron() to postgres, service_role;

comment on table public.backup_ledger is 'Durable queue and status ledger for Supabase Storage to Cloudflare R2 backups.';
comment on table public.backup_cursor is 'Keyset cursor for periodic reconciliation of storage.objects into backup_ledger.';

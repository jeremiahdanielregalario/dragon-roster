-- Run once in a NEW Supabase project's SQL Editor.
create table public.dragon_collection (
  user_id uuid not null references auth.users(id) on delete cascade,
  dragon_id integer not null check (dragon_id > 0),
  status text not null check (status in ('owned','acquired','summon')),
  acquired_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, dragon_id)
);
alter table public.dragon_collection enable row level security;
revoke all on public.dragon_collection from anon, authenticated;
grant select, insert, update, delete on public.dragon_collection to authenticated;
grant all on public.dragon_collection to service_role;
create policy own_collection_select on public.dragon_collection for select to authenticated using ((select auth.uid()) = user_id);
create policy own_collection_insert on public.dragon_collection for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_collection_update on public.dragon_collection for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_collection_delete on public.dragon_collection for delete to authenticated using ((select auth.uid()) = user_id);

create table public.ranking_snapshots (
  id bigint generated always as identity primary key,
  fetched_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload->'dragons') = 'array')
);
create table public.ranking_sync (
  id integer primary key check (id = 1),
  checked_at timestamptz, lease_until timestamptz, lease_token uuid, last_error text
);
insert into public.ranking_sync(id) values (1);
alter table public.ranking_snapshots enable row level security;
alter table public.ranking_sync enable row level security;
revoke all on public.ranking_snapshots, public.ranking_sync from anon, authenticated;
grant all on public.ranking_snapshots, public.ranking_sync to service_role;
grant usage, select on sequence public.ranking_snapshots_id_seq to service_role;

create function public.claim_ranking_sync(lease_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  update public.ranking_sync s set lease_until = now() + interval '90 seconds', lease_token = $1
  where s.id = 1 and (s.lease_until is null or s.lease_until < now())
    and (s.checked_at is null or s.checked_at < now() - interval '1 hour');
  get diagnostics claimed = row_count;
  return claimed = 1;
end; $$;

create function public.finish_ranking_sync(lease_token uuid, snapshot jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare prior jsonb; changed boolean;
begin
  perform 1 from public.ranking_sync s where s.id = 1 and s.lease_token = $1 and s.lease_until > now() for update;
  if not found then raise exception 'Refresh lease expired'; end if;
  if jsonb_typeof(snapshot->'dragons') <> 'array' or jsonb_array_length(snapshot->'dragons') < 1 then raise exception 'Empty snapshot'; end if;
  select payload->'dragons' into prior from public.ranking_snapshots order by id desc limit 1;
  changed := prior is distinct from snapshot->'dragons';
  if changed then
    insert into public.ranking_snapshots (fetched_at, payload) values ((snapshot->>'fetchedAt')::timestamptz, snapshot);
    -- Retain the 30 most recent changed snapshots, not duplicate daily data.
    delete from public.ranking_snapshots where id not in (select id from public.ranking_snapshots order by id desc limit 30);
  end if;
  update public.ranking_sync set checked_at = now(), lease_until = null, lease_token = null, last_error = null where id = 1;
  return changed;
end; $$;

create function public.fail_ranking_sync(lease_token uuid, message text) returns void
language sql security definer set search_path = '' as $$
  update public.ranking_sync s set lease_until = now() + interval '5 minutes', last_error = left(message, 500)
  where s.id = 1 and s.lease_token = $1;
$$;

create function public.dragon_rank_history(dragon_id integer)
returns table (fetched_at timestamptz, ranks jsonb)
language sql stable security definer set search_path = '' as $$
  select s.fetched_at, d->'ranks' from public.ranking_snapshots s,
  lateral jsonb_array_elements(s.payload->'dragons') d
  where (d->>'id')::integer = dragon_id order by s.id asc;
$$;
revoke all on function public.claim_ranking_sync(uuid), public.finish_ranking_sync(uuid,jsonb), public.fail_ranking_sync(uuid,text), public.dragon_rank_history(integer) from public, anon, authenticated;
grant execute on function public.claim_ranking_sync(uuid), public.finish_ranking_sync(uuid,jsonb), public.fail_ranking_sync(uuid,text), public.dragon_rank_history(integer) to service_role;

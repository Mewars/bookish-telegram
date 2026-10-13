-- Manual installation only. Additive: no auth/users/profile/identity/favorites changes.
begin;
create schema if not exists vk_bridge_private;
revoke all on schema vk_bridge_private from public, anon, authenticated;
create table vk_bridge_private.records (
  kind text not null check (kind in ('attempt','code','bearer')),
  digest text not null check (digest ~ '^[A-Za-z0-9_-]{43}$'),
  payload text not null check (length(payload) between 32 and 24000),
  expires_at timestamptz not null,
  primary key (kind,digest)
);
create index vk_bridge_records_expiry on vk_bridge_private.records(expires_at);
alter table vk_bridge_private.records enable row level security;
create table vk_bridge_private.rate_limits (
  scope text primary key check (scope in ('authorize','exchange')),
  minute timestamptz not null,
  requests bigint not null
);
alter table vk_bridge_private.rate_limits enable row level security;
revoke all on all tables in schema vk_bridge_private from public, anon, authenticated, service_role;

create function public.vk_bridge_record(op text, record_kind text, record_digest text, encrypted_payload text default null, ttl_seconds integer default 0)
returns text language plpgsql security definer set search_path = '' as $$
declare result text; max_ttl integer;
begin
  if record_digest is null or record_digest !~ '^[A-Za-z0-9_-]{43}$' or record_kind not in ('attempt','code','bearer') or record_kind is null then
    raise exception 'Invalid bridge record';
  end if;
  if op = 'put' then
    max_ttl := case record_kind when 'attempt' then 600 when 'code' then 120 else 60 end;
    if ttl_seconds < 1 or ttl_seconds > max_ttl then raise exception 'Invalid bridge expiry'; end if;
    -- Bounded opportunistic cleanup: no cron/paid external store required.
    delete from vk_bridge_private.records where (kind,digest) in (
      select kind,digest from vk_bridge_private.records where expires_at <= clock_timestamp() limit 500
    );
    insert into vk_bridge_private.records(kind,digest,payload,expires_at)
      values (record_kind,record_digest,encrypted_payload,clock_timestamp()+make_interval(secs=>ttl_seconds));
  elsif op = 'get' then
    select payload into result from vk_bridge_private.records where kind=record_kind and digest=record_digest and expires_at>clock_timestamp();
  elsif op = 'take' then
    -- DELETE RETURNING is atomic across Edge workers. At most one request wins.
    delete from vk_bridge_private.records where kind=record_kind and digest=record_digest and expires_at>clock_timestamp() returning payload into result;
  else raise exception 'Invalid bridge operation';
  end if;
  return result;
end;
$$;
create function public.vk_bridge_rate_limit(rate_scope text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare total bigint; limit_count integer;
begin
  if rate_scope is null or rate_scope not in ('authorize','exchange') then raise exception 'Invalid bridge rate scope'; end if;
  limit_count := case rate_scope when 'authorize' then 120 else 600 end;
  insert into vk_bridge_private.rate_limits as current_bucket(scope,minute,requests)
    values(rate_scope,date_trunc('minute',clock_timestamp()),1)
    on conflict(scope) do update set minute=excluded.minute,
      requests=case when current_bucket.minute=excluded.minute then current_bucket.requests+1 else 1 end
    returning requests into total;
  return total<=limit_count;
end;
$$;
revoke all on function public.vk_bridge_record(text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.vk_bridge_rate_limit(text) from public, anon, authenticated;
grant execute on function public.vk_bridge_record(text,text,text,text,integer) to service_role;
grant execute on function public.vk_bridge_rate_limit(text) to service_role;
commit;

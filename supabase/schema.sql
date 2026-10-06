-- Preparation only: review and run manually in a Supabase project in the next stage.
-- One auth.users UUID is the canonical Ryadom account, regardless of login provider.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  city text not null default 'Енисейск',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('telegram', 'vk', 'yandex', 'google', 'max')),
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (user_id, provider)
);
create table public.user_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create function public.touch_profile_updated_at() returns trigger language plpgsql
set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profile_updated_at before update on public.profiles
for each row execute function public.touch_profile_updated_at();
create function public.handle_new_user() returns trigger language plpgsql
security definer
set search_path = '' as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
revoke all on function public.touch_profile_updated_at() from PUBLIC;
revoke all on function public.handle_new_user() from PUBLIC;
alter table public.profiles enable row level security;
alter table public.user_identities enable row level security;
alter table public.user_favorites enable row level security;
revoke all on public.profiles, public.user_identities, public.user_favorites from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.user_identities to authenticated;
grant update (display_name, avatar_url, city) on public.profiles to authenticated;
grant select, insert, delete on public.user_favorites to authenticated;
create policy profile_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profile_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy identity_read_own on public.user_identities for select to authenticated using ((select auth.uid()) = user_id);
-- Profiles are created by the auth trigger; only the verified backend can link/unlink identities.
create policy favorites_read_own on public.user_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_add_own on public.user_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_remove_own on public.user_favorites for delete to authenticated using ((select auth.uid()) = user_id);
commit;

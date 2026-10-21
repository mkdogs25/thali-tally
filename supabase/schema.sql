-- Thali Tally: cloud sync schema for Supabase.
-- Run this once in your project: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Every table is locked to its owner with row-level security. Do not skip the policies at the bottom: the
-- app's anon key is public by design, and these policies are what stop one person reading another's rows.

-- Safe to run more than once.

create table if not exists public.food_log (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uid        text not null,
  date       text not null,
  meal       text not null,
  name       text not null,
  qty        text,
  kcal       double precision not null,
  protein    double precision not null,
  carbs      double precision not null default 0,
  fat        double precision not null default 0,
  source     text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted    boolean not null default false,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, uid)
);

create table if not exists public.recipes (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uid         text not null,
  name        text not null,
  servings    double precision not null,
  ingredients jsonb not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  server_ts   timestamptz not null default clock_timestamp(),
  primary key (user_id, uid)
);

create table if not exists public.weight_log (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       text not null,
  kg         double precision not null,
  source     text not null default 'manual',
  updated_at bigint not null,
  deleted    boolean not null default false,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, date)
);

-- Profile, plan, regular foods and workout plan.
create table if not exists public.settings (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at bigint not null,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, key)
);

-- The server stamps every change with its own clock. Devices pull "everything changed since my last sync" by
-- this stamp, so a phone with a wrong clock cannot make other phones miss its changes.
create or replace function public.set_server_ts() returns trigger
language plpgsql as $$
begin
  new.server_ts := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists food_log_server_ts on public.food_log;
create trigger food_log_server_ts before insert or update on public.food_log   for each row execute function public.set_server_ts();
drop trigger if exists recipes_server_ts on public.recipes;
create trigger recipes_server_ts before insert or update on public.recipes    for each row execute function public.set_server_ts();
drop trigger if exists weight_log_server_ts on public.weight_log;
create trigger weight_log_server_ts before insert or update on public.weight_log for each row execute function public.set_server_ts();
drop trigger if exists settings_server_ts on public.settings;
create trigger settings_server_ts before insert or update on public.settings   for each row execute function public.set_server_ts();

create index if not exists food_log_sync   on public.food_log   (user_id, server_ts);
create index if not exists recipes_sync    on public.recipes    (user_id, server_ts);
create index if not exists weight_log_sync on public.weight_log (user_id, server_ts);
create index if not exists settings_sync   on public.settings   (user_id, server_ts);

-- Row-level security: a signed-in user can read and write only rows whose user_id is their own.
alter table public.food_log   enable row level security;
alter table public.recipes    enable row level security;
alter table public.weight_log enable row level security;
alter table public.settings   enable row level security;

drop policy if exists "own rows" on public.food_log;
create policy "own rows" on public.food_log   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.recipes;
create policy "own rows" on public.recipes    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.weight_log;
create policy "own rows" on public.weight_log for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.settings;
create policy "own rows" on public.settings   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

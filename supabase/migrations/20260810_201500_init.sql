-- T2 — Phase-1 schema (plan v1.2 data model)
-- Tables: profiles, brew_logs, glossary_terms, events, follow_relationships
-- RLS on all tables; profile auto-creation on signup; account deletion RPC.

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row on signup (also covers OAuth and anonymous users).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── brew_logs ───────────────────────────────────────────────────────────────
create table public.brew_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  bean_id           uuid, -- soft link; FK added in P2 with the beans table
  bean_name         text,
  roaster           text,
  origin            text,
  brewed_at         timestamptz not null,
  method            text not null,
  grind_size        text,
  dose_g            numeric,
  water_g           numeric,
  -- Canonical formula (constants): dose × ratio = water.
  -- Zero-guard: dose = 0 (or null) ⇒ NULL ratio, never a division by zero.
  -- STORED generated column: client writes to `ratio` are rejected by Postgres.
  ratio             numeric generated always as (
                      case when dose_g > 0 then water_g / dose_g end
                    ) stored,
  brew_time_seconds integer,
  tasting_notes     text,
  rating            numeric(2,1), -- 1.0–5.0 in 0.5 steps (client-validated)
  created_at        timestamptz not null default now()
);

create index brew_logs_user_brewed_idx on public.brew_logs (user_id, brewed_at desc);
create index brew_logs_user_idx        on public.brew_logs (user_id);

-- ── glossary_terms ───────────────────────────────────────────────────────────
create table public.glossary_terms (
  id            uuid primary key default gen_random_uuid(),
  term          text not null,
  definition    text not null,
  category      text,
  related_terms text[] not null default '{}'
);
-- Seed lands in T7 (subset) / T10 (full 101-term dataset).

-- ── events (instrumentation, T6) ────────────────────────────────────────────
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  name       text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_user_created_idx on public.events (user_id, created_at);

-- ── follow_relationships (P3, schema locked now) ────────────────────────────
create table public.follow_relationships (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.brew_logs            enable row level security;
alter table public.glossary_terms       enable row level security;
alter table public.events               enable row level security;
alter table public.follow_relationships enable row level security;

-- profiles: owner-only
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- brew_logs: owner-only (user A can never see or touch user B's rows)
create policy "brew_logs_select_own" on public.brew_logs
  for select using (auth.uid() = user_id);
create policy "brew_logs_insert_own" on public.brew_logs
  for insert with check (auth.uid() = user_id);
create policy "brew_logs_update_own" on public.brew_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "brew_logs_delete_own" on public.brew_logs
  for delete using (auth.uid() = user_id);

-- glossary_terms: public read; no client write policies (service role only)
create policy "glossary_terms_select_public" on public.glossary_terms
  for select using (true);

-- events: owner insert/select only; deliberately no update/delete policies
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);
create policy "events_select_own" on public.events
  for select using (auth.uid() = user_id);

-- follow_relationships: owner-only for now; P3 refines with follow checks
create policy "follow_relations_select_own" on public.follow_relationships
  for select using (auth.uid() = follower_id);
create policy "follow_relations_insert_own" on public.follow_relationships
  for insert with check (auth.uid() = follower_id);
create policy "follow_relations_delete_own" on public.follow_relationships
  for delete using (auth.uid() = follower_id);

-- ── Account deletion (App Store requirement, T2 task 7) ─────────────────────
-- Security-definer RPC: deletes the auth user; profiles/brew_logs/events/
-- follow_relationships cascade via their FK on delete cascade. The client
-- calls this, then signs out. Re-signup with the same email starts clean.
create function public.delete_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

grant execute on function public.delete_account() to authenticated;

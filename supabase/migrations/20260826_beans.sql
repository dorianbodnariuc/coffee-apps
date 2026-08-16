-- T9 — Bean cellar (plan v2.0): beans table + brew_logs soft link + freshness.
-- RLS: owner-only, matching the brew_logs pattern from the init migration.

create table public.beans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  roaster    text,
  origin     text,
  roast_date date,
  created_at timestamptz not null default now()
);

create index beans_user_idx on public.beans (user_id);

-- Soft link: brew_logs.bean_id -> beans.id. Deleting a bean keeps the log
-- (bean_id -> NULL) and never mutates its free-text snapshot (D-001).
alter table public.brew_logs
  add constraint brew_logs_bean_id_fk
  foreign key (bean_id) references public.beans (id) on delete set null;

alter table public.beans enable row level security;

create policy "beans_select_own" on public.beans
  for select using (auth.uid() = user_id);
create policy "beans_insert_own" on public.beans
  for insert with check (auth.uid() = user_id);
create policy "beans_update_own" on public.beans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "beans_delete_own" on public.beans
  for delete using (auth.uid() = user_id);

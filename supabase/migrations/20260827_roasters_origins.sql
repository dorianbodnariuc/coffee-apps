-- T24 — Roaster & origin catalog (D-029..D-033): global tables + beans soft links.
-- RLS: public read; authenticated insert of name-only rows; update/delete via
-- service role only (no authenticated policy), so paid fields + subscription are
-- admin-set.

create table public.roasters (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  -- lower(trim(name)) — the dedup key. Generated so client/seed never diverge.
  normalized_name  text generated always as (lower(trim(name))) stored,
  country          text,
  city             text,
  -- Paid fields (D-030/D-031): present now, rendered only when subscribed.
  address          text,
  phone            text,
  website          text,
  bean_link        text,
  subscribed       boolean not null default false,
  subscribed_until timestamptz,
  created_at       timestamptz not null default now()
);

create index roasters_normalized_name_idx on public.roasters (normalized_name);
-- Dedup by normalized name + country (two same-named roasters in different
-- countries are distinct businesses).
create unique index roasters_dedup_key
  on public.roasters (normalized_name, coalesce(country, ''));

create table public.origins (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  country         text,
  region          text,
  created_at      timestamptz not null default now()
);

create unique index origins_dedup_key on public.origins (normalized_name);
create index origins_normalized_name_idx on public.origins (normalized_name);

-- beans: soft links to the global catalog. Snapshot text (roaster/origin)
-- stays untouched (D-001 pattern); deleting a catalog row nulls the link.
alter table public.beans
  add column roaster_id uuid references public.roasters (id) on delete set null,
  add column origin_id   uuid references public.origins  (id) on delete set null;

create index beans_roaster_id_idx on public.beans (roaster_id);
create index beans_origin_id_idx   on public.beans (origin_id);

alter table public.roasters enable row level security;
alter table public.origins  enable row level security;

-- Public read: a directory is discoverable, even signed out.
create policy "roasters_select_public" on public.roasters
  for select using (true);
create policy "origins_select_public" on public.origins
  for select using (true);

-- Authenticated users may insert NAME-ONLY rows (the "add new" flow); they
-- cannot set paid columns or subscription flags.
create policy "roasters_insert_name_only" on public.roasters
  for insert with check (
    auth.role() = 'authenticated'
    and subscribed = false
    and subscribed_until is null
    and address is null
    and phone is null
    and website is null
    and bean_link is null
  );

create policy "origins_insert_authenticated" on public.origins
  for insert with check (auth.role() = 'authenticated');

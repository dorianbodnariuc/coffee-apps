# T24 — Roaster & origin catalog (schema + seed + API)

Goal: shared, deduplicated roaster and origin catalogs the bean cellar (and,
later, a roaster directory) can reference — seeded with a curated set, with the
paid-roaster columns present in the schema but unused in the UI.

## Context
- T9 added `beans` with free-text `roaster`/`origin`. D-029 makes roasters and
  origins GLOBAL entities; `beans` gains nullable `roaster_id`/`origin_id` soft
  links while keeping the free-text snapshot (D-001 pattern).
- D-030/D-031: paid columns (address, phone, website, bean_link) +
  `subscribed`/`subscribed_until` exist now, render only when subscribed, and
  are toggled by admin/service role only — never by an app user.
- D-032: seed = ~100–150 origins (country + region) + ~50–100 famous roasters
  (name + country + city). No bean SKU catalog.
- RLS: public read; authenticated insert of name-only rows; update/delete via
  service role only.

## Task 1 — Migration (`supabase/migrations/20260816_roasters_origins.sql`)
- `roasters`: id uuid pk default gen_random_uuid(), name text not null,
  normalized_name text not null, country text, city text, address text,
  phone text, website text, bean_link text,
  subscribed boolean not null default false, subscribed_until timestamptz,
  created_at timestamptz not null default now().
  `unique (normalized_name, coalesce(country, ''))`; index on normalized_name.
- `origins`: id uuid pk default gen_random_uuid(), name text not null unique,
  country text, region text, created_at timestamptz not null default now().
- `beans`: add `roaster_id uuid references roasters(id) on delete set null`,
  `origin_id uuid references origins(id) on delete set null`.
- RLS on both new tables: `select` public (`using (true)`); `insert` for
  authenticated with `with check` that BARS the paid columns + subscribed
  (e.g. `subscribed = false and address is null and phone is null and
  website is null and bean_link is null`); no update/delete policy for
  authenticated (service role only).

## Task 2 — Seed data
`supabase/seed_catalog.sql` (idempotent, `on conflict do nothing`):
- ~120–150 origins: coffee-producing countries + well-known regions
  (Yirgacheffe, Harrar, Sidamo, Guji, Limmu; Huila, Nariño, Cauca, Antioquia;
  Nyeri, Kirinyaga, Murang'a; Antigua, Huehuetenango, Acatenango; Tarrazú;
  etc.) with country + region.
- ~50–100 famous specialty roasters (name + country + city), e.g. Blue Bottle,
  Intelligentsia, Stumptown, Counter Culture, Onyx, Verve, Heart, Tim
  Wendelboe, Square Mile, etc.
- A couple of demo roasters marked `subscribed = true` with filled paid fields
  (harmless now; exercises the gate later).

## Task 3 — API + hooks
- `src/types/catalog.ts`: `Roaster`, `Origin` types.
- `src/lib/catalog-api.ts`: `listOrigins()`, `listRoasters()`,
  `searchOrigins(q)`, `searchRoasters(q)`, `getOrCreateOrigin(name)`,
  `getOrCreateRoaster(name)` (insert name-only; return existing on dedup).
- `src/hooks/use-catalog.ts`: React Query hooks for the read paths; mutations
  for getOrCreate.

## Acceptance criteria
- Roasters/origins readable by anon and authenticated (public read).
- An authenticated insert that sets address/phone/website/bean_link or
  `subscribed` is rejected by RLS.
- Deleting a roaster/origin sets `beans.roaster_id`/`origin_id` to NULL and
  leaves the snapshot text untouched.
- Seed loads cleanly; `supabase db push --dry-run` clean.
- `getOrCreateRoaster("Blue Bottle", "US")` returns the same row across calls.

## Verification
`npm run typecheck && npm run lint && npx vitest run`;
`supabase db push --dry-run` then push; a live catalog integration test
(read + getOrCreate dedup).

## Out of scope
- Roaster directory UI + paid-field rendering (D-030/D-031, deferred).
- Bean-name SKU catalog (D-032 — none).

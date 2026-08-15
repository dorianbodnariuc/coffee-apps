# T9 — Bean cellar CRUD + freshness

Goal: a beans list (cellar) with roast-date freshness badges, a Cellar tab, and
a soft link from brew logs to cellar beans.

## Context
- `brew_logs.bean_id` already exists (nullable, `supabase/migrations/20260810_201500_init.sql`),
  no FK yet. Bean fields on a log are free-text snapshots; editing a bean never
  mutates history (D-001 era rule).
- `FRESHNESS_THRESHOLDS` already in `src/constants/index.ts` (green 0–14, amber
  15–30, red 31+ days since roast).
- RLS pattern: owner-only (see `brew_logs` policies in the init migration).
- Nav is currently 2 tabs (Log/History) — Cellar becomes the third.

## Task 1 — Migration (`supabase/migrations/20260826_beans.sql`)
```sql
create table public.beans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  roaster    text,
  origin     text,
  roast_date date,
  created_at timestamptz not null default now()
);
create index beans_user_idx on public.beans (user_id);
alter table public.brew_logs
  add constraint brew_logs_bean_id_fk foreign key (bean_id)
  references public.beans (id) on delete set null;
alter table public.beans enable row level security;
-- owner-only select/insert/update/delete policies (auth.uid() = user_id)
```

## Task 2 — API (`src/lib/beans-api.ts`) + hooks
React Query CRUD for beans; a `use-beans` hook. Deleting a bean must NOT alter
any brew log (FK `on delete set null`).

## Task 3 — Cellar tab + UI
- Add Cellar tab (third tab in `src/app/_layout.tsx`).
- Bean list with freshness badge (days since roast → green/amber/red via
  `FRESHNESS_THRESHOLDS`); add/edit/delete.
- `bean_id` picker in the brew-log form, wired to cellar beans (soft link).

## Acceptance criteria
- Freshness badge correct at boundary days (0/14/15/30/31).
- Deleting a bean leaves brew logs intact (bean_id → NULL).
- RLS: user B cannot read/modify user A's beans.
- Badge text/copy uses tokens (see T22), targets ≥44px.

## Verification
`npm run typecheck && npm run lint && npm test`; `supabase db push --dry-run` then
push; on-device: add bean → log with it → delete bean → log survives.

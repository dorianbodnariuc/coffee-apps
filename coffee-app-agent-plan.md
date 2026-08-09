# Coffee Brew & Tasting Log App — Build Plan v1.1

> v1.1 (2026-08-09): revised per Plan Critic + Product Advisor reviews. All applied
> amendments are in the changelog at the bottom. Open items needing your input are
> in §Open decisions. Supersedes v1.0.

## Product summary
A mobile-first app for logging coffee brews and tastings, with a contextual
glossary/reference layer. Core loop: log a brew → see stats/history → discover
glossary content tied to what you logged. Retention driver is the personal log,
not the reference content.

## Tech stack
- **Frontend:** React Native (Expo), TypeScript — single codebase for iOS/Android
- **Backend:** Supabase (Postgres + Auth) — no Storage until a feature consumes it
- **Server state:** React Query (+ Zustand for client-only state)
- **Analytics:** minimal `events` table in Supabase (default); PostHog is the
  optional upgrade — decision point, see Open decisions
- **Builds:** EAS Build (Expo); QA via Expo Go

## Locked decisions (from advisor reviews — veto any of these if you disagree)
- **Rating scale:** 1–5 with 0.5 steps (not 1–10)
- **Launch platforms:** iOS-first; Android = Expo Go smoke test only at launch
- **Auth wall:** softened — a user can log their first brew before creating an
  account; account creation is prompted at log #2 / first sync
- **Bean identity rule:** brew_logs stores a free-text snapshot of bean/roaster/
  origin at log time; `bean_id` is a nullable soft link that never mutates history
- **Ratio formula:** canonical `dose × ratio = water`, defined once in shared
  constants; `ratio` is a STORED generated column in Postgres, client is read-only
- **P1 tabs:** Log / History / Calculator (Cellar returns as a tab in Phase 2)

---

## Phase 1 — Core MVP (target: 5–7 weeks)

**Goal:** A user can log a brew, see their history, and calculate a brew ratio —
plus the minimum instrumentation that proves (or disproves) the retention thesis.

### Features
1. **Auth (soft wall):** email/password + Google (+ Apple on iOS) via Supabase
   Auth; anonymous-first flow allows the first brew log before signup, with
   conversion to a permanent account at log #2 (Supabase anonymous auth or
   local-first queue — implementation choice for T2)
2. **Brew log entry:** create/edit/delete with fields: date/time (auto-filled,
   editable), bean name/roaster/origin (free-text snapshot), brew method dropdown,
   grind size, dose (g), water (g/ml), ratio (auto, read-only), brew time (manual
   entry — no timer UI in P1), tasting notes (free text), rating (1–5, 0.5 steps)
3. **Brew ratio calculator:** standalone tool, offline, two-way
   (any two of dose/water/ratio → third), presets 1:15–1:17
4. **History view:** list, filter by method/rating/date, detail view, header
   summary (log count, average rating, current streak)
5. **Glossary stub:** `glossary_terms` table + ~15–20 seeded terms; tasting-notes
   chip matching (case-insensitive, word-boundary — "washed" ≠ "dishwasher");
   **no browse/search UI in P1**
6. **Instrumentation:** events `log_created`, `session_start`,
   `time_to_first_log`; activation metric = ≥3 logs in first 7 days. This is what
   the Phase 3 gate is measured against — without it the gate is unenforceable

### Data model (Postgres/Supabase)
```sql
-- Phase 1 (created in T2)
profiles (
  id uuid PK references auth.users(id) on delete cascade,
  display_name text, created_at timestamptz default now()
)  -- populated by trigger on auth.users insert; owner-only RLS

brew_logs (
  id uuid PK, user_id uuid not null references auth.users(id),
  bean_id uuid null,  -- soft link; never mutates history
  bean_name text, roaster text, origin text,  -- free-text snapshot
  brewed_at timestamptz, method text, grind_size text,
  dose_g numeric, water_g numeric,
  ratio numeric GENERATED ALWAYS AS
    (CASE WHEN dose_g > 0 THEN water_g / dose_g END) STORED,
  brew_time_seconds int, tasting_notes text, rating numeric(2,1),
  created_at timestamptz default now()
)
-- indexes: (user_id, brewed_at desc), (user_id)
-- RLS: owner-only select/insert/update/delete

glossary_terms (id, term, definition, category, related_terms text[])
-- RLS: public read; admin write

events (id, user_id null, name, properties jsonb, created_at)
-- RLS: insert by owner; select by owner; no update/delete

-- Defined now, created in their phase:
beans      (Phase 2)  -- id, user_id, name, roaster, origin, roast_date,
                      -- process_method, notes, created_at; index (user_id)
origins    (Phase 2)
follow_relationships (Phase 3, schema locked now)
  -- follower_id uuid, followed_id uuid, unique(follower_id, followed_id),
  -- owner-write / public-read RLS
```

### Agent tasks (in order)
1. Scaffold Expo project (TS), tooling (ESLint/Prettier/strict TS), tab nav
   (Log / History / Calculator), `src/constants/` with shared enums (method list,
   rating scale, ratio presets), `CONVENTIONS.md`
2. Supabase project, migrations setup (`supabase migrations`), schema above,
   auth (soft wall), RLS, session persistence (AsyncStorage)
3. Brew log create/edit/delete form with validation (ratio read-only)
4. History list + detail + filters + header summary
5. Standalone ratio calculator (offline, no DB write)
6. Instrumentation: events module + activation metric query
7. Glossary stub: seed ~15–20 terms + tasting-notes chip matching
8. QA pass: iOS full, Android smoke (Expo Go); empty/loading/error states

---

## Phase 2 — Cellar + Content layer (target: +3–4 weeks)

**Goal:** Add the bean cellar (deferred from P1) and the contextual glossary layer
without turning the app into a dictionary.

### Features
1. **Bean cellar CRUD** + freshness indicator (days since roast → green/amber/red
   thresholds, values in `src/constants/`) — new Cellar tab
2. **Glossary database:** full seed ~50–100 terms, ~30 origins (**content sourcing
   is human work** — agent scaffolds structure, human owns copy)
3. **Glossary browse/search screen** (client-side filter OK for MVP)
4. **Origin reference cards:** triggered on bean origin field
5. **Contextual linking refinement:** word-boundary matching already stubbed in P1;
   extend to origin field; defined no-match fallback

### Agent tasks
1. Beans table + cellar CRUD + freshness
2. Full glossary + origins seed (structure/fixtures; copy from human source)
3. Glossary browse/search UI + term detail
4. Origin reference cards
5. Phase 2 QA pass

---

## Phase 3 — Social & monetization (gated, +4–6 weeks)
**Gate (to confirm):** activation (≥3 logs in first 7 days) and D7 retention
thresholds met by Phase 1–2 data. Do not dispatch T14–T15 until the gate passes.

### Features
1. Public/private profile toggle, follow users, public feed
2. Freemium: free = 20 logs max + basic glossary; paid = unlimited logs, flavor
   trend charts, full glossary/origin database
3. RevenueCat for subscription billing (handles App Store/Play receipt validation)

### Agent tasks
1. `is_public` flag + RLS update; public profile view; follow/feed (schema ready)
2. RevenueCat integration + entitlements
3. Paywall screens + feature gating

---

## Open decisions (need your input)
1. **Persona:** home brewer vs espresso hobbyist — drives method list, field set,
   glossary content
2. **Gate numbers:** what retention/activation thresholds unlock Phase 3?
   (Product Advisor suggested e.g. D7 ≥ 20% or ≥3 logs/week)
3. **Distribution:** how do first users find the app (no social in P1)?
4. **Seed content ownership:** who writes the 50–100 glossary terms, and with what
   sourcing rights?
5. **Photo attachments?** Would justify Supabase Storage (currently cut from stack)
6. **Calculator UX:** separate tab (default) vs merged into Log screen with
   prefill from last brew
7. **Account/data deletion** (GDPR / App Store requirement): in Phase 1 scope?

---

## Changelog v1.1 (applied amendments)
Technical (Plan Critic):
- A1 users mirror table → `auth.users` + `profiles` (trigger-populated, RLS)
- A2 ratio = STORED generated column w/ zero-guard; canonical formula in constants;
  client read-only
- A3 bean identity snapshot rule (free text + soft FK, never mutates history)
- A4 indexes on brew_logs (user_id, brewed_at desc) and user-scoped queries
- A5 auth acceptance criteria: failure paths, AsyncStorage persistence, platform
  matrix (Apple iOS-only; Google/Apple deep-link redirect on Android)
- A6 every ticket now has 3–5 verifiable acceptance criteria (ticket doc)
- A7 shared enums hoisted to `src/constants/` (methods, freshness thresholds,
  ratio presets, rating)
- A8 Supabase Storage cut from stack until a feature consumes it (see open Q5)
- A9 word-boundary, case-insensitive term matching + no-match fallback (T7/T12)
- A10 migrations convention established in T2
- A11 follow_relationships schema locked now (T14)

Product (Product Advisor):
- P1 instrumentation + activation metric added to P1 (feature 6, task 6)
- P2 auth wall softened — first log before signup (feature 1)
- P3 bean cellar CRUD deferred P1 → P2 (was feature 5 / task 6)
- P4 glossary stub shipped in P1 (schema + 15–20 terms + chips; no browse UI)
- P5 rating locked to 1–5 with 0.5 steps
- P6 iOS-first launch, Android smoke test only
- P7 history header summary (count, avg rating, streak)
- P8 calculator-merge option left open (Q6) — tabs are 3 either way in P1

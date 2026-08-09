# Coffee Brew & Tasting Log App — Build Plan v1.2

> v1.2 (2026-08-09): persona + calculator placement resolved (Product Advisor),
> photo attachments + account deletion locked, distribution section added,
> glossary import path discovered (101-term dataset found in user's SEO archive).
> Supersedes v1.1.

## Product summary
A mobile-first app for logging coffee brews and tastings, with a contextual
glossary/reference layer. Core loop: log a brew → see stats/history → discover
glossary content tied to what you logged. Retention driver is the personal log,
not the reference content.

## Target persona (v1.2, Product Advisor)
**Primary — the curious home brewer:** someone who brews pour-over / French
press / AeroPress most days, wants consistency via ratio and grind, and is
actively learning specialty-coffee vocabulary.

Implications:
- Espresso stays a **method option only** — no espresso-metric fields (yield,
  TDS, extraction %, shot timers) in P1–P2. Adding them is gated on analytics
  showing an espresso-method log cluster.
- Espresso hobbyist is a defensible **Phase 3+ secondary segment only**, gated on
  activation data. No split focus in P1.
- The glossary/origins content is written for the curious brewer (our
  coffee-dictionary.com content already is).

## Tech stack
- **Frontend:** React Native (Expo), TypeScript — single codebase for iOS/Android
- **Backend:** Supabase (Postgres + Auth + Storage — Storage used by P2 photo
  attachments, see feature 7)
- **Server state:** React Query (+ Zustand for client-only state)
- **Analytics:** minimal `events` table in Supabase (default); PostHog optional upgrade
- **Builds:** EAS Build (Expo); QA via Expo Go

## Locked decisions (v1.2)
- **Persona:** curious home brewer (above)
- **Rating scale:** 1–5 with 0.5 steps
- **Launch platforms:** iOS-first; Android = Expo Go smoke test only at launch
- **Auth wall:** softened — first brew log before account creation; account
  prompted at log #2 / first sync
- **Bean identity rule:** brew_logs stores a free-text snapshot; `bean_id` is a
  nullable soft link that never mutates history
- **Ratio formula:** canonical `dose × ratio = water` in shared constants; `ratio`
  is a STORED generated column, client read-only
- **Calculator placement (v1.2):** merged into the Log screen as a collapsible
  section with prefill from the last brew; **no Calculator tab** — P1 tabs are
  Log / History (Cellar tab returns in P2)
- **Standalone calculator app (v1.2):** **later, not now** — gated on P1
  activation passing; if it ships: free + one-time unlock (no ads, no
  subscription), positioned as a funnel into the main app
- **Photo attachments (v1.2):** yes — P2 ticket (Storage bucket + RLS)
- **Account/data deletion (v1.2):** in P1 scope (App Store requirement)

---

## Phase 1 — Core MVP (target: 5–7 weeks)

**Goal:** A user can log a brew, see their history, and calculate a brew ratio —
plus the minimum instrumentation that proves (or disproves) the retention thesis.

### Features
1. **Auth (soft wall):** email/password + Google (+ Apple on iOS) via Supabase
   Auth; anonymous/local-first path so the first brew log happens pre-signup, with
   conversion to a permanent account at log #2. **Account deletion** included:
   delete auth user + cascade data, App Store-compliant flow.
2. **Brew log entry:** create/edit/delete with fields: date/time (auto-filled,
   editable), bean name/roaster/origin (free-text snapshot), brew method dropdown
   (incl. espresso — method only), grind size, dose (g), water (g/ml), ratio
   (auto, read-only), brew time (manual entry — no timer UI), tasting notes,
   rating (1–5, 0.5 steps). Includes the **ratio calculator as a collapsible
   section** in the form, prefilled from the last brew.
3. **History view:** list, filter by method/rating/date, detail view, header
   summary (log count, average rating, current streak).
4. **Glossary stub:** `glossary_terms` table + ~15–20 terms **seeded from the
   real dataset** (dictionary_terms_data.json subset, see Phase 2); tasting-notes
   chip matching (case-insensitive, word-boundary — "washed" ≠ "dishwasher");
   no browse/search UI in P1.
5. **Instrumentation:** events `log_created`, `session_start`,
   `time_to_first_log`; activation metric = ≥3 logs in first 7 days. Feeds the
   Phase 2/3 gates.

### Data model (Postgres/Supabase)
```sql
-- Phase 1 (created in T2)
profiles (id uuid PK references auth.users(id) on delete cascade,
          display_name text, created_at timestamptz default now())
brew_logs (id uuid PK, user_id uuid not null references auth.users(id)
             on delete cascade,
           bean_id uuid null, bean_name text, roaster text, origin text,
           brewed_at timestamptz, method text, grind_size text,
           dose_g numeric, water_g numeric,
           ratio numeric GENERATED ALWAYS AS
             (CASE WHEN dose_g > 0 THEN water_g / dose_g END) STORED,
           brew_time_seconds int, tasting_notes text, rating numeric(2,1),
           created_at timestamptz default now())
  -- indexes: (user_id, brewed_at desc), (user_id); RLS owner-only
glossary_terms (id, term, definition, category, related_terms text[])
  -- RLS: public read; admin write. Seed from dictionary_terms_data.json (101 terms)
events (id, user_id null, name, properties jsonb, created_at)
  -- RLS: insert/select owner; no update/delete

-- Defined now, created in their phase:
beans (Phase 2)         origins (Phase 2)
brew_photos (Phase 2)   -- id, brew_log_id FK (cascade), storage_path,
                        --   created_at; bucket `brew-photos` owner-only RLS
follow_relationships (Phase 3, schema locked) -- unique(follower_id, followed_id)
```

### Agent tasks (in order)
1. Scaffold Expo project (TS), tooling, tab nav (**Log / History**), shared
   enums in `src/constants/`, `CONVENTIONS.md`
2. Supabase: migrations, schema above, auth (soft wall) + **account deletion**,
   RLS, session persistence (AsyncStorage)
3. Brew log create/edit/delete form with validation (ratio read-only) +
   **collapsible calculator section with prefill**
4. History list + detail + filters + header summary
5. Ratio calculator module: pure functions + tests + UI component (integrated
   into the Log form by T3)
6. Instrumentation: events module + activation metric query
7. Glossary stub: seed subset from the real dataset + chip matching
8. QA pass: iOS full, Android smoke (Expo Go); empty/loading/error states

---

## Phase 2 — Cellar + Content + Photos (target: +3–4 weeks)

**Goal:** Bean cellar (deferred from P1), the full glossary layer, and brew-log
photos — without turning the app into a dictionary.

### Features
1. **Bean cellar CRUD** + freshness indicator (days since roast → green/amber/red,
   thresholds in `src/constants/`) — Cellar tab returns (3 tabs)
2. **Glossary import:** full dataset import (101 terms, 6 fields) from
   `dictionary_terms_data.json` via the `coffee-dictionary-import` ETL repo →
   seed SQL/JSON for `glossary_terms`. Licensing confirmed (see Open decisions).
   Field mapping: term→term, category→category, long_definition→definition,
   related_terms→related_terms[], short_definition dropped (or extra column if
   wanted later)
3. **Glossary browse/search screen** (client-side filter OK for MVP) + term detail
4. **Origin reference cards:** triggered on bean origin field
5. **Contextual linking refinement:** word-boundary matching already stubbed in
   P1; extend to origin field; defined no-match fallback
6. **Photo attachments:** 1–3 photos per brew log, Supabase Storage bucket
   `brew-photos` (owner-only RLS), camera-roll picker, thumbnails, photos
   cascade-deleted with the log

### Agent tasks
1. Beans table + cellar CRUD + freshness (new Cellar tab)
2. Glossary import ETL (in `coffee-dictionary-import` repo) → seed load
3. Glossary browse/search UI + term detail
4. Origin reference cards
5. Photo attachments (Storage bucket, RLS, UI, cascade delete)
6. Phase 2 QA pass

---

## Phase 3 — Social & monetization (gated, +4–6 weeks)
**Gate (defaults, adjustable — see Open decisions):** activation ≥25% of new
users log ≥3 brews in their first 7 days **and** D7 retention ≥20%. Measured
from the `events` table (T6). If the gate fails, P3 does not start; revisit with
advisors. Espresso secondary segment is gated the same way (analytics shows an
espresso-method log cluster).

### Features
1. Public/private profile toggle, follow users, public feed
2. Freemium: free = 20 logs max + basic glossary; paid = unlimited logs, flavor
   trend charts, full glossary/origin database (dictionary content licensed for
   paid tier — see Open decisions)
3. RevenueCat for subscription billing

### Agent tasks
1. `is_public` flag + RLS update; public profile view; follow/feed (schema ready)
2. RevenueCat integration + entitlements
3. Paywall screens + feature gating

---

## Distribution (v1.2 — proposals, pick a starting set)
1. **coffee-dictionary.com as the owned funnel (recommended start, free):** add a
   brew-ratio calculator widget/page on the site, cross-link the app ("log your
   brews"); the glossary import doubles as distribution. Owned media compounds.
2. **Community seeding (recommended start, cheap):** honest posts with real
   brew-log screenshots in r/pourover, r/coffee, r/espresso, Home-Barista.
3. **Creator collabs:** 5–10 coffee micro-influencers once the app is polished;
   early access + credit.
4. **App Store ASO:** "coffee brew ratio calculator" keyword is searchable with
   weak competition; optimize listing around the log loop.
5. **Product Hunt / launch lists:** one-shot spike — pairs with the standalone
   calculator funnel if/when it ships.

## Open decisions (remaining)
1. **Gate numbers** — confirm defaults (activation ≥25%, D7 retention ≥20%) or adjust
2. **Distribution** — which proposals to start with (recommended: 1 + 2)
3. **Glossary licensing** — are the 101 terms (and coffee-dictionary.com content)
   fully reusable in the app, including the paid tier?
4. **Glossary completeness** — is 101 terms the full set, or a larger live set later?
5. **Import repo** — create `~/coffee-dictionary-import` for the ETL?
6. **Photo limits** — count/size caps for attachments (default: 3 photos, 10 MB each)

---

## Changelog v1.2
- Persona locked: curious home brewer; espresso = method option, no espresso
  metrics P1–P2; espresso secondary segment gated (Product Advisor)
- Calculator merged into Log screen (collapsible, prefill); Calculator tab
  removed → P1 tabs Log/History (Product Advisor)
- Standalone calculator app: later, gated, free + one-time unlock (Product Advisor)
- Photo attachments: yes → P2 ticket; Supabase Storage back in stack
- Account/data deletion: in P1 scope (T2)
- Glossary import path discovered: `dictionary_terms_data.json` (101 terms, 6
  fields) in user's SEO archive; T7 stubs from a subset, T10 imports the full set
- Distribution section added (5 proposals; owned-site funnel recommended)
- Gate numbers defaulted: activation ≥25%, D7 retention ≥20% (adjustable)

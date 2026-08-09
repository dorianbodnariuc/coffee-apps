# Coffee Brew & Tasting Log App — Coding Agent Build Plan

## Product summary
A mobile-first app for logging coffee brews and tastings, with a contextual glossary/reference layer. Core loop: log a brew → see stats/history → discover glossary content tied to what you logged. Retention driver is the personal log, not the reference content.

## Tech stack recommendation
- **Frontend:** React Native (Expo) — single codebase for iOS/Android, fast iteration
- **Backend:** Supabase (Postgres + Auth + Storage) — avoids building custom auth/infra, generous free tier for MVP
- **State management:** Zustand or React Query for server state
- **Hosting:** Supabase cloud (backend), EAS Build (Expo) for app builds

---

## Phase 1 — Core MVP (target: 6–10 weeks)
**Goal:** A user can log a brew, see their history, and calculate a brew ratio. No social, no content library yet.

### Features
1. **Auth:** email/password + optional Google/Apple sign-in (Supabase Auth)
2. **Brew log entry:** create/edit/delete a log with fields:
   - Date/time (auto-filled, editable)
   - Bean name, roaster, origin (free text initially)
   - Brew method (dropdown: pour-over, espresso, French press, AeroPress, cold brew, other)
   - Grind size (text or slider)
   - Dose (g), water (g/ml), ratio (auto-calculated)
   - Brew time (optional timer or manual entry)
   - Tasting notes (free text)
   - Rating (1–5 or 1–10 scale)
3. **Brew ratio calculator:** standalone tool, dose ↔ water ↔ ratio, two-way calculation
4. **History view:** list of past logs, filterable by method/rating/date, tap into detail view
5. **Bean cellar:** simple list of beans owned, with roast date and a freshness indicator (days since roast)

### Data model (Postgres/Supabase)
```sql
users (id, email, created_at)

beans (
  id, user_id, name, roaster, origin,
  roast_date, process_method, notes, created_at
)

brew_logs (
  id, user_id, bean_id (nullable FK),
  brewed_at, method, grind_size,
  dose_g, water_g, ratio (generated),
  brew_time_seconds, tasting_notes,
  rating, created_at
)
```

### Agent tasks (in order)
1. Scaffold Expo project, set up navigation (tab nav: Log / History / Cellar / Calculator)
2. Set up Supabase project, auth flow, and schema above
3. Build brew log create/edit form with validation
4. Build history list + detail view with filters
5. Build standalone ratio calculator (works offline, no DB write required)
6. Build bean cellar CRUD + freshness display
7. Basic empty states, loading states, error handling
8. Manual QA pass on iOS + Android via Expo Go

---

## Phase 2 — Content layer (target: +3–4 weeks)
**Goal:** Add contextual glossary content without turning the app into a dictionary.

### Features
1. **Glossary database:** term, definition, category (process, origin, brew method, flavor)
2. **Contextual linking:** when a brew log references a term that exists in the glossary (e.g., "washed process"), show it as tappable/linked
3. **Origin reference cards:** short auto-surfaced facts when a user types a known origin (e.g., "Ethiopia") — flavor profile tendencies, typical processing

### Data model additions
```sql
glossary_terms (
  id, term, definition, category, related_terms[]
)

origins (
  id, country, region, typical_flavor_notes,
  typical_process, altitude_range, notes
)
```

### Agent tasks
1. Seed glossary + origins tables with initial content (~50–100 terms, ~30 origins) — content sourcing is manual/human work, not agent work
2. Build glossary search/browse screen
3. Build term-matching logic (simple string match against tasting_notes and origin fields is sufficient for MVP — no NLP needed yet)
4. Build origin reference card component, trigger on bean entry origin field

---

## Phase 3 — Social & monetization (target: +4–6 weeks, post-validation)
**Defer until Phase 1–2 have real user retention data.**

### Features
1. Public/private profile toggle
2. Follow other users, view their public logs
3. Freemium gating: free tier = 20 logs max + basic glossary; paid tier = unlimited logs, flavor trend charts, full glossary/origin database
4. Stripe or RevenueCat integration for subscription billing

### Agent tasks
1. Add `is_public` flag to brew_logs, build public profile view
2. Add follow relationship table + feed query
3. Integrate RevenueCat (recommended over raw Stripe for mobile subscriptions — handles App Store/Play Store receipt validation)
4. Build paywall screens and entitlement checks

---

## Open decisions before starting (need your input)
- Expo vs bare React Native (Expo recommended for MVP speed, revisit if you need native modules later)
- Whether Phase 1 ships with a barebones glossary stub or waits for Phase 2 fully
- Target platforms at launch: iOS only first, or both simultaneously

## Suggested agent prompt structure
When handing this to a coding agent, feed it one phase at a time, not the whole doc — start with "Implement Phase 1, Agent Tasks 1–3" and review before proceeding. This keeps output reviewable and avoids the agent making architecture decisions across phases before you've validated Phase 1.

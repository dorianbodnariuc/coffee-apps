# Coffee App — Ticket Partition & Subagent Delegation Plan v1.1

> Source of truth: `coffee-app-agent-plan.md` (v1.1). This is the execution layer:
> tickets → tasks → subagent briefs, context optimization, standing advisors.
> v1.1 changes: T6 (cellar) → P2, glossary stub added to P1, instrumentation
> ticket added, acceptance criteria on every ticket, enums hoisted to constants.

**Goal:** Make the plan executable by subagents — one ticket = one or more
`delegate_task` dispatches with a minimal, self-sufficient brief.

---

## 1. Delegation architecture

```
                    ┌─────────────────────────────┐
                    │  Plan Critic (technical)    │  .hermes/agents/plan-critic.md
                    │  Product Advisor (product)  │  .hermes/agents/product-advisor.md
                    └──────────────┬──────────────┘
                                   │ review at phase gates / plan revisions
                    ┌──────────────▼──────────────┐
                    │   Orchestrator (me)          │  cuts tickets, writes briefs,
                    │                              │  dispatches builders, merges reviews
                    └──────────────┬──────────────┘
                                   │ one fresh leaf subagent per ticket
                    ┌──────────────▼──────────────┐
                    │   Builder subagents          │  implement ticket tasks (TDD)
                    └──────────────┬──────────────┘
                                   │ two-stage review per ticket
                    ┌──────────────▼──────────────┐
                    │  Reviewer subagents          │  spec compliance → code quality
                    └─────────────────────────────┘
```

- **Builders:** leaf `delegate_task` calls, one per ticket, fresh context each time.
- **Reviewers:** after a ticket passes spec review (checked against its acceptance
  criteria), a second leaf subagent reviews code quality (security scan, patterns,
  tests). Only then is the ticket merged/committed.
- **Advisors:** standing roles, independent of the plan content — process roles, not
  feature roles. Invoked at plan revisions and phase gates. Definitions live in
  `.hermes/agents/` and are versioned with the repo.
- **Phase gates:** before dispatching Phase 2 (and before Phase 3), run both advisors
  against the current plan + ticket state. Phase 3 additionally requires the
  retention gate (§6) to pass.

## 2. Ticket index (v1.1)

| ID  | Ticket                                    | Phase | Depends on        | Est. dispatches | Parallel-safe |
|-----|-------------------------------------------|-------|-------------------|-----------------|---------------|
| T1  | Scaffold, tooling, nav, constants         | 1     | —                 | 1–2             | —             |
| T2  | Supabase: schema, auth (soft wall), RLS   | 1     | T1                | 2–3             | —             |
| T3  | Brew log CRUD                             | 1     | T2                | 2–3             | —             |
| T4  | History list, detail, filters, summary    | 1     | T3                | 2               | —             |
| T5  | Ratio calculator                          | 1     | T1                | 1               | yes (w/ T6, T7)|
| T6  | Instrumentation + activation metric       | 1     | T1, T2            | 1               | yes (w/ T5, T7)|
| T7  | Glossary stub (schema, seed, chips)       | 1     | T2                | 1–2             | yes (w/ T5, T6)|
| T8  | Polish: states, QA pass, fixes            | 1     | T3–T7             | 2–3             | —             |
| T9  | Bean cellar CRUD + freshness              | 2     | T3 (patterns)     | 2               | —             |
| T10 | Full glossary + origins seed              | 2     | T7 (pattern)      | 1–2 (seed=human)| —             |
| T11 | Glossary browse/search UI                 | 2     | T10               | 2               | —             |
| T12 | Origin cards + matching refinement        | 2     | T11, T9           | 2               | —             |
| T13 | Phase 2 QA/polish                         | 2     | T9–T12            | 1               | —             |
| T14 | Public profiles & follow                  | 3     | T3 + GATE         | 2–3             | gated         |
| T15 | Freemium gating + RevenueCat              | 3     | T14               | 3               | gated         |

Phase 3 (T14–T15) is **gated**: do not dispatch until §6 retention thresholds pass.

## 3. Ticket breakdown (tasks + acceptance criteria + brief contents)

### T1 — Scaffold, tooling, navigation, constants
**Objective:** Bootable Expo app (TS) with 3-tab navigation and repo conventions.
**Tasks:**
1. `create-expo-app` (TypeScript template) in repo root.
2. ESLint + Prettier + strict TS; commit.
3. Tab nav (Log / History / Calculator) with stubs; Cellar tab added later in P2.
4. `src/constants/` — **single home for shared enums**: brew methods, rating scale
   (1–5, 0.5 steps), ratio presets (1:15–1:17), freshness thresholds (P2-ready).
5. `src/` structure: `screens/ components/ lib/ hooks/ constants/ types/`.
6. Write `CONVENTIONS.md` (stack, folder rules, naming, commit style).
**Acceptance criteria:**
- App boots in Expo Go on iOS and Android; all 3 tabs switch.
- `npm run lint` and `tsc --noEmit` pass clean.
- Every enum the app needs exists in `src/constants/` (no magic strings in later
  tickets).
- CONVENTIONS.md exists and is referenced by subsequent briefs.
**Brief contents:** tech-stack section (3 lines), tab list, enum list, acceptance
criteria. No schema.

### T2 — Supabase: schema, auth (soft wall), RLS, migrations
**Objective:** DB schema with migrations, RLS, and soft-wall auth (first log
before signup).
**Tasks:**
1. `supabase init` + link; `supabase migrations` convention established.
2. Phase-1 schema SQL (profiles, brew_logs with STORED ratio + zero-guard,
   glossary_terms, events, follow_relationships). Indexes included.
3. RLS on all tables (owner-only; glossary public-read).
4. Auth: email/password + Google (+ Apple on iOS); failure paths handled
   (duplicate email, wrong password, network down).
5. Session persistence via AsyncStorage adapter.
6. Soft wall: anonymous/local-first path so a brew log can be created pre-signup;
   conversion to account at log #2.
7. Platform matrix: Apple sign-in is iOS-only; Google/Apple deep-link redirect
   config for Android/Expo Go documented.
**Acceptance criteria:**
- `supabase db push` applies cleanly from scratch; migrations dir committed.
- `ratio` computed as `water/dose` with dose=0 → NULL, never an insert error;
  client write to `ratio` rejected.
- RLS verified: user A cannot read/write user B's rows (SQL tests pass).
- Anonymous user can create a brew log; converting to a real account preserves it.
- Auth failure states render correct errors; session survives app restart.
**Brief contents:** full Phase-1 SQL (inline), auth requirements, platform matrix,
acceptance criteria. Subagent reads CONVENTIONS.md.

### T3 — Brew log CRUD
**Objective:** Create/edit/delete brew logs with validation and bean snapshot rule.
**Tasks:**
1. Zod schemas for log fields; validation rules.
2. Create/edit form: all fields incl. date, method dropdown, grind, dose/water,
   ratio (read-only display), brew time (manual entry), tasting notes, rating.
3. Bean fields saved as free-text snapshot; `bean_id` picker only if a bean exists
   (P2) — soft link, never rewrites history.
4. Persist to Supabase (React Query); optimistic UI; delete with confirmation.
**Acceptance criteria:**
- dose 20 g + water 300 g ⇒ displayed ratio 15.0 (formula from `src/constants/`).
- dose = 0 or blank water ⇒ ratio blank/invalid, insert succeeds with NULL ratio.
- Editing a log's bean name never touches other logs; deleting a cellar bean (P2)
  leaves history intact.
- Validation blocks: negative dose/water, rating outside 1–5/0.5 steps, empty
  method.
**Brief contents:** brew_logs schema (inline), enum pointer to `src/constants/`,
snapshot rule, acceptance criteria.

### T4 — History list, detail, filters, summary
**Objective:** Filterable history with detail view and header summary.
**Tasks:**
1. History list query (React Query), sorted `brewed_at desc`.
2. Filters: method / rating / date range (client- or server-side, whichever is
   simpler at the time).
3. Detail screen; edit/delete entry points.
4. Header summary: log count, average rating, current streak.
**Acceptance criteria:**
- Method filter returns only rows with that method (verifiable with seeded data).
- Rating filter with 0.5-step values works; date-range filter inclusive.
- Header numbers match the filtered set (or are clearly labeled overall).
- Empty history shows empty state, not a blank screen.
**Brief contents:** brew_logs fields, filter requirements, summary spec, acceptance
criteria.

### T5 — Ratio calculator (standalone)
**Objective:** Offline two-way dose↔water↔ratio calculator, no DB.
**Tasks:**
1. Calculator screen: three linked inputs, any two → third.
2. Presets from `src/constants/` (1:15–1:17), unit handling g/ml.
3. Pure functions + unit tests (no UI needed for the logic).
**Acceptance criteria:**
- 20 g / 300 ml ⇒ ratio 15; 20 g / ratio 15 ⇒ water 300; 300 ml / ratio 15 ⇒ dose 20.
- Works with network off (no DB calls, no error states from backend).
- All tests pass in CI command (`npm test`).
**Brief contents:** formula constant location, preset list, offline requirement,
acceptance criteria. No schema, no backend.

### T6 — Instrumentation + activation metric
**Objective:** Events that feed the Phase 3 retention gate.
**Tasks:**
1. `events` table write path (already in T2 schema): insert helper `track(event,
   props)`.
2. Fire `session_start` (app foreground), `log_created` (T3 hook point),
   `time_to_first_log` (computed = first `log_created` − signup/first-use).
3. Activation query: users with ≥3 logs in first 7 days (SQL view or script).
**Acceptance criteria:**
- Creating a brew log inserts one `events` row (verified in DB).
- Session events fire once per foreground without spam.
- Activation metric query returns correct count against seeded fake data.
**Brief contents:** events schema (inline), event spec, activation definition,
acceptance criteria.

### T7 — Glossary stub (schema, seed, chips)
**Objective:** Prove the third leg of the core loop cheaply.
**Tasks:**
1. Seed ~15–20 glossary terms (curated — low volume, agent may author from common
   coffee knowledge; full human-sourced seed is T10).
2. Chip matching: case-insensitive, word-boundary match of tasting_notes against
   terms; matched terms render as tappable chips → glossary term detail (simple
   modal is fine in P1).
3. No-match fallback: silently no chips (defined behavior).
**Acceptance criteria:**
- "washed" does not match "dishwasher" (word-boundary test).
- "ETHIOPIA washed" matches terms case-insensitively.
- Tapping a chip shows the term definition; unknown notes show no chips, no errors.
**Brief contents:** glossary_terms schema (inline), matching rules (word-boundary,
case-insensitive), seed list, acceptance criteria.

### T8 — Polish, QA, fixes
**Objective:** Production-feel MVP, verified on device.
**Tasks:**
1. Empty/loading/error states across all screens.
2. iOS full QA pass via Expo Go (checklist); Android smoke test only.
3. Fix found issues; verify calculator offline behavior.
**Acceptance criteria:**
- QA checklist fully green on iOS; Android smoke green.
- No unhandled promise rejections or red-screen errors in QA session.
**Brief contents:** QA checklist, platform scope (iOS full / Android smoke),
known-flaky areas, acceptance criteria.

### T9 — Bean cellar CRUD + freshness *(moved from P1)*
**Objective:** Beans list with roast-date freshness; new Cellar tab.
**Tasks:**
1. beans table (T2 schema has it defined; create via migration) + CRUD reusing
   T3 patterns.
2. Cellar tab added to nav (4 tabs now).
3. Freshness: days since roast → green/amber/red via thresholds in
   `src/constants/`.
4. `bean_id` picker in T3 form wired to cellar beans (soft link).
**Acceptance criteria:**
- Freshness badge thresholds correct at boundary days (e.g., day 7 = amber start).
- Deleting a bean does not alter any brew log.
**Brief contents:** beans schema (inline), threshold constants, pointer to T3
patterns, acceptance criteria.

### T10 — Full glossary + origins seed
**Objective:** Content-layer data with human-owned copy.
**Tasks:**
1. origins table migration + RLS (public read).
2. Seed structure/fixtures for ~50–100 terms + ~30 origins.
3. **Copy sourcing is human work** — agent scaffolds files + placeholders; actual
   copy comes from the human/curated source (see Open decisions Q4).
**Acceptance criteria:**
- Seed files load cleanly (`supabase db reset` → counts match fixtures).
- Placeholder structure documented so a human can fill copy without code changes.
**Brief contents:** Phase-2 SQL (inline), content pipeline notes (agent vs human),
acceptance criteria.

### T11 — Glossary browse/search UI
**Objective:** Searchable glossary screen + term detail.
**Tasks:**
1. Glossary list + search (client-side filter OK for MVP).
2. Term detail view (definition, category, related terms).
**Acceptance criteria:**
- Search matches case-insensitively on term + definition.
- Related terms render as links; navigating back preserves search state.
**Brief contents:** glossary_terms fields, search requirements, acceptance criteria.

### T12 — Origin cards + matching refinement
**Objective:** Logs surface origin context automatically.
**Tasks:**
1. Origin reference card: trigger when bean origin matches origins table; show
   flavor notes + typical process.
2. Extend word-boundary matching to origin field; apply no-match fallback.
**Acceptance criteria:**
- Typing/saving a known origin (e.g., "Ethiopia") surfaces its card on the log.
- Unknown origin → no card, no error; word-boundary tests still pass.
**Brief contents:** origins schema (inline), trigger rules, matching rules pointer
(T7), acceptance criteria.

### T13 — Phase 2 QA/polish
**Objective:** Content layer + cellar verified end-to-end.
**Tasks:** states, edge cases (empty glossary, no matches, cellar with 0 beans),
device QA (iOS full, Android smoke).
**Acceptance criteria:** QA checklist green; no regressions in P1 flows.
**Brief contents:** regression checklist (P1 flows + new P2 flows), acceptance criteria.

### T14 — Public profiles & follow *(gated)*
**Objective:** Public/private toggle, follow, public feed.
**Tasks:** `is_public` flag + RLS update; follow queries (schema already in place
from T2); public profile view; feed query.
**Acceptance criteria:** private users invisible to non-followers; follow is
idempotent; feed shows only followed public logs.
**Brief contents:** follow_relationships schema (inline), RLS rules, acceptance criteria.

### T15 — Freemium + RevenueCat *(gated)*
**Objective:** Subscription gating.
**Tasks:** RevenueCat SDK + entitlements; paywall screens; feature gating (20-log
cap, pro-only charts/full glossary).
**Acceptance criteria:** free tier hard-stops at 20 logs; entitlement flip unlocks
pro features without reinstall.
**Brief contents:** gating rules, RevenueCat integration notes, acceptance criteria.

---

## 4. Context-optimization strategy (v1.1)

Rule: **a brief should contain everything the subagent needs and nothing it doesn't.**
The plan doc stays authoritative; briefs link, they don't duplicate.

1. **Per-ticket briefs, never whole-plan dumps.** Brief = objective + acceptance
   criteria + inline stable artifacts + file pointers.
2. **CONVENTIONS.md as the single shared context.** Every brief says "read
   CONVENTIONS.md first" — ~1 token, replaces repeating conventions everywhere.
3. **Point, don't paste, once the repo has shape.** After T1, briefs say "read
   `src/lib/supabase.ts`" instead of inlining patterns.
4. **Inline only what is small and stable:** schema SQL, formulas, thresholds,
   acceptance criteria. These are wrong when paraphrased — cheap to inline.
5. **Shared enums live in `src/constants/` — never re-inline them in briefs.**
   Briefs reference the file; this kills cross-ticket drift (v1.1 rule).
6. **Acceptance criteria are mandatory on every ticket** — they make the
   spec-compliance review stage enforceable, not vibes (v1.1 rule).
7. **Structured outputs via `output_schema`** — builders/reviewers return compact
   JSON (files changed, tests run, criteria met/not, blockers) instead of prose.
8. **Parallelize independent tickets** up to the 3-child concurrency limit:
   P1 wave after T2: T5 ∥ T6 ∥ T7; reviewers of different tickets can overlap.
9. **Fresh context per ticket.** No long-lived builder; dependencies flow through
   committed code, not through context.
10. **Seed/fixtures checked into the repo** so content tickets and QA have stable
    inputs and subagents never hallucinate data.
11. **Reviewer briefs get the diff, not the repo.**
12. **Advisors are the only wide-context consumers** — the plan is ~9 KB; everything
    else stays narrow.

## 5. Execution flow per ticket

1. Orchestrator writes ticket brief (per §3 template).
2. Dispatch builder (leaf) → runs tasks, commits locally.
3. Spec-compliance review (leaf): checked against the ticket's acceptance criteria.
   Any criterion unmet → back to builder.
4. Code-quality review (leaf): security scan, patterns, tests. Fail → back to builder.
5. Merge + mark ticket done in this document.
6. Phase gate: run both advisors before dispatching the next phase.

## 6. Phase 3 gate (measurable, per Product Advisor P1)

- Activation: ≥3 logs in first 7 days for new users.
- Retention: D7 ≥ 20% (or alternative thresholds — see Open decisions Q2).
- Gate check runs against the `events` table (T6) before T14 is dispatched.
- If the gate fails, P3 does not start; revisit with advisors.

## 7. Open decisions (carried from plan v1.1)

1. Persona (home brewer vs espresso hobbyist) — affects T1 enums + T10 seed.
2. Gate threshold numbers — affects §6.
3. Distribution plan for first users.
4. Seed content ownership + sourcing rights — affects T10.
5. Photo attachments (would justify Supabase Storage).
6. Calculator UX: separate tab (default) vs merged into Log with prefill — affects
   T1 nav + T5.
7. Account/data deletion scope — affects T2.

## 8. Changelog v1.1

- Tickets renumbered: cellar moved P1→P2 (T6→T9); glossary stub added (T7);
  instrumentation added (T6); acceptance criteria added to all tickets (A6);
  enums-hoisting rule added to §4 (A7); follow schema locked in T2 (A11);
  storage cut from stack (A8); iOS-first QA scope in T8/T13 (P6).

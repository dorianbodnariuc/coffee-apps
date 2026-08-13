# Coffee App — Ticket Partition & Subagent Delegation Plan v1.3

> Source of truth: `coffee-app-agent-plan.md` (v1.3). Execution layer: tickets →
> tasks → subagent briefs, context optimization, standing advisors.
> v1.3 changes: decision log added (`docs/decisions.md`, D-001…D-016); new
> account-gated dictionary tickets T17–T19; social Q&A ticket T20 (Phase 3).
> v1.2 changes: calculator merged into Log form (no tab), photo attachments
> ticket added (P2), account deletion in T2, glossary import via
> `coffee-dictionary-import` repo + discovered 101-term dataset, nav = 2 tabs in P1.

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
  criteria), a second leaf subagent reviews code quality. Only then is the ticket
  merged/committed.
- **Advisors:** standing roles, independent of the plan content. Invoked at plan
  revisions and phase gates. Definitions in `.hermes/agents/`, versioned with repo.
- **Phase gates:** run both advisors before dispatching Phase 2; Phase 3 requires
  the retention gate (§6) AND an advisor check.

## 2. Ticket index (v1.2)

| ID  | Ticket                                    | Phase | Depends on        | Est. dispatches | Parallel-safe |
|-----|-------------------------------------------|-------|-------------------|-----------------|---------------|
| T1  | Scaffold, tooling, nav (Log/History)      | 1     | —                 | 1–2             | —             |
| T2  | Supabase: schema, auth, RLS, deletion     | 1     | T1                | 2–3             | —             |
| T3  | Brew log CRUD + calculator section        | 1     | T2, T5 (module)   | 2–3             | —             |
| T4  | History list, detail, filters, summary    | 1     | T3                | 2               | —             |
| T5  | Ratio calculator module                   | 1     | T1                | 1               | yes (w/ T6, T7)|
| T6  | Instrumentation + activation metric       | 1     | T1, T2            | 1               | yes (w/ T5, T7)|
| T7  | Glossary stub (schema, seed, chips)       | 1     | T2                | 1–2             | yes (w/ T5, T6)|
| T8  | Polish: states, QA pass, fixes            | 1     | T3–T7             | 2–3             | —             |
| T9  | Bean cellar CRUD + freshness              | 2     | T3 (patterns)     | 2               | —             |
| T10 | Glossary import (101-term dataset, ETL)   | 2     | T7 (pattern)      | 1–2             | —             |
| T11 | Glossary browse/search UI                 | 2     | T10               | 2               | —             |
| T12 | Origin cards + matching refinement        | 2     | T11, T9           | 2               | —             |
| T13 | Photo attachments (Storage + RLS + UI)    | 2     | T3                | 2               | yes (w/ T9)    |
| T14 | Phase 2 QA/polish                         | 2     | T9–T13            | 1               | —             |
| T15 | Public profiles & follow                  | 3     | T3 + GATE         | 2–3             | gated         |
| T16 | Freemium gating + RevenueCat              | 3     | T15               | 3               | gated         |
| T17 | Saved terms (bookmarks)                   | 2     | T2, T10, T11      | 1–2             | —             |
| T18 | "Your terms" (brew-derived glossary)      | 2     | T17, T3           | 2               | —             |
| T19 | Personal notes on terms                   | 2     | T17 (pattern)     | 1               | yes (w/ T17)  |
| T20 | Social Q&A — "Ask a coffee question"      | 3     | T15 + GATE        | 2–3             | gated         |

Phase 3 (T15–T16) is **gated** on §6 numbers. P1 parallel wave after T2:
T5 ∥ T6 ∥ T7 (T3 integrates the T5 module).

## 3. Ticket breakdown (tasks + acceptance criteria + brief contents)

### T1 — Scaffold, tooling, navigation
**Objective:** Bootable Expo app (TS) with 2-tab navigation (Log / History).
**Tasks:**
1. `create-expo-app` (TypeScript template) in repo root.
2. ESLint + Prettier + strict TS; commit.
3. Tab nav: **Log / History** (no Calculator tab — it lives in the Log form).
4. `src/constants/` — shared enums: brew methods (incl. espresso), rating scale
   (1–5, 0.5 steps), ratio presets (1:15–1:17), freshness thresholds (P2-ready),
   photo caps (P2-ready).
5. `src/` structure: `screens/ components/ lib/ hooks/ constants/ types/`.
6. Write `CONVENTIONS.md` (stack, folder rules, naming, commit style).
**Acceptance criteria:**
- App boots in Expo Go on iOS and Android; Log + History tabs switch.
- `npm run lint` and `tsc --noEmit` pass clean.
- All shared enums exist in `src/constants/` (no magic strings later).
- CONVENTIONS.md exists; referenced by subsequent briefs.
**Brief contents:** tech stack (3 lines), tab list, enum list, acceptance criteria.

### T2 — Supabase: schema, auth (soft wall), RLS, deletion
**Objective:** DB schema with migrations, RLS, soft-wall auth, account deletion.
**Tasks:**
1. `supabase init` + link; `supabase migrations` convention established.
2. Phase-1 schema SQL (profiles, brew_logs w/ STORED ratio + zero-guard,
   glossary_terms, events, follow_relationships). Indexes included.
3. RLS on all tables (owner-only; glossary public-read).
4. Auth: email/password + Google (+ Apple on iOS); failure paths (duplicate
   email, wrong password, network down).
5. Session persistence via AsyncStorage adapter.
6. Soft wall: anonymous/local-first path; conversion to account at log #2.
7. **Account deletion:** delete auth user; FK cascade (profiles, brew_logs,
   events); App Store account-deletion flow.
8. Platform matrix documented: Apple sign-in iOS-only; Google/Apple deep-link
   redirect on Android/Expo Go.
**Acceptance criteria:**
- `supabase db push` applies cleanly from scratch; migrations dir committed.
- `ratio` = `water/dose` with dose=0 → NULL; client write to `ratio` rejected.
- RLS verified: user A cannot read/write user B's rows (SQL tests).
- Anonymous user can create a brew log; conversion preserves it.
- Auth failure states render correct errors; session survives app restart.
- Account deletion removes the user + all their rows; re-signup with same email
  starts clean.
**Brief contents:** full Phase-1 SQL (inline), auth requirements, deletion
requirements, platform matrix, acceptance criteria.

### T3 — Brew log CRUD + calculator section
**Objective:** Create/edit/delete brew logs with validation, bean snapshot rule,
and the integrated ratio calculator.
**Tasks:**
1. Zod schemas for log fields; validation rules.
2. Create/edit form: all fields incl. date, method dropdown, grind, dose/water,
   ratio (read-only), brew time (manual), tasting notes, rating.
3. **Calculator section:** collapsible in-form section using the T5 module,
   prefilled from the last brew's dose/water/ratio.
4. Bean fields as free-text snapshot; `bean_id` picker only when beans exist (P2).
5. Persist to Supabase (React Query); optimistic UI; delete with confirmation.
**Acceptance criteria:**
- dose 20 g + water 300 g ⇒ displayed ratio 15.0 (formula from constants).
- dose = 0 / blank water ⇒ ratio blank, insert succeeds with NULL ratio.
- Editing a log's bean name never touches other logs; deleting a cellar bean (P2)
  leaves history intact.
- Validation blocks: negative dose/water, rating outside 1–5/0.5 steps, empty method.
- Calculator section prefills from the last brew and writes results into the form.
**Brief contents:** brew_logs schema (inline), enum pointer, snapshot rule,
T5 module interface, acceptance criteria.

### T4 — History list, detail, filters, summary
**Objective:** Filterable history with detail view and header summary.
**Tasks:**
1. History list query (React Query), sorted `brewed_at desc`.
2. Filters: method / rating / date range.
3. Detail screen; edit/delete entry points.
4. Header summary: log count, average rating, current streak.
**Acceptance criteria:**
- Method filter returns only matching rows (seeded data).
- Rating filter with 0.5-step values works; date-range inclusive.
- Header numbers match the filtered set (or labeled overall).
- Empty history shows empty state.
**Brief contents:** brew_logs fields, filter requirements, summary spec, criteria.

### T5 — Ratio calculator module
**Objective:** Offline two-way dose↔water↔ratio logic + reusable component.
**Tasks:**
1. Pure functions: any two of dose/water/ratio → third (formula from constants).
2. Presets 1:15–1:17; unit handling g/ml.
3. Collapsible UI component (used by T3's form).
4. Unit tests for all logic.
**Acceptance criteria:**
- 20 g / 300 ml ⇒ 15; 20 g / 15 ⇒ 300 ml; 300 ml / 15 ⇒ 20 g.
- Works offline (no DB calls, no backend errors).
- All logic tests pass (`npm test`).
**Brief contents:** formula constant location, presets, component contract for T3,
acceptance criteria. No schema, no backend.

### T6 — Instrumentation + activation metric
**Objective:** Events feeding the Phase 2/3 gates.
**Tasks:**
1. Insert helper `track(event, props)` on the `events` table.
2. Fire `session_start` (foreground), `log_created` (T3 hook), `time_to_first_log`
   (computed: first `log_created` − first use).
3. Activation query: users with ≥3 logs in first 7 days (SQL view/script).
**Acceptance criteria:**
- Creating a brew log inserts one `events` row (verified in DB).
- Session events fire once per foreground without spam.
- Activation metric query returns correct counts against seeded fake data.
**Brief contents:** events schema (inline), event spec, activation definition
(≥25% of new users ≥3 logs/7 days), acceptance criteria.

### T7 — Glossary stub (schema, seed, chips)
**Objective:** Prove the third leg of the core loop cheaply.
**Tasks:**
1. Seed ~15–20 terms **from a subset of the real dataset**
   (`dictionary_terms_data.json`, copied into repo fixtures).
2. Chip matching: case-insensitive, word-boundary match of tasting_notes against
   terms; matched terms → tappable chips → simple term modal.
3. No-match fallback: silently no chips (defined behavior).
**Acceptance criteria:**
- "washed" does not match "dishwasher" (word-boundary test).
- "ETHIOPIA washed" matches case-insensitively.
- Tapping a chip shows the term definition; unknown notes show no chips/errors.
**Brief contents:** glossary_terms schema (inline), matching rules, fixture
subset file, acceptance criteria.

### T8 — Polish, QA, fixes
**Objective:** Production-feel MVP, verified on device.
**Tasks:**
1. Empty/loading/error states across all screens.
2. iOS full QA via Expo Go (checklist); Android smoke only.
3. Fix found issues; verify calculator offline behavior.
**Acceptance criteria:** QA checklist green on iOS; Android smoke green; no
unhandled rejections/red screens in QA session.
**Brief contents:** QA checklist, platform scope, known-flaky areas, criteria.

### T9 — Bean cellar CRUD + freshness
**Objective:** Beans list with roast-date freshness; Cellar tab (3 tabs now).
**Tasks:**
1. beans table migration + CRUD reusing T3 patterns.
2. Cellar tab added to nav.
3. Freshness: days since roast → green/amber/red via constants thresholds.
4. `bean_id` picker in T3 form wired to cellar beans (soft link).
**Acceptance criteria:**
- Freshness badge thresholds correct at boundary days.
- Deleting a bean does not alter any brew log.
**Brief contents:** beans schema (inline), thresholds, T3 pattern pointers, criteria.

### T10 — Glossary import (101-term dataset + ETL)
**Objective:** Load the full glossary from the real dataset.
**Tasks:**
1. ETL in the **`coffee-dictionary-import` repo** (separate repo): parse
   `dictionary_terms_data.json` → normalized seed SQL/JSON for `glossary_terms`.
2. Field mapping: term→term, category→category, long_definition→definition,
   related_terms→related_terms[] (short_definition dropped; note if we want it).
3. Load into Supabase (seed migration); verify counts (101) and RLS public read.
**Acceptance criteria:**
- Seed load produces exactly 101 rows; no NULL definitions.
- Categories round-trip intact; related_terms arrays populated.
- `supabase db reset` re-seeds cleanly.
**Brief contents:** JSON location + schema (inline sample), mapping table, ETL
repo path, licensing status note, acceptance criteria.

### T11 — Glossary browse/search UI
**Objective:** Searchable glossary screen + term detail.
**Tasks:**
1. Glossary list + search (client-side filter OK for MVP).
2. Term detail view (definition, category, related terms).
**Acceptance criteria:**
- Search matches case-insensitively on term + definition.
- Related terms render as links; back preserves search state.
**Brief contents:** glossary_terms fields, search requirements, criteria.

### T11b — Alias-aware search
**Objective:** Dictionary search that behaves like the original WordPress
coffee-dictionary.com search — slug aliases, compact spelling, related-term
cross-references.
**Tasks:**
1. Migrate `glossary_terms.slug` column from seed data.
2. Extend `searchGlossaryTerms()` to match across: compact term, slug (literal +
   compact), category, related terms.
**Acceptance criteria:**
- "pourover" finds "Pour Over" (compact match).
- "water temperature" finds "Coffee Brewing Temperature" (slug alias
  "water-temperature").
- "steamed milk" finds "Cappuccino" (related-term cross-reference).
- Existing term/definition substring match still works.
**Brief contents:** normalize.py slug column, glossary-api slug select,
glossary-search.ts multi-strategy filter, migration 20260816.

### T11c — Word-level matching + relevance scoring
**Objective:** Fix gaps where multi-word queries fail (e.g., "brew temperature"
does NOT match "Coffee Brewing Temperature" because the space in the query
breaks substring matching) and relevance is arbitrary.
**Tasks:**
1. Split multi-word queries into individual words; term passes when every word
   appears somewhere in term + definition (AND logic).
2. Prefix/stem match: a query word that starts a term word counts (so "brew"
   matches "brewing", "ferment" matches "fermentation").
3. Score each match by the kind of evidence (exact term > all-words >
   word-prefix > definition > compact > slug > category > related) and sort
   results by score descending. Tied scores preserve alphabetical order.
**Acceptance criteria:**
- "brew temperature" → "Coffee Brewing Temperature" (all-words AND match).
- "espresso golden" → "Crema" (words span term + definition).
- "brew" → "Coffee Brewing Temperature" (prefix match: brew ← brewing).
- Exact term hits rank above definition-only hits of the same query.
- Tiny words (≤1 char) are filtered out; "AA" (2-chars) still works.
**Brief contents:** glossary-search.ts scoring + word-prefix + AND logic,
MIN_WORD_LEN, test updates.

### T12 — Origin cards + matching refinement
**Objective:** Logs surface origin context automatically.
**Tasks:**
1. Origin reference card: bean origin match → card with flavor notes + typical
   process.
2. Extend word-boundary matching to origin field; no-match fallback.
**Acceptance criteria:**
- Known origin (e.g. "Ethiopia") surfaces its card on the log.
- Unknown origin → no card, no error; word-boundary tests still pass.
**Brief contents:** origins schema (inline), trigger rules, T7 matching rules,
acceptance criteria.

### T13 — Photo attachments *(new in v1.2)*
**Objective:** 1–3 photos per brew log via Supabase Storage.
**Tasks:**
1. Storage bucket `brew-photos` (private, owner-only RLS).
2. Camera-roll picker in the log form; upload with log save; thumbnails.
3. Photos cascade-deleted with the log; delete photo individually.
**Acceptance criteria:**
- Upload works in Expo Go (iOS + Android); photos appear on log detail.
- RLS verified: user B cannot read user A's photos.
- Deleting a log removes its photos from Storage (no orphans).
**Brief contents:** bucket/RLS spec, photo caps (default 3, 10 MB), T3 form
integration points, acceptance criteria.

### T14 — Phase 2 QA/polish
**Objective:** Cellar + content + photos verified end-to-end.
**Tasks:** states, edge cases (empty glossary, no matches, 0 beans, photo upload
failure), device QA (iOS full, Android smoke).
**Acceptance criteria:** QA checklist green; no regressions in P1 flows.
**Brief contents:** regression checklist, acceptance criteria.

### T15 — Public profiles & follow *(gated)*
**Objective:** Public/private toggle, follow, public feed.
**Tasks:** `is_public` flag + RLS; follow queries (schema from T2); public profile
view; feed query.
**Acceptance criteria:** private users invisible to non-followers; follow
idempotent; feed shows only followed public logs.
**Brief contents:** follow_relationships schema (inline), RLS rules, criteria.

### T16 — Freemium + RevenueCat *(gated)*
**Objective:** Subscription gating on app features only — no content paywall
(D-013, D-017).
**Tasks:** RevenueCat SDK + entitlements; paywall screens; feature gating (free =
20-log cap + basic charts; pro = unlimited logs, flavor-trend charts, unlimited
saved terms/notes).
**Acceptance criteria:** free tier hard-stops at 20 logs; entitlement flip
unlocks pro features without reinstall; no glossary/origin content is ever
paywalled (link-out only).
**Brief contents:** gating rules, RevenueCat notes, D-013/D-017 pointer, criteria.

### T17 — Saved terms (bookmarks)
**Objective:** Let signed-in users save glossary terms to a persistent "Saved"
list, and turn the save action into a sign-in trigger. (D-012, D-014)
**Tasks:**
1. Migration `saved_terms`:
   `user_id uuid refs auth.users on delete cascade` +
   `term_id uuid refs glossary_terms on delete cascade` +
   `created_at`, PK `(user_id, term_id)`. RLS owner-only (select/insert/delete).
2. `glossary-api.ts` additions: save/unsave/toggle + "is this term saved"
   (per-user only — no global saved_count, which would leak engagement data).
   React Query mutations invalidating a `saved_terms` key.
3. Term modal: save/unsave toggle (bookmark icon + label). Signed out → tapping
   it routes to `/auth` with a `returnTo` payload that restores the exact term
   modal after sign-in (no "re-tap" reliance; see acceptance criteria).
4. Dictionary: "Saved" filter chip (shown when signed in) filtering to saved
   terms; empty state ("No saved terms yet").
**Acceptance criteria:**
- Signed-in user can save/unsave; list persists across app restart.
- Signed-out user tapping save lands on `/auth`; after successful sign-in the
  user is returned to that term's modal (route + modal state restored via the
  `returnTo` contract) and the term is NOT auto-saved — they confirm with one
  tap. The return path is a defined navigation contract, not an assumption.
- User A cannot see or modify user B's saved terms (RLS SQL test).
- Unsaving removes the row; deleting a term or account cascades cleanly.
**Brief contents:** saved_terms schema (inline), RLS rules, modal + filter
integration points, sign-in-routing requirement, D-012/D-014 rationale, criteria.

### T18 — "Your terms" (brew-derived glossary)
**Objective:** A personal glossary derived from what the user actually brews, by
matching their brew-log text against the glossary — no hardcoded mappings
(D-019).
**Tasks:**
1. Derive candidate terms by running each brew log's text fields (method, grind,
   bean name/origin/roaster, tasting notes) through the existing word-boundary +
   scoring matcher (D-007/D-008). No `term_mappings` table or constants.
2. Aggregate: a term is included if it matches ≥1 log; rank by number of
   matching logs desc, ties alphabetical; cap the list (e.g. top 20).
3. Dictionary: a "Your terms" section/chip (signed in only) listing derived
   terms; empty state when the user has no logs or no matches.
4. Tap a derived term → term modal (reuse T11/T17 modal).
**Acceptance criteria:**
- A user who logged a V60 sees Pour Over / Extraction etc. in "Your terms".
  Deterministic: a unit test with synthetic logs asserts the exact output set.
- A user with zero logs sees the empty state (not an error).
- Ranking is deterministic (match count desc, ties alphabetical) and the list is
  capped.
- Signed-out users never see the section (not even a gated view).
**Brief contents:** glossary-search matcher interface (D-007/D-008), brew_logs
fields to match on, ranking + cap spec, deterministic test-fixture requirement,
D-019 rationale, criteria.

### T19 — Personal notes on a term
**Objective:** One private note per term per user ("what over-extraction tasted
like for me"). (D-012, D-014 — optional/last)
**Tasks:**
1. Migration `term_notes`: `user_id`, `term_id`, `note text`, `created_at`,
   `updated_at`, PK `(user_id, term_id)`; explicit `ON DELETE CASCADE` FKs on
   `user_id` → auth.users and `term_id` → glossary_terms. RLS owner-only.
2. Term modal: "Add a note" (signed in) → inline editor; shows existing note
   with edit affordance. Signed out → route to `/auth` (returnTo per T17).
3. React Query mutation + optimistic update with rollback on failure (D-010);
   length cap 500 chars with a visible error on overrun.
**Acceptance criteria:**
- Note persists across restart; edit updates `updated_at`.
- User A cannot read user B's notes (RLS SQL test).
- Deleting the user (T2) or a glossary term removes the note (no orphans).
- Signed-out tap routes to `/auth`; failed save rolls back the optimistic update
  and shows an error.
**Brief contents:** term_notes schema (inline), RLS rules, modal editor spec,
criteria. (Defer — build only after T17 ships and is validated.)

### T20 — Social Q&A ("Ask a coffee question")
**Objective:** A community Q&A where signed-in users ask coffee questions
(optionally tied to a glossary term) and answer others'. Ask/answer are
account-gated; reading is public. (D-015, D-016 — Phase 3, gated)
**Tasks:**
1. Migrations: `questions` (`id`, `user_id`, `title`, `body`, `term_id null`,
   `created_at`) + `answers` (`id`, `question_id`, `user_id`, `body`,
   `created_at`). RLS: public read; insert/update/delete owner-only.
   (Votes/deleted-flag as a follow-up, not v1.)
2. Entry points: "Ask a coffee question" on the Dictionary tab + "Ask about
   this term" on the term modal; both route to `/auth` when signed out.
3. Question feed (recent) + question detail (answers thread) + composer.
4. Tagged questions surface on the term modal ("Questions about this term").
5. Moderation MVP: account required + rate limit (e.g. max N questions/day);
   admin delete via Supabase dashboard.
**Acceptance criteria:**
- Signed-in user can post a question and answer another; both persist.
- Signed-out users can read the feed/detail but cannot post (routed to `/auth`).
- User cannot edit/delete another user's question/answer (RLS SQL test).
- Tagged questions appear on the matching term modal.
**Brief contents:** questions/answers schema (inline), RLS rules, entry-point
spec, feed/detail/composer spec, moderation MVP, D-015/D-016 rationale, criteria.
**Open questions (settle before dispatch):**
1. Read-gated vs read-public — D-015 recommends public read; confirm.
2. Who is expected to answer first (community seeding vs owner-answered)? Cold
   start: seed a handful of questions from the site's FAQ.
3. Moderation: is admin-delete-via-dashboard enough for launch?

---

## 4. Context-optimization strategy (v1.2)

Rule: **a brief should contain everything the subagent needs and nothing it doesn't.**

1. **Per-ticket briefs, never whole-plan dumps.** Brief = objective + acceptance
   criteria + inline stable artifacts + file pointers.
2. **CONVENTIONS.md as the single shared context.** Every brief says "read
   CONVENTIONS.md first".
3. **Point, don't paste, once the repo has shape.** After T1, briefs point at
   existing files instead of inlining patterns.
4. **Inline only what is small and stable:** schema SQL, formulas, thresholds,
   acceptance criteria.
5. **Shared enums live in `src/constants/` — never re-inline them in briefs.**
6. **Acceptance criteria are mandatory on every ticket** — makes spec review
   enforceable.
7. **Structured outputs via `output_schema`** — compact JSON from builders/
   reviewers (files changed, tests run, criteria met/not, blockers).
8. **Parallelize independent tickets** up to the 3-child limit: P1 wave after T2
   = T5 ∥ T6 ∥ T7; P2 wave = T9 ∥ T13.
9. **Fresh context per ticket.** Dependencies flow through committed code.
10. **Seed/fixtures checked into the repo** — glossary subset (T7), test data
    (T6), no hallucinated data.
11. **Reviewer briefs get the diff, not the repo.**
12. **Advisors are the only wide-context consumers** — the plan is ~10 KB;
    everything else stays narrow.

## 5. Execution flow per ticket

1. Orchestrator writes ticket brief (per §3 template).
2. Dispatch builder (leaf) → runs tasks, commits locally.
3. Spec-compliance review (leaf): checked against acceptance criteria. Unmet → back.
4. Code-quality review (leaf): security, patterns, tests. Fail → back.
5. Merge + mark ticket done.
6. Phase gate: run both advisors before the next phase.

## 6. Phase 3 gate (v1.2 defaults, adjustable)

- Activation: ≥25% of new users log ≥3 brews in first 7 days.
- Retention: D7 ≥ 20%.
- Measured from `events` (T6); gate check before T15 dispatch. Gate fails → P3
  does not start; revisit with advisors. Espresso secondary segment uses the same
  gate (espresso-method log cluster in analytics).

## 7. Open decisions

Decisions are now tracked with rationale in `docs/decisions.md` (D-### IDs).
Tickets reference them; changing one requires a new superseding entry.

Resolved since v1.2:
1. ~~Paid-tier reuse~~ — RESOLVED: app shows teaser + link-out only; the paid
   tier stays on coffee-dictionary.com (D-002, D-013).
2. ~~Definitions export (~276 terms)~~ — DONE: full ETL import, 377 terms live
   via `~/coffee-dictionary-import` (D-003).

Remaining:
1. Photo caps — pending user recommendation (proposed: 3 photos, client-side
   compress, 5 MB hard cap).
2. T20 open questions (settle before dispatch): read-gated vs read-public for
   the Q&A; who seeds the first answers; moderation depth (D-015).
3. T18 mapping location: `src/constants/` vs `term_mappings` table (recommend
   constants for v1).

## 8. Changelog v1.2

- T1: Calculator tab removed → 2 tabs (Log/History)
- T3: calculator section (T5 module) + prefill integrated into the form
- T5: now the module (logic + component + tests), not a screen
- T2: account deletion added
- T7: glossary stub seeds from the real dataset subset (not agent-authored)
- T10: import from dictionary_terms_data.json via `coffee-dictionary-import` repo
- T13 (new): photo attachments (Storage bucket, RLS, cascade delete)
- T15/T16: renumbered (was T14/T15); P2 QA now T14
- §6: gate numbers defaulted; espresso segment gate noted

## 9. Changelog v1.3

- Added `docs/decisions.md` decision log (D-001…D-016) — the justification
  artifact for future add/change/remove calls.
- T17 (new): Saved terms / bookmarks — account-gated, Phase 2 (D-012, D-014).
- T18 (new): "Your terms" — brew-derived personal glossary, Phase 2.
- T19 (new): Personal notes on a term — Phase 2, optional/last.
- T20 (new): Social Q&A — "Ask a coffee question" — Phase 3, gated (D-015, D-016).
- §7 rewritten: paid-tier reuse and definitions export marked resolved; T20/T18
  open questions listed.

# Coffee App — Ticket Partition & Subagent Delegation Plan

> Source of truth: `coffee-app-agent-plan.md` (product + phases). This document is the
> execution layer: how the plan is cut into tickets/tasks and dispatched to subagents,
> with a context-optimization strategy and the standing advisory agents.

**Goal:** Make the coffee app plan executable by subagents — one ticket = one or more
`delegate_task` dispatches, each with a minimal, self-sufficient brief.

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
- **Reviewers:** after a ticket passes spec review, a second leaf subagent reviews code
  quality (security scan, patterns, tests). Only then is the ticket merged/committed.
- **Advisors:** standing roles, independent of the plan content (they are process roles,
  not feature roles). Invoked when the plan is drafted/revised and at each phase gate.
  Definitions live in `.hermes/agents/` so they are versioned with the repo.

## 2. Ticket index

| ID  | Ticket                                    | Phase | Depends on        | Est. dispatches | Parallel-safe |
|-----|-------------------------------------------|-------|-------------------|-----------------|---------------|
| T1  | Scaffold, tooling, navigation skeleton    | 1     | —                 | 1–2             | —             |
| T2  | Supabase: schema, auth, RLS               | 1     | T1                | 2–3             | —             |
| T3  | Brew log CRUD                             | 1     | T2                | 2–3             | —             |
| T4  | History list, detail, filters             | 1     | T3                | 2               | —             |
| T5  | Ratio calculator                          | 1     | T1                | 1               | yes (w/ T6)   |
| T6  | Bean cellar CRUD + freshness              | 1     | T2, T3 (patterns) | 2               | yes (after T3)|
| T7  | Polish: states, QA pass, fixes            | 1     | T3–T6             | 2–3             | —             |
| T8  | Glossary + origins schema, seed           | 2     | T2 (schema pat.)  | 1–2 (seed=human)| —             |
| T9  | Glossary browse/search UI                 | 2     | T8                | 2               | —             |
| T10 | Contextual linking + origin cards         | 2     | T9, T3            | 2               | —             |
| T11 | Phase 2 QA/polish                         | 2     | T8–T10            | 1               | —             |
| T12 | Public profiles & follow                  | 3     | T3 + validation   | 2–3             | gated         |
| T13 | Freemium gating + RevenueCat              | 3     | T12               | 3               | gated         |

Phase 3 tickets (T12–T13) are **gated**: they must not be dispatched until Phase 1–2
retention data exists (per the plan's own deferral rule).

## 3. Ticket breakdown (tasks + brief contents)

### T1 — Scaffold, tooling, navigation skeleton
**Objective:** Bootable Expo app with tab navigation and repo conventions in place.
**Tasks:**
1. `npx create-expo-app` (TypeScript template) in repo root.
2. Add ESLint + Prettier + strict TS config; commit.
3. Install React Navigation (bottom tabs) or Expo Router; create 4 tab stubs:
   Log / History / Cellar / Calculator.
4. Create `src/` structure: `screens/ components/ lib/ hooks/ types/ constants/`.
5. Write `CONVENTIONS.md` (stack, folder rules, naming, commit style) — referenced by
   every later brief.
6. Verify: app boots in Expo Go (iOS + Android), tabs switch.
**Brief contents:** the plan's tech-stack section (3 lines), CONVENTIONS.md template,
acceptance criteria. No schema needed yet.

### T2 — Supabase: schema, auth, RLS
**Objective:** Working auth (email/password + Google/Apple) and DB tables with RLS.
**Tasks:**
1. `supabase init` + link project; env config for API URL/anon key.
2. Apply Phase-1 schema SQL (users, beans, brew_logs + ratio generated column).
3. Enable RLS on beans + brew_logs (owner-only), write policy tests.
4. Auth screens (email/password) + social buttons; session persistence.
5. Auth context/provider hook; route guard (redirect to login).
**Brief contents:** full Phase-1 SQL from plan (inline — it's small and stable),
auth requirements, RLS requirement. Subagent reads CONVENTIONS.md itself.

### T3 — Brew log CRUD
**Objective:** Create/edit/delete brew logs with validation, ratio auto-calc.
**Tasks:**
1. Zod schemas for brew log fields + validation rules.
2. Create/edit form: all fields (date, bean, method dropdown, grind, dose/water,
   ratio auto-calc, brew time, tasting notes, rating).
3. Persist to Supabase; optimistic UI.
4. Delete with confirmation.
**Brief contents:** brew_logs schema (inline), field list + validation rules, method
enum values. Subagent reads existing form/type patterns from repo.

### T4 — History list, detail, filters
**Objective:** Filterable log history with detail view.
**Tasks:**
1. History list query (React Query), sorted by brewed_at desc.
2. Filters: method / rating / date range.
3. Detail screen; delete + edit entry points.
**Brief contents:** brew_logs fields, filter requirements, existing patterns.

### T5 — Ratio calculator (standalone)
**Objective:** Offline dose↔water↔ratio two-way calculator, no DB.
**Tasks:**
1. Calculator screen with three linked inputs (any two → third).
2. Unit handling (g / ml), quick presets (1:15, 1:16, 1:17…).
3. Pure function + unit tests (vitest/jest) — no UI needed for logic.
**Brief contents:** formula (dose × ratio = water), preset list, offline requirement.
No schema, no backend. **Dispatchable in parallel with T6.**

### T6 — Bean cellar CRUD + freshness
**Objective:** Beans list with roast-date freshness indicator.
**Tasks:**
1. Beans CRUD (reuse T3 patterns).
2. Freshness display: days since roast → badge (green/amber/red thresholds).
3. Optional: link bean to brew log (bean_id FK picker).
**Brief contents:** beans schema (inline), freshness thresholds, pointer to T3's
CRUD patterns.

### T7 — Polish, QA, fixes
**Objective:** Production-feel MVP, verified on device.
**Tasks:**
1. Empty/loading/error states across all screens.
2. Manual QA pass on iOS + Android via Expo Go (checklist).
3. Fix found issues; verify offline behavior of calculator.
**Brief contents:** QA checklist, known flaky areas.

### T8 — Glossary + origins schema & seed
**Objective:** Content layer data model + initial content.
**Tasks:**
1. glossary_terms + origins tables (+ RLS: public read).
2. Seed: ~50–100 terms, ~30 origins. **Content sourcing is human work** — subagent
   scaffolds seed files/structure; actual copy comes from a human/curated source.
**Brief contents:** Phase-2 SQL (inline), content pipeline notes (what's agent vs human).

### T9 — Glossary browse/search UI
**Objective:** Searchable glossary screen.
**Tasks:**
1. Glossary list + search (client-side filter OK for MVP).
2. Term detail view (definition, category, related terms).
**Brief contents:** glossary_terms fields, search requirements.

### T10 — Contextual linking + origin cards
**Objective:** Logs surface glossary/origin context automatically.
**Tasks:**
1. Term-matching: simple string match of tasting_notes against glossary terms.
2. Render matched terms as tappable chips linking to glossary.
3. Origin reference card: trigger when bean.origin matches origins table; show flavor
   notes + typical process.
**Brief contents:** matching algorithm scope (explicitly no NLP), trigger rules,
component behavior.

### T11 — Phase 2 QA/polish
**Objective:** Content layer verified end-to-end.
**Tasks:** states, edge cases (empty glossary, no matches), device QA.

### T12 — Public profiles & follow *(gated)*
**Objective:** Public/private toggle, follow, public feed.
**Tasks:** `is_public` flag + RLS update; follow table; feed query; public profile view.

### T13 — Freemium + RevenueCat *(gated)*
**Objective:** Subscription gating.
**Tasks:** RevenueCat SDK + entitlements; paywall screens; feature gating (20-log cap,
pro-only charts/glossary).

---

## 4. Context-optimization strategy

Rule: **a brief should contain everything the subagent needs and nothing it doesn't.**
The plan doc stays authoritative; briefs link, they don't duplicate.

1. **Per-ticket briefs, never whole-plan dumps.** Brief = objective + acceptance
   criteria + inline stable artifacts (SQL, enums, thresholds) + file pointers.
2. **CONVENTIONS.md as the single shared context.** One file covering stack, folder
   layout, naming, TS strictness, commit style. Every brief says "read CONVENTIONS.md
   first" — ~1 token, replaces repeating conventions in every prompt.
3. **Point, don't paste, once the repo has shape.** After T1, briefs say "read
   `src/lib/supabase.ts` for the client pattern" instead of inlining it.
4. **Inline only what is small and stable:** schema SQL, field lists, validation
   rules, formula constants. These are wrong when paraphrased — cheap to inline.
5. **Structured outputs via `output_schema`** on `delegate_task` — subagents return a
   compact JSON summary (files changed, tests run, blockers) instead of prose dumps.
6. **Parallelize independent tickets** up to the 3-child concurrency limit:
   T5 ∥ T6 after T3 patterns exist; reviewers of different tickets can overlap.
7. **Fresh context per ticket.** No long-lived builder; each dispatch is a clean leaf.
   Dependencies flow through the repo (committed code), not through context.
8. **Seed/fixtures checked into the repo** so content tasks (T8) and QA have stable
   inputs and subagents never hallucinate data.
9. **Reviewer briefs get the diff, not the repo** — narrow scope keeps review context
   small and review quality high.
10. **Advisors are the only wide-context consumers** — they read the full plan, which
    is only ~5 KB. Everything else stays narrow.

## 5. Execution flow per ticket

1. Orchestrator writes ticket brief (per §3 template).
2. Dispatch builder (leaf) → runs tasks, commits locally.
3. Spec-compliance review (leaf): does it meet acceptance criteria? If no → back to builder.
4. Code-quality review (leaf): security scan, patterns, tests. If no → back to builder.
5. Merge + mark ticket done in this document.
6. Phase gate: run advisors (Plan Critic + Product Advisor) before dispatching the next phase.

## 6. Open decisions (carried from plan + new)

- Expo Router vs React Navigation (affects T1).
- Phase 1 ships with glossary stub or waits for Phase 2 (affects T1 nav stubs).
- iOS-only vs both platforms at launch (affects QA effort, T7).
- Ratio formula convention: dose × ratio = water (1:15 default), confirm 1–10 vs 1–5 rating scale.
- Seed content ownership: who writes the ~50–100 glossary terms (human/curated source needed for T8).

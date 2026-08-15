# T6b — D7-retention query + anonymous identity stitching

Goal: the Phase 3 gate needs D7 retention ≥20%, but only the activation query is
ticketed, and anonymous (pre-account) events must be attributed to the account at
soft-wall conversion or both metrics are corrupted.

## Context
- `events` table + `track()` in `src/lib/track.ts` (fire-and-forget; RLS scopes
  inserts to the signed-in user). `session_start` and `log_created` already fire
  (T6).
- Soft wall converts anonymous → account at log #2 (`auth-screen.tsx`).
- Gate numbers: activation ≥25%, D7 ≥20% (plan §6).

## Task 1 — D7-retention SQL (analytics script, not app code)
Write a query (in `docs/analytics/d7-retention.sql` or the import repo) that
computes, from `events`: % of users active again 7 days after their first
`session_start`, matching the activation-query pattern. Verify against seeded fake
data.

## Task 2 — Identity stitching
On soft-wall conversion (first sign-in), attribute the user's earlier NULL-user
events to their new account: `update events set user_id = <new_id> where
user_id is null and ...` — implement via a small RPC or client update keyed on a
session/device id captured pre-signup (add an `anon_id` to the `track()` call if
needed). Post-stitch, activation and D7 recompute correctly.

## Acceptance criteria
- D7 query returns correct counts against seeded fake data.
- Stitching reassigns pre-signup events; post-stitch activation/D7 correct.
- No signed-in user's events are ever visible to another user (RLS unchanged).

## Verification
SQL test against seeded data; on-device: log 2 brews signed out → sign in →
confirm events are attributed.

# T15 — Public profiles & follow *(Phase 3, gated)*

Goal: optional public profile + follow + a feed of followed public logs.

## Context (read first)
- `follow_relationships` table already exists in
  `supabase/migrations/20260810_201500_init.sql` (follower_id, followed_id,
  unique, check self-follow forbidden) with owner RLS.
- Gate: activation ≥25% AND D7 ≥20% (plan §6) before this dispatches.
- Not a monetization path (advisor cut list); keep it lean.

## Task 1 — Public flag + RLS
Add `is_public boolean not null default false` to `profiles`. RLS: a user's
profile is readable by anyone only when `is_public`; followers of a public user
can read their public `brew_logs` (add a `brew_logs` select policy for
followers). Private users stay invisible to non-followers.

## Task 2 — Follow + profile view + feed
- Follow/unfollow (idempotent) on `follow_relationships`.
- Public profile view (display_name + public logs).
- Feed query: logs of followed users, `brewed_at desc`.

## Acceptance criteria
- Private users invisible to non-followers; public users' logs readable by
  followers only.
- Follow is idempotent; self-follow rejected (existing CHECK).
- Feed shows only followed users' public logs, newest first.

## Verification
RLS SQL tests (follower sees / non-follower can't); on-device follow flow.

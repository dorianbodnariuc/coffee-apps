# T19 — Personal notes on a term

Goal: one private note per term per user ("what over-extraction tasted like for
me"). Optional/last (D-014).

## Context
- Build after T17 ships (pattern: `supabase/migrations/20260822_create_saved_terms.sql`,
  `src/lib/glossary-api.ts`, `use-saved-terms.ts`).
- D-010: optimistic update with rollback on failure; surface errors.
- Signed-out tap → `/auth` with returnTo (T17 contract).

## Task 1 — Migration
```sql
create table public.term_notes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  term_id    uuid not null references public.glossary_terms (id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, term_id)
);
-- RLS: owner-only select/insert/update/delete
```

## Task 2 — API + UI
- `glossary-api.ts`: get/upsert note per (user, term).
- Term modal: "Add a note" (signed in) → inline editor; edit affordance;
  `updated_at` bumps on edit; 500-char cap with visible error.
- React Query mutation + optimistic update with rollback (D-010).

## Acceptance criteria
- Note persists across restart; edit updates `updated_at`.
- User A cannot read user B's notes (RLS SQL test).
- Deleting the user or a term removes the note (no orphans).
- Failed save rolls back the optimistic update and shows an error.

## Verification
`npm run typecheck && npm run lint && npm test` (RLS test mirroring the saved-terms
integration test).

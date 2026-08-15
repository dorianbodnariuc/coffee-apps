# T20 — "Ask the coffee expert" (social Q&A) *(Phase 3, gated)*

Goal: expert-first Q&A. A signed-in user asks; they get an instant AI draft
(flagged) plus a human-reviewed answer from the app admin within 3 days (D-025).
Private to the asker (D-022). (D-020, D-021, D-023.)

## Context (read first)
- D-020 (expert-first, community UGC opt-in), D-021 (AI draft + human loop),
  D-022 (asker-only), D-023 (answers → glossary terms), D-025 (expert = app admin,
  3-day SLA). D-016: Phase 3, gated (activation ≥25%, D7 ≥20%).
- `glossary_terms` has `id`, `term`, `slug`, `source_url`. `profiles` has
  `display_name`.

## Task 1 — Migrations
```sql
create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text,
  term_id    uuid references public.glossary_terms (id) on delete set null,
  visibility text not null default 'expert_only' check (visibility in ('expert_only','public')),
  status     text not null default 'open',
  created_at timestamptz not null default now()
);
create table public.answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade, -- null = admin/expert
  kind        text not null check (kind in ('ai_draft','expert','community')),
  body        text not null,
  created_at  timestamptz not null default now()
);
```
RLS: questions public-read where `visibility='public'`, else asker + owner;
`ai_draft`/`expert` answers asker + owner only (D-022); community answers follow
question visibility; write owner-only.

## Task 2 — Entry points + ask flow
- "Ask the coffee expert" on the Dictionary tab + "Ask about this term" on the
  term modal; route to `/auth` when signed out (returnTo per T17).
- Composer → on submit, an Edge Function calls an LLM to produce an `ai_draft`
  answer (flagged "AI draft — a comprehensive answer is on the way"), grounded in
  the glossary teaser (D-002), not full articles.

## Task 3 — Visibility + display
- Asker toggles `expert_only` (default) or `make public`. Public questions show a
  feed + community answers.
- Denormalize `display_name` into questions/answers at write time.

## Task 4 — Admin review loop (3-day SLA, D-025)
- Minimal review surface (Supabase dashboard for v1) for the app admin to
  reframe the AI draft into the final `expert` answer within 3 days.
- "Propose as glossary term" action (D-023): answers that stand alone are written
  up on coffee-dictionary.com and imported via the ETL.
- Rate limits (questions/day, answers/day) in `src/constants/`.

## Acceptance criteria
- Signed-in ask → `ai_draft` labeled AI + "comprehensive answer ASAP" promise.
- `expert_only` question visible only to asker + owner; `public` readable by
  signed-out + accepts community answers.
- AI draft + expert answer are asker-only even on a public question (D-022).
- User cannot edit/delete another user's question/answer (RLS).
- Deleting a term sets `questions.term_id` NULL (question survives).

## Open items (settle before dispatch)
- LLM provider/model + cost ceiling for the instant draft.
- Owner review surface: dashboard (v1) vs in-app panel.
- Account deletion vs questions/answers: cascade (default) vs anonymize.

## Verification
RLS SQL tests; on-device ask → AI draft; admin answers within the review surface.

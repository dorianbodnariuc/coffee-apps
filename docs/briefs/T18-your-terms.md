# T18 — "Your terms" (brew-derived glossary)

Goal: a personal glossary derived from what the user actually brews, by matching
their brew-log text against the glossary — no hardcoded mappings (D-019).

## Context
- Reuse the existing matcher: `src/lib/glossary-search.ts` (`searchGlossaryTerms`)
  and/or `src/lib/glossary-match.ts` word-boundary + scoring (D-007/D-008). Read
  both before implementing.
- `GlossaryTerm` has `id` (T17), `term`, `definition`, `slug`, `categories[]`,
  `source_url`.
- Signed-in only (D-012); derived on the fly (no stored mapping table — D-019).
- Dictionary UI lives in `src/screens/dictionary-screen.tsx`.

## Task
1. Derive candidate terms by running each brew log's text fields (method, grind,
   bean name/origin/roaster, tasting notes) through the matcher. Note: after T23,
   also match method-specific param values where text (machine, dripper, etc.).
2. Aggregate: a term is included if it matches ≥1 log; rank by number of matching
   logs desc, ties alphabetical; cap (top 20).
3. Dictionary: a "Your terms" section/chip (signed in only) listing derived terms;
   empty state when the user has no logs or no matches.
4. Tap a derived term → the term modal (reuse T17 modal).

## Acceptance criteria
- Deterministic: a unit test with synthetic logs asserts the exact output set.
- Zero-log user sees the empty state, not an error.
- Ranking deterministic (match count desc, ties alpha) and capped.
- Signed-out users never see the section.

## Verification
`npm run typecheck && npm run lint && npm test` (deterministic fixture test).

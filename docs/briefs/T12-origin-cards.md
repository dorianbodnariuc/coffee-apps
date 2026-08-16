# T12 — Origin reference cards

Goal: when a brew log has an origin, surface a compact "origin card" on the
brew detail screen — the best-matching glossary term's definition teaser plus a
"read more" link into the term modal — instead of the plain text field alone.

## Context
- Brew detail already matches TASTING NOTES against the glossary (T7) and
  renders chips. T12 extends matching to the ORIGIN field and renders it as a
  card, not a chip.
- The glossary's "Coffee Origins" category is thin and mostly country/city
  articles (Ethiopia, Australia, United States, Mocha, Arusha, …). It does NOT
  cover region-level origins (Yirgacheffe, Huila, Nyeri) — which T25's
  autocomplete now suggests. So a bare glossary match would miss most origins.
- The T24 `origins` catalog maps region → country. Use it to resolve the origin
  text to a catalog entry, then match that entry's country/region against the
  glossary — so "Yirgacheffe" surfaces the "Ethiopia" term.
- Coverage is bounded by what the glossary actually contains (D-032). Richer
  per-origin descriptions are a separate CONTENT decision (would flow
  site → app via the D-003 ETL / D-023 content loop), not this ticket.

## Task 1 — `src/lib/origin-match.ts`
`matchOriginTerm(origin, terms, origins) -> { term, origin } | null`:
1. Direct: `matchGlossaryTerms(originText, terms)` (word-boundary).
2. Catalog: find `origins` whose name is a case-insensitive substring of the
   origin text (or vice-versa); match each candidate's `country + region`
   against the glossary.
3. Prefer terms in the "Coffee Origins" category; within that, direct matches
   before catalog-resolved; return the first, plus the resolved `origin` for a
   country/region sublabel. Return null when nothing matches.

## Task 2 — Origin card in `brew-detail-screen.tsx`
- Load origins via `useOrigins()` (already cached, T24).
- When `brew.origin` is non-empty and `matchOriginTerm` returns a match, render
  an "Origin" card after the Origin field: the origin text + resolved
  country/region sublabel, the matched term's definition (truncated ~2 lines),
  and "Read more" that opens the existing `TermModal` for that term.
- No match → no card (defined no-match fallback; the plain Origin field stays).

## Acceptance criteria
- Origin "Ethiopia Yirgacheffe" → card shows the "Ethiopia" term.
- Origin "Yirgacheffe" (region only) → card shows "Ethiopia" via catalog
  resolution (Yirgacheffe's country).
- Origin "Colombia Huila" (no glossary term) → no card, plain text stays.
- "Read more" opens the term modal; targets ≥44px (D-009).
- `matchOriginTerm` unit-tested for the three cases above.

## Verification
`npm run typecheck && npm run lint && npx vitest run`; web visual check via
headless Chrome (a brew with an origin shows the card).

## Out of scope
- Curating per-origin flavor/altitude descriptions (content decision, D-023/D-003).
- Origin cards in the log form or bean form (follow-up).

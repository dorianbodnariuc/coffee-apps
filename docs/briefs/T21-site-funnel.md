# T21 — Site funnel wiring + link-out attribution (builder brief)

Goal: turn the owned sites into the app's acquisition funnel and make the funnel
measurable. Two workstreams — the app-side pieces are buildable now; the
site-side CTA is blocked on a store listing.

## Context (read first)
- D-024: the site is free (magnet); the app is the monetization surface. T21 is
  the distribution prerequisite to monetization.
- D-003: never call the site's API from the app at runtime — all site work is
  static, on the WordPress side.
- D-002: the term modal already links out ("Read the full article ↗") via
  `WebBrowser.openBrowserAsync` in `src/components/term-modal.tsx:146`.
- `track(name, properties)` lives in `src/lib/track.ts` (fire-and-forget, inserts
  into `events`; RLS scopes inserts to the signed-in user, so events only record
  for authenticated sessions — fine, since activation is an account concept).

## Workstream A — app-side (buildable now, in ~/coffee-app)

### A1. Attribute link-out taps
- In `term-modal.tsx`, wrap the existing
  `WebBrowser.openBrowserAsync(term.source_url)` call: before opening, call
  `track("source_url_opened", { term_id: term.id, term_slug: term.slug,
  source_url: term.source_url })`.
- `term.id` already exists on `GlossaryTerm` (added in T17). If `term.slug` is
  not on the client type, add it to the select in `src/lib/glossary-api.ts`.
- Do not await `track` — it is fire-and-forget; opening the browser is the
  priority.

### A2. Post-3-logs nudge ("Read the full article on [term]")
- Rule: after a user has logged ≥3 brews whose text matched a glossary term
  (reuse the matcher already used by T18 — `src/lib/glossary-match.ts` /
  `glossary-search.ts`), show a dismissible card once per matched term.
- Placement: Dictionary tab, top of the list (above the chips) — recommend a
  single card showing one term at a time.
- Persistence: remember dismissed nudge term-ids in AsyncStorage so a dismissed
  nudge never returns. Cap shown nudges (one card at a time).
- Copy: "Read the full article on [term] ↗" — opens the same `source_url`
  (and fires the A1 attribution event).
- Signed-out behavior: nudge only for signed-in users (events + saved state are
  account-scoped).

## Workstream B — site-side (WordPress; blocked on a store listing)
- On coffee-dictionary.com (and later the brew*coffee.com sites), add an
  app-install CTA card/banner to article pages.
- Destination: a store listing (Google Play now; App Store later) or a landing
  page. NOTE: the app is not published yet — do NOT ship a CTA that 404s. Wire
  this only after the Play Store listing exists.
- Attribution: link with UTM params
  (`?utm_source=coffee-dictionary&utm_medium=site&utm_campaign=article`) and a
  store deep-link where available, so "site → install → sign-up → activation" is
  measurable in store analytics + UTM.

## Acceptance criteria
- [A1] Tapping "Read the full article" writes one `events` row with name
  `source_url_opened` and the `term_id`/`term_slug`/`source_url` properties
  (verified in the DB for a signed-in user).
- [A2] A signed-in user with ≥3 matching logs sees the nudge once per term;
  dismissing prevents recurrence; signed-out users never see it.
- [B] (blocked) CTA is live on coffee-dictionary.com only after a store listing
  exists; taps carry a UTM source.

## Funnel metric definition (for T6b / §6)
"% of activated users who open ≥1 source_url in 7 days" =
count(distinct user_id with a `source_url_opened` event within 7 days of their
first `session_start`) / count(distinct user_id who activated). Implement as a
SQL query over `events` — add it to T6b, not here.

## Out of scope
- No site API calls from the app (D-003).
- No Reddit/FB/Twitter sharing (that is the separate share bridge).
- No store-listing setup (separate release work).

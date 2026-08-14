# Decisions Log — Coffee App

The single record of product and technical decisions for this app, with the
reasoning behind each. This is the justification artifact: before we change,
add, or remove a feature, read its decision entry to see why it exists and what
reversing it costs.

## How to use this log

- Each decision gets a stable ID (`D-###`) that tickets and code comments
  reference. Never renumber.
- **Do not rewrite history.** To change a decision, add a new entry that says
  "Supersedes D-###" and records the new reasoning. The old entry stays.
- Statuses: **Accepted** (in force) · **Superseded** (replaced by a newer
  entry) · **Proposed** (documented, not yet built).
- Every entry has a *Consequences* line: what we give up, and roughly what
  rolling it back would cost. That line is the whole point of the log.

---

## Content & data layer

### D-001 — Definition source = first paragraph only
- **Status:** Accepted · **Decided:** 2026-08 (glossary import, T10)
- **Context:** The full coffee-dictionary.com articles are long-form SEO
  content, not dictionary definitions.
- **Decision:** The app's `definition` field is the article's lead (first
  paragraph). Full articles are never imported into the app.
- **Rationale:** The lead is the actual definition by the site's own
  convention; full text is overkill for a mobile reference and duplicates paid
  content.
- **Consequences:** Definitions are short (~370 chars avg). If we ever want
  full text in-app, that's a new decision — it directly conflicts with D-002.

### D-002 — Teaser + "Read the full article" link out
- **Status:** Accepted · **Decided:** 2026-08 (T11)
- **Context:** Users asked whether the app should carry full articles.
- **Decision:** The term modal shows the lead definition plus a "Read the full
  article ↗" button that opens the canonical coffee-dictionary.com URL in the
  system browser (`expo-web-browser`). No in-app full text.
- **Rationale:** SEO authority and the site's paid tier stay on the canonical
  domain. Native app text is not crawled, so duplicating it earns nothing and
  cannibalizes the site. The link sends engaged clicks back to our own funnel.
- **Consequences:** Requires network for the full read. Requires keeping
  `source_url` populated on every term (verified: 0 missing).

### D-003 — Data bridge = offline ETL, never live-site reads
- **Status:** Accepted · **Decided:** 2026-08 (T10)
- **Context:** The app needs glossary data; the source is a WordPress site.
- **Decision:** All glossary content flows through the `coffee-dictionary-import`
  ETL repo (JSON export → normalize → seed migration → `supabase db push`).
  The app never calls coffee-dictionary.com's API at runtime.
- **Rationale:** Performance and stability — no dependency on the site being up
  or fast; the site's REST list endpoint is known to misbehave (pagination/
  cache). One clean offline bridge.
- **Consequences:** Content updates are manual (re-run ETL + push). If we want
  near-live updates, that's a new decision (a cron-synced edge function).

### D-004 — Category authority = site WordPress taxonomy
- **Status:** Accepted · **Decided:** 2026-08 (T11)
- **Context:** Two candidate sources for glossary categories: a keyword
  classifier or the site's own WordPress taxonomy.
- **Decision:** Use the site's WP taxonomy as the authoritative category list.
- **Rationale:** It's already curated, consistent with the canonical site, and
  avoids building/maintaining a classifier. Users see the same categories in
  the app and on the site.
- **Consequences:** Category quality is bounded by the site's taxonomy. If the
  site re-taxonomizes, the ETL must be re-run (D-003 path).

### D-005 — Category consolidation (sub-10 terms → "General Terms")
- **Status:** Accepted · **Decided:** 2026-08 (T11)
- **Context:** The WP taxonomy had many tiny categories (several under 10
  terms), which makes browsing noisy.
- **Decision:** Merge every category with fewer than 10 terms into a single
  "General Terms" bucket. Result: 13 → 11 categories.
- **Rationale:** Eleven browseable categories beat two dozen mostly-empty ones.
  Fewer, denser chips = better browse UX and less decision fatigue.
- **Consequences:** Some niche terms lose a specific label. Reversing is cheap
  (re-run ETL with a different threshold) — no schema change.

### D-006 — Multi-category membership (`categories[]`)
- **Status:** Accepted · **Decided:** 2026-08 (T11)
- **Context:** A term like "Cappuccino" is both a drink and relates to milk
  texturing; forcing one category loses information.
- **Decision:** `glossary_terms.categories` is a `text[]` holding every
  applicable category; `category` remains the single primary label for compact
  display. A term appears under every category that fits (127 of 377 are
  multi-category).
- **Rationale:** Browsing by any relevant category should surface the term.
- **Consequences:** Slightly more complex search/filter logic (must test any
  array element). Reversing is a schema change + ETL re-run.

---

## Search

### D-007 — Stopword filtering
- **Status:** Accepted · **Decided:** 2026-08 (T11c)
- **Context:** Queries like "of the" or "a" matched `"of"` as a substring of
  `"coffee"` and returned garbage.
- **Decision:** Filter stopwords (`of`, `the`, `a`, `an`, `for`, `with`, …)
  from queries before matching; a query that reduces to zero content words
  returns no results.
- **Rationale:** Noise queries must not surface false positives.
- **Consequences:** Legitimate single stopword searches are impossible (they
  should be — no term is named "of"). Adding a stopword is a one-line change.

### D-008 — Relevance scoring tiers
- **Status:** Accepted · **Decided:** 2026-08 (T11c)
- **Context:** "pourover" initially ranked "Camp Coffee" (which mentions
  "pourover" in its article) above "Pour Over".
- **Decision:** Score each match by evidence strength — exact term > all-words
  > word-prefix > definition > compact > slug > category > related — and sort
  by score desc (ties alphabetical). Term-name compact match weighted 9.
- **Rationale:** A term-name match must outrank a mere mention in another
  term's definition.
- **Consequences:** Scoring is hand-tuned; new evidence types need the ranking
  revisited (see D-008 tests in `glossary-search.test.ts`).

---

## UX & safety

### D-009 — Touch targets (chips ≥44px, modal ≥40px)
- **Status:** Accepted · **Decided:** 2026-08 (T11)
- **Context:** Category chips were too small for reliable one-handed tapping.
- **Decision:** Filter chips have a minimum height of 44px; term-modal category
  chips a minimum of 40px.
- **Rationale:** Mobile touch targets should be ≥44px for comfortable use.
- **Consequences:** Slightly more vertical space per chip. Reversing is trivial.

### D-010 — Preserve input on failed save; surface all mutation errors
- **Status:** Accepted · **Decided:** 2026-08 (T8)
- **Context:** A failed create/update/delete could silently clear the form or
  show nothing.
- **Decision:** On a failed save the form keeps the user's input; create,
  update, and delete failures each render an explicit error message (footer on
  the Log form, banner on brew detail). No silent data loss.
- **Rationale:** Losing typed input or failing silently erodes trust in the
  core loop (logging a brew).
- **Consequences:** Slightly more UI code per mutation. Non-negotiable baseline.

### D-011 — "Sign in" entry points on Log + Dictionary tabs
- **Status:** Accepted · **Decided:** 2026-08-13 (T8)
- **Context:** Sign-in was only reachable from the History tab's prompt or the
  soft wall (after 2 brews). New users on the default Log screen were stranded.
- **Decision:** Show a "Sign in" header button on the Log and Dictionary tabs
  whenever the user is signed out; it hides once signed in. Routes to the same
  `/auth` screen.
- **Rationale:** Auth must be one tap from any tab; a passive, always-visible
  entry beats burying it behind History.
- **Consequences:** Header right slot on two tabs is used by this button while
  signed out (returns nothing when signed in, so no conflict).

---

## Account gating & social

### D-012 — Account gates personal state, never the core content
- **Status:** Accepted · **Decided:** 2026-08-13
- **Context:** "What should we hide behind the account for the dictionary?"
- **Decision:** The account gates **personal state only** — saved terms
  (bookmarks), a brew-derived "your terms" view, and personal notes on terms.
  Core definitions, search, and category browsing stay free for everyone.
- **Rationale:** Personal state is the honest reason to ask for an account
  (it needs to persist and sync); hiding reference content behind login would
  choke the acquisition hook before users see the value.
- **Consequences:** Nothing free is removed. Personal features are inert until
  a user signs in, which is itself a conversion trigger (D-011 pattern).

### D-013 — App account ≠ site paid tier
- **Status:** Accepted · **Decided:** 2026-08-13
- **Context:** The user owns coffee-dictionary.com and its (potential) paid
  tier; the app also has a free Supabase account.
- **Decision:** The app account is a free Supabase auth account. The paid tier
  lives on coffee-dictionary.com and is reached via the D-002 link-out. The app
  does not gate content behind payment.
- **Rationale:** Keeps the two surfaces cleanly separated: app = free logging +
  teaser reference; site = authority + monetization. No cannibalization.
- **Consequences:** If we later want in-app paid content, that supersedes both
  D-002 and D-013 and needs a RevenueCat/monetization decision (T16 exists but
  is gated).

### D-014 — Build order: bookmarks → your-terms → notes
- **Status:** Accepted · **Decided:** 2026-08-13
- **Context:** Three account-gated dictionary features were proposed.
- **Decision:** Ship **saved terms (bookmarks)** first, then the brew-derived
  **"your terms"** view, then **personal notes** (optional/last).
- **Rationale:** Bookmarks are the cheapest, most universal "save for later"
  affordance and the strongest sign-in driver. "Your terms" is differentiated
  but needs a term↔brew mapping (more work). Notes are nice-to-have.
- **Consequences:** Order encoded in tickets T17→T18→T19. Reordering is a
  planning change, not a code change.

### D-015 — Social component = "Ask a coffee question" Q&A
- **Status:** Superseded by D-020 · **Decided:** 2026-08-13
- **Context:** The user wants a social component, gated like the dictionary
  personal features.
- **Decision:** Build a community Q&A — signed-in users post coffee questions
  (optionally tagged to a glossary term) and answer others'. **Asking and
  answering are account-gated; reading is public** (same rationale as D-012:
  the feed is a discoverable hook, contribution is the gated action).
- **Rationale:** UGC is the strongest reason for an account and the clearest
  "social" fit for a coffee reference app; tying questions to glossary terms
  reuses the content layer instead of building a new graph.
- **Consequences:** UGC brings moderation and cold-start risk — see open
  questions in T20. Phase 3, gated on the §6 metrics. Reading-public vs
  reading-gated and moderation policy are still open and should be settled
  before T20 is dispatched.

### D-016 — Social Q&A is Phase 3, gated
- **Status:** Accepted · **Decided:** 2026-08-13
- **Context:** Where the social component sits relative to the existing gate.
- **Decision:** The Q&A (T20) is Phase 3 and gated on the same activation/
  retention numbers as the rest of Phase 3 (§6 of the plan). It is documented
  and ticketed now, not built now.
- **Rationale:** Social features burn retention runway if shipped before the
  core loop (log → history → glossary) is proven. Document-now, build-later.
- **Consequences:** T20 is a spec, not a build. If the gate passes, it's
  unblocked; if the gate fails, D-015/D-016 are revisited with advisors.

### D-017 — T16 freemium gates app features only, never content
- **Status:** Accepted · **Decided:** 2026-08-13 (advisor review)
- **Context:** Both advisors flagged that T16's "pro-only full glossary / origin
  database" violates D-013 (the app never paywalls content).
- **Decision:** T16's paid tier gates app features only — unlimited logs,
  flavor-trend charts, unlimited saved terms/notes. No glossary/origin content
  is ever paywalled in-app; the full article stays a link-out to the site's
  paid tier.
- **Rationale:** D-013 is the governing principle; monetization rides on app
  capability, not on content the site already monetizes.
- **Consequences:** Simpler freemium scope. If we ever want in-app paid content,
  that supersedes D-013/D-017 and needs a fresh decision.

### D-018 — Account prompts are contextual, not only at log #2
- **Status:** Accepted · **Decided:** 2026-08-13 (advisor review)
- **Context:** Product Advisor: a generic "sign in" prompt at log #2 is easy to
  reject; the moment of gated-feature intent converts far better.
- **Decision:** The soft wall (first brew pre-signup) stays, but the primary
  conversion moments become contextual: tapping save/bookmark or "Your terms"
  while signed out routes to `/auth` and returns the user to where they were.
  The D-011 header buttons remain as a passive affordance.
- **Rationale:** Prompting at intent ("save this term") outperforms a generic
  account prompt.
- **Consequences:** More sign-in trigger points to maintain; the log-#2 prompt
  becomes a secondary path, not the main one.

### D-019 — "Your terms" is derived by matching, not a mapping table
- **Status:** Accepted · **Decided:** 2026-08-13 (advisor review)
- **Context:** Advisors: a hardcoded method→term constants mapping "rots" as the
  377-term glossary evolves and forces app releases for fixes.
- **Decision:** T18 derives a user's terms by running their brew-log text fields
  (method, grind, bean name/origin/roaster, tasting notes) through the existing
  word-boundary + scoring matcher (D-007/D-008). No `term_mappings` table or
  constants. Rank by number of matching logs (desc), ties alphabetical, capped
  list. Deterministic and unit-testable with synthetic logs.
- **Rationale:** Reuses proven code, stays correct as the glossary grows, and
  needs zero mapping maintenance.
- **Consequences:** Precision is bounded by the search scorer — a term surfaces
  only if its text relates to what the user actually typed into their logs.

### D-020 — Social component = "Ask the coffee expert" (supersedes D-015)
- **Status:** Accepted · **Decided:** 2026-08-13 (advisor review + user)
- **Context:** The Product Advisor argued community UGC Q&A has a fatal cold
  start (r/coffee and Home-Barista already own that space) and heavy moderation.
  The user owns coffee-dictionary.com, a real authority.
- **Decision:** Reframe the Q&A as expert-first, not community-first. A signed-in
  user asks a coffee question; the answer comes from the expert (the site
  owner), delivered as an instant AI draft (D-021) plus a promised
  human-reviewed comprehensive answer. Community UGC is opt-in per question: the
  asker can "make public" so others can also answer. Visibility is
  `expert_only` (default — asker + expert see it) or `public` (everyone reads,
  community can answer); a public question can still carry the expert answer —
  that is the "both" case.
- **Rationale:** Uses the owner's existing authority as the answer source, which
  removes the cold-start problem (no community needed to bootstrap) and shrinks
  moderation (expert-curated answers; UGC only where the asker opts in). Ties
  into the owned-site funnel: good questions become site FAQ/glossary content.
- **Consequences:** Requires a runtime AI integration (D-021) and an owner
  review workflow. "Make public" reintroduces a bounded UGC/moderation surface.
  Asking remains account-gated; public questions are readable by anyone,
  `expert_only` questions are private to asker + expert.

### D-021 — Instant AI answer + human review loop
- **Status:** Accepted · **Decided:** 2026-08-13 (user)
- **Context:** The expert can't answer every question instantly, but instant
  value is what makes "ask" worth doing.
- **Decision:** On ask, an LLM generates an instant draft answer, clearly flagged
  as AI. The app promises a more comprehensive, human-reviewed answer ASAP. The
  owner then reviews/reframes the draft (and the question) into the final
  comprehensive answer. No answer is presented as final until the human pass.
- **Rationale:** Instant gratification plus an explicit quality promise; the
  human review keeps the owner's authority and accuracy bar intact.
- **Consequences:** Adds a runtime LLM dependency (cost, rate limits, prompt
  hygiene) and a review workflow for the owner. AI answers must be labeled as
  such. If AI quality/cost becomes a problem, the loop degrades gracefully to
  "expert answers when available" — only the promise wording changes, not the
  schema.

### D-022 — AI and expert answers are private to the asker
- **Status:** Accepted · **Decided:** 2026-08-13 (user); scoped after advisor
  review 2026-08-13
- **Context:** Refining the expert-Q&A gating: who gets to read the AI draft and
  the human-reviewed expert answer. The Product Advisor challenged the
  "all signed-in members" reading as cannibalizing coffee-dictionary.com.
- **Decision:** The instant AI draft and the final expert answer are asker-only
  — visible to the member who asked (plus the owner), never to other members or
  anonymous readers, even when the question itself is public. This is a private
  consultation, not a public read gate. Community (UGC) answers follow the
  question's visibility: public questions → public community answers.
- **Rationale:** "Member only" means private to the member who asked. Making the
  expert answer visible to all members would turn the app into a competing
  knowledge repository (cannibalizing the site, per D-002/D-013); making it
  fully public (the advisor's alternative) would likewise duplicate the site's
  authority and contradicts the asker-only intent. Private-to-asker keeps the
  site as the public authority while the app adds a private consultation layer.
- **Consequences:** Refines D-020/D-021. A public question shows community
  answers only — the expert answer is the asker's private perk and does not
  appear on the public view (no "locked answer next to public content"
  confusion). Considered and rejected: all-members, fully public.

### D-023 — Q&A answers can become glossary terms (content loop)
- **Status:** Accepted · **Decided:** 2026-08-13 (user)
- **Context:** The expert Q&A produces answers; some are comprehensive enough to
  stand alone as dictionary entries.
- **Decision:** During the owner's review step (D-021), an answer that could be a
  dictionary entry on its own is proposed as a new glossary term. The owner
  decides; accepted proposals are written up on coffee-dictionary.com (the
  canonical authority) and flow back into the app via the ETL (D-003). The app
  never authors glossary terms directly.
- **Rationale:** Closes the loop D-020 already intended ("good questions become
  site content"): Q&A feeds the glossary, the glossary feeds the site's SEO
  authority, and the site feeds the app. Keeps the human/expert as the authoring
  authority — no auto-generated terms.
- **Consequences:** Adds a "propose as term" action to the owner review surface
  (T20 task 7). Candidate terms live on the site until imported (D-003), so the
  app glossary stays a mirror of the canonical site. No app schema change — a
  workflow + content-pipeline change.

# Monetization — Coffee Brew & Tasting Log

Status: strategy locked (D-017, D-024, D-025); execution details below.
Two items are *proposed* and pending your sign-off: the lead paid object (D-026)
and the starting price (D-027). Everything else here is settled.

## 1. The one-line model
Free magnet (coffee-dictionary.com + owned sites) → free app (unlimited
logging) → paid app features ("ask the expert" + insight charts). Paid ads only
after the paid tier is live and converting.

## 2. What people pay for (the two paid features)
1. **Ask the coffee expert** (lead — D-026). Instant AI draft (flagged as AI) +
   a human answer from the app admin within 3 days (D-025). Private to the asker
   (D-022). Answers that stand alone become glossary terms (D-023).
2. **Insight charts** (upsell — T16b). "See why this cup improved": rating /
   method / bean over time + cellar roast-age.

## 3. Free vs paid
| Capability                  | Free              | Paid ($4.99/mo or $39/yr) |
|-----------------------------|-------------------|---------------------------|
| Brew logs                   | Unlimited         | Unlimited                 |
| Glossary (teaser + search)  | Full              | Full                      |
| Saved terms                 | Full              | Full                      |
| Expert asks                 | 1 (demo)          | 10 / month                |
| Insight charts              | Last 30 days      | Full history + cellar     |

No log cap on any tier (D-024). No glossary content is ever paywalled in-app
(D-002, D-013) — it links out to the free site.

## 4. Pricing (starting point — D-027)
$4.99/mo or $39/yr (~35% discount). Impulse-cheap, filters non-serious users,
funds the 3-day-SLA answers. Revisit at the first churn/price-sensitivity
signal.

## 5. Costs (per subscriber, small scale)
- RevenueCat: ~1% of revenue (+$0.99/mo past $2.5k/mo MTR).
- Supabase: free tier until real scale.
- LLM draft: ~$0.005 per ask (grok-4.6 ≈ $2/M in, $6/M out; ~500+500 tokens).
- **The real cost: the admin's 3-day-SLA time** (D-025). At 10 asks/mo/sub and
  ~5 min/answer, a subscriber costs ~50 min/month of your time. This — not
  compute — is the ceiling. Cap asks (D-024); raise price or tighten the SLA if
  it saturates.

## 6. Sequencing (distribution → validate → monetize → ads)
1. **Wire the free funnel (T21).** coffee-dictionary.com + the brew*coffee.com
   sites already rank. Add an app-install CTA on article pages, tag link-out
   taps (attribution), and add the post-3-logs "Read the full article on [term]"
   nudge. Metric: % of activated users who open ≥1 source_url in 7 days.
2. **Ship the backbone.** T18 (your terms) + T9 (cellar/freshness) — the insight
   and retention spine.
3. **Instrument.** T6b (D7-retention query) + anonymous→account identity
   stitching.
4. **Validate the gate.** activation ≥25% AND D7 ≥20% (D-016). No paid build
   until this passes.
5. **Monetize.** T16 (freemium + RevenueCat), T16b (charts), T20 (expert asks).
6. **Then paid ads.** FB/Google only after step 5 is live and converting —
   otherwise you're paying to acquire users you can't monetize.

## 7. Metrics
- Gate (pre-monetization): activation ≥25%, D7 ≥20%.
- Funnel: site → install → sign-up → activation; source_url opens / 7 days.
- Post-launch: free→paid conversion, monthly churn, ARPU, LTV/CAC.

## 8. Distribution channels (owned → earned → paid)
1. **Owned sites** (coffee-dictionary.com + brew*coffee.com network) — free,
   already ranking, the primary channel.
2. **Earned** — r/coffee + other communities via a share-to-Reddit button
   (manual posting, no bot, no API — §9); word of mouth.
3. **Paid** (FB/Google) — last, only after monetization is live.

## 9. r/coffee — integration decision (2026-08-14)
- **Not** an API integration. Reddit's free API is non-commercial only (manual
  approval, 100 QPM), commercial use needs a paid contract ($0.24/1k calls);
  and r/Coffee's self-promotion rules ban automated posting — a bot would be
  banned quickly.
- **Yes** to a lightweight "share to Reddit" bridge: a button that pre-fills a
  genuinely useful post (brew recipe, question, insight) and hands off to the
  user to post manually. Free, no API, respects the community, and doubles as
  the FB/Twitter share path later.

## 10. Not ready until (the honest gap)
The strategy and pricing are here, but monetization **cannot ship** until:
- T18 + T9 are built (the insight/retention backbone).
- The gate passes with real users (activation ≥25%, D7 ≥20%) — which requires
  distribution first (T21 + getting the first ~100 real users).

So "ready" = strategy yes, launch no. The next actionable step is T21 (wire the
funnel), not T16.

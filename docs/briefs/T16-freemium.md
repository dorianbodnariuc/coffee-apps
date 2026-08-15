# T16 — Freemium: insight + expert asks *(Phase 3, gated)*

Goal: capability freemium — paid = insight + expert access; free = unlimited
logging. No content paywall, no log cap (D-024, D-017). Price D-027
($4.99/mo or $39/yr).

## Context (read first)
- D-024 (site free = magnet; app monetizes features), D-027 (pricing + ask cap
  1 free / 10 paid), D-026 (expert asks lead; charts upsell).
- Gate: activation ≥25% AND D7 ≥20% (plan §6). This ticket is a spec until the
  gate passes.
- `profiles` table: id, display_name, created_at. Charts = T16b; expert asks = T20.

## Task 1 — RevenueCat + entitlements
- `react-native-purchases`: `appUserID` = Supabase user id; offerings for the
  monthly/annual products (D-027). Restore purchases (Apple 3.1.1).
- CustomerInfo caching + offline grace (paid features work offline briefly).

## Task 2 — Entitlement sync (server-side truth)
- Add `profiles.entitlement text not null default 'free'`.
- RevenueCat webhook → Supabase Edge Function → upsert `profiles.entitlement`
  ('free' | 'pro'). Server-side enforcement: an RPC/trigger rejects paid-feature
  writes when `entitlement != 'pro'` — never client-only.

## Task 3 — Paid feature gating
- Free: unlimited logs + teaser glossary + search + saved terms + 1 expert ask +
  last-30-day charts.
- Pro: 10 expert asks/month + full-history charts + cellar view.
- Ask quota enforced server-side, resets monthly. Logging has NO cap on any tier.

## Task 4 — Prerequisite
Move QA off Expo Go to an EAS dev client (`react-native-purchases` needs native
code). Document the dev-client workflow in CONVENTIONS.md.

## Acceptance criteria
- Entitlements survive reinstall (restore works); no glossary/origin content ever
  paywalled.
- Logging has no cap on any tier.
- Paid features enforced server-side (client bypass rejected).
- Ask quota resets monthly and is enforced server-side.

## Verification
EAS dev client build; sandbox purchase + restore; DB test that a 'free' user's
paid-feature write is rejected.

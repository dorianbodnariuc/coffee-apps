# T16b — Flavor-trend charts (the paid "insight" feature) *(Phase 3, gated)*

Goal: the charts the paid tier actually sells — brew-over-time trends + cellar
roast-age. "See why this cup improved." (D-024, D-026.)

## Context (read first)
- Data is in `brew_logs` (+ T23 columns: grinder, yield_g, water_temp_c,
  method_params). D-028: charts MUST filter by method/measures — cross-method
  "average ratio/water/yield" is meaningless.
- Gate: activation ≥25% AND D7 ≥20%. Depends on T16 (entitlement) for the
  free/pro split.

## Task 1 — Chart library
`npx expo install` a chart lib (victory-native or react-native-gifted-charts).
Works in an EAS dev client (not Expo Go).

## Task 2 — Data spec (method-aware)
Aggregates over `brew_logs` (all filtered by method):
- rating over time (line)
- dose / yield / water over time (per-method; espresso uses yield)
- method distribution (bar/pie)
- bean/origin frequency (bar)
- cellar roast-age (from `beans.roast_date`)

## Task 3 — UI + free/pro split
- "Trends" surface (reuse the history summary pattern). Empty state for <N logs.
- Free = last 30 days + rating average; Pro = full history + method/bean
  breakdowns (D-027). Offline: degrade to "log more brews", never crash.

## Acceptance criteria
- Charts render from seeded data; empty state for <N logs.
- Free/pro split explicit and implemented (gated by T16 entitlement).
- Charts filter by method (no cross-method ratio/water averages).

## Verification
Seeded-data snapshot tests; on-device with a dev-client build.

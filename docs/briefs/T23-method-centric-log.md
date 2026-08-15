# T23 — Method-centric brew log (builder brief)

Goal: make the log revolve around the brew method with precise, method-specific
parameters so a shared log is fully replicable. Decision D-028.

## Context (read first)
- Current model (read `src/lib/brew-log-schema.ts`, `src/constants/index.ts`,
  `supabase/migrations/20260810_201500_init.sql`): generic dose/water/time, free
  text `grind_size`, ratio = water/dose (wrong for espresso).
- D-028: method is the recipe spine, not the product spine. Bean/rating/notes stay
  first-class. Only `method` is required. Signature fields (dose + water/yield +
  grinder+setting) are soft-shown; everything else collapses under "Recipe
  details". Moka-pot is water_in (not yield). Share = 3-line recipe card.
- `GlossaryTerm` matching (T18) and charts (T16b) must filter by method/measures.

## Task 1 — METHOD_SPECS registry (`src/constants/method-specs.ts`)
Typed registry; the single source of truth for method fields. Extend
`BREW_METHODS` in `src/constants/index.ts` with `moka-pot` + `drip-machine`.

```ts
export type ParamSpec =
  | { kind: "number"; unit: string; step?: number; min?: number; max?: number }
  | { kind: "text"; maxLength?: number }
  | { kind: "enum"; options: readonly string[] };

export type MethodParam = { key: string; label: string; spec: ParamSpec };

export type MethodSpec = {
  label: string;
  measures: "water_in" | "yield_out";
  params: MethodParam[]; // collapsed "Recipe details" block
};

export const METHOD_SPECS: Record<BrewMethod, MethodSpec> = { /* seed below */ };
```

Seed (params only — dose/water/yield/time/grinder/grind_size are columns):

- espresso (yield_out): basket_size_g {number,g}, machine {text},
  pressure_bar {number,bar,step 0.5}, pre_infusion_s {number,s}
- pour-over (water_in): dripper {enum V60|Kalita Wave|Chemex|Melitta|Clever|Other},
  filter {enum paper|metal|cloth}, bloom_g {number,g}, bloom_s {number,s},
  pours {number}
- aeropress (water_in): orientation {enum standard|inverted},
  filter {enum paper|metal}, press_s {number,s}
- french-press (water_in): (no params)
- cold-brew (water_in): immersion_h {number,h,step 0.5}, filter {enum paper|metal|cloth}
- moka-pot (water_in): (no params)
- drip-machine (water_in): machine {text}, filter {enum paper|metal}
- other (water_in): method_name {text,max 60}

## Task 2 — Migration (`supabase/migrations/20260825_method_params.sql`)
One transaction. Test against a row-bearing copy first (ratio rework rewrites the
table).

```sql
alter table public.brew_logs
  add column grinder text,
  add column yield_g numeric,
  add column water_temp_c numeric(4,1) check (water_temp_c between 0 and 100),
  add column method_params jsonb not null default '{}'::jsonb;

-- backfill: the old "water" field for espresso held the shot output
update public.brew_logs set yield_g = water_g where method = 'espresso';

alter table public.brew_logs drop column ratio;
alter table public.brew_logs add column ratio numeric generated always as (
  case
    when dose_g > 0 and method = 'espresso' then yield_g / dose_g
    when dose_g > 0 then water_g / dose_g
    else null
  end
) stored;
```

No GIN index on method_params (owner-scoped queries are covered by
`brew_logs_user_brewed_idx`). No DB CHECK on `method` (registry stays
migration-free; RLS limits writes to the owner).

## Task 3 — Schema validation (`src/lib/brew-log-schema.ts`)
Add `grinder` (max 120), `yieldG` (number ≥0 nullable), `waterTempC`
(0–100 nullable), `methodParams` (Record<string, unknown>). Via `.superRefine`,
validate `methodParams` against `METHOD_SPECS[method].params`: reject unknown
keys, reject numbers out of min/max, reject enums not in options. `other` uses a
strict fallback (only `method_name` allowed). Keys are append-only.

## Task 4 — Form (`src/components/brew-log-form.tsx`)
- Order: Bean section, then "Method & recipe" (method chip first), then the
  method's dynamic fields, then Ratio, then Tasting. Keep bean + rating + notes
  first-class (do not bury them).
- On method select: render the method's collapsed params from `METHOD_SPECS`
  (enum → `ChipSelect`, number → numeric input with unit suffix, text → input).
- Grinder + grind_size as adjacent paired fields. Espresso shows "Yield (g)";
  every other method shows "Water (g)". `brew_time_seconds` label = "Brew time".
- Only `method` required; every other field optional, never blocks Save.

## Task 5 — Ratio calculator (`src/components/ratio-calculator.tsx`)
Method-aware: espresso computes yield/dose, everything else water/dose. Keep the
"fill any two" behavior.

## Task 6 — Display + share
- History row/detail render structured params (e.g. "9 bar · 18 g basket · 28 s").
- Share emits a 3-line plaintext card, copied to clipboard + Reddit prefill:
  `line1: {method} · {bean_name} · {dose}:{water|yield} ({ratio})`
  `line2: {grinder} {grind_size} · {time}s · {1–2 signatures}`
  `line3: {rating}/5`
  Tasting notes are NOT included (personal).

## Acceptance criteria
- Selecting a method renders exactly that method's fields; switching keeps common
  fields and drops the previous method's params.
- Espresso 18 in / 36 out → ratio 2.0; pour-over 20 / 300 → 15.0; moka 20 / 150
  → 7.5 (water-in).
- "Eureka Mignon" + "12" round-trips and renders "12 on Eureka Mignon".
- Unknown key / out-of-range `method_params` rejected by zod.
- Existing espresso logs keep a non-NULL ratio after backfill; other existing
  logs render with NULL new columns + '{}' params — no data loss.
- Save never blocked by an unfilled optional field.

## Verification
`npm run typecheck`, `npm run lint`, `npm test`; `set -a && . ./.env && set +a &&
supabase db push --dry-run` then push; on-device: log one espresso + one pour-over.

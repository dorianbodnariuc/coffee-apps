/**
 * Shared app constants — the single source of truth for enums and thresholds.
 * Screens/components must import from here; no magic strings (plan v1.2, ticket T1).
 */

/** Brew methods shown in the log form (T23: moka-pot + drip-machine added). */
export const BREW_METHODS = [
  'pour-over',
  'espresso',
  'french-press',
  'aeropress',
  'cold-brew',
  'moka-pot',
  'drip-machine',
  'other',
] as const;
export type BrewMethod = (typeof BREW_METHODS)[number];

/** Rating scale: 1.0–5.0 in 0.5 steps (locked in plan v1.2). */
export const RATING_SCALE = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as const;
export type Rating = (typeof RATING_SCALE)[number];

/** Canonical formula: dose_g × ratio = water_g. Presets as g of water per g of coffee. */
export const RATIO_PRESETS = [15, 16, 17] as const;
export type RatioPreset = (typeof RATIO_PRESETS)[number];

/** Days since roast → freshness badge (P2 bean cellar; defined here P1 per plan). */
export const FRESHNESS_THRESHOLDS = {
  green: { min: 0, max: 14 },
  amber: { min: 15, max: 30 },
  red: { min: 31, max: Number.POSITIVE_INFINITY },
} as const;

/** Photo attachment caps (P2; recommended values from plan v1.2 review). */
export const PHOTO_CAPS = {
  maxPerLog: 3,
  maxBytes: 5 * 1024 * 1024, // 5 MB
} as const;

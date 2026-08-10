/**
 * Brew ratio math — pure functions, no I/O.
 *
 * Canonical formula (plan v1.2, src/constants): dose_g × ratio = water_g.
 * RATIO_PRESETS (1:15 / 1:16 / 1:17) live in src/constants and are not
 * re-declared here.
 *
 * All functions return `null` on invalid input instead of throwing, so callers
 * (form widgets) can render a blank/"—" state without try/catch. An input is
 * valid when it is a finite number > 0; zero is invalid everywhere except as
 * the dose in `calculateRatio`, where it would divide by zero (also null).
 */

/** Round to 1 decimal place (0.05 rounds up, e.g. 15.55 -> 15.6). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** True when the value is a finite number > 0. */
function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** ratio = water / dose. Never divides by zero: null when dose is missing or 0. */
export function calculateRatio(doseG: number, waterG: number): number | null {
  if (!isPositive(doseG) || !isPositive(waterG)) return null;
  return round1(waterG / doseG);
}

/** water = dose × ratio. */
export function waterFromDoseAndRatio(doseG: number, ratio: number): number | null {
  if (!isPositive(doseG) || !isPositive(ratio)) return null;
  return round1(doseG * ratio);
}

/** dose = water / ratio. */
export function doseFromWaterAndRatio(waterG: number, ratio: number): number | null {
  if (!isPositive(waterG) || !isPositive(ratio)) return null;
  return round1(waterG / ratio);
}

export type RatioInputs = {
  doseG?: number | null;
  waterG?: number | null;
  ratio?: number | null;
};

export type RatioSolution = {
  doseG: number;
  waterG: number;
  ratio: number;
  /** Which field was computed from the other two. */
  computed: 'doseG' | 'waterG' | 'ratio';
};

/**
 * Compute the third value from any two inputs ("fill any two, get the third").
 *
 * - Returns `null` when fewer than two valid inputs are present.
 * - Invalid inputs (non-finite, <= 0) are treated as absent.
 * - When all three are present the dose+ratio pair wins (deterministic);
 *   callers that want "exactly two" semantics should only pass two fields.
 * - Never divides by zero: ratio is only ever a divisor after a >0 check.
 */
export function solveRatio(inputs: RatioInputs): RatioSolution | null {
  const { doseG, waterG, ratio } = inputs;
  const validCount = [doseG, waterG, ratio].filter(isPositive).length;
  if (validCount < 2) return null;

  if (isPositive(doseG) && isPositive(ratio)) {
    const water = waterFromDoseAndRatio(doseG, ratio);
    if (water === null) return null;
    return { doseG, waterG: water, ratio, computed: 'waterG' };
  }
  if (isPositive(waterG) && isPositive(ratio)) {
    const dose = doseFromWaterAndRatio(waterG, ratio);
    if (dose === null) return null;
    return { doseG: dose, waterG, ratio, computed: 'doseG' };
  }
  if (isPositive(doseG) && isPositive(waterG)) {
    const computedRatio = calculateRatio(doseG, waterG);
    if (computedRatio === null) return null;
    return { doseG, waterG, ratio: computedRatio, computed: 'ratio' };
  }
  return null;
}

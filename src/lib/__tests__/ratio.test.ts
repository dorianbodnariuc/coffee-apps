import { describe, expect, it } from "vitest";

import {
  calculateRatio,
  doseFromWaterAndRatio,
  solveRatio,
  waterFromDoseAndRatio,
} from "../ratio";

describe("calculateRatio (ratio = water / dose)", () => {
  it("computes the canonical example: 20g / 300ml = 15.0", () => {
    expect(calculateRatio(20, 300)).toBe(15.0);
  });

  it("rounds to 1 decimal place", () => {
    expect(calculateRatio(20, 311)).toBe(15.6); // 15.55 -> 15.6
    expect(calculateRatio(20, 299)).toBe(15.0); // 14.95 -> 15.0
  });

  it("returns null when dose is 0 (never divides by zero)", () => {
    expect(calculateRatio(0, 300)).toBeNull();
  });

  it("returns null for negative or non-finite inputs", () => {
    expect(calculateRatio(-20, 300)).toBeNull();
    expect(calculateRatio(20, -300)).toBeNull();
    expect(calculateRatio(Number.NaN, 300)).toBeNull();
    expect(calculateRatio(20, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("waterFromDoseAndRatio (water = dose × ratio)", () => {
  it("computes the canonical example: 20g × 15 = 300ml", () => {
    expect(waterFromDoseAndRatio(20, 15)).toBe(300);
  });

  it("rounds to 1 decimal place", () => {
    expect(waterFromDoseAndRatio(20, 15.5)).toBe(310);
    expect(waterFromDoseAndRatio(1, 15)).toBe(15);
  });

  it("returns null for invalid inputs (zero, negative, non-finite)", () => {
    expect(waterFromDoseAndRatio(0, 15)).toBeNull();
    expect(waterFromDoseAndRatio(20, 0)).toBeNull();
    expect(waterFromDoseAndRatio(-20, 15)).toBeNull();
    expect(waterFromDoseAndRatio(20, Number.NaN)).toBeNull();
  });
});

describe("doseFromWaterAndRatio (dose = water / ratio)", () => {
  it("computes the canonical example: 300ml / 15 = 20g", () => {
    expect(doseFromWaterAndRatio(300, 15)).toBe(20);
  });

  it("rounds to 1 decimal place", () => {
    expect(doseFromWaterAndRatio(311, 15.5)).toBe(20.1); // 20.0645... -> 20.1
  });

  it("returns null for invalid inputs (zero ratio would divide by zero)", () => {
    expect(doseFromWaterAndRatio(300, 0)).toBeNull();
    expect(doseFromWaterAndRatio(0, 15)).toBeNull();
    expect(doseFromWaterAndRatio(300, -15)).toBeNull();
  });
});

describe("solveRatio (fill any two, compute the third)", () => {
  it("computes water from dose + ratio", () => {
    expect(solveRatio({ doseG: 20, ratio: 15 })).toEqual({
      doseG: 20,
      waterG: 300,
      ratio: 15,
      computed: "waterG",
    });
  });

  it("computes dose from water + ratio", () => {
    expect(solveRatio({ waterG: 300, ratio: 15 })).toEqual({
      doseG: 20,
      waterG: 300,
      ratio: 15,
      computed: "doseG",
    });
  });

  it("computes ratio from dose + water", () => {
    expect(solveRatio({ doseG: 20, waterG: 300 })).toEqual({
      doseG: 20,
      waterG: 300,
      ratio: 15,
      computed: "ratio",
    });
  });

  it("returns null with fewer than two inputs", () => {
    expect(solveRatio({})).toBeNull();
    expect(solveRatio({ doseG: 20 })).toBeNull();
    expect(solveRatio({ doseG: 20, ratio: null })).toBeNull();
  });

  it("returns null when a needed input is zero or negative", () => {
    expect(solveRatio({ doseG: 0, waterG: 300 })).toBeNull();
    expect(solveRatio({ doseG: -20, waterG: 300 })).toBeNull();
    expect(solveRatio({ doseG: 20, waterG: -300 })).toBeNull();
  });

  it("treats null/undefined fields as absent", () => {
    expect(solveRatio({ doseG: 20, waterG: null, ratio: 15 })).toEqual({
      doseG: 20,
      waterG: 300,
      ratio: 15,
      computed: "waterG",
    });
  });

  it("is deterministic when all three are present (dose+ratio pair wins)", () => {
    expect(solveRatio({ doseG: 20, waterG: 300, ratio: 15 })).toEqual({
      doseG: 20,
      waterG: 300,
      ratio: 15,
      computed: "waterG",
    });
  });
});

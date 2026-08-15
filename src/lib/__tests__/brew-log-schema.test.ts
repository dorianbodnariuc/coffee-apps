import { describe, expect, it } from "vitest";

import { brewLogSchema, type BrewLogInput } from "../brew-log-schema";

const validLog: BrewLogInput = {
  brewedAt: "2026-08-10T07:30:00.000Z",
  beanName: "Yirgacheffe",
  roaster: "Local Roasters",
  origin: "Ethiopia",
  method: "pour-over",
  grinder: "Eureka Mignon",
  grindSize: "12",
  doseG: 20,
  waterG: 300,
  yieldG: null,
  waterTempC: 93,
  brewTimeSeconds: 150,
  tastingNotes: "Floral, tea-like.",
  rating: 4.5,
  methodParams: { dripper: "V60", pours: 2 },
};

describe("brewLogSchema — valid input", () => {
  it("accepts a complete log", () => {
    const result = brewLogSchema.safeParse(validLog);
    expect(result.success).toBe(true);
  });

  it("accepts dose 0 with blank water (DB inserts with NULL ratio)", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      doseG: 0,
      waterG: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts blank dose/water entirely", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      doseG: null,
      waterG: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an unrated log (rating null)", () => {
    const result = brewLogSchema.safeParse({ ...validLog, rating: null });
    expect(result.success).toBe(true);
  });
});

describe("brewLogSchema — validation blocks (T3 acceptance)", () => {
  it("blocks negative dose", () => {
    const result = brewLogSchema.safeParse({ ...validLog, doseG: -1 });
    expect(result.success).toBe(false);
  });

  it("blocks negative water", () => {
    const result = brewLogSchema.safeParse({ ...validLog, waterG: -300 });
    expect(result.success).toBe(false);
  });

  it("blocks negative yield", () => {
    const result = brewLogSchema.safeParse({ ...validLog, yieldG: -1 });
    expect(result.success).toBe(false);
  });

  it("blocks rating outside 1–5 / 0.5 steps", () => {
    expect(brewLogSchema.safeParse({ ...validLog, rating: 3.2 }).success).toBe(
      false,
    );
    expect(brewLogSchema.safeParse({ ...validLog, rating: 5.5 }).success).toBe(
      false,
    );
    expect(brewLogSchema.safeParse({ ...validLog, rating: 0 }).success).toBe(
      false,
    );
  });

  it("accepts rating exactly on the 0.5-step scale", () => {
    expect(brewLogSchema.safeParse({ ...validLog, rating: 1 }).success).toBe(
      true,
    );
    expect(brewLogSchema.safeParse({ ...validLog, rating: 3.5 }).success).toBe(
      true,
    );
    expect(brewLogSchema.safeParse({ ...validLog, rating: 5 }).success).toBe(
      true,
    );
  });

  it("blocks an empty method", () => {
    const result = brewLogSchema.safeParse({ ...validLog, method: "" });
    expect(result.success).toBe(false);
  });

  it("blocks an invalid date", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      brewedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("blocks negative brew time and fractional seconds", () => {
    expect(
      brewLogSchema.safeParse({ ...validLog, brewTimeSeconds: -5 }).success,
    ).toBe(false);
    expect(
      brewLogSchema.safeParse({ ...validLog, brewTimeSeconds: 2.5 }).success,
    ).toBe(false);
  });

  it("blocks over-long notes", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      tastingNotes: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("reports a human-readable message for the first failing field", () => {
    const result = brewLogSchema.safeParse({ ...validLog, method: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === "Choose a brew method",
        ),
      ).toBe(true);
    }
  });
});

describe("brewLogSchema — method-specific params (T23)", () => {
  it("accepts valid method params for the method", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      methodParams: { dripper: "V60", bloom_g: 60 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown param key for the method", () => {
    // basket_size_g is an espresso param, not pour-over
    const result = brewLogSchema.safeParse({
      ...validLog,
      methodParams: { basket_size_g: 18 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range number param", () => {
    // pours has max 10
    const result = brewLogSchema.safeParse({
      ...validLog,
      methodParams: { pours: 20 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid enum param", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      methodParams: { dripper: "Origami" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts espresso with yield and no water", () => {
    const result = brewLogSchema.safeParse({
      ...validLog,
      method: "espresso",
      waterG: null,
      yieldG: 36,
      methodParams: { pressure_bar: 9 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects water temp above 100", () => {
    const result = brewLogSchema.safeParse({ ...validLog, waterTempC: 101 });
    expect(result.success).toBe(false);
  });
});

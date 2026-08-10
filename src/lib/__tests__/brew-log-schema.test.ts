import { describe, expect, it } from "vitest";

import { brewLogSchema, type BrewLogInput } from "../brew-log-schema";

const validLog: BrewLogInput = {
  brewedAt: "2026-08-10T07:30:00.000Z",
  beanName: "Yirgacheffe",
  roaster: "Local Roasters",
  origin: "Ethiopia",
  method: "pour-over",
  grindSize: "medium-fine",
  doseG: 20,
  waterG: 300,
  brewTimeSeconds: 150,
  tastingNotes: "Floral, tea-like.",
  rating: 4.5,
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

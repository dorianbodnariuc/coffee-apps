import { describe, expect, it } from "vitest";

import {
  computeHistoryStats,
  computeStreak,
  filterBrews,
} from "../history-stats";
import type { BrewLog } from "../../types/brew-log";

const DAY = 86_400_000;

function brew(overrides: Partial<BrewLog> & { brewedAt: string }): BrewLog {
  return {
    id: `id-${Math.random()}`,
    beanName: "",
    roaster: "",
    origin: "",
    method: "pour-over",
    grinder: "",
    grindSize: "",
    doseG: null,
    waterG: null,
    yieldG: null,
    waterTempC: null,
    methodParams: {},
    ratio: null,
    beanId: null,
    brewTimeSeconds: null,
    tastingNotes: "",
    rating: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY).toISOString();

describe("filterBrews", () => {
  const sample = [
    brew({ brewedAt: daysAgo(0), method: "pour-over", rating: 4.5 }),
    brew({ brewedAt: daysAgo(1), method: "espresso", rating: 5 }),
    brew({ brewedAt: daysAgo(8), method: "french-press", rating: 3.5 }),
  ];

  it("method filter returns only matching rows", () => {
    const result = filterBrews(sample, {
      method: "espresso",
      rating: null,
      sinceDays: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe("espresso");
  });

  it("rating filter matches 0.5-step values exactly", () => {
    const result = filterBrews(sample, {
      method: null,
      rating: 4.5,
      sinceDays: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(4.5);
  });

  it("date range is inclusive on the lower bound", () => {
    const result = filterBrews(sample, {
      method: null,
      rating: null,
      sinceDays: 7,
    });
    expect(result.map((b) => b.method).sort()).toEqual([
      "espresso",
      "pour-over",
    ]);
  });

  it("no filters returns everything", () => {
    const result = filterBrews(sample, {
      method: null,
      rating: null,
      sinceDays: null,
    });
    expect(result).toHaveLength(3);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      computeStreak([
        brew({ brewedAt: daysAgo(0) }),
        brew({ brewedAt: daysAgo(1) }),
        brew({ brewedAt: daysAgo(2) }),
      ]),
    ).toBe(3);
  });

  it("breaks the streak on a gap", () => {
    expect(
      computeStreak([
        brew({ brewedAt: daysAgo(0) }),
        brew({ brewedAt: daysAgo(1) }),
        brew({ brewedAt: daysAgo(3) }),
      ]),
    ).toBe(2);
  });

  it("counts from yesterday when nothing was brewed today", () => {
    expect(
      computeStreak([
        brew({ brewedAt: daysAgo(1) }),
        brew({ brewedAt: daysAgo(2) }),
      ]),
    ).toBe(2);
  });

  it("returns 0 for no brews", () => {
    expect(computeStreak([])).toBe(0);
  });
});

describe("computeHistoryStats", () => {
  it("counts and averages non-null ratings (1 decimal)", () => {
    const stats = computeHistoryStats([
      brew({ brewedAt: daysAgo(0), rating: 4 }),
      brew({ brewedAt: daysAgo(1), rating: 5 }),
      brew({ brewedAt: daysAgo(2), rating: null }),
    ]);
    expect(stats.count).toBe(3);
    expect(stats.avgRating).toBe(4.5);
  });

  it("avgRating is null when nothing is rated", () => {
    const stats = computeHistoryStats([
      brew({ brewedAt: daysAgo(0), rating: null }),
    ]);
    expect(stats.avgRating).toBeNull();
  });
});

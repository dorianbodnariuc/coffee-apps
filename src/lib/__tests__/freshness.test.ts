import { describe, expect, it } from "vitest";

import {
  daysSinceRoast,
  freshnessBadge,
  freshnessFor,
} from "../freshness";

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("freshnessFor — boundary days (T9 acceptance)", () => {
  it("0–14 is green", () => {
    expect(freshnessFor(0)).toBe("green");
    expect(freshnessFor(14)).toBe("green");
  });
  it("15–30 is amber", () => {
    expect(freshnessFor(15)).toBe("amber");
    expect(freshnessFor(30)).toBe("amber");
  });
  it("31+ is red", () => {
    expect(freshnessFor(31)).toBe("red");
    expect(freshnessFor(120)).toBe("red");
  });
});

describe("daysSinceRoast", () => {
  it("today is 0, past days count up", () => {
    expect(daysSinceRoast(dateDaysAgo(0))).toBe(0);
    expect(daysSinceRoast(dateDaysAgo(3))).toBe(3);
    expect(daysSinceRoast(dateDaysAgo(20))).toBe(20);
  });
  it("a future date clamps to 0", () => {
    expect(daysSinceRoast(dateDaysAgo(-5))).toBe(0);
  });
});

describe("freshnessBadge", () => {
  it("null roast date -> null", () => {
    expect(freshnessBadge(null)).toBeNull();
  });
  it("today -> green 'Today'", () => {
    expect(freshnessBadge(dateDaysAgo(0))).toEqual({
      level: "green",
      label: "Today",
    });
  });
  it("20 days -> amber '20d'", () => {
    expect(freshnessBadge(dateDaysAgo(20))).toEqual({
      level: "amber",
      label: "20d",
    });
  });
});

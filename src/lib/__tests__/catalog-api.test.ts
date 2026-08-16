import { describe, expect, it } from "vitest";

import { normalizeName } from "../catalog-api";

/**
 * normalizeName must stay byte-for-byte compatible with the DB generated
 * column `lower(trim(name))` — it is the dedup key (D-029). If these diverge,
 * getOrCreate* would insert duplicates that the unique index can't catch.
 */
describe("normalizeName", () => {
  it("lowercases and trims leading/trailing whitespace", () => {
    expect(normalizeName("Blue Bottle")).toBe("blue bottle");
    expect(normalizeName("  Yirgacheffe  ")).toBe("yirgacheffe");
    expect(normalizeName("YIRGACHEFFE")).toBe("yirgacheffe");
  });

  it("preserves internal whitespace (matches Postgres trim, no collapse)", () => {
    expect(normalizeName("Blue  Bottle")).toBe("blue  bottle");
  });

  it("handles empty/whitespace-only input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });
});

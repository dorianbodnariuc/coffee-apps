import { describe, expect, it } from "vitest";

import { searchGlossaryTerms, type GlossaryTerm } from "../glossary-search";

const term = (
  name: string,
  definition: string,
  extra: Partial<GlossaryTerm> = {},
): GlossaryTerm => ({
  term: name,
  category: "Test",
  definition,
  related_terms: [],
  ...extra,
});

const TERMS: GlossaryTerm[] = [
  term("Washed Process", "A fermentation method that removes mucilage."),
  term("French Press", "An immersion brewing device."),
  term("Crema", "The golden foam on espresso."),
  term("Acidity", "A bright, tangy taste descriptor."),
];

describe("searchGlossaryTerms (T11 acceptance)", () => {
  it("returns all terms for an empty query", () => {
    expect(searchGlossaryTerms(TERMS, "")).toHaveLength(TERMS.length);
    expect(searchGlossaryTerms(TERMS, "   ")).toHaveLength(TERMS.length);
  });

  it("matches the term case-insensitively", () => {
    const result = searchGlossaryTerms(TERMS, "french");
    expect(result.map((t) => t.term)).toEqual(["French Press"]);
    expect(searchGlossaryTerms(TERMS, "FRENCH")[0].term).toBe("French Press");
  });

  it("matches the definition case-insensitively", () => {
    const result = searchGlossaryTerms(TERMS, "fermentation");
    expect(result.map((t) => t.term)).toEqual(["Washed Process"]);
    expect(searchGlossaryTerms(TERMS, "ESPRESSO")[0].term).toBe("Crema");
  });

  it("matches on a substring of either field", () => {
    const result = searchGlossaryTerms(TERMS, "f");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.map((t) => t.term)).toContain("French Press");
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchGlossaryTerms(TERMS, "zzzz")).toEqual([]);
  });

  it("trims surrounding whitespace from the query", () => {
    expect(searchGlossaryTerms(TERMS, "  acidity ")[0].term).toBe("Acidity");
  });

  it("does not choke on regex-special characters", () => {
    expect(searchGlossaryTerms(TERMS, "a.c.i.d")).toEqual([]);
  });

  it("preserves the input order", () => {
    const result = searchGlossaryTerms(TERMS, "a");
    const indexes = result.map((t) => TERMS.indexOf(t));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});

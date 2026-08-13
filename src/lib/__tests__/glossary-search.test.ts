import { describe, expect, it } from "vitest";

import { searchGlossaryTerms } from "../glossary-search";
import type { GlossaryTerm } from "../glossary-match";

const term = (
  name: string,
  definition: string,
  extra: Partial<GlossaryTerm> = {},
): GlossaryTerm => ({
  term: name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  category: "Test",
  definition,
  related_terms: [],
  ...extra,
});

const TERMS: GlossaryTerm[] = [
  term("Washed Process", "A fermentation method that removes mucilage."),
  term("Pour Over", "A manual drip brewing technique.", {
    slug: "pour-over",
    related_terms: ["Chemex", "Hario V60"],
  }),
  term(
    "Coffee Brewing Temperature",
    "The ideal water temperature for extraction.",
    { slug: "water-temperature", category: "Brewing Methods" },
  ),
  term("Crema", "The golden foam on espresso."),
  term("Acidity", "A bright, tangy taste descriptor.", {
    category: "Flavor and Tasting",
    related_terms: ["Citric Acid"],
  }),
  term("Cappuccino", "Espresso with steamed milk and foam.", {
    slug: "cappuccino",
    related_terms: ["espresso", "steamed milk"],
    category: "Beverage",
  }),
];

describe("searchGlossaryTerms (T11 + T11b — alias-aware)", () => {
  it("returns all terms for an empty query", () => {
    expect(searchGlossaryTerms(TERMS, "")).toHaveLength(TERMS.length);
    expect(searchGlossaryTerms(TERMS, "   ")).toHaveLength(TERMS.length);
  });

  // ---- term / definition substring (existing behaviour) ----
  it("matches the term case-insensitively", () => {
    expect(searchGlossaryTerms(TERMS, "french")).toEqual([]);
    expect(searchGlossaryTerms(TERMS, "acidity")[0].term).toBe("Acidity");
  });

  it("matches the definition case-insensitively", () => {
    const r = searchGlossaryTerms(TERMS, "fermentation");
    expect(r.map((t) => t.term)).toEqual(["Washed Process"]);
    expect(searchGlossaryTerms(TERMS, "ESPRESSO")[0].term).toBe("Crema");
  });

  // ---- compact matching (spaces / punctuation don't matter) ----
  it("matches via compact form (pourover → Pour Over)", () => {
    const r = searchGlossaryTerms(TERMS, "pourover");
    expect(r.map((t) => t.term)).toContain("Pour Over");
  });

  it("compact match on a single-word term", () => {
      const r = searchGlossaryTerms(TERMS, "cappuccino");
      expect(r.map((t) => t.term)).toContain("Cappuccino");
    });

  // ---- slug matching ----
  it("matches via slug literal", () => {
    const r = searchGlossaryTerms(TERMS, "water-temperature");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
  });

  it("matches via slug compact (water temp → slug water-temperature)", () => {
    const r = searchGlossaryTerms(TERMS, "water temperature");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
    // term compact doesn't contain "watertemperature", but slug compact does
  });

  // ---- related terms ----
  it("matches via related term name", () => {
    // searching "steamed milk" should find CAppuccino
    const r = searchGlossaryTerms(TERMS, "steamed milk");
    expect(r.map((t) => t.term)).toContain("Cappuccino");
  });

  it("matches via related term compact", () => {
    const r = searchGlossaryTerms(TERMS, "steamedmilk");
    expect(r.map((t) => t.term)).toContain("Cappuccino");
  });

  // ---- category matching ----
  it("matches via category name", () => {
    const r = searchGlossaryTerms(TERMS, "flavor");
    expect(r.map((t) => t.term)).toContain("Acidity");
  });

  // ---- edge cases ----
  it("returns empty array when nothing matches", () => {
    expect(searchGlossaryTerms(TERMS, "zzzz")).toEqual([]);
  });

  it("trims surrounding whitespace from the query", () => {
    expect(searchGlossaryTerms(TERMS, "  acidity ")[0].term).toBe("Acidity");
  });

  it("preserves the input order", () => {
    const result = searchGlossaryTerms(TERMS, "e");
    const indexes = result.map((t) => TERMS.indexOf(t));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});

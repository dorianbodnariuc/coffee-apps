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
  source_url: "",
  ...extra,
});

const TERMS: GlossaryTerm[] = [
  term(
    "AA Coffee Grading",
    "A Kenyan/Indian classification for the largest coffee beans.",
    { slug: "aa-coffee-grading", category: "Quality & Grading" },
  ),
  term("Washed Process", "A fermentation method that removes mucilage."),
  term(
    "Camp Coffee",
    "A concentrated coffee essence; many pourover method guides reference it as an alternative.",
    {
      slug: "camp-coffee",
      category: "Coffee Culture",
      related_terms: ["Pour Over"],
    },
  ),
  term("Pour Over", "A manual drip brewing technique.", {
    slug: "pour-over",
    related_terms: ["Chemex", "Hario V60"],
    category: "Brewing Methods",
  }),
  term(
    "Coffee Brewing Temperature",
    "The ideal water temperature for coffee extraction, typically 90–96°C.",
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

describe("searchGlossaryTerms (T11c — word-level + relevance)", () => {
  // ── empty / edge cases ──
  it("returns all terms for an empty query", () => {
    expect(searchGlossaryTerms(TERMS, "")).toHaveLength(TERMS.length);
    expect(searchGlossaryTerms(TERMS, "   ")).toHaveLength(TERMS.length);
  });

  it("returns nothing for queries with only tiny words", () => {
    expect(searchGlossaryTerms(TERMS, "a")).toEqual([]);
    expect(searchGlossaryTerms(TERMS, "of the")).toEqual([]);
  });

  it("matches a 2-char query (AA → AA Coffee Grading)", () => {
    const r = searchGlossaryTerms(TERMS, "AA");
    expect(r.map((t) => t.term)).toContain("AA Coffee Grading");
  });

  // ── substring on term / definition (existing) ──
  it("matches the term case-insensitively", () => {
    const r = searchGlossaryTerms(TERMS, "acidity");
    expect(r[0].term).toBe("Acidity");
  });

  it("matches the definition case-insensitively", () => {
    expect(searchGlossaryTerms(TERMS, "fermentation")[0].term).toBe(
      "Washed Process",
    );
    expect(searchGlossaryTerms(TERMS, "ESPRESSO")[0].term).toBe("Crema");
  });

  // ── compact matching ──
  it("matches via compact form (pourover → Pour Over)", () => {
    const r = searchGlossaryTerms(TERMS, "pourover");
    expect(r.map((t) => t.term)).toContain("Pour Over");
  });

  // ── slug matching ──
  it("matches via slug literal", () => {
    const r = searchGlossaryTerms(TERMS, "water-temperature");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
  });

  it("matches via slug compact (water temp → slug water-temperature)", () => {
    const r = searchGlossaryTerms(TERMS, "water temperature");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
  });

  // ── related terms ──
  it("matches via related term name", () => {
    const r = searchGlossaryTerms(TERMS, "steamed milk");
    expect(r.map((t) => t.term)).toContain("Cappuccino");
  });

  it("matches via related term compact", () => {
    const r = searchGlossaryTerms(TERMS, "steamedmilk");
    expect(r.map((t) => t.term)).toContain("Cappuccino");
  });

  // ── category ──
  it("matches via category name", () => {
    const r = searchGlossaryTerms(TERMS, "flavor");
    expect(r.map((t) => t.term)).toContain("Acidity");
  });

  // ── T11c: multi-word AND ──
  it("ANDs query words in term+definition (brew temperature → Brewing Temperature)", () => {
    const r = searchGlossaryTerms(TERMS, "brew temperature");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
  });

  it("ANDs across term and definition (espresso golden → Crema)", () => {
    const r = searchGlossaryTerms(TERMS, "espresso golden");
    expect(r.map((t) => t.term)).toContain("Crema");
  });

  // ── T11c: word-prefix ──
  it("matches brew as a prefix of brewing", () => {
    const r = searchGlossaryTerms(TERMS, "brew");
    expect(r.map((t) => t.term)).toContain("Coffee Brewing Temperature");
  });

  it("matches ferment as a prefix of fermentation", () => {
    const r = searchGlossaryTerms(TERMS, "ferment");
    expect(r.map((t) => t.term)).toContain("Washed Process");
  });

  // ── T11c: relevance scoring (order matters) ──
  it("ranks exact term match above definition-only match", () => {
    const r = searchGlossaryTerms(TERMS, "coffee");
    expect(r.length).toBeGreaterThanOrEqual(2);
    // Both "Coffee Brewing Temperature" and "AA Coffee Grading" have "coffee"
    // in their term — both score 10, sorted alphabetically (AA first).
    expect(r[0].term).toBe("AA Coffee Grading");
  });

  it("ranks all-words match above definition-only match", () => {
    // "brewing" appears in "Coffee Brewing Temperature" term (exact term, score 10)
    // vs "Brewing Methods" category only (score 3) for Pour Over
    const r = searchGlossaryTerms(TERMS, "brewing");
    expect(r.length).toBe(2);
    expect(r[0].term).toBe("Coffee Brewing Temperature");
    expect(r[1].term).toBe("Pour Over");
  });

  it("ranks a compact term-name match above a definition mention (pourover → Pour Over, not Camp Coffee)", () => {
    // "Camp Coffee"'s definition literally contains "pourover" (as the real
    // dataset's reference lists do), but "Pour Over" IS the term — its compact
    // name match must outrank a mere definition mention.
    const r = searchGlossaryTerms(TERMS, "pourover");
    expect(r[0].term).toBe("Pour Over");
    expect(r.map((t) => t.term)).toContain("Camp Coffee");
  });

  // ── regression / edge ──
  it("returns empty when nothing matches", () => {
    expect(searchGlossaryTerms(TERMS, "zzzz")).toEqual([]);
  });

  it("trims surrounding whitespace from the query", () => {
    expect(searchGlossaryTerms(TERMS, "  acidity ")[0].term).toBe("Acidity");
  });

  it("preserves input order when scores are tied", () => {
    // "a" won't work (too short), use a query that hits multiple terms equally
    const r = searchGlossaryTerms(TERMS, "coffee");
    const cbtIdx = r.findIndex((t) => t.term === "Coffee Brewing Temperature");
    const aaIdx = r.findIndex((t) => t.term === "AA Coffee Grading");
    // Both score 10 (exact term) — alphabetical order: AA < Coffee
    expect(aaIdx).toBeLessThan(cbtIdx);
  });
});

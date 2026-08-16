import { describe, expect, it } from "vitest";

import { matchOriginTerm } from "../origin-match";
import type { GlossaryTerm } from "../glossary-match";
import type { Origin } from "@/types/catalog";

function term(
  term: string,
  category: string,
  categories: string[] = [category],
): GlossaryTerm {
  return {
    id: term,
    term,
    slug: term.toLowerCase().replace(/\s+/g, "-"),
    category,
    categories,
    definition: `Definition of ${term}.`,
    related_terms: [],
    source_url: `https://coffee-dictionary.com/${term}`,
  };
}

const TERMS: GlossaryTerm[] = [
  term("Ethiopia", "Coffee Origins"),
  term("Single Origin", "Coffee Origins"),
  term("Mocha", "Coffee Origins"),
  term("Washed Process", "Processing", ["Processing"]),
  term("coffee", "General"),
];

const ORIGINS: Origin[] = [
  { id: "o1", name: "Yirgacheffe", country: "Ethiopia", region: "Yirgacheffe", createdAt: "" },
  { id: "o2", name: "Ethiopia", country: "Ethiopia", region: null, createdAt: "" },
  { id: "o3", name: "Huila", country: "Colombia", region: "Huila", createdAt: "" },
  { id: "o4", name: "Colombia", country: "Colombia", region: null, createdAt: "" },
];

describe("matchOriginTerm", () => {
  it("matches a country+region origin directly to the country term", () => {
    const result = matchOriginTerm("Ethiopia Yirgacheffe", TERMS, ORIGINS);
    expect(result?.term.term).toBe("Ethiopia");
    expect(result?.origin?.region).toBe("Yirgacheffe");
  });

  it("resolves a region-only origin to its country via the catalog", () => {
    const result = matchOriginTerm("Yirgacheffe", TERMS, ORIGINS);
    expect(result?.term.term).toBe("Ethiopia");
    expect(result?.origin?.country).toBe("Ethiopia");
  });

  it("returns null when neither the text nor its country is a glossary term", () => {
    const result = matchOriginTerm("Colombia Huila", TERMS, ORIGINS);
    expect(result).toBeNull();
  });

  it("returns null for empty/whitespace origin", () => {
    expect(matchOriginTerm("", TERMS, ORIGINS)).toBeNull();
    expect(matchOriginTerm("   ", TERMS, ORIGINS)).toBeNull();
  });
});

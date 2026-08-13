import { describe, expect, it } from "vitest";

import { matchGlossaryTerms, type GlossaryTerm } from "../glossary-match";

const term = (
  name: string,
  extra: Partial<GlossaryTerm> = {},
): GlossaryTerm => ({
  term: name,
  slug: name.toLowerCase(),
  category: "Test",
  categories: ["Test"],
  definition: `Definition of ${name}.`,
  related_terms: [],
  source_url: "",
  ...extra,
});

const TERMS: GlossaryTerm[] = [
  term("Washed Process"),
  term("French Press"),
  term("Crema"),
  term("Acidity"),
  term("Honey Process"),
];

describe("matchGlossaryTerms (T7 acceptance)", () => {
  it("matches the full term case-insensitively", () => {
    const result = matchGlossaryTerms("ETHIOPIA WASHED PROCESS", TERMS);
    expect(result.map((t) => t.term)).toContain("Washed Process");
  });

  it("matches a multi-word term via its first word (washed -> Washed Process)", () => {
    const result = matchGlossaryTerms("ETHIOPIA washed", TERMS);
    expect(result.map((t) => t.term)).toEqual(["Washed Process"]);
  });

  it('does NOT match "washed" inside "dishwasher" (word boundary)', () => {
    expect(matchGlossaryTerms("I cleaned the dishwasher", TERMS)).toEqual([]);
  });

  it('does NOT match "crema" inside "crematorium" (word boundary)', () => {
    expect(matchGlossaryTerms("visited the crematorium", TERMS)).toEqual([]);
  });

  it("matches a full phrase with a space", () => {
    const result = matchGlossaryTerms(
      "made coffee in my French Press today",
      TERMS,
    );
    expect(result.map((t) => t.term)).toEqual(["French Press"]);
  });

  it("matches multiple distinct terms in one note", () => {
    const result = matchGlossaryTerms(
      "bright acidity with a thick crema",
      TERMS,
    );
    expect(result.map((t) => t.term).sort()).toEqual(["Acidity", "Crema"]);
  });

  it("dedupes when both the full term and its first word appear", () => {
    const result = matchGlossaryTerms(
      "washed process beans, very washed",
      TERMS,
    );
    expect(result.filter((t) => t.term === "Washed Process")).toHaveLength(1);
  });

  it("returns [] for unknown notes (silent no-match fallback)", () => {
    expect(
      matchGlossaryTerms("floral, tea-like, jasmine notes", TERMS),
    ).toEqual([]);
    expect(matchGlossaryTerms("", TERMS)).toEqual([]);
  });
});

/** A glossary term as stored in glossary_terms (T7/T11). */
export type GlossaryTerm = {
  term: string;
  slug: string;
  category: string | null;
  definition: string;
  related_terms: string[];
  source_url: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary, case-insensitive glossary matching (ticket T7).
 *
 * A term matches when:
 *  - the FULL term appears in the notes (word-boundary, any case), or
 *  - a multi-word term's FIRST word (>= 4 chars) appears, so "washed" in
 *    notes surfaces the "Washed Process" term.
 *
 * Word boundaries keep partial-word matches out: "wash" never matches inside
 * "dishwasher", "crema" never matches inside "crematorium". Unknown notes
 * simply yield no matches (defined no-match fallback).
 */
export function matchGlossaryTerms(
  notes: string,
  terms: GlossaryTerm[],
): GlossaryTerm[] {
  const matched: GlossaryTerm[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const firstWord = term.term.split(/\s+/)[0];
    const patterns = [term.term];
    if (term.term.includes(" ") && firstWord.length >= 4) {
      patterns.push(firstWord);
    }
    const hit = patterns.some((pattern) =>
      new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i").test(notes),
    );
    if (hit && !seen.has(term.term)) {
      seen.add(term.term);
      matched.push(term);
    }
  }

  return matched;
}

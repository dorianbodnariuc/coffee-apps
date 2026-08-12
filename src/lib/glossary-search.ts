import type { GlossaryTerm } from "@/lib/glossary-match";

export type { GlossaryTerm } from "@/lib/glossary-match";

/**
 * Client-side glossary search (T11). Case-insensitive substring match on the
 * term name AND the definition. Empty/whitespace query returns everything.
 * Pure function — screen state decides what to render.
 */
export function searchGlossaryTerms(
  terms: GlossaryTerm[],
  query: string,
): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (q === "") return terms;
  return terms.filter(
    (entry) =>
      entry.term.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q),
  );
}

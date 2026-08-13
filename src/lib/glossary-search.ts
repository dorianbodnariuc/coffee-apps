import type { GlossaryTerm } from "@/lib/glossary-match";

export type { GlossaryTerm } from "@/lib/glossary-match";

/** Strip non-alphanumeric chars for spelling/punctuation-tolerant matching. */
const compact = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Alias-aware glossary search (T11 + T11b). Matches a query against multiple
 * targets so the dictionary feels "smart": compact spelling (pourover →
 * Pour Over), seed slugs (water temperature → Coffee Brewing Temperature
 * via slug "water-temperature"), cross-references via related_terms, and
 * category labels. Case-insensitive throughout.
 */
export function searchGlossaryTerms(
  terms: GlossaryTerm[],
  query: string,
): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (q === "") return terms;

  const qCompact = compact(q);
  if (qCompact === "") return terms;

  return terms.filter((entry) => {
    // Direct substring on term name or definition.
    if (
      entry.term.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q)
    )
      return true;

    // Compact: "pourover" → "Pour Over".
    if (compact(entry.term).includes(qCompact)) return true;

    // Slug: the seed slug (normalised URL path), both literal and compact.
    if (entry.slug) {
      const slugLower = entry.slug.toLowerCase();
      if (slugLower.includes(q) || compact(slugLower).includes(qCompact))
        return true;
    }

    // Category.
    if (entry.category && entry.category.toLowerCase().includes(q)) return true;

    // Related terms (cross-references resolved to canonical term names).
    if (
      entry.related_terms.some((ref) => {
        const r = ref.toLowerCase();
        return r.includes(q) || compact(r).includes(qCompact);
      })
    )
      return true;

    return false;
  });
}

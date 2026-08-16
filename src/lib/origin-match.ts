import { matchGlossaryTerms, type GlossaryTerm } from "@/lib/glossary-match";
import type { Origin } from "@/types/catalog";

/** The glossary category that marks origin reference content (T12). */
export const ORIGIN_CATEGORY = "Coffee Origins";

export type OriginCardMatch = {
  /** The best glossary term describing this origin. */
  term: GlossaryTerm;
  /** The resolved catalog entry (for a country/region sublabel), if any. */
  origin: Origin | null;
};

/**
 * Match a brew's origin text to a glossary term for the origin card (T12).
 *
 * Region-level origins ("Yirgacheffe") aren't glossary terms, so we resolve the
 * text against the origins catalog ("Yirgacheffe" → country "Ethiopia") and
 * match that country/region against the glossary. Terms in the "Coffee Origins"
 * category win; direct matches beat catalog resolution. Returns null when
 * nothing matches (defined no-match fallback).
 */
export function matchOriginTerm(
  origin: string,
  terms: GlossaryTerm[],
  origins: Origin[],
): OriginCardMatch | null {
  const text = origin.trim();
  if (!text) return null;

  const direct = matchGlossaryTerms(text, terms);

  const lower = text.toLowerCase();
  // Prefer region-specific entries (Yirgacheffe) over country-only (Ethiopia)
  // so the card's sublabel is the most specific identity.
  const resolved = origins
    .filter((o) => {
      const name = o.name.toLowerCase();
      return lower.includes(name) || name.includes(lower);
    })
    .sort((a, b) => (b.region ? 1 : 0) - (a.region ? 1 : 0));
  const viaCatalog = resolved.flatMap((o) =>
    matchGlossaryTerms(
      [o.country, o.region].filter(Boolean).join(" "),
      terms,
    ),
  );

  const all = [...direct, ...viaCatalog];
  const originTerms = all.filter((t) =>
    t.categories.includes(ORIGIN_CATEGORY),
  );
  const term = (originTerms.length > 0 ? originTerms : all)[0] ?? null;
  if (!term) return null;

  return { term, origin: resolved[0] ?? null };
}

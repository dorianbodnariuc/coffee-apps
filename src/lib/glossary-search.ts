import type { GlossaryTerm } from "@/lib/glossary-match";

export type { GlossaryTerm } from "@/lib/glossary-match";

/** Strip non-alphanumeric chars for spelling/punctuation-tolerant matching. */
const compact = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * How a match was made — used to score relevance so the best result floats to
 * the top. Higher-numbered kinds rank above lower ones.
 */
const Score = {
  EXACT_TERM: 10, // query is a substring of the term name
  ALL_WORDS: 9, // every word in the query appears in term+definition
  WORD_PREFIX: 8, // at least one query word is a prefix of a term word
  DEFINITION: 5, // query is a substring of the definition
  COMPACT: 9, // compact form matched the term NAME (spacing/punct-insensitive ≈ exact)
  SLUG: 4, // slug matched (literal or compact)
  CATEGORY: 3, // category label matched
  RELATED: 2, // a related-term name matched
} as const;

/** Whether every word in `words` is a substring of `haystack`. */
const everyWordIn = (words: string[], haystack: string): boolean => {
  const lower = haystack.toLowerCase();
  return words.every((w) => lower.includes(w));
};

/** Whether any word in `text` starts with `prefix` (stem-like matching). */
const anyWordStartsWith = (prefix: string, text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/);
  return words.some((w) => w.startsWith(prefix));
};

/**
 * Any query word is a prefix of a word in the term name.
 * "brew" is a prefix of "brewing", so "brew temperature" finds
 * "Coffee Brewing Temperature".
 */
const wordPrefixMatch = (queryWords: string[], term: string): boolean =>
  queryWords.some((w) => anyWordStartsWith(w, term));

// Strip query-length-only words before the AND check so a trailing short
// word doesn't block matches ("espresso a" should still match "Espresso").
const MIN_WORD_LEN = 2;

/**
 * Grammatical function words that should never drive a glossary match on
 * their own — and that otherwise cause substring false-positives (e.g. "of"
 * matching the "o-f" inside "coffee", or "the" matching "then"/"there").
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "for",
  "with",
  "to",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "than",
  "then",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "should",
]);

/**
 * Alias-aware glossary search (T11 / T11b / T11c). Matches against term,
 * definition, slug, category, and related terms using multiple strategies,
 * then scores the results so the most relevant match surfaces first.
 *
 * T11c additions (2026-08-16):
 *  - Multi-word AND match — "brew temperature" → "Brewing Temperature"
 *  - Word-prefix match — "brew" matches "brewing" as a prefix
 *  - Score-based relevance sorting — exact term > all-words > prefix > definition etc.
 *  - Stopword filtering — "of the" yields nothing (no substring false-positives)
 */
export function searchGlossaryTerms(
  terms: GlossaryTerm[],
  query: string,
): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (q === "") return terms;

  const qCompact = compact(q);
  if (qCompact === "") return terms;

  const queryWords = q
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w));

  // For queries that are only stopwords / tiny words / symbols, show nothing.
  if (queryWords.length === 0) return [];

  const scored: { term: GlossaryTerm; score: number }[] = [];

  for (let i = 0; i < terms.length; i++) {
    const entry = terms[i];
    let score = 0;

    // ── collect match evidence ──────────────────────────────────────
    const termLower = entry.term.toLowerCase();
    const defLower = entry.definition.toLowerCase();
    const haystack = `${termLower} ${defLower}`;

    // Exact term match: full query is a substring of the term name.
    if (termLower.includes(q)) {
      score = Score.EXACT_TERM;
    }

    // Multi-word AND: every query word appears somewhere in term+definition.
    if (queryWords.length > 1 && everyWordIn(queryWords, haystack)) {
      score = Math.max(score, Score.ALL_WORDS);
    }

    // Word-prefix: at least one query word starts a term word ("brew" → "brewing").
    if (wordPrefixMatch(queryWords, entry.term)) {
      score = Math.max(score, Score.WORD_PREFIX);
    }

    // Whole-query in definition.
    if (defLower.includes(q)) {
      score = Math.max(score, Score.DEFINITION);
    }

    // Compact term match.
    if (compact(entry.term).includes(qCompact)) {
      score = Math.max(score, Score.COMPACT);
    }

    // Slug.
    if (entry.slug) {
      const s = entry.slug.toLowerCase();
      if (s.includes(q) || compact(s).includes(qCompact)) {
        score = Math.max(score, Score.SLUG);
      }
    }

    // Category.
    if (entry.category && entry.category.toLowerCase().includes(q)) {
      score = Math.max(score, Score.CATEGORY);
    }

    // Related terms.
    if (
      entry.related_terms.some((ref) => {
        const r = ref.toLowerCase();
        return r.includes(q) || compact(r).includes(qCompact);
      })
    ) {
      score = Math.max(score, Score.RELATED);
    }

    if (score > 0) {
      scored.push({ term: entry, score });
    }
  }

  // Stable sort: highest score first, then original order (alphabetical).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });

  return scored.map((s) => s.term);
}

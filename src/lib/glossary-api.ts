import type { GlossaryTerm } from "@/lib/glossary-match";
import { supabase } from "@/lib/supabase";

/**
 * Glossary terms are PUBLIC READ (RLS: select using true) — the query works
 * for signed-out users too. Empty array when the backend isn't configured.
 */
export async function listGlossaryTerms(): Promise<GlossaryTerm[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("glossary_terms")
    .select("term, slug, definition, category, related_terms")
    .order("term");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    term: row.term,
    slug: row.slug ?? "",
    definition: row.definition,
    category: row.category,
    related_terms: row.related_terms ?? [],
  }));
}

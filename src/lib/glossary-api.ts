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
    .select(
      "id, term, slug, definition, category, categories, related_terms, source_url",
    )
    .order("term");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    term: row.term,
    slug: row.slug ?? "",
    definition: row.definition,
    category: row.category,
    categories: row.categories ?? [],
    related_terms: row.related_terms ?? [],
    source_url: row.source_url ?? "",
  }));
}

/**
 * Term ids the signed-in user has saved (T17). RLS scopes the result to the
 * session user, so no userId argument is needed — the query must only run
 * while a session is active. Empty when the backend isn't configured.
 */
export async function listSavedTermIds(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("saved_terms").select("term_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.term_id);
}

/**
 * Save a term for the session user (T17). `user_id` defaults to auth.uid() in
 * the DB; the client sends only `term_id`. Idempotent — re-saving a saved term
 * is a no-op (unique PK conflict ignored).
 */
export async function saveTerm(termId: string): Promise<void> {
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("saved_terms")
    .upsert(
      { term_id: termId },
      { onConflict: "user_id,term_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

/** Remove a term from the session user's saved list (T17). */
export async function unsaveTerm(termId: string): Promise<void> {
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("saved_terms")
    .delete()
    .eq("term_id", termId);
  if (error) throw new Error(error.message);
}

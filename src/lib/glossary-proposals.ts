/**
 * Glossary term proposals — the app's "propose a missing dictionary term"
 * feature. Rows go to Supabase `glossary_proposals` (RLS: users touch only
 * their own). A weekly CI job in coffee-apps exports pending proposals to a
 * seo-app-v2 issue where the dictionary team reviews them; accepted terms
 * flow back to the app via the dictionary-sync PR pipeline.
 */
import { supabase } from "@/lib/supabase";

export type ProposalStatus =
  | "pending"
  | "exported"
  | "accepted"
  | "declined"
  | "expired";

export interface GlossaryProposal {
  id: string;
  term: string;
  context: string | null;
  note: string | null;
  status: ProposalStatus;
  created_at: string;
}

/** Submit a new term proposal. Returns false if it already exists. */
export async function proposeTerm(
  term: string,
  context?: string,
  note?: string,
): Promise<{ ok: boolean; reason?: "duplicate" | "error" }> {
  const clean = term.trim();
  if (!clean || !supabase) return { ok: false, reason: "error" };

  const { error } = await supabase.from("glossary_proposals").insert({
    term: clean,
    context: context?.trim() || null,
    note: note?.trim() || null,
    // user_id defaults to auth.uid() server-side
  });

  if (!error) return { ok: true };
  // 23505 = unique violation on the open-proposal index → already proposed
  if ((error as { code?: string }).code === "23505") {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: false, reason: "error" };
}

/** The signed-in user's proposals, newest first. */
export async function listMyProposals(): Promise<GlossaryProposal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("glossary_proposals")
    .select("id, term, context, note, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as GlossaryProposal[];
}

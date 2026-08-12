import { supabase } from "@/lib/supabase";

/**
 * Fire-and-forget event tracking (ticket T6) into the `events` table.
 * user_id defaults to auth.uid() (DB column default); RLS scopes inserts to
 * the signed-in user, so events only record for authenticated sessions.
 * Never throws and never blocks the caller — analytics must not break the
 * app's happy path.
 */
export function track(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (!supabase) return;
  // PostgREST builders are PromiseLike (no .catch) — two-arg .then both
  // triggers execution and swallows failures on purpose.
  supabase
    .from("events")
    .insert({ name, properties: properties ?? {} })
    .then(
      () => undefined,
      () => undefined,
    );
}

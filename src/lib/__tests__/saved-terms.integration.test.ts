import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
  listGlossaryTerms,
  listSavedTermIds,
  saveTerm,
  unsaveTerm,
} from "../glossary-api";
import { supabase } from "../supabase";

/**
 * Live-DB integration test for saved terms (T17). Skips when the Supabase env
 * vars are absent (unit runs stay offline); runs against the real project when
 * set:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm test
 * Uses two fixed self-provisioning accounts to verify RLS isolation, and
 * cleans up after itself.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const enabled = !!(url && anonKey && supabase);

const TEST_PASSWORD = "test-pass-123";

/** Sign in to (or provision) a fixed test account and set the shared client's session. */
async function signInAs(email: string): Promise<void> {
  const auth = createClient(url!, anonKey!, {
    auth: { persistSession: false },
  });
  let session = (
    await auth.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  ).data.session;
  if (!session) {
    const signup = await auth.auth.signUp({ email, password: TEST_PASSWORD });
    if (signup.error || !signup.data.session) {
      throw new Error(
        `cannot get session for ${email}: ${signup.error?.message ?? "no session"}`,
      );
    }
    session = signup.data.session;
  }
  await supabase!.auth.setSession(session);
}

describe.skipIf(!enabled)("saved-terms against live Supabase (T17)", () => {
  it("save → list → unsave round-trips; user B cannot see or touch user A's saves", async () => {
    const terms = await listGlossaryTerms();
    expect(terms.length).toBeGreaterThan(0);
    const termId = terms[0].id;

    // A saves the term.
    await signInAs("t17-a@example.com");
    await saveTerm(termId);
    let saved = await listSavedTermIds();
    expect(saved).toContain(termId);

    // Saving again is idempotent (PK dedupe).
    await saveTerm(termId);
    saved = await listSavedTermIds();
    expect(saved.filter((id) => id === termId)).toHaveLength(1);

    // B: cannot see A's save, and a delete attempt is scoped to B (no effect).
    await signInAs("t17-b@example.com");
    saved = await listSavedTermIds();
    expect(saved).not.toContain(termId);
    await unsaveTerm(termId);

    // A still has it.
    await signInAs("t17-a@example.com");
    saved = await listSavedTermIds();
    expect(saved).toContain(termId);

    // Cleanup.
    await unsaveTerm(termId);
    saved = await listSavedTermIds();
    expect(saved).not.toContain(termId);
  });
});

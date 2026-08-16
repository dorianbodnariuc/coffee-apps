import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
  createBrewLog,
  deleteBrewLog,
  listBrewLogs,
  updateBrewLog,
} from "../brew-log-api";
import { supabase } from "../supabase";
import { syncLocalBrews } from "../sync-local-brews";

/**
 * Live-DB integration test for the brew-log API module (T3b).
 * Skips when EXPO_PUBLIC_SUPABASE_URL / ANON_KEY are absent (unit runs stay
 * offline); runs against the real project when the env vars are set:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm test
 * Uses a fixed test account (self-provisioning) and deletes its own rows.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const enabled = !!(url && anonKey && supabase);

const TEST_EMAIL = "t3b-integration@example.com";
const TEST_PASSWORD = "test-pass-123";

const sampleInput = {
  brewedAt: new Date().toISOString(),
  beanName: "Integration Bean",
  roaster: "",
  origin: "Ethiopia",
  method: "pour-over" as const,
  grinder: "",
  grindSize: "medium",
  doseG: 20,
  waterG: 300,
  yieldG: null,
  waterTempC: null,
  methodParams: {},
  brewTimeSeconds: 150,
  tastingNotes: "created by the integration test",
  rating: 4.5,
  beanId: null,
};

describe.skipIf(!enabled)("brew-log-api against live Supabase", () => {
  it("create → list → update → delete round-trips with stored ratio", async () => {
    const auth = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });

    // Reuse the fixed test account: sign in, or provision it on first run.
    let session = (
      await auth.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
    ).data.session;
    if (!session) {
      const signup = await auth.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (signup.error || !signup.data.session) {
        throw new Error(
          `cannot get test session: ${signup.error?.message ?? "no session"}`,
        );
      }
      session = signup.data.session;
    }
    await supabase!.auth.setSession(session);

    // Clean any leftovers from a previous crashed run.
    for (const existing of await listBrewLogs()) {
      if (existing.beanName === "Integration Bean")
        await deleteBrewLog(existing.id);
    }

    const created = await createBrewLog(sampleInput);
    expect(created.id).toBeTruthy();
    expect(created.ratio).toBe(15); // canonical: 20g / 300ml = 15.0
    expect(created.beanName).toBe("Integration Bean");

    // T6 acceptance: creating a log inserts exactly one log_created event.
    const { data: events, error: eventsErr } = await supabase!
      .from("events")
      .select("name, properties");
    expect(eventsErr).toBeNull();
    const logCreated = (events ?? []).filter(
      (event) =>
        event.name === "log_created" &&
        event.properties?.brew_id === created.id,
    );
    expect(logCreated).toHaveLength(1);

    const listed = await listBrewLogs();
    expect(listed.some((log) => log.id === created.id)).toBe(true);

    const updated = await updateBrewLog(created.id, {
      ...sampleInput,
      doseG: 25,
      waterG: 400,
    });
    expect(updated.ratio).toBe(16); // 400 / 25

    // T23 acceptance: espresso ratio = yield/dose (not water/dose).
    const espresso = await createBrewLog({
      ...sampleInput,
      beanName: "Integration Espresso",
      method: "espresso",
      doseG: 18,
      waterG: null,
      yieldG: 36,
      methodParams: { pressure_bar: 9 },
    });
    expect(espresso.ratio).toBe(2); // 36 / 18
    expect(espresso.yieldG).toBe(36);
    expect(espresso.methodParams).toEqual({ pressure_bar: 9 });
    await deleteBrewLog(espresso.id);

    await deleteBrewLog(created.id);
    const after = await listBrewLogs();
    expect(after.some((log) => log.id === created.id)).toBe(false);
  });

  it("syncLocalBrews (soft-wall path) inserts local brews", async () => {
    const synced = await syncLocalBrews([
      {
        ...sampleInput,
        id: "local-integration",
        createdAt: new Date().toISOString(),
        ratio: 15,
        tastingNotes: "synced by integration test",
      },
    ]);
    expect(synced.error).toBeNull();
    expect(synced.inserted).toBe(1);

    const rows = await listBrewLogs();
    const syncedRow = rows.find(
      (log) =>
        log.beanName === "Integration Bean" &&
        log.tastingNotes === "synced by integration test",
    );
    expect(syncedRow).toBeTruthy();
    expect(syncedRow?.ratio).toBe(15);

    // Self-clean: remove the synced row so re-runs start empty.
    if (syncedRow) await deleteBrewLog(syncedRow.id);
  });
});

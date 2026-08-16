import { describe, expect, it } from "vitest";

import {
  getOrCreateOrigin,
  getOrCreateRoaster,
  listOrigins,
  listRoasters,
} from "../catalog-api";
import { supabase } from "../supabase";

/**
 * Live-DB integration test for the catalog API (T24). Skips when the Supabase
 * env vars are absent. Public read needs no session; getOrCreate* converge on
 * the seeded rows (dedup by normalized name), so this creates no persistent
 * rows beyond what the seed already provides.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const enabled = !!(url && anonKey && supabase);

describe.skipIf(!enabled)("catalog API against live Supabase", () => {
  it("reads the seeded origins and roasters (public)", async () => {
    const origins = await listOrigins();
    const roasters = await listRoasters();
    expect(Array.isArray(origins)).toBe(true);
    expect(Array.isArray(roasters)).toBe(true);
    // Seed (20260828_seed_catalog.sql) must have loaded.
    expect(origins.length).toBeGreaterThan(50);
    expect(roasters.length).toBeGreaterThan(20);
  });

  it("getOrCreateOrigin dedups by normalized name (case/whitespace)", async () => {
    const a = await getOrCreateOrigin("Yirgacheffe");
    const b = await getOrCreateOrigin("yirgacheffe");
    const c = await getOrCreateOrigin("  Yirgacheffe  ");
    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    expect(a.name).toBe("Yirgacheffe");
  });

  it("getOrCreateRoaster dedups by normalized name", async () => {
    const a = await getOrCreateRoaster("Blue Bottle Coffee");
    const b = await getOrCreateRoaster("blue bottle coffee");
    expect(a.id).toBe(b.id);
    expect(a.name).toBe("Blue Bottle Coffee");
  });
});

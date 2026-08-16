import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { createBean, deleteBean, listBeans, updateBean } from "../beans-api";
import { createBrewLog, deleteBrewLog, listBrewLogs } from "../brew-log-api";
import { supabase } from "../supabase";
import type { BeanInput } from "../bean-schema";

/**
 * Live-DB integration test for the beans API (T9). Skips when env is absent;
 * uses a fixed self-provisioning test account and cleans up its own rows.
 * Verifies CRUD round-trip AND the FK soft-link contract: deleting a bean
 * leaves brew logs intact (bean_id -> NULL, snapshot preserved).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const enabled = !!(url && anonKey && supabase);

const TEST_EMAIL = "t9-beans-integration@example.com";
const TEST_PASSWORD = "test-pass-123";

const sampleBean: BeanInput = {
  name: "Integration Bean",
  roaster: "Test Roaster",
  origin: "Ethiopia",
  roasterId: null,
  originId: null,
  roastDate: null,
};

describe.skipIf(!enabled)("beans API against live Supabase", () => {
  it("CRUD round-trips and bean delete keeps brew logs (FK set null)", async () => {
    const auth = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });

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

    // Clean leftovers from a previous crashed run.
    for (const b of await listBeans()) {
      if (b.name === "Integration Bean") await deleteBean(b.id);
    }
    for (const l of await listBrewLogs()) {
      if (l.beanName === "Integration Bean") await deleteBrewLog(l.id);
    }

    // Create + list.
    const created = await createBean({ ...sampleBean, roastDate: "2026-08-01" });
    expect(created.id).toBeTruthy();
    expect(created.roastDate).toBe("2026-08-01");
    expect((await listBeans()).some((b) => b.id === created.id)).toBe(true);

    // Update.
    const updated = await updateBean(created.id, {
      ...sampleBean,
      roaster: "Updated Roaster",
      roastDate: null,
    });
    expect(updated.roaster).toBe("Updated Roaster");
    expect(updated.roastDate).toBeNull();

    // Soft link: a brew log referencing the bean.
    const log = await createBrewLog({
      brewedAt: new Date().toISOString(),
      beanId: created.id,
      beanName: "Integration Bean",
      roaster: "Updated Roaster",
      origin: "Ethiopia",
      method: "pour-over",
      grinder: "",
      grindSize: "",
      doseG: 20,
      waterG: 300,
      yieldG: null,
      waterTempC: null,
      brewTimeSeconds: 150,
      tastingNotes: "bean integration test",
      rating: 4,
      methodParams: {},
    });
    expect(log.beanId).toBe(created.id);

    // Delete the bean -> log survives, bean_id NULL, snapshot intact.
    await deleteBean(created.id);
    const surviving = (await listBrewLogs()).find((l) => l.id === log.id);
    expect(surviving).toBeTruthy();
    expect(surviving!.beanId).toBeNull();
    expect(surviving!.beanName).toBe("Integration Bean");

    // Cleanup.
    await deleteBrewLog(log.id);
  });
});

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share the module-level Supabase client (its session is
    // set per-test). Run files serially so two integration tests never clobber
    // each other's auth session mid-run.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // Mirrors tsconfig paths so lib tests can import '@/constants' etc.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // supabase.ts imports AsyncStorage (react-native) — swap in an
      // in-memory mock so node/vitest can import the client.
      "@react-native-async-storage/async-storage": fileURLToPath(
        new URL("./src/lib/__tests__/async-storage-mock.ts", import.meta.url),
      ),
    },
  },
});

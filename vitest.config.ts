import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
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

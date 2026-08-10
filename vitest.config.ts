import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig paths so lib tests can import '@/constants' etc.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

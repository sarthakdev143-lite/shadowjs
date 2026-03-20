import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@murkjs/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom"
  }
});

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sarthakdev143/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@sarthakdev143/runtime": fileURLToPath(new URL("../runtime/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom"
  }
});

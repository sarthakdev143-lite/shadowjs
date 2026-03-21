import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sarthakdev143/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@sarthakdev143/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@sarthakdev143/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  }
});

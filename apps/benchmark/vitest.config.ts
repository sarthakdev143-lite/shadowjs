import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shadowjs/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@shadowjs/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@shadowjs/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  }
});

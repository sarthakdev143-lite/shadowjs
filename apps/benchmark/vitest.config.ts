import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@murkjs/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@murkjs/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@murkjs/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  }
});

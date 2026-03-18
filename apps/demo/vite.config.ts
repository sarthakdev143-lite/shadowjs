import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { shadowjs } from "../../packages/compiler/src/index";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  plugins: [shadowjs()],
  resolve: {
    alias: {
      "@shadowjs/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@shadowjs/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@shadowjs/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [workspaceRoot]
    }
  }
});

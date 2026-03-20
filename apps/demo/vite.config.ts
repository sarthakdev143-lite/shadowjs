import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { murkjs } from "../../packages/compiler/src/index";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist/client"
  },
  plugins: [murkjs()],
  resolve: {
    alias: {
      "@murkjs/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@murkjs/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@murkjs/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [workspaceRoot]
    }
  }
});

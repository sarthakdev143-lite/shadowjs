import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { shadejs } from "../../packages/compiler/src/index";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist/client"
  },
  plugins: [shadejs()],
  resolve: {
    alias: {
      shadejs: fileURLToPath(new URL("../../packages/shadejs/src/index.ts", import.meta.url)),
      "@sarthakdev143/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@sarthakdev143/runtime": fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      "@sarthakdev143/state": fileURLToPath(new URL("../../packages/state/src/index.ts", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [workspaceRoot]
    }
  }
});


import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

import { murkjs } from "../src/plugin";

describe("RPC integration", () => {
  let port: number;
  let server: ViteDevServer;

  beforeAll(async () => {
    const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

    server = await createServer({
      plugins: [murkjs()],
      resolve: {
        alias: {
          "@murkjs/core": fileURLToPath(new URL("../../core/src/index.ts", import.meta.url)),
          "@murkjs/runtime": fileURLToPath(new URL("../../runtime/src/index.ts", import.meta.url)),
          "@murkjs/state": fileURLToPath(new URL("../../state/src/index.ts", import.meta.url))
        }
      },
      root: fileURLToPath(new URL("../../../apps/demo", import.meta.url)),
      server: {
        fs: {
          allow: [workspaceRoot]
        },
        port: 0,
        strictPort: false
      }
    });

    await server.listen();

    const address = server.httpServer?.address();
    if (address === null || address === undefined || typeof address === "string") {
      throw new Error("Failed to resolve Vite dev server port.");
    }

    port = address.port;
  }, 30_000);

  afterAll(async () => {
    await server.close();
  });

  it("handles GET /__rpc/ with 405", async () => {
    const response = await fetch(`http://localhost:${port}/__rpc/posts/getPosts`);

    expect(response.status).toBe(405);
  });

  it("handles POST to unknown route with 404", async () => {
    const response = await fetch(`http://localhost:${port}/__rpc/unknown/fn`, {
      body: "[]",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    expect(response.status).toBe(404);
  });
}, 60_000);

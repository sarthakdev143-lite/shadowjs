import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin, ViteDevServer } from "vite";

import { analyzeServerImports } from "./analyzer";
import { getRPCRoutePath } from "./rpc-gen";
import { generateProductionServer } from "./server-build";
import { transformServerImports } from "./transform";

function isServerFile(id: string): boolean {
  return /\.server(?:\.[cm]?[jt]sx?)?$/.test(id);
}

function isTransformableFile(id: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(id);
}

function stripQuery(id: string): string {
  return id.split("?")[0];
}

function resolveServerModule(importerId: string, source: string): string | null {
  const importerDirectory = dirname(stripQuery(importerId));
  const absoluteBase = resolve(importerDirectory, source);
  const candidates = /\.[cm]?[jt]sx?$/.test(absoluteBase)
    ? [absoluteBase]
    : [
        `${absoluteBase}.ts`,
        `${absoluteBase}.tsx`,
        `${absoluteBase}.js`,
        `${absoluteBase}.jsx`,
        `${absoluteBase}.mts`,
        `${absoluteBase}.cts`
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function readRequestBody(request: IncomingMessage): Promise<unknown[]> {
  let rawBody = "";

  for await (const chunk of request) {
    rawBody += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }

  if (rawBody.length === 0) {
    return [];
  }

  const parsed = JSON.parse(rawBody) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function installRpcMiddleware(server: ViteDevServer, routeRegistry: Map<string, string>): void {
  server.middlewares.use(async (request, response, next) => {
    const url = request.url?.split("?")[0] ?? "";

    if (!url.startsWith("/__rpc/")) {
      next();
      return;
    }

    if (request.method !== "POST") {
      writeJson(response, 405, { error: "MurkJS RPC only supports POST requests." });
      return;
    }

    const segments = url.slice("/__rpc/".length).split("/").filter((segment) => segment.length > 0);

    if (segments.length < 2) {
      writeJson(response, 400, { error: "Invalid MurkJS RPC path." });
      return;
    }

    const functionName = segments[segments.length - 1];
    const routePath = segments.slice(0, -1).join("/");
    const serverModule = routeRegistry.get(routePath);

    if (serverModule === undefined) {
      writeJson(response, 404, { error: `No MurkJS RPC module registered for "${routePath}".` });
      return;
    }

    try {
      const loadedModule = (await server.ssrLoadModule(serverModule)) as Record<string, unknown>;
      const handler = loadedModule[functionName];

      if (typeof handler !== "function") {
        writeJson(response, 404, { error: `No MurkJS RPC handler named "${functionName}".` });
        return;
      }

      const args = await readRequestBody(request);
      const result = await (handler as (...values: unknown[]) => unknown | Promise<unknown>)(...args);
      writeJson(response, 200, result);
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

export function murkjs(): Plugin {
  const routeRegistry = new Map<string, string>();

  return {
    closeBundle() {
      if (routeRegistry.size === 0) {
        return;
      }

      const outDir = resolve(process.cwd(), "dist");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "server.mjs"), generateProductionServer(routeRegistry), "utf8");
    },
    configureServer(server) {
      installRpcMiddleware(server, routeRegistry);
    },
    enforce: "pre",
    name: "murkjs",
    transform(code, id) {
      const cleanId = stripQuery(id);

      if (cleanId.startsWith("\0") || isServerFile(cleanId) || !isTransformableFile(cleanId)) {
        return null;
      }

      for (const serverImport of analyzeServerImports(code)) {
        const resolvedModule = resolveServerModule(cleanId, serverImport.serverFilePath);

        if (resolvedModule !== null) {
          routeRegistry.set(getRPCRoutePath(serverImport.serverFilePath), resolvedModule);
        }
      }

      const transformed = transformServerImports(code);

      if (transformed === null) {
        return null;
      }

      return transformed;
    }
  };
}

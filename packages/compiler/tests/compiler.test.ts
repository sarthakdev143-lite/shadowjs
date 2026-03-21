import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

import { extractExportedFunctions, generateHMRBlock, generateProductionServer } from "../src/index";
import { shadejs } from "../src/plugin";
import { generateRPCStub } from "../src/rpc-gen";
import { transformServerImports } from "../src/transform";

function getConfigResolvedHook(plugin: ReturnType<typeof shadejs>): ((config: { command: "build" | "serve" }) => void) | undefined {
  if (typeof plugin.configResolved === "function") {
    return plugin.configResolved as unknown as (config: { command: "build" | "serve" }) => void;
  }

  return plugin.configResolved?.handler as unknown as ((config: { command: "build" | "serve" }) => void) | undefined;
}

describe("@sarthakdev143/compiler", () => {
  it("passes through files without .server imports", () => {
    const source = 'import { createSignal } from "@sarthakdev143/core";\n\nconst count = createSignal(0);';

    expect(transformServerImports(source)).toBeNull();
  });

  it("replaces .server imports with fetch stubs", () => {
    const source = [
      'import { createQuery } from "@sarthakdev143/state";',
      'import { getPosts } from "./posts.server";',
      "",
      "const posts = createQuery(getPosts);"
    ].join("\n");
    const transformed = transformServerImports(source);

    expect(transformed).not.toBeNull();
    expect(transformed?.code).not.toContain('from "./posts.server"');
    expect(transformed?.code).toContain('fetch("/__rpc/posts/getPosts"');
    expect(transformed?.code).toContain("export const getPosts");
    expect(transformed?.code).toContain('import { createQuery } from "@sarthakdev143/state";');
  });

  it("returns a valid source map for transformed files", () => {
    const source = 'import { getPosts } from "./posts.server";\n\nconst posts = getPosts;';
    const transformed = transformServerImports(source);

    expect(transformed).not.toBeNull();
    expect(() => JSON.parse(transformed!.map)).not.toThrow();
  });

  it("generates the expected RPC stub shape", () => {
    const stub = generateRPCStub({
      importedName: "getPosts",
      localName: "getPosts",
      serverFilePath: "./posts.server"
    });

    expect(stub).toContain('type __ShadowServerFn_getPosts = typeof import("./posts.server").getPosts;');
    expect(stub).toContain('fetch("/__rpc/posts/getPosts"');
    expect(stub).toContain('body: JSON.stringify(args)');
  });

  it("is idempotent when run twice", () => {
    const source = 'import { getPosts } from "./posts.server";\n\nconst posts = getPosts;';
    const once = transformServerImports(source);
    const twice = transformServerImports(once!.code);

    expect(twice).toBeNull();
  });

  it("skips transforming server-only files", () => {
    const plugin = shadejs();
    const transformHook =
      typeof plugin.transform === "function"
        ? (plugin.transform as unknown as (code: string, id: string) => unknown)
        : (plugin.transform?.handler as unknown as ((code: string, id: string) => unknown) | undefined);
    const result = transformHook?.("export async function getPosts() {}", "/src/posts.server.ts");

    expect(result).toBeNull();
  });

  it("generates an HMR block for exported components", () => {
    const block = generateHMRBlock(["Feed", "Counter"]);

    expect(block).toContain('window.__shadejs_registry__?.has("Feed")');
    expect(block).toContain('window.__shadejs_registry__?.has("Counter")');
    expect(block).toContain("import.meta.hot.accept");
  });

  it("extracts exported function components from source", () => {
    const source = [
      "export function Feed() {",
      '  return "feed";',
      "}",
      "export const Counter = () => 1;",
      "const Hidden = () => 2;"
    ].join("\n");

    expect(extractExportedFunctions(source)).toEqual(["Feed", "Counter"]);
  });

  it("injects HMR only during serve mode", () => {
    const source = 'export function Feed() { return "feed"; }';
    const servePlugin = shadejs();
    const serveConfigResolved = getConfigResolvedHook(servePlugin);
    const serveTransform =
      typeof servePlugin.transform === "function"
        ? (servePlugin.transform as unknown as (code: string, id: string) => { code: string } | null)
        : (servePlugin.transform?.handler as unknown as ((code: string, id: string) => { code: string } | null) | undefined);

    serveConfigResolved?.({ command: "serve" });
    const serveResult = serveTransform?.(source, "/src/feed.tsx");

    expect(serveResult).not.toBeNull();
    expect(serveResult?.code).toContain("import.meta.hot");

    const buildPlugin = shadejs();
    const buildConfigResolved = getConfigResolvedHook(buildPlugin);
    const buildTransform =
      typeof buildPlugin.transform === "function"
        ? (buildPlugin.transform as unknown as (code: string, id: string) => { code: string } | null)
        : (buildPlugin.transform?.handler as unknown as ((code: string, id: string) => { code: string } | null) | undefined);

    buildConfigResolved?.({ command: "build" });
    const buildResult = buildTransform?.(source, "/src/feed.tsx");

    expect(buildResult).toBeNull();
  });

  it("generates a production RPC server source file", () => {
    const source = generateProductionServer(new Map([["posts", "/abs/posts.server.js"]]));

    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain('"posts": "/abs/posts.server.js"');
    expect(source).toContain("/__rpc/");
    expect(source).toContain("const STATIC_DIR = process.env.STATIC_DIR");
    expect(source).toContain('join(STATIC_DIR, "index.html")');
    expect(source).toContain('".html": "text/html"');
    expect(source).toContain('".css": "text/css"');
    expect(() => parse(source, { sourceType: "module" })).not.toThrow();
  });
});

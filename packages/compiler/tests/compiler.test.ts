import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

import { generateProductionServer } from "../src/index";
import { murkjs } from "../src/plugin";
import { generateRPCStub } from "../src/rpc-gen";
import { transformServerImports } from "../src/transform";

describe("@murkjs/compiler", () => {
  it("passes through files without .server imports", () => {
    const source = 'import { createSignal } from "@murkjs/core";\n\nconst count = createSignal(0);';

    expect(transformServerImports(source)).toBeNull();
  });

  it("replaces .server imports with fetch stubs", () => {
    const source = [
      'import { createQuery } from "@murkjs/state";',
      'import { getPosts } from "./posts.server";',
      "",
      "const posts = createQuery(getPosts);"
    ].join("\n");
    const transformed = transformServerImports(source);

    expect(transformed).not.toBeNull();
    expect(transformed?.code).not.toContain('from "./posts.server"');
    expect(transformed?.code).toContain('fetch("/__rpc/posts/getPosts"');
    expect(transformed?.code).toContain("export const getPosts");
    expect(transformed?.code).toContain('import { createQuery } from "@murkjs/state";');
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
    const plugin = murkjs();
    const transformHook =
      typeof plugin.transform === "function"
        ? (plugin.transform as unknown as (code: string, id: string) => unknown)
        : (plugin.transform?.handler as unknown as ((code: string, id: string) => unknown) | undefined);
    const result = transformHook?.("export async function getPosts() {}", "/src/posts.server.ts");

    expect(result).toBeNull();
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

import { describe, expect, it } from "vitest";

import { shadowjs } from "../src/plugin";
import { generateRPCStub } from "../src/rpc-gen";
import { transformServerImports } from "../src/transform";

describe("@shadowjs/compiler", () => {
  it("passes through files without .server imports", () => {
    const source = 'import { createSignal } from "@shadowjs/core";\n\nconst count = createSignal(0);';

    expect(transformServerImports(source)).toBe(source);
  });

  it("replaces .server imports with fetch stubs", () => {
    const source = [
      'import { createQuery } from "@shadowjs/state";',
      'import { getPosts } from "./posts.server";',
      "",
      "const posts = createQuery(getPosts);"
    ].join("\n");
    const transformed = transformServerImports(source);

    expect(transformed).not.toContain('from "./posts.server"');
    expect(transformed).toContain('fetch("/__rpc/posts/getPosts"');
    expect(transformed).toContain("export const getPosts");
    expect(transformed).toContain('import { createQuery } from "@shadowjs/state";');
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
    const twice = transformServerImports(once);

    expect(twice).toBe(once);
  });

  it("skips transforming server-only files", () => {
    const plugin = shadowjs();
    const transformHook =
      typeof plugin.transform === "function"
        ? (plugin.transform as unknown as (code: string, id: string) => unknown)
        : (plugin.transform?.handler as unknown as ((code: string, id: string) => unknown) | undefined);
    const result = transformHook?.("export async function getPosts() {}", "/src/posts.server.ts");

    expect(result).toBeNull();
  });
});

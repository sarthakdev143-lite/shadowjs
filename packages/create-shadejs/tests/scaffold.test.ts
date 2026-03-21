import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { scaffold } from "../src/scaffold";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "create-shadejs-"));
  tempRoots.push(root);
  return root;
}

function readGeneratedFile(root: string, relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("create-shadejs scaffold", () => {
  it("creates the expected directory structure", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: false,
        includeRouter: false,
        projectName: "starter-app"
      },
      cwd
    );

    expect(existsSync(output)).toBe(true);
    expect(existsSync(join(output, "src"))).toBe(true);
    expect(existsSync(join(output, "package.json"))).toBe(true);
    expect(existsSync(join(output, "vite.config.ts"))).toBe(true);
    expect(existsSync(join(output, "src", "main.ts"))).toBe(true);
  });

  it("generates package.json with the compiler, core, and runtime dependencies", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: false,
        includeRouter: false,
        projectName: "dependency-app"
      },
      cwd
    );
    const packageJson = JSON.parse(readGeneratedFile(output, "package.json")) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@sarthakdev143/compiler"]).toBe("latest");
    expect(packageJson.dependencies["@sarthakdev143/core"]).toBe("latest");
    expect(packageJson.dependencies["@sarthakdev143/runtime"]).toBe("latest");
  });

  it("generates vite.config.ts with the shadejs compiler plugin", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: false,
        includeRouter: false,
        projectName: "vite-app"
      },
      cwd
    );
    const viteConfig = readGeneratedFile(output, "vite.config.ts");

    expect(viteConfig).toContain('import { shadejs } from "@sarthakdev143/compiler";');
    expect(viteConfig).toContain("plugins: [shadejs()]");
  });

  it("generates src/main.ts with a runtime import", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: true,
        includeRouter: false,
        projectName: "runtime-app"
      },
      cwd
    );
    const main = readGeneratedFile(output, "src/main.ts");

    expect(main).toContain('import { h, mount } from "@sarthakdev143/runtime";');
  });

  it("adds the router dependency when includeRouter is enabled", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: false,
        includeRouter: true,
        projectName: "router-app"
      },
      cwd
    );
    const packageJson = JSON.parse(readGeneratedFile(output, "package.json")) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@sarthakdev143/router"]).toBe("latest");
  });

  it("omits the router dependency when includeRouter is disabled", () => {
    const cwd = createTempRoot();
    const output = scaffold(
      {
        includeDemo: false,
        includeRouter: false,
        projectName: "no-router-app"
      },
      cwd
    );
    const packageJson = JSON.parse(readGeneratedFile(output, "package.json")) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@sarthakdev143/router"]).toBeUndefined();
  });
});

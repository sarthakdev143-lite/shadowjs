import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ScaffoldOptions } from "./prompts";
import {
  gitignoreTemplate,
  indexHtmlTemplate,
  mainTemplate,
  packageJsonTemplate,
  tsConfigTemplate,
  viteConfigTemplate
} from "./templates";

export function scaffold(options: ScaffoldOptions, cwd = process.cwd()): string {
  const root = join(cwd, options.projectName);

  if (existsSync(root) && readdirSync(root).length > 0) {
    throw new Error(`Target directory "${options.projectName}" is not empty.`);
  }

  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });

  writeFileSync(join(root, "package.json"), packageJsonTemplate(options), "utf8");
  writeFileSync(join(root, "vite.config.ts"), viteConfigTemplate(), "utf8");
  writeFileSync(join(root, "tsconfig.json"), tsConfigTemplate(), "utf8");
  writeFileSync(join(root, "index.html"), indexHtmlTemplate(options), "utf8");
  writeFileSync(join(root, "src", "main.ts"), mainTemplate(options), "utf8");
  writeFileSync(join(root, ".gitignore"), gitignoreTemplate(), "utf8");

  return root;
}

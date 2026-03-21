import type { ScaffoldOptions } from "./prompts";

function stringifyJSON(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createDependencies(options: ScaffoldOptions): Record<string, string> {
  const dependencies: Record<string, string> = {
    "@sarthakdev143/compiler": "latest",
    "@sarthakdev143/core": "latest",
    "@sarthakdev143/runtime": "latest"
  };

  if (options.includeRouter) {
    dependencies["@sarthakdev143/router"] = "latest";
  }

  return dependencies;
}

function createMainSource(options: ScaffoldOptions): string {
  if (options.includeRouter) {
    return `import { createSignal } from "@sarthakdev143/core";
import { Link, createRouter } from "@sarthakdev143/router";
import { h, mount } from "@sarthakdev143/runtime";

const app = document.querySelector("#app");

if (!(app instanceof HTMLElement)) {
  throw new Error("ShadeJS app root was not found.");
}

function Home() {
  ${options.includeDemo ? 'const [count, setCount] = createSignal(0);\n\n  ' : ""}return h(
    "main",
    { className: "app" },
    h("span", { className: "eyebrow" }, "ShadeJS"),
    h("h1", null, "Build fast apps with fine-grained reactivity."),
    h(
      "p",
      null,
      "This starter wires the runtime, compiler plugin, and router together with zero extra glue."
    ),
    ${options.includeDemo ? 'h("p", { className: "count" }, () => `Counter: ${count()}`),\n    h(\n      "button",\n      {\n        onClick: () => setCount((value) => value + 1)\n      },\n      "Increment"\n    ),\n    ' : ""}h(Link, { href: "/about" }, "About this starter")
  );
}

function About() {
  return h(
    "main",
    { className: "app" },
    h("span", { className: "eyebrow" }, "Router"),
    h("h1", null, "Client-side routing is already configured."),
    h(
      "p",
      null,
      "Use createRouter(), Link, and navigate() to extend this starter into a full single-page app."
    ),
    h(Link, { href: "/" }, "Back home")
  );
}

const Router = createRouter([
  { path: "/", component: Home },
  { path: "/about", component: About }
]);

mount(Router, app);
`;
  }

  if (options.includeDemo) {
    return `import { createSignal } from "@sarthakdev143/core";
import { h, mount } from "@sarthakdev143/runtime";

const app = document.querySelector("#app");

if (!(app instanceof HTMLElement)) {
  throw new Error("ShadeJS app root was not found.");
}

function App() {
  const [count, setCount] = createSignal(0);

  return h(
    "main",
    { className: "app" },
    h("span", { className: "eyebrow" }, "ShadeJS"),
    h("h1", null, "Signals without ceremony."),
    h("p", null, "This starter includes a minimal counter so you can confirm reactivity immediately."),
    h("p", { className: "count" }, () => \`Counter: \${count()}\`),
    h(
      "button",
      {
        onClick: () => setCount((value) => value + 1)
      },
      "Increment"
    )
  );
}

mount(App, app);
`;
  }

  return `import { h, mount } from "@sarthakdev143/runtime";

const app = document.querySelector("#app");

if (!(app instanceof HTMLElement)) {
  throw new Error("ShadeJS app root was not found.");
}

function App() {
  return h(
    "main",
    { className: "app" },
    h("span", { className: "eyebrow" }, "ShadeJS"),
    h("h1", null, "Project scaffolding is ready."),
    h("p", null, "Start editing src/main.ts to build your app.")
  );
}

mount(App, app);
`;
}

export function packageJsonTemplate(options: ScaffoldOptions): string {
  return stringifyJSON({
    name: options.projectName,
    private: true,
    scripts: {
      build: "vite build",
      dev: "vite",
      typecheck: "tsc -p tsconfig.json --noEmit"
    },
    type: "module",
    dependencies: createDependencies(options),
    devDependencies: {
      typescript: "^5.6.3",
      vite: "^5.4.0"
    }
  });
}

export function viteConfigTemplate(): string {
  return `import { defineConfig } from "vite";
import { shadejs } from "@sarthakdev143/compiler";

export default defineConfig({
  plugins: [shadejs()]
});
`;
}

export function tsConfigTemplate(): string {
  return stringifyJSON({
    compilerOptions: {
      lib: ["DOM", "ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      target: "ES2022"
    },
    include: ["src"]
  });
}

export function mainTemplate(options: ScaffoldOptions): string {
  return createMainSource(options);
}

export function indexHtmlTemplate(options: ScaffoldOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.projectName}</title>
    <style>
      :root {
        color: #f5efe8;
        font-family: "Trebuchet MS", "Aptos", sans-serif;
        background: linear-gradient(180deg, #141114 0%, #09080b 100%);
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(255, 170, 96, 0.18), transparent 24rem),
          linear-gradient(180deg, #141114 0%, #09080b 100%);
      }

      #app {
        min-height: 100vh;
      }

      .app {
        display: grid;
        gap: 1rem;
        max-width: 42rem;
        margin: 0 auto;
        padding: 3rem 1.25rem;
      }

      .eyebrow {
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #f8be79;
      }

      h1,
      p {
        margin: 0;
      }

      button,
      a {
        font: inherit;
      }

      button,
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.75rem;
        width: fit-content;
        padding: 0.75rem 1rem;
        border: 0;
        border-radius: 999px;
        color: #1b130e;
        background: linear-gradient(135deg, #ffdd9a, #ff9960);
        text-decoration: none;
        cursor: pointer;
      }

      .count {
        font-size: 1.1rem;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}

export function gitignoreTemplate(): string {
  return `dist
node_modules
.DS_Store
`;
}

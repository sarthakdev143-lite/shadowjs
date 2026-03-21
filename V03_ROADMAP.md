# ShadeJS — v0.3.0 Roadmap

Read this file completely before writing a single line of code.
Current state: v0.2.0 complete. Packages published under `@sarthakdev143` scope.
Work through phases in strict order. One branch per phase. PR to main. Tests before merge.

---

## What is still missing after v0.2.0

1. **No Context API** — every real app needs to pass data down the tree without prop drilling. Currently impossible.
2. **No HMR** — changing a component in dev requires a full page reload. Unacceptable DX.
3. **No JSX type safety** — JSX props have no TypeScript checking. `h("div", { onClik: ... })` fails silently.
4. **No client-side router** — single-page apps are impossible without this.
5. **No CLI scaffolder** — `npm create shadejs-app` doesn't exist. Adoption requires zero-friction setup.
6. **No devtools** — no way to inspect the signal graph or see which effects are running.
7. **No SSR** — server-side rendering is blocked because the runtime only targets browser DOM.

v0.3.0 fixes items 1–5. Items 6–7 are v0.4.0.

---

## Phase 19 — Core: Context API

### Problem
No way to pass reactive data down the component tree without threading props through every level.

### What to build

**`packages/core/src/context.ts`** — add to existing file

```typescript
export interface Context<T> {
  id: symbol
  defaultValue: T
}

const contextStack = new Map<symbol, unknown[]>()

export function createContext<T>(defaultValue: T): Context<T> {
  return { id: Symbol("shadejs.context"), defaultValue }
}

export function provideContext<T>(context: Context<T>, value: T, fn: () => void): void {
  const stack = contextStack.get(context.id) ?? []
  stack.push(value)
  contextStack.set(context.id, stack)
  try {
    fn()
  } finally {
    stack.pop()
    if (stack.length === 0) contextStack.delete(context.id)
  }
}

export function useContext<T>(context: Context<T>): T {
  const stack = contextStack.get(context.id)
  if (!stack || stack.length === 0) return context.defaultValue
  return stack[stack.length - 1] as T
}
```

Export `createContext`, `provideContext`, `useContext` from `packages/core/src/index.ts`.

**`packages/runtime/src/jsx.ts`**

Add a `Provider` component helper:

```typescript
export function createProvider<T>(context: Context<T>) {
  return function Provider(props: { value: T; children: Renderable[] }): Renderable {
    let result: Renderable = null
    provideContext(context, props.value, () => {
      result = props.children.length === 1 ? props.children[0] : props.children
    })
    return result
  }
}
```

### Usage (for demo update)

```typescript
const ThemeContext = createContext("light")
const ThemeProvider = createProvider(ThemeContext)

function App() {
  return h(ThemeProvider, { value: "dark" },
    h(Child, null)
  )
}

function Child() {
  const theme = useContext(ThemeContext) // "dark"
  return h("div", { className: () => `theme-${theme}` }, "Hello")
}
```

Update `apps/demo` to use context for the theme toggle instead of prop drilling.

### Tests to add

`packages/core/tests/signal.test.ts`:
- `useContext` returns defaultValue when no provider exists
- `useContext` returns provided value inside `provideContext`
- nested providers: inner value shadows outer value
- after `provideContext` exits, `useContext` returns outer value again
- context works with reactive signals as values

---

## Phase 20 — Runtime: JSX Type Safety

### Problem
`h("div", { onClik: handler })` — typo in event name. TypeScript says nothing. Bugs hide silently.

### What to build

**`packages/runtime/src/jsx-types.ts`** — new file

Define the full JSX intrinsic element type map:

```typescript
import type { Accessor } from "@sarthakdev143/core"

type ReactiveOr<T> = T | Accessor<T>

interface BaseHTMLProps {
  id?: ReactiveOr<string>
  className?: ReactiveOr<string>
  style?: ReactiveOr<string | Partial<CSSStyleDeclaration>>
  hidden?: ReactiveOr<boolean>
  tabIndex?: ReactiveOr<number>
  title?: ReactiveOr<string>
  key?: string | number
  ref?: (el: HTMLElement) => void
  children?: Renderable | Renderable[]
}

interface HTMLInputProps extends BaseHTMLProps {
  type?: ReactiveOr<string>
  value?: ReactiveOr<string>
  checked?: ReactiveOr<boolean>
  disabled?: ReactiveOr<boolean>
  placeholder?: ReactiveOr<string>
  onInput?: (e: InputEvent) => void
  onChange?: (e: Event) => void
}

interface HTMLButtonProps extends BaseHTMLProps {
  disabled?: ReactiveOr<boolean>
  type?: ReactiveOr<"button" | "submit" | "reset">
  onClick?: (e: MouseEvent) => void
}

// ... define HTMLDivProps, HTMLSpanProps, HTMLAnchorProps, HTMLFormProps,
//     HTMLLiProps, HTMLUlProps, HTMLOlProps, HTMLHeadingProps etc.

type EventHandlers = {
  onClick?: (e: MouseEvent) => void
  onDblClick?: (e: MouseEvent) => void
  onMouseEnter?: (e: MouseEvent) => void
  onMouseLeave?: (e: MouseEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onKeyDown?: (e: KeyboardEvent) => void
  onKeyUp?: (e: KeyboardEvent) => void
  onSubmit?: (e: SubmitEvent) => void
  onScroll?: (e: Event) => void
}

export interface IntrinsicElements {
  div: BaseHTMLProps & EventHandlers
  span: BaseHTMLProps & EventHandlers
  p: BaseHTMLProps & EventHandlers
  h1: BaseHTMLProps & EventHandlers
  h2: BaseHTMLProps & EventHandlers
  h3: BaseHTMLProps & EventHandlers
  ul: BaseHTMLProps & EventHandlers
  ol: BaseHTMLProps & EventHandlers
  li: BaseHTMLProps & EventHandlers
  button: HTMLButtonProps
  input: HTMLInputProps
  textarea: HTMLInputProps & EventHandlers
  form: BaseHTMLProps & { onSubmit?: (e: SubmitEvent) => void }
  a: BaseHTMLProps & EventHandlers & { href?: ReactiveOr<string>; target?: ReactiveOr<string> }
  img: BaseHTMLProps & { src?: ReactiveOr<string>; alt?: ReactiveOr<string> }
  label: BaseHTMLProps & EventHandlers & { htmlFor?: ReactiveOr<string> }
  nav: BaseHTMLProps & EventHandlers
  header: BaseHTMLProps & EventHandlers
  footer: BaseHTMLProps & EventHandlers
  main: BaseHTMLProps & EventHandlers
  section: BaseHTMLProps & EventHandlers
  article: BaseHTMLProps & EventHandlers
  aside: BaseHTMLProps & EventHandlers
}
```

**`packages/runtime/src/jsx.ts`**

Update `h` function signature to use IntrinsicElements:

```typescript
export function h<K extends keyof IntrinsicElements>(
  tag: K,
  props: IntrinsicElements[K] | null,
  ...children: Renderable[]
): VNode

export function h<P extends object>(
  tag: (props: P) => Renderable,
  props: P | null,
  ...children: Renderable[]
): VNode

export function h(tag: any, props: any, ...children: any[]): VNode {
  // implementation unchanged
}
```

**`tsconfig.base.json`**

Add JSX type declarations:

```json
{
  "compilerOptions": {
    "jsxImportSource": "@sarthakdev143/runtime",
    "types": ["@sarthakdev143/runtime/jsx-types"]
  }
}
```

**`packages/runtime/src/index.ts`**

Export `IntrinsicElements` and re-export the namespace for global JSX:

```typescript
export type { IntrinsicElements } from "./jsx-types"

declare global {
  namespace JSX {
    interface IntrinsicElements extends import("./jsx-types").IntrinsicElements {}
    type Element = VNode
  }
}
```

### Tests to add

These are TypeScript compilation tests — use `tsd` or `expect-type`:

`packages/runtime/tests/jsx-types.test.ts`:
- `h("div", { className: "foo" })` compiles without error
- `h("div", { onClik: () => {} })` fails TypeScript (unknown prop)
- `h("input", { value: "hello" })` compiles without error
- `h("button", { disabled: () => false })` compiles (reactive prop)
- `h("a", { href: "https://example.com" })` compiles without error

---

## Phase 21 — Runtime: HMR Support

### Problem
Every code change triggers a full page reload. State is lost. Dev cycle is slow.

### What to build

**`packages/compiler/src/hmr.ts`** — new file

Generate HMR accept code to inject at the bottom of every transformed component file:

```typescript
export function generateHMRBlock(componentExports: string[]): string {
  return `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (!newModule) return
    ${componentExports.map(name => `
    if (newModule.${name} && window.__shadejs_registry__?.has("${name}")) {
      window.__shadejs_registry__.get("${name}")(newModule.${name})
    }`).join("")}
  })
}
`
}
```

**`packages/runtime/src/hmr.ts`** — new file

A component registry that HMR uses to hot-swap component functions without losing state:

```typescript
const registry = new Map<string, Array<(newFn: Function) => void>>()

if (typeof window !== "undefined") {
  (window as any).__shadejs_registry__ = {
    has: (name: string) => registry.has(name),
    get: (name: string) => (newFn: Function) => {
      const listeners = registry.get(name) ?? []
      for (const listener of listeners) listener(newFn)
    }
  }
}

export function registerComponent(name: string, onUpdate: (newFn: Function) => void): void {
  const listeners = registry.get(name) ?? []
  listeners.push(onUpdate)
  registry.set(name, listeners)
}
```

**`packages/compiler/src/plugin.ts`**

In the `transform` hook, after the RPC transform, if `command === "serve"` (dev mode), inject HMR block:

```typescript
transform(code, id) {
  // skip server files, skip node_modules
  if (id.includes("node_modules")) return null
  if (id.endsWith(".server.ts") || id.endsWith(".server.js")) return null

  let result = transformServerImports(code)
  const transformed = result?.code ?? code
  const map = result?.map

  if (config.command === "serve") {
    const exports = extractExportedFunctions(transformed) // use babel to find export function X
    if (exports.length > 0) {
      return {
        code: transformed + "\n" + generateHMRBlock(exports),
        map
      }
    }
  }

  return result ? { code: result.code, map: result.map } : null
}
```

Add `extractExportedFunctions(source: string): string[]` to `analyzer.ts` — uses existing Babel setup to find `export function X` and `export const X = () =>` patterns.

### Tests to add

`packages/compiler/tests/compiler.test.ts`:
- `generateHMRBlock(["Feed", "Counter"])` output contains both names
- `extractExportedFunctions` correctly identifies named function exports
- HMR block is only injected when `command === "serve"`
- production build output does not contain `import.meta.hot`

---

## Phase 22 — New Package: Router

**New package: `packages/router/`**

```
packages/router/
  src/
    router.ts       # createRouter, navigate, currentPath signal
    route.ts        # Route matching, params extraction
    link.ts         # <Link> component
    index.ts
  tests/
  package.json
```

### What to build

**`packages/router/src/router.ts`**

```typescript
import { createSignal, type Accessor } from "@sarthakdev143/core"

export interface Route {
  path: string       // e.g. "/posts/:id"
  component: () => Renderable
}

export interface RouterState {
  path: string
  params: Record<string, string>
  query: Record<string, string>
}

const [routerState, setRouterState] = createSignal<RouterState>({
  path: typeof window !== "undefined" ? window.location.pathname : "/",
  params: {},
  query: {}
})

export const currentPath: Accessor<string> = () => routerState().path
export const currentParams: Accessor<Record<string, string>> = () => routerState().params
export const currentQuery: Accessor<Record<string, string>> = () => routerState().query

export function navigate(path: string): void {
  window.history.pushState({}, "", path)
  updateRouterState(path)
}

function updateRouterState(path: string): void {
  const url = new URL(path, window.location.origin)
  setRouterState({
    path: url.pathname,
    params: {},  // filled by route matching
    query: Object.fromEntries(url.searchParams)
  })
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    updateRouterState(window.location.pathname)
  })
}
```

**`packages/router/src/route.ts`**

```typescript
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/")
  const pathParts = path.split("/")
  
  if (patternParts.length !== pathParts.length) return null
  
  const params: Record<string, string> = {}
  
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i]
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i])
    } else if (p !== pathParts[i]) {
      return null
    }
  }
  
  return params
}

export function createRouter(routes: Route[]): () => Renderable {
  return function Router(): Renderable {
    const path = currentPath()
    
    for (const route of routes) {
      const params = matchRoute(route.path, path)
      if (params !== null) {
        // update params in router state
        return route.component()
      }
    }
    
    return null // 404 — no match
  }
}
```

**`packages/router/src/link.ts`**

```typescript
import { h } from "@sarthakdev143/runtime"
import { navigate } from "./router"

export function Link(props: { href: string; children?: Renderable[] }): Renderable {
  return h("a", {
    href: props.href,
    onClick: (e: MouseEvent) => {
      e.preventDefault()
      navigate(props.href)
    }
  }, ...(props.children ?? []))
}
```

### Demo update

Add two routes to `apps/demo`:
- `/` — the existing feed
- `/about` — a simple static page

```typescript
import { createRouter } from "@sarthakdev143/router"

const Router = createRouter([
  { path: "/", component: Feed },
  { path: "/about", component: About }
])

mount(Router, document.querySelector("#app")!)
```

### Tests to add

`packages/router/tests/router.test.ts`:
- `matchRoute("/posts/:id", "/posts/42")` returns `{ id: "42" }`
- `matchRoute("/posts/:id", "/posts/42/edit")` returns null (length mismatch)
- `matchRoute("/about", "/about")` returns `{}`
- `matchRoute("/about", "/contact")` returns null
- `navigate()` updates `currentPath()` signal
- `createRouter` renders the matched component
- `createRouter` returns null for unmatched path
- `Link` renders an anchor tag
- `Link` click calls `navigate` and does not trigger browser navigation

---

## Phase 23 — New Package: CLI Scaffolder

**New directory: `packages/create-shadejs/`**

This is a standalone Node.js script published as `create-shadejs` on npm (unscoped — check availability first). Allows:

```bash
npm create shadejs@latest my-app
# or
npx create-shadejs my-app
```

### What to build

```
packages/create-shadejs/
  src/
    index.ts       # CLI entry — reads args, calls scaffold
    scaffold.ts    # Creates directory structure
    templates.ts   # Inline file content strings
    prompts.ts     # Interactive questions (name, TypeScript, router)
  package.json     # bin: { "create-shadejs": "./dist/index.js" }
```

**`packages/create-shadejs/src/prompts.ts`**

Use `@clack/prompts` for interactive CLI:

```typescript
import * as p from "@clack/prompts"

export interface ScaffoldOptions {
  projectName: string
  includeRouter: boolean
  includeDemo: boolean
}

export async function collectOptions(nameArg?: string): Promise<ScaffoldOptions> {
  p.intro("create-shadejs")
  
  const projectName = nameArg ?? await p.text({
    message: "Project name:",
    placeholder: "my-app",
    validate: (v) => v.length === 0 ? "Name is required" : undefined
  })

  const includeRouter = await p.confirm({
    message: "Include @sarthakdev143/router?",
    initialValue: true
  })

  const includeDemo = await p.confirm({
    message: "Include demo counter and posts example?",
    initialValue: false
  })

  p.outro("Scaffolding...")

  return { projectName: String(projectName), includeRouter: Boolean(includeRouter), includeDemo: Boolean(includeDemo) }
}
```

**`packages/create-shadejs/src/templates.ts`**

Inline file content strings for:
- `package.json` template
- `vite.config.ts` template
- `tsconfig.json` template
- `src/main.ts` template
- `index.html` template
- `.gitignore` template

**`packages/create-shadejs/src/scaffold.ts`**

```typescript
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function scaffold(options: ScaffoldOptions): void {
  const { projectName } = options
  const root = join(process.cwd(), projectName)
  
  mkdirSync(root, { recursive: true })
  mkdirSync(join(root, "src"))
  
  // Write each template file
  writeFileSync(join(root, "package.json"), packageJsonTemplate(options))
  writeFileSync(join(root, "vite.config.ts"), viteConfigTemplate())
  writeFileSync(join(root, "tsconfig.json"), tsConfigTemplate())
  writeFileSync(join(root, "index.html"), indexHtmlTemplate(options))
  writeFileSync(join(root, "src", "main.ts"), mainTemplate(options))
  writeFileSync(join(root, ".gitignore"), gitignoreTemplate())
  
  console.log(`\nDone. Now run:\n  cd ${projectName}\n  npm install\n  npm run dev\n`)
}
```

**`packages/create-shadejs/package.json`**

```json
{
  "name": "create-shadejs",
  "version": "0.1.0",
  "description": "Scaffold a new ShadeJS application",
  "bin": {
    "create-shadejs": "./dist/index.js"
  },
  "files": ["dist"],
  "dependencies": {
    "@clack/prompts": "^0.9.0"
  }
}
```

### Tests to add

`packages/create-shadejs/tests/scaffold.test.ts`:
- `scaffold()` creates the expected directory structure
- generated `package.json` includes correct dependencies
- generated `vite.config.ts` imports `shadejs` compiler plugin
- generated `src/main.ts` imports from `@sarthakdev143/runtime`
- scaffold with `includeRouter: true` adds router dependency
- scaffold with `includeRouter: false` does not add router dependency

---

## Execution order

```
Phase 19  Context API         → core/context.ts + runtime/jsx.ts + tests
Phase 20  JSX type safety     → runtime/jsx-types.ts + types update + tests
Phase 21  HMR support         → compiler/hmr.ts + runtime/hmr.ts + plugin update + tests
Phase 22  Router              → new packages/router/ + demo update + tests
Phase 23  CLI scaffolder      → new packages/create-shadejs/ + tests
```

---

## Version target

On completion of all phases: bump to `v0.3.0`.
Tag: `v0.3.0`
Publish all packages including new `@sarthakdev143/router` and `create-shadejs`.

---

## Hard rules

1. `pnpm test` must pass before merging each phase.
2. `pnpm typecheck` must pass. No `any`.
3. Demo must run after every phase.
4. One branch per phase. PR to main. Never commit directly to main.
5. CHANGELOG.md updated at the end of each phase.
6. Do not build SSR, devtools, or streaming. Those are v0.4.0.
7. `create-shadejs` scaffolds apps that use `@sarthakdev143/*` scoped packages.

# ShadeJS — Production Readiness Roadmap

Read this file completely before writing a single line of code.
Work through phases in strict order. Do not start Phase N+1 before Phase N tests pass.

---

## Current State

- `packages/core` — signals, effects, memos, scheduler. Working. Tested.
- `packages/runtime` — JSX factory, fine-grained DOM renderer, mount(). Working. Tested.
- `packages/state` — createQuery, createMutation, createStore. Working. Tested.
- `packages/compiler` — Babel AST analyzer, RPC stub generator, Vite plugin. Dev-only.
- `apps/demo` — working demo app.
- `apps/docs` — static HTML documentation.

## What is broken or missing

1. **No production server** — RPC middleware uses `server.ssrLoadModule()` which only exists in Vite dev server. In production, all `/__rpc/*` calls 404.
2. **No effect disposal** — `createEffect` has no cleanup mechanism. Effects live forever. Memory leak in any real app.
3. **queryRegistry is a global singleton that never shrinks** — memory leak.
4. **No source maps** from compiler transforms — impossible to debug transformed files.
5. **No batching API** — users cannot explicitly batch multiple signal writes.
6. **No in-flight deduplication in createQuery** — two components calling `createQuery(getPosts)` fire two requests.
7. **No error handling in effects** — a throwing effect silently crashes with no feedback.
8. **No mutation loading state** — `createMutation` has no `pending` signal.
9. **README is two lines** — unusable for anyone who finds the repo.
10. **No package publishing config** — packages lack `files`, `sideEffects`, CJS exports.
11. **No GitHub Actions CI** — no automated test runs.

---

## Phase 1 — Core: Effect Disposal

### Problem
`createEffect` creates a computation that is permanently subscribed with no way to stop it. Components that unmount leak effects.

### Changes

**`packages/core/src/signal.ts`**

Change `createEffect` to return a dispose function:

```typescript
export function createEffect(effect: () => void): () => void {
  const computation = createComputation("effect", () => {
    computation.running = true
    computation.dirty = false
    cleanupComputation(computation)
    try {
      runWithObserver(computation, effect)
    } finally {
      computation.running = false
    }
  })

  computation.execute()

  return function dispose(): void {
    cleanupComputation(computation)
    pendingEffects.delete(computation)
    computation.dirty = false
    computation.scheduled = false
  }
}
```

**`packages/core/src/index.ts`**

Export the dispose type: `export type { Accessor, Computation, Setter, Updater } from "./signal"` — no change needed, the return type is inferred.

**`packages/runtime/src/dom.ts`**

Add a WeakMap to track DOM node → dispose functions. Every `createEffect` call inside `applyProps` and `createReactiveNodes` must store its disposer:

```typescript
const nodeDisposers = new WeakMap<Node, Array<() => void>>()

function registerDisposer(node: Node, dispose: () => void): void {
  const list = nodeDisposers.get(node) ?? []
  list.push(dispose)
  nodeDisposers.set(node, list)
}

export function disposeNode(node: Node): void {
  const disposers = nodeDisposers.get(node)
  if (disposers) {
    for (const d of disposers) d()
    nodeDisposers.delete(node)
  }
  for (const child of Array.from((node as Element).childNodes ?? [])) {
    disposeNode(child)
  }
}
```

In `applyProps`, when binding a reactive prop:
```typescript
const dispose = createEffect(() => {
  setElementProperty(element, key, accessor())
})
registerDisposer(element, dispose)
```

In `createReactiveNodes`:
```typescript
const dispose = createEffect(() => { ... })
registerDisposer(anchor, dispose)
```

**`packages/runtime/src/render.ts`**

Dispose the previous tree before mounting:

```typescript
import { disposeNode } from "./dom"

export function mount(component: () => Renderable, container: Element): void {
  for (const child of Array.from(container.childNodes)) {
    disposeNode(child)
  }
  container.replaceChildren(createDOMNode(component()))
}
```

**`packages/runtime/src/index.ts`**

Export `disposeNode`.

### Tests to add

`packages/core/tests/signal.test.ts`:
- dispose() stops the effect from re-running when its signal changes
- dispose() removes the computation from pendingEffects
- reading a signal after dispose does not re-register as dependency
- dispose() called multiple times does not throw

`packages/runtime/tests/runtime.test.tsx`:
- calling mount() again disposes effects from the previous tree
- a reactive text node that has been replaced does not keep updating after disposal

---

## Phase 2 — Core: Batch API

### Problem
No explicit API to batch multiple signal writes into one effect flush. Users who write to multiple signals inside an async callback get multiple flushes.

### Changes

**`packages/core/src/scheduler.ts`**

Add `batch()`:

```typescript
let batchDepth = 0

export function batch<T>(fn: () => T): T {
  batchDepth++
  try {
    return fn()
  } finally {
    batchDepth--
    if (batchDepth === 0 && pendingEffects.size > 0) {
      flushEffects()
    }
  }
}
```

Update `queueFlush` to respect batch depth:

```typescript
function queueFlush(): void {
  if (isFlushQueued || isFlushing || batchDepth > 0) return
  isFlushQueued = true
  queueMicrotask(flushEffects)
}
```

Export `batch` from `packages/core/src/index.ts`.

### Tests to add

`packages/core/tests/signal.test.ts`:
- batch() collapses multiple signal writes into one effect run
- nested batch() calls do not flush until the outermost batch exits
- batch() with no signal writes does not throw
- signal written inside batch reads correctly after batch

---

## Phase 3 — State: Mutation Loading State

### Problem
`createMutation` returns a plain async function with no reactive pending/error state. Every real UI needs a loading spinner and error display.

### Changes

**`packages/state/src/mutation.ts`**

```typescript
import { createSignal, type Accessor } from "@shadejs/core"
import { invalidateQueryKeys } from "./query"

export interface MutationOptions {
  invalidates?: string[]
}

export interface MutationHandle<TArguments extends unknown[], TResult> {
  mutate: (...args: TArguments) => Promise<TResult>
  pending: Accessor<boolean>
  error: Accessor<Error | null>
}

export function createMutation<TArguments extends unknown[], TResult>(
  asyncFunction: (...args: TArguments) => Promise<TResult>,
  options: MutationOptions = {}
): MutationHandle<TArguments, TResult> {
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<Error | null>(null)

  const mutate = async (...args: TArguments): Promise<TResult> => {
    setPending(true)
    setError(null)
    try {
      const result = await asyncFunction(...args)
      await invalidateQueryKeys(options.invalidates ?? [])
      return result
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setPending(false)
    }
  }

  return { mutate, pending, error }
}
```

**`packages/state/src/index.ts`**

Export `MutationHandle`.

**`apps/demo/src/feed.ts`**

Update to use new API:

```typescript
const { mutate: submitPost, pending: isSubmitting } = createMutation(addPost, {
  invalidates: ["posts"]
})

// Button:
h("button", {
  className: "add-button",
  disabled: () => isSubmitting() || composer.draft.trim().length === 0,
  onClick: () => { void handleAddPost() }
}, () => isSubmitting() ? "Adding..." : "Add Post")
```

### Tests to add

`packages/state/tests/state.test.ts`:
- pending() is false before mutate() is called
- pending() is true while mutate() is in flight
- pending() returns false after mutate() resolves
- pending() returns false after mutate() rejects
- error() is null before mutate() is called
- error() is set when mutate() throws
- error() resets to null at the start of the next mutate() call
- return value from mutate() is the resolved value

---

## Phase 4 — State: Query Deduplication

### Problem
Two `createQuery(getPosts, "posts")` calls in the same render fire two simultaneous network requests. They should share one in-flight request.

### Changes

**`packages/state/src/query.ts`**

Add an in-flight request Map at module scope:

```typescript
const inFlightRequests = new Map<string, Promise<unknown>>()
```

Update the `run` function inside `createQuery`:

```typescript
const run = async (): Promise<void> => {
  setState(prev => ({ data: prev.data, error: null, loading: true }))

  try {
    let request = inFlightRequests.get(queryKey) as Promise<T> | undefined

    if (request === undefined) {
      request = asyncFunction()
      inFlightRequests.set(queryKey, request)
      void request.finally(() => { inFlightRequests.delete(queryKey) })
    }

    const data = await request
    setState({ data, error: null, loading: false })
  } catch (error) {
    setState({ data: null, error: normalizeError(error), loading: false })
  }
}
```

### Tests to add

`packages/state/tests/state.test.ts`:
- two createQuery calls with same key share one in-flight Promise
- after request resolves, a new createQuery call fires a fresh request
- invalidation fires a fresh request regardless of in-flight state

---

## Phase 5 — Compiler: Source Maps

### Problem
The compiler removes import lines and inserts RPC stubs. The resulting file has wrong line numbers. DevTools show errors at incorrect locations.

### Changes

Add `magic-string` to `packages/compiler`:

```bash
pnpm --filter @shadejs/compiler add magic-string
```

**`packages/compiler/src/transform.ts`**

Replace string slicing with MagicString:

```typescript
import MagicString from "magic-string"

export function transformServerImports(source: string): { code: string; map: string } | null {
  const imports = analyzeServerImports(source)
  if (imports.length === 0) return null

  const ms = new MagicString(source)

  // collect import ranges via AST (same logic as before)
  // for each range: ms.remove(range.start, range.end)
  
  // insert stubs after last remaining import
  const insertionIndex = getInsertionIndex(ms.toString())
  ms.appendLeft(insertionIndex, "\n\n" + imports.map(generateRPCStub).join("\n\n"))

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }).toString()
  }
}
```

**`packages/compiler/src/plugin.ts`**

Update transform hook:

```typescript
const result = transformServerImports(code)
if (result === null) return null

return {
  code: result.code,
  map: result.map
}
```

Update the existing compiler tests — `transformServerImports` now returns `{ code, map } | null` instead of `string`. Update all test assertions accordingly.

### Tests to add

`packages/compiler/tests/compiler.test.ts`:
- transformServerImports returns null for files with no .server imports
- transformServerImports returns { code, map } for files with .server imports
- the map field is a valid JSON source map string
- transformed code still passes existing correctness assertions (use result.code)

---

## Phase 6 — Production Server

### Problem
The Vite plugin's RPC middleware only exists during `vite dev`. A production build has no server. All RPC calls 404 in production.

### Changes

**New file: `packages/compiler/src/server-build.ts`**

```typescript
export function generateProductionServer(
  registry: Map<string, string> // routePath -> absolute server file path
): string {
  const entries = JSON.stringify(Object.fromEntries(registry), null, 2)

  return `
import { createServer } from "node:http"
import { URL } from "node:url"

const registry = ${entries}

async function readBody(req) {
  let raw = ""
  for await (const chunk of req) raw += chunk
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function writeJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")

  if (!url.pathname.startsWith("/__rpc/")) {
    res.writeHead(404)
    res.end()
    return
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "ShadeJS RPC only supports POST." })
    return
  }

  const segments = url.pathname.slice("/__rpc/".length).split("/").filter(Boolean)
  if (segments.length < 2) {
    writeJson(res, 400, { error: "Invalid RPC path." })
    return
  }

  const fnName = segments[segments.length - 1]
  const routePath = segments.slice(0, -1).join("/")
  const modulePath = registry[routePath]

  if (!modulePath) {
    writeJson(res, 404, { error: "No module for route: " + routePath })
    return
  }

  try {
    const mod = await import(modulePath)
    const fn = mod[fnName]
    if (typeof fn !== "function") {
      writeJson(res, 404, { error: "No handler: " + fnName })
      return
    }
    const args = await readBody(req)
    const result = await fn(...args)
    writeJson(res, 200, result)
  } catch (err) {
    writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
})

const port = process.env.PORT ?? 3000
server.listen(port, () => {
  console.log("ShadeJS RPC server listening on port " + port)
})
`.trim()
}
```

**`packages/compiler/src/plugin.ts`**

Add `closeBundle` hook to write the production server:

```typescript
import { writeFileSync, mkdirSync } from "node:fs"
import { generateProductionServer } from "./server-build"

// Inside shadejs():
closeBundle() {
  if (routeRegistry.size === 0) return
  const outDir = resolve(process.cwd(), "dist")
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    resolve(outDir, "server.mjs"),
    generateProductionServer(routeRegistry),
    "utf8"
  )
}
```

**`packages/compiler/src/index.ts`**

Export `generateProductionServer`.

### Tests to add

`packages/compiler/tests/compiler.test.ts`:
- generateProductionServer() returns a non-empty string
- generated source contains all route paths from registry
- generated source contains "/__rpc/" string
- generated source is parseable as valid JS (use acorn or just check no syntax errors with Function constructor)

---

## Phase 7 — Runtime: Error Handling in Effects

### Problem
If an effect throws (e.g. a signal read produces unexpected data), the error is swallowed silently. The scheduler continues but the UI is in an undefined state.

### Changes

**`packages/core/src/scheduler.ts`**

Add configurable error handler:

```typescript
export type EffectErrorHandler = (error: unknown, computation: Computation) => void

let effectErrorHandler: EffectErrorHandler = (error) => {
  console.error("[ShadeJS] Uncaught effect error:", error)
}

export function setEffectErrorHandler(handler: EffectErrorHandler): void {
  effectErrorHandler = handler
}
```

Update `flushEffects` to catch per-computation errors:

```typescript
try {
  computation.execute()
} catch (error) {
  effectErrorHandler(error, computation)
}
```

Export `setEffectErrorHandler` and `EffectErrorHandler` from `packages/core/src/index.ts`.

**New file: `packages/runtime/src/error-boundary.ts`**

```typescript
import { createSignal } from "@shadejs/core"
import { setEffectErrorHandler } from "@shadejs/core"
import type { Renderable, Props } from "./jsx"
import { h } from "./jsx"

export interface ErrorBoundaryProps extends Props {
  fallback: (error: Error) => Renderable
  children?: Renderable[]
}

export function ErrorBoundary(props: ErrorBoundaryProps): Renderable {
  const { fallback, children = [] } = props
  const [caughtError, setCaughtError] = createSignal<Error | null>(null)

  // Register a scoped error handler
  // Note: this is a simplistic implementation — a full version
  // would use a context stack to scope errors to this boundary
  setEffectErrorHandler((error) => {
    setCaughtError(error instanceof Error ? error : new Error(String(error)))
  })

  return () => {
    const error = caughtError()
    if (error !== null) return fallback(error)
    return children.length === 1 ? children[0] : children
  }
}
```

Export `ErrorBoundary` from `packages/runtime/src/index.ts`.

### Tests to add

`packages/core/tests/signal.test.ts`:
- an effect that throws does not crash the scheduler
- other pending effects still run after one throws
- setEffectErrorHandler callback is called with the thrown error
- setEffectErrorHandler can be replaced at any time

---

## Phase 8 — Package Publishing Config

### Changes per package

Add to every `packages/*/package.json`:

```json
{
  "license": "MIT",
  "sideEffects": false,
  "files": ["dist", "src"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

Change every package build script to:

```json
"build": "tsup src/index.ts --dts --format esm,cjs"
```

### Verify after building

Run `pnpm build` from root. Check:
- `packages/core/dist/index.js` (ESM)
- `packages/core/dist/index.cjs` (CJS)
- `packages/core/dist/index.d.ts` (types)
- Same for `runtime`, `state`, `compiler`

No test changes needed. This is verified by the build succeeding.

---

## Phase 9 — GitHub Actions CI

**New file: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

---

## Phase 10 — README

Replace `README.md` entirely. Write the following sections:

**1. Title and one-paragraph description**
What ShadeJS is. What problem it solves (fine-grained reactivity, compiler-owned server/client boundary, unified state). What it is NOT (a React replacement, production-ready, feature-complete).

**2. Architecture**

```
┌─────────────────────────────────────────────┐
│                  @shadejs/core               │
│  createSignal · createEffect · createMemo   │
│              Scheduler (microtask)          │
└────────────────────┬────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼──────┐ ┌─────▼──────┐ ┌────▼───────┐
│ @shadejs/   │ │ @shadejs/   │ │ @shadejs/   │
│  runtime   │ │   state    │ │  compiler  │
│ JSX · DOM  │ │ query ·    │ │ Vite plugin│
│  mount()   │ │ mutation · │ │ RPC stubs  │
│            │ │ store      │ │            │
└────────────┘ └────────────┘ └────────────┘
```

**3. Quickstart**

```bash
git clone https://github.com/YOUR_USERNAME/shadejs
cd shadejs
pnpm install
pnpm dev
# open http://localhost:5173
```

**4. Core concepts** — one code block each for signals, DOM binding, createQuery, createStore, .server imports.

**5. Known limitations** (be honest):
- No SSR or hydration
- No router
- No streaming
- Production RPC server requires running `dist/server.mjs` separately
- No concurrent mode
- v1 proof of concept — breaking changes expected

**6. Development**

```bash
pnpm test        # run all tests
pnpm typecheck   # TypeScript checks
pnpm build       # build all packages
pnpm dev         # run demo app
```

**7. License: MIT**

---

## Phase 11 — Integration Test

**New file: `packages/compiler/tests/integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { fileURLToPath } from "node:url"
import { shadejs } from "../src/plugin"

describe("RPC integration", () => {
  let server: ViteDevServer
  let port: number

  beforeAll(async () => {
    server = await createServer({
      plugins: [shadejs()],
      root: fileURLToPath(new URL("../../../apps/demo", import.meta.url)),
      server: { port: 0, strictPort: false }
    })
    await server.listen()
    port = server.config.server.port as number
  }, 30_000)

  afterAll(async () => {
    await server.close()
  })

  it("handles GET /__rpc/ with 405", async () => {
    const res = await fetch(`http://localhost:${port}/__rpc/posts/getPosts`)
    expect(res.status).toBe(405)
  })

  it("handles POST to unknown route with 404", async () => {
    const res = await fetch(`http://localhost:${port}/__rpc/unknown/fn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]"
    })
    expect(res.status).toBe(404)
  })
}, 60_000)
```

---

## Execution Order Summary

```
Phase 1  Effect Disposal        → core + runtime changes + tests
Phase 2  Batch API              → core change + tests
Phase 3  Mutation Loading       → state change + demo update + tests
Phase 4  Query Deduplication    → state change + tests
Phase 5  Source Maps            → compiler change + update existing tests
Phase 6  Production Server      → compiler new file + plugin hook + tests
Phase 7  Error Handling         → core + runtime changes + tests
Phase 8  Publishing Config      → package.json changes + build verify
Phase 9  CI                     → new workflow file
Phase 10 README                 → replace README.md
Phase 11 Integration Test       → new test file
```

After Phase 11: run `pnpm test` from root. All tests must pass. Run `pnpm build`. All packages must build. Run `pnpm dev`. Demo must work. Done.



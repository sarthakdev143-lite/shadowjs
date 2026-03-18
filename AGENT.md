# AGENT.md — ShadowJS Build Instructions

You are a senior framework engineer building **ShadowJS** from scratch.
Read this file completely before writing a single line of code.

---

## What You Are Building

ShadowJS is a TypeScript-first JavaScript framework with three core systems:

1. **Reactive Runtime** — fine-grained signals + scheduler
2. **Compiler** — Vite plugin that auto-splits server/client code into typed RPC calls
3. **State Layer** — `createQuery` / `createMutation` / `createStore` built on signals

These are not independent packages. They are one system. Every design decision must preserve that unity.

---

## Repository Structure

```
shadowjs/
├── packages/
│   ├── core/                  # Signals runtime + scheduler
│   │   ├── src/
│   │   │   ├── signal.ts      # createSignal, createEffect, createMemo
│   │   │   ├── scheduler.ts   # Microtask queue + batch flushing
│   │   │   ├── context.ts     # Tracking context (who is reading which signal)
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── state/                 # createQuery, createMutation, createStore
│   │   ├── src/
│   │   │   ├── query.ts
│   │   │   ├── mutation.ts
│   │   │   ├── store.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── compiler/              # Vite plugin — server/client boundary
│   │   ├── src/
│   │   │   ├── plugin.ts      # Vite plugin entry
│   │   │   ├── analyzer.ts    # AST walker — finds .server imports
│   │   │   ├── transform.ts   # Replaces server imports with RPC stubs
│   │   │   ├── rpc-gen.ts     # Generates typed fetch() wrappers
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── runtime/               # JSX transform + DOM renderer
│       ├── src/
│       │   ├── jsx.ts         # h() function — JSX factory
│       │   ├── render.ts      # mount(), hydrate()
│       │   ├── dom.ts         # Fine-grained DOM binding (signal → textNode etc.)
│       │   └── index.ts
│       ├── tests/
│       └── package.json
│
├── apps/
│   └── demo/                  # Working demo app using ShadowJS
│       ├── src/
│       │   ├── posts.server.ts   # Server function (DB stub)
│       │   ├── feed.ts           # Client component using createQuery
│       │   └── main.ts
│       └── vite.config.ts
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict mode) | Required. No `any`. |
| Package manager | pnpm workspaces | Monorepo |
| Build tool | tsup | Fast, zero-config TS bundler |
| Test runner | vitest | Native ESM, fast |
| Compiler/AST | `@babel/parser` + `@babel/traverse` | AST walking for compiler package |
| Vite plugin API | Vite 5 `Plugin` interface | `transform` hook |
| JSX | Custom factory (`h()`), not React | Set in tsconfig |

---

## Implementation Order

Build in this exact sequence. Do NOT jump ahead.

### Phase 1 — Core (signals + scheduler)

**File: `packages/core/src/context.ts`**
- Global mutable `currentObserver: Computation | null`
- `runWithObserver(observer, fn)` — sets context, runs fn, restores context
- This is the tracking mechanism. Everything depends on it.

**File: `packages/core/src/scheduler.ts`**
- `pendingEffects: Set<Computation>`
- `isFlushing: boolean`
- `scheduleEffect(effect)` — adds to pending, schedules microtask if not already flushing
- `flushEffects()` — runs pending effects in dependency order
- Use `queueMicrotask()` — NOT `setTimeout`

**File: `packages/core/src/signal.ts`**
```typescript
// Target API:
const [count, setCount] = createSignal(0)
count()          // read — triggers tracking
setCount(5)      // write — notifies subscribers
setCount(n => n + 1)  // functional update

createEffect(() => {
  console.log(count()) // re-runs when count changes
})

const double = createMemo(() => count() * 2) // cached derived value
```

Rules:
- Reading a signal inside `runWithObserver` → registers the signal as a dependency of the current computation
- Writing a signal → mark all subscribers as dirty → schedule them via scheduler
- `createMemo` is a signal that is also a computation (reads other signals, caches result)
- Never update DOM synchronously from signal write. Always go through scheduler.

### Phase 2 — Runtime (JSX + DOM)

**File: `packages/runtime/src/jsx.ts`**
- `h(tag, props, ...children)` — JSX factory
- Returns a plain object descriptor `{ tag, props, children }`
- Must handle: string tags (`div`), function components, fragments

**File: `packages/runtime/src/dom.ts`**
- `createDOMNode(descriptor)` — walks descriptor tree, builds real DOM nodes
- When a child is a function (signal accessor): wrap in `createEffect` that updates the specific textNode
- When a prop is a function: wrap in `createEffect` that sets the attribute
- This is where fine-grained DOM binding happens. One signal = one targeted DOM update.

**File: `packages/runtime/src/render.ts`**
- `mount(component, container)` — entry point

### Phase 3 — State Layer

**File: `packages/state/src/query.ts`**
```typescript
// Target API:
const posts = createQuery(getPosts)
// posts() returns: { data, loading, error } — all reactive
// Auto-fetches on mount. Refetches on invalidation.
```
- Internally: `createSignal({ data: null, loading: true, error: null })`
- Calls the async function, updates signal on resolve/reject
- Register query under a string key for cache invalidation

**File: `packages/state/src/mutation.ts`**
```typescript
const addPost = createMutation(createPost, {
  invalidates: ['posts']
})
await addPost({ title: 'Hello' })
// → calls createPost on server
// → invalidates 'posts' key
// → all createQuery('posts') re-fetch automatically
```

**File: `packages/state/src/store.ts`**
```typescript
const store = createStore({ count: 0, open: false })
store.count    // reactive getter
store.count = 5 // triggers update
```
- Use `Proxy` to intercept get/set and route through signals

### Phase 4 — Compiler (Vite Plugin)

**File: `packages/compiler/src/analyzer.ts`**
- Input: file source code (string)
- Walk imports using `@babel/traverse`
- Find all `import ... from '*.server'` patterns
- Return: list of `{ importedName, serverFile, localName }`

**File: `packages/compiler/src/rpc-gen.ts`**
- Input: server function name + server file path
- Output: TypeScript source string of a fetch() wrapper
```typescript
// Generated output example:
export async function getPosts(...args) {
  const res = await fetch('/__rpc/posts/getPosts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  return res.json()
}
```

**File: `packages/compiler/src/transform.ts`**
- Input: file source, list from analyzer
- Replace each `*.server` import with generated RPC stub (inline, no separate file)
- Remove original import
- Output: transformed source string

**File: `packages/compiler/src/plugin.ts`**
```typescript
export function shadowjs(): Plugin {
  return {
    name: 'shadowjs',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('.server')) return null // don't transform server files
      // run analyzer → transformer → return transformed code
    }
  }
}
```

---

## Critical Rules

1. **No `any` in TypeScript.** Use generics everywhere signals hold typed values.
2. **Signals are pull-then-push.** Reads pull the current value and register dependency. Writes push dirty notifications to dependents.
3. **Scheduler is the only thing that touches the DOM.** No direct DOM mutations from signal setters.
4. **The compiler must be idempotent.** Running transform twice on the same file must produce the same output.
5. **Server files never run in the browser bundle.** The Vite plugin must ensure this. If a `.server.ts` file ends up in the client bundle, the compiler failed.
6. **`createQuery` keys are strings.** Keep it simple. No query key arrays, no hash functions in v1.

---

## What v1 Does NOT Include

Do not build these. They are explicitly out of scope.

- SSR / hydration
- RSC / streaming
- Router
- CSS-in-JS or style handling
- Edge runtime
- Authentication helpers
- Image optimization
- Concurrent mode / transitions

If you find yourself building any of these, stop and re-read this file.

---

## Tests Required

Every package needs tests before moving to the next phase.

### Core tests (vitest)
```
- signal reads/writes update value correctly
- createEffect re-runs when dependency changes
- createEffect does NOT re-run when unrelated signal changes
- createMemo caches and only recomputes on dependency change
- batch: multiple signal writes in one tick = one effect run
- no infinite loops: effect that writes a signal doesn't re-trigger itself
```

### Compiler tests
```
- file with no .server imports passes through unchanged
- .server import is replaced with fetch() stub
- generated stub matches expected RPC shape
- server-only file is excluded from client bundle
```

### State tests
```
- createQuery starts in loading state
- createQuery resolves to data
- createMutation calls server function
- createMutation with invalidates triggers createQuery refetch
```

---

## Demo App Requirements

The demo app in `apps/demo/` must demonstrate:

1. A `posts.server.ts` with a stubbed `getPosts()` function (returns hardcoded array)
2. A `feed.ts` client component using `createQuery(getPosts)` 
3. A `createMutation` that adds a post and invalidates the query
4. A counter using `createSignal` and `createEffect`
5. Everything rendered via `mount()` to a real DOM node

The demo proves the system works end to end. It is not optional.

---

## Done Criteria

ShadowJS v1 is complete when:

- [ ] All tests pass (`pnpm test` from root)
- [ ] Demo app runs in browser via `pnpm dev`
- [ ] Adding a post in the demo updates the list reactively
- [ ] Browser DevTools shows no full page re-renders (only targeted DOM mutations)
- [ ] No TypeScript errors in strict mode
- [ ] `.server.ts` functions do not appear in the browser network bundle
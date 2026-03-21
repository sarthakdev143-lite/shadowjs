# ShadeJS

ShadeJS is a TypeScript-first experiment in fine-grained UI reactivity, compiler-owned server/client boundaries, and shared state primitives. It combines a signal core, a DOM runtime, a small state layer, and a Vite compiler plugin that rewrites `.server` imports into RPC stubs. It is not a React replacement, not production-ready, and not feature-complete; it is a proof-of-concept codebase for exploring the model.

## Install

For normal use, install the single public package:

```bash
npm install shadejs
```

Then use the framework APIs from `"shadejs"` and the Vite plugin from `"shadejs/compiler"`.

## Architecture

```text
+---------------------------------------------+
|               @shadejs/core                 |
|  createSignal · createEffect · createMemo   |
|          Scheduler (microtask)              |
+----------------------+----------------------+
                       |
        +--------------+--------------+
        |              |              |
+-------v------+ +-----v------+ +-----v-------+
| @shadejs/    | | @shadejs/  | | @shadejs/   |
|   runtime    | |   state    | |  compiler   |
| JSX · DOM    | | query ·    | | Vite plugin |
| mount()      | | mutation · | | RPC stubs   |
|              | | store      | |             |
+--------------+ +------------+ +-------------+
```

## Quickstart

```bash
git clone https://github.com/sarthakdev143-lite/shadejs
cd shadejs
pnpm install
pnpm dev
# open http://localhost:5173
```

## Core Concepts

### Signals

```ts
import { createEffect, createSignal } from "shadejs";

const [count, setCount] = createSignal(0);

createEffect(() => {
  console.log("count:", count());
});

setCount((value) => value + 1);
```

### DOM binding

```ts
import { createSignal, h, mount } from "shadejs";

const [name, setName] = createSignal("ShadeJS");

mount(
  () =>
    h("main", null,
      h("h1", null, () => `Hello, ${name()}`),
      h("button", { onClick: () => setName("Signals") }, "Rename")
    ),
  document.getElementById("app")!
);
```

### createQuery

```ts
import { createQuery } from "shadejs";
import { getPosts } from "./posts.server";

const posts = createQuery(getPosts, "posts");

console.log(posts().loading);
console.log(posts().data);
console.log(posts().error);
```

### createStore

```ts
import { createStore } from "shadejs";

const form = createStore({
  draft: "",
  open: false
});

form.draft = "ShadeJS";
form.open = true;
```

### .server imports

```ts
import { createMutation } from "shadejs";
import { addPost } from "./posts.server";

const { mutate, pending, error } = createMutation(addPost, {
  invalidates: ["posts"]
});

await mutate("Compiler-generated RPC");
console.log(pending(), error());
```

The compiler rewrites `.server` imports into client-side fetch stubs that call `"/__rpc/..."` routes.

### Vite plugin

```ts
import { defineConfig } from "vite";
import { shadejs } from "shadejs/compiler";

export default defineConfig({
  plugins: [shadejs()]
});
```

## Known Limitations

- No SSR or hydration
- No router
- No streaming
- Production RPC server requires running `dist/server.mjs` separately
- No concurrent mode
- v1 proof of concept; breaking changes expected

## Development

```bash
pnpm test        # run all tests
pnpm typecheck   # TypeScript checks
pnpm build       # build all packages
pnpm dev         # run demo app
```

## License

MIT

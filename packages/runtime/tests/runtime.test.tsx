// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createSignal } from "@shadowjs/core";

import { ErrorBoundary, createDOMNode, h, mount } from "../src/index";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("@shadowjs/runtime", () => {
  it("creates static DOM nodes from descriptors", () => {
    const node = createDOMNode(h("div", { id: "app" }, "Hello ", h("span", null, "world")));

    expect(node).toBeInstanceOf(HTMLDivElement);
    expect((node as HTMLDivElement).id).toBe("app");
    expect((node as HTMLDivElement).textContent).toBe("Hello world");
    expect((node as HTMLDivElement).querySelector("span")?.textContent).toBe("world");
  });

  it("updates only the targeted text node for reactive children", async () => {
    const [name, setName] = createSignal("Sarthak");
    const container = document.createElement("div");

    mount(() => h("div", null, "Hello ", h("span", null, name)), container);

    const root = container.firstElementChild;
    const span = container.querySelector("span");
    const textNode = span?.firstChild;

    expect(span?.textContent).toBe("Sarthak");

    setName("Commander");
    await waitForMicrotask();

    expect(container.firstElementChild).toBe(root);
    expect(container.querySelector("span")).toBe(span);
    expect(span?.firstChild).toBe(textNode);
    expect(span?.textContent).toBe("Commander");
  });

  it("binds reactive props to a single element", async () => {
    const [title, setTitle] = createSignal("ready");
    const container = document.createElement("div");

    mount(() => h("button", { title }, "Save"), container);

    const button = container.querySelector("button");

    expect(button?.getAttribute("title")).toBe("ready");

    setTitle("done");
    await waitForMicrotask();

    expect(container.querySelector("button")).toBe(button);
    expect(button?.getAttribute("title")).toBe("done");
  });

  it("disposes effects from the previous tree when mount is called again", async () => {
    const [title, setTitle] = createSignal("first");
    const container = document.createElement("div");

    mount(() => h("button", { title }, "Save"), container);
    const previousButton = container.querySelector("button");

    mount(() => h("p", null, "Replaced"), container);
    setTitle("second");
    await waitForMicrotask();

    expect(container.querySelector("button")).toBeNull();
    expect(previousButton?.getAttribute("title")).toBe("first");
    expect(container.textContent).toBe("Replaced");
  });

  it("stops updating a replaced reactive text node after disposal", async () => {
    const [message, setMessage] = createSignal("Hello");
    const [visible, setVisible] = createSignal(true);
    const container = document.createElement("div");

    mount(
      () =>
        h(
          "div",
          null,
          () => (visible() ? h("span", null, message) : h("strong", null, "Hidden"))
        ),
      container
    );

    const previousSpan = container.querySelector("span");

    setVisible(false);
    await waitForMicrotask();

    setMessage("Updated");
    await waitForMicrotask();

    expect(container.querySelector("span")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("Hidden");
    expect(previousSpan?.textContent).toBe("Hello");
  });

  it("inserts keyed list items without replacing existing nodes", async () => {
    const [items, setItems] = createSignal([
      { id: 1, label: "One" },
      { id: 2, label: "Two" }
    ]);
    const container = document.createElement("div");

    mount(
      () =>
        h(
          "ul",
          null,
          () => items().map((item) => h("li", { key: item.id }, item.label))
        ),
      container
    );

    const initialItems = Array.from(container.querySelectorAll("li"));

    setItems([
      { id: 1, label: "One" },
      { id: 2, label: "Two" },
      { id: 3, label: "Three" }
    ]);
    await waitForMicrotask();

    const nextItems = Array.from(container.querySelectorAll("li"));

    expect(nextItems).toHaveLength(3);
    expect(nextItems[0]).toBe(initialItems[0]);
    expect(nextItems[1]).toBe(initialItems[1]);
    expect(nextItems[2]?.textContent).toBe("Three");
  });

  it("disposes only the removed keyed item", async () => {
    const [firstLabel, setFirstLabel] = createSignal("First");
    const [secondLabel, setSecondLabel] = createSignal("Second");
    const [ids, setIds] = createSignal([1, 2]);
    const container = document.createElement("div");

    mount(
      () =>
        h(
          "ul",
          null,
          () =>
            ids().map((id) =>
              h("li", { key: id }, () => (id === 1 ? firstLabel() : secondLabel()))
            )
        ),
      container
    );

    const [firstItem, secondItem] = Array.from(container.querySelectorAll("li"));

    setIds([2]);
    await waitForMicrotask();

    setFirstLabel("Gone");
    setSecondLabel("Still here");
    await waitForMicrotask();

    const remainingItems = Array.from(container.querySelectorAll("li"));

    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0]).toBe(secondItem);
    expect(remainingItems[0]?.textContent).toBe("Still here");
    expect(firstItem?.textContent).toBe("First");
  });

  it("reorders keyed list items without recreating nodes", async () => {
    const [items, setItems] = createSignal([
      { id: 1, label: "One" },
      { id: 2, label: "Two" },
      { id: 3, label: "Three" }
    ]);
    const container = document.createElement("div");

    mount(
      () =>
        h(
          "ul",
          null,
          () => items().map((item) => h("li", { key: item.id }, item.label))
        ),
      container
    );

    const initialItems = Array.from(container.querySelectorAll("li"));

    setItems([
      { id: 3, label: "Three" },
      { id: 1, label: "One" },
      { id: 2, label: "Two" }
    ]);
    await waitForMicrotask();

    const reorderedItems = Array.from(container.querySelectorAll("li"));

    expect(reorderedItems.map((item) => item.textContent)).toEqual(["Three", "One", "Two"]);
    expect(reorderedItems[0]).toBe(initialItems[2]);
    expect(reorderedItems[1]).toBe(initialItems[0]);
    expect(reorderedItems[2]).toBe(initialItems[1]);
  });

  it("does not mutate the DOM when keyed list order is unchanged", async () => {
    const [items, setItems] = createSignal([
      { id: 1, label: "One" },
      { id: 2, label: "Two" }
    ]);
    const container = document.createElement("div");
    const insertBefore = Node.prototype.insertBefore;
    const removeChild = Node.prototype.removeChild;
    let insertions = 0;
    let removals = 0;

    mount(
      () =>
        h(
          "ul",
          null,
          () => items().map((item) => h("li", { key: item.id }, item.label))
        ),
      container
    );

    Node.prototype.insertBefore = (function patchedInsertBefore<T extends Node>(this: Node, node: T, child: Node | null): T {
      insertions += 1;
      return insertBefore.call(this, node, child) as T;
    }) as typeof Node.prototype.insertBefore;

    Node.prototype.removeChild = (function patchedRemoveChild<T extends Node>(this: Node, child: T): T {
      removals += 1;
      return removeChild.call(this, child) as T;
    }) as typeof Node.prototype.removeChild;

    try {
      setItems([
        { id: 1, label: "One" },
        { id: 2, label: "Two" }
      ]);
      await waitForMicrotask();
    } finally {
      Node.prototype.insertBefore = insertBefore;
      Node.prototype.removeChild = removeChild;
    }

    expect(insertions).toBe(0);
    expect(removals).toBe(0);
  });

  it("lets sibling error boundaries catch their own errors independently", async () => {
    const [firstBroken, setFirstBroken] = createSignal(false);
    const [secondBroken, setSecondBroken] = createSignal(false);
    const container = document.createElement("div");

    mount(
      () =>
        h(
          "section",
          null,
          h(
            ErrorBoundary,
            {
              fallback: (error: Error) => h("p", { id: "first-fallback" }, error.message)
            },
            h("span", { id: "first-child" }, () => {
              if (firstBroken()) {
                throw new Error("first boundary");
              }

              return "First ok";
            })
          ),
          h(
            ErrorBoundary,
            {
              fallback: (error: Error) => h("p", { id: "second-fallback" }, error.message)
            },
            h("span", { id: "second-child" }, () => {
              if (secondBroken()) {
                throw new Error("second boundary");
              }

              return "Second ok";
            })
          )
        ),
      container
    );

    setFirstBroken(true);
    await waitForMicrotask();

    expect(container.querySelector("#first-fallback")?.textContent).toBe("first boundary");
    expect(container.querySelector("#second-fallback")).toBeNull();
    expect(container.querySelector("#second-child")?.textContent).toBe("Second ok");

    setSecondBroken(true);
    await waitForMicrotask();

    expect(container.querySelector("#first-fallback")?.textContent).toBe("first boundary");
    expect(container.querySelector("#second-fallback")?.textContent).toBe("second boundary");
  });
});

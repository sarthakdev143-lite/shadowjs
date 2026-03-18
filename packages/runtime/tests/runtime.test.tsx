// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createSignal } from "@shadowjs/core";

import { createDOMNode, h, mount } from "../src/index";

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
});

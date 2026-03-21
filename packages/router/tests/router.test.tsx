// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { h, mount } from "@sarthakdev143/runtime";

import { Link, createRouter, currentParams, currentPath, matchRoute, navigate } from "../src/index";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("@sarthakdev143/router", () => {
  beforeEach(async () => {
    navigate("/");
    await waitForMicrotask();
  });

  it('matches "/posts/:id" against "/posts/42"', () => {
    expect(matchRoute("/posts/:id", "/posts/42")).toEqual({ id: "42" });
  });

  it('returns null for length mismatches', () => {
    expect(matchRoute("/posts/:id", "/posts/42/edit")).toBeNull();
  });

  it('matches exact static routes', () => {
    expect(matchRoute("/about", "/about")).toEqual({});
  });

  it('returns null for different static routes', () => {
    expect(matchRoute("/about", "/contact")).toBeNull();
  });

  it("updates the currentPath signal when navigating", async () => {
    navigate("/about?from=test");
    await waitForMicrotask();

    expect(currentPath()).toBe("/about");
  });

  it("renders the matched component and updates route params", async () => {
    const Router = createRouter([
      {
        component: () => h("p", { id: "home" }, "Home"),
        path: "/"
      },
      {
        component: () => h("p", { id: "post" }, () => `Post ${currentParams().id}`),
        path: "/posts/:id"
      }
    ]);
    const container = document.createElement("div");

    mount(Router, container);
    expect(container.querySelector("#home")?.textContent).toBe("Home");

    navigate("/posts/42");
    await waitForMicrotask();

    expect(container.querySelector("#post")?.textContent).toBe("Post 42");
  });

  it("returns null for unmatched routes", () => {
    const Router = createRouter([
      {
        component: () => h("p", null, "Home"),
        path: "/"
      }
    ]);
    const container = document.createElement("div");

    navigate("/missing");
    mount(Router, container);

    expect(container.textContent).toBe("");
  });

  it("renders Link as an anchor tag", () => {
    const container = document.createElement("div");

    mount(() => h(Link, { href: "/about" }, "About"), container);
    const anchor = container.querySelector("a");

    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor?.getAttribute("href")).toBe("/about");
  });

  it("intercepts Link clicks and updates the router", async () => {
    const container = document.createElement("div");

    mount(() => h(Link, { href: "/about" }, "About"), container);
    const anchor = container.querySelector("a");

    expect(anchor).not.toBeNull();

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true
    });
    const dispatched = anchor!.dispatchEvent(event);
    await waitForMicrotask();

    expect(dispatched).toBe(false);
    expect(currentPath()).toBe("/about");
  });
});

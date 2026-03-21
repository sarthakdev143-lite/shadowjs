import { describe, expect, it } from "vitest";

import { h } from "../src/index";

describe("@sarthakdev143/runtime JSX types", () => {
  it("accepts valid div props", () => {
    const node = h("div", { className: "foo" }, "hello");

    expect(node.tag).toBe("div");
    expect(node.props.className).toBe("foo");
  });

  it("rejects unknown div props at compile time", () => {
    // @ts-expect-error invalid prop name should fail typechecking
    h("div", { onClik: () => {} });

    expect(true).toBe(true);
  });

  it("accepts input value props", () => {
    const node = h("input", { value: "hello" });

    expect(node.tag).toBe("input");
    expect(node.props.value).toBe("hello");
  });

  it("accepts reactive button props", () => {
    const node = h("button", { disabled: () => false }, "Save");

    expect(node.tag).toBe("button");
    expect(typeof node.props.disabled).toBe("function");
  });

  it("accepts anchor href props", () => {
    const node = h("a", { href: "https://example.com" }, "Example");

    expect(node.tag).toBe("a");
    expect(node.props.href).toBe("https://example.com");
  });
});

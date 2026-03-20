// @vitest-environment jsdom

import { bench } from "vitest";

import { createEffect, createMemo, createSignal, flushEffects } from "../../../packages/core/src/index";
import { h, mount } from "../../../packages/runtime/src/index";

const benchmarkOptions = {
  iterations: 5,
  time: 25,
  warmupIterations: 0,
  warmupTime: 0
} as const;

bench("1000 signal writes triggering 1 effect each", () => {
  const setters = Array.from({ length: 1000 }, () => {
    const [value, setValue] = createSignal(0);
    createEffect(() => {
      value();
    });
    return setValue;
  });

  for (const setValue of setters) {
    setValue(1);
  }

  flushEffects();
}, benchmarkOptions);

bench("add one item to 100-item keyed list", () => {
  document.body.replaceChildren();

  const container = document.createElement("div");
  const [items, setItems] = createSignal(
    Array.from({ length: 100 }, (_, index) => ({
      id: index,
      label: `Item ${index}`
    }))
  );

  document.body.appendChild(container);
  mount(
    () =>
      h(
        "ul",
        null,
        () => items().map((item) => h("li", { key: item.id }, item.label))
      ),
    container
  );

  setItems((currentItems) => [
    ...currentItems,
    {
      id: 100,
      label: "Item 100"
    }
  ]);
  flushEffects();
  void container.querySelectorAll("li").length;
}, benchmarkOptions);

bench("50-deep memo chain recalculation", () => {
  const [root, setRoot] = createSignal(0);
  let current = root;

  for (let index = 0; index < 50; index += 1) {
    const previous = current;
    current = createMemo(() => previous() + 1);
  }

  setRoot(1);
  flushEffects();
  void current();
}, benchmarkOptions);

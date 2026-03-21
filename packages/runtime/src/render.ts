import { flushMountCallbacks, withCleanupScope } from "@sarthakdev143/core";

import type { Renderable } from "./jsx";
import { createDOMNode, disposeNode } from "./dom";

const rootCleanups = new WeakMap<Element, () => void>();

export function mount(component: () => Renderable, container: Element): void {
  rootCleanups.get(container)?.();

  for (const child of Array.from(container.childNodes)) {
    disposeNode(child);
  }

  const { dispose, value } = withCleanupScope(() => {
    const root = createDOMNode(component());
    container.replaceChildren(root);
    flushMountCallbacks();
    return root;
  });

  void value;
  rootCleanups.set(container, dispose);
}

import type { Renderable } from "./jsx";
import { createDOMNode, disposeNode } from "./dom";

export function mount(component: () => Renderable, container: Element): void {
  for (const child of Array.from(container.childNodes)) {
    disposeNode(child);
  }

  container.replaceChildren(createDOMNode(component()));
}

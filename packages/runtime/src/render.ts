import type { Renderable } from "./jsx";
import { createDOMNode } from "./dom";

export function mount(component: () => Renderable, container: Element): void {
  container.replaceChildren(createDOMNode(component()));
}

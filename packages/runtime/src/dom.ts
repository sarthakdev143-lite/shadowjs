import { createEffect } from "@shadowjs/core";

import { Fragment, type JSXDescriptor, type Primitive, type Props, type ReactiveChild, type Renderable } from "./jsx";

type DOMPropertyTarget = Element & Record<string, unknown>;
const nodeDisposers = new WeakMap<Node, Array<() => void>>();

function isDescriptor(value: unknown): value is JSXDescriptor {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "tag" in value && "props" in value && "children" in value;
}

function isDOMNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

function isTextValue(value: Renderable): value is Primitive {
  return (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

function toTextContent(value: Primitive): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }

  return String(value);
}

function insertNodes(parent: Node, anchor: Node | null, nodes: Node[]): void {
  for (const node of nodes) {
    parent.insertBefore(node, anchor);
  }
}

function registerDisposer(node: Node, dispose: () => void): void {
  const disposers = nodeDisposers.get(node) ?? [];
  disposers.push(dispose);
  nodeDisposers.set(node, disposers);
}

function createTextNode(value: Primitive): Text {
  return document.createTextNode(toTextContent(value));
}

function setStyleObject(element: HTMLElement, styles: Record<string, unknown>): void {
  for (const [property, value] of Object.entries(styles)) {
    const serializedValue = value === null || value === undefined ? "" : String(value);
    element.style.setProperty(property, serializedValue);
  }
}

function setElementProperty(element: Element, key: string, value: unknown): void {
  const attributeName = key === "className" ? "class" : key;
  const propertyName = key === "class" ? "className" : key;
  const target = element as DOMPropertyTarget;

  if (propertyName === "style" && typeof value === "object" && value !== null && !Array.isArray(value)) {
    setStyleObject(element as HTMLElement, value as Record<string, unknown>);
    return;
  }

  if (value === null || value === undefined || value === false) {
    if (propertyName in target && !attributeName.includes("-")) {
      target[propertyName] = value === false ? false : "";
    }

    element.removeAttribute(attributeName);
    return;
  }

  if (value === true) {
    if (propertyName in target && !attributeName.includes("-")) {
      target[propertyName] = true;
    }

    element.setAttribute(attributeName, "");
    return;
  }

  if (propertyName in target && !attributeName.includes("-")) {
    target[propertyName] = value;
    return;
  }

  element.setAttribute(attributeName, String(value));
}

function applyProps(element: Element, props: Props): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      continue;
    }

    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      continue;
    }

    if (typeof value === "function") {
      const accessor = value as ReactiveChild;

      const dispose = createEffect(() => {
        setElementProperty(element, key, accessor());
      });
      registerDisposer(element, dispose);

      continue;
    }

    setElementProperty(element, key, value);
  }
}

function updateReactiveNodes(anchor: Comment, currentNodes: Node[], value: Renderable): Node[] {
  if (currentNodes.length === 1 && currentNodes[0] instanceof Text && isTextValue(value)) {
    currentNodes[0].data = toTextContent(value);
    return currentNodes;
  }

  const nextNodes = createDOMNodes(value);
  const parent = anchor.parentNode;

  if (parent === null) {
    return nextNodes;
  }

  for (const node of currentNodes) {
    disposeNode(node);
    parent.removeChild(node);
  }

  insertNodes(parent, anchor, nextNodes);
  return nextNodes;
}

function createReactiveNodes(accessor: ReactiveChild): Node[] {
  const anchor = document.createComment("shadow-anchor");
  let currentNodes = createDOMNodes(accessor());
  let isFirstRun = true;

  const dispose = createEffect(() => {
    const value = accessor();

    if (isFirstRun) {
      isFirstRun = false;
      return;
    }

    currentNodes = updateReactiveNodes(anchor, currentNodes, value);
  });
  registerDisposer(anchor, dispose);

  return [...currentNodes, anchor];
}

function createElementNodes(descriptor: JSXDescriptor): Node[] {
  if (descriptor.tag === Fragment) {
    return descriptor.children.flatMap((child) => createDOMNodes(child));
  }

  if (typeof descriptor.tag === "function") {
    return createDOMNodes(
      descriptor.tag({
        ...descriptor.props,
        children: descriptor.children
      })
    );
  }

  const element = document.createElement(descriptor.tag);
  applyProps(element, descriptor.props);

  for (const child of descriptor.children) {
    insertNodes(element, null, createDOMNodes(child));
  }

  return [element];
}

function createDOMNodes(value: Renderable): Node[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => createDOMNodes(entry));
  }

  if (typeof value === "function") {
    return createReactiveNodes(value as ReactiveChild);
  }

  if (isDescriptor(value)) {
    return createElementNodes(value);
  }

  if (isDOMNode(value)) {
    return [value];
  }

  if (isTextValue(value)) {
    return [createTextNode(value)];
  }

  return [];
}

export function createDOMNode(value: Renderable): Node {
  const nodes = createDOMNodes(value);

  if (nodes.length === 0) {
    return document.createComment("shadow-empty");
  }

  if (nodes.length === 1) {
    return nodes[0];
  }

  const fragment = document.createDocumentFragment();
  insertNodes(fragment, null, nodes);
  return fragment;
}

export function disposeNode(node: Node): void {
  const disposers = nodeDisposers.get(node);

  if (disposers !== undefined) {
    for (const dispose of disposers) {
      dispose();
    }

    nodeDisposers.delete(node);
  }

  for (const child of Array.from(node.childNodes)) {
    disposeNode(child);
  }
}

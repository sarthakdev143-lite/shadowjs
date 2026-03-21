import { createEffect } from "@sarthakdev143/core";

import {
  Fragment,
  renderWithProvider,
  type JSXDescriptor,
  type Primitive,
  type Props,
  type ReactiveChild,
  type Renderable
} from "./jsx";
import { configureKeyedReconciler, reconcileKeyedList, type KeyedNode } from "./reconciler";

type DOMPropertyTarget = Element & Record<string, unknown>;
const nodeDisposers = new WeakMap<Node, Array<() => void>>();
type ScopedReactiveChild = ReactiveChild & {
  __shadowPopErrorHandler?: () => void;
};
type ReactiveNodeState =
  | {
      kind: "keyed";
      items: KeyedNode[];
    }
  | {
      kind: "nodes";
      nodes: Node[];
    };

function isDescriptor(value: unknown): value is JSXDescriptor {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "tag" in value && "props" in value && "children" in value;
}

function isDOMNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

function isKeyedDescriptorArray(value: Renderable): value is JSXDescriptor[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const [firstDescriptor] = value;

  if (!isDescriptor(firstDescriptor) || (typeof firstDescriptor.props.key !== "string" && typeof firstDescriptor.props.key !== "number")) {
    return false;
  }

  return value.every(
    (entry) =>
      isDescriptor(entry) && (typeof entry.props.key === "string" || typeof entry.props.key === "number")
  );
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

function stripKeyProp(props: Props): Props {
  const { key: _key, ...rest } = props;
  return rest;
}

function flattenKeyedNodes(items: KeyedNode[]): Node[] {
  const nodes: Node[] = [];

  for (const item of items) {
    nodes.push(...item.nodes, item.anchor);
  }

  return nodes;
}

function getStateNodes(state: ReactiveNodeState): Node[] {
  return state.kind === "keyed" ? flattenKeyedNodes(state.items) : state.nodes;
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
    if (key === "children" || key === "key") {
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

function disposeNodes(nodes: Node[]): void {
  for (const node of nodes) {
    disposeNode(node);

    if (node.parentNode !== null) {
      node.parentNode.removeChild(node);
    }
  }
}

function disposeReactiveState(state: ReactiveNodeState): void {
  if (state.kind === "keyed") {
    for (const item of state.items) {
      item.dispose();
    }

    return;
  }

  disposeNodes(state.nodes);
}

function createReactiveState(value: Renderable): ReactiveNodeState {
  if (isKeyedDescriptorArray(value)) {
    return {
      items: value.map((descriptor) => createKeyedNode(descriptor)),
      kind: "keyed"
    };
  }

  return {
    kind: "nodes",
    nodes: createDOMNodes(value)
  };
}

function updateReactiveNodes(anchor: Comment, currentState: ReactiveNodeState, value: Renderable): ReactiveNodeState {
  if (currentState.kind === "nodes" && currentState.nodes.length === 1 && currentState.nodes[0] instanceof Text && isTextValue(value)) {
    currentState.nodes[0].data = toTextContent(value);
    return currentState;
  }

  const parent = anchor.parentNode;

  if (parent === null) {
    disposeReactiveState(currentState);
    return createReactiveState(value);
  }

  if (isKeyedDescriptorArray(value)) {
    if (currentState.kind === "nodes") {
      disposeNodes(currentState.nodes);
    }

    return {
      items: reconcileKeyedList(parent, anchor, currentState.kind === "keyed" ? currentState.items : [], value),
      kind: "keyed"
    };
  }

  disposeReactiveState(currentState);

  const nextNodes = createDOMNodes(value);
  insertNodes(parent, anchor, nextNodes);

  return {
    kind: "nodes",
    nodes: nextNodes
  };
}

function createReactiveNodes(accessor: ReactiveChild): Node[] {
  const anchor = document.createComment("shadow-anchor");
  const scopedAccessor = accessor as ScopedReactiveChild;
  const popErrorHandler = scopedAccessor.__shadowPopErrorHandler;

  try {
    let currentState = createReactiveState(accessor());
    let isFirstRun = true;

    const dispose = createEffect(() => {
      const value = accessor();

      if (isFirstRun) {
        isFirstRun = false;
        return;
      }

      currentState = updateReactiveNodes(anchor, currentState, value);
    });
    registerDisposer(anchor, dispose);

    return [...getStateNodes(currentState), anchor];
  } finally {
    if (popErrorHandler !== undefined) {
      delete scopedAccessor.__shadowPopErrorHandler;
      popErrorHandler();
    }
  }
}

function createElementNodes(descriptor: JSXDescriptor): Node[] {
  if (descriptor.tag === Fragment) {
    return descriptor.children.flatMap((child) => createDOMNodes(child));
  }

  if (typeof descriptor.tag === "function") {
    const component = descriptor.tag;

    return renderWithProvider(
      component,
      stripKeyProp(descriptor.props),
      descriptor.children,
      () =>
        createDOMNodes(
          component({
            ...stripKeyProp(descriptor.props),
            children: descriptor.children
          })
        )
    );
  }

  const element = document.createElement(descriptor.tag);
  applyProps(element, descriptor.props);

  for (const child of descriptor.children) {
    insertNodes(element, null, createDOMNodes(child));
  }

  return [element];
}

function createKeyedNode(descriptor: JSXDescriptor): KeyedNode {
  const key = descriptor.props.key;

  if (typeof key !== "string" && typeof key !== "number") {
    throw new Error("Keyed list items must use string or number keys.");
  }

  const nodes = createDOMNodes({
    children: descriptor.children,
    props: stripKeyProp(descriptor.props),
    tag: descriptor.tag
  });
  const anchor = document.createComment("shadow-keyed");

  return {
    anchor,
    dispose: () => {
      disposeNodes(nodes);
      disposeNode(anchor);

      if (anchor.parentNode !== null) {
        anchor.parentNode.removeChild(anchor);
      }
    },
    key,
    nodes
  };
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

configureKeyedReconciler({
  createKeyedNode,
  insertNodes
});

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

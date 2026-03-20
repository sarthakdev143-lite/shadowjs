import type { JSXDescriptor, Key } from "./jsx";

export interface KeyedNode {
  key: Key;
  nodes: Node[];
  anchor: Comment;
  dispose: () => void;
}

type CreateKeyedNode = (descriptor: JSXDescriptor) => KeyedNode;
type InsertNodes = (parent: Node, anchor: Node | null, nodes: Node[]) => void;

let createKeyedNode: CreateKeyedNode | null = null;
let insertNodes: InsertNodes | null = null;

function assertConfigured(): { createKeyedNode: CreateKeyedNode; insertNodes: InsertNodes } {
  if (createKeyedNode === null || insertNodes === null) {
    throw new Error("Keyed reconciler helpers are not configured.");
  }

  return {
    createKeyedNode,
    insertNodes
  };
}

function getKey(descriptor: JSXDescriptor): Key {
  const { key } = descriptor.props;

  if (typeof key !== "string" && typeof key !== "number") {
    throw new Error("Keyed list items must use string or number keys.");
  }

  return key;
}

function getItemStart(item: KeyedNode): Node {
  return item.nodes[0] ?? item.anchor;
}

function moveKeyedNode(parent: Node, anchor: Node | null, item: KeyedNode, insertNodesImpl: InsertNodes): void {
  insertNodesImpl(parent, anchor, [...item.nodes, item.anchor]);
}

export function configureKeyedReconciler(helpers: {
  createKeyedNode: CreateKeyedNode;
  insertNodes: InsertNodes;
}): void {
  createKeyedNode = helpers.createKeyedNode;
  insertNodes = helpers.insertNodes;
}

export function reconcileKeyedList(
  parent: Node,
  endAnchor: Comment,
  previousItems: KeyedNode[],
  nextDescriptors: JSXDescriptor[]
): KeyedNode[] {
  const { createKeyedNode: createKeyedNodeImpl, insertNodes: insertNodesImpl } = assertConfigured();
  const previousByKey = new Map<Key, KeyedNode>();
  const seenKeys = new Set<Key>();
  const nextItems: KeyedNode[] = [];

  for (const item of previousItems) {
    previousByKey.set(item.key, item);
  }

  for (const descriptor of nextDescriptors) {
    const key = getKey(descriptor);
    const existing = previousByKey.get(key);

    nextItems.push(existing ?? createKeyedNodeImpl(descriptor));
    seenKeys.add(key);
  }

  for (const item of previousItems) {
    if (!seenKeys.has(item.key)) {
      item.dispose();
    }
  }

  let cursor: Node = endAnchor;

  for (let index = nextItems.length - 1; index >= 0; index -= 1) {
    const item = nextItems[index];
    const start = getItemStart(item);

    if (start.parentNode !== parent || item.anchor.nextSibling !== cursor) {
      moveKeyedNode(parent, cursor, item, insertNodesImpl);
    }

    cursor = start;
  }

  return nextItems;
}

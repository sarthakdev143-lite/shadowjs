import { createSignal, type Accessor, type Setter } from "@murkjs/core";

interface SignalEntry<T> {
  read: Accessor<T>;
  write: Setter<T>;
}

type SignalStore = Map<PropertyKey, SignalEntry<unknown>>;
interface ReactiveMetadata {
  childInvalidators: Map<PropertyKey, () => void>;
  parentInvalidators: Set<() => void>;
  signals: SignalStore;
}

const metadataStore = new WeakMap<object, ReactiveMetadata>();
const proxyCache = new WeakMap<object, object>();

function createEntry<T>(value: T): SignalEntry<T> {
  const [read, write] = createSignal(value);
  return { read, write };
}

function getMetadata(target: object): ReactiveMetadata {
  const existing = metadataStore.get(target);

  if (existing !== undefined) {
    return existing;
  }

  const metadata: ReactiveMetadata = {
    childInvalidators: new Map<PropertyKey, () => void>(),
    parentInvalidators: new Set<() => void>(),
    signals: new Map<PropertyKey, SignalEntry<unknown>>()
  };
  metadataStore.set(target, metadata);
  return metadata;
}

function ensureEntry<T extends object>(
  target: T,
  signals: SignalStore,
  key: PropertyKey
): SignalEntry<unknown> {
  const existing = signals.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const value = Reflect.get(target, key) as unknown;
  const nextEntry = createEntry(value);
  signals.set(key, nextEntry);
  return nextEntry;
}

function isReactiveObject(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function propagateToParents(metadata: ReactiveMetadata): void {
  for (const invalidateParent of metadata.parentInvalidators) {
    invalidateParent();
  }
}

function getChildInvalidator(target: object, key: PropertyKey): () => void {
  const metadata = getMetadata(target);
  const existing = metadata.childInvalidators.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const invalidator = () => {
    ensureEntry(target, metadata.signals, key).write(Reflect.get(target, key));
    propagateToParents(metadata);
  };
  metadata.childInvalidators.set(key, invalidator);
  return invalidator;
}

function linkChildToParent(target: object, key: PropertyKey, value: unknown): void {
  if (!isReactiveObject(value)) {
    return;
  }

  getMetadata(value).parentInvalidators.add(getChildInvalidator(target, key));
}

function unlinkChildFromParent(target: object, key: PropertyKey, value: unknown): void {
  if (!isReactiveObject(value)) {
    return;
  }

  getMetadata(value).parentInvalidators.delete(getChildInvalidator(target, key));
}

function makeReactive<T extends object>(target: T): T {
  const cachedProxy = proxyCache.get(target);

  if (cachedProxy !== undefined) {
    return cachedProxy as T;
  }

  const proxy = new Proxy(target, {
    get(currentTarget, key, receiver) {
      if (typeof key === "symbol") {
        return Reflect.get(currentTarget, key, receiver);
      }

      if (!Reflect.has(currentTarget, key)) {
        return Reflect.get(currentTarget, key, receiver);
      }

      const metadata = getMetadata(currentTarget);
      const value = ensureEntry(currentTarget, metadata.signals, key).read();

      if (isReactiveObject(value)) {
        linkChildToParent(currentTarget, key, value);
        return makeReactive(value);
      }

      return value;
    },
    getOwnPropertyDescriptor(currentTarget, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(currentTarget, key);

      if (descriptor !== undefined) {
        return descriptor;
      }

      if (!Reflect.has(currentTarget, key)) {
        return undefined;
      }

      return {
        configurable: true,
        enumerable: true,
        value: Reflect.get(currentTarget, key),
        writable: true
      };
    },
    has(currentTarget, key) {
      return Reflect.has(currentTarget, key);
    },
    ownKeys(currentTarget) {
      return Reflect.ownKeys(currentTarget);
    },
    set(currentTarget, key, value, receiver) {
      const previousValue = Reflect.get(currentTarget, key, receiver);
      unlinkChildFromParent(currentTarget, key, previousValue);

      const result = Reflect.set(currentTarget, key, value, receiver);
      const metadata = getMetadata(currentTarget);

      ensureEntry(currentTarget, metadata.signals, key).write(value);
      linkChildToParent(currentTarget, key, value);
      propagateToParents(metadata);

      return result;
    }
  });

  proxyCache.set(target, proxy);
  return proxy as T;
}

export function createStore<T extends object>(initialState: T): T {
  return makeReactive({ ...initialState });
}

import { createSignal, type Accessor, type Setter } from "@shadowjs/core";

interface SignalEntry<T> {
  read: Accessor<T>;
  write: Setter<T>;
}

type SignalStore = Map<PropertyKey, SignalEntry<unknown>>;

function createEntry<T>(value: T): SignalEntry<T> {
  const [read, write] = createSignal(value);
  return { read, write };
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

export function createStore<T extends object>(initialState: T): T {
  const target = { ...initialState };
  const signals: SignalStore = new Map<PropertyKey, SignalEntry<unknown>>();

  return new Proxy(target, {
    get(currentTarget, key, receiver) {
      if (typeof key === "symbol") {
        return Reflect.get(currentTarget, key, receiver);
      }

      if (!Reflect.has(currentTarget, key)) {
        return Reflect.get(currentTarget, key, receiver);
      }

      return ensureEntry(currentTarget, signals, key).read();
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
      const result = Reflect.set(currentTarget, key, value, receiver);
      ensureEntry(currentTarget, signals, key).write(value);
      return result;
    }
  });
}

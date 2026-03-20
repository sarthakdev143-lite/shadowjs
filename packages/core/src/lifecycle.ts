import { onCleanup, popCleanupScope, pushCleanupScope } from "./context";

type MountCallback = () => (() => void) | void;

const mountQueue: MountCallback[] = [];

export function onMount(fn: MountCallback): void {
  mountQueue.push(fn);
}

export function flushMountCallbacks(): void {
  const callbacks = mountQueue.splice(0);

  for (const callback of callbacks) {
    const cleanup = callback();

    if (typeof cleanup === "function") {
      onCleanup(cleanup);
    }
  }
}

export function withCleanupScope<T>(fn: () => T): { dispose: () => void; value: T } {
  const dispose = pushCleanupScope();

  try {
    return {
      dispose,
      value: fn()
    };
  } finally {
    popCleanupScope();
  }
}

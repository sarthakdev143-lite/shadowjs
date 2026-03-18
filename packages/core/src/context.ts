import type { Computation } from "./signal";

export let currentObserver: Computation | null = null;

export function runWithObserver<T>(observer: Computation, fn: () => T): T {
  const previousObserver = currentObserver;
  currentObserver = observer;

  try {
    return fn();
  } finally {
    currentObserver = previousObserver;
  }
}

import type { Computation } from "./signal";

export const pendingEffects = new Set<Computation>();

export let isFlushing = false;
let isFlushQueued = false;

function getPriority(computation: Computation): number {
  return computation.kind === "memo" ? 0 : 1;
}

function getNextComputation(): Computation | null {
  const computations = Array.from(pendingEffects);

  if (computations.length === 0) {
    return null;
  }

  computations.sort((left, right) => {
    const priorityDelta = getPriority(left) - getPriority(right);
    return priorityDelta !== 0 ? priorityDelta : left.id - right.id;
  });

  const next = computations[0];
  pendingEffects.delete(next);
  return next;
}

function queueFlush(): void {
  if (isFlushQueued || isFlushing) {
    return;
  }

  isFlushQueued = true;
  queueMicrotask(flushEffects);
}

export function scheduleEffect(computation: Computation): void {
  if (computation.running || computation.scheduled) {
    return;
  }

  computation.dirty = true;
  computation.scheduled = true;
  pendingEffects.add(computation);
  queueFlush();
}

export function flushEffects(): void {
  if (isFlushing) {
    return;
  }

  isFlushQueued = false;
  isFlushing = true;

  try {
    while (pendingEffects.size > 0) {
      const computation = getNextComputation();

      if (computation === null) {
        break;
      }

      computation.scheduled = false;

      if (!computation.dirty || computation.running) {
        continue;
      }

      computation.execute();
    }
  } finally {
    isFlushing = false;

    if (pendingEffects.size > 0) {
      queueFlush();
    }
  }
}

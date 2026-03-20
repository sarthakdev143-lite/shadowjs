import { currentObserver, runWithObserver } from "./context";
import { pendingEffects, scheduleEffect } from "./scheduler";

export type Accessor<T> = () => T;
export type Updater<T> = T | ((previousValue: T) => T);
export type Setter<T> = (value: Updater<T>) => T;

interface DependencySource {
  subscribers: Set<Computation>;
}

interface SignalState<T> extends DependencySource {
  value: T;
}

interface MemoState<T> extends DependencySource {
  computation: Computation;
  initialized: boolean;
  value: T;
}

export interface Computation {
  dependencies: Set<DependencySource>;
  dirty: boolean;
  execute: () => void;
  id: number;
  kind: "effect" | "memo";
  running: boolean;
  scheduled: boolean;
}

let nextComputationId = 0;

function createDependencySource(): DependencySource {
  return {
    subscribers: new Set<Computation>()
  };
}

function cleanupComputation(computation: Computation): void {
  for (const dependency of computation.dependencies) {
    dependency.subscribers.delete(computation);
  }

  computation.dependencies.clear();
}

function trackDependency(source: DependencySource): void {
  if (currentObserver === null) {
    return;
  }

  if (currentObserver.dependencies.has(source)) {
    return;
  }

  currentObserver.dependencies.add(source);
  source.subscribers.add(currentObserver);
}

function notifySubscribers(source: DependencySource): void {
  for (const subscriber of Array.from(source.subscribers)) {
    if (subscriber === currentObserver) {
      continue;
    }

    scheduleEffect(subscriber);
  }
}

function resolveUpdater<T>(value: Updater<T>, currentValue: T): T {
  if (typeof value === "function") {
    return (value as (previousValue: T) => T)(currentValue);
  }

  return value;
}

function createComputation(kind: "effect" | "memo", execute: () => void): Computation {
  return {
    dependencies: new Set<DependencySource>(),
    dirty: false,
    execute,
    id: nextComputationId++,
    kind,
    running: false,
    scheduled: false
  };
}

export function createSignal<T>(initialValue: T): [Accessor<T>, Setter<T>] {
  const state: SignalState<T> = {
    ...createDependencySource(),
    value: initialValue
  };

  const read = (): T => {
    trackDependency(state);
    return state.value;
  };

  const write: Setter<T> = (value) => {
    const nextValue = resolveUpdater(value, state.value);

    if (Object.is(state.value, nextValue)) {
      return state.value;
    }

    state.value = nextValue;
    notifySubscribers(state);
    return state.value;
  };

  return [read, write];
}

export function createEffect(effect: () => void): () => void {
  const computation = createComputation("effect", () => {
    computation.running = true;
    computation.dirty = false;
    cleanupComputation(computation);

    try {
      runWithObserver(computation, effect);
    } finally {
      computation.running = false;
    }
  });

  computation.execute();

  return function dispose(): void {
    cleanupComputation(computation);
    computation.dirty = false;
    computation.scheduled = false;
    pendingEffects.delete(computation);
  };
}

export function createMemo<T>(memo: () => T): Accessor<T> {
  const state = createDependencySource() as MemoState<T>;

  const computation = createComputation("memo", () => {
    const hadValue = state.initialized;
    const previousValue = state.value;

    computation.running = true;
    computation.dirty = false;
    cleanupComputation(computation);

    try {
      state.value = runWithObserver(computation, memo);
      state.initialized = true;
    } finally {
      computation.running = false;
    }

    if (!hadValue || !Object.is(previousValue, state.value)) {
      notifySubscribers(state);
    }
  });

  state.computation = computation;
  state.initialized = false;
  computation.execute();

  return (): T => {
    trackDependency(state);

    if (computation.dirty && !computation.running) {
      computation.execute();
    }

    return state.value;
  };
}

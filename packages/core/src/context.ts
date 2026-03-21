import type { Computation } from "./signal";

export let currentObserver: Computation | null = null;
type ErrorHandler = (error: unknown, computation: Computation) => void;
type CleanupScope = Array<() => void>;
const contextStack = new Map<symbol, unknown[]>();
const cleanupStack: CleanupScope[] = [];
const errorHandlerStack: ErrorHandler[] = [];

export interface Context<T> {
  id: symbol;
  defaultValue: T;
}

export function createContext<T>(defaultValue: T): Context<T> {
  return {
    defaultValue,
    id: Symbol("shadejs.context")
  };
}

export function provideContext<T, TResult>(context: Context<T>, value: T, fn: () => TResult): TResult {
  const stack = contextStack.get(context.id) ?? [];
  stack.push(value);
  contextStack.set(context.id, stack);

  try {
    return fn();
  } finally {
    stack.pop();

    if (stack.length === 0) {
      contextStack.delete(context.id);
    }
  }
}

export function useContext<T>(context: Context<T>): T {
  const stack = contextStack.get(context.id);

  if (stack === undefined || stack.length === 0) {
    return context.defaultValue;
  }

  return stack[stack.length - 1] as T;
}

export function runWithObserver<T>(observer: Computation, fn: () => T): T {
  const previousObserver = currentObserver;
  currentObserver = observer;

  try {
    return fn();
  } finally {
    currentObserver = previousObserver;
  }
}

export function pushErrorHandler(handler: ErrorHandler): () => void {
  errorHandlerStack.push(handler);

  return function pop(): void {
    const index = errorHandlerStack.lastIndexOf(handler);

    if (index !== -1) {
      errorHandlerStack.splice(index, 1);
    }
  };
}

export function getActiveErrorHandler(): ErrorHandler | null {
  return errorHandlerStack[errorHandlerStack.length - 1] ?? null;
}

export function runWithErrorHandler<T>(handler: ErrorHandler | null, fn: () => T): T {
  if (handler === null) {
    return fn();
  }

  const popHandler = pushErrorHandler(handler);

  try {
    return fn();
  } finally {
    popHandler();
  }
}

export function pushCleanupScope(): () => void {
  const scope: CleanupScope = [];
  cleanupStack.push(scope);

  return function runCleanups(): void {
    const index = cleanupStack.lastIndexOf(scope);

    if (index !== -1) {
      cleanupStack.splice(index, 1);
    }

    for (const cleanup of scope) {
      cleanup();
    }
  };
}

export function popCleanupScope(): void {
  cleanupStack.pop();
}

export function onCleanup(fn: () => void): void {
  const scope = cleanupStack[cleanupStack.length - 1];

  if (scope !== undefined) {
    scope.push(fn);
  }
}

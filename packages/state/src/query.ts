import { createSignal, onCleanup, type Accessor } from "@shadowjs/core";

export interface QueryState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

type QueryRunner = () => Promise<void>;

const inFlightRequests = new Map<string, Promise<unknown>>();
const queryRegistry = new Map<string, Set<QueryRunner>>();
let nextAnonymousQueryId = 0;

function getQueryKey(asyncFunction: () => Promise<unknown>, key?: string): string {
  if (key !== undefined) {
    return key;
  }

  if (asyncFunction.name.length > 0) {
    return asyncFunction.name;
  }

  const fallbackKey = `query-${nextAnonymousQueryId}`;
  nextAnonymousQueryId += 1;
  return fallbackKey;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function registerQuery(key: string, runner: QueryRunner): void {
  const existing = queryRegistry.get(key);

  if (existing !== undefined) {
    existing.add(runner);
    return;
  }

  queryRegistry.set(key, new Set<QueryRunner>([runner]));
}

function deregisterQuery(key: string, runner: QueryRunner): void {
  const runners = queryRegistry.get(key);

  if (runners === undefined) {
    return;
  }

  runners.delete(runner);

  if (runners.size === 0) {
    queryRegistry.delete(key);
  }
}

export async function invalidateQueryKeys(keys: string[]): Promise<void> {
  const queuedRunners = new Set<QueryRunner>();

  for (const key of keys) {
    inFlightRequests.delete(key);

    const runners = queryRegistry.get(key);

    if (runners === undefined) {
      continue;
    }

    for (const runner of runners) {
      queuedRunners.add(runner);
    }
  }

  await Promise.allSettled(Array.from(queuedRunners, (runner) => runner()));
}

export function getQueryRegistrySize(): number {
  return queryRegistry.size;
}

export function resetQueryRegistryForTests(): void {
  inFlightRequests.clear();
  queryRegistry.clear();
  nextAnonymousQueryId = 0;
}

export function createQuery<T>(asyncFunction: () => Promise<T>, key?: string): Accessor<QueryState<T>> {
  const queryKey = getQueryKey(asyncFunction, key);
  const [state, setState] = createSignal<QueryState<T>>({
    data: null,
    error: null,
    loading: true
  });
  let latestRequest: Promise<T> | null = null;

  const run = async (options?: { force?: boolean }): Promise<void> => {
    setState((previousState) => ({
      data: previousState.data,
      error: null,
      loading: true
    }));

    try {
      let request = options?.force ? undefined : (inFlightRequests.get(queryKey) as Promise<T> | undefined);

      if (request === undefined) {
        request = asyncFunction();
        inFlightRequests.set(queryKey, request);
        void request.finally(() => {
          if (inFlightRequests.get(queryKey) === request) {
            inFlightRequests.delete(queryKey);
          }
        });
      }

      latestRequest = request;
      const data = await request;

      if (latestRequest !== request) {
        return;
      }

      setState({
        data,
        error: null,
        loading: false
      });
    } catch (error) {
      setState({
        data: null,
        error: normalizeError(error),
        loading: false
      });
    }
  };

  const runner = () => run({ force: true });
  registerQuery(queryKey, runner);
  onCleanup(() => {
    deregisterQuery(queryKey, runner);
  });
  void run();

  return state;
}

import { createSignal, type Accessor } from "@shadejs/core";

import { invalidateQueryKeys } from "./query";

export interface MutationOptions {
  invalidates?: string[];
}

export interface MutationHandle<TArguments extends unknown[], TResult> {
  error: Accessor<Error | null>;
  mutate: (...args: TArguments) => Promise<TResult>;
  pending: Accessor<boolean>;
}

export function createMutation<TArguments extends unknown[], TResult>(
  asyncFunction: (...args: TArguments) => Promise<TResult>,
  options: MutationOptions = {}
): MutationHandle<TArguments, TResult> {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  const mutate = async (...args: TArguments): Promise<TResult> => {
    setPending(true);
    setError(null);

    try {
      const result = await asyncFunction(...args);
      await invalidateQueryKeys(options.invalidates ?? []);
      return result;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)));
      throw caughtError;
    } finally {
      setPending(false);
    }
  };

  return {
    error,
    mutate,
    pending
  };
}

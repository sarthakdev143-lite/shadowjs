import { invalidateQueryKeys } from "./query";

export interface MutationOptions {
  invalidates?: string[];
}

export function createMutation<TArguments extends unknown[], TResult>(
  asyncFunction: (...args: TArguments) => Promise<TResult>,
  options: MutationOptions = {}
): (...args: TArguments) => Promise<TResult> {
  return async (...args: TArguments): Promise<TResult> => {
    const result = await asyncFunction(...args);
    await invalidateQueryKeys(options.invalidates ?? []);
    return result;
  };
}

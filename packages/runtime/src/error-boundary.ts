import { createSignal, setEffectErrorHandler } from "@shadowjs/core";

import type { Props, Renderable } from "./jsx";

export interface ErrorBoundaryProps extends Props {
  children?: Renderable[];
  fallback: (error: Error) => Renderable;
}

export function ErrorBoundary(props: ErrorBoundaryProps): Renderable {
  const { children = [], fallback } = props;
  const [caughtError, setCaughtError] = createSignal<Error | null>(null);

  setEffectErrorHandler((error) => {
    setCaughtError(error instanceof Error ? error : new Error(String(error)));
  });

  return () => {
    const error = caughtError();

    if (error !== null) {
      return fallback(error);
    }

    return children.length === 1 ? children[0] : children;
  };
}

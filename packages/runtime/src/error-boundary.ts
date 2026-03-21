import { createSignal, pushErrorHandler } from "@sarthakdev143/core";

import type { Props, Renderable } from "./jsx";

export interface ErrorBoundaryProps extends Props {
  children?: Renderable[];
  fallback: (error: Error) => Renderable;
}

type BoundaryRenderable = (() => Renderable) & {
  __shadowPopErrorHandler?: () => void;
};

export function ErrorBoundary(props: ErrorBoundaryProps): Renderable {
  const { children = [], fallback } = props;
  const [caughtError, setCaughtError] = createSignal<Error | null>(null);
  const popHandler = pushErrorHandler((error) => {
    setCaughtError(error instanceof Error ? error : new Error(String(error)));
  });

  const renderBoundary = (() => {
    const error = caughtError();

    if (error !== null) {
      return fallback(error);
    }

    return children.length === 1 ? children[0] : children;
  }) as BoundaryRenderable;

  renderBoundary.__shadowPopErrorHandler = popHandler;
  return renderBoundary;
}

import type { Renderable } from "@sarthakdev143/runtime";

import { currentPath, getRouterState, setRouteParams, type Route } from "./router";

function splitPath(value: string): string[] {
  const normalized = value.replace(/^\/+|\/+$/g, "");

  if (normalized.length === 0) {
    return [];
  }

  return normalized.split("/");
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

export function createRouter(routes: Route[]): () => Renderable {
  return function Router(): Renderable {
    return () => {
      const path = currentPath();

      for (const route of routes) {
        const params = matchRoute(route.path, path);

        if (params !== null) {
          setRouteParams(params);
          return route.component();
        }
      }

      if (Object.keys(getRouterState().params).length > 0) {
        setRouteParams({});
      }

      return null;
    };
  };
}

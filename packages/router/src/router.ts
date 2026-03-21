import { createSignal, type Accessor } from "@sarthakdev143/core";
import type { Renderable } from "@sarthakdev143/runtime";

export interface Route {
  component: () => Renderable;
  path: string;
}

export interface RouterState {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

function createURL(path: string): URL {
  const base = typeof window !== "undefined" ? window.location.origin : "http://shadejs.local";
  return new URL(path, base);
}

function parseQuery(path: string): Record<string, string> {
  return Object.fromEntries(createURL(path).searchParams.entries());
}

function recordsEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function getInitialPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

const [routerState, setRouterState] = createSignal<RouterState>({
  path: createURL(getInitialPath()).pathname,
  params: {},
  query: parseQuery(getInitialPath())
});

export const currentPath: Accessor<string> = () => routerState().path;
export const currentParams: Accessor<Record<string, string>> = () => routerState().params;
export const currentQuery: Accessor<Record<string, string>> = () => routerState().query;

export function getRouterState(): RouterState {
  return routerState();
}

export function setRouteParams(params: Record<string, string>): void {
  setRouterState((current) => {
    if (recordsEqual(current.params, params)) {
      return current;
    }

    return {
      ...current,
      params
    };
  });
}

function updateRouterState(path: string): void {
  const url = createURL(path);
  const nextQuery = Object.fromEntries(url.searchParams.entries());

  setRouterState((current) => {
    if (current.path === url.pathname && recordsEqual(current.params, {}) && recordsEqual(current.query, nextQuery)) {
      return current;
    }

    return {
      path: url.pathname,
      params: {},
      query: nextQuery
    };
  });
}

export function navigate(path: string): void {
  if (typeof window !== "undefined") {
    window.history.pushState({}, "", path);
  }

  updateRouterState(path);
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    updateRouterState(`${window.location.pathname}${window.location.search}`);
  });
}

import { provideContext, type Context } from "@sarthakdev143/core";
import type { IntrinsicElements } from "./jsx-types";

export const Fragment = Symbol("ShadowFragment");
const providerMarker = Symbol("shadejs.provider");

export type Key = number | string;
export type Primitive = boolean | null | number | string | undefined;
export type Props = Record<string, unknown> & { key?: Key };
export type Renderable = Primitive | JSXDescriptor | ReactiveChild | Renderable[];
export type ReactiveChild = () => Renderable;
export type Component<P extends object = Props> = {
  bivarianceHack(props: P & { children?: Renderable[] }): Renderable;
}["bivarianceHack"];
export type Tag = Component<Record<string, unknown>> | typeof Fragment | string;
export type ProviderComponent<T> = Component & {
  [providerMarker]?: Context<T>;
};

export interface JSXDescriptor {
  children: Renderable[];
  props: Props;
  tag: Tag;
}

function flattenChildren(children: Renderable[]): Renderable[] {
  const flattened: Renderable[] = [];

  for (const child of children) {
    if (Array.isArray(child)) {
      flattened.push(...flattenChildren(child));
      continue;
    }

    flattened.push(child);
  }

  return flattened;
}

export function h<K extends keyof IntrinsicElements>(
  tag: K,
  props: IntrinsicElements[K] | null,
  ...children: Renderable[]
): JSXDescriptor;
export function h<P extends object>(tag: Component<P>, props: P | null, ...children: Renderable[]): JSXDescriptor;
export function h(tag: Tag, props: Props | null, ...children: Renderable[]): JSXDescriptor {
  return {
    children: flattenChildren(children),
    props: props ?? {},
    tag
  };
}

export function createProvider<T>(context: Context<T>): ProviderComponent<T> {
  const Provider: ProviderComponent<T> = (props: Props & { children?: Renderable[] }): Renderable => {
    const children = props.children ?? [];
    return children.length === 1 ? children[0] : children;
  };

  Provider[providerMarker] = context;
  return Provider;
}

export function renderWithProvider<T>(tag: Tag, props: Props, children: Renderable[], fn: () => T): T {
  if (typeof tag !== "function") {
    return fn();
  }

  const context = (tag as ProviderComponent<unknown>)[providerMarker];

  if (context === undefined) {
    return fn();
  }

  return provideContext(context, props.value, fn);
}

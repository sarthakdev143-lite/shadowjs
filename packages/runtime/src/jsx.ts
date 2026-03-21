import { provideContext, type Context } from "@sarthakdev143/core";

export const Fragment = Symbol("ShadowFragment");
const providerMarker = Symbol("shadejs.provider");

export type Key = number | string;
export type Primitive = boolean | null | number | string | undefined;
export type Props = Record<string, unknown> & { key?: Key };
export type Renderable = Primitive | JSXDescriptor | ReactiveChild | Renderable[];
export type ReactiveChild = () => Renderable;
export type Component = {
  bivarianceHack(props: Props & { children?: Renderable[] }): Renderable;
}["bivarianceHack"];
export type Tag = Component | typeof Fragment | string;
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

declare global {
  namespace JSX {
    type Element = JSXDescriptor;

    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements {
      [elementName: string]: Props;
    }
  }
}

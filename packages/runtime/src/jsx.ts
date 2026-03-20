export const Fragment = Symbol("ShadowFragment");

export type Key = number | string;
export type Primitive = boolean | null | number | string | undefined;
export type Props = Record<string, unknown> & { key?: Key };
export type Renderable = Primitive | JSXDescriptor | ReactiveChild | Renderable[];
export type ReactiveChild = () => Renderable;
export type Component = (props: Props & { children?: Renderable[] }) => Renderable;
export type Tag = Component | typeof Fragment | string;

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

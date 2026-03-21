export { createDOMNode, disposeNode } from "./dom";
export { ErrorBoundary } from "./error-boundary";
export { registerComponent } from "./hmr";
export { createProvider, Fragment, h } from "./jsx";
export type { Component, JSXDescriptor, Primitive, Props, ReactiveChild, Renderable, Tag } from "./jsx";
export type { IntrinsicElements } from "./jsx-types";
export { mount } from "./render";

import type { JSXDescriptor } from "./jsx";
import type { IntrinsicElements as RuntimeIntrinsicElements } from "./jsx-types";

declare global {
  namespace JSX {
    type Element = JSXDescriptor;

    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements extends RuntimeIntrinsicElements {}
  }
}

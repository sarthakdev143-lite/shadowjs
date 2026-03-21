import type { Accessor } from "@sarthakdev143/core";

import type { JSXDescriptor, Renderable } from "./jsx";

export type ReactiveOr<T> = T | Accessor<T>;
type StyleObject = Partial<Record<keyof CSSStyleDeclaration, string | number | null | undefined>>;
type AttributePrimitive = boolean | number | string | null | undefined;

interface DataAttributes {
  [key: `aria-${string}`]: ReactiveOr<AttributePrimitive>;
  [key: `data-${string}`]: ReactiveOr<AttributePrimitive>;
}

interface EventHandlers {
  onBlur?: (event: FocusEvent) => void;
  onChange?: (event: Event) => void;
  onClick?: (event: MouseEvent) => void;
  onDblClick?: (event: MouseEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onInput?: (event: Event) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onScroll?: (event: Event) => void;
  onSubmit?: (event: SubmitEvent) => void;
}

export interface BaseHTMLProps<TElement extends HTMLElement = HTMLElement> extends DataAttributes, EventHandlers {
  children?: Renderable | Renderable[];
  class?: ReactiveOr<string>;
  className?: ReactiveOr<string>;
  hidden?: ReactiveOr<boolean>;
  id?: ReactiveOr<string>;
  key?: string | number;
  ref?: (element: TElement) => void;
  style?: ReactiveOr<string | StyleObject>;
  tabIndex?: ReactiveOr<number>;
  title?: ReactiveOr<string>;
}

export interface HTMLButtonProps extends BaseHTMLProps<HTMLButtonElement> {
  disabled?: ReactiveOr<boolean>;
  type?: ReactiveOr<"button" | "reset" | "submit">;
}

export interface HTMLInputProps extends BaseHTMLProps<HTMLInputElement> {
  checked?: ReactiveOr<boolean>;
  disabled?: ReactiveOr<boolean>;
  placeholder?: ReactiveOr<string>;
  type?: ReactiveOr<string>;
  value?: ReactiveOr<string>;
}

export interface HTMLTextAreaProps extends BaseHTMLProps<HTMLTextAreaElement> {
  disabled?: ReactiveOr<boolean>;
  placeholder?: ReactiveOr<string>;
  value?: ReactiveOr<string>;
}

export interface HTMLAnchorProps extends BaseHTMLProps<HTMLAnchorElement> {
  href?: ReactiveOr<string>;
  target?: ReactiveOr<string>;
}

export interface HTMLImageProps extends BaseHTMLProps<HTMLImageElement> {
  alt?: ReactiveOr<string>;
  src?: ReactiveOr<string>;
}

export interface HTMLLabelProps extends BaseHTMLProps<HTMLLabelElement> {
  htmlFor?: ReactiveOr<string>;
}

export interface HTMLFormProps extends BaseHTMLProps<HTMLFormElement> {
  action?: ReactiveOr<string>;
  method?: ReactiveOr<string>;
}

export interface IntrinsicElements {
  a: HTMLAnchorProps;
  article: BaseHTMLProps<HTMLElement>;
  aside: BaseHTMLProps<HTMLElement>;
  button: HTMLButtonProps;
  div: BaseHTMLProps<HTMLDivElement>;
  footer: BaseHTMLProps<HTMLElement>;
  form: HTMLFormProps;
  h1: BaseHTMLProps<HTMLHeadingElement>;
  h2: BaseHTMLProps<HTMLHeadingElement>;
  h3: BaseHTMLProps<HTMLHeadingElement>;
  header: BaseHTMLProps<HTMLElement>;
  img: HTMLImageProps;
  input: HTMLInputProps;
  label: HTMLLabelProps;
  li: BaseHTMLProps<HTMLLIElement>;
  main: BaseHTMLProps<HTMLElement>;
  nav: BaseHTMLProps<HTMLElement>;
  ol: BaseHTMLProps<HTMLOListElement>;
  p: BaseHTMLProps<HTMLParagraphElement>;
  section: BaseHTMLProps<HTMLElement>;
  span: BaseHTMLProps<HTMLSpanElement>;
  strong: BaseHTMLProps<HTMLElement>;
  textarea: HTMLTextAreaProps;
  ul: BaseHTMLProps<HTMLUListElement>;
}

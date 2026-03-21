import { h, type IntrinsicElements, type Renderable } from "@sarthakdev143/runtime";

import { navigate } from "./router";

export interface LinkProps extends Omit<IntrinsicElements["a"], "children" | "href" | "onClick"> {
  children?: Renderable[];
  href: string;
  onClick?: NonNullable<IntrinsicElements["a"]["onClick"]>;
}

export function Link(props: LinkProps): Renderable {
  const { children = [], href, onClick, target, ...anchorProps } = props;

  return h(
    "a",
    {
      ...anchorProps,
      href,
      onClick: (event: MouseEvent) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey ||
          target === "_blank"
        ) {
          return;
        }

        event.preventDefault();
        navigate(href);
      },
      target
    },
    ...children
  );
}

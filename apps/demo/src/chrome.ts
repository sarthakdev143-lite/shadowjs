import { Link, currentPath } from "@sarthakdev143/router";
import { h, useContext, type Renderable } from "@sarthakdev143/shadejs";

import { ThemeContext } from "./theme";

interface DemoShellProps {
  children?: Renderable[];
  eyebrow: string;
  lede: string;
  title: string;
}

export function ThemeControls() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return h(
    "div",
    { className: "theme-controls" },
    h("span", { className: "theme-chip" }, () => `Theme: ${theme()}`),
    h(
      "button",
      {
        className: "theme-button",
        onClick: toggleTheme
      },
      () => (theme() === "dark" ? "Switch to light" : "Switch to dark")
    )
  );
}

export function DemoNav() {
  return h(
    "nav",
    { "aria-label": "Demo routes", className: "demo-nav" },
    h(
      Link,
      {
        "aria-current": () => (currentPath() === "/" ? "page" : undefined),
        className: () => (currentPath() === "/" ? "nav-link is-active" : "nav-link"),
        href: "/"
      },
      "Feed"
    ),
    h(
      Link,
      {
        "aria-current": () => (currentPath() === "/about" ? "page" : undefined),
        className: () => (currentPath() === "/about" ? "nav-link is-active" : "nav-link"),
        href: "/about"
      },
      "About"
    )
  );
}

export function DemoShell(props: DemoShellProps): Renderable {
  const { theme } = useContext(ThemeContext);

  return h(
    "main",
    { className: "shell", "data-theme": theme },
    h(
      "section",
      { className: "hero panel" },
      h(
        "div",
        { className: "hero-top" },
        h("p", { className: "eyebrow" }, props.eyebrow),
        h(DemoNav, null)
      ),
      h("h1", null, props.title),
      h("p", { className: "lede" }, props.lede),
      h(ThemeControls, null)
    ),
    ...(props.children ?? [])
  );
}

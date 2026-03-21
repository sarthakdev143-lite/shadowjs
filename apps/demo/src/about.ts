import { h } from "@sarthakdev143/shadejs";

import { DemoShell } from "./chrome";

export function About() {
  return h(
    DemoShell,
    {
      eyebrow: "Client Router",
      lede: "This route lives entirely on the client, proving navigation now swaps pages without a full reload.",
      title: "Router state, links, and query parsing all run through signals."
    },
    h(
      "section",
      { className: "panel about-panel" },
      h("h2", null, "Why this matters"),
      h(
        "div",
        { className: "about-grid" },
        h(
          "article",
          { className: "about-card" },
          h("strong", null, "No reload loop"),
          h("p", null, "Links call navigate(), update a signal, and keep the current app shell mounted.")
        ),
        h(
          "article",
          { className: "about-card" },
          h("strong", null, "Route params"),
          h("p", null, "Patterns like /posts/:id decode path segments into currentParams() for route components.")
        ),
        h(
          "article",
          { className: "about-card" },
          h("strong", null, "Composable"),
          h("p", null, "The router package stays small and fits the same function-component model as the rest of ShadeJS.")
        )
      )
    )
  );
}

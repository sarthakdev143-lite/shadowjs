import { createSignal } from "@shadowjs/core";
import { h } from "@shadowjs/runtime";
import { createMutation, createQuery, createStore } from "@shadowjs/state";

import { addPost, getPosts } from "./posts.server";

const [count, setCount] = createSignal(0);
const composer = createStore({
  draft: "ShadowJS turns server imports into RPC."
});
const posts = createQuery(getPosts, "posts");
const { mutate: submitPost, pending: isSubmitting } = createMutation(addPost, {
  invalidates: ["posts"]
});

function renderPosts() {
  const state = posts();

  if (state.loading) {
    return h("li", { className: "post status" }, "Loading server posts...");
  }

  if (state.error !== null) {
    return h("li", { className: "post status error" }, state.error.message);
  }

  return (state.data ?? []).map((post) =>
    h(
      "li",
      {
        className: "post",
        key: post.id,
        "data-post-id": String(post.id)
      },
      h("span", { className: "post-id" }, `#${post.id}`),
      h("span", { className: "post-title" }, post.title)
    )
  );
}

async function handleAddPost(): Promise<void> {
  const title = composer.draft.trim();

  if (title.length === 0) {
    return;
  }

  await submitPost(title);
  composer.draft = `Fresh post ${Date.now()}`;
}

export function Feed() {
  return h(
    "main",
    { className: "shell" },
    h(
      "section",
      { className: "hero panel" },
      h("p", { className: "eyebrow" }, "ShadowJS Demo"),
      h("h1", null, "Signals, RPC, and cache invalidation living in one graph."),
      h(
        "p",
        { className: "lede" },
        "The counter uses signals, the composer uses createStore, and the feed uses compiler-generated RPC stubs."
      ),
      h(
        "div",
        { className: "counter-card" },
        h("span", { className: "counter-label" }, "Reactive counter"),
        h("strong", { className: "counter-value" }, count),
        h(
          "button",
          {
            className: "counter-button",
            onClick: () => setCount((value) => value + 1)
          },
          "Increment"
        )
      )
    ),
    h(
      "section",
      { className: "panel composer" },
      h("div", { className: "panel-head" }, h("h2", null, "Create a server post")),
      h("label", { className: "field-label", for: "post-title" }, "Draft title"),
      h("input", {
        className: "post-input",
        id: "post-title",
        onInput: (event: Event) => {
          composer.draft = (event.target as HTMLInputElement).value;
        },
        placeholder: "Write a post title",
        value: () => composer.draft
      }),
      h(
        "button",
        {
          className: "add-button",
          disabled: () => isSubmitting() || composer.draft.trim().length === 0,
          onClick: () => {
            void handleAddPost();
          }
        },
        () => (isSubmitting() ? "Adding..." : "Add Post")
      )
    ),
    h(
      "section",
      { className: "panel feed" },
      h(
        "div",
        { className: "panel-head" },
        h("h2", null, "Server-backed posts"),
        h("p", null, "createQuery(getPosts) + createMutation(addPost).mutate + invalidates(['posts'])")
      ),
      h("ul", { className: "post-list" }, renderPosts)
    )
  );
}

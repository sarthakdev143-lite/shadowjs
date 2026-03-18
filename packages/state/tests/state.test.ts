import { describe, expect, it, vi } from "vitest";

import { createMutation, createQuery, createStore } from "../src/index";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("@shadowjs/state", () => {
  it("createQuery starts in a loading state", () => {
    const query = createQuery(async () => "hello", "greeting");

    expect(query()).toEqual({
      data: null,
      error: null,
      loading: true
    });
  });

  it("createQuery resolves to data", async () => {
    const query = createQuery(async () => "hello", "greeting-data");

    await waitForMicrotask();

    expect(query()).toEqual({
      data: "hello",
      error: null,
      loading: false
    });
  });

  it("createMutation calls the server function", async () => {
    const createPost = vi.fn(async (title: string) => title.toUpperCase());
    const mutate = createMutation(createPost, {
      invalidates: []
    });

    const result = await mutate("shadowjs");

    expect(createPost).toHaveBeenCalledWith("shadowjs");
    expect(result).toBe("SHADOWJS");
  });

  it("createMutation invalidation triggers a query refetch", async () => {
    let fetchCount = 0;
    const getPosts = vi.fn(async () => {
      fetchCount += 1;
      return [{ id: fetchCount, title: "ShadowJS" }];
    });
    const posts = createQuery(getPosts, "posts");

    await waitForMicrotask();

    const addPost = createMutation(async (title: string) => title, {
      invalidates: ["posts"]
    });

    await addPost("Signals");

    expect(getPosts).toHaveBeenCalledTimes(2);
    expect(posts().data).toEqual([{ id: 2, title: "ShadowJS" }]);
    expect(posts().loading).toBe(false);
  });

  it("createStore routes property reads and writes through signals", () => {
    const store = createStore({
      count: 0,
      open: false
    });

    expect(store.count).toBe(0);
    store.count = 5;
    expect(store.count).toBe(5);
    expect(store.open).toBe(false);
  });
});

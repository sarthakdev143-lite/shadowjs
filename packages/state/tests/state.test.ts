import { afterEach, describe, expect, it, vi } from "vitest";

import { createEffect } from "@murkjs/core";

import { createMutation, createQuery, createStore } from "../src/index";
import { getQueryRegistrySize, invalidateQueryKeys, resetQueryRegistryForTests } from "../src/query";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

describe("@murkjs/state", () => {
  afterEach(() => {
    resetQueryRegistryForTests();
  });

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

  it("createQuery shares one in-flight request for the same key", async () => {
    const deferred = createDeferred<string>();
    const getPosts = vi.fn(() => deferred.promise);
    const firstQuery = createQuery(getPosts, "posts");
    const secondQuery = createQuery(getPosts, "posts");

    expect(getPosts).toHaveBeenCalledTimes(1);

    deferred.resolve("shared");
    await waitForMicrotask();

    expect(firstQuery().data).toBe("shared");
    expect(secondQuery().data).toBe("shared");
  });

  it("createQuery starts a fresh request after the prior one resolves", async () => {
    const getPosts = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const firstQuery = createQuery(getPosts, "posts-refresh");
    await waitForMicrotask();

    const secondQuery = createQuery(getPosts, "posts-refresh");
    await waitForMicrotask();

    expect(getPosts).toHaveBeenCalledTimes(2);
    expect(firstQuery().data).toBe("first");
    expect(secondQuery().data).toBe("second");
  });

  it("invalidateQueryKeys forces a fresh request even if one is already in flight", async () => {
    const firstRequest = createDeferred<string>();
    const secondRequest = createDeferred<string>();
    const getPosts = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    const posts = createQuery(getPosts, "posts-invalidated");

    const invalidation = invalidateQueryKeys(["posts-invalidated"]);

    expect(getPosts).toHaveBeenCalledTimes(2);

    firstRequest.resolve("stale");
    await waitForMicrotask();

    expect(posts().loading).toBe(true);
    expect(posts().data).toBeNull();

    secondRequest.resolve("fresh");
    await invalidation;
    await waitForMicrotask();

    expect(posts()).toEqual({
      data: "fresh",
      error: null,
      loading: false
    });
  });

  it("createMutation calls the server function", async () => {
    const createPost = vi.fn(async (title: string) => title.toUpperCase());
    const mutation = createMutation(createPost, {
      invalidates: []
    });

    const result = await mutation.mutate("murkjs");

    expect(createPost).toHaveBeenCalledWith("murkjs");
    expect(result).toBe("MURKJS");
  });

  it("createMutation invalidation triggers a query refetch", async () => {
    let fetchCount = 0;
    const getPosts = vi.fn(async () => {
      fetchCount += 1;
      return [{ id: fetchCount, title: "MurkJS" }];
    });
    const posts = createQuery(getPosts, "posts");

    await waitForMicrotask();

    const addPost = createMutation(async (title: string) => title, {
      invalidates: ["posts"]
    });

    await addPost.mutate("Signals");

    expect(getPosts).toHaveBeenCalledTimes(2);
    expect(posts().data).toEqual([{ id: 2, title: "MurkJS" }]);
    expect(posts().loading).toBe(false);
  });

  it("createMutation starts with pending false", () => {
    const mutation = createMutation(async () => "done");

    expect(mutation.pending()).toBe(false);
  });

  it("createMutation sets pending while a request is in flight", async () => {
    const deferred = createDeferred<string>();
    const mutation = createMutation(() => deferred.promise);

    const request = mutation.mutate();

    expect(mutation.pending()).toBe(true);

    deferred.resolve("done");
    await request;

    expect(mutation.pending()).toBe(false);
  });

  it("createMutation clears pending after rejection", async () => {
    const deferred = createDeferred<string>();
    const mutation = createMutation(() => deferred.promise);

    const request = mutation.mutate();
    deferred.reject(new Error("failed"));

    await expect(request).rejects.toThrow("failed");
    expect(mutation.pending()).toBe(false);
  });

  it("createMutation starts with no error", () => {
    const mutation = createMutation(async () => "done");

    expect(mutation.error()).toBeNull();
  });

  it("createMutation stores the thrown error", async () => {
    const mutation = createMutation(async () => {
      throw new Error("broken");
    });

    await expect(mutation.mutate()).rejects.toThrow("broken");
    expect(mutation.error()?.message).toBe("broken");
  });

  it("createMutation clears error when a new request starts", async () => {
    const deferred = createDeferred<string>();
    let shouldFail = true;
    const mutation = createMutation(async () => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("broken");
      }

      return deferred.promise;
    });

    await expect(mutation.mutate()).rejects.toThrow("broken");
    const nextRequest = mutation.mutate();

    expect(mutation.error()).toBeNull();

    deferred.resolve("fixed");
    await expect(nextRequest).resolves.toBe("fixed");
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

  it("tracks nested property reads reactively", async () => {
    const store = createStore({
      user: {
        name: "Sarthak"
      }
    });
    let observed = "";

    createEffect(() => {
      observed = store.user.name;
    });

    expect(observed).toBe("Sarthak");

    store.user.name = "Commander";
    await waitForMicrotask();

    expect(observed).toBe("Commander");
  });

  it("triggers effects that read nested properties when they change", async () => {
    const store = createStore({
      settings: {
        title: "MurkJS"
      }
    });
    let runs = 0;

    createEffect(() => {
      runs += 1;
      void store.settings.title;
    });

    store.settings.title = "MurkJS v0.2";
    await waitForMicrotask();

    expect(runs).toBe(2);
  });

  it("does not trigger unrelated property effects for nested writes", async () => {
    const store = createStore({
      theme: "light",
      user: {
        name: "Sarthak"
      }
    });
    let runs = 0;
    let theme = "";

    createEffect(() => {
      runs += 1;
      theme = store.theme;
    });

    store.user.name = "Commander";
    await waitForMicrotask();

    expect(runs).toBe(1);
    expect(theme).toBe("light");
  });

  it("supports deeply nested reads and writes", async () => {
    const store = createStore({
      profile: {
        identity: {
          name: "Sarthak"
        }
      }
    });
    let observed = "";

    createEffect(() => {
      observed = store.profile.identity.name;
    });

    store.profile.identity.name = "Commander";
    await waitForMicrotask();

    expect(observed).toBe("Commander");
  });

  it("updates array consumers when an array property is replaced", async () => {
    const store = createStore({
      posts: ["one"]
    });
    let observed = 0;

    createEffect(() => {
      observed = store.posts.length;
    });

    store.posts = ["one", "two", "three"];
    await waitForMicrotask();

    expect(observed).toBe(3);
  });

  it("does not make array mutation methods reactive, but replacement still is", async () => {
    const store = createStore({
      posts: ["one"]
    });
    let runs = 0;

    createEffect(() => {
      runs += 1;
      void store.posts.length;
    });

    store.posts.push("two");
    await waitForMicrotask();

    expect(runs).toBe(1);

    store.posts = ["one", "two", "three"];
    await waitForMicrotask();

    expect(runs).toBe(2);
  });

  it("removes query registry entries when their scopes are disposed", () => {
    const dispose = createEffect(() => {
      void createQuery(async () => "scoped", "scoped-query");
    });

    expect(getQueryRegistrySize()).toBe(1);

    dispose();

    expect(getQueryRegistrySize()).toBe(0);
  });

  it("does not refetch invalidated keys after the query scope is disposed", async () => {
    const getPosts = vi.fn(async () => "murkjs");
    const dispose = createEffect(() => {
      void createQuery(getPosts, "disposed-query");
    });

    await waitForMicrotask();
    expect(getPosts).toHaveBeenCalledTimes(1);

    dispose();
    await invalidateQueryKeys(["disposed-query"]);

    expect(getPosts).toHaveBeenCalledTimes(1);
    expect(getQueryRegistrySize()).toBe(0);
  });

  it("keeps other queries with the same key registered after one scope is disposed", async () => {
    const getPosts = vi.fn(async () => "shared");
    const disposeFirst = createEffect(() => {
      void createQuery(getPosts, "shared-query");
    });
    const disposeSecond = createEffect(() => {
      void createQuery(getPosts, "shared-query");
    });

    await waitForMicrotask();
    expect(getQueryRegistrySize()).toBe(1);
    expect(getPosts).toHaveBeenCalledTimes(1);

    disposeFirst();
    await invalidateQueryKeys(["shared-query"]);

    expect(getPosts).toHaveBeenCalledTimes(2);

    disposeSecond();
    expect(getQueryRegistrySize()).toBe(0);
  });
});

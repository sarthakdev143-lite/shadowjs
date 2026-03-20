import { describe, expect, it, vi } from "vitest";

import { createMutation, createQuery, createStore } from "../src/index";

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
    const mutation = createMutation(createPost, {
      invalidates: []
    });

    const result = await mutation.mutate("shadowjs");

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

    await addPost.mutate("Signals");

    expect(getPosts).toHaveBeenCalledTimes(2);
    expect(posts().data).toEqual([{ id: 2, title: "ShadowJS" }]);
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
});

import { afterEach, describe, expect, it } from "vitest";

import { createEffect, createMemo, createSignal, flushEffects, pendingEffects } from "../src/index";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

afterEach(() => {
  flushEffects();
});

describe("@shadowjs/core", () => {
  it("reads and writes signals", () => {
    const [count, setCount] = createSignal(0);

    expect(count()).toBe(0);
    expect(setCount(5)).toBe(5);
    expect(count()).toBe(5);
    expect(setCount((value) => value + 1)).toBe(6);
    expect(count()).toBe(6);
  });

  it("re-runs effects when a dependency changes", async () => {
    const [count, setCount] = createSignal(0);
    const seenValues: number[] = [];

    createEffect(() => {
      seenValues.push(count());
    });

    expect(seenValues).toEqual([0]);

    setCount(1);
    expect(seenValues).toEqual([0]);

    await waitForMicrotask();

    expect(seenValues).toEqual([0, 1]);
  });

  it("does not re-run effects when an unrelated signal changes", async () => {
    const [tracked] = createSignal(1);
    const [, setUntracked] = createSignal(0);
    let runs = 0;

    createEffect(() => {
      runs += 1;
      tracked();
    });

    expect(runs).toBe(1);

    setUntracked(1);
    await waitForMicrotask();

    expect(runs).toBe(1);
  });

  it("memoizes derived values until dependencies change", async () => {
    const [count, setCount] = createSignal(2);
    let computations = 0;

    const doubled = createMemo(() => {
      computations += 1;
      return count() * 2;
    });

    expect(doubled()).toBe(4);
    expect(doubled()).toBe(4);
    expect(computations).toBe(1);

    setCount(3);
    expect(computations).toBe(1);
    expect(doubled()).toBe(6);
    expect(computations).toBe(2);

    await waitForMicrotask();

    expect(doubled()).toBe(6);
    expect(computations).toBe(2);
  });

  it("batches multiple writes into one scheduled effect run", async () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;

    createEffect(() => {
      runs += 1;
      count();
    });

    expect(runs).toBe(1);

    setCount(1);
    setCount(2);
    setCount(3);

    expect(runs).toBe(1);

    await waitForMicrotask();

    expect(runs).toBe(2);
    expect(count()).toBe(3);
  });

  it("does not retrigger an effect when it writes a signal it also reads", async () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;

    createEffect(() => {
      runs += 1;

      if (count() === 0) {
        setCount(1);
      }
    });

    await waitForMicrotask();

    expect(runs).toBe(1);
    expect(count()).toBe(1);
  });

  it("dispose stops an effect from re-running", async () => {
    const [count, setCount] = createSignal(0);
    const seenValues: number[] = [];
    const dispose = createEffect(() => {
      seenValues.push(count());
    });

    dispose();
    setCount(1);
    await waitForMicrotask();

    expect(seenValues).toEqual([0]);
  });

  it("dispose removes an effect from pendingEffects", () => {
    const [count, setCount] = createSignal(0);
    const dispose = createEffect(() => {
      count();
    });

    setCount(1);
    expect(pendingEffects.size).toBeGreaterThan(0);

    dispose();

    expect(pendingEffects.size).toBe(0);
  });

  it("dispose prevents dependencies from being re-registered", async () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;
    const dispose = createEffect(() => {
      runs += 1;
      count();
    });

    dispose();
    setCount(1);
    setCount(2);
    await waitForMicrotask();

    expect(runs).toBe(1);
  });

  it("dispose is idempotent", () => {
    const dispose = createEffect(() => {});

    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
  });
});

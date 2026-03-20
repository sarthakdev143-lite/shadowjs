import { afterEach, describe, expect, it, vi } from "vitest";

import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  flushMountCallbacks,
  flushEffects,
  onCleanup,
  onMount,
  pendingEffects,
  pushErrorHandler,
  setEffectErrorHandler
} from "../src/index";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

afterEach(() => {
  flushEffects();
  flushMountCallbacks();
  setEffectErrorHandler((error) => {
    console.error("[MurkJS] Uncaught effect error:", error);
  });
});

describe("@murkjs/core", () => {
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

  it("batch collapses multiple signal writes into one effect run", () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;

    createEffect(() => {
      runs += 1;
      count();
    });

    batch(() => {
      setCount(1);
      setCount(2);
      setCount(3);
    });

    expect(runs).toBe(2);
    expect(count()).toBe(3);
  });

  it("nested batch defers flushing until the outer batch exits", () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;

    createEffect(() => {
      runs += 1;
      count();
    });

    batch(() => {
      setCount(1);

      batch(() => {
        setCount(2);
      });

      expect(runs).toBe(1);
      setCount(3);
    });

    expect(runs).toBe(2);
    expect(count()).toBe(3);
  });

  it("batch with no signal writes does not throw", () => {
    expect(() => {
      batch(() => {
        return undefined;
      });
    }).not.toThrow();
  });

  it("signal writes inside batch read correctly after the batch", () => {
    const [count, setCount] = createSignal(0);

    batch(() => {
      setCount(5);
      expect(count()).toBe(5);
    });

    expect(count()).toBe(5);
  });

  it("does not crash the scheduler when an effect throws", async () => {
    const [count, setCount] = createSignal(0);
    const [other, setOther] = createSignal(0);
    const handler = vi.fn();
    const seenValues: number[] = [];

    setEffectErrorHandler(handler);

    createEffect(() => {
      if (count() > 0) {
        throw new Error("boom");
      }
    });

    createEffect(() => {
      seenValues.push(other());
    });

    setCount(1);
    setOther(1);
    await waitForMicrotask();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(seenValues).toEqual([0, 1]);
  });

  it("continues running other pending effects after one throws", async () => {
    const [failing, setFailing] = createSignal(0);
    const [stable, setStable] = createSignal(0);
    const handler = vi.fn();
    const runs: number[] = [];

    setEffectErrorHandler(handler);

    createEffect(() => {
      if (failing() === 1) {
        throw new Error("failure");
      }
    });

    createEffect(() => {
      runs.push(stable());
    });

    setFailing(1);
    setStable(1);
    await waitForMicrotask();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(runs).toEqual([0, 1]);
  });

  it("calls the configured effect error handler with the thrown error", async () => {
    const [count, setCount] = createSignal(0);
    const handler = vi.fn();

    setEffectErrorHandler(handler);

    createEffect(() => {
      if (count() === 1) {
        throw new Error("broken");
      }
    });

    setCount(1);
    await waitForMicrotask();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((handler.mock.calls[0]?.[0] as Error).message).toBe("broken");
  });

  it("replaces the effect error handler at any time", async () => {
    const [count, setCount] = createSignal(0);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    setEffectErrorHandler(firstHandler);

    createEffect(() => {
      if (count() === 1) {
        throw new Error("broken");
      }
    });

    setEffectErrorHandler(secondHandler);
    setCount(1);
    await waitForMicrotask();

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it("pushErrorHandler captures errors in its scope", async () => {
    const [count, setCount] = createSignal(0);
    const scopedHandler = vi.fn();
    const popHandler = pushErrorHandler(scopedHandler);

    createEffect(() => {
      if (count() === 1) {
        throw new Error("scoped");
      }
    });

    popHandler();
    setCount(1);
    await waitForMicrotask();

    expect(scopedHandler).toHaveBeenCalledTimes(1);
    expect((scopedHandler.mock.calls[0]?.[0] as Error).message).toBe("scoped");
  });

  it("keeps pushed handlers independent and prefers the inner one", async () => {
    const [outerCount, setOuterCount] = createSignal(0);
    const [innerCount, setInnerCount] = createSignal(0);
    const outerHandler = vi.fn();
    const innerHandler = vi.fn();
    const popOuter = pushErrorHandler(outerHandler);

    createEffect(() => {
      if (outerCount() === 1) {
        throw new Error("outer");
      }
    });

    const popInner = pushErrorHandler(innerHandler);

    createEffect(() => {
      if (innerCount() === 1) {
        throw new Error("inner");
      }
    });

    popInner();
    popOuter();
    setOuterCount(1);
    setInnerCount(1);
    await waitForMicrotask();

    expect(outerHandler).toHaveBeenCalledTimes(1);
    expect(innerHandler).toHaveBeenCalledTimes(1);
    expect((outerHandler.mock.calls[0]?.[0] as Error).message).toBe("outer");
    expect((innerHandler.mock.calls[0]?.[0] as Error).message).toBe("inner");
  });

  it("restores the outer handler after the inner one is popped", async () => {
    const [count, setCount] = createSignal(0);
    const outerHandler = vi.fn();
    const innerHandler = vi.fn();
    const popOuter = pushErrorHandler(outerHandler);
    const popInner = pushErrorHandler(innerHandler);

    popInner();

    createEffect(() => {
      if (count() === 1) {
        throw new Error("restored");
      }
    });

    popOuter();
    setCount(1);
    await waitForMicrotask();

    expect(innerHandler).not.toHaveBeenCalled();
    expect(outerHandler).toHaveBeenCalledTimes(1);
    expect((outerHandler.mock.calls[0]?.[0] as Error).message).toBe("restored");
  });

  it("falls through to the global handler after a scoped handler is popped", async () => {
    const [count, setCount] = createSignal(0);
    const scopedHandler = vi.fn();
    const globalHandler = vi.fn();
    const popHandler = pushErrorHandler(scopedHandler);

    popHandler();
    setEffectErrorHandler(globalHandler);

    createEffect(() => {
      if (count() === 1) {
        throw new Error("global");
      }
    });

    setCount(1);
    await waitForMicrotask();

    expect(scopedHandler).not.toHaveBeenCalled();
    expect(globalHandler).toHaveBeenCalledTimes(1);
    expect((globalHandler.mock.calls[0]?.[0] as Error).message).toBe("global");
  });

  it("runs onCleanup when the containing effect is disposed", () => {
    const cleanup = vi.fn();
    const dispose = createEffect(() => {
      onCleanup(cleanup);
    });

    dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs multiple onMount callbacks in registration order", () => {
    const calls: string[] = [];

    onMount(() => {
      calls.push("first");
    });
    onMount(() => {
      calls.push("second");
    });

    flushMountCallbacks();

    expect(calls).toEqual(["first", "second"]);
  });
});

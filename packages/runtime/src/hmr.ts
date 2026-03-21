type ComponentUpdateListener = (newFn: Function) => void;

interface ShadeHMRRegistry {
  get: (name: string) => (newFn: Function) => void;
  has: (name: string) => boolean;
}

const registry = new Map<string, Set<ComponentUpdateListener>>();

declare global {
  interface Window {
    __shadejs_registry__?: ShadeHMRRegistry;
  }
}

if (typeof window !== "undefined") {
  window.__shadejs_registry__ = {
    get(name: string) {
      return (newFn: Function) => {
        const listeners = registry.get(name);

        if (listeners === undefined) {
          return;
        }

        for (const listener of listeners) {
          listener(newFn);
        }
      };
    },
    has(name: string) {
      return registry.has(name);
    }
  };
}

export function registerComponent(name: string, onUpdate: ComponentUpdateListener): () => void {
  const listeners = registry.get(name) ?? new Set<ComponentUpdateListener>();
  listeners.add(onUpdate);
  registry.set(name, listeners);

  return () => {
    const currentListeners = registry.get(name);

    if (currentListeners === undefined) {
      return;
    }

    currentListeners.delete(onUpdate);

    if (currentListeners.size === 0) {
      registry.delete(name);
    }
  };
}

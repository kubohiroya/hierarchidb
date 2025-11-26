import type { RegistryStore } from '@hierarchidb/runtime-worker';

export const createStoreRegistryMock = (): RegistryStore => {
  const registry = new Map<string, unknown>();
  return {
    get: (key: string) => registry.get(key) as unknown,
    set: (key: string, value: unknown) => {
      registry.set(key, value);
    },
    delete: (key: string) => {
      registry.delete(key);
    },
    clear: () => {
      registry.clear();
    },
  } as RegistryStore;
};

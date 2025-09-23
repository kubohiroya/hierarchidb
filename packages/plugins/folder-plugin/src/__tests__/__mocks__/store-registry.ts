// Minimal mock of runtime-worker store registry for tests
type Store<T = unknown> = T;

class StoreRegistryMock {
  private group = new Map<string, Store>();
  private rel = new Map<string, Store>();

  registerGroup(nodeType: string, store: Store) {
    this.group.set(nodeType, store);
  }

  registerRelations(nodeType: string, store: Store) {
    this.rel.set(nodeType, store);
  }

  getGroup(nodeType: string) {
    return this.group.get(nodeType);
  }

  getRelations(nodeType: string) {
    return this.rel.get(nodeType);
  }
}

export const storeRegistry = new StoreRegistryMock();


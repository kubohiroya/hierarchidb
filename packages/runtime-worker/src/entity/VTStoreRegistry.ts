import type { VectorTileStore } from './storeTypes.js';

export class VTStoreRegistry {
  private readonly vectorTileStores = new Map<string, VectorTileStore>();

  getVectorTiles<T extends VectorTileStore = VectorTileStore>(nodeType: string): T | undefined {
    return this.vectorTileStores.get(nodeType) as T | undefined;
  }

  requireVectorTiles<T extends VectorTileStore = VectorTileStore>(nodeType: string): T {
    const store = this.getVectorTiles<T>(nodeType);
    if (!store) {
      throw new Error(`vt-store-not-registered:${nodeType}`);
    }
    return store;
  }

  registerVectorTiles<T extends VectorTileStore = VectorTileStore>(
    nodeType: string,
    store: T
  ): void {
    if (this.vectorTileStores.has(nodeType)) {
      throw new Error(`vt-store-already-registered:${nodeType}`);
    }
    this.vectorTileStores.set(nodeType, store);
  }

  clearForTesting(): void {
    this.vectorTileStores.clear();
  }
}

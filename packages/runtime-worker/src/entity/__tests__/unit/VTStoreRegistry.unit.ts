import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import type { VectorTileStore } from '../../storeTypes.js';
import { VTStoreRegistry } from '../../VTStoreRegistry.js';

const nodeId = 'node-a' as NodeId;

const createStore = (): VectorTileStore => ({
  list: vi.fn(async () => []),
  bulkUpsert: vi.fn(async () => {}),
  bulkDelete: vi.fn(async () => {}),
});

describe('VTStoreRegistry', () => {
  it('registers and resolves vector tile stores by node type', async () => {
    const registry = new VTStoreRegistry();
    const store = createStore();

    registry.registerVectorTiles('location', store);

    expect(registry.getVectorTiles('location')).toBe(store);
    await registry.requireVectorTiles('location').list(nodeId);
    expect(store.list).toHaveBeenCalledWith(nodeId);
  });

  it('fails when a vector tile store is missing or registered twice', () => {
    const registry = new VTStoreRegistry();

    expect(() => registry.requireVectorTiles('location')).toThrow('vt-store-not-registered');

    registry.registerVectorTiles('location', createStore());

    expect(() => registry.registerVectorTiles('location', createStore())).toThrow(
      'vt-store-already-registered'
    );
  });
});

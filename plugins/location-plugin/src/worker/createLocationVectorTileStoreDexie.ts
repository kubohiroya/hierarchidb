import type { NodeId } from '@hierarchidb/core-types';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import { createDexieVectorTileStore } from '@hierarchidb/runtime-worker';
import type { LocationDB, LocationVectorTileRecord } from '@hierarchidb/location-store';
import { buildLocationVectorTileId } from '@hierarchidb/location-store';

type Item = LocationVectorTileRecord & { id: string };

const assertItemNodeOwnership = (nodeId: NodeId, items: Item[]): void => {
  for (const item of items) {
    if (item.nodeId !== nodeId) {
      throw new Error('location-vector-tile-node-id-mismatch');
    }
  }
};

export function createLocationVectorTileStoreDexie(db: LocationDB): VectorTileStore<Item> {
  const store = createDexieVectorTileStore(db, {
    buildTileId: buildLocationVectorTileId,
    timestampField: 'timestamp',
  });
  return {
    list: store.list,
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      assertItemNodeOwnership(nodeId, items);
      await store.bulkUpsert(nodeId, items);
    },
    bulkDelete: store.bulkDelete,
  };
}

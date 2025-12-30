import type { NodeId } from '@hierarchidb/common-types';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import type { VectorTileRecord } from '@hierarchidb/location-store';
import type { LocationDB } from './locationEntitiesDB.js';

type Item = VectorTileRecord & { id: string };

const buildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `loc-mvt-${nodeId}-${z}-${x}-${y}`;

export function createLocationVectorTileStoreDexie(db: LocationDB): VectorTileStore<Item> {
  const store = {
    async list(nodeId: NodeId): Promise<Item[]> {
      const rows = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row, id: row.id }));
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      if (!items.length) return;
      const rows = items.map((item) => ({
        ...item,
        id: buildTileId(nodeId, item.z, item.x, item.y),
        nodeId,
        timestamp: Date.now(),
      }));
      await db.vectorTiles.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<Item['id']>): Promise<void> {
      await db.transaction('rw', db.vectorTiles, async () => {
        for (const id of itemIds) await db.vectorTiles.delete(id);
      });
    },
  };
  return store as VectorTileStore<Item>;
}

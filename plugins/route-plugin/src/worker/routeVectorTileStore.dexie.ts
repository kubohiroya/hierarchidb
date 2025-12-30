import type { NodeId } from '@hierarchidb/common-types';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import type { RouteDB, RouteVectorTileRecord } from '@hierarchidb/route-store';

type Item = RouteVectorTileRecord & { id: string };

const buildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

export function createRouteVectorTileStoreDexie(db: RouteDB): VectorTileStore<Item> {
  return {
    async list(nodeId: NodeId): Promise<Item[]> {
      const rows = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row, id: row.tileId }));
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      if (!items.length) return;
      const now = Date.now();
      const rows = items.map((item) => ({
        ...item,
        tileId: buildTileId(nodeId, item.z, item.x, item.y),
        nodeId,
        timestamp: now,
      }));
      await db.vectorTiles.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<Item['id']>): Promise<void> {
      await db.vectorTiles.bulkDelete(itemIds);
    },
  };
}

import type { NodeId } from '@hierarchidb/core-types';
import type { RouteDB, RouteVectorTileRecord } from '@hierarchidb/route-store';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import { createDexieVectorTileStore } from '@hierarchidb/runtime-worker';

type Item = RouteVectorTileRecord & { id: string };

const buildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

export function createRouteVectorTileStoreDexie(db: RouteDB): VectorTileStore<Item> {
  return createDexieVectorTileStore(db, {
    buildTileId,
    timestampField: 'timestamp',
  });
}

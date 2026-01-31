import type { NodeId } from '@hierarchidb/core-types';
import { createDexieVectorTileStore } from '@hierarchidb/runtime-worker';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import type { RouteDB, RouteVectorTileRecord } from '@hierarchidb/route-store';

type Item = RouteVectorTileRecord & { id: string };

const buildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

export function createRouteVectorTileStoreDexie(db: RouteDB): VectorTileStore<Item> {
  return createDexieVectorTileStore(db, {
    buildTileId,
    timestampField: 'timestamp',
  });
}

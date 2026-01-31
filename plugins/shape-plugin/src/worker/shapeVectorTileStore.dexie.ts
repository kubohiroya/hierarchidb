import type { NodeId } from '@hierarchidb/core-types';
import { createDexieVectorTileStore } from '@hierarchidb/runtime-worker';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import type { ShapeDB, VectorTileRecord } from '@hierarchidb/shape-store';

type Item = VectorTileRecord & { id: string };

export const buildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

export function createShapeVectorTileStoreDexie(db: ShapeDB): VectorTileStore<Item> {
  return createDexieVectorTileStore(db, {
    buildTileId,
    timestampField: 'generatedAt',
  });
}

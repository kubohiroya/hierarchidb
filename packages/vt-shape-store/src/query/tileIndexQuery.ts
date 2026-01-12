import type { NodeId } from '@hierarchidb/common-types';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function listTransformByBandCacheIdsByTile(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  tileId: number
): Promise<string[]> {
  const rows = await db.transformByZoomCache
    .where('[nodeId+bandId+tileId]')
    .equals([nodeId, bandId, tileId])
    .toArray();
  return rows.map((row) => row.bufferId);
}

import type { NodeId } from '@hierarchidb/common-types';
import type { TransformByBandCacheRecord } from '../types.js';
import { SHAPE_DOMAIN, buildTransformByBandCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function getTransformByBandCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  sourceKey: string
): Promise<TransformByBandCacheRecord | null> {
  const id = buildTransformByBandCacheRecordId(nodeId, bandId, sourceKey);
  return (await db.transformByBandCache.get(id)) ?? null;
}

export async function listTransformByBandCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number
): Promise<TransformByBandCacheRecord[]> {
  return db.transformByBandCache
    .where('[nodeId+bandId]')
    .equals([nodeId, bandId])
    .filter((row) => row.domainType === SHAPE_DOMAIN)
    .toArray();
}

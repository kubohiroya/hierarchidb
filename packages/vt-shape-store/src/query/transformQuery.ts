import type { NodeId } from '@hierarchidb/common-types';
import type { TransformCacheRecord } from '../types.js';
import { SHAPE_DOMAIN, buildTransformCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function getTransformCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  sourceKey: string
): Promise<TransformCacheRecord | null> {
  const id = buildTransformCacheRecordId(nodeId, bandId, sourceKey);
  return (await db.transformCache.get(id)) ?? null;
}

export async function listTransformCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number
): Promise<TransformCacheRecord[]> {
  return db.transformCache
    .where('[nodeId+bandId]')
    .equals([nodeId, bandId])
    .filter((row) => row.domainType === SHAPE_DOMAIN)
    .toArray();
}

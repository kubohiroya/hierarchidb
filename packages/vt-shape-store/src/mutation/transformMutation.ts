import type { NodeId } from '@hierarchidb/common-types';
import type { TransformCacheRecord, TransformCachePayload } from '../types.js';
import { SHAPE_DOMAIN, buildTransformCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function putTransformCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  payload: TransformCachePayload
): Promise<TransformCacheRecord> {
  if (payload.data.byteLength === 0) {
    throw new Error(`[vt-shape-store] empty transform cache buffer: ${nodeId}:${bandId}:${payload.sourceKey}`);
  }
  const buffer: TransformCacheRecord = {
    id: buildTransformCacheRecordId(nodeId, bandId, payload.sourceKey),
    nodeId,
    bandId,
    domainType: SHAPE_DOMAIN,
    sourceKey: payload.sourceKey,
    countryCode: payload.countryCode,
    adminLevel: payload.adminLevel,
    data: payload.data,
    featureCount: payload.featureCount,
    vertexCount: payload.vertexCount,
    polygonCount: payload.polygonCount,
    timestamp: payload.timestamp ?? Date.now(),
  };
  await db.transaction('rw', db.transformCache, async () => {
    await db.transformCache.put(buffer);
  });
  return buffer;
}

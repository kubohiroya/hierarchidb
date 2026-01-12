import type { NodeId } from '@hierarchidb/common-types';
import type { FetchCacheRecord, FetchCachePayload } from '../types.js';
import { SHAPE_DOMAIN, buildFetchCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function putFetchCache(
  db: VtShapeDb,
  nodeId: NodeId,
  payload: FetchCachePayload
): Promise<FetchCacheRecord> {
  const buffer: FetchCacheRecord = {
    id: buildFetchCacheRecordId(nodeId, payload.sourceKey),
    nodeId,
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
  await db.fetchCache.put(buffer);
  return buffer;
}

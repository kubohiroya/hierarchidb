import type { NodeId } from '@hierarchidb/common-types';
import type { FetchCacheRecord } from '../types.js';
import { SHAPE_DOMAIN, buildFetchCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function getFetchCache(
  db: VtShapeDb,
  nodeId: NodeId,
  sourceKey: string
): Promise<FetchCacheRecord | null> {
  const id = buildFetchCacheRecordId(nodeId, sourceKey);
  return (await db.fetchCache.get(id)) ?? null;
}

export async function listFetchCache(
  db: VtShapeDb,
  nodeId: NodeId
): Promise<FetchCacheRecord[]> {
  return db.fetchCache.where('[nodeId+domainType]').equals([nodeId, SHAPE_DOMAIN]).toArray();
}

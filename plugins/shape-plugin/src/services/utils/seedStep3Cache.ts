import type { NodeId } from '@hierarchidb/common-types';
import { SAMPLE_COUNTRIES } from '../../common/mock/data.js';
import { buildShapeCacheKey, createShapeChunkStore, jsonDeserializer, jsonSerializer, SHARED_SHAPE_NODE_ID } from './chunkStore.js';
import { GEOBOUNDARIES_ALL_METADATA_URL } from './geoboundariesEndpoints.js';

// URLs must match the ones used by metadataSources/GeoBoundariesStrategy so the cache keys line up.

/**
 * Step3の「データソース×国×自治体レベル」の表示用メタデータを、
 * 初回利用などでDexie(chunk-store)キャッシュが空の場合に、アプリ同梱の初期値から再構築します。
 *
 * - ネットワークや認証に依存せず、最低限のUI表示を成立させる
 * - 後続のネットワーク取得が成功すれば、通常通りchunk-storeが更新される
 */
export async function seedStep3CacheIfMissing(dataSource: string, nodeId: NodeId = SHARED_SHAPE_NODE_ID): Promise<void> {
  const normalized = (dataSource || '').toLowerCase();
  if (normalized !== 'geoboundaries') {
    // 現状の要件はStep3のgeoBoundariesで致命的に止まるケースへの救済。
    return;
  }

  const store = createShapeChunkStore(jsonSerializer, jsonDeserializer);

  // 1) Country metadata (gbOpen/ALL/ALL)
  const metadataKey = buildShapeCacheKey('geoboundaries:metadata:all', GEOBOUNDARIES_ALL_METADATA_URL);
  const payload = SAMPLE_COUNTRIES.map((c) => ({
    boundaryISO: (c.iso3 ?? c.countryCode ?? '').toString().toUpperCase(),
    boundaryType: 'ADM0',
    boundaryName: c.countryName,
    Continent: c.continent,
  }));
  await store.setForNode(nodeId, metadataKey, payload, { cacheKey: metadataKey, fetchedAt: Date.now() });

  // Availability is derived from the ALL/ALL metadata payload.
}

import type { NodeId } from '@hierarchidb/common-types';
import type { DexieChunkStore } from '@hierarchidb/chunk-store';
import { buildShapeCacheKey, createShapeChunkStore, jsonDeserializer, jsonSerializer, textDeserializer, textSerializer } from '../../services/utils/chunkStore.js';
import { GEOBOUNDARIES_ALL_METADATA_URL } from '../../services/utils/geoboundariesEndpoints.js';

const GADM_MAPS_URL = 'https://gadm.org/maps.html';

/**
 * Removes cached entries that participate in Step3 country×admin-level matrix building.
 * This targets the shape-plugin chunk-store (DB: "shape-chunks").
 */
export async function invalidateCountrySelectionCaches(dataSource: string, nodeId: NodeId): Promise<void> {
  const normalized = (dataSource ?? '').toLowerCase();

  // metadataSources.ts uses different serializers per endpoint.
  const jsonStore = createShapeChunkStore(jsonSerializer, jsonDeserializer) as unknown as DexieChunkStore<unknown>;
  const textStore = createShapeChunkStore(textSerializer, textDeserializer) as unknown as DexieChunkStore<unknown>;

  const tasks: Array<Promise<void>> = [];

  if (normalized === 'geoboundaries' || normalized === 'geoboundaries-topojson') {
    tasks.push(
      jsonStore.deleteForNode(nodeId, buildShapeCacheKey('geoboundaries:metadata:all', GEOBOUNDARIES_ALL_METADATA_URL)),
    );
    return Promise.all(tasks).then(() => undefined);
  }

  if (normalized === 'gadm') {
    tasks.push(
      textStore.deleteForNode(nodeId, buildShapeCacheKey('gadm:maps', GADM_MAPS_URL)),
    );
    // Country pages are keyed by gadm:country:ISO3 but ISO3 list is only known after fetching maps.
    // We at least delete the maps index. After re-fetch, metadata will be rebuilt.
    return Promise.all(tasks).then(() => undefined);
  }

  // naturalearth: currently bundled only. No cache to invalidate.
  // openstreetmap: unsupported in Step3.

  return Promise.all(tasks).then(() => undefined);
}

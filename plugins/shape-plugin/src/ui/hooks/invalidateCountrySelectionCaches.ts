import type { NodeId } from '@hierarchidb/core-types';
import type { DexieChunkStore } from '@hierarchidb/chunk-store';
import { buildShapeCacheKey, createShapeChunkStore, jsonDeserializer, jsonSerializer, textDeserializer, textSerializer } from '~/services/utils/createShapeChunkStore';
import { GEOBOUNDARIES_ALL_METADATA_URL } from '~/services/utils/geoboundariesEndpoints';

const GADM_MAPS_URL = 'https://gadm.org/maps.html';

/**
 * Removes cached entries that participate in the country selection matrix building.
 * This targets the shape-plugin chunk-store (DB: "shape-chunks").
 */
export async function invalidateCountrySelectionCaches(dataSource: string, nodeId: NodeId): Promise<void> {
  const normalized = (dataSource ?? '').toLowerCase();

  // metadataSources.ts uses different serializers per endpoint.
  const jsonStore = createShapeChunkStore(jsonSerializer, jsonDeserializer) as DexieChunkStore<unknown>;
  const textStore = createShapeChunkStore(textSerializer, textDeserializer) as DexieChunkStore<unknown>;

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
    // We at least delete the maps index. After reload, metadata will be rebuilt.
    return Promise.all(tasks).then(() => undefined);
  }

  // naturalearth: currently bundled only. No cache to invalidate.
  // openstreetmap: unsupported in country selection.

  return Promise.all(tasks).then(() => undefined);
}

// ============================================================
// Generate vector tiles from a GeoJSON ArrayBuffer.
// ============================================================

import type { NodeId } from '@hierarchidb/core-types';
import { generateVectorTilesFromFeatureCollection } from './generateVectorTilesFromFeatureCollection.js';
import type { VectorTileProgress, VTGenerateConfig, VTGenerateResult } from './types.js';
import { decodeFeatureCollectionFromJsonBuffer, throwIfAborted } from './utils.js';

export const generateVectorTilesFromJsonBuffer = async (
  nodeId: NodeId,
  buffer: ArrayBuffer,
  config: VTGenerateConfig,
  onProgress?: (progress: VectorTileProgress) => void
): Promise<VTGenerateResult> => {
  throwIfAborted(config.signal);
  const geojson = await decodeFeatureCollectionFromJsonBuffer(buffer);
  throwIfAborted(config.signal);
  if (!geojson) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
  return generateVectorTilesFromFeatureCollection(nodeId, geojson, config, onProgress);
};

// ============================================================
// Generate vector tiles from a FlatGeobuf ArrayBuffer.
// ============================================================

import type { NodeId } from '@hierarchidb/core-types';
import type { VTGenerateConfig, VTGenerateResult, VectorTileProgress } from './types.js';
import { throwIfAborted, decodeFeatureCollectionFromFlatGeobufBuffer } from './utils.js';
import { generateVectorTilesFromFeatureCollection } from './generateVectorTilesFromFeatureCollection.js';

export const generateVectorTilesFromFgbBuffer = async (
    nodeId: NodeId,
    buffer: ArrayBuffer,
    config: VTGenerateConfig,
    onProgress?: (progress: VectorTileProgress) => void,
): Promise<VTGenerateResult> => {
    throwIfAborted(config.signal);
    const geojson = await decodeFeatureCollectionFromFlatGeobufBuffer(buffer);
    throwIfAborted(config.signal);
    if (!geojson) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
    return generateVectorTilesFromFeatureCollection(nodeId, geojson, config, onProgress);
};

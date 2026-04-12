// ============================================================
// Encode a FeatureCollection into FlatGeobuf binary format.
// ============================================================

import type { FeatureCollectionLike } from './types.js';
import { loadFlatGeobufGeojson } from './utils.js';

export const encodeFlatGeobufFromFeatureCollection = async (
    collection: FeatureCollectionLike,
): Promise<ArrayBuffer> => {
    const geojsonApi = await loadFlatGeobufGeojson();
    const encoded = await geojsonApi.serialize(collection);
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
};

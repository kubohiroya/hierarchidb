import type { NodeId } from '@hierarchidb/core-types';

export type LocationVectorTileContentType = 'application/vnd.mapbox-vector-tile';

export interface LocationVectorTileRecord {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: LocationVectorTileContentType;
  timestamp: number;
}

export const LOCATION_VECTOR_TILE_CONTENT_TYPE: LocationVectorTileContentType =
  'application/vnd.mapbox-vector-tile';

export const buildLocationVectorTileId = (
  nodeId: NodeId,
  z: number,
  x: number,
  y: number
): string => `${String(nodeId)}-${String(z)}-${String(x)}-${String(y)}`;

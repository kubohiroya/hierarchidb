import type { NodeId } from '@hierarchidb/common-types';

export type VtLayerName = string;
export type VtTileKey = string;

export type VtTileRecord = {
  id: VtTileKey;
  nodeId: NodeId;
  tileId: number;
  z: number;
  x: number;
  y: number;
  layer: VtLayerName;
  bufferSetHash: string;
  data: ArrayBuffer;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
};

export type VtTilePayload = Omit<VtTileRecord, 'id' | 'timestamp' | 'size'> & {
  size?: number;
  timestamp?: number;
};

export type VtQueryOptions = {
  nodeId: NodeId;
  tileId: number;
  z: number;
  x: number;
  y: number;
  layer: VtLayerName;
  bufferSetHash: string;
};

export type VtMutationOptions = {
  nodeId: NodeId;
  tileId: number;
  z: number;
  x: number;
  y: number;
  layer: VtLayerName;
  bufferSetHash: string;
};

import type { NodeId } from '@hierarchidb/common-types';

export type TileXYZ = { z: number; x: number; y: number };

export type TileKey = {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
};

export type TileSummary = {
  tiles: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
};

export type StoredTile = {
  key: TileKey;
  data: Uint8Array;
  size: number;
  contentType: string;
  contentEncoding?: 'gzip' | 'br' | 'none';
  timestamp: number;
};

/**
 * Abstract tile persistence and listing.
 *
 * Implementations:
 * - gis-sdk: in-memory/ephemeral or default TilesDB backing
 * - shape-store/location-store/route-store: Dexie-backed concrete stores
 */
export interface VectorTileStore {
  put(tile: StoredTile): Promise<void>;
  get(key: TileKey): Promise<StoredTile | null>;
  list(nodeId: NodeId): Promise<Array<Pick<StoredTile, 'key' | 'size' | 'timestamp'>>>;
  summary(nodeId: NodeId): Promise<TileSummary>;
  deleteByNodeId(nodeId: NodeId): Promise<number>;
}


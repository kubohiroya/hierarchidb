/**
 * BaseMapプラグインの型定義
 */
import type { PeerEntity, NodeId, WorkingCopyProperties } from '@hierarchidb/common-core';

/**
 * Map style configuration
 */
export interface MapStyleConfig {
  version?: number;
  sources?: Record<string, unknown>;
  layers?: Array<unknown>;
  glyphs?: string;
  sprite?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Map viewport configuration
 */
export interface MapViewport {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Map bounds
 */
export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * BaseMapエンティティの型定義
 */
export interface BaseMapEntity extends PeerEntity {
  nodeId: NodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: [[number, number], [number, number]]; // [[west, south], [east, north]]
  styleUrl?: string;
  styleConfig?: MapStyleConfig;
  displayOptions?: Record<string, boolean | number | string>;
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

/**
 * BaseMapワーキングコピーの型定義
 */
export type BaseMapWorkingCopy = BaseMapEntity & WorkingCopyProperties;

/**
 * タイルキャッシュの型定義
 */
export interface TileCache {
  tileId: string;
  zoom: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  cachedAt: number;
}

/**
 * デフォルトマップ設定
 */
export const DEFAULT_MAP_CONFIG = {
  name: 'New BaseMap',
  mapStyle: 'streets' as const,
  center: [0, 0] as [number, number],
  zoom: 2,
  bearing: 0,
  pitch: 0,
  displayOptions: {},
};

/**
 * BaseMapプラグインの型定義
 */
import type { BaseEntity, TreeNodeId } from '@hierarchidb/core';

/**
 * BaseMapエンティティの型定義
 */
export interface BaseMapEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: [[number, number], [number, number]]; // [[west, south], [east, north]]
  styleUrl?: string;
  styleConfig?: Record<string, any>;
  displayOptions?: Record<string, any>;
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

/**
 * BaseMapワーキングコピーの型定義
 */
export interface BaseMapWorkingCopy extends BaseMapEntity {
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;
}

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

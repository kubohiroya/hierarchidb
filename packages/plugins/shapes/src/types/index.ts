/**
 * Plugin Shapes 型定義
 * 🟢 信頼性レベル: 要件定義書とinterfaces.tsに基づく
 */

import type { TreeNodeId } from '@hierarchidb/core';

/**
 * 【型定義】: Shapesエンティティの基本構造
 * 🟢 信頼性レベル: 要件定義書REQ-001～007に準拠
 */
export interface ShapesEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  geojsonData: string; // JSON文字列として保存
  layerConfig: {
    visible: boolean;
    opacity: number;
    zIndex: number;
    interactive: boolean;
    minZoom?: number;
    maxZoom?: number;
  };
  defaultStyle: ShapeStyle;
  dataSource?: {
    type: 'file' | 'url' | 'manual';
    url?: string;
    originalFilename?: string;
    lastSync?: number;
    autoSync?: boolean;
  };
  processingOptions?: {
    simplification?: {
      enabled: boolean;
      tolerance: number;
    };
    clipping?: {
      enabled: boolean;
      bounds?: [number, number, number, number];
    };
    vectorTiles?: {
      enabled: boolean;
      minZoom: number;
      maxZoom: number;
      tileSize: number;
    };
  };
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * 【型定義】: Working Copy構造
 * 🟢 信頼性レベル: REQ-005、REQ-201に基づく
 */
export interface ShapesWorkingCopy extends ShapesEntity {
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;
  editHistory?: Array<{
    timestamp: number;
    operation: 'create' | 'update' | 'delete' | 'style';
    changes: Record<string, any>;
  }>;
}

/**
 * 【型定義】: 図形スタイル設定
 * 🟢 信頼性レベル: REQ-004に基づく
 */
export interface ShapeStyle {
  polygon?: {
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity?: number;
  };
  line?: {
    color: string;
    width: number;
    opacity: number;
    pattern?: 'solid' | 'dashed' | 'dotted';
    dashArray?: number[];
  };
  point?: {
    radius: number;
    fillColor: string;
    fillOpacity?: number;
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity?: number;
  };
  label?: {
    field?: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    textOffset?: [number, number];
  };
}

/**
 * 【型定義】: メタデータ構造
 * 🟡 信頼性レベル: database-schema.sqlから推測
 */
export interface ShapesMetadata {
  shapesId: TreeNodeId;
  featureCount: number;
  totalVertices: number;
  dataSize: number;
  boundingBox: [number, number, number, number];
  geometryTypes: string[];
  crs: string;
  lastProcessed?: number;
}

/**
 * 【型定義】: バッチタスク構造
 * 🟡 信頼性レベル: REQ-501から推測
 */
export interface BatchTask {
  taskId: string;
  sessionId: TreeNodeId;
  type: 'download' | 'vectorTile' | 'geometry' | 'transform';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage?: string;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type { TreeNodeId };

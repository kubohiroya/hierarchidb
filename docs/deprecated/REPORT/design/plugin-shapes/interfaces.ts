/**
 * Plugin Shapes TypeScript インターフェース定義
 *
 * 【信頼性レベル】: 🟢 hierarchidb core types + RFC 7946 GeoJSON仕様に準拠
 * 🟡 BaseMapプラグイン実装パターンから妥当な推測
 * 🔴 eria-cartographパターンからの推測を含む高度な機能
 */

import type { TreeNodeId, PeerEntity, BaseWorkingCopy, Timestamp } from '@hierarchidb/common-core';

// ============================================================================
// Core Entity Types 🟢
// ============================================================================

/**
 * Shapesエンティティ - 地理空間図形データの管理単位
 */
export interface ShapesEntity extends PeerEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;

  // GeoJSON Feature Collection (RFC 7946準拠)
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id?: string | number;
      geometry: {
        type:
          | 'Point'
          | 'LineString'
          | 'Polygon'
          | 'MultiPoint'
          | 'MultiLineString'
          | 'MultiPolygon';
        coordinates: number[] | number[][] | number[][][];
      };
      properties: {
        name?: string;
        description?: string;
        style?: ShapeStyle;
        metadata?: Record<string, any>;
      } | null;
    }>;
    bbox?: [number, number, number, number]; // [minX, minY, maxX, maxY]
    crs?: {
      type: 'name';
      properties: {
        name: string; // 例: 'EPSG:4326', 'EPSG:3857'
      };
    };
  };

  // レイヤー設定
  layerConfig: {
    visible: boolean;
    opacity: number; // 0.0 - 1.0
    zIndex: number;
    minZoom?: number;
    maxZoom?: number;
    interactive: boolean;
  };

  // デフォルトスタイル設定
  defaultStyle: ShapeStyle;

  // データソース情報
  dataSource?: {
    type: 'file' | 'url' | 'manual';
    url?: string;
    originalFilename?: string;
    lastSync?: Timestamp;
    autoSync?: boolean;
    syncInterval?: number; // milliseconds
  };

  // 処理設定
  processingOptions?: {
    simplification?: {
      enabled: boolean;
      tolerance: number; // Douglas-Peucker許容値
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

  // 統計情報
  stats?: {
    featureCount: number;
    totalVertices: number;
    dataSize: number; // bytes
    boundingBox: [number, number, number, number];
    lastProcessed?: Timestamp;
  };

  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * Shapes Working Copy - 安全な編集のための一時コピー
 */
export interface ShapesWorkingCopy extends BaseWorkingCopy {
  // ShapesEntityの全フィールドを含む
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  geojson: ShapesEntity['geojson'];
  layerConfig: ShapesEntity['layerConfig'];
  defaultStyle: ShapesEntity['defaultStyle'];
  dataSource?: ShapesEntity['dataSource'];
  processingOptions?: ShapesEntity['processingOptions'];
  stats?: ShapesEntity['stats'];

  // Working Copy固有のフィールド
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: Timestamp;
  isDirty: boolean;

  // 編集履歴
  editHistory?: Array<{
    timestamp: Timestamp;
    operation: 'create' | 'update' | 'delete' | 'style';
    changes: Record<string, any>;
    user?: string;
  }>;

  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

// ============================================================================
// Style System 🟡
// ============================================================================

/**
 * 図形スタイル定義
 */
export interface ShapeStyle {
  // ポイント図形用スタイル
  point?: {
    radius: number;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity: number;
    symbol?: 'circle' | 'square' | 'triangle' | 'star' | 'custom';
    iconUrl?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  };

  // ライン図形用スタイル
  line?: {
    color: string;
    width: number;
    opacity: number;
    pattern?: 'solid' | 'dashed' | 'dotted';
    dashArray?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
    gradient?: {
      type: 'linear' | 'radial';
      stops: Array<[number, string]>; // [position, color]
    };
  };

  // ポリゴン図形用スタイル
  polygon?: {
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity: number;
    fillPattern?: {
      type: 'image' | 'stripe' | 'dots';
      url?: string;
      repeat?: 'repeat' | 'no-repeat';
    };
  };

  // ラベル・注釈用スタイル
  label?: {
    field?: string; // プロパティフィールド名
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    fontWeight?:
      | 'normal'
      | 'bold'
      | '100'
      | '200'
      | '300'
      | '400'
      | '500'
      | '600'
      | '700'
      | '800'
      | '900';
    textAlign?: 'left' | 'center' | 'right';
    textOffset?: [number, number];
    haloColor?: string;
    haloWidth?: number;
    maxWidth?: number;
    allowOverlap?: boolean;
    visibility?: 'visible' | 'none';
  };

  // 条件付きスタイル（データドリブンスタイリング）
  conditional?: Array<{
    condition: string; // JavaScript式: "properties.population > 1000000"
    style: Partial<ShapeStyle>;
  }>;
}

/**
 * MapLibreGL JSとの連携用スタイル出力
 */
export interface MapLibreStyleOutput {
  sources: {
    [sourceId: string]: {
      type: 'geojson' | 'vector';
      data?: GeoJSON.FeatureCollection;
      tiles?: string[];
      minzoom?: number;
      maxzoom?: number;
      attribution?: string;
    };
  };
  layers: Array<{
    id: string;
    type: 'fill' | 'line' | 'circle' | 'symbol' | 'heatmap' | 'fill-extrusion';
    source: string;
    'source-layer'?: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: any[];
    layout?: Record<string, any>;
    paint?: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
}

// ============================================================================
// WebWorker Message Types 🟡
// ============================================================================

/**
 * WebWorker間通信メッセージの基底型
 */
export type WorkerMessage =
  | BatchDownloadMessage
  | VectorTileGenerationMessage
  | GeometryProcessingMessage
  | CoordinateTransformMessage
  | ProcessingProgressMessage
  | ProcessingCompleteMessage
  | ProcessingErrorMessage;

/**
 * バッチダウンロードメッセージ
 */
export interface BatchDownloadMessage {
  type: 'batchDownload';
  taskId: string;
  sources: Array<{
    id: string;
    url: string;
    format: 'geojson' | 'shapefile' | 'kml' | 'gpx' | 'topojson';
    headers?: Record<string, string>;
    auth?: {
      type: 'bearer' | 'basic' | 'api-key';
      token: string;
    };
  }>;
  options: {
    concurrent: number; // 同時実行数 (1-4)
    timeout: number; // タイムアウト(ms)
    retryCount: number; // リトライ回数 (0-3)
    chunkSize?: number; // ストリーミング用チャンクサイズ
    validateGeometry: boolean;
    transformToCRS?: string; // 目標座標系 (例: 'EPSG:4326')
  };
}

/**
 * ベクトルタイル生成メッセージ
 */
export interface VectorTileGenerationMessage {
  type: 'generateVectorTiles';
  taskId: string;
  geojson: GeoJSON.FeatureCollection;
  options: {
    minZoom: number;
    maxZoom: number;
    tileSize: number;
    buffer: number; // タイル境界バッファ (pixels)
    tolerance: number; // 簡素化許容値
    extent: number; // MVT extent (default: 4096)
    simplification: {
      [zoom: number]: number; // ズームレベル別簡素化許容値
    };
    layerName: string;
  };
}

/**
 * 図形処理メッセージ
 */
export interface GeometryProcessingMessage {
  type: 'processGeometry';
  taskId: string;
  operation: 'simplify' | 'union' | 'intersection' | 'difference' | 'buffer' | 'convexHull';
  geometries: GeoJSON.Feature[];
  parameters?: {
    tolerance?: number;
    bufferDistance?: number;
    units?: 'meters' | 'kilometers' | 'miles' | 'degrees';
  };
}

/**
 * 座標変換メッセージ
 */
export interface CoordinateTransformMessage {
  type: 'transformCoordinates';
  taskId: string;
  geojson: GeoJSON.FeatureCollection;
  fromCRS: string;
  toCRS: string;
  options?: {
    validateBounds: boolean;
    precision: number; // 小数点以下桁数
  };
}

/**
 * 処理進行状況メッセージ
 */
export interface ProcessingProgressMessage {
  type: 'progress';
  taskId: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage:
      | 'initializing'
      | 'downloading'
      | 'parsing'
      | 'processing'
      | 'generating'
      | 'compressing'
      | 'complete';
    message?: string;
    estimatedTimeRemaining?: number; // milliseconds
  };
}

/**
 * 処理完了メッセージ
 */
export interface ProcessingCompleteMessage {
  type: 'complete';
  taskId: string;
  result: {
    geojson?: GeoJSON.FeatureCollection;
    vectorTiles?: Map<string, ArrayBuffer>; // tileKey -> tile data
    processedGeometry?: GeoJSON.Feature[];
    transformedGeometry?: GeoJSON.FeatureCollection;
    stats?: {
      processingTime: number;
      inputSize: number;
      outputSize: number;
      featuresProcessed: number;
      tileCount?: number;
      compressionRatio?: number;
    };
    metadata?: {
      detectedCRS?: string;
      boundingBox?: [number, number, number, number];
      featureTypes?: string[];
      warnings?: string[];
    };
  };
}

/**
 * 処理エラーメッセージ
 */
export interface ProcessingErrorMessage {
  type: 'error';
  taskId: string;
  error: {
    code:
      | 'NETWORK_ERROR'
      | 'PARSE_ERROR'
      | 'GEOMETRY_ERROR'
      | 'MEMORY_ERROR'
      | 'TIMEOUT'
      | 'VALIDATION_ERROR';
    message: string;
    details?: any;
    stack?: string;
    recoverable: boolean;
    suggestedAction?: string;
  };
}

// ============================================================================
// Vector Tile Types 🔴
// ============================================================================

/**
 * ベクトルタイルキーとメタデータ
 */
export interface VectorTileInfo {
  key: string; // "{z}/{x}/{y}"
  zoom: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  createdAt: Timestamp;
  bounds: [number, number, number, number];
  featureCount: number;
}

/**
 * QuadTreeノード（ベクトルタイル生成用）
 */
export interface QuadTreeNode {
  level: number;
  bounds: [number, number, number, number];
  features: GeoJSON.Feature[];
  children?: {
    nw: QuadTreeNode;
    ne: QuadTreeNode;
    sw: QuadTreeNode;
    se: QuadTreeNode;
  };
  tileCoordinates?: {
    z: number;
    x: number;
    y: number;
  }[];
}

/**
 * タイル生成設定
 */
export interface TileGenerationOptions {
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  buffer: number;
  tolerance: number;
  extent: number;
  maxFeatures: number;
  layerName: string;
  attributeInclude?: string[];
  attributeExclude?: string[];
}

// ============================================================================
// Database Schema Types 🟢
// ============================================================================

/**
 * ベクトルタイルキャッシュテーブル
 */
export interface VectorTileCache {
  tileKey: string; // Primary Key: "{z}/{x}/{y}"
  shapesId: TreeNodeId;
  zoom: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  hits: number;
}

/**
 * バッチ処理タスクテーブル
 */
export interface BatchProcessingTask {
  taskId: string; // Primary Key
  type: 'download' | 'vectorTile' | 'geometry' | 'transform';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;
  metadata: {
    sourceCount?: number;
    outputSize?: number;
    processingTime?: number;
  };
}

/**
 * Shapesメタデータテーブル（統計・索引用）
 */
export interface ShapesMetadata {
  shapesId: TreeNodeId; // Foreign Key
  featureCount: number;
  totalVertices: number;
  dataSize: number;
  boundingBox: [number, number, number, number];
  geometryTypes: (
    | 'Point'
    | 'LineString'
    | 'Polygon'
    | 'MultiPoint'
    | 'MultiLineString'
    | 'MultiPolygon'
  )[];
  crs: string;
  lastProcessed: Timestamp;
  spatialIndex?: string; // R-tree索引データ
}

// ============================================================================
// API Request/Response Types 🟡
// ============================================================================

/**
 * Shapes作成リクエスト
 */
export interface CreateShapesRequest {
  parentId: TreeNodeId;
  name: string;
  description?: string;
  geojson?: GeoJSON.FeatureCollection;
  layerConfig?: Partial<ShapesEntity['layerConfig']>;
  defaultStyle?: Partial<ShapeStyle>;
}

/**
 * Shapes更新リクエスト
 */
export interface UpdateShapesRequest {
  name?: string;
  description?: string;
  geojson?: GeoJSON.FeatureCollection;
  layerConfig?: Partial<ShapesEntity['layerConfig']>;
  defaultStyle?: Partial<ShapeStyle>;
  processingOptions?: Partial<ShapesEntity['processingOptions']>;
}

/**
 * バッチインポートリクエスト
 */
export interface BatchImportRequest {
  shapesId: TreeNodeId;
  sources: Array<{
    url: string;
    format: string;
    name?: string;
  }>;
  options: {
    mergeStrategy: 'append' | 'replace' | 'merge';
    transformToCRS?: string;
    validateGeometry: boolean;
  };
}

/**
 * ベクトルタイル生成リクエスト
 */
export interface VectorTileGenerationRequest {
  shapesId: TreeNodeId;
  options: TileGenerationOptions;
  cachePolicy: {
    ttl: number; // seconds
    maxSize: number; // MB
    compression: boolean;
  };
}

/**
 * API共通レスポンス型
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Timestamp;
    version: string;
    processingTime: number;
  };
}

// ============================================================================
// BaseMap Integration Types 🟡
// ============================================================================

/**
 * BaseMapとの統合インターフェース
 */
export interface BaseMapShapesIntegration {
  // レイヤー管理
  addShapesLayer(
    baseMapId: TreeNodeId,
    shapesId: TreeNodeId,
    layerConfig?: LayerConfig
  ): Promise<void>;
  removeShapesLayer(baseMapId: TreeNodeId, shapesId: TreeNodeId): Promise<void>;
  updateShapesLayer(
    baseMapId: TreeNodeId,
    shapesId: TreeNodeId,
    layerConfig: LayerConfig
  ): Promise<void>;
  getVisibleShapesLayers(baseMapId: TreeNodeId): Promise<ShapesLayer[]>;

  // ベクトルタイル連携
  addVectorTileSource(
    baseMapId: TreeNodeId,
    sourceId: string,
    tiles: Map<string, ArrayBuffer>
  ): Promise<void>;
  removeVectorTileSource(baseMapId: TreeNodeId, sourceId: string): Promise<void>;
  updateVectorTileSource(
    baseMapId: TreeNodeId,
    sourceId: string,
    tiles: Map<string, ArrayBuffer>
  ): Promise<void>;

  // スタイル連携
  applyShapeStyles(
    baseMapId: TreeNodeId,
    shapesId: TreeNodeId,
    styles: MapLibreStyleOutput
  ): Promise<void>;
  getActiveStyles(baseMapId: TreeNodeId): Promise<MapLibreStyleOutput>;
}

/**
 * Shapesレイヤー定義
 */
export interface ShapesLayer {
  id: string;
  shapesId: TreeNodeId;
  name: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  styleHash: string;
  lastUpdated: Timestamp;
}

/**
 * レイヤー設定
 */
export interface LayerConfig {
  visible: boolean;
  opacity: number;
  zIndex: number;
  minZoom?: number;
  maxZoom?: number;
  interactive: boolean;
  clustering?: {
    enabled: boolean;
    radius: number;
    maxZoom: number;
  };
  heatmap?: {
    enabled: boolean;
    radius: number;
    intensity: number;
    colorRamp: string[];
  };
}

// ============================================================================
// Plugin Configuration Types 🟢
// ============================================================================

/**
 * Shapesプラグイン設定
 */
export interface ShapesPluginConfig {
  id: 'com.hierarchidb._shapes_buggy';
  name: 'Shapes Plugin';
  version: string;

  nodeTypes: [
    {
      type: 'shapes';
      displayName: 'Shapes';
      icon: 'shapes';
      color: '#2196F3';
      entityHandler: 'ShapesEntityHandler';
    },
  ];

  database: {
    tables: Array<{
      name: string;
      storage: 'core' | 'ephemeral';
      schema: string;
      ttl?: number;
    }>;
  };

  webWorkers: {
    [workerName: string]: {
      script: string;
      maxInstances: number;
      options?: {
        type?: 'module';
        credentials?: 'same-origin' | 'include' | 'omit';
      };
    };
  };

  dependencies: {
    required: string[];
    optional?: string[];
  };

  // プラグイン固有設定
  settings?: {
    defaultProcessingOptions: ShapesEntity['processingOptions'];
    defaultVectorTileOptions: TileGenerationOptions;
    maxFeatureCount: number;
    maxFileSize: number; // bytes
    supportedFormats: string[];
    cachePolicies: {
      shapes: { ttl: number; maxSize: number };
      vectorTiles: { ttl: number; maxSize: number };
      processing: { ttl: number; maxSize: number };
    };
  };
}

// ============================================================================
// Utility Types 🟢
// ============================================================================

/**
 * 座標系定義
 */
export interface CoordinateReferenceSystem {
  code: string; // 'EPSG:4326'
  name: string;
  proj4: string; // Proj4js定義文字列
  unit: 'degree' | 'meter' | 'foot';
  bounds?: [number, number, number, number];
}

/**
 * ジオメトリ統計
 */
export interface GeometryStats {
  featureCount: number;
  vertexCount: number;
  geometryTypes: Record<string, number>;
  boundingBox: [number, number, number, number];
  area?: number; // 平方メートル
  perimeter?: number; // メートル
}

/**
 * ファイルメタデータ
 */
export interface FileMetadata {
  filename: string;
  size: number;
  mimeType: string;
  encoding: string;
  hash: string; // SHA-256
  uploadedAt: Timestamp;
}

/**
 * 処理結果サマリー
 */
export interface ProcessingSummary {
  totalProcessingTime: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  outputSize: number;
  errors?: Array<{
    source: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    source: string;
    message: string;
  }>;
}

// ============================================================================
// Export All Types
// ============================================================================

export type {
  // EntityTypes
  ShapesEntity,
  ShapesWorkingCopy,
  // Styles
  ShapeStyle,
  MapLibreStyleOutput,
  // WebWorker Messages
  WorkerMessage,
  BatchDownloadMessage,
  VectorTileGenerationMessage,
  GeometryProcessingMessage,
  CoordinateTransformMessage,
  ProcessingProgressMessage,
  ProcessingCompleteMessage,
  ProcessingErrorMessage,
  // Vector Tiles
  VectorTileInfo,
  QuadTreeNode,
  TileGenerationOptions,
  // Database
  VectorTileCache,
  BatchProcessingTask,
  ShapesMetadata,
  // API
  CreateShapesRequest,
  UpdateShapesRequest,
  BatchImportRequest,
  VectorTileGenerationRequest,
  ApiResponse,
  // BaseMap Integration
  BaseMapShapesIntegration,
  ShapesLayer,
  LayerConfig,
  // Configuration
  ShapesPluginConfig,
  // Utilities
  CoordinateReferenceSystem,
  GeometryStats,
  FileMetadata,
  ProcessingSummary,
};

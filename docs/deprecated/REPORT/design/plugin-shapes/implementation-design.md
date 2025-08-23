# Plugin Shapes 実装設計

## 概要

hierarchidbフレームワークとeria-cartographの実装パターンに基づいた、実際の`@packages/plugins/shapes`プラグイン実装設計です。

**【信頼性レベル】**: 🟢 hierarchidbとeria-cartographの実装パターンに準拠した確実な設計

## 実装アーキテクチャ

### パッケージ構造 🟢

```
/packages/plugins/shapes/
├── package.json                       # npm パッケージ設定
├── plugin.config.ts                   # プラグイン設定 (hierarchidb標準)
├── tsconfig.json                       # TypeScript設定
├── README.md                          # プラグイン説明書
├── src/
│   ├── openstreetmap-type.ts                       # メインエクスポート
│   ├── types/
│   │   ├── openstreetmap-type.ts                   # 型定義エクスポート
│   │   ├── ShapesEntity.ts            # エンティティ型定義
│   │   ├── ShapesWorkingCopy.ts       # Working Copy型定義
│   │   ├── BatchTypes.ts              # バッチ処理型定義
│   │   └── WorkerTypes.ts             # WebWorker通信型定義
│   ├── handlers/
│   │   ├── ShapesEntityHandler.ts     # メインエンティティハンドラー
│   │   └── ShapesHandler.ts           # 追加ビジネスロジック
│   ├── services/
│   │   ├── ShapesService.ts           # UI側メインサービス
│   │   ├── ShapesDB.ts                # データベースアクセス層
│   │   ├── ShapesBatchService.ts      # バッチ処理サービス
│   │   └── ShapesWorkingCopyService.ts# Working Copy管理
│   ├── workers/
│   │   ├── ShapesWorker.ts            # メインWebWorker実装
│   │   ├── ShapesWorkerAPI.ts         # Worker API定義
│   │   ├── ShapesWorkerDB.ts          # Worker内DB操作
│   │   └── batch/
│   │       ├── ShapesBatchProcessor.ts # バッチ処理ロジック
│   │       └── VectorTileGenerator.ts  # ベクトルタイル生成
│   ├── components/
│   │   ├── ShapesDialog.tsx           # メイン編集ダイアログ
│   │   ├── ShapesEditor.tsx           # 図形編集UI
│   │   ├── ShapesImporter.tsx         # インポート機能UI
│   │   ├── ShapesPreview.tsx          # プレビュー表示
│   │   └── panels/
│   │       ├── ShapesBasicInfoPanel.tsx    # 基本情報パネル
│   │       ├── ShapesStylePanel.tsx        # スタイル設定パネル
│   │       ├── ShapesFileUploadPanel.tsx   # ファイルアップロード
│   │       └── ShapesBatchProgressPanel.tsx# バッチ進捗表示
│   ├── hooks/
│   │   ├── useShapesState.ts          # Shapes状態管理
│   │   ├── useShapesService.ts        # サービス接続フック
│   │   ├── useShapesBatch.ts          # バッチ処理フック
│   │   └── useShapesWorkingCopy.ts    # Working Copy管理
│   ├── routes/
│   │   ├── _index.tsx                 # デフォルト表示
│   │   ├── edit.tsx                   # 編集ルート
│   │   ├── import.tsx                 # インポートルート
│   │   └── batch.tsx                  # バッチ処理ルート
│   └── utils/
│       ├── geoJsonUtils.ts            # GeoJSON処理ユーティリティ
│       ├── coordinateTransform.ts     # 座標系変換
│       └── geometryUtils.ts           # 図形処理ユーティリティ
└── dist/                              # ビルド出力
```

## 主要実装ファイル

### 1. plugin.config.ts (hierarchidb準拠) 🟢

```typescript
/**
 * Shapesプラグイン設定
 */
import type { PluginConfig } from '@hierarchidb/worker/plugin';
import { ShapesEntityHandler } from './src/handlers/ShapesEntityHandler';

export const shapesPlugin: PluginConfig = {
  id: 'com.hierarchidb._shapes_buggy',
  name: 'Shapes Plugin', 
  version: '1.0.0',
  description: 'Geospatial shape_obsolate data management with batch processing and vector tiles',
  
  nodeTypes: [
    {
      type: '_shapes_buggy',
      displayName: 'Shapes',
      icon: '_shapes_buggy',
      color: '#2196F3'
    }
  ],
  
  database: {
    tables: [
      // Core tables
      {
        name: '_shapes_buggy',
        storage: 'core',
        schema: '&nodeId, name, geojsonData, layerConfig, defaultStyle, dataSource, updatedAt',
        indexes: ['name', 'updatedAt', 'dataSource.type']
      },
      {
        name: 'shapes_metadata',
        storage: 'core', 
        schema: '&shapesId, featureCount, totalVertices, dataSize, boundingBox, geometryTypes, crs',
        indexes: ['featureCount', 'dataSize', 'crs']
      },
      
      // Ephemeral tables
      {
        name: 'shapes_workingcopies',
        storage: 'ephemeral',
        schema: '&workingCopyId, workingCopyOf, copiedAt, isDirty',
        ttl: 86400000 // 24時間
      },
      {
        name: 'shapes_batch_tasks',
        storage: 'ephemeral',
        schema: '&taskId, type, status, progress, metadata, createdAt',
        ttl: 3600000, // 1時間
        indexes: ['status', 'type', 'createdAt']
      },
      {
        name: 'shapes_vectortiles_cache',
        storage: 'ephemeral',
        schema: '&tileKey, shapesId, zoom, x, y, data, size, createdAt',
        ttl: 43200000, // 12時間
        indexes: ['shapesId', 'zoom', 'createdAt']
      }
    ]
  },
  
  dependencies: {
    required: ['com.hierarchidb.basemap']
  },
  
  lifecycle: {
    hooks: {
      onInstall: async (context) => {
        console.log('Shapes plugin installed');
      },
      onEnable: async (context) => {
        // WebWorkerの初期化
        await context.workerRegistry?.registerWorker('_shapes_buggy', '/db/ShapesWorker.js');
      },
      onDisable: async (context) => {
        await context.workerRegistry?.unregisterWorker('_shapes_buggy');
      },
      onUninstall: async (context) => {
        console.log('Shapes plugin uninstalled');
      }
    },
    autoStart: true
  },
  
  entityHandlers: {
    shapes: new ShapesEntityHandler()
  },
  
  // プラグイン固有設定
  settings: {
    maxFeatureCount: 10000,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    defaultProcessingOptions: {
      simplification: {
        enabled: false,
        tolerance: 1.0
      },
      vectorTiles: {
        enabled: false,
        minZoom: 0,
        maxZoom: 14
      }
    },
    supportedFormats: ['geojson', 'shapefile', 'kml', 'gpx']
  }
} as const;
```

### 2. ShapesEntity.ts (eria-cartograph準拠) 🟢

```typescript
/**
 * Shapesエンティティ型定義
 */
import type { TreeNodeId } from '@hierarchidb/core';
import type { BaseEntity } from '@hierarchidb/worker/registry';

/**
 * メインShapesエンティティ (eria-cartographパターン準拠)
 */
export interface ShapesEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  
  // GeoJSONデータ (JSON文字列として保存)
  geojsonData: string; // stringified GeoJSON.FeatureCollection
  
  // レイヤー設定
  layerConfig: {
    visible: boolean;
    opacity: number;
    zIndex: number;
    minZoom?: number;
    maxZoom?: number;
    interactive: boolean;
  };
  
  // デフォルトスタイル設定
  defaultStyle: {
    point?: {
      radius: number;
      fillColor: string;
      strokeColor: string;
      strokeWidth: number;
    };
    line?: {
      color: string;
      width: number;
      pattern?: 'solid' | 'dashed' | 'dotted';
    };
    polygon?: {
      fillColor: string;
      fillOpacity: number;
      strokeColor: string;
      strokeWidth: number;
    };
  };
  
  // データソース情報 (eria-cartographパターン)
  dataSource?: {
    type: 'file' | 'url' | 'manual';
    url?: string;
    originalFilename?: string;
    lastSync?: number;
  };
  
  // 処理設定
  processingOptions?: {
    simplification?: {
      enabled: boolean;
      tolerance: number;
    };
    vectorTiles?: {
      enabled: boolean;
      minZoom: number;
      maxZoom: number;
    };
  };
  
  // ライセンス同意 (eria-cartographパターン)
  licenseAgreement: boolean;
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Shapes Working Copy (階層DB Working Copyパターン)
 */
export interface ShapesWorkingCopy extends ShapesEntity {
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;
  
  // 編集履歴 (eria-cartographパターン)
  editHistory?: Array<{
    timestamp: number;
    operation: 'create' | 'update' | 'delete' | 'style';
    changes: Record<string, any>;
  }>;
}

/**
 * バッチタスク定義 (eria-cartographパターン)
 */
export interface BatchTaskLike {
  taskId: string;
  sessionId: string; // nodeId
  type: 'download' | 'vectorTile' | 'geometry' | 'transform';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  stage: string;
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

/**
 * バッチバッファデータ (eria-cartographパターン)
 */
export interface BatchBufferData {
  taskId: string;
  sessionId: string;
  data: ArrayBuffer | string;
  metadata?: {
    format: string;
    size: number;
    hash?: string;
  };
  createdAt: number;
}
```

### 3. ShapesEntityHandler.ts (hierarchidbパターン準拠) 🟢

```typescript
/**
 * Shapesエンティティハンドラー
 */
import type { TreeNodeId } from '@hierarchidb/core';
import { EntityHandler } from '@hierarchidb/worker/handlers';
import type { ShapesEntity, ShapesWorkingCopy } from '../types';

export class ShapesEntityHandler extends EntityHandler<ShapesEntity, never, ShapesWorkingCopy> {
  
  // ==================
  // 基本CRUD操作 (hierarchidbパターン準拠)
  // ==================
  
  async createEntity(nodeId: TreeNodeId, data?: Partial<ShapesEntity>): Promise<ShapesEntity> {
    const entity: ShapesEntity = {
      nodeId,
      name: data?.name || 'New Shapes',
      description: data?.description,
      geojsonData: data?.geojsonData || '{"type":"FeatureCollection","features":[]}',
      layerConfig: {
        visible: true,
        opacity: 0.8,
        zIndex: 1,
        interactive: true,
        ...data?.layerConfig
      },
      defaultStyle: {
        polygon: {
          fillColor: '#3388ff',
          fillOpacity: 0.6,
          strokeColor: '#0066cc',
          strokeWidth: 2
        },
        ...data?.defaultStyle
      },
      licenseAgreement: data?.licenseAgreement || false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    // メインテーブルに保存
    await this.coreDB.table('_shapes_buggy').add(entity);
    
    // メタデータ生成・保存
    await this.updateMetadata(nodeId, entity);
    
    return entity;
  }
  
  async getEntity(nodeId: TreeNodeId): Promise<ShapesEntity | undefined> {
    return await this.coreDB.table('_shapes_buggy').get(nodeId);
  }
  
  async updateEntity(nodeId: TreeNodeId, data: Partial<ShapesEntity>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: Date.now()
    };
    
    await this.coreDB.table('_shapes_buggy').update(nodeId, updateData);
    
    // メタデータ更新
    if (data.geojsonData) {
      const entity = await this.getEntity(nodeId);
      if (entity) {
        await this.updateMetadata(nodeId, { ...entity, ...updateData });
      }
    }
  }
  
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // カスケード削除
    await Promise.all([
      this.coreDB.table('_shapes_buggy').delete(nodeId),
      this.coreDB.table('shapes_metadata').delete(nodeId),
      this.ephemeralDB.table('shapes_workingcopies').where('workingCopyOf').equals(nodeId).delete(),
      this.ephemeralDB.table('shapes_vectortiles_cache').where('shapesId').equals(nodeId).delete(),
      this.ephemeralDB.table('shapes_batch_tasks').where('sessionId').equals(nodeId).delete()
    ]);
  }
  
  // ==================
  // Shapes固有の特殊API (eria-cartographパターン準拠)
  // ==================
  
  /**
   * GeoJSONインポート
   */
  async importGeoJSON(nodeId: TreeNodeId, geojsonData: string, options?: {
    mergeStrategy?: 'replace' | 'append' | 'merge';
    transformCRS?: string;
  }): Promise<void> {
    try {
      // GeoJSON検証
      const geojson = JSON.parse(geojsonData);
      if (geojson.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON: Expected FeatureCollection');
      }
      
      // 座標系変換 (必要に応じて)
      let processedData = geojsonData;
      if (options?.transformCRS) {
        processedData = await this.transformCoordinates(geojsonData, options.transformCRS);
      }
      
      // マージ戦略に応じて処理
      if (options?.mergeStrategy === 'append') {
        const existing = await this.getEntity(nodeId);
        if (existing) {
          const existingGeoJSON = JSON.parse(existing.geojsonData);
          const newGeoJSON = JSON.parse(processedData);
          existingGeoJSON.features.push(...newGeoJSON.features);
          processedData = JSON.stringify(existingGeoJSON);
        }
      }
      
      await this.updateEntity(nodeId, { geojsonData: processedData });
      
    } catch (error) {
      throw new Error(`GeoJSON import failed: ${error.message}`);
    }
  }
  
  /**
   * GeoJSONエクスポート
   */
  async exportGeoJSON(nodeId: TreeNodeId, options?: {
    format?: 'geojson' | 'shapefile' | 'kml';
    includeStyle?: boolean;
  }): Promise<string> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Shapes not found');
    }
    
    let geojson = JSON.parse(entity.geojsonData);
    
    // スタイル情報を追加 (必要に応じて)
    if (options?.includeStyle) {
      geojson.features.forEach(feature => {
        if (!feature.properties) feature.properties = {};
        feature.properties._style = entity.defaultStyle;
      });
    }
    
    // フォーマット変換 (将来拡張用)
    switch (options?.format) {
      case 'geojson':
      default:
        return JSON.stringify(geojson, null, 2);
    }
  }
  
  /**
   * バッチ処理開始 (eria-cartographパターン)
   */
  async startBatchProcessing(nodeId: TreeNodeId, sources: Array<{
    id: string;
    url: string;
    format: string;
  }>, options?: {
    concurrent?: number;
    timeout?: number;
  }): Promise<string> {
    const taskId = `batch-${nodeId}-${Date.now()}`;
    
    const task: BatchTaskLike = {
      taskId,
      sessionId: nodeId,
      type: 'download',
      status: 'pending',
      progress: 0,
      stage: 'initializing',
      metadata: {
        sources,
        options: {
          concurrent: options?.concurrent || 4,
          timeout: options?.timeout || 30000
        }
      },
      createdAt: Date.now()
    };
    
    await this.ephemeralDB.table('shapes_batch_tasks').add(task);
    
    // WebWorkerに処理を委託
    // TODO: WorkerServiceを通じてバッチ処理を開始
    
    return taskId;
  }
  
  /**
   * ベクトルタイル生成
   */
  async generateVectorTiles(nodeId: TreeNodeId, options: {
    minZoom: number;
    maxZoom: number;
    tileSize: number;
  }): Promise<string> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Shapes not found');
    }
    
    const taskId = `vectortiles-${nodeId}-${Date.now()}`;
    
    const task: BatchTaskLike = {
      taskId,
      sessionId: nodeId,
      type: 'vectorTile',
      status: 'pending',
      progress: 0,
      stage: 'initializing',
      metadata: {
        options,
        featureCount: this.getFeatureCount(entity.geojsonData)
      },
      createdAt: Date.now()
    };
    
    await this.ephemeralDB.table('shapes_batch_tasks').add(task);
    
    // WebWorkerに処理を委託
    // TODO: ベクトルタイル生成処理
    
    return taskId;
  }
  
  // ==================
  // ヘルパーメソッド
  // ==================
  
  private async updateMetadata(nodeId: TreeNodeId, entity: ShapesEntity): Promise<void> {
    try {
      const geojson = JSON.parse(entity.geojsonData);
      const features = geojson.features || [];
      
      // 統計計算
      const featureCount = features.length;
      const totalVertices = features.reduce((sum, feature) => {
        return sum + this.countVertices(feature.geometry);
      }, 0);
      
      // バウンディングボックス計算
      const boundingBox = this.calculateBoundingBox(features);
      
      // ジオメトリタイプ集計
      const geometryTypes = [...new Set(features.map(f => f.geometry.type))];
      
      const metadata = {
        shapesId: nodeId,
        featureCount,
        totalVertices,
        dataSize: entity.geojsonData.length,
        boundingBox: JSON.stringify(boundingBox),
        geometryTypes: JSON.stringify(geometryTypes),
        crs: geojson.crs?.properties?.name || 'EPSG:4326'
      };
      
      await this.coreDB.table('shapes_metadata').put(metadata);
      
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  }
  
  private async transformCoordinates(geojsonData: string, targetCRS: string): Promise<string> {
    // TODO: 座標系変換実装 (proj4jsを使用)
    return geojsonData;
  }
  
  private getFeatureCount(geojsonData: string): number {
    try {
      const geojson = JSON.parse(geojsonData);
      return geojson.features?.length || 0;
    } catch {
      return 0;
    }
  }
  
  private countVertices(geometry: any): number {
    // TODO: ジオメトリの頂点数カウント実装
    return 0;
  }
  
  private calculateBoundingBox(features: any[]): [number, number, number, number] {
    // TODO: バウンディングボックス計算実装
    return [0, 0, 0, 0];
  }
}
```

### 4. ShapesWorker.ts (eria-cartographパターン準拠) 🟡

```typescript
/**
 * ShapesWebWorker実装
 */
import * as Comlink from "comlink";
import type { ShapesWorkerAPI } from "./ShapesWorkerAPI";
import type { ShapesEntity, BatchTaskLike, BatchBufferData } from "../types";
import { ShapesWorkerDB } from "./ShapesWorkerDB";

class ShapesWorkerImpl implements ShapesWorkerAPI {
  private shapesDB: ShapesWorkerDB;
  
  constructor() {
    this.shapesDB = ShapesWorkerDB.getInstance();
  }
  
  // Shapes基本操作
  async saveShapesEntity(data: ShapesEntity): Promise<void> {
    return this.shapesDB.saveShapesState(data);
  }
  
  async getShapesEntity(nodeId: string): Promise<ShapesEntity | undefined> {
    return this.shapesDB.getShapesState(nodeId);
  }
  
  async deleteShapesEntity(nodeId: string): Promise<void> {
    return this.shapesDB.deleteShapesState(nodeId);
  }
  
  // バッチ処理 (eria-cartographパターン)
  async processBatchDownload(taskId: string, sources: Array<{
    id: string;
    url: string;
    format: string;
  }>, options: {
    concurrent: number;
    timeout: number;
  }): Promise<void> {
    const task = await this.shapesDB.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // 並行ダウンロード処理
    const downloadPromises = sources.map(async (source, index) => {
      try {
        // 進捗更新
        await this.updateTaskProgress(taskId, (index + 1) / sources.length * 50, `Downloading ${source.id}`);
        
        // ファイルダウンロード
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(options.timeout)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.arrayBuffer();
        
        // バッファデータ保存
        const bufferData: BatchBufferData = {
          taskId: `${taskId}-${source.id}`,
          sessionId: task.sessionId,
          data,
          metadata: {
            format: source.format,
            size: data.byteLength,
            sourceId: source.id
          },
          createdAt: Date.now()
        };
        
        await this.shapesDB.saveBufferData(bufferData);
        
        return { sourceId: source.id, success: true, size: data.byteLength };
        
      } catch (error) {
        console.error(`Download failed for ${source.id}:`, error);
        return { sourceId: source.id, success: false, error: error.message };
      }
    });
    
    // 並行実行 (制限付き)
    const results = [];
    for (let i = 0; i < downloadPromises.length; i += options.concurrent) {
      const chunk = downloadPromises.slice(i, i + options.concurrent);
      const chunkResults = await Promise.allSettled(chunk);
      results.push(...chunkResults);
    }
    
    // 結果統合・GeoJSON生成
    await this.consolidateResults(taskId, results);
    
    // タスク完了
    await this.updateTaskProgress(taskId, 100, 'completed');
  }
  
  // ベクトルタイル生成
  async generateVectorTiles(taskId: string, geojsonData: string, options: {
    minZoom: number;
    maxZoom: number;
    tileSize: number;
  }): Promise<void> {
    // TODO: QuadTreeアルゴリズムによるベクトルタイル生成
    // TODO: MVT形式での出力
    // TODO: キャッシュへの保存
  }
  
  private async updateTaskProgress(taskId: string, progress: number, stage: string): Promise<void> {
    await this.shapesDB.updateTask(taskId, {
      progress: Math.min(100, Math.max(0, progress)),
      stage,
      updatedAt: Date.now()
    });
  }
  
  private async consolidateResults(taskId: string, results: any[]): Promise<void> {
    // TODO: 複数のGeoJSONファイルを統合
    // TODO: 座標系の統一
    // TODO: エラーハンドリング
  }
}

// Comlinkエクスポート
Comlink.expose(new ShapesWorkerImpl());
```

### 5. ShapesService.ts (eria-cartographパターン準拠) 🟡

```typescript
/**
 * ShapesService - UI層からのメインインターフェース
 */
import type { ShapesEntity, BatchTaskLike } from "../types";
import type { TreeNodeId } from "@hierarchidb/core";
import { BaseResourceWorkerService } from "@/shared/db/services/BaseResourceWorkerService";
import type { ShapesWorkerAPI } from "../db/ShapesWorkerAPI";

export interface IShapesService {
  // 基本CRUD
  saveShapesEntity(data: ShapesEntity): Promise<void>;
  getShapesEntity(nodeId: string | TreeNodeId): Promise<ShapesEntity | undefined>;
  deleteShapesEntity(nodeId: string | TreeNodeId): Promise<void>;
  updateShapesEntity(nodeId: string | TreeNodeId, data: Partial<ShapesEntity>): Promise<void>;
  
  // バッチ処理
  startBatchDownload(sources: any[], options?: any): Promise<string>;
  getBatchStatus(taskId: string): Promise<BatchTaskLike | undefined>;
  cancelBatch(taskId: string): Promise<void>;
  
  // ファイル操作
  importGeoJSON(nodeId: string, file: File): Promise<void>;
  exportGeoJSON(nodeId: string, options?: any): Promise<Blob>;
}

export class ShapesService extends BaseResourceWorkerService<ShapesWorkerAPI> implements IShapesService {
  
  constructor() {
    super('_shapes_buggy'); // Worker名を指定
  }
  
  async saveShapesEntity(data: ShapesEntity): Promise<void> {
    const worker = await this.getWorker();
    return worker.saveShapesEntity(data);
  }
  
  async getShapesEntity(nodeId: string | TreeNodeId): Promise<ShapesEntity | undefined> {
    const worker = await this.getWorker();
    return worker.getShapesEntity(String(nodeId));
  }
  
  async deleteShapesEntity(nodeId: string | TreeNodeId): Promise<void> {
    const worker = await this.getWorker();
    return worker.deleteShapesEntity(String(nodeId));
  }
  
  async updateShapesEntity(nodeId: string | TreeNodeId, data: Partial<ShapesEntity>): Promise<void> {
    const current = await this.getShapesEntity(nodeId);
    if (!current) {
      throw new Error('Shapes entity not found');
    }
    
    const updated = { ...current, ...data, updatedAt: Date.now() };
    return this.saveShapesEntity(updated);
  }
  
  async startBatchDownload(sources: Array<{
    id: string;
    url: string; 
    format: string;
  }>, options?: {
    concurrent?: number;
    timeout?: number;
  }): Promise<string> {
    const worker = await this.getWorker();
    const taskId = `batch-${Date.now()}`;
    
    // バックグラウンドで処理開始
    worker.processBatchDownload(taskId, sources, {
      concurrent: options?.concurrent || 4,
      timeout: options?.timeout || 30000
    }).catch(error => {
      console.error('Batch download failed:', error);
    });
    
    return taskId;
  }
  
  async getBatchStatus(taskId: string): Promise<BatchTaskLike | undefined> {
    const worker = await this.getWorker();
    return worker.getTask(taskId);
  }
  
  async cancelBatch(taskId: string): Promise<void> {
    const worker = await this.getWorker();
    return worker.cancelTask(taskId);
  }
  
  async importGeoJSON(nodeId: string, file: File): Promise<void> {
    const text = await file.text();
    
    // GeoJSON検証
    try {
      const geojson = JSON.parse(text);
      if (geojson.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON format');
      }
    } catch (error) {
      throw new Error(`Invalid GeoJSON file: ${error.message}`);
    }
    
    // エンティティ更新
    await this.updateShapesEntity(nodeId, {
      geojsonData: text,
      dataSource: {
        type: 'file',
        originalFilename: file.name,
        lastSync: Date.now()
      }
    });
  }
  
  async exportGeoJSON(nodeId: string, options?: {
    format?: 'geojson';
    includeStyle?: boolean;
  }): Promise<Blob> {
    const entity = await this.getShapesEntity(nodeId);
    if (!entity) {
      throw new Error('Shapes not found');
    }
    
    let data = entity.geojsonData;
    
    if (options?.includeStyle) {
      const geojson = JSON.parse(data);
      geojson.features.forEach(feature => {
        if (!feature.properties) feature.properties = {};
        feature.properties._style = entity.defaultStyle;
      });
      data = JSON.stringify(geojson, null, 2);
    }
    
    return new Blob([data], { type: 'application/geo+json' });
  }
}
```

## 統合ポイント

### hierarchidbフレームワーク統合 🟢

1. **プラグイン登録**: `plugin.config.ts`でhierarchidb標準に準拠
2. **エンティティハンドラー**: `EntityHandler<T>`を継承したCRUD実装
3. **データベーステーブル**: CoreDB/EphemeralDBの適切な使い分け
4. **Working Copyパターン**: 安全な編集機能の実装
5. **ルーティング**: hierarchidbの階層的URLパターン対応

### eria-cartographパターン活用 🟡

1. **Service層**: UI-Worker分離アーキテクチャ
2. **バッチ処理**: 並行ダウンロード・進捗管理パターン
3. **データ永続化**: EntityとBuffer Data分離パターン  
4. **エラーハンドリング**: 段階的フォールバック機能
5. **WebWorker通信**: Comlink RPCによる型安全な通信

## UI コンポーネント設計 🟢

### React コンポーネントアーキテクチャ

hierarchidbフレームワークとeria-cartographのUIパターンに基づいたReactコンポーネント設計:

#### 1. ShapesDialog.tsx (メインダイアログ) 🟢

```typescript
/**
 * ShapesDialog - メイン編集ダイアログ
 * eria-cartographのStepper Dialog パターンを継承
 */
import React, { useCallback, useEffect } from 'react';
import { Box, Paper, Typography, TextField } from '@mui/material';
import { Shapes as ShapesIcon } from '@mui/icons-material';
import { CommonDialog } from '@hierarchidb/ui-core/containers/dialogs/CommonDialog';
import { useShapesManager } from '../hooks/useShapesManager';
import { useDraftChipState } from '@hierarchidb/ui-core/hooks/useDraftChipState';
import { useResourceDialogLifecycle } from '@hierarchidb/ui-core/hooks/useResourceDialogLifecycle';
import type { BaseResourceDialogProps } from '@hierarchidb/ui-core/types/dialog';
import type { ShapesEntity } from '../types';

export interface ShapesDialogProps extends BaseResourceDialogProps {
  preloadedData?: {
    shapesNode: { name: string; description?: string } | null;
    shapesEntity: ShapesEntity | null;
  };
}

export function ShapesDialog({
  mode,
  isDraft,
  parentNodeId,
  currentStep,
  onStepChange,
  targetNode,
  preloadedData,
}: ShapesDialogProps) {

  // hierarchidbのShapesマネージャー (Working Copy パターン)
  const manager = useShapesManager({
    mode,
    isDraft: isDraft || false,
    parentNodeId,
    pageNodeId: parentNodeId,
    currentStep: currentStep || 0,
    onStepChange,
    targetNodeId: targetNode?.id || "",
    preloadedData,
  });

  // hierarchidbのリソースライフサイクル管理
  useResourceDialogLifecycle({
    nodeId: targetNode?.id || "",
    resourceType: '_shapes_buggy',
    mode,
    isDialogOpen: true,
    sessionType: mode === "create" ? "creation" : "editing",
    sessionMetadata: { parentNodeId },
  });

  // hierarchidbのDraft Chip機能
  const { shouldShowDraftChip } = useDraftChipState({
    mode,
    isDraft: isDraft || false,
    workingCopyManager: manager.workingCopyManager,
  });

  // フォーム状態管理
  const { formData, updateField } = manager.formState;
  const { 
    name, 
    description, 
    geojsonData,
    layerConfig,
    defaultStyle,
    processingOptions
  } = formData;

  // ステップ管理
  const { currentStep: activeStep } = manager.stepManager;
  const { handleStepClick } = manager;
  
  // バリデーション
  const { canProceedToNextStep, canSubmit } = manager;

  // ナビゲーション
  const { handlePrevious, handleNext, handleSubmit } = manager;

  // ステップコンテンツ定義
  const stepComponents = [
    // Step 1: 基本情報
    <Box key="step1">
      <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
        図形データの基本情報を設定してください。
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <TextField
            label="名前"
            value={name}
            onChange={(e) => {
              updateField("name", e.target.value);
              manager.markUnsaved();
            }}
            variant="outlined"
            fullWidth
            required
            helperText="図形データセットの名前"
          />
        </Box>
        <TextField
          label="説明"
          value={description}
          onChange={(e) => {
            updateField("description", e.target.value);
            manager.markUnsaved();
          }}
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          helperText="図形データの説明（任意）"
        />
      </Paper>
    </Box>,

    // Step 2: GeoJSONインポート
    <Box key="step2">
      <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
        GeoJSONデータをインポートしてください。
      </Typography>
      <ShapesFileUploadPanel
        onFileSelect={manager.handleFileImport}
        supportedFormats={['geojson', 'shapefile', 'kml', 'gpx']}
        maxFileSize={100 * 1024 * 1024} // 100MB
      />
    </Box>,

    // Step 3: スタイル設定
    <Box key="step3">
      <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
        図形の表示スタイルを設定してください。
      </Typography>
      <ShapesStylePanel
        style={defaultStyle}
        onChange={(newStyle) => {
          updateField("defaultStyle", newStyle);
          manager.markUnsaved();
        }}
      />
    </Box>,

    // Step 4: 処理オプション
    <Box key="step4">
      <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
        データ処理オプションを設定してください。
      </Typography>
      <ShapesProcessingOptionsPanel
        options={processingOptions}
        onChange={(newOptions) => {
          updateField("processingOptions", newOptions);
          manager.markUnsaved();
        }}
      />
    </Box>,

    // Step 5: プレビュー・確認
    <Box key="step5">
      <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
        設定内容を確認してください。
      </Typography>
      <ShapesPreview
        entity={formData}
        onEdit={(field, value) => updateField(field, value)}
      />
    </Box>,
  ];

  return (
    <CommonDialog
      variant="stepper"
      mode={mode}
      isLoading={manager.isLoading}
      unsaved={manager.hasUnsavedChanges}
      currentStep={activeStep}
      maxValidStepIndex={manager.stepLabels.length}
      nextButtonEnabled={canProceedToNextStep}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      
      // UI カスタマイズ
      title={mode === "create" ? "図形データのインポート" : "図形データの編集"}
      subtitle="GeoJSONまたは空間データファイルをインポート"
      icon={<ShapesIcon />}
      showDraftChip={shouldShowDraftChip}
      
      steps={manager.stepLabels.map((label, index) => ({
        label,
        content: stepComponents[index],
      }))}

      maxWidth="lg"
      depth={2}
      
      // ナビゲーション
      closeUrl="../.."
      
      // 未保存変更
      unsavedChangesMessage="図形データ設定に未保存の変更があります。破棄してもよろしいですか？"
      unsavedChangesTitle="図形データ設定を破棄しますか？"
      
      // ステッパーオプション
      stepperOptions={{
        handleClickStepButton: handleStepClick,
        handleClickPrevious: handlePrevious,
        handleClickNext: handleNext,
        handleSubmit: handleSubmit,
        nonLinear: mode === "edit",
        allowStepClick: true,
        scrollableSteps: [2, 3, 4],
      }}
    />
  );
}
```

#### 2. ShapesFileUploadPanel.tsx 🟢

```typescript
/**
 * ShapesFileUploadPanel - ファイルアップロード機能パネル
 */
import React, { useCallback } from 'react';
import { Box, Paper, Typography, Button, LinearProgress } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { FileDropzone } from '@hierarchidb/ui-core/containers/FileDropzone';
import { useShapesService } from '../hooks/useShapesService';

interface ShapesFileUploadPanelProps {
  nodeId?: string;
  onFileSelect: (file: File) => Promise<void>;
  supportedFormats: string[];
  maxFileSize: number;
  isLoading?: boolean;
  progress?: number;
}

export function ShapesFileUploadPanel({
  nodeId,
  onFileSelect,
  supportedFormats,
  maxFileSize,
  isLoading = false,
  progress = 0,
}: ShapesFileUploadPanelProps) {
  
  const shapesService = useShapesService();

  const handleFileSelect = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    
    // ファイル検証
    if (file.size > maxFileSize) {
      throw new Error(`ファイルサイズが制限を超えています (最大: ${maxFileSize / 1024 / 1024}MB)`);
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(extension || '')) {
      throw new Error(`サポートされていないファイル形式です: ${extension}`);
    }

    await onFileSelect(file);
  }, [onFileSelect, maxFileSize, supportedFormats]);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        図形データファイルのアップロード
      </Typography>
      
      <FileDropzone
        onFilesSelect={handleFileSelect}
        accept={supportedFormats.map(fmt => `.${fmt}`).join(',')}
        maxFiles={1}
        maxSize={maxFileSize}
        disabled={isLoading}
      >
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            ファイルをドラッグ&ドロップするか、クリックして選択
          </Typography>
          <Typography variant="caption" color="text.secondary">
            対応形式: {supportedFormats.join(', ')} (最大 {Math.round(maxFileSize / 1024 / 1024)}MB)
          </Typography>
        </Box>
      </FileDropzone>

      {isLoading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            ファイルを処理中... {Math.round(progress)}%
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}
    </Paper>
  );
}
```

#### 3. ShapesStylePanel.tsx 🟢

```typescript
/**
 * ShapesStylePanel - スタイル設定パネル
 */
import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Slider, 
  FormControl,
  InputLabel,
  Select,
  MenuItem 
} from '@mui/material';
import { ColorPicker } from '@hierarchidb/ui-core/containers/ColorPicker';
import type { ShapesEntity } from '../types';

interface ShapesStylePanelProps {
  style: ShapesEntity['defaultStyle'];
  onChange: (style: ShapesEntity['defaultStyle']) => void;
}

export function ShapesStylePanel({ style, onChange }: ShapesStylePanelProps) {
  
  const updatePolygonStyle = (field: string, value: any) => {
    onChange({
      ...style,
      polygon: {
        ...style.polygon,
        [field]: value,
      },
    });
  };

  const updateLineStyle = (field: string, value: any) => {
    onChange({
      ...style,
      line: {
        ...style.line,
        [field]: value,
      },
    });
  };

  const updatePointStyle = (field: string, value: any) => {
    onChange({
      ...style,
      point: {
        ...style.point,
        [field]: value,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
      
      {/* ポリゴンスタイル */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          ポリゴンスタイル
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ColorPicker
            label="塗りつぶし色"
            value={style.polygon?.fillColor || '#3388ff'}
            onChange={(color) => updatePolygonStyle('fillColor', color)}
          />
          <ColorPicker
            label="境界線色"
            value={style.polygon?.strokeColor || '#0066cc'}
            onChange={(color) => updatePolygonStyle('strokeColor', color)}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            塗りつぶし透明度: {Math.round((style.polygon?.fillOpacity || 0.6) * 100)}%
          </Typography>
          <Slider
            value={(style.polygon?.fillOpacity || 0.6) * 100}
            onChange={(_, value) => updatePolygonStyle('fillOpacity', (value as number) / 100)}
            min={0}
            max={100}
            step={5}
          />
        </Box>

        <TextField
          label="境界線幅"
          type="number"
          value={style.polygon?.strokeWidth || 2}
          onChange={(e) => updatePolygonStyle('strokeWidth', parseInt(e.target.value))}
          sx={{ width: 120 }}
        />
      </Paper>

      {/* ラインスタイル */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          ラインスタイル
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ColorPicker
            label="線色"
            value={style.line?.color || '#ff4444'}
            onChange={(color) => updateLineStyle('color', color)}
          />
          <TextField
            label="線幅"
            type="number"
            value={style.line?.width || 2}
            onChange={(e) => updateLineStyle('width', parseInt(e.target.value))}
            sx={{ width: 120 }}
          />
        </Box>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>線パターン</InputLabel>
          <Select
            value={style.line?.pattern || 'solid'}
            onChange={(e) => updateLineStyle('pattern', e.target.value)}
            label="線パターン"
          >
            <MenuItem value="solid">実線</MenuItem>
            <MenuItem value="dashed">破線</MenuItem>
            <MenuItem value="dotted">点線</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* ポイントスタイル */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          ポイントスタイル
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ColorPicker
            label="塗りつぶし色"
            value={style.point?.fillColor || '#ff6600'}
            onChange={(color) => updatePointStyle('fillColor', color)}
          />
          <ColorPicker
            label="境界線色"
            value={style.point?.strokeColor || '#cc4400'}
            onChange={(color) => updatePointStyle('strokeColor', color)}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="半径"
            type="number"
            value={style.point?.radius || 5}
            onChange={(e) => updatePointStyle('radius', parseInt(e.target.value))}
            sx={{ width: 120 }}
          />
          <TextField
            label="境界線幅"
            type="number"
            value={style.point?.strokeWidth || 1}
            onChange={(e) => updatePointStyle('strokeWidth', parseInt(e.target.value))}
            sx={{ width: 120 }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
```

#### 4. ShapesBatchProgressPanel.tsx 🟢

```typescript
/**
 * ShapesBatchProgressPanel - バッチ処理進捗表示パネル
 */
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  LinearProgress, 
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert
} from '@mui/material';
import { useShapesBatch } from '../hooks/useShapesBatch';
import type { BatchTaskLike } from '../types';

interface ShapesBatchProgressPanelProps {
  nodeId: string;
  onComplete?: () => void;
}

export function ShapesBatchProgressPanel({ 
  nodeId, 
  onComplete 
}: ShapesBatchProgressPanelProps) {
  
  const { 
    tasks, 
    overallProgress, 
    currentStage,
    errors,
    isCompleted,
    refresh
  } = useShapesBatch(nodeId);

  // 自動更新
  useEffect(() => {
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  // 完了時のコールバック
  useEffect(() => {
    if (isCompleted && onComplete) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  const getStatusColor = (status: BatchTaskLike['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'primary';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: BatchTaskLike['status']) => {
    switch (status) {
      case 'pending': return '待機中';
      case 'running': return '実行中';
      case 'completed': return '完了';
      case 'failed': return '失敗';
      case 'cancelled': return 'キャンセル';
      default: return '不明';
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          バッチ処理の進捗
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {currentStage} - 全体進捗: {Math.round(overallProgress)}%
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={overallProgress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.length}件のエラーが発生しました
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          タスク詳細
        </Typography>
        
        <List dense>
          {tasks.map((task) => (
            <ListItem key={task.taskId}>
              <ListItemText
                primary={`${task.type} - ${task.stage}`}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={task.progress} 
                      sx={{ flexGrow: 1, height: 4 }}
                    />
                    <Typography variant="caption">
                      {Math.round(task.progress)}%
                    </Typography>
                  </Box>
                }
              />
              <Chip
                label={getStatusLabel(task.status)}
                color={getStatusColor(task.status)}
                size="small"
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
```

#### 5. useShapesService.ts (Service フック) 🟢

```typescript
/**
 * useShapesService - ShapesService接続フック
 */
import { useContext, useEffect, useState } from 'react';
import { ShapesServiceContext } from '../contexts/ShapesServiceContext';
import type { IShapesService } from '../services/ShapesService';

export function useShapesService(): IShapesService {
  const context = useContext(ShapesServiceContext);
  
  if (!context) {
    throw new Error('useShapesService must be used within ShapesServiceProvider');
  }
  
  if (!context.shapesService) {
    throw new Error('ShapesService not initialized');
  }
  
  return context.shapesService;
}

export function useShapesBatch(nodeId: string) {
  const shapesService = useShapesService();
  const [tasks, setTasks] = useState<BatchTaskLike[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const refresh = async () => {
    try {
      const sessionTasks = await shapesService.getTasksBySession(nodeId);
      setTasks(sessionTasks);
      
      // 全体進捗計算
      const avgProgress = sessionTasks.length > 0 
        ? sessionTasks.reduce((sum, task) => sum + task.progress, 0) / sessionTasks.length
        : 0;
      setOverallProgress(avgProgress);
      
      // 現在のステージ
      const runningTask = sessionTasks.find(task => task.status === 'running');
      setCurrentStage(runningTask?.stage || '待機中');
      
      // エラー収集
      const failedTasks = sessionTasks.filter(task => task.status === 'failed');
      setErrors(failedTasks.map(task => task.error?.message || 'Unknown error'));
      
    } catch (error) {
      console.error('Failed to refresh batch status:', error);
    }
  };

  const isCompleted = tasks.length > 0 && tasks.every(task => 
    task.status === 'completed' || task.status === 'failed'
  );

  return {
    tasks,
    overallProgress,
    currentStage,
    errors,
    isCompleted,
    refresh,
  };
}
```

### UIパターン統合ポイント 🟢

1. **hierarchidbダイアログパターン**: CommonDialogを基盤としたステッパー形式
2. **Working Copyパターン**: 安全な編集機能とドラフト状態管理
3. **Service層統合**: ReactフックによるWorkerサービスへの接続
4. **MUIコンポーネント**: hierarchidb標準のMaterial-UI v5使用
5. **ファイル処理**: ドラッグ&ドロップとプログレス表示
6. **エラーハンドリング**: Alert、Toast、ダイアログによる段階的エラー表示
7. **リアルタイム更新**: WebWorkerからの進捗イベント購読

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "basemap\u30d7\u30e9\u30b0\u30a4\u30f3\u69cb\u9020\u3092\u5206\u6790", "status": "completed", "id": "analyze-basemap"}, {"content": "eria-cartograph shapes\u5b9f\u88c5\u30d1\u30bf\u30fc\u30f3\u3092\u8abf\u67fb", "status": "completed", "id": "analyze-eria-shapes"}, {"content": "hierarchidb\u30d5\u30ec\u30fc\u30e0\u30ef\u30fc\u30af\u306b\u6e96\u62e0\u3057\u305f\u8a2d\u8a08\u66f4\u65b0", "status": "completed", "id": "update-design"}, {"content": "\u30d7\u30e9\u30b0\u30a4\u30f3\u69cb\u9020\u3068\u30c7\u30a3\u30ec\u30af\u30c8\u30ea\u8a2d\u8a08", "status": "completed", "id": "plugin-structure"}, {"content": "\u30a8\u30f3\u30c6\u30a3\u30c6\u30a3\u30cf\u30f3\u30c9\u30e9\u30fc\u5b9f\u88c5\u8a2d\u8a08", "status": "completed", "id": "entity-handler-design"}, {"content": "Worker\u5b9f\u88c5\u8a2d\u8a08", "status": "completed", "id": "worker-design"}, {"content": "UI\u30b3\u30f3\u30dd\u30fc\u30cd\u30f3\u30c8\u8a2d\u8a08", "status": "in_progress", "id": "ui-component-design"}]
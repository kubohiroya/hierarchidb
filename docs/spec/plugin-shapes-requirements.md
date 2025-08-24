# Plugin Shapes 要件定義書

## 概要

Shapesプラグインは、地理空間図形データ（ポイント、ライン、ポリゴン）の管理・編集・表示機能を提供するプラグインです。eria-cartographの図形管理機能を参考に、WebWorkerによるバッチダウンロード処理、ベクトルマップ生成、GeoJSON処理機能を階層的ツリー構造で管理します。

**【信頼性レベル】**: 🟡 既存のBaseMapプラグイン実装とeria-cartographの地図処理パターンから妥当な推測

## 関連文書

- **ユーザストーリー**: [📖 plugin-shapes-user-stories.md](plugin-shapes-user-stories.md)
- **受け入れ基準**: [✅ plugin-shapes-acceptance-criteria.md](plugin-shapes-acceptance-criteria.md)
- **参考実装**: `/packages/plugins/basemap/` - BaseMapプラグイン実装
- **改善仕様**: [integrated-improvements-from-eria.md](integrated-improvements-from-eria.md)

## 機能要件（EARS記法）

### 通常要件

- **REQ-001**: システムはShapesエンティティ（ポイント、ライン、ポリゴン）を作成・編集・削除しなければならない 🟢
- **REQ-002**: システムはGeoJSON形式でのインポート・エクスポート機能を提供しなければならない 🟡
- **REQ-003**: システムは図形の座標系変換（WGS84、Web Mercatorなど）を処理しなければならない 🟡
- **REQ-004**: システムは図形のスタイル設定（色、線幅、透明度、塗りつぶし）を管理しなければならない 🟡
- **REQ-005**: システはShapesのWorking Copy作成・編集・コミット機能を提供しなければならない 🟢
- **REQ-006**: システムは図形データのベクトルタイル化処理を実行しなければならない 🔴
- **REQ-007**: システムは複数図形のレイヤー管理と表示順序制御を提供しなければならない 🟡

### 条件付き要件

- **REQ-101**: ユーザーがShapesを作成する場合、システムはデフォルトスタイル設定を適用しなければならない 🟡
- **REQ-102**: 図形データが大量（1000個以上）の場合、システムはバッチ処理により段階的にロードしなければならない 🟡
- **REQ-103**: 外部GeoJSONファイルがインポートされる場合、システムは座標系を自動検出し適切に変換しなければならない 🟡
- **REQ-104**: 図形の表示範囲が現在のビューポートを超える場合、システムは適切なズームレベルを自動計算しなければならない 🟡
- **REQ-105**: WebWorkerでのバッチ処理中にエラーが発生した場合、システムは処理を中断し適切にロールバックしなければならない 🟡

### 状態要件

- **REQ-201**: ShapesがDraft状態にある場合、システムはプレビューモードでの表示を可能にしなければならない 🟢
- **REQ-202**: Shapesがアクティブ状態にある場合、システムは関連するBaseMapで自動表示しなければならない 🟡
- **REQ-203**: 図形が編集中状態にある場合、システムは他のユーザーからの同時編集を防止しなければならない 🟡
- **REQ-204**: WebWorkerが処理中状態にある場合、システムは進行状況インジケーターを表示しなければならない 🟡

### オプション要件

- **REQ-301**: システムは図形の簡素化（Douglas-Peuckerアルゴリズム）を提供してもよい 🔴
- **REQ-302**: システムは図形のクリッピング・結合・差分等のジオメトリ演算を提供してもよい 🔴
- **REQ-303**: システムは他のShapesからの図形継承・参照機能を提供してもよい 🔴
- **REQ-304**: システムはShapesテンプレートのインポート・エクスポート機能を提供してもよい 🔴

### 制約要件

- **REQ-401**: システムはGeoJSON仕様（RFC 7946）に準拠した形式でデータを処理しなければならない 🟢
- **REQ-402**: システムは階層的プラグインルーティング（/t/:treeId/:pageNodeId/:targetNodeId/shapes/:action）に対応しなければならない 🟢
- **REQ-403**: システムはBaseMapプラグインとの連携インターフェースを提供しなければならない 🟡
- **REQ-404**: システムはWebWorkerでの処理において最大5MBのメモリ使用量を超過してはならない 🔴
- **REQ-405**: システムはベクトルタイル生成において最大ズームレベル18までをサポートしなければならない 🟡

## WebWorkerバッチ処理要件

### バッチダウンロード処理

- **REQ-501**: WebWorkerは複数の外部データソース（URL、ファイル）からの並行ダウンロードを実行しなければならない 🟡
- **REQ-502**: バッチ処理は失敗したアイテムを自動リトライ（最大3回）しなければならない 🟡
- **REQ-503**: ダウンロード進行状況はメインスレッドにリアルタイムで通知されなければならない 🟡
- **REQ-504**: 大きなファイル（10MB超）はストリーミング処理により段階的に処理しなければならない 🔴

### ベクトルマップ生成処理

- **REQ-601**: WebWorkerはGeoJSONデータをMapboxベクトルタイル（MVT）形式に変換しなければならない 🟡
- **REQ-602**: タイル生成処理はQuadTreeアルゴリズムにより効率的に階層化しなければならない 🔴
- **REQ-603**: 生成されたベクトルタイルはgzip圧縮により最適化されなければならない 🟡
- **REQ-604**: タイル境界での図形クリッピングは適切に処理されなければならない 🟡
- **REQ-605**: 異なるズームレベルでの図形簡素化は段階的に適用されなければならない 🟡

## 非機能要件

### パフォーマンス

- **NFR-001**: 図形データ（1000個以下）の表示は2秒以内に完了しなければならない 🟡
- **NFR-002**: WebWorkerでのバッチ処理は最大同時実行数を4個に制限しなければならない 🟡
- **NFR-003**: ベクトルタイル生成は1平方キロメートルあたり500ms以内に完了しなければならない 🔴
- **NFR-004**: 図形編集時のリアルタイムプレビューは100ms以内に更新されなければならない 🟡
- **NFR-005**: Shapesデータのキャッシュ有効期間は12時間でなければならない 🟢

### スケーラビリティ

- **NFR-101**: 単一Shapesエンティティは最大10,000個の図形要素をサポートしなければならない 🟡
- **NFR-102**: 同時並行でのWebWorker処理は最大4個のワーカーまでサポートしなければならない 🟡
- **NFR-103**: ベクトルタイルキャッシュは最大500MBまでの容量を管理できなければならない 🔴

### セキュリティ

- **NFR-201**: 外部データソースからのダウンロードはCSP（Content Security Policy）に準拠しなければならない 🟢
- **NFR-202**: WebWorkerでの処理はサンドボックス環境で実行されなければならない 🟢
- **NFR-203**: GeoJSONデータの検証によりスクリプトインジェクションを防止しなければならない 🟡

### ユーザビリティ

- **NFR-301**: 図形編集インターフェースは直感的なドラッグ&ドロップ操作を提供しなければならない 🟡
- **NFR-302**: バッチ処理の進行状況は視覚的プログレスバーで表示されなければならない 🟡
- **NFR-303**: エラー発生時は具体的で理解しやすいメッセージを表示しなければならない 🟡

## Edgeケース

### エラー処理

- **EDGE-001**: 不正なGeoJSON形式が検出された場合、システムはエラー詳細と修正提案を表示する 🟡
- **EDGE-002**: WebWorkerがクラッシュした場合、システムは自動的に新しいワーカーで処理を再開する 🟡
- **EDGE-003**: ネットワーク接続が失われた場合、システムはローカルキャッシュを使用して継続動作する 🟡
- **EDGE-004**: メモリ不足が発生した場合、システムは一時的にデータを永続化ストレージに退避する 🔴

### 境界値

- **EDGE-101**: 座標値が有効範囲（経度±180度、緯度±90度）を超えた場合はクランプ処理を行う 🟡
- **EDGE-102**: 図形の頂点数が10,000を超えた場合は自動的に簡素化処理を適用する 🔴
- **EDGE-103**: ファイルサイズが100MBを超えた場合はストリーミング処理に切り替える 🔴

## データ仕様

### ShapesEntity

```typescript
export interface ShapesEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  
  // GeoJSON Feature Collection
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id?: string | number;
      geometry: {
        type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
        coordinates: number[] | number[][] | number[][][];
      };
      properties: {
        name?: string;
        description?: string;
        style?: ShapeStyle;
        metadata?: Record<string, any>;
      };
    }>;
    bbox?: [number, number, number, number]; // [minX, minY, maxX, maxY]
    crs?: {
      type: 'name';
      properties: {
        name: string; // 例: 'EPSG:4326'
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
  };
  
  // スタイル設定
  defaultStyle: ShapeStyle;
  
  // データソース情報
  dataSource?: {
    type: 'file' | 'url' | 'manual';
    url?: string;
    lastSync?: number;
    autoSync?: boolean;
  };
  
  // 処理設定
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
      maxZoom: number;
      tileSize: number;
    };
  };
  
  // 統計情報
  stats?: {
    featureCount: number;
    totalVertices: number;
    dataSize: number; // bytes
    lastProcessed?: number;
  };
}

export interface ShapeStyle {
  // ポイントスタイル
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
  };
  
  // ラインスタイル
  line?: {
    color: string;
    width: number;
    opacity: number;
    pattern?: 'solid' | 'dashed' | 'dotted';
    dashArray?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
  
  // ポリゴンスタイル
  polygon?: {
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity: number;
    fillPattern?: string; // CSS pattern or image URL
  };
  
  // ラベルスタイル
  label?: {
    field?: string; // プロパティフィールド名
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
    textOffset?: [number, number];
    haloColor?: string;
    haloWidth?: number;
  };
}
```

### WebWorkerバッチ処理インターフェース

```typescript
// WebWorker メッセージ型定義
export type WorkerMessage = 
  | BatchDownloadMessage
  | VectorTileGenerationMessage
  | ProcessingProgressMessage
  | ProcessingCompleteMessage
  | ProcessingErrorMessage;

export interface BatchDownloadMessage {
  type: 'batchDownload';
  taskId: string;
  sources: Array<{
    id: string;
    url: string;
    format: 'geojson' | 'shapefile' | 'kml' | 'gpx';
    headers?: Record<string, string>;
  }>;
  options: {
    concurrent: number; // 同時実行数
    timeout: number; // タイムアウト(ms)
    retryCount: number; // リトライ回数
    chunkSize?: number; // ストリーミング用チャンクサイズ
  };
}

export interface VectorTileGenerationMessage {
  type: 'generateVectorTiles';
  taskId: string;
  geojson: GeoJSON.FeatureCollection;
  options: {
    minZoom: number;
    maxZoom: number;
    tileSize: number;
    buffer: number; // タイル境界バッファ
    simplification: {
      [zoom: number]: number; // ズームレベル別簡素化許容値
    };
  };
}

export interface ProcessingProgressMessage {
  type: 'progress';
  taskId: string;
  progress: {
    current: number;
    total: number;
    stage: 'download' | 'parse' | 'process' | 'generate' | 'complete';
    message?: string;
  };
}

export interface ProcessingCompleteMessage {
  type: 'complete';
  taskId: string;
  result: {
    geojson?: GeoJSON.FeatureCollection;
    vectorTiles?: Map<string, ArrayBuffer>; // tileKey -> tile data
    stats?: {
      processingTime: number;
      inputSize: number;
      outputSize: number;
      tileCount?: number;
    };
  };
}

export interface ProcessingErrorMessage {
  type: 'error';
  taskId: string;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}
```

### プラグイン設定

```typescript
export const shapesPlugin: PluginConfig = {
  id: 'com.hierarchidb.shapes',
  name: 'Shapes Plugin',
  version: '1.0.0',
  nodeTypes: [{
    type: 'shapes',
    displayName: 'Shapes',
    icon: 'shapes',
    color: '#2196F3'
  }],
  database: {
    tables: [
      {
        name: 'shapes',
        storage: 'core',
        schema: '&nodeId, name, geojson, layerConfig, defaultStyle, dataSource, updatedAt'
      },
      {
        name: 'shapes_workingcopies',
        storage: 'ephemeral',
        schema: '&workingCopyId, workingCopyOf, copiedAt',
        ttl: 86400000 // 24時間
      },
      {
        name: 'shapes_vectortiles_cache',
        storage: 'ephemeral',
        schema: '&tileKey, zoom, x, y, data, cachedAt',
        ttl: 43200000 // 12時間
      },
      {
        name: 'shapes_processing_tasks',
        storage: 'ephemeral',
        schema: '&taskId, status, progress, createdAt',
        ttl: 3600000 // 1時間
      }
    ]
  },
  webWorkers: {
    // WebWorker設定
    batchProcessor: {
      script: '/workers/shapesBatchProcessor.js',
      options: {
        type: 'module',
        credentials: 'same-origin'
      }
    }
  },
  dependencies: {
    required: ['com.hierarchidb.basemap']
  }
};
```

## 技術仕様

### プラグインアーキテクチャ

- **パッケージ場所**: `/packages/plugins/shapes/`
- **エンティティハンドラー**: `ShapesEntityHandler`
- **WebWorkerスクリプト**: `src/workers/shapesBatchProcessor.ts`
- **UIコンポーネント**: `src/routes/` 配下
- **データベーステーブル**: `shapes`, `shapes_workingcopies`, `shapes_vectortiles_cache`, `shapes_processing_tasks`

### WebWorker処理フロー

```typescript
// バッチダウンロード処理フロー
class ShapesBatchProcessor {
  async processBatchDownload(message: BatchDownloadMessage): Promise<void> {
    const { taskId, sources, options } = message;
    
    // 1. 並行ダウンロード管理
    const downloadQueue = new DownloadQueue(options.concurrent);
    const results = new Map<string, ProcessingResult>();
    
    // 2. 進行状況追跡
    let completedCount = 0;
    const totalCount = sources.length;
    
    for (const source of sources) {
      downloadQueue.add(async () => {
        try {
          // 3. ダウンロード実行
          const data = await this.downloadWithRetry(source, options.retryCount);
          
          // 4. 形式変換
          const geojson = await this.convertToGeoJSON(data, source.format);
          
          // 5. 座標系変換
          const transformedGeoJSON = await this.transformCoordinates(geojson);
          
          // 6. 結果保存
          results.set(source.id, {
            geojson: transformedGeoJSON,
            stats: this.calculateStats(transformedGeoJSON)
          });
          
          // 7. 進行状況通知
          completedCount++;
          this.notifyProgress(taskId, completedCount, totalCount, 'download');
          
        } catch (error) {
          // 8. エラーハンドリング
          this.notifyError(taskId, source.id, error);
        }
      });
    }
    
    // 9. 完了通知
    await downloadQueue.waitAll();
    this.notifyComplete(taskId, results);
  }
  
  async generateVectorTiles(message: VectorTileGenerationMessage): Promise<void> {
    const { taskId, geojson, options } = message;
    
    // 1. QuadTreeによる階層化
    const quadTree = new QuadTree(geojson, options);
    
    // 2. ズームレベル別処理
    const tiles = new Map<string, ArrayBuffer>();
    
    for (let zoom = options.minZoom; zoom <= options.maxZoom; zoom++) {
      // 3. タイルグリッド生成
      const tileGrid = quadTree.getTilesForZoom(zoom);
      
      for (const tile of tileGrid) {
        // 4. 図形簡素化
        const simplifiedFeatures = this.simplifyForZoom(
          tile.features, 
          options.simplification[zoom]
        );
        
        // 5. タイル境界クリッピング
        const clippedFeatures = this.clipToTileBounds(
          simplifiedFeatures, 
          tile.bounds,
          options.buffer
        );
        
        // 6. MVT形式変換
        const mvtData = this.convertToMVT(clippedFeatures, tile);
        
        // 7. 圧縮
        const compressedData = await this.compressData(mvtData);
        
        // 8. タイルキー生成とキャッシュ保存
        const tileKey = `${zoom}/${tile.x}/${tile.y}`;
        tiles.set(tileKey, compressedData);
        
        // 9. 進行状況通知
        this.notifyProgress(taskId, tiles.size, tileGrid.length, 'generate');
      }
    }
    
    // 10. 完了通知
    this.notifyComplete(taskId, { vectorTiles: tiles });
  }
}
```

### BaseMapプラグインとの連携

```typescript
interface BaseMapShapesIntegration {
  addShapesLayer(baseMapId: TreeNodeId, shapesId: TreeNodeId, layerConfig?: LayerConfig): Promise<void>;
  removeShapesLayer(baseMapId: TreeNodeId, shapesId: TreeNodeId): Promise<void>;
  updateShapesLayer(baseMapId: TreeNodeId, shapesId: TreeNodeId, layerConfig: LayerConfig): Promise<void>;
  getVisibleShapesLayers(baseMapId: TreeNodeId): Promise<ShapesLayer[]>;
  
  // ベクトルタイル連携
  addVectorTileSource(baseMapId: TreeNodeId, sourceId: string, tiles: Map<string, ArrayBuffer>): Promise<void>;
  removeVectorTileSource(baseMapId: TreeNodeId, sourceId: string): Promise<void>;
}
```

### ルーティング仕様

- `/t/:treeId/:pageNodeId/:targetNodeId/shapes` - Shapes管理画面
- `/t/:treeId/:pageNodeId/:targetNodeId/shapes/edit` - 図形編集
- `/t/:treeId/:pageNodeId/:targetNodeId/shapes/import` - データインポート
- `/t/:treeId/:pageNodeId/:targetNodeId/shapes/export` - データエクスポート
- `/t/:treeId/:pageNodeId/:targetNodeId/shapes/batch` - バッチ処理画面

## 実装優先度

### Phase 1 (必須機能) 🟢
- ShapesエンティティのCRUD操作
- 基本的なGeoJSONインポート・エクスポート
- Working Copy機能
- BaseMapとの基本連携

### Phase 2 (重要機能) 🟡
- WebWorkerによるバッチダウンロード
- 図形スタイル設定と編集UI
- 座標系変換処理
- レイヤー管理機能

### Phase 3 (拡張機能) 🔴
- ベクトルタイル生成処理
- 高度なジオメトリ演算
- パフォーマンス最適化
- 図形簡素化・クリッピング機能

この要件定義書は、eria-cartographの実装パターンを参考に、階層的プラグインアーキテクチャでの図形データ管理を実現するための包括的な仕様を提供します。
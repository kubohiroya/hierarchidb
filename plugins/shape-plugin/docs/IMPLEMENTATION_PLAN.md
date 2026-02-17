# Shape Plugin 実装計画書

## 📋 概要

shape-pluginの現在のダミー実装を実際の処理に置き換える実装計画です。
eria-cartographプロジェクトの実装を参考に、hierarchidbアーキテクチャに適合した形で実装を進めます。

## 🎯 実装目標

1. **バッチ処理の実装**
   - simulateProcessing()を実際のデータ処理に置き換え
   - 各ステージ（Download, Extract1, Extract2, VectorTiles）の実装

2. **データ永続化**
   - EphemeralDBへの実際のデータ保存
   - CoreDBとの連携強化

3. **Worker層の実装**
   - Web Worker経由での非同期処理
   - 進捗通知の実装

## 📦 実装対象ファイル

### 1. BuildSessionOrchestrator.ts
**現状**: simulateProcessing()でダミー遅延のみ
**実装内容**:
```typescript
// 変更前
await this.simulateProcessing(100);

// 変更後
await this.downloadWorker.downloadData({
  url: dataSource.getUrl(),
  format: dataSource.format,
  adminLevel: config.adminLevel,
  bbox: config.bbox
});
```

### 2. Worker Services (4ファイル)
**対象**:
- DownloadWorker.ts
- ExtractWorker1.ts
- ExtractWorker2.ts
- VectorTileWorker.ts

**現状**: Mock implementation コメント付きの空実装
**実装内容**:
```typescript
// 実際のデータ処理実装
class DownloadWorker {
  async downloadData(params: DownloadParams): Promise<DownloadResult> {
    // 1. HTTPリクエストでデータ取得
    const response = await fetch(params.url);
    const data = await response.json();
    
    // 2. GeoJSONパース
    const features = parseGeoJSON(data);
    
    // 3. EphemeralDBに保存
    await this.ephemeralDB.rawFeatures.bulkAdd(features);
    
    // 4. 空間インデックス作成
    await this.createSpatialIndex(features);
    
    return {
      featureCount: features.length,
      totalSize: response.headers.get('content-length'),
      bbox: calculateBbox(features)
    };
  }
}
```

### 3. EphemeralDataCleanupService.ts
**現状**: Mock transaction, 実際のクリーンアップなし
**実装内容**:
```typescript
class EphemeralDataCleanupService {
  async cleanupBatchData(sessionId: string): Promise<void> {
    await this.ephemeralDB.transaction('rw', 
      this.ephemeralDB.rawFeatures,
      this.ephemeralDB.processedFeatures,
      this.ephemeralDB.vectorTiles,
      async () => {
        // 実際のデータ削除
        await this.ephemeralDB.rawFeatures
          .where('sessionId').equals(sessionId)
          .delete();
        
        await this.ephemeralDB.processedFeatures
          .where('sessionId').equals(sessionId)
          .delete();
        
        await this.ephemeralDB.vectorTiles
          .where('sessionId').equals(sessionId)
          .delete();
      }
    );
  }
}
```

### 4. ShapeEntityHandler.ts (Worker側)
**現状**: Mock implementation - would fetch from EphemeralDB
**実装内容**:
```typescript
async getDraft(nodeId: NodeId): Promise<ShapeDraft | undefined> {
  // 実際のEphemeralDBクエリ
  const draft = await this.ephemeralDB.workingCopies
    .where('nodeId').equals(nodeId)
    .first();
  
  if (!draft) return undefined;
  
  // 関連データも取得
  const features = await this.ephemeralDB.processedFeatures
    .where('draftId').equals(draft.id)
    .toArray();
  
  return {
    ...draft,
    features,
    isDirty: draft.version !== draft.committedVersion
  };
}
```

## 🔄 実装ステージ

### Stage 1: データモデル定義 (1日)
- [ ] EphemeralDBスキーマ定義
- [ ] 型定義の整理
- [ ] インターフェース定義

### Stage 2: Download実装 (2日)
- [ ] HTTPクライアント実装
- [ ] GeoJSONパーサー実装
- [ ] データ検証とエラーハンドリング
- [ ] 進捗通知実装

### Stage 3: Extract実装 (3日)
- [ ] Douglas-Peuckerアルゴリズム実装
- [ ] 管理レベル別簡略化設定
- [ ] バッファストレージ実装
- [ ] メモリ効率的な処理

### Stage 4: VectorTile実装 (3日)
- [ ] MVT形式へのエンコード
- [ ] タイル座標計算
- [ ] ズームレベル別最適化
- [ ] タイルキャッシュ実装

### Stage 5: 統合とテスト (2日)
- [ ] エンドツーエンドテスト
- [ ] パフォーマンステスト
- [ ] エラーケーステスト
- [ ] ドキュメント更新

## 📊 実装詳細

### 1. Download Stage 実装

#### 1.1 データソース対応
```typescript
interface DataSourceHandler {
  gadm: GADMHandler;
  naturalEarth: NaturalEarthHandler;
  custom: CustomHandler;
}

class GADMHandler {
  async download(country: string, level: number): Promise<GeoJSON> {
    const url = `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country}_${level}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new DownloadError(`Failed to download: ${response.status}`);
    }
    
    return await response.json();
  }
}
```

#### 1.2 プログレス通知
```typescript
class DownloadProgress {
  private bytesDownloaded = 0;
  private totalBytes = 0;
  
  async trackDownload(response: Response): Promise<ArrayBuffer> {
    const reader = response.body!.getReader();
    const contentLength = +response.headers.get('Content-Length')!;
    this.totalBytes = contentLength;
    
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      this.bytesDownloaded += value.length;
      
      // 進捗通知
      postMessage({
        type: 'progress',
        payload: {
          stage: 'download',
          progress: (this.bytesDownloaded / this.totalBytes) * 100,
          bytesDownloaded: this.bytesDownloaded,
          totalBytes: this.totalBytes
        }
      });
    }
    
    return concatenateArrayBuffers(chunks);
  }
}
```

### 2. Extract Stage 実装

#### 2.1 Douglas-Peucker実装
```typescript
class GeometrySimplifier {
  extract(coordinates: number[][], tolerance: number): number[][] {
    if (coordinates.length <= 2) return coordinates;
    
    // Find point with maximum distance
    let maxDistance = 0;
    let maxIndex = 0;
    
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const distance = this.pointToLineDistance(
        coordinates[i], start, end
      );
      
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // Recursively extract
    if (maxDistance > tolerance) {
      const left = this.extract(
        coordinates.slice(0, maxIndex + 1), 
        tolerance
      );
      const right = this.extract(
        coordinates.slice(maxIndex), 
        tolerance
      );
      
      return [...left.slice(0, -1), ...right];
    }
    
    return [start, end];
  }
}
```

#### 2.2 管理レベル別設定
```typescript
const SIMPLIFICATION_CONFIG = {
  0: { tolerance: 0.01, minArea: 1000 },    // Country
  1: { tolerance: 0.005, minArea: 500 },    // State/Province  
  2: { tolerance: 0.001, minArea: 100 },    // County
  3: { tolerance: 0.0005, minArea: 50 },    // City
  4: { tolerance: 0.0001, minArea: 10 }     // District
};
```

### 3. VectorTile Stage 実装

#### 3.1 MVTエンコーディング
```typescript
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

class MVTEncoder {
  encode(features: GeoJSON.Feature[], z: number, x: number, y: number): Uint8Array {
    const tile = {
      layers: {
        'shapes': {
          version: 2,
          extent: 4096,
          features: features.map(f => this.encodeFeature(f, z, x, y))
        }
      }
    };
    
    const pbf = new Pbf();
    VectorTile.write(tile, pbf);
    return pbf.finish();
  }
  
  private encodeFeature(feature: GeoJSON.Feature, z: number, x: number, y: number) {
    const coords = this.projectToTileCoords(
      feature.geometry.coordinates, z, x, y
    );
    
    return {
      id: feature.properties?.id,
      type: this.getGeometryType(feature.geometry.type),
      properties: feature.properties,
      geometry: coords
    };
  }
}
```

#### 3.2 タイルキャッシュ
```typescript
class TileCache {
  private cache = new Map<string, Uint8Array>();
  private lru: string[] = [];
  private maxSize = 100 * 1024 * 1024; // 100MB
  private currentSize = 0;
  
  set(key: string, tile: Uint8Array): void {
    // LRU eviction
    while (this.currentSize + tile.length > this.maxSize && this.lru.length > 0) {
      const evictKey = this.lru.shift()!;
      const evictTile = this.cache.get(evictKey)!;
      this.cache.delete(evictKey);
      this.currentSize -= evictTile.length;
    }
    
    this.cache.set(key, tile);
    this.lru.push(key);
    this.currentSize += tile.length;
  }
  
  get(key: string): Uint8Array | undefined {
    const tile = this.cache.get(key);
    if (tile) {
      // Move to end (most recently used)
      const index = this.lru.indexOf(key);
      this.lru.splice(index, 1);
      this.lru.push(key);
    }
    return tile;
  }
}
```

## 🧪 テスト計画

### 単体テスト
```typescript
describe('BuildSessionOrchestrator', () => {
  it('should download actual data', async () => {
    const orchestrator = new BuildSessionOrchestrator();
    const sessionId = await manager.createSession({
      nodeId: 'test-node' as NodeId,
      dataSource: 'gadm',
      country: 'JP',
      adminLevel: 1
    });
    
    const result = await manager.executeDownloadStage(sessionId);
    
    expect(result.success).toBe(true);
    expect(result.processedTasks).toBeGreaterThan(0);
    expect(result.failedTasks).toBe(0);
  });
});
```

### 統合テスト
```typescript
describe('Shape Plugin E2E', () => {
  it('should complete full pipeline', async () => {
    const api = new ShapePluginAPI();
    
    // Create shape node
    const nodeId = await api.createShapeNode({
      name: 'Japan Admin Boundaries',
      dataSource: 'gadm',
      country: 'JP'
    });
    
    // Start build processing
    const downloadTaskPayloads = await api.generateDownloadTaskPayloadsFromSelection(
      'gadm',
      [[true, true, true]],
    );
    const sessionId = await api.startBuildSession(
      nodeId,
      { adminLevels: [0, 1, 2], extraction: 'auto' },
      downloadTaskPayloads,
    );
    
    // Wait for completion
    await api.waitForCompletion(sessionId);
    
    // Verify results
    const tiles = await api.getVectorTiles(nodeId, 5, 28, 12);
    expect(tiles).toBeDefined();
    expect(tiles.byteLength).toBeGreaterThan(0);
  });
});
```

## 📈 パフォーマンス目標

- **Download**: 10MB/秒以上
- **Extract**: 10,000 features/秒以上
- **VectorTile**: 100 tiles/秒以上
- **メモリ使用量**: 500MB以下
- **並列処理**: 最大4 Workers

## 🚀 実装優先順位

1. **優先度高**
   - BuildSessionOrchestrator.executeDownloadStage()
   - DownloadWorker実装
   - EphemeralDB接続

2. **優先度中**
   - ExtractWorker1/2実装
   - 進捗通知システム
   - エラーハンドリング

3. **優先度低**
   - VectorTileWorker最適化
   - キャッシュ戦略
   - パフォーマンスチューニング

## 📝 注意事項

1. **既存コードとの互換性維持**
   - PublicAPIインターフェースは変更しない
   - 既存のUIコンポーネントとの連携を保つ

2. **エラーハンドリング**
   - ネットワークエラーの適切な処理
   - 部分的失敗の許容とリトライ

3. **メモリ管理**
   - 大容量データのストリーミング処理
   - 不要データの即座の解放

4. **テスタビリティ**
   - モック可能な設計
   - 依存性注入の活用

## 🔗 関連ドキュメント

- [Shape Plugin Architecture](./ARCHITECTURE.md)
- [Batch Processing Guide](./BATCH_PROCESSING.md)
- [Worker Communication](./WORKER_COMMUNICATION.md)
- [Testing Strategy](./TESTING_STRATEGY.md)

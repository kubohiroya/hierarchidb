# データソースストラテジー設計仕様書

## 1. 概要

HierarchiDBプラグインにおけるデータソースの多様性に対応するため、ストラテジーパターンを採用したデータアクセス・処理システムの設計を行う。各プラグイン（shape, location, route）が独自のデータソースを持ちながら、共通のインターフェースで統一的に扱えるアーキテクチャを提供する。

## 2. 要件定義

### 2.1 機能要件

#### データアクセス要件
- **多様なデータソース対応**: REST API、GraphQL、ファイルダウンロード、WebSocket、FTP等
- **認証対応**: APIキー、OAuth、Basic認証、カスタム認証
- **リトライ・エラーハンドリング**: ネットワーク障害、レート制限への対応
- **キャッシュ機能**: データの有効期限管理、差分更新対応

#### データ処理要件
- **フォーマット変換**: JSON、CSV、XML、GeoJSON、Shapefile等の相互変換
- **バリデーション**: スキーマ検証、データ整合性チェック
- **フィルタリング**: 地理的範囲、時間範囲、属性条件による絞り込み
- **集計・統計**: データの前処理、統計情報生成

#### バッチ処理要件
- **スケジュール実行**: 定期実行、トリガー実行
- **進捗管理**: 処理状況の可視化、中断・再開機能
- **パフォーマンス最適化**: 並列処理、ストリーミング処理

### 2.2 非機能要件

- **パフォーマンス**: 大容量データ（100MB+）の効率的処理
- **スケーラビリティ**: 複数データソースの同時処理
- **信頼性**: 障害時の自動復旧、データ整合性保証
- **保守性**: 新しいデータソースの容易な追加

## 3. アーキテクチャ設計

### 3.1 全体構成

```typescript
// 共通インターフェース
interface DataSourceStrategy<TRawData = any, TProcessedData = any> {
  readonly id: string;
  readonly name: string;
  readonly config: DataSourceConfig;
  
  // データ取得
  fetchData(options?: FetchOptions): Promise<TRawData>;
  
  // データ処理
  processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;
  
  // バリデーション
  validateData(data: TProcessedData): Promise<ValidationResult>;
  
  // 保存
  saveData(data: TProcessedData, target: SaveTarget): Promise<SaveResult>;
}
```

### 3.2 共通設定定義

```typescript
// データソース基本設定
interface DataSourceConfig {
  // 基本情報
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // アクセス設定
  access: AccessConfig;
  
  // 処理設定
  processing: ProcessingConfig;
  
  // スケジュール設定
  schedule?: ScheduleConfig;
  
  // キャッシュ設定
  cache?: CacheConfig;
}

// アクセス設定
interface AccessConfig {
  method: 'REST' | 'GraphQL' | 'File' | 'WebSocket' | 'FTP' | 'Custom';
  baseUrl?: string;
  endpoints?: Record<string, string>;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: RetryConfig;
}

// 認証設定
interface AuthConfig {
  type: 'none' | 'api-key' | 'oauth' | 'basic' | 'bearer' | 'custom';
  credentials?: Record<string, string>;
  refreshStrategy?: RefreshStrategy;
}

// 処理設定
interface ProcessingConfig {
  inputFormat: DataFormat;
  outputFormat: DataFormat;
  validation?: ValidationRule[];
  transformations?: TransformationRule[];
  filters?: FilterRule[];
  aggregations?: AggregationRule[];
}
```

### 3.3 プラグイン別データソース実装

#### Shape Plugin データソース

```typescript
// Natural Earth データソース
export class NaturalEarthShapeStrategy implements DataSourceStrategy<NaturalEarthRawData, ShapeProcessedData> {
  readonly id = 'natural-earth-shapes';
  readonly name = 'Natural Earth Shapes';
  readonly config: DataSourceConfig = {
    id: 'natural-earth-shapes',
    name: 'Natural Earth Vector Data',
    version: '1.0.0',
    access: {
      method: 'File',
      baseUrl: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/',
      endpoints: {
        countries: '50m/cultural/ne_50m_admin_0_countries.zip',
        states: '50m/cultural/ne_50m_admin_1_states_provinces.zip',
        cities: '50m/cultural/ne_50m_populated_places.zip'
      },
      authentication: { type: 'none' },
      timeout: 30000,
      retries: { count: 3, delay: 1000 }
    },
    processing: {
      inputFormat: 'shapefile',
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties.NAME', rule: 'required' }
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:3857' },
        { type: 'simplify', tolerance: 0.01 }
      ]
    },
    cache: {
      ttl: 86400000, // 24時間
      strategy: 'etag'
    }
  };

  async fetchData(options?: FetchOptions): Promise<NaturalEarthRawData> {
    const { endpoint = 'countries', bbox, adminLevel } = options || {};
    
    // ファイルダウンロード戦略
    const downloadUrl = `${this.config.access.baseUrl}${this.config.access.endpoints?.[endpoint]}`;
    
    return await this.downloadAndExtractShapefile(downloadUrl, {
      bbox,
      adminLevel
    });
  }

  async processData(rawData: NaturalEarthRawData, options?: ProcessOptions): Promise<ShapeProcessedData> {
    // Shapefile → GeoJSON変換
    const geojson = await this.convertShapefileToGeoJSON(rawData);
    
    // フィルタリング適用
    const filtered = await this.applyFilters(geojson, options?.filters);
    
    // 座標変換
    const transformed = await this.applyTransformations(filtered, this.config.processing.transformations);
    
    return {
      type: 'FeatureCollection',
      features: transformed.features,
      metadata: {
        source: 'natural-earth',
        processedAt: new Date().toISOString(),
        count: transformed.features.length
      }
    };
  }

  private async downloadAndExtractShapefile(url: string, options: any): Promise<NaturalEarthRawData> {
    // ZIP ダウンロード → 解凍 → Shapefile読み込み
    // 実装詳細...
  }
}

// OpenStreetMap Overpass API データソース
export class OverpassShapeStrategy implements DataSourceStrategy<OverpassRawData, ShapeProcessedData> {
  readonly id = 'overpass-shapes';
  
  async fetchData(options?: FetchOptions): Promise<OverpassRawData> {
    const { bbox, tags, timeout = 25 } = options || {};
    
    // Overpass QLクエリ構築
    const query = this.buildOverpassQuery(bbox, tags, timeout);
    
    // POST リクエスト実行
    return await this.executeOverpassQuery(query);
  }

  private buildOverpassQuery(bbox?: BoundingBox, tags?: TagFilter[], timeout?: number): string {
    // Overpass QL クエリの動的生成
    // 実装詳細...
  }
}
```

#### Location Plugin データソース

```typescript
// GeoNames データソース
export class GeoNamesLocationStrategy implements DataSourceStrategy<GeoNamesRawData, LocationProcessedData> {
  readonly id = 'geonames-locations';
  readonly config: DataSourceConfig = {
    // ...設定
    access: {
      method: 'REST',
      baseUrl: 'http://api.geonames.org/',
      endpoints: {
        search: 'searchJSON',
        get: 'getJSON',
        hierarchy: 'hierarchyJSON'
      },
      authentication: {
        type: 'api-key',
        credentials: { username: process.env.GEONAMES_USERNAME }
      },
      rateLimit: {
        requests: 1000,
        period: 3600000 // 1時間
      }
    }
  };

  async fetchData(options?: FetchOptions): Promise<GeoNamesRawData> {
    const { query, country, featureClass, maxRows = 100 } = options || {};
    
    // GeoNames API パラメータ構築
    const params = this.buildGeoNamesParams({ query, country, featureClass, maxRows });
    
    // レート制限チェック
    await this.checkRateLimit();
    
    // API リクエスト実行
    return await this.makeApiRequest(params);
  }

  private async makeApiRequest(params: Record<string, any>): Promise<GeoNamesRawData> {
    // REST API 呼び出し戦略
    // 実装詳細...
  }
}

// World Port Index データソース
export class WorldPortIndexStrategy implements DataSourceStrategy<PortIndexRawData, LocationProcessedData> {
  async fetchData(options?: FetchOptions): Promise<PortIndexRawData> {
    // バッチダウンロード戦略
    const batchProcessor = new PortIndexBatchProcessor(this.config);
    
    return await batchProcessor.execute({
      downloadPath: options?.downloadPath || './tmp/port-index',
      extractAttributes: [
        'port_name', 'country', 'latitude', 'longitude', 
        'harbor_size', 'harbor_type', 'shelter', 'tide_range'
      ]
    });
  }
}
```

#### Route Plugin データソース

```typescript
// OpenFlights データソース
export class OpenFlightsRouteStrategy implements DataSourceStrategy<FlightRoutesRawData, RouteProcessedData> {
  async fetchData(options?: FetchOptions): Promise<FlightRoutesRawData> {
    // GitHub Raw データ取得戦略
    const routesUrl = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';
    const airportsUrl = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';
    
    // 複数ファイルの並列ダウンロード
    const [routesData, airportsData] = await Promise.all([
      this.downloadCSV(routesUrl),
      this.downloadCSV(airportsUrl)
    ]);
    
    return { routes: routesData, airports: airportsData };
  }

  async processData(rawData: FlightRoutesRawData, options?: ProcessOptions): Promise<RouteProcessedData> {
    // ルートと空港データの結合処理
    const processedRoutes = await this.joinRouteAirportData(rawData.routes, rawData.airports);
    
    // 地理的フィルタリング
    const filteredRoutes = await this.applyGeographicFilters(processedRoutes, options?.geoFilters);
    
    return {
      routes: filteredRoutes,
      metadata: {
        totalRoutes: processedRoutes.length,
        filteredRoutes: filteredRoutes.length,
        processedAt: new Date().toISOString()
      }
    };
  }
}

// Searoute.js 海路計算データソース
export class SearouteCalculationStrategy implements DataSourceStrategy<SearouteInputData, RouteProcessedData> {
  async processData(rawData: SearouteInputData, options?: ProcessOptions): Promise<RouteProcessedData> {
    // searoute-jsライブラリを使用した海路計算
    const searoute = await import('searoute-js');
    
    const routes = await Promise.all(
      rawData.portPairs.map(async (pair) => {
        // 2点間の海路を計算（陸地回避）
        const route = await searoute.getSeaRoute(
          [pair.origin.longitude, pair.origin.latitude],
          [pair.destination.longitude, pair.destination.latitude],
          {
            units: 'nauticalmiles',
            blocked: options?.blockedAreas || []
          }
        );
        
        return {
          origin: pair.origin,
          destination: pair.destination,
          geometry: route.geometry,
          distance: route.properties.distance,
          duration: this.calculateDuration(route.properties.distance, options?.vesselSpeed),
          waypoints: route.geometry.coordinates
        };
      })
    );
    
    return {
      routes,
      metadata: {
        algorithm: 'searoute-js',
        calculatedAt: new Date().toISOString(),
        routeCount: routes.length
      }
    };
  }
}
```

## 4. ストラテジーファクトリー

```typescript
// データソース戦略ファクトリー
export class DataSourceStrategyFactory {
  private strategies = new Map<string, () => DataSourceStrategy>();

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    // Shape strategies
    this.register('natural-earth-shapes', () => new NaturalEarthShapeStrategy());
    this.register('overpass-shapes', () => new OverpassShapeStrategy());
    
    // Location strategies
    this.register('geonames-locations', () => new GeoNamesLocationStrategy());
    this.register('world-port-index', () => new WorldPortIndexStrategy());
    
    // Route strategies
    this.register('openflights-routes', () => new OpenFlightsRouteStrategy());
    this.register('searoute-calculation', () => new SearouteCalculationStrategy());
  }

  register(id: string, factory: () => DataSourceStrategy): void {
    this.strategies.set(id, factory);
  }

  create(id: string): DataSourceStrategy {
    const factory = this.strategies.get(id);
    if (!factory) {
      throw new Error(`Unknown data source strategy: ${id}`);
    }
    return factory();
  }

  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
```

## 5. バッチ処理システム

```typescript
// バッチ処理コーディネーター
export class DataSourceBatchProcessor {
  private jobQueue = new Map<string, BatchJob>();
  private statusReporter: BatchStatusReporter;

  async executeBatch(config: BatchConfig): Promise<BatchResult> {
    const job = new BatchJob(config);
    this.jobQueue.set(job.id, job);

    try {
      // 前処理
      await this.preProcess(job);
      
      // メイン処理
      const result = await this.processJob(job);
      
      // 後処理
      await this.postProcess(job, result);
      
      return result;
    } finally {
      this.jobQueue.delete(job.id);
    }
  }

  private async processJob(job: BatchJob): Promise<BatchResult> {
    const strategy = this.strategyFactory.create(job.config.strategyId);
    
    // 進捗報告開始
    this.statusReporter.startJob(job.id);
    
    // データ取得フェーズ
    this.statusReporter.updatePhase(job.id, 'fetching');
    const rawData = await strategy.fetchData(job.config.fetchOptions);
    
    // データ処理フェーズ
    this.statusReporter.updatePhase(job.id, 'processing');
    const processedData = await strategy.processData(rawData, job.config.processOptions);
    
    // バリデーションフェーズ
    this.statusReporter.updatePhase(job.id, 'validating');
    const validationResult = await strategy.validateData(processedData);
    
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }
    
    // 保存フェーズ
    this.statusReporter.updatePhase(job.id, 'saving');
    const saveResult = await strategy.saveData(processedData, job.config.saveTarget);
    
    this.statusReporter.completeJob(job.id);
    
    return {
      jobId: job.id,
      success: true,
      dataCount: processedData.length || 0,
      validationResult,
      saveResult,
      duration: Date.now() - job.startTime
    };
  }
}
```

## 6. 使用例

```typescript
// プラグインでの使用例
export class LocationPlugin {
  private strategyFactory = new DataSourceStrategyFactory();
  private batchProcessor = new DataSourceBatchProcessor();

  async importLocations(sourceId: string, options: ImportOptions): Promise<ImportResult> {
    // バッチ処理設定
    const batchConfig: BatchConfig = {
      strategyId: sourceId,
      fetchOptions: {
        bbox: options.boundingBox,
        featureClass: options.featureClass,
        maxRows: options.maxRows
      },
      processOptions: {
        filters: options.filters,
        transformations: options.transformations
      },
      saveTarget: {
        type: 'hierarchidb',
        entityType: 'location',
        parentId: options.parentNodeId
      }
    };

    // バッチ実行
    return await this.batchProcessor.executeBatch(batchConfig);
  }

  // カスタムデータソースの動的登録
  registerCustomDataSource(config: DataSourceConfig, strategy: DataSourceStrategy): void {
    this.strategyFactory.register(config.id, () => strategy);
  }
}
```

## 7. 実装フェーズ

### フェーズ1: 基盤実装
- 共通インターフェース・抽象クラス
- ストラテジーファクトリー
- 基本的なエラーハンドリング

### フェーズ2: コア戦略実装
- Natural Earth (Shape)
- GeoNames (Location) 
- OpenFlights (Route)

### フェーズ3: バッチ処理システム
- ジョブキュー
- 進捗管理
- キャッシュシステム

### フェーズ4: 高度な機能
- 認証システム
- レート制限
- ストリーミング処理

## 8. 今後の拡張性

- **新しいデータソース**: 戦略パターンにより容易に追加可能
- **処理アルゴリズム**: 変換・フィルタリングロジックの拡張
- **出力形式**: 新しいフォーマットへの対応
- **スケーリング**: 分散処理・並列化の強化

この設計により、各プラグインが独自のデータソースを持ちながら、統一的なアーキテクチャで運用できるシステムを構築できる。
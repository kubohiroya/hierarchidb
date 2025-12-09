# Route Plugin (Shape Plugin Extension)

⭐️ **確信度高**: Shapeプラグインの拡張として実装される交通路・輸送ルート管理プラグイン
⭐️ **確信度高**: 8ステップのウィザード形式で、Step5でSpreadsheetの表データプレビュー機能を活用
🔺 **類推**: 各データソースごとにデフォルト設定が用意され、カスタマイズ可能な設計

## アーキテクチャ

### ⭐️ プラグイン継承構造
```typescript
// ShapePluginを拡張
class RoutePlugin extends ShapePlugin {
  // Shape機能の継承
  - Step2: データソース選択（一部共通）
  - Step3: ライセンス承認（一部共通）
  - Step4: 国×データ種類マトリクス（一部共通）
  - Step7: ベクトルタイル設定（一部共通）
  
  // Spreadsheet機能の活用
  - Step5: 表データプレビュー・行絞り込み
  - Step6: スキーママッピング
}
```

### ⭐️ ハイブリッド位置情報管理
```typescript
interface RouteEntity {
  // Location参照（推奨）
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  waypointLocationIds?: NodeId[];
  
  // 直接座標（フォールバック/カスタム地点用）
  startPoint?: {
    coordinates: [number, number];
    name?: string;
    type?: 'location_ref' | 'custom' | 'osm_node';
  };
  
  endPoint?: {
    coordinates: [number, number];
    name?: string;
    type?: 'location_ref' | 'custom' | 'osm_node';
  };
  
  // 生成された経路情報
  lineGeometry: [number, number][];  // LineString座標配列
  generationMethod: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
}
```

## 8ステップ設定ウィザード

### Step 1: 基本情報設定 ⭐️
```typescript
interface BasicInfoStep {
  name: string;              // 例: "東アジア航空路線網"
  description: string;       // 例: "日本・中国・韓国の主要航空路線"
  category: RouteCategory;
  tags: string[];
}
```

### Step 2: データソース選択 ⭐️
```typescript
interface TabularDataSourceStep {
  dataSource: {
    id: string;
    name: string;
    format: 'csv' | 'tsv' | 'json' | 'geojson' | 'osm' | 'gtfs';
    provider: string;          // "airline-routes.csv", "openflights.org", etc.
    
    // データソース固有の設定
    defaultSettings: {
      filterRules: FilterRule[];           // デフォルト絞り込みルール
      mappingTemplate: MappingTemplate;    // デフォルトマッピング
      routeGeneration: RouteGenerationConfig; // デフォルト経路生成方式
      enabledCountries: string[];          // 利用可能な国コード
      enabledModes: TransportMode[];       // 利用可能な交通モード
    };
  };
  
  // カスタムデータソース
  customSource?: {
    url: string;
    format: string;
    headers?: Record<string, string>;
  };
}

// データソース例
const dataSources = [
  {
    id: 'openflights-airlines',
    name: 'OpenFlights Airlines',
    format: 'csv',
    provider: 'openflights.org',
    defaultSettings: {
      filterRules: [{ column: 'Active', operator: 'equals', value: 'Y' }],
      mappingTemplate: {
        startLocation: 'Source airport',
        endLocation: 'Destination airport',
        routeName: 'Airline + Codeshare',
        distance: null  // 計算で生成
      },
      routeGeneration: { method: 'great_circle', segments: 20 },
      enabledCountries: ['JPN', 'KOR', 'CHN', 'USA', 'EUR', 'INTL'],
      enabledModes: ['airway']
    }
  },
  {
    id: 'osm-railways',
    name: 'OpenStreetMap Railways',
    format: 'osm',
    provider: 'overpass-api.de',
    defaultSettings: {
      filterRules: [{ tag: 'railway', value: 'rail' }],
      mappingTemplate: { /* OSM specific */ },
      routeGeneration: { method: 'osm_route' },
      enabledCountries: getAllCountries(),
      enabledModes: ['railway', 'high_speed_rail']
    }
  },
  {
    id: 'searoute-shipping',
    name: 'Sea Routes Shipping Lines',
    format: 'json',
    provider: 'marinetraffic.com',
    defaultSettings: {
      filterRules: [{ field: 'status', value: 'operational' }],
      mappingTemplate: { /* ... */ },
      routeGeneration: { method: 'searoute', avoidCanals: false },
      enabledCountries: getCoastalCountries(),
      enabledModes: ['seaway']
    }
  }
];
```

### Step 3: ライセンス承認 ⭐️
```typescript
interface LicenseStep {
  // Shapeプラグインと共通の実装
  acceptedLicenses: {
    odbl: boolean;           // OpenStreetMap ODbL
    ccby: boolean;           // Creative Commons BY
    custom: string[];        // データソース固有ライセンス
  };
  attributionText: string;
}
```

### Step 4: 国×データ種類マトリクス ⭐️
```typescript
interface SelectionMatrixStep {
  // データソースのenabledCountries/enabledModesに基づいて
  // 選択可能なセルのみがenabledになる
  selectionMatrix: boolean[][];
  
  // 例: OpenFlights Airlinesの場合
  //     Airway  Seaway  Railway  Road  HSR
  // JPN   ✓      ✗       ✗       ✗     ✗    <- airwayのみenabled
  // KOR   ✓      ✗       ✗       ✗     ✗
  // CHN   ✓      ✗       ✗       ✗     ✗
  // INTL  ✓      ✗       ✗       ✗     ✗
  
  estimatedData: {
    fileCount: number;       // ダウンロードファイル数
    totalRows: number;       // 推定行数
    dataSize: number;        // 推定データサイズ
  };
}
```

### Step 5: 表データプレビュー・行絞り込み ⭐️
```typescript
interface DataPreviewStep {
  // Spreadsheetプラグインの機能を活用
  sampleData: {
    fileName: string;
    rows: any[];            // 最初の10行程度
    columns: string[];
    totalRows: number;
  };
  
  // 絞り込み設定（データソースのデフォルトが適用済み）
  filterRules: FilterRule[];
  
  // プレビュー設定
  previewSettings: {
    startRow: number;       // デフォルト: 1
    endRow: number;         // デフォルト: 10
    maxRows: number;        // 最大表示行数
  };
}

// フィルタルール例
interface FilterRule {
  column: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'regex';
  value: any;
  enabled: boolean;
}
```

### Step 6: スキーママッピング ⭐️
```typescript
interface SchemaMappingStep {
  // データソースのデフォルトマッピングが適用済み
  mapping: {
    // 基本フィールド
    routeName: string | null;        // CSVカラム名
    routeType: string | null;
    operator: string | null;
    
    // 位置情報マッピング
    startLocation: {
      source: 'column' | 'location_search' | 'coordinates';
      columnName?: string;          // "Source Airport"
      locationType?: 'airport' | 'station' | 'port';
      coordinateColumns?: {
        lat: string;                // "src_lat"
        lon: string;                // "src_lon"
      };
    };
    
    endLocation: {
      source: 'column' | 'location_search' | 'coordinates';
      columnName?: string;          // "Destination Airport"
      locationType?: 'airport' | 'station' | 'port';
      coordinateColumns?: {
        lat: string;                // "dst_lat"
        lon: string;                // "dst_lon"
      };
    };
    
    // オプショナルフィールド
    distance?: string;              // "Distance"
    duration?: string;              // "Flight Time"
    frequency?: string;             // "Flights per Week"
    
    // カスタムプロパティマッピング
    customProperties: Array<{
      targetField: string;
      sourceColumn: string;
      transform?: 'none' | 'number' | 'boolean' | 'date';
    }>;
  };
  
  // 🔺 類推: マッピングのバリデーション結果
  validation: {
    isValid: boolean;
    warnings: string[];
    requiredFieldsMissing: string[];
  };
}
```

### Step 7: ベクトルタイル生成設定 ⭐️
```typescript
interface VectorTileStep {
  // Shapeプラグインと共通の実装
  tileGeneration: {
    enabled: boolean;
    zoomLevels: number[];           // [5, 8, 11, 14]
    simplification: {
      algorithm: 'douglas-peucker' | 'visvalingam';
      tolerance: number;
    };
  };
  
  // ⭐️ Route固有: 経路生成方式の選択
  routeGeneration: {
    method: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
    
    // 直線接続
    direct?: {
      // 単純に始点と終点を結ぶ
    };
    
    // OSM経路探索
    osm_route?: {
      routeType: 'fastest' | 'shortest';
      avoid: string[];              // ['toll', 'ferry']
    };
    
    // 大圏航路（航空路用）
    great_circle?: {
      segments: number;             // 曲線の分割数
    };
    
    // 海上経路（Searoute API）
    searoute?: {
      avoidCanals: boolean;         // スエズ/パナマ運河回避
      avoidIce: boolean;           // 北極海航路回避
      units?: 'km' | 'miles' | 'nauticalmiles';
      vesselSpeedKnots?: number;   // 推定所要時間計算に使用（任意）
    };
  };
}
```

### Step 8: 地図プレビュー ⭐️
```typescript
interface MapPreviewStep {
  // Shapeプラグインと同様の地図表示
  mapView: {
    showRoutes: boolean;
    colorBy: 'type' | 'operator' | 'frequency';
    lineWidth: number;
    opacity: number;
  };
  
  // バッチ処理完了後の結果サマリー
  results?: {
    totalRoutes: number;
    totalLength: number;
    byType: Record<RouteType, number>;
    failures: Array<{
      fileName: string;
      error: string;
    }>;
  };
}
```

## バッチ処理フロー

### ⭐️ 処理の流れ
```typescript
interface BatchProcessFlow {
  // Step4-8で「バッチ処理開始」ボタン表示
  // Step7完了でボタンがenabled
  
  phases: [
    {
      name: 'Download',
      tasks: [
        'すべての選択ファイルをダウンロード',
        'データフォーマット検証'
      ]
    },
    {
      name: 'Filter & Map',
      tasks: [
        'Step5の絞り込みルール適用',
        'Step6のスキーママッピング実行'
      ]
    },
    {
      name: 'Generate Routes',
      tasks: [
        '始点・終点の位置情報解決',
        'LineString生成（選択された方式で）',
        '経路データの保存'
      ]
    },
    {
      name: 'Generate Tiles',
      tasks: [
        'ベクトルタイル生成',
        '簡略化処理',
        'タイルキャッシュ保存'
      ]
    }
  ];
  
  // 処理完了後、自動的にStep8へ遷移
  onComplete: () => navigateToStep(8);
}
```

### 🔺 エラーハンドリング（類推）
```typescript
interface ErrorHandling {
  // 位置情報解決失敗
  locationNotFound: {
    strategy: 'skip' | 'use_coordinates' | 'manual_input';
    fallbackCoordinates?: [number, number];
  };
  
  // 経路生成失敗
  routeGenerationFailed: {
    strategy: 'use_direct' | 'skip' | 'retry';
    retryCount: number;
  };
}
```

## データベーススキーマ

### RouteEntity（拡張版）
```typescript
interface RouteEntity extends ShapeEntity {
  // Shape継承フィールド
  id: EntityId;
  nodeId: NodeId;
  
  // Route固有フィールド
  routeType: TransportMode;
  
  // ハイブリッド位置情報
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  startPoint?: LocationPoint;
  endPoint?: LocationPoint;
  
  // 生成された経路
  lineGeometry: [number, number][];
  generationMethod: string;
  generatedAt: number;
  
  // マッピングされたプロパティ
  routeName?: string;
  operator?: string;
  distance?: number;
  duration?: number;
  frequency?: number;
  
  // カスタムプロパティ
  customProperties: Record<string, any>;
  
  // データソース情報
  dataSourceId: string;
  sourceFileName: string;
  sourceRowIndex?: number;
}
```

## 実装優先度

1. ⭐️ **高優先度（確実な仕様）**
   - Shapeプラグイン拡張の基本構造
   - 8ステップウィザードUI
   - データソース設定システム
   - ハイブリッド位置情報管理

2. 🔺 **中優先度（類推部分）**
   - 各データソースのデフォルト設定詳細
   - エラーハンドリング戦略
   - バッチ処理の並列化最適化

3. ❓ **要確認事項**
- Searoute APIの具体的な実装方法（動的 import で統合済み。`pnpm add searoute` または `searoute-js` を追加するだけで利用可能）
   - Location検索のパフォーマンス最適化
   - 大規模データ（10万ルート以上）の処理方法

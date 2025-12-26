# Location Plugin (Shape Plugin Extension)

⭐️ **確信度高**: Shapeプラグインの拡張として実装される位置情報管理プラグイン
⭐️ **確信度高**: 8ステップのウィザード形式で、Routeプラグインとほぼ同じ構成
⭐️ **確信度高**: Step5でSpreadsheetの表データプレビュー機能を活用
🔺 **類推**: Point生成に特化し、施設・地点情報の管理に最適化

## アーキテクチャ

### ⭐️ プラグイン継承構造
```typescript
// ShapePluginを拡張
class LocationPlugin extends ShapePlugin {
  // Shape機能の継承
  - Step2: データソース選択（一部共通）
  - Step3: ライセンス承認（一部共通）
  - Step4: 国×データ種類マトリクス（一部共通）
  - Step7: ベクトルタイル設定（一部共通）
  
  // Spreadsheet機能の活用
  - Step5: 表データプレビュー・行絞り込み
  - Step6: スキーママッピング
  
  // Location固有
  - Point geometryの生成
  - 施設タイプ別の分類
}
```

### ⭐️ LocationEntityスキーマ
```typescript
interface LocationEntity extends ShapeEntity {
  // Shape継承フィールド
  id: EntityId;
  nodeId: NodeId;
  
  // Location固有フィールド
  locationType: LocationType;        // 'airport' | 'station' | 'port' | 'city' | 'poi'
  
  // 位置情報
  point: {
    coordinates: [number, number];    // [longitude, latitude]
    altitude?: number;                // 標高（オプション）
    accuracy?: number;                // 精度（メートル）
  };
  
  // 識別情報
  locationName: string;               // 名称
  locationCode?: string;              // コード（IATA、UN/LOCODE等）
  alternativeNames?: string[];        // 別名・多言語名
  
  // 分類情報
  category: LocationCategory;         // 大分類
  subCategory?: string;               // 小分類
  tags?: string[];                    // タグ
  
  // 属性情報
  capacity?: number;                  // 収容能力
  importance?: number;                // 重要度スコア
  operationalStatus?: 'active' | 'planned' | 'closed';
  
  // カスタムプロパティ
  customProperties: Record<string, any>;
  
  // データソース情報
  dataSourceId: string;
  sourceFileName: string;
  sourceRowIndex?: number;
}
```

## 8ステップ設定ウィザード

### Step 1: 基本情報設定 ⭐️
```typescript
interface BasicInfoStep {
  name: string;              // 例: "東アジア主要空港"
  description: string;       // 例: "日本・中国・韓国の国際空港と主要国内空港"
  category: LocationCategory;
  tags: string[];
}
```

### Step 2: データソース選択 ⭐️
```typescript
interface TabularDataSourceStep {
  dataSource: {
    id: string;
    name: string;
    format: 'csv' | 'tsv' | 'json' | 'geojson' | 'osm' | 'kml';
    provider: string;          // "airports.csv", "geonames.org", etc.
    
    // データソース固有の設定
    defaultSettings: {
      filterRules: FilterRule[];           // デフォルト絞り込みルール
      mappingTemplate: MappingTemplate;    // デフォルトマッピング
      enabledCountries: string[];          // 利用可能な国コード
      locationTypes: LocationType[];       // 利用可能な施設タイプ
    };
  };
}

// データソース例
const dataSources = [
  {
    id: 'ourairports',
    name: 'OurAirports Database',
    format: 'csv',
    provider: 'ourairports.com',
    defaultSettings: {
      filterRules: [
        { column: 'type', operator: 'in', value: ['large_airport', 'medium_airport'] }
      ],
      mappingTemplate: {
        locationName: 'name',
        locationCode: 'iata_code',
        coordinates: { lat: 'latitude_deg', lon: 'longitude_deg' },
        locationType: () => 'airport',
        category: 'type'
      },
      enabledCountries: getAllCountries(),
      locationTypes: ['airport']
    }
  },
  {
    id: 'geonames-cities',
    name: 'GeoNames Cities',
    format: 'tsv',
    provider: 'geonames.org',
    defaultSettings: {
      filterRules: [
        { column: 'population', operator: 'greater', value: 100000 }
      ],
      mappingTemplate: {
        locationName: 'name',
        locationCode: 'geonameid',
        coordinates: { lat: 'latitude', lon: 'longitude' },
        locationType: () => 'city',
        population: 'population'
      },
      enabledCountries: getAllCountries(),
      locationTypes: ['city']
    }
  },
  {
    id: 'osm-stations',
    name: 'OpenStreetMap Railway Stations',
    format: 'osm',
    provider: 'overpass-api.de',
    defaultSettings: {
      filterRules: [
        { tag: 'railway', value: 'station' },
        { tag: 'station', operator: 'not_equals', value: 'subway' }
      ],
      mappingTemplate: {
        locationName: 'name',
        coordinates: () => 'from_geometry',
        locationType: () => 'station',
        operator: 'operator'
      },
      enabledCountries: getAllCountries(),
      locationTypes: ['station']
    }
  },
  {
    id: 'world-ports',
    name: 'World Port Index',
    format: 'csv',
    provider: 'msi.nga.mil',
    defaultSettings: {
      filterRules: [
        { column: 'harbor_size', operator: 'in', value: ['L', 'M'] }
      ],
      mappingTemplate: {
        locationName: 'port_name',
        locationCode: 'locode',
        coordinates: { lat: 'latitude', lon: 'longitude' },
        locationType: () => 'port',
        harborSize: 'harbor_size'
      },
      enabledCountries: getCoastalCountries(),
      locationTypes: ['port']
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
  // データソースのenabledCountries/locationTypesに基づいて
  // 選択可能なセルのみがenabledになる
  selectedArrayByCountries: Record<ISO2, boolean[]>;
  
  // 例: OurAirportsの場合
  //     Airport  Station  Port  City  POI
  // JPN    ✓       ✗       ✗     ✗    ✗    <- airportのみenabled
  // KOR    ✓       ✗       ✗     ✗    ✗
  // CHN    ✓       ✗       ✗     ✗    ✗
  // USA    ✓       ✗       ✗     ✗    ✗
  
  estimatedData: {
    fileCount: number;       // ダウンロードファイル数
    totalLocations: number;  // 推定地点数
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

// フィルタルール例（空港データ）
const airportFilters = [
  { column: 'type', operator: 'in', value: ['large_airport', 'medium_airport'] },
  { column: 'scheduled_service', operator: 'equals', value: 'yes' },
  { column: 'iata_code', operator: 'not_empty', value: null }
];
```

### Step 6: スキーママッピング ⭐️
```typescript
interface SchemaMappingStep {
  // データソースのデフォルトマッピングが適用済み
  mapping: {
    // 基本フィールド
    locationName: string | null;     // CSVカラム名 "name"
    locationCode: string | null;     // "iata_code", "locode", etc.
    locationType: {
      source: 'fixed' | 'column' | 'derived';
      value?: LocationType;          // 固定値の場合
      columnName?: string;           // カラムから取得の場合
      derivationRule?: string;       // 導出ルール
    };
    
    // 位置情報マッピング
    coordinates: {
      source: 'columns' | 'geometry' | 'address_geocoding';
      latColumn?: string;            // "latitude_deg"
      lonColumn?: string;            // "longitude_deg"
      altColumn?: string;            // "elevation_ft"
      geometryColumn?: string;       // GeoJSON/KMLの場合
      addressColumn?: string;        // ジオコーディングの場合
    };
    
    // 分類情報
    category: string | null;         // "type"
    subCategory: string | null;      // "sub_type"
    tags: {
      source: 'column' | 'split' | 'fixed';
      columnName?: string;
      separator?: string;            // タグが文字列の場合の区切り文字
      fixedTags?: string[];
    };
    
    // オプショナルフィールド
    capacity?: string;               // "passenger_capacity"
    importance?: string;             // "importance_score"
    operationalStatus?: string;      // "status"
    
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
    coordinateValidation: {
      validCount: number;
      invalidCount: number;
      outOfBoundsCount: number;
    };
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
    
    // ⭐️ Location固有: ポイントクラスタリング
    clustering: {
      enabled: boolean;
      minZoom: number;              // クラスタリング開始ズーム
      maxZoom: number;              // クラスタリング終了ズーム
      radius: number;               // クラスタ半径（ピクセル）
    };
    
    // ⭐️ Location固有: 重要度によるフィルタリング
    zoomFiltering: {
      enabled: boolean;
      rules: Array<{
        minZoom: number;
        maxZoom: number;
        minImportance?: number;     // このズームで表示する最小重要度
        types?: LocationType[];     // このズームで表示するタイプ
      }>;
    };
  };
  
  // Point生成設定
  pointGeneration: {
    // 座標精度の処理
    coordinatePrecision: number;    // 小数点以下の桁数
    
    // 重複地点の処理
    duplicateHandling: 'keep_all' | 'merge' | 'keep_first';
    mergeRadius: number;            // マージ半径（メートル）
    
    // 座標検証
    validateBounds: boolean;        // 緯度経度の範囲チェック
    validateCountry: boolean;       // 国境内チェック
  };
}
```

### Step 8: 地図プレビュー ⭐️
```typescript
interface MapPreviewStep {
  // Shapeプラグインと同様の地図表示（Point表示に最適化）
  mapView: {
    showLocations: boolean;
    
    // ポイント表示設定
    pointStyle: {
      colorBy: 'type' | 'category' | 'importance';
      sizeBy: 'fixed' | 'capacity' | 'importance';
      iconBy: 'type' | 'custom';
      
      minSize: number;              // 最小ポイントサイズ
      maxSize: number;              // 最大ポイントサイズ
    };
    
    // ラベル表示
    labels: {
      show: boolean;
      field: 'name' | 'code' | 'both';
      minZoom: number;              // ラベル表示開始ズーム
    };
    
    // クラスタ表示
    clusters: {
      show: boolean;
      showCount: boolean;
      style: 'circle' | 'hexagon';
    };
  };
  
  // バッチ処理完了後の結果サマリー
  results?: {
    totalLocations: number;
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
    duplicatesFound: number;
    geocodingFailures: number;
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
      name: 'Generate Points',
      tasks: [
        '座標情報の抽出・検証',
        'Point geometry生成',
        '重複地点のマージ処理',
        '位置データの保存'
      ]
    },
    {
      name: 'Generate Tiles',
      tasks: [
        'ベクトルタイル生成',
        'クラスタリング処理',
        'ズームレベル別フィルタリング',
        'タイルキャッシュ保存'
      ]
    }
  ];
  
  // 処理完了後、自動的にStep8へ遷移
  onComplete: () => navigateToStep(8);
}
```

### 🔺 座標処理の詳細（類推）
```typescript
interface CoordinateProcessing {
  // 座標取得方法
  extraction: {
    fromColumns: (lat: string, lon: string) => [number, number];
    fromGeometry: (geom: any) => [number, number];
    fromAddress: async (address: string) => [number, number];
  };
  
  // 座標検証
  validation: {
    isValidLatitude: (lat: number) => boolean;      // -90 <= lat <= 90
    isValidLongitude: (lon: number) => boolean;     // -180 <= lon <= 180
    isWithinCountry: (coords: [number, number], country: string) => boolean;
  };
  
  // エラーハンドリング
  onInvalidCoordinates: {
    strategy: 'skip' | 'use_country_center' | 'manual_correction';
    fallbackCoordinates?: Record<string, [number, number]>;
  };
}
```

## LocationType定義

### ⭐️ 主要な施設タイプ
```typescript
enum LocationType {
  // 交通施設
  AIRPORT = 'airport',           // 空港
  STATION = 'station',           // 鉄道駅
  PORT = 'port',                 // 港湾
  BUS_TERMINAL = 'bus_terminal', // バスターミナル
  
  // 都市・地域
  CITY = 'city',                 // 都市
  TOWN = 'town',                 // 町
  VILLAGE = 'village',           // 村
  
  // POI（Point of Interest）
  LANDMARK = 'landmark',         // ランドマーク
  TOURIST = 'tourist',           // 観光地
  FACILITY = 'facility',         // 施設
  
  // その他
  CUSTOM = 'custom'              // カスタム
}
```

## 実装例

### 空港データのインポート
```typescript
// Step 1-3: 基本設定とライセンス
const config = {
  name: "Asia-Pacific Major Airports",
  description: "International and major domestic airports",
  dataSource: 'ourairports',
  acceptLicenses: true
};

// Step 4: 国と施設タイプ選択
const selection = {
  countries: ['JP', 'KR', 'CN', 'SG', 'TH'],
  locationTypes: ['airport'],
  selectedArrayByCountries: {
    JP: [true, false, false, false, false], // JP: airports only
    KR: [true, false, false, false, false], // KR: airports only
    // ...
  }
};

// Step 5-6: フィルタとマッピング
const processing = {
  filters: [
    { column: 'type', value: ['large_airport', 'medium_airport'] },
    { column: 'scheduled_service', value: 'yes' }
  ],
  mapping: {
    locationName: 'name',
    locationCode: 'iata_code',
    coordinates: { lat: 'latitude_deg', lon: 'longitude_deg' }
  }
};

// Step 7: タイル生成設定
const tileConfig = {
  zoomLevels: [5, 8, 11, 14],
  clustering: { enabled: true, minZoom: 5, maxZoom: 10 },
  zoomFiltering: {
    rules: [
      { minZoom: 0, maxZoom: 7, types: ['airport'], minImportance: 0.8 },
      { minZoom: 8, maxZoom: 14, types: ['airport'], minImportance: 0 }
    ]
  }
};

// バッチ処理実行
const session = await locationPlugin.createBatchSession(
  nodeId,
  config,
  selection,
  processing,
  tileConfig
);
```

## パフォーマンス最適化

- **座標インデックス**: 空間インデックス（R-tree）による高速検索
- **クラスタリング**: ズームレベル別の事前計算
- **重複除去**: 空間ハッシュによる効率的な重複検出
- **並列処理**: Web Workerによる座標変換の並列化

## 重要な仕様詳細

### ⭐️ 論理カラム名による連携
```typescript
interface LogicalColumnMapping {
  // Step6で設定される論理カラム名
  logicalColumns: {
    'location_name': string;      // 物理カラム名
    'location_code': string;      
    'centroid': string;           // Shape連携用
    // ... 他の論理カラム
  };
  
  // RouteプラグインからのLocation参照
  routeIntegration: {
    startLocation: 'location_code' | 'location_name';  // 論理カラム名で参照
    endLocation: 'location_code' | 'location_name';
    
    // PropertyResolverによる変換も可能
    withPropertyResolver: boolean;
  };
}
```

### ⭐️ 重複Location処理ルール
```typescript
interface DuplicateHandling {
  // 物理的な重複は許容
  physicalDuplicates: 'allowed';
  
  // 論理名の重複は上書き
  logicalNameConflict: {
    resolution: 'last_wins';  // 後から定義されたものが優先
    
    // Project内での順序
    withinProject: 'order_in_tree';
    
    // Project間での順序（ツリー構造に基づく）
    betweenProjects: 'tree_traversal_order';
  };
  
  // 将来的な警告機能
  proximityWarning?: {
    enabled: boolean;
    threshold: number;  // メートル単位
    action: 'warn' | 'merge_suggest';
  };
}
```

### ⭐️ セントロイド連携
```typescript
interface CentroidLinking {
  // Location側の設定
  locationCentroid: {
    logicalColumn: 'centroid';
    usage: 'administrative_center' | 'geometric_center';
  };
  
  // Shape側の設定
  shapeCentroid: {
    logicalColumn: 'centroid';
    linkedLocationType: 'capital' | 'prefectural_capital' | 'city_hall';
  };
  
  // 連携の効果
  benefits: [
    '行政区域Shapeとその中心地Locationの自動関連付け',
    '地図表示での統合的な扱い',
    'PropertyResolverでの相互参照'
  ];
}
```

### ⭐️ LocationTypeの拡張性
```typescript
enum CoreLocationTypes {
  // 基本タイプ（システム定義）
  ADMINISTRATIVE_CENTER = 'administrative_center',  // 行政中心地
  AIRPORT = 'airport',                              // 空港
  PORT = 'port',                                    // 港
  STATION = 'station',                              // 駅
  INTERCHANGE = 'interchange',                      // インターチェンジ
}

interface CustomLocationTypes {
  // ユーザー定義タイプ（オープンに追加可能）
  namespace: string;                                // 名前空間
  typeName: string;                                // タイプ名
  icon?: string;                                   // アイコン
  color?: string;                                  // 表示色
  
  // 例
  examples: [
    { namespace: 'energy', typeName: 'charging_station' },
    { namespace: 'emergency', typeName: 'shelter' },
    { namespace: 'tourism', typeName: 'viewpoint' }
  ];
}
```

### ⭐️ リソース解決の優先順位
```typescript
interface ResourceResolution {
  // ツリー構造に基づく解決順序
  order: {
    // 1. 同一Project内での順序
    withinProject: 'definition_order';  // 定義順
    
    // 2. Project間での順序（ツリー構造による）
    betweenProjects: {
      traversal: 'depth_first' | 'breadth_first';
      direction: 'top_to_bottom' | 'bottom_to_top';
      
      // デフォルト: 深さ優先、上から下
      default: 'depth_first_top_to_bottom';
    };
    
    // 3. データソース優先度（同一地点の場合）
    dataSourcePriority?: [
      'osm',           // 最優先
      'ourairports',
      'geonames',
      'custom'         // 最低優先
    ];
  };
  
  // 解決例
  example: {
    tree: `
      Project A
      ├── Location 1 (OSM)
      └── Location 2 (GeoNames)
      Project B
      └── Location 3 (OSM) - 同じ地点
    `,
    result: 'Location 3が優先（後のProject）'
  };
}
```

### ⭐️ PropertyResolverとの連携
```typescript
interface PropertyResolverIntegration {
  // 検索対象の物理カラム設定
  searchableColumns: {
    physical: string[];          // 実際のCSVカラム名
    logical: string[];          // 論理カラム名
    
    // PropertyResolverで変換
    virtualProperties: [
      {
        source: 'location_code',  // IATA: "NRT"
        target: 'search',         // "Narita"
        target_ja: 'search_ja',   // "成田"
      },
      {
        source: 'location_name',   // "Tokyo Station"
        target: 'search',         // "Tokyo Station"
        target_ja: 'search_ja',   // "東京駅"
      }
    ];
  };
  
  // 多言語検索サポート
  multilingualSearch: {
    enabled: boolean;
    alternativeNamesColumn: 'alternative_names';
    languages: ['en', 'ja', 'zh', 'ko'];
  };
}
```

## 実装の統合例

### Location → Route連携
```typescript
// Step 1: Locationプラグインで空港データ登録
const locationConfig = {
  dataSource: 'ourairports',
  mapping: {
    logicalColumns: {
      'location_code': 'iata_code',    // NRT, HND, etc.
      'location_name': 'name',         // Narita, Haneda, etc.
      'coordinates': ['latitude_deg', 'longitude_deg']
    }
  }
};

// Step 2: Routeプラグインで航空路線作成
const routeConfig = {
  dataSource: 'airline-routes',
  mapping: {
    // 論理カラム名でLocation参照
    startLocation: {
      source: 'location_search',
      logicalColumn: 'location_code',   // IATAコードで検索
      columnName: 'origin_airport'      // CSVの"NRT"
    },
    endLocation: {
      source: 'location_search',
      logicalColumn: 'location_code',
      columnName: 'destination_airport'  // CSVの"LAX"
    }
  }
};

// 結果: "NRT"→"LAX"が自動的にLocationの座標を参照
```

### Location ↔ Shape連携（セントロイド）
```typescript
// Shapeプラグイン: 都道府県ポリゴン
const shapeConfig = {
  mapping: {
    'centroid': 'admin_center_id'  // 県庁所在地ID
  }
};

// Locationプラグイン: 県庁所在地
const locationConfig = {
  mapping: {
    'centroid': 'city_id',         // 同じIDで連携
    'location_name': 'city_name'
  }
};

// 結果: 都道府県Shapeとその県庁所在地Locationが自動連携
```

## 制限事項

- 最大地点数: 1ファイルあたり100,000地点
- クラスタ最大サイズ: 1,000地点/クラスタ
- ベクトルタイルサイズ: 最大500KB/タイル
- 同時処理ファイル数: 100ファイル
- ジオコーディング: 1,000リクエスト/時（API制限）

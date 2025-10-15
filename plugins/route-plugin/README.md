# Route Plugin

実装サマリ（2025-09-09）
- nodeType: `route`
- DB: Dexie(`route-db`) — ルートエンティティ/ワーキングコピー
- バッチ: 統一バッチ API 準拠（生成・検証・ベクトル化）
- UI: 設定ウィザード、データテーブル、マッププレビュー
- 機能: 多様なルートソース、距離/接続性分析、スタイル連携
- ランタイムワーカー: `registerRouteRuntimeWorkerAdapters()`（フラグ `ROUTE_RUNTIME_WORKER=1` で有効）

## 依存管理とインポート規約（重要）
共通方針は packages/plugins/CONTRIBUTING.md を参照。要点:
- peerDependencies: react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, dexie
- dependencies: @hierarchidb/util ほか必要に応じて @hierarchidb/feature/*
- devDependencies: typescript/tsup/vitest/@testing-library/*/@types/*
- import は公開API、型は `import type`、重い処理は dynamic import。
- tsup external は共通設定で外部化済み。
交通路・輸送ルート情報の収集、管理、可視化を行うHierarchiDBプラグインです。
OpenStreetMapやNatural Earth等のオープンデータソースから、航路、海路、道路、鉄道等のルートデータをバッチダウンロードし、地図上で可視化・分析できます。

## 主要機能

- 🛤️ **多様なルートタイプ**: 航路、海路、道路、鉄道、高速鉄道
- 🌐 **国際ルート対応**: 国境を越えるルートの適切な処理
- 📈 **ルート分析**: 距離計算、接続性分析、ネットワーク構造
- 🎨 **高度な可視化**: 速度・容量による色分け、方向表示
- 🔄 **バッチ処理**: 大規模ルートデータの効率的処理
- 💾 **ベクタータイル生成**: 高速地図表示のためのタイル生成

### Tabular Preview（データテーブル）
- RoutePanel には「データテーブル」カードが表示され、生成済みルートの表ビューを閲覧できます。
- 機能: 複数条件フィルタ（AND）、表示列の切替、`eq` 条件の索引（初回遅延作成）。
- 注意: 表は検索/検証用の補助機能です。ルートノードを含む複数ノードの一括保存/復元には Import/Export を使用してください。

## 利用可能なオープンデータソース

### オープンデータ提供元まとめ（概要）

| データソース名 | 提供データ内容 | データ量（件数・サイズ：概算） | 利用ライセンス |
| - | - | - | - |
| OpenStreetMap（Overpass 等） | ルート抽出元のOSMデータ（道路/鉄道/フェリー 等） | クエリ依存（数千〜数十万件） | ODbL 1.0 |
| Natural Earth | 主要道路・鉄道（中縮尺ベクター） | レイヤ毎ZIP 5–30MB | Public Domain |
| OpenFlights | 航空路ネットワーク（airline/src/dst/stops 等） | routes.dat 約60–70k経路、~5–8MB | ODbL 1.0 |
| OpenSeaMap | シーマーク等（航路補助、OSM派生） | 地域依存（数千〜数十万フィーチャ） | ODbL 1.0 |
| GTFS Static（各事業者） | 公共交通（路線/停留所/時刻/shape） | 事業者ごとに数MB〜200MB超 | 事業者規約（多くはCC系/独自） |
| OpenRailwayMap | 鉄道ネットワーク（OSM派生の鉄道属性） | 国単位で数万〜数十万線分 | ODbL 1.0 |

### 主要データソース一覧

| データソース | URL | ライセンス | ルートタイプ | データ項目 | 更新頻度 |
|------------|-----|----------|------------|-----------|---------|
| **OpenStreetMap** | https://overpass-api.de/ | ODbL 1.0 | 全タイプ | name, ref, start_point, end_point, coordinates, maxspeed, lanes, gauge | リアルタイム |
| **Natural Earth** | https://www.naturalearthdata.com/ | Public Domain | 主要道路、鉄道 | name, type, sov_a3, coordinates, featurecla, min_zoom | 不定期 |
| **OpenFlights** | https://openflights.org/data.html | ODbL 1.0 | 航路 | airline, src_airport, dst_airport, codeshare, stops, equipment | 不定期 |
| **OpenSeaMap** | https://www.openseamap.org/ | ODbL 1.0 | 海路 | name, seamark:type, coordinates, status | 月次 |
| **GTFS Static** | https://gtfs.org/schedule/reference/ | 各事業者 | 公共交通 | route_short_name, route_long_name, route_type, shape_points | 事業者次第 |
| **OpenRailwayMap** | https://www.openrailwaymap.org/ | ODbL 1.0 | 鉄道 | name, ref, railway, electrified, gauge, maxspeed, usage | リアルタイム |

### OpenStreetMap ルートタグマッピング

| ルートタイプ | OSMタグ | 取得データ | 座標データ |
|------------|--------|----------|-----------|
| **航路** | `route=flight`, `aeroway=runway` | ref, airline, from, to, via | LineString (起点・終点空港座標) |
| **海路** | `route=ferry`, `route=shipping` | name, operator, duration, from, to | LineString (港湾間ルート) |
| **道路** | `highway=motorway/trunk/primary` | ref, name, maxspeed, lanes, surface | LineString (道路中心線) |
| **鉄道** | `railway=rail`, `route=train` | ref, name, operator, gauge, electrified, maxspeed | LineString (線路座標) |
| **高速鉄道** | `railway=rail` + `highspeed=yes` | ref, name, maxspeed (>200km/h), operator | LineString (専用軌道) |

### ルート識別情報

| ルートタイプ | 起点・終点識別 | 座標形式 | 精度 |
|------------|--------------|---------|------|
| **航路** | IATA/ICAOコード、空港名 | [起点緯度経度, 経由点..., 終点緯度経度] | 空港位置は正確、経路は概算 |
| **海路** | UN/LOCODE、港湾名 | [港湾A座標, 海峡通過点..., 港湾B座標] | 港湾位置は正確、航路は概算 |
| **道路** | ジャンクション名、都市名 | [開始点, 中間点(密)..., 終了点] | 1-10m精度 |
| **鉄道** | 駅名、駅コード | [起点駅, 中間駅..., 終点駅] | 線路に沿った正確な座標 |

### 国際ルートの扱い

| カテゴリ | 例 | データ管理 | 選択方法 |
|---------|---|----------|---------|
| **国際航路** | NRT→LAX、ICN→FRA | 「その他(International)」として一元管理 | 専用行から選択、重複ダウンロード防止 |
| **国際海路** | 太平洋横断、スエズ運河経由 | 「その他(International)」 | 国際海域として別管理 |
| **越境道路** | パンアメリカンハイウェイ | 各国セグメントに分割 | 通過国それぞれで選択 |
| **国際鉄道** | シベリア鉄道、ユーロスター | 運行国ごとに分割管理 | 各国で該当区間を選択 |

## ステップバイステップ設定UI

### Step 1: 基本情報設定
```typescript
interface BasicInfoForm {
  // 名前と説明
  name: string;              // 例: "東アジア高速鉄道網"
  description: string;       // 例: "日本、中国、韓国の新幹線・高速鉄道路線"
  
  // カテゴリとタグ
  category: 'transportation' | 'logistics' | 'infrastructure';
  tags: string[];           // 例: ["railway", "highspeed", "asia"]
}
```

**UIコンポーネント**:
- TextField: 名前入力（必須、最大100文字）
- TextField: 説明入力（複数行、最大500文字）
- Select: カテゴリ選択
- Autocomplete: タグ入力（サジェスト機能付き）

### Step 2: データソース選択
```typescript
interface DataSourceSelection {
  primarySource: 'osm' | 'naturalearth' | 'openflights' | 'custom';
  fallbackSources: string[];
  
  // OSM固有設定
  osmConfig?: {
    overpassEndpoint: string;
    boundingBox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
    includeRelations: boolean;  // リレーション（路線情報）を含む
  };
  
  // カスタムソース設定
  customSourceConfig?: {
    url: string;
    format: 'geojson' | 'kml' | 'gpx' | 'shapefile';
    authentication?: {
      type: 'none' | 'apikey' | 'oauth';
      credentials?: string;
    };
  };
}
```

**UIコンポーネント**:
- RadioGroup: プライマリソース選択
- CheckboxList: 代替ソース選択
- BoundingBoxMap: 地図上で範囲選択
- AdvancedSettings: 詳細設定パネル

### Step 3: ライセンス確認
```typescript
interface LicenseAgreement {
  acceptedLicenses: {
    odbl: boolean;           // OpenStreetMap ODbL
    ccby: boolean;           // Creative Commons BY
    publicDomain: boolean;   // パブリックドメイン
    custom: string[];        // カスタムライセンス
  };
  attributionText: string;   // 帰属表示テキスト
  shareAlike: boolean;       // 継承ライセンス適用
}
```

**UIコンポーネント**:
- LicenseCard: 各ライセンスの要約カード
- Checkbox: ライセンス同意チェックボックス
- AttributionEditor: 帰属表示テキスト編集
- WarningAlert: ライセンス互換性の警告

### Step 4: 処理設定
```typescript
interface RouteProcessingConfig {
  // ダウンロード設定
  downloadConfig: {
    concurrentDownloads: number;     // 1-10
    chunkSize: number;               // セグメント分割サイズ
    maxSegmentLength: number;        // 最大セグメント長（km）
    requestTimeout: number;          // タイムアウト（秒）
  };
  
  // 簡略化設定
  simplificationConfig: {
    enableSimplification: boolean;
    algorithm: 'douglas-peucker' | 'visvalingam' | 'radial-distance';
    tolerance: number;               // 簡略化許容誤差（メートル）
    preserveTopology: boolean;      // トポロジー保持
    minSegmentLength: number;       // 最小セグメント長
  };
  
  // ネットワーク分析設定
  networkConfig: {
    enableNetworkAnalysis: boolean;
    detectIntersections: boolean;    // 交差点検出
    calculateConnectivity: boolean;  // 接続性計算
    findShortestPaths: boolean;     // 最短経路探索
  };
  
  // ベクタータイル設定
  vectorTileConfig: {
    generateTiles: boolean;
    zoomLevels: number[];           // 例: [0, 5, 10, 14]
    tileSize: 256 | 512;
    format: 'mvt' | 'geojson';
    compression: 'none' | 'gzip' | 'brotli';
  };
}
```

**UIコンポーネント**:
- Slider: 数値パラメータ調整
- ToggleButtonGroup: アルゴリズム選択
- Switch: 機能有効/無効
- ZoomLevelSelector: タイルズームレベル選択
- Accordion: セクション別設定

### Step 5: ルートタイプと地域選択
```typescript
interface RouteSelection {
  // 選択マトリックス (国/地域 × ルートタイプ)
  selectionMatrix: boolean[][];
  
  regions: Array<{
    code: string;           // 国コードまたは "INTL"（国際）
    name: string;
    scope: 'national' | 'international';
  }>;
  
  routeTypes: Array<{
    id: RouteType;
    filters?: {
      minLength?: number;    // 最小ルート長（km）
      maxSpeed?: number;     // 最大速度フィルタ
      operator?: string[];   // 運行事業者フィルタ
    };
  }>;
  
  // 推定データ
  estimatedStats: {
    totalLength: number;     // 総延長（km）
    segmentCount: number;    // セグメント数
    dataSize: number;        // データサイズ（MB）
  };
}
```

**UIコンポーネント**:
- **SelectionMatrix**: 国×ルートタイプ選択マトリックス
  - 特別行:「その他(International)」for 国際ルート
  - 行: 国リスト + 国際ルート行
  - 列: ルートタイプ（航路、海路、道路、鉄道、高速鉄道）
  - セルカラー: 選択時はタイプ別色表示
- **統計パネル**:
  - Chip: 選択ルート数
  - Chip: 総延長距離
  - ProgressBar: 推定データ量
- **フィルタツール**:
  - RangeSlider: ルート長フィルタ
  - Autocomplete: 事業者フィルタ

### Step 6: レビューと確認
```typescript
interface ReviewSummary {
  selections: {
    total: number;
    byType: Record<RouteType, number>;
    byCountry: Record<string, number>;
  };
  
  estimates: {
    downloadTime: string;    // "約 10-15 分"
    processingTime: string;  // "約 5-10 分"
    storageRequired: string; // "約 50 MB"
  };
  
  preview: {
    sampleRoutes: RoutePreview[];  // サンプルルート
    coverageMap: MapBounds;        // カバー範囲
  };
}
```

**UIコンポーネント**:
- SummaryCards: 統計サマリーカード
- RoutePreviewList: サンプルルートリスト
- CoverageMap: カバー範囲地図
- TimelineChart: 処理フロー図
- ConfirmDialog: 最終確認ダイアログ

## バッチ処理進捗確認ダイアログ

### タブ構成

#### Tab 1: 進捗状況（Progress）
```typescript
interface ProgressView {
  // ステージ進捗
  stages: {
    download: StageProgress;
    simplify1: StageProgress;
    simplify2: StageProgress;
    vectorTile: StageProgress;
  };
  
  // 現在のタスク
  currentTasks: Array<{
    id: string;
    stage: string;
    routeType: RouteType;
    country: string;
    progress: number;
    status: 'running' | 'completed' | 'failed';
  }>;
  
  // パフォーマンス
  performance: {
    downloadSpeed: string;    // "2.5 MB/s"
    processingRate: string;  // "150 segments/s"
    memoryUsage: number;     // MB
    cpuUsage: number;        // percentage
  };
}
```

**UIコンポーネント**:
- **ステージプログレス**:
  - Stepper: 4段階の処理ステップ表示
  - CircularProgress: 各ステージの進捗率
  - TimeRemaining: 残り時間表示
- **タスクモニター**:
  - DataGrid: アクティブタスクテーブル
  - StatusChip: 成功/失敗/処理中の状態表示
  - RetryButton: 失敗タスクの再試行
- **パフォーマンスメーター**:
  - SpeedGauge: ダウンロード速度計
  - MemoryBar: メモリ使用量バー
  - CPUGraph: CPU使用率グラフ

#### Tab 2: ログ（Logs）
```typescript
interface LogView {
  entries: Array<{
    timestamp: Date;
    level: 'debug' | 'info' | 'warning' | 'error';
    stage: string;
    message: string;
    metadata?: {
      routeId?: string;
      errorCode?: string;
      stackTrace?: string;
    };
  }>;
  
  filters: {
    levels: string[];
    stages: string[];
    timeRange: [Date, Date];
  };
}
```

**UIコンポーネント**:
- VirtualizedLogList: 仮想スクロールログリスト
- LogLevelFilter: レベル別フィルタチップ
- TimeRangeFilter: 時間範囲フィルタ
- LogSearch: キーワード検索
- ExportButton: ログエクスポート

#### Tab 3: 地図プレビュー（Map Preview）
```typescript
interface RouteMapPreview {
  // 表示設定
  visualization: {
    colorMode: 'type' | 'speed' | 'capacity';
    lineWidth: number;        // 1-10
    showDirections: boolean;
    showLabels: boolean;
    opacity: number;          // 0-1
  };
  
  // フィルタ
  visibleTypes: RouteType[];
  visibleCountries: string[];
  
  // インタラクション
  selectedRoutes: Set<string>;
  hoveredRoute: string | null;
  
  // 統計表示
  stats: {
    totalRoutes: number;
    totalLength: number;
    byType: Record<RouteType, number>;
  };
}
```

**UIコンポーネント**:
- **MapLibre GL地図**:
  - LineLayerで経路表示
  - 色分けモード切り替え
  - ホバー/クリックインタラクション
- **色分けモード（ToggleButtonGroup）**:
  - 📊 Type: ルートタイプ別固定色
  - 🚀 Speed: 速度グラデーション（緑→赤）
  - 📈 Capacity: 容量グラデーション（薄青→濃青）
- **線幅調整（Slider）**:
  - 0.5〜3.0の範囲で調整可能
  - リアルタイム反映
- **タイプフィルター（Chips）**:
  - ✈️ Airways: 15 routes（3,500 km）
  - 🚢 Seaways: 8 routes（1,200 km）
  - 🚗 Roads: 45 routes（2,800 km）
  - 🚂 Railways: 23 routes（1,500 km）
  - 🚄 HSR: 5 routes（800 km）
- **ルート情報ポップアップ**:
  ```
  路線名: 東海道新幹線
  Name: Tokaido Shinkansen
  Type: High Speed Rail
  区間: 東京 → 新大阪
  From: Tokyo → To: Shin-Osaka
  Distance: 515.4 km
  Max Speed: 285 km/h
  Operator: JR Central
  ```

#### Tab 4: データテーブル（Data Table）
```typescript
interface RouteDataTable {
  columns: [
    'Route Name',
    'Type',
    'Country',
    'Start',
    'End',
    'Length (km)',
    'Points',
    'Status'
  ];
  
  rows: RouteSegment[];
  
  features: {
    sort: boolean;
    filter: boolean;
    export: boolean;
    selection: boolean;
  };
}
```

**UIコンポーネント**:
- **AbstractDataGrid**: 
  - 仮想スクロール対応
  - カラムソート/フィルタ
  - 複数選択対応
- **カラム詳細**:
  - Route Name: 検索可能
  - Type: アイコン付きチップ表示
  - Length: 数値フォーマット、ソート可能
  - Points: 座標点数表示
  - Status: 処理状態インジケータ
- **ツールバー**:
  - SearchField: 全文検索
  - FilterMenu: 詳細フィルタ
  - ExportMenu: CSV/GeoJSON出力
  - StatisticsPanel: 選択データの統計

### エラー処理とリカバリ

```typescript
interface ErrorHandling {
  // エラー分類
  errors: {
    network: NetworkError[];      // ネットワークエラー
    parsing: ParseError[];        // データ解析エラー
    validation: ValidationError[]; // バリデーションエラー
    processing: ProcessError[];   // 処理エラー
  };
  
  // リカバリオプション
  recovery: {
    autoRetry: boolean;
    retryInterval: number;
    maxRetries: number;
    fallbackStrategy: 'skip' | 'use-cache' | 'use-alternative';
  };
}
```

**UIコンポーネント**:
- ErrorSummaryCard: エラー概要表示
- ErrorDetailDialog: 詳細エラー情報
- RetryQueue: リトライキュー管理
- RecoveryOptions: リカバリ戦略選択

## データベーススキーマ

### RouteEntity（メインエンティティ）
```typescript
interface RouteEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // 基本情報
  name: string;
  description: string;
  category: string;
  tags: string[];
  
  // データソース
  dataSourceName: string;
  dataSourceConfig: DataSourceConfig;
  
  // 処理設定
  processingConfig: RouteProcessingConfig;
  
  // 選択情報
  selectionMatrix: boolean[][];
  selectedRegions: string[];
  routeTypes: RouteType[];
  
  // バッチ処理
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  
  // メタデータ
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### RouteSegment（PersistentRelationalEntity）
```typescript
interface RouteSegment {
  id: EntityId;
  routeEntityId: EntityId;
  
  // セグメント情報（必須）
  segmentIndex: number;             // セグメント順序
  coordinates: [number, number][];  // LineString座標配列
  routeType: RouteType;             // ルートタイプ
  countryCode: string;              // 国コード（INTLは国際）
  
  // ルート識別情報
  routeName?: string;               // 路線名
  routeRef?: string;                // 路線番号・記号
  
  // 起終点情報
  startPoint?: {
    name?: string;                  // 起点名
    code?: string;                  // 起点コード（IATA等）
    coordinates: [number, number];  // 起点座標
  };
  
  endPoint?: {
    name?: string;                  // 終点名
    code?: string;                  // 終点コード
    coordinates: [number, number];  // 終点座標
  };
  
  // 中間点情報
  waypoints?: Array<{
    name?: string;
    coordinates: [number, number];
    type?: 'station' | 'junction' | 'waypoint';
  }>;
  
  // 物理特性
  length: number;                   // セグメント長（メートル）
  elevation?: {
    min: number;                    // 最低標高
    max: number;                    // 最高標高
    gain: number;                   // 累積標高
  };
  
  // 属性情報
  properties: {
    // 共通属性
    operator?: string;              // 運営事業者
    status?: 'active' | 'planned' | 'closed';
    openingDate?: string;
    closingDate?: string;
    
    // 交通属性
    maxSpeed?: number;              // 最高速度（km/h）
    avgSpeed?: number;              // 平均速度
    lanes?: number;                 // 車線数（道路）
    gauge?: number;                 // 軌間（鉄道、mm）
    electrified?: boolean;          // 電化（鉄道）
    frequency?: number;             // 運行頻度（本/日）
    
    // 容量属性
    capacity?: number;              // 輸送容量
    passengerVolume?: number;       // 旅客数/日
    freightVolume?: number;         // 貨物量/日
    
    // ネットワーク属性
    importance?: number;            // 重要度スコア
    connectivity?: number;          // 接続性スコア
    alternatives?: string[];        // 代替ルートID
    
    [key: string]: any;
  };
  
  // 簡略化情報
  simplificationLevel?: number;     // 簡略化レベル
  originalPointCount?: number;      // 元の座標点数
  
  // 空間インデックス
  boundingBox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  tileCoverage?: string[];          // カバーするタイルID
  
  // ソース情報
  sourceUrl: string;
  sourceLicense: string;
  downloadedAt: number;
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### RouteVectorTile（ベクタータイル）
```typescript
interface RouteVectorTile {
  id: string;                      // z/x/y形式
  routeEntityId: EntityId;
  
  zoom: number;
  x: number;
  y: number;
  
  tileData: ArrayBuffer;           // MVT形式
  features: number;                // フィーチャー数
  size: number;                    // バイト数
  
  generatedAt: number;
  expiresAt?: number;
}
```

## 使用例

### 東アジア高速鉄道網の構築
```typescript
// Step 1: 基本設定
const config = {
  name: "East Asia High-Speed Rail Network",
  description: "Shinkansen, KTX, and CRH networks",
  category: "transportation"
};

// Step 2: 地域とタイプ選択
const selection = {
  regions: ["JPN", "KOR", "CHN"],
  routeTypes: ["high_speed_rail"],
  selectionMatrix: [
    [false, false, false, false, true], // Japan: HSR only
    [false, false, false, false, true], // Korea: HSR only
    [false, false, false, false, true]  // China: HSR only
  ]
};

// Step 3: 処理実行
const session = await routePlugin.createBatchSession(
  nodeId,
  config,
  selection,
  {
    simplificationTolerance: 10,  // 10m tolerance
    generateVectorTiles: true,
    zoomLevels: [5, 8, 11, 14]
  }
);

// Step 4: 結果の可視化
const mapView = await routePlugin.createMapView(session.id, {
  colorMode: 'speed',
  showLabels: true,
  lineWidth: 2
});
```

### 国際航路ネットワーク
```typescript
// 国際ルート専用の選択
const internationalRoutes = {
  regions: ["INTL"],  // 国際ルート専用行
  routeTypes: ["airway", "seaway"],
  selectionMatrix: [
    [true, true, false, false, false]  // International: airways & seaways
  ]
};

// 重複なく国際ルートを一括取得
const session = await routePlugin.createBatchSession(
  nodeId,
  { name: "International Routes" },
  internationalRoutes
);
```

## パフォーマンス最適化

- **セグメント分割**: 長大ルートを適切なサイズに分割
- **空間インデックス**: R-treeによる高速空間検索
- **タイル事前生成**: よく使うズームレベルのタイル事前生成
- **差分更新**: 変更部分のみの更新処理
- **並列処理**: Web Workerによる並列簡略化処理

## 制限事項

- 最大座標点数: 1ルートあたり100,000点
- 最大セグメント長: 1,000km（それ以上は自動分割）
- ベクタータイルサイズ: 最大500KB/タイル
- 同時処理ルート数: 1,000ルート
- ブラウザメモリ制限: 使用可能メモリの80%まで

# Location Plugin

## 依存管理とインポート規約（重要）
共通方針は packages/node-type/CONTRIBUTING.md を参照。要点:
- peerDependencies: react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, dexie
- dependencies: @hierarchidb/util ほか必要に応じて @hierarchidb/feature/*
- devDependencies: typescript/tsup/vitest/@testing-library/*/@types/*
- import は公開API、型は `import type`、重い処理は dynamic import。
- tsup external は共通設定で外部化済み。
地点情報（POI: Points of Interest）の収集、管理、可視化を行うHierarchiDBプラグインです。
OpenStreetMapやGeoNames等のオープンデータソースから、空港、駅、港、行政センター等の地点データをバッチダウンロードし、地図上で可視化・分析できます。

## 主要機能

- 🌍 **マルチソース対応**: 複数のオープンデータソースから地点情報を収集
- 📍 **多様な地点タイプ**: 空港、鉄道駅、港湾、行政センター、高速道路IC等
- 🗺️ **インタラクティブ地図表示**: クラスタリング、ヒートマップ、フィルタリング機能
- 📊 **バッチ処理**: 大量データの並列ダウンロード・処理
- 🔄 **リアルタイム進捗確認**: ダウンロード状況の可視化
- 💾 **効率的なデータ管理**: IndexedDBによる永続化とキャッシング

### バッチ API / フック（ポイント → MVT ファストパス）

位置ポイント配列から Mapbox Vector Tile を生成し、Ephemeral DB に保存します。進捗は購読型で受け取れます。

```ts
import { LocationVectorTileService, useLocationProgress } from '@hierarchidb/location-plugin';

const svc = new LocationVectorTileService();
const { sessionId } = await svc.startSession(nodeId, points, { zoomMinGenerate: 5, zoomMaxGenerate: 7 });

// React フックで進捗購読
function ProgressWidget() {
  const { progress } = useLocationProgress(svc, sessionId);
  return <div>{progress ? `${progress.percentage.toFixed(0)}%` : '...'}</div>;
}

// タイル取得
const bytes = await svc.getVectorTile(sessionId, nodeId, z, x, y); // Uint8Array | null
```

フラグ（UI 表示の有効化）
- パネルからの起動ボタンは既定OFFです。下記いずれかで有効化してください。
  - Vite 環境: `VITE_LOCATION_BATCH_V1=1 pnpm dev`
  - Node 環境: `LOCATION_BATCH_V1=1 pnpm dev`

## 利用可能なオープンデータソース

### 主要データソース一覧

| データソース | URL | ライセンス | 地点タイプ | データ項目 | 更新頻度 |
|------------|-----|----------|----------|-----------|---------|
| **OpenStreetMap (Overpass API)** | https://overpass-api.de/ | ODbL 1.0 | 全タイプ | name, name:en, name:ja, lat/lon, amenity, aeroway, railway, highway, place | リアルタイム |
| **GeoNames** | https://www.geonames.org/ | CC BY 4.0 | 全タイプ | name, asciiname, alternatenames, latitude, longitude, feature_class, feature_code, country_code, admin1_code, population, elevation | 日次 |
| **Natural Earth** | https://www.naturalearthdata.com/ | Public Domain | 行政センター、空港、港 | name, nameascii, latitude, longitude, scalerank, featurecla, adm0name, adm1name | 不定期 |
| **OurAirports** | https://ourairports.com/data/ | Public Domain | 空港のみ | ident (ICAO/IATA), name, latitude_deg, longitude_deg, elevation_ft, type, municipality, iso_country, iso_region | 週次 |
| **OpenFlights** | https://openflights.org/data.html | ODbL 1.0 | 空港、駅 | name, city, country, IATA, ICAO, latitude, longitude, altitude, timezone, DST | 不定期 |
| **World Port Index** | https://msi.nga.mil/Publications/WPI | Public Domain | 港湾のみ | port_name, country, latitude, longitude, harbor_size, harbor_type, shelter, tide_range | 年次 |

### OpenStreetMap タグマッピング

| 地点タイプ | OSMタグ | 取得データ | 座標精度 |
|----------|--------|----------|---------|
| **行政センター** | `place=city`, `place=town`, `capital=yes` | name, name:en, name:ja, population, admin_level | 建物中心点 |
| **空港** | `aeroway=aerodrome`, `aeroway=terminal` | name, name:en, iata, icao, ele (標高) | 滑走路中心/ターミナル位置 |
| **鉄道駅** | `railway=station`, `railway=halt` | name, name:en, name:ja, railway:ref, network | プラットフォーム中心 |
| **港湾** | `harbor=yes`, `seamark:type=harbour` | name, name:en, cargo, passenger, maxdraft | 港湾エリア中心 |
| **高速道路IC** | `highway=motorway_junction` | name, ref, exit_to, junction:ref | ジャンクション中心点 |

### GeoNames フィーチャーコード

| コード | 説明 | 地点タイプ | 座標データ |
|-------|------|----------|-----------|
| **AIRP** | Airport | 空港 | latitude, longitude (小数点6桁精度) |
| **RSTN** | Railroad Station | 鉄道駅 | latitude, longitude |
| **PRT** | Port | 港湾 | latitude, longitude |
| **PPLA** | Seat of first-order admin division | 州都/県庁所在地 | latitude, longitude |
| **PPLC** | Capital of a political entity | 首都 | latitude, longitude |

## ステップバイステップ設定UI

### Step 1: 基本情報設定
```typescript
interface BasicInfoForm {
  // 名前と説明
  name: string;              // 例: "東アジア主要空港"
  description: string;       // 例: "日本、韓国、中国の国際空港データ"
  
  // カテゴリとタグ
  category: 'transportation' | 'administrative' | 'infrastructure';
  tags: string[];           // 例: ["airport", "asia", "international"]
}
```

**UIコンポーネント**:
- TextField: 名前入力（必須、最大100文字）
- TextField: 説明入力（複数行、最大500文字）
- Select: カテゴリ選択ドロップダウン
- Autocomplete: タグ入力（複数選択可、カスタムタグ追加可）

### Step 2: データソース選択
```typescript
interface DataSourceSelection {
  primarySource: 'osm' | 'geonames' | 'naturalearth' | 'ourairports';
  fallbackSources: string[];  // 代替ソース
  
  // ソース固有設定
  osmConfig?: {
    overpassEndpoint: string;  // デフォルト: https://overpass-api.de/api/interpreter
    timeout: number;           // クエリタイムアウト（秒）
    maxRetries: number;
  };
  
  geonamesConfig?: {
    username: string;          // GeoNames APIユーザー名
    maxRows: number;          // 最大取得件数
  };
}
```

**UIコンポーネント**:
- RadioGroup: プライマリソース選択
- CheckboxList: フォールバックソース選択
- Accordion: ソース別詳細設定パネル
- TextField: APIエンドポイント、認証情報

### Step 3: ライセンス確認
```typescript
interface LicenseAgreement {
  acceptedLicenses: {
    odbl: boolean;           // OpenStreetMap ODbL
    ccby: boolean;           // Creative Commons BY
    publicDomain: boolean;   // パブリックドメイン
  };
  attributionText: string;   // カスタム帰属表示
  commercialUse: boolean;    // 商用利用の有無
}
```

**UIコンポーネント**:
- Checkbox: 各ライセンスへの同意
- Alert: ライセンス条項の要約表示
- TextField: 帰属表示テキスト
- Link: 各ライセンスの詳細へのリンク

### Step 4: 処理設定
```typescript
interface LocationProcessingConfig {
  // ダウンロード設定
  downloadConfig: {
    concurrentDownloads: number;    // 並列ダウンロード数 (1-10)
    chunkSize: number;              // チャンクサイズ (1000-10000)
    requestDelay: number;           // リクエスト間隔（ミリ秒）
    corsProxyUrl?: string;          // CORSプロキシURL
  };
  
  // フィルタリング設定
  filterConfig: {
    enableDuplicateRemoval: boolean;  // 重複除去
    duplicateThreshold: number;       // 重複判定距離（メートル）
    minPopulation?: number;           // 最小人口（行政センターのみ）
    includeClosedFacilities: boolean; // 閉鎖施設を含む
  };
  
  // クラスタリング設定
  clusterConfig: {
    enableClustering: boolean;
    algorithm: 'kmeans' | 'dbscan' | 'hierarchical';
    clusterRadius: number;           // クラスタ半径（km）
    minClusterSize: number;          // 最小クラスタサイズ
  };
  
  // ジオコーディング設定
  geocodingConfig: {
    enableReverseGeocoding: boolean;
    geocodingLanguage: string; // e.g., 'en', 'ja', or locale code
    includeAdminBoundaries: boolean;
  };
}
```

**UIコンポーネント**:
- Slider: 並列数、チャンクサイズ調整
- NumberField: 数値パラメータ入力
- Switch: 機能の有効/無効切り替え
- Select: アルゴリズム選択
- AdvancedSettings: 詳細設定の折りたたみパネル

### Step 5: 地点タイプと地域選択

#### UI操作フロー詳細

**5.1 SelectionMatrixコンポーネントの操作**
1. **初期表示**: 
   - 縦軸: 国リスト（アルファベット順、「その他」が最上位）
   - 横軸: LocationTypeタブ（空港、駅、港、行政、IC）
   - 全セル未選択状態でロード

2. **ヘッダー操作**:
   - 国名行クリック → その国の全タイプ選択/解除
   - タイプ列クリック → 全国のそのタイプ選択/解除
   - 左上角クリック → 全選択/全解除

3. **セル個別操作**:
   - チェックボックスクリック → 個別選択/解除
   - セルホバー → 推定データ数のツールチップ表示
   - 選択時 → リアルタイムでURL生成と統計更新

4. **検索とフィルタリング**:
   - 国名検索フィールド → インクリメンタル検索
   - 大陸別フィルタボタン → 表示する国の絞り込み
   - 選択済みフィルタ → 選択済み行のみ表示

5. **統計表示**:
   - 選択数カウンター: "25/280 選択中"
   - 推定データ量: "約 4,500 地点 (2.3 MB)"
   - 処理時間予測: "約 3-5 分"

**5.2 LocationTypeタブの詳細機能**
各タブに専用設定パネル:

```typescript
interface LocationTypeConfig {
  airport: {
    includeHeliports: boolean;     // ヘリポート含む
    minRunwayLength: number;       // 最小滑走路長(m)
    activeOnly: boolean;           // 運航中のみ
    commercialOnly: boolean;       // 商業便のみ
  };
  railway_station: {
    includeMetro: boolean;         // 地下鉄駅含む
    includeAbandoned: boolean;     // 廃駅含む
    minPlatforms: number;          // 最小ホーム数
    intercityOnly: boolean;        // 都市間のみ
  };
  port: {
    includeMarinas: boolean;       // マリーナ含む
    cargoOnly: boolean;            // 貨物港のみ
    minDepth: number;              // 最小水深(m)
    activeOnly: boolean;           // 稼働中のみ
  };
  admin_centre: {
    adminLevels: number[];         // 行政レベル [2,4,6,8]
    populationMin: number;         // 最小人口
    capitalOnly: boolean;          // 首都のみ
    includeHistorical: boolean;    // 過去の首都含む
  };
  highway_junction: {
    interchangeOnly: boolean;      // インターチェンジのみ
    namedOnly: boolean;            // 名称付きのみ
    excludeServiceAreas: boolean;  // SA/PA除外
  };
}
```

**UIコンポーネント**:
- **TabPanel**: タイプ別設定パネル
- **ConfigSliders**: 数値範囲設定
- **ToggleSwitches**: ブール設定
- **MultiSelect**: 複数選択（行政レベルなど）
```typescript
interface LocationSelection {
  // 選択マトリックス (国 × 地点タイプ)
  selectionMatrix: boolean[][];
  
  countries: Array<{
    code: string;      // ISO 3166-1 alpha-3
    name: string;      // 英語名
    localName?: string; // 現地語名
    continent: string;
  }>;
  
  locationTypes: Array<{
    id: LocationType;
    enabled: boolean;
    filters?: {
      minSize?: number;        // 最小規模
      requiredTags?: string[]; // 必須タグ
    };
  }>;
  
  // 推定データ量
  estimatedCounts: {
    [key: string]: number;  // "JPN_airport" => 98
  };
}
```

**UIコンポーネント**:
- **SelectionMatrix**: カスタムチェックボックスマトリックス
  - 行: 国リスト（「その他（国際/公海）」を含む）
  - 列: 地点タイプ（空港、駅、港、行政センター、IC）
  - ヘッダー: 全選択/全解除ボタン
  - セル: 個別チェックボックス
- Chip: 選択統計表示（選択数、推定データ量）
- SearchField: 国名フィルタ
- ToggleButtons: 大陸別フィルタ

### Step 6: レビューと確認
```typescript
interface ReviewSummary {
  totalSelections: number;
  estimatedDataSize: string;    // "約 2.3 MB"
  estimatedDuration: string;     // "約 5-10 分"
  
  breakdown: {
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
    bySource: Record<string, number>;
  };
  
  warnings: string[];  // 潜在的な問題の警告
}
```

**UIコンポーネント**:
- SummaryCard: 設定サマリーカード
- PieChart: タイプ別/国別の内訳円グラフ
- Timeline: 処理フローの可視化
- WarningList: 注意事項リスト
- ActionButtons: 実行/キャンセル/設定保存

## バッチ処理進捗確認ダイアログ

### タブ構成

#### Tab 1: 進捗状況（Progress）

**1.1 リアルタイム進捗表示**

**全体進捗インジケーター**:
```typescript
interface OverallProgress {
  // メイン進捗バー
  percentage: number;              // 0-100
  phase: 'download' | 'filter' | 'cluster' | 'index';
  currentTask: string;             // "日本の空港データをダウンロード中..."
  
  // 時間情報
  startTime: number;
  timeElapsed: string;             // "00:02:34"
  timeRemaining: string;           // "約 3 分"
  estimatedCompletion: string;     // "15:45 完了予定"
  
  // スループット
  itemsPerSecond: number;
  bytesPerSecond: number;
  peakThroughput: number;
}
```

**ステージ進行ビジュアル**:
- **Stepper**: ✅ ダウンロード → 🔄 フィルタリング → ⏳ クラスタリング → ⏳ インデックス
- **各ステージのサブプログレス**: アニメーション付き円形プログレス
- **並列処理可視化**: 複数の進行バーで同時実行タスクを表示

**アクティブタスクモニター**:
```typescript
interface ActiveTaskMonitor {
  tasks: Array<{
    id: string;
    worker: number;              // Worker番号 (1-10)
    type: 'download' | 'process';
    target: string;              // "JPN_airport"
    status: 'running' | 'retrying' | 'failed';
    progress: number;            // タスク内進捗
    speed: string;               // "1.2 MB/s" or "45 items/s"
    eta: string;                 // "30s"
  }>;
  
  // コントロール
  canPause: boolean;
  canCancel: boolean;
  autoRetryEnabled: boolean;
}
```

**操作インタラクション**:
1. **一時停止ボタン**: 
   - クリック → 現在のタスク完了後に停止
   - 長押し → 即座に停止
   - 状態表示: "停止中... (現在のタスクを完了しています)"

2. **再開ボタン**: 
   - 停止位置から再開
   - 失敗タスクの自動リトライ設定

3. **キャンセルボタン**:
   - 確認ダイアログ表示
   - "処理を中止して結果を破棄しますか？"
   - 部分的な結果の保存オプション

**4. エラーハンドリング表示**:
```typescript
interface ErrorDisplay {
  retryQueue: Array<{
    taskId: string;
    errorType: 'network' | 'timeout' | 'rate_limit' | 'data_format';
    message: string;
    retryAttempt: number;
    maxRetries: number;
    nextRetryIn: string;         // "30秒後にリトライ"
  }>;
  
  actions: {
    retryNow: (taskId: string) => void;
    skipTask: (taskId: string) => void;
    retryAll: () => void;
    changeSettings: () => void;  // レート制限の調整など
  };
}
```

#### Tab 1: 進捗状況（Progress）
```typescript
interface ProgressView {
  // 全体進捗
  overallProgress: {
    percentage: number;
    phase: 'download' | 'filter' | 'cluster' | 'index';
    currentTask: string;
    timeElapsed: string;
    timeRemaining: string;
  };
  
  // ステージ別進捗
  stages: Array<{
    name: string;
    status: 'waiting' | 'running' | 'completed' | 'failed';
    progress: number;
    itemsProcessed: number;
    totalItems: number;
  }>;
  
  // アクティブタスク
  activeTasks: Array<{
    id: string;
    type: string;
    country: string;
    locationType: string;
    status: string;
    progress: number;
  }>;
}
```

**UIコンポーネント**:
- LinearProgress: 全体進捗バー（パーセンテージ表示）
- Stepper: ステージ進行状況
- DataGrid: アクティブタスクテーブル
- SpeedDial: 一時停止/再開/キャンセルボタン
- StatCards: 処理済み/残り/失敗数のカード表示

#### Tab 2: ログ（Logs）
```typescript
interface LogView {
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    source: string;
    message: string;
    details?: any;
  }>;
  
  filters: {
    level: string[];
    source: string[];
    search: string;
  };
}
```

**UIコンポーネント**:
- VirtualizedList: 大量ログの仮想スクロール
- FilterToolbar: レベル/ソース別フィルタ
- SearchBar: ログ検索
- ExportButton: ログエクスポート（CSV/JSON）
- ClearButton: ログクリア

#### Tab 3: 地図プレビュー（Map Preview）

**3.1 マップ操作とインタラクション**

**表示モード切り替え**:
```typescript
interface MapDisplayModes {
  points: {
    markerSize: 'small' | 'medium' | 'large';
    colorBy: 'type' | 'country' | 'source' | 'status';
    showLabels: boolean;
    labelThreshold: number;        // ズームレベル閾値
  };
  clusters: {
    algorithm: 'grid' | 'kmeans' | 'supercluster';
    radius: number;               // ピクセル単位
    maxZoom: number;              // 最大ズームレベル
    showClusterLabels: boolean;
  };
  heatmap: {
    intensity: number;            // 0.1 - 2.0
    radius: number;               // ピクセル単位
    gradient: string[];           // カラーグラデーション
    weightBy: 'count' | 'population' | 'capacity';
  };
}
```

**インタラクティブ操作**:
1. **マーカークリック** → ポップアップで詳細表示
2. **クラスタークリック** → ズームイン or 構成要素リスト表示
3. **右クリック** → コンテキストメニュー（座標コピー、Google Maps連携など）
4. **ドラッグ選択** → 矩形範囲選択（Shift+ドラッグ）
5. **マウスホバー** → 簡易情報表示

**地図コントロール**:
- **ズーム**: スライダー + ±ボタン + マウスホイール
- **視点操作**: 3Dチルト、回転（Alt+ドラッグ）
- **測定ツール**: 距離/面積測定モード
- **位置検索**: 地名/座標での移動
- **ベースマップ切り替え**: OSM/衛星画像/地形図

**統計オーバーレイ**:
```typescript
interface MapStatistics {
  viewport: {
    visiblePoints: number;
    totalPoints: number;
    coverage: string;             // "現在の表示範囲: 日本列島"
  };
  density: {
    pointsPerKm2: number;
    hotspots: Array<{
      center: [number, number];
      density: number;
      radius: number;
    }>;
  };
  distribution: {
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
  };
}
```

#### Tab 3: 地図プレビュー（Map Preview）
```typescript
interface MapPreviewView {
  displayMode: 'points' | 'clusters' | 'heatmap';
  
  visibleTypes: LocationType[];
  
  mapControls: {
    zoom: number;
    center: [number, number];
    bearing: number;
    pitch: number;
  };
  
  interactionMode: 'pan' | 'select' | 'measure';
  
  statistics: {
    totalPoints: number;
    visiblePoints: number;
    clusters: number;
    density: number;
  };
}
```

**UIコンポーネント**:
- **MapLibre GL Map**: インタラクティブ地図
- **表示モード切り替え（ToggleButtonGroup）**:
  - 📍 Points: 個別マーカー表示
  - 🔵 Clusters: 自動クラスタリング
  - 🔥 Heatmap: 密度ヒートマップ
- **タイプフィルター（Chips）**:
  - ✈️ Airport: 125（クリックで表示/非表示）
  - 🚂 Railway: 234（色分け表示）
  - 🚢 Port: 45（アイコン付き）
  - 🏛️ Admin: 67
  - 🛣️ Highway: 89
- **マップコントロール**:
  - ZoomSlider: ズームレベル調整
  - CompassControl: 方位リセット
  - ScaleBar: 縮尺表示
  - FullscreenButton: 全画面表示
- **ポップアップ情報**: クリックで詳細表示
  ```
  名称: 成田国際空港
  Name: Narita International Airport
  Type: Airport
  Country: Japan
  Coordinates: 35.7653, 140.3862
  IATA: NRT / ICAO: RJAA
  ```

#### Tab 4: データテーブル（Data Table）
```typescript
interface DataTableView {
  columns: Array<{
    field: string;
    header: string;
    sortable: boolean;
    filterable: boolean;
    width?: number;
  }>;
  
  rows: LocationRow[];
  
  pagination: {
    page: number;
    rowsPerPage: number;
    total: number;
  };
  
  selection: Set<string>;
}
```

**UIコンポーネント**:
- **AbstractDataGrid**: 仮想スクロール対応テーブル
- **カラム表示**:
  - Name（検索可能）
  - Type（フィルタ可能）
  - Country（ソート可能）
  - Coordinates（コピー可能）
  - Source（データソース）
  - Downloaded（タイムスタンプ）
- **ツールバー**:
  - SearchField: 全文検索
  - ColumnSelector: 表示カラム選択
  - ExportMenu: CSV/JSON/Excel出力
  - DeleteButton: 選択行削除
- **ページネーション**: 25/50/100/500件表示切り替え

### エラーハンドリングUI

```typescript
interface ErrorHandling {
  retryableErrors: Array<{
    taskId: string;
    error: string;
    retryCount: number;
    maxRetries: number;
    action: 'retry' | 'skip' | 'abort';
  }>;
  
  criticalErrors: Array<{
    source: string;
    message: string;
    stackTrace?: string;
    timestamp: Date;
  }>;
}
```

**UIコンポーネント**:
- ErrorDialog: エラー詳細モーダル
- RetryQueue: リトライ待機リスト
- ErrorSummary: エラー統計カード
- ActionButtons: 一括リトライ/スキップ

## データベーススキーマ

### LocationEntity（メインエンティティ）
```typescript
interface LocationEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // 基本情報
  name: string;
  description: string;
  category: string;
  tags: string[];
  
  // データソース設定
  dataSourceName: string;
  dataSourceConfig: DataSourceConfig;
  
  // 処理設定
  processingConfig: LocationProcessingConfig;
  
  // 選択情報
  selectionMatrix: boolean[][];
  selectedCountries: string[];
  locationTypes: LocationType[];
  
  // バッチ処理状態
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  lastProcessedAt?: number;
  
  // メタデータ
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### LocationRow（PersistentRelationalEntity）
```typescript
interface LocationRow {
  id: EntityId;
  locationEntityId: EntityId;
  
  // 地点情報（必須）
  name: string;                    // 英語名または最も一般的な名称
  latitude: number;                 // 緯度（-90 to 90）
  longitude: number;                // 経度（-180 to 180）
  locationType: LocationType;      // 地点タイプ
  countryCode: string;             // ISO 3166-1 alpha-3
  
  // 追加名称情報
  localName?: string;              // 現地語名
  alternateNames?: string[];       // 別名リスト
  
  // 識別子
  externalIds?: {
    osmId?: string;                // OpenStreetMap ID
    geonameId?: number;            // GeoNames ID
    iataCode?: string;             // IATA空港コード
    icaoCode?: string;             // ICAO空港コード
    unLocode?: string;             // UN/LOCODE（港湾）
    stationCode?: string;          // 駅コード
  };
  
  // 詳細属性
  properties: {
    population?: number;           // 人口（行政センター）
    elevation?: number;            // 標高（メートル）
    timezone?: string;             // タイムゾーン
    adminLevel?: number;           // 行政レベル
    capacity?: number;             // 収容能力
    openingYear?: number;          // 開業年
    closedYear?: number;           // 閉鎖年（該当する場合）
    website?: string;              // 公式ウェブサイト
    [key: string]: any;            // その他のカスタム属性
  };
  
  // 空間インデックス
  geohash?: string;                // Geohashによる空間インデックス
  h3Index?: string;                // H3による六角形インデックス
  clusterGroup?: string;           // クラスタリンググループID
  
  // データ品質
  accuracy?: 'exact' | 'approximate' | 'estimated';
  verificationStatus?: 'verified' | 'unverified' | 'disputed';
  lastVerifiedAt?: number;
  
  // ソース情報
  sourceUrl: string;               // データ取得元URL
  sourceLicense: string;           // ライセンス
  downloadedAt: number;            // ダウンロード日時
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

## 使用例

### 東アジアの交通拠点データ収集
```typescript
// Step 1: 基本情報
const basicInfo = {
  name: "East Asia Transport Hubs",
  description: "Major airports and railway stations in East Asia",
  category: "transportation",
  tags: ["asia", "airport", "railway", "infrastructure"]
};

// Step 2: データソース
const dataSource = {
  primarySource: "osm",
  fallbackSources: ["geonames"],
  osmConfig: {
    overpassEndpoint: "https://overpass-api.de/api/interpreter",
    timeout: 300,
    maxRetries: 3
  }
};

// Step 3: 地域と種別選択
const selection = {
  countries: ["JPN", "KOR", "CHN", "TWN"],
  locationTypes: ["airport", "railway_station"],
  selectionMatrix: [
    [true, true],  // Japan: airports & stations
    [true, false], // Korea: airports only
    [true, true],  // China: both
    [false, true]  // Taiwan: stations only
  ]
};

// Step 4: 処理実行
const session = await locationPlugin.createBatchSession(
  nodeId,
  basicInfo,
  dataSource,
  selection,
  processingConfig
);

// Step 5: 進捗モニタリング
locationPlugin.onProgress(session.id, (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
  console.log(`Current: ${progress.currentTask}`);
});
```

## パフォーマンス最適化

- **並列ダウンロード**: 最大10並列接続
- **チャンク処理**: 1000件単位でのバッチ処理
- **インクリメンタル更新**: 差分のみダウンロード
- **空間インデックス**: Geohash/H3による高速空間検索
- **キャッシング**: IndexedDBによるローカルキャッシュ

## 制限事項

- 一度のバッチで処理可能な最大地点数: 100,000
- 地図表示時の最大同時表示数: 10,000（それ以上はクラスタリング必須）
- APIレート制限: 各データソースの制限に準拠
- ストレージ容量: ブラウザのIndexedDB制限に依存

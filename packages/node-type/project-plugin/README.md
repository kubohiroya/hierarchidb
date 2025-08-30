# Project Plugin

複数の地理データ（Shape、Location、Route、PropertyResolver結果）を統合し、包括的な地理空間プロジェクトとして管理・分析・可視化するHierarchiDBプラグインです。
マルチレイヤー地図表示、空間解析、時系列分析、レポート生成等の高度な機能を提供します。

## 主要機能

- 📊 **統合ダッシュボード**: プロジェクト全体の概要と統計
- 🗺️ **マルチレイヤー地図**: 複数データソースの重ね合わせ表示
- 🔍 **空間解析**: バッファ分析、交差分析、ネットワーク分析
- 📈 **時系列分析**: データの時間的変化の可視化
- 📑 **レポート生成**: PDF/HTML形式の包括的レポート
- 🎯 **マップタイル生成**: PMTiles/MBTiles形式での配信

## ユースケース

### 1. 都市交通インフラ評価プロジェクト
鉄道、道路、空港データを統合し、交通アクセシビリティを評価。

| レイヤー | データソース | 分析内容 |
|---------|------------|---------|
| 鉄道網 | Route (Railway) | 駅からの徒歩圏カバレッジ |
| 道路網 | Route (Road) | 渋滞ポイント分析 |
| 空港 | Location (Airport) | 空港アクセス時間 |
| 人口分布 | Shape (Census) | 交通空白地域の特定 |

### 2. 災害リスク評価プロジェクト
洪水リスクエリアと避難施設の関係を分析。

| レイヤー | データソース | 役割 |
|---------|------------|------|
| 洪水想定区域 | Shape (Hazard) | リスクエリア表示 |
| 避難所 | Location (Shelter) | 避難施設配置 |
| 避難経路 | Route (Emergency) | 最適避難経路 |
| 人口統計 | PropertyResolver | 影響人口算出 |

### 3. 観光資源開発プロジェクト
観光スポット、交通、宿泊施設を統合した観光分析。

| カテゴリ | データ | 分析 |
|---------|-------|------|
| 観光地 | Location (POI) | 人気度ヒートマップ |
| アクセス | Route (Transport) | 到達時間分析 |
| 宿泊 | Location (Hotel) | 収容能力評価 |
| 季節性 | Time Series | 繁忙期分析 |

## ステップバイステップ設定UI

### Step 1: プロジェクト基本設定
```typescript
interface ProjectBasicInfo {
  // プロジェクト情報
  name: string;                    // 例: "東京都総合交通計画2024"
  description: string;             // 例: "東京都の交通インフラ現状分析と将来計画"
  
  // 分類とメタデータ
  category: 'urban-planning' | 'disaster-management' | 'tourism' | 
            'environment' | 'infrastructure' | 'research';
  tags: string[];                  // 例: ["transportation", "tokyo", "2024"]
  
  // プロジェクト期間
  duration: {
    startDate: Date;
    endDate?: Date;
    milestones?: Array<{
      date: Date;
      name: string;
      description: string;
    }>;
  };
  
  // 組織情報
  organization?: {
    name: string;
    department?: string;
    contactEmail?: string;
  };
  
  // アクセス権限
  visibility: 'private' | 'team' | 'organization' | 'public';
  collaborators?: Array<{
    email: string;
    role: 'viewer' | 'editor' | 'admin';
  }>;
}
```

**UIコンポーネント**:
- TextField: プロジェクト名、説明入力
- CategorySelector: カテゴリ選択（アイコン付き）
- DateRangePicker: プロジェクト期間設定
- MilestoneTimeline: マイルストーン設定
- CollaboratorManager: 共同作業者管理

### Step 2: 対象地域設定
```typescript
interface ProjectRegion {
  // 地理的範囲
  coverage: {
    type: 'bbox' | 'polygon' | 'administrative' | 'custom';
    
    // バウンディングボックス
    bbox?: {
      minLon: number;
      minLat: number;
      maxLon: number;
      maxLat: number;
    };
    
    // ポリゴン定義
    polygon?: GeoJSON.Polygon;
    
    // 行政区域
    administrative?: {
      country: string;             // ISO 3166-1
      level1?: string;             // 都道府県
      level2?: string;             // 市区町村
      level3?: string;             // 町丁目
    };
    
    // カスタム範囲
    custom?: {
      center: [number, number];
      radius: number;              // km
    };
  };
  
  // 地図設定
  mapConfig: {
    defaultView: {
      center: [number, number];
      zoom: number;
      bearing?: number;            // 方位角
      pitch?: number;              // 傾斜角
    };
    
    baseMap: 'streets' | 'satellite' | 'terrain' | 'light' | 'dark';
    
    // 3D表示設定
    enable3D?: boolean;
    terrainExaggeration?: number;
  };
  
  // 座標系
  coordinateSystem: {
    epsg: number;                  // デフォルト: 4326 (WGS84)
    displayFormat: 'decimal' | 'dms' | 'mgrs';
  };
}
```

**UIコンポーネント**:
- **RegionSelector**: インタラクティブ地図での範囲選択
  - DrawingTools: ポリゴン描画ツール
  - BboxTool: 矩形選択ツール
  - AdminBoundaryPicker: 行政区域選択
- **MapPreview**: 選択範囲のプレビュー
- **CoordinateSystemConfig**: 座標系設定
- **BasemapGallery**: ベースマップ選択

### Step 3: データレイヤー構成
```typescript
interface DataLayerConfig {
  // レイヤー定義
  layers: Array<{
    id: string;
    name: string;                  // 表示名
    
    // データソース
    source: {
      nodeId: NodeId;
      nodeType: 'shape' | 'location' | 'route' | 'propertyresolver';
      nodeName: string;
      lastUpdated: Date;
      recordCount: number;
    };
    
    // レイヤー設定
    config: {
      enabled: boolean;             // 初期表示状態
      order: number;                // 重ね順（大きいほど上）
      opacity: number;              // 0-1
      
      // 表示範囲制限
      minZoom?: number;
      maxZoom?: number;
      
      // フィルタ
      filters?: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
      
      // 時系列設定
      temporal?: {
        enabled: boolean;
        field: string;             // 時間フィールド
        range?: [Date, Date];
      };
    };
    
    // スタイル設定
    style: {
      type: 'simple' | 'categorized' | 'graduated' | 'rule-based';
      
      // ジオメトリ別スタイル
      point?: {
        symbol: 'circle' | 'square' | 'triangle' | 'star' | 'icon';
        size: number | string;      // 固定値またはフィールド参照
        color: string | ColorRamp;
        strokeColor?: string;
        strokeWidth?: number;
      };
      
      line?: {
        color: string | ColorRamp;
        width: number | string;
        dashArray?: number[];
        cap?: 'butt' | 'round' | 'square';
        join?: 'bevel' | 'round' | 'miter';
      };
      
      polygon?: {
        fillColor: string | ColorRamp;
        fillOpacity: number;
        strokeColor: string;
        strokeWidth: number;
        pattern?: 'solid' | 'dots' | 'lines' | 'cross';
      };
      
      // ラベル設定
      label?: {
        field: string;
        font: string;
        size: number;
        color: string;
        haloColor?: string;
        haloWidth?: number;
        placement: 'point' | 'line' | 'polygon';
      };
    };
    
    // インタラクション
    interaction: {
      hoverable: boolean;
      clickable: boolean;
      selectable: boolean;
      editable: boolean;
      
      // ポップアップ設定
      popup?: {
        enabled: boolean;
        template: string;           // HTMLテンプレート
        fields: string[];
      };
      
      // ツールチップ
      tooltip?: {
        enabled: boolean;
        field: string;
        format?: string;
      };
    };
  }>;
  
  // レイヤーグループ
  groups?: Array<{
    id: string;
    name: string;
    layers: string[];              // レイヤーID配列
    exclusive?: boolean;           // 排他的表示
  }>;
}
```

**UIコンポーネント**:
- **LayerManager**: レイヤー管理パネル
  - LayerList: ドラッグ可能なレイヤーリスト
  - LayerCard: 各レイヤーの設定カード
  - VisibilityToggle: 表示/非表示切り替え
  - OpacitySlider: 透明度調整
- **StyleEditor**: スタイル編集ダイアログ
  - SymbolPicker: シンボル選択
  - ColorRampEditor: カラーランプ設定
  - RuleBuilder: ルールベーススタイル作成
- **FilterBuilder**: フィルタ条件ビルダー
- **PopupDesigner**: ポップアップテンプレート作成

### Step 4: 空間解析設定
```typescript
interface SpatialAnalysisConfig {
  // 解析タイプ
  analyses: Array<{
    id: string;
    name: string;
    type: 'buffer' | 'intersection' | 'union' | 'difference' | 
          'nearest' | 'cluster' | 'density' | 'network';
    
    // バッファ分析
    buffer?: {
      sourceLayer: string;
      distance: number;
      unit: 'meters' | 'kilometers' | 'miles';
      dissolve: boolean;
      endCap: 'round' | 'flat' | 'square';
    };
    
    // 交差分析
    intersection?: {
      layer1: string;
      layer2: string;
      outputFields: 'all' | 'layer1' | 'layer2' | 'custom';
      spatialRelation: 'intersects' | 'contains' | 'within' | 'overlaps';
    };
    
    // 最近傍分析
    nearest?: {
      fromLayer: string;
      toLayer: string;
      k: number;                   // k最近傍
      maxDistance?: number;
      outputLines: boolean;        // 接続線を出力
    };
    
    // クラスター分析
    cluster?: {
      layer: string;
      algorithm: 'k-means' | 'dbscan' | 'hierarchical';
      parameters: {
        k?: number;                // k-means用
        eps?: number;              // DBSCAN用
        minPoints?: number;        // DBSCAN用
      };
    };
    
    // 密度分析
    density?: {
      layer: string;
      type: 'kernel' | 'point' | 'line';
      radius: number;
      cellSize: number;
      weightField?: string;
    };
    
    // ネットワーク分析
    network?: {
      networkLayer: string;
      facilityLayer: string;
      analysisType: 'service-area' | 'shortest-path' | 'closest-facility';
      impedance: string;           // コストフィールド
      cutoff?: number;
      facilities?: number;
    };
    
    // 出力設定
    output: {
      name: string;
      saveAsLayer: boolean;
      style?: LayerStyle;
    };
    
    // 実行設定
    execution: {
      auto: boolean;               // 自動実行
      schedule?: string;           // Cron式
      dependsOn?: string[];        // 依存する解析
    };
  }>;
  
  // 空間インデックス
  spatialIndex: {
    type: 'rtree' | 'quadtree' | 'h3' | 's2';
    precision?: number;
    cache: boolean;
  };
}
```

**UIコンポーネント**:
- **AnalysisToolbox**: 解析ツールボックス
  - ToolCategories: カテゴリ別ツール表示
  - ToolCard: 各ツールの設定カード
  - DragToAdd: ドラッグで解析追加
- **AnalysisWorkflow**: ワークフロービルダー
  - FlowChart: ノード型ワークフロー
  - ConnectionLines: 依存関係の可視化
  - RunButton: 実行ボタン
- **ParameterPanel**: パラメータ設定パネル
- **PreviewMap**: 解析結果プレビュー

### Step 5: 時系列分析設定
```typescript
interface TemporalAnalysisConfig {
  // 時系列設定
  temporal: {
    enabled: boolean;
    
    // 時間範囲
    timeRange: {
      start: Date;
      end: Date;
      step: {
        value: number;
        unit: 'hour' | 'day' | 'week' | 'month' | 'year';
      };
    };
    
    // 時間フィールドマッピング
    timeFields: Array<{
      layerId: string;
      field: string;
      format?: string;             // 日付フォーマット
      timezone?: string;
    }>;
    
    // アニメーション設定
    animation: {
      enabled: boolean;
      speed: number;               // 1-10
      loop: boolean;
      showTrails: boolean;         // 軌跡表示
      trailLength: number;         // フレーム数
    };
  };
  
  // 時系列分析
  analyses: Array<{
    id: string;
    name: string;
    type: 'trend' | 'hotspot' | 'movement' | 'change-detection';
    
    // トレンド分析
    trend?: {
      layer: string;
      valueField: string;
      aggregation: 'sum' | 'mean' | 'max' | 'min' | 'count';
      interval: string;            // 集計間隔
      trendLine: 'linear' | 'polynomial' | 'exponential';
    };
    
    // ホットスポット分析
    hotspot?: {
      layer: string;
      timeWindow: number;          // 時間窓（日）
      spatialWindow: number;       // 空間窓（m）
      threshold: number;           // 閾値
    };
    
    // 移動パターン分析
    movement?: {
      layer: string;
      idField: string;             // 追跡ID
      showPaths: boolean;
      pathStyle: LineStyle;
      statistics: boolean;         // 移動統計
    };
    
    // 変化検出
    changeDetection?: {
      layer: string;
      compareMethod: 'absolute' | 'relative' | 'percentage';
      threshold: number;
      highlightChanges: boolean;
    };
  }>;
  
  // タイムライン設定
  timeline: {
    position: 'top' | 'bottom';
    height: number;
    showChart: boolean;            // 統計チャート表示
    showEvents: boolean;          // イベントマーカー
    events?: Array<{
      date: Date;
      label: string;
      color: string;
    }>;
  };
}
```

**UIコンポーネント**:
- **TimeSlider**: 時間スライダー
  - PlayButton: 再生/一時停止
  - SpeedControl: 速度調整
  - StepButtons: ステップ送り
- **TimelineChart**: タイムライングラフ
  - DataSeries: データ系列表示
  - EventMarkers: イベントマーカー
  - BrushSelection: 範囲選択
- **AnimationSettings**: アニメーション設定
- **TemporalLegend**: 時系列凡例

### Step 6: 出力設定
```typescript
interface ProjectOutputConfig {
  // レポート生成
  report: {
    enabled: boolean;
    format: 'pdf' | 'html' | 'docx';
    
    sections: Array<{
      type: 'title' | 'summary' | 'map' | 'chart' | 'table' | 'text';
      content: any;
      pageBreak?: boolean;
    }>;
    
    template?: {
      id: string;
      customCSS?: string;
      headerFooter?: boolean;
      tableOfContents?: boolean;
    };
    
    schedule?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string;
      recipients: string[];
    };
  };
  
  // マップタイル生成
  tiles: {
    enabled: boolean;
    format: 'pmtiles' | 'mbtiles' | 'xyz';
    
    config: {
      minZoom: number;
      maxZoom: number;
      bounds?: [number, number, number, number];
      layers: string[];            // 含めるレイヤー
      
      optimization: {
        simplification: boolean;
        compression: 'none' | 'gzip' | 'brotli';
        tileSize: 256 | 512;
      };
    };
    
    hosting?: {
      type: 'local' | 'cloud' | 'cdn';
      url?: string;
      credentials?: any;
    };
  };
  
  // データエクスポート
  export: {
    formats: Array<{
      type: 'geojson' | 'shapefile' | 'kml' | 'csv' | 'excel';
      layers: string[];
      includeStyle: boolean;
      includeMetadata: boolean;
    }>;
    
    packaging: 'separate' | 'zip' | 'geopackage';
    
    api?: {
      enabled: boolean;
      endpoint: string;
      authentication: 'none' | 'apikey' | 'oauth';
      rateLimit?: number;
    };
  };
  
  // 共有設定
  sharing: {
    publicUrl?: boolean;
    embedCode?: boolean;
    qrCode?: boolean;
    
    permissions: {
      download: boolean;
      print: boolean;
      edit: boolean;
    };
    
    branding?: {
      logo?: string;
      watermark?: string;
      attribution: string;
    };
  };
}
```

**UIコンポーネント**:
- **ReportBuilder**: レポートビルダー
  - SectionList: セクションリスト
  - DragDropEditor: ドラッグ&ドロップエディタ
  - PreviewPane: プレビューペイン
- **TileGenerator**: タイル生成設定
  - ZoomLevelSelector: ズームレベル選択
  - LayerSelector: レイヤー選択
  - ProgressMonitor: 生成進捗
- **ExportWizard**: エクスポートウィザード
- **SharingPanel**: 共有設定パネル

## プロジェクト実行時UI

### メインダッシュボード

#### 概要タブ
```typescript
interface ProjectDashboard {
  // プロジェクト統計
  statistics: {
    layers: number;
    totalFeatures: number;
    dataSize: string;
    lastUpdated: Date;
    collaborators: number;
  };
  
  // アクティビティ
  recentActivity: Array<{
    timestamp: Date;
    user: string;
    action: string;
    details: string;
  }>;
  
  // クイックアクション
  quickActions: Array<{
    icon: string;
    label: string;
    action: () => void;
  }>;
  
  // データ品質
  dataQuality: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
  };
}
```

**UIコンポーネント**:
- **StatsCards**: 統計カード群
- **ActivityFeed**: アクティビティフィード
- **QuickActionBar**: クイックアクションバー
- **QualityGauges**: 品質ゲージ群

#### 地図ビュー
```typescript
interface MapView {
  // 地図コントロール
  controls: {
    zoom: ZoomControl;
    pan: PanControl;
    rotate: RotateControl;
    measure: MeasureTool;
    draw: DrawingTools;
    search: SearchBox;
    basemap: BasemapGallery;
    fullscreen: FullscreenButton;
  };
  
  // レイヤーコントロール
  layerControl: {
    type: 'list' | 'tree' | 'grouped';
    position: 'left' | 'right';
    collapsible: boolean;
  };
  
  // 凡例
  legend: {
    position: 'bottom-left' | 'bottom-right';
    dynamic: boolean;
    interactive: boolean;
  };
  
  // インフォパネル
  infoPanel: {
    visible: boolean;
    content: 'attributes' | 'statistics' | 'related';
    docked: boolean;
  };
}
```

**UIコンポーネント**:
- **MapLibreGL**: メイン地図
- **LayerControl**: レイヤーコントロール
- **Legend**: 動的凡例
- **InfoPanel**: 情報パネル
- **MeasurementTools**: 計測ツール
- **SearchBox**: 地名検索

#### 分析結果タブ
```typescript
interface AnalysisResults {
  // 結果リスト
  results: Array<{
    id: string;
    name: string;
    type: string;
    timestamp: Date;
    status: 'completed' | 'running' | 'failed';
    summary: any;
  }>;
  
  // 結果表示
  viewer: {
    type: 'map' | 'chart' | 'table' | 'report';
    data: any;
    interactiveOptions: any;
  };
  
  // 比較ツール
  comparison: {
    enabled: boolean;
    mode: 'side-by-side' | 'swipe' | 'blend';
    results: string[];
  };
}
```

**UIコンポーネント**:
- **ResultsList**: 結果リスト
- **ResultViewer**: 結果ビューア
- **ComparisonTool**: 比較ツール
- **ExportMenu**: エクスポートメニュー

#### データテーブルタブ
```typescript
interface DataTableView {
  // テーブル設定
  table: {
    dataSource: string;           // レイヤーID
    columns: ColumnConfig[];
    pagination: boolean;
    sorting: boolean;
    filtering: boolean;
    selection: boolean;
  };
  
  // 統計パネル
  statistics: {
    visible: boolean;
    metrics: string[];
    groupBy?: string;
  };
  
  // 編集機能
  editing: {
    enabled: boolean;
    validation: boolean;
    history: boolean;
  };
}
```

**UIコンポーネント**:
- **AbstractDataGrid**: データグリッド
- **StatisticsPanel**: 統計パネル
- **EditToolbar**: 編集ツールバー
- **FilterBar**: フィルタバー

## データベーススキーマ

### ProjectEntity（プロジェクトエンティティ）
```typescript
interface ProjectEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // 基本情報
  name: string;
  description: string;
  category: string;
  tags: string[];
  
  // 期間
  startDate: Date;
  endDate?: Date;
  milestones: Milestone[];
  
  // 地理的範囲
  coverage: ProjectCoverage;
  mapConfig: MapConfiguration;
  
  // データレイヤー
  layers: ProjectLayer[];
  layerGroups: LayerGroup[];
  
  // 解析設定
  spatialAnalyses: SpatialAnalysis[];
  temporalAnalyses: TemporalAnalysis[];
  
  // 出力設定
  outputConfig: OutputConfiguration;
  
  // 共有設定
  visibility: string;
  permissions: Permission[];
  collaborators: Collaborator[];
  
  // メタデータ
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  version: number;
}
```

### ProjectSnapshot（スナップショット）
```typescript
interface ProjectSnapshot {
  id: EntityId;
  projectEntityId: EntityId;
  
  // スナップショット情報
  name: string;
  description: string;
  timestamp: number;
  
  // 保存状態
  mapState: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
    visibleLayers: string[];
  };
  
  dataState: {
    layers: Array<{
      layerId: string;
      version: number;
      featureCount: number;
    }>;
  };
  
  analysisState: {
    results: string[];
    parameters: any;
  };
  
  // メタデータ
  createdBy: string;
  size: number;                   // bytes
  isBaseline: boolean;
}
```

### AnalysisResult（解析結果）
```typescript
interface AnalysisResult {
  id: EntityId;
  projectEntityId: EntityId;
  
  // 解析情報
  analysisId: string;
  analysisType: string;
  name: string;
  
  // 入力
  inputLayers: string[];
  parameters: Record<string, any>;
  
  // 結果
  result: {
    type: 'features' | 'raster' | 'statistics' | 'network';
    data: any;                     // GeoJSON or other format
    summary: {
      featureCount?: number;
      statistics?: any;
      metadata?: any;
    };
  };
  
  // 実行情報
  executedAt: number;
  executionTime: number;           // ms
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
  warnings?: string[];
  
  // 出力
  outputLayerId?: string;
  cached: boolean;
  expiresAt?: number;
}
```

### ProjectTile（プロジェクトタイル）
```typescript
interface ProjectTile {
  id: string;                      // "projectId/z/x/y"
  projectEntityId: EntityId;
  
  // タイル情報
  zoom: number;
  x: number;
  y: number;
  
  // データ
  tileData: ArrayBuffer;           // MVT or raster data
  format: 'mvt' | 'png' | 'jpeg' | 'webp';
  layers: string[];                // 含まれるレイヤー
  
  // メタデータ
  features: number;
  size: number;                    // bytes
  generatedAt: number;
  lastAccessed: number;
  accessCount: number;
}
```

## 使用例

### 都市計画プロジェクトの作成
```typescript
// Step 1: プロジェクト作成
const project = await projectPlugin.create({
  name: "Tokyo Urban Development 2030",
  category: "urban-planning",
  coverage: {
    type: "administrative",
    administrative: {
      country: "JPN",
      level1: "東京都"
    }
  }
});

// Step 2: データレイヤー追加
await project.addLayers([
  {
    name: "Railway Network",
    source: { nodeId: "tokyo-railways", type: "route" },
    style: { line: { color: "#0080ff", width: 3 } }
  },
  {
    name: "Population Density",
    source: { nodeId: "census-2020", type: "shape" },
    style: { 
      polygon: { 
        fillColor: {
          type: "gradient",
          field: "population",
          colors: ["#ffffcc", "#ff0000"]
        }
      }
    }
  }
]);

// Step 3: 空間解析実行
const bufferAnalysis = await project.runAnalysis({
  type: "buffer",
  name: "Station Accessibility",
  buffer: {
    sourceLayer: "Railway Stations",
    distance: 800,
    unit: "meters"
  }
});

// Step 4: レポート生成
const report = await project.generateReport({
  format: "pdf",
  sections: [
    { type: "title", content: "Tokyo Urban Development 2030" },
    { type: "map", content: { layers: ["all"], extent: "full" } },
    { type: "chart", content: bufferAnalysis.statistics },
    { type: "summary", content: project.getSummary() }
  ]
});
```

### 災害対応プロジェクト
```typescript
// リアルタイム災害監視プロジェクト
const disasterProject = await projectPlugin.create({
  name: "Flood Response System",
  category: "disaster-management",
  temporal: {
    enabled: true,
    timeRange: {
      start: new Date("2024-01-01"),
      end: new Date("2024-12-31")
    }
  }
});

// リアルタイムデータソース接続
await disasterProject.connectRealTimeSource({
  type: "water-level",
  url: "wss://disaster-api/stream",
  updateInterval: 60000  // 1分ごと
});

// アラート設定
await disasterProject.setAlerts([
  {
    condition: "water_level > threshold",
    threshold: 5.0,  // meters
    action: "notify",
    recipients: ["emergency@city.gov"]
  }
]);

// 避難経路解析
const evacuationRoutes = await disasterProject.runNetworkAnalysis({
  type: "closest-facility",
  incidents: "flood-areas",
  facilities: "evacuation-centers",
  impedance: "travel-time"
});
```

## 高度な機能

### リアルタイムコラボレーション
```typescript
interface Collaboration {
  // 同時編集
  realTimeSync: {
    enabled: boolean;
    conflictResolution: 'last-write' | 'merge' | 'lock';
    presence: boolean;             // カーソル表示
  };
  
  // コメント/アノテーション
  annotations: {
    enabled: boolean;
    types: ('comment' | 'marker' | 'sketch')[];
    threading: boolean;
  };
  
  // バージョン管理
  versioning: {
    enabled: boolean;
    autoSave: boolean;
    branches: boolean;
    mergeRequests: boolean;
  };
}
```

### AI支援機能
```typescript
interface AIFeatures {
  // パターン認識
  patternRecognition: {
    detectAnomalies: boolean;
    suggestClusters: boolean;
    identifyTrends: boolean;
  };
  
  // 予測分析
  prediction: {
    timeSeriesForecast: boolean;
    spatialPrediction: boolean;
    confidenceIntervals: boolean;
  };
  
  // 自動最適化
  optimization: {
    routeOptimization: boolean;
    siteSelection: boolean;
    resourceAllocation: boolean;
  };
}
```

## パフォーマンス最適化

- **タイルキャッシング**: 頻繁にアクセスされるタイルをキャッシュ
- **レベル・オブ・ディテール(LOD)**: ズームレベルに応じた詳細度調整
- **Web Worker**: 重い処理をバックグラウンド実行
- **インクリメンタル更新**: 変更部分のみ再計算
- **空間インデックス**: R-tree/Quadtreeによる高速検索

## 制限事項

- 最大レイヤー数: 50レイヤー/プロジェクト
- 最大フィーチャー数: 1,000,000フィーチャー/レイヤー
- タイル生成: 最大ズームレベル18
- 同時編集者数: 10人
- プロジェクトサイズ: 10GB（IndexedDB制限）
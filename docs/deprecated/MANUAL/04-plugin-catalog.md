# 標準プラグインカタログ

# 利用可能プラグイン一覧

## この章について

この章では、HierarchiDBで利用可能な全プラグインの機能と使用方法について説明します。

**読むべき人**: プラグイン機能を活用したいユーザー、適切なプラグイン選択が必要な方
**前提知識**: [01-concepts.md](./01-concepts.md)のプラグインシステム概念の理解
**読むタイミング**: 
- 特定の機能（地図表示、データ視覚化等）が必要になった時
- プラグインの選択に迷った時
- 各プラグインの制約や特徴を確認したい時
- spreadsheetデータ処理やgeo情報管理の方法を知りたい時

この章では、各プラグイン（Folder、BaseMap、StyleMap、Shape、Spreadsheet、Project）の具体的な機能、使用場面、設定方法を学べます。適切なプラグインを選択することで、効率的なデータ管理が可能になります。

## 概要

HierarchiDBには、基本機能を提供する標準プラグインが含まれています。各プラグインは特定のノードタイプと機能を提供します。

## Folder プラグイン

### 概要
階層構造を構成する基本的なフォルダ機能を提供。

### ノードタイプ
`folder`

### エンティティ構成
なし（TreeNodeのみで構成）

### 主要機能
- 子ノードの格納
- 階層構造の構築
- ドラッグ＆ドロップによる整理

### UI
- シンプルな名前/説明編集ダイアログ
- フォルダアイコン表示

## BaseMap プラグイン

### 概要
地図の表示設定とスタイル管理機能を提供。

### ノードタイプ
`basemap`

### エンティティ構成
| エンティティ | タイプ | ライフサイクル | 説明 |
|---|---|---|---|
| BaseMapEntity | Peer | Persistent | 地図設定データ |

### 主要機能
- 地図の中心座標設定
- ズームレベル管理
- 地図スタイル選択
- 境界設定

### データ構造
```typescript
interface BaseMapEntity {
  referencingNodeId: TreeNodeId;
  center: [number, number];  // [経度, 緯度]
  zoom: number;              // 1-20
  style: string;             // 'streets' | 'satellite' | 'hybrid'
  bounds?: [[number, number], [number, number]];
}
```

### UI
- 地図プレビュー付き編集ダイアログ
- インタラクティブな位置選択
- スタイルプレビュー

## StyleMap プラグイン

### 概要
CSVデータの視覚化とフィルタリング機能を提供。

### ノードタイプ
`stylemap`

### エンティティ構成
| エンティティ | タイプ | ライフサイクル | 説明 |
|---|---|---|---|
| StyleMapEntity | Peer | Persistent | スタイル設定 |
| TableMetadataEntity | Relation | Persistent | 共有テーブルデータ |

### 主要機能
- CSVファイルのインポート
- カラムマッピング
- フィルタルール設定
- カラーマッピング
- リアルタイムプレビュー

### データ構造
```typescript
interface StyleMapEntity {
  referencingNodeId: TreeNodeId;
  name: string;
  columnMappings: {
    key: string;
    label: string;
    color: string;
  }[];
  filterRules: FilterRule[];
  tableMetadataId?: string;  // RelationEntity参照
}

interface TableMetadataEntity {
  referencingNodeIds: TreeNodeId[];
  referenceCount: number;
  filename: string;
  headers: string[];
  rows: any[][];
  contentHash: string;
}
```

### UI
- 6ステップウィザード
  1. 基本情報
  2. ファイルアップロード
  3. フィルタ設定
  4. カラム選択
  5. カラー設定
  6. プレビュー確認

## Shapes プラグイン

### 概要
地理空間データの処理とベクタータイル生成機能を提供。

### ノードタイプ
`shapes`

### エンティティ構成
| エンティティ | タイプ | ライフサイクル | 説明 |
|---|---|---|---|
| ShapesEntity | Peer | Persistent | メイン設定 |
| VectorTileEntity | Group | Persistent | 生成タイル |
| SourceDataEntity | Relation | Persistent | ソースデータ |
| ProcessBufferEntity | Group | Ephemeral | 処理バッファ |
| BatchSessionEntity | Relation | Ephemeral | バッチセッション |

### 主要機能
- 複数データソース対応
  - GADM
  - GeoBoundaries
  - Natural Earth
  - OpenStreetMap
- 4段階バッチ処理
  1. データダウンロード
  2. 簡略化（レベル1）
  3. 簡略化（レベル2）
  4. ベクタータイル生成
- プログレス管理
- エラーハンドリング

### データ構造
```typescript
interface ShapesEntity {
  referencingNodeId: TreeNodeId;
  dataSource: DataSourceName;
  selectedCountries: string[];
  selectedAdminLevels: number[];
  batchConfig: {
    concurrency: number;
    simplificationTolerance: number;
    tileGenerationConfig: {
      minZoom: number;
      maxZoom: number;
      format: 'mvt' | 'geojson';
    };
  };
}

interface VectorTileEntity {
  referencingNodeId: TreeNodeId;
  index: number;
  zoom: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  metadata: {
    featureCount: number;
    byteSize: number;
    generatedAt: number;
  };
}
```

### UI
- 4段階設定ウィザード
  1. データソース選択
  2. 国・行政レベル選択
  3. バッチ設定
  4. 処理実行・モニタリング
- リアルタイムプログレス表示
- エラーコンソール
- 処理統計ダッシュボード

## Spreadsheet プラグイン

### 概要
大容量の表形式データ（CSV、TSV、Excel等）を効率的に処理・管理するプラグイン。

### ノードタイプ
`spreadsheet`

### 主な機能
- **多形式対応**: CSV、TSV、Excel、JSON形式のインポート
- **大容量処理**: 数百万行のデータに対応した最適化
- **データ圧縮**: 効率的なストレージとメモリ使用
- **高速クエリ**: インデックス機能による高速検索
- **フィルタリング**: リアルタイム条件フィルタ
- **統計分析**: 基本統計量の自動計算

### データ構造
```typescript
interface SpreadsheetMetadata {
  id: SpreadsheetMetadataId;
  name: string;
  columns: string[];
  rowCount: number;
  columnCount: number;
  fileSize: number;
  originalFormat: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
}

interface SpreadsheetRefEntity {
  nodeId: NodeId;
  metadataId: SpreadsheetMetadataId;
}
```

### 使用場面
- 大量のCSVデータの管理
- データ分析・統計処理
- レポート生成
- データの可視化とフィルタリング

## Project プラグイン

### 概要
複数のリソース（地図、データ、設定等）を統合管理するプロジェクト機能。

### ノードタイプ
`project`

### 主な機能
- **リソース統合**: 複数プラグインのデータを統合管理
- **レイヤー管理**: 地図レイヤーの階層化・表示制御
- **設定共有**: プロジェクト全体の設定管理
- **エクスポート**: プロジェクト全体の一括エクスポート

### 使用場面
- 複数データソースを組み合わせた分析
- プレゼンテーション用の統合ビュー
- チーム間でのプロジェクト共有

## プラグイン比較

| 特徴 | Folder | BaseMap | StyleMap | Shapes | Spreadsheet | Project |
|---|---|---|---|---|---|---|
| **複雑度** | 低 | 低 | 中 | 高 | 中 | 中 |
| **エンティティ数** | 0 | 1 | 2 | 5 | 3 | 2 |
| **UI ステップ数** | 1 | 1 | 6 | 4 |
| **バッチ処理** | なし | なし | なし | あり |
| **外部API連携** | なし | あり | なし | あり |
| **データ共有** | なし | なし | あり | あり |

## プラグイン選択ガイド

### Folderを選ぶ場合
- データの階層的な整理が必要
- 他のノードをグループ化したい
- シンプルな構造管理

### BaseMapを選ぶ場合
- 地図の表示設定を管理したい
- 地理的なコンテキストが必要
- 位置情報の基準点設定

### StyleMapを選ぶ場合
- CSVデータの視覚化が必要
- データのフィルタリングと色分け
- 複数データセットの比較

### Shapesを選ぶ場合
- 地理空間データの処理が必要
- ベクタータイルの生成
- 大規模データのバッチ処理

## カスタムプラグイン開発

### 開発の流れ
1. ノードタイプの定義
2. エンティティ構造の設計
3. EntityHandlerの実装
4. UIコンポーネントの開発
5. ライフサイクルフックの設定

### テンプレート
```typescript
const CustomPlugin: PluginDefinition = {
  nodeType: 'custom',
  
  // エンティティ定義
  entities: {
    main: {
      type: 'peer',
      lifecycle: 'persistent',
      storeName: 'customEntities'
    }
  },
  
  // ハンドラー
  handler: new CustomEntityHandler(),
  
  // UI定義
  ui: {
    icon: 'extension',
    dialog: CustomDialog,
    panel: CustomPanel
  },
  
  // ライフサイクル
  lifecycle: {
    afterCreate: async (node, context) => {
      // 初期化処理
    },
    beforeDelete: async (node, context) => {
      // クリーンアップ
    }
  }
};
```

## 次のステップ

- [プラグイン開発チュートリアル](./05-dev-plugin-tutorial.md)
- [エンティティシステム](./04-plugin-entity-system.md)
- [ライフサイクル管理](./04-plugin-lifecycle.md)
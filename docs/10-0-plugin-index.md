10-# 10 プラグイン一覧

ツリーノードを拡張するために、統合プラグインとして実装し組み込みする。

## basemap（基本地図プラグイン）
- **機能**: MapLibreGLJSで表示する基本的な地図を提供
- **エンティティ**: BaseMapEntity（地図スタイル、中心座標、ズーム等）
- **ルーティング**: view（マップ表示）、edit（マップ設定編集）
- **ライフサイクル**: afterCreate（初期地図設定）、beforeDelete（マップリソースクリーンアップ）

## stylemap（スタイル情報プラグイン）
- **機能**: CSVデータをもとにスタイル情報を提供
- **エンティティ**: StyleMapEntity（CSVパス、スタイル定義、カラーマップ等）
- **ルーティング**: import（CSVインポート）、preview（スタイルプレビュー）、export（スタイル出力）
- **API拡張**: parseCSVStyles、applyStyles、validateStyleData

## shape（ベクトルデータプラグイン）
- **機能**: GeoJSONを選択的に読み込み簡略化しベクトルタイルデータを生成して提供
- **エンティティ**: ShapeEntity（GeoJSONパス、簡略化レベル、フィルタ条件等）
- **サブエンティティ**: FeatureSubEntity（個別のGeoJSONフィーチャー情報）
- **ルーティング**: upload（GeoJSONアップロード）、simplify（形状簡略化）、tiles（ベクトルタイル生成）

## location（地点情報プラグイン）
- **機能**: 都市、港湾、空港、駅、インターチェンジをもとに、地図上の地点情報を提供
- **エンティティ**: LocationEntity（地点タイプ、座標、名称、属性情報等）
- **バリデーション**: 座標検証、地点タイプ制約、重複チェック
- **ルーティング**: search（地点検索）、batch（一括登録）、geocode（住所解析）

## route（経路情報プラグイン）
- **機能**: 海路、空路、道路、鉄道などの、地図上の経路情報を提供
- **エンティティ**: RouteEntity（経路タイプ、始点・終点、ウェイポイント、交通手段等）
- **ワーキングコピー**: 経路編集中の一時的な状態を安全に管理
- **ルーティング**: plan（経路計画）、optimize（最適化）、export（経路出力）

## propertyresolver（プロパティマッピングプラグイン）
- **機能**: MapLibreGLJSでの色・スタイル表示時のプロパティ名変換ルールを定義
- **目的**: shape, location, route が提供する GeoJSON features の properties を統一化
- **問題解決**: 同じ意味だが異なるproperty名や値で表現されているデータの変換
- **エンティティ**: PropertyResolverEntity（変換ルール、マッピング定義、条件式等）
- **処理対象**: GeoJSON features.properties の変換・正規化
- **ルーティング**: rules（変換ルール設定）、test（マッピングテスト）、apply（一括適用）
- **初期化優先度**: プライオリティ値による昇順初期化

## project（プロジェクト統合プラグイン）
- **配置**: Projectsツリー専用プラグイン
- **機能**: Resourcesツリーのノードを参照・集約してMapLibreGLJSで統合地図を表示
- **参照システム**: TreeNodeの他TreeNode参照機能を活用（循環依存回避）
- **UI機能**:
    - Resourcesツリー内容を開閉可能なツリーとして表示
    - 各ノードをチェックボックスで複数選択可能
    - 選択されたリソースを統合した地図表示
- **エンティティ**: ProjectEntity（選択リソース参照リスト、表示設定、レイヤー順序等）
- **サブエンティティ**: ResourceRefSubEntity（各Resourcesツリーノードへの参照情報）
- **ルーティング**:
    - select（リソース選択UI）
    - compose（プロジェクト構成）
    - render（統合地図表示）
    - export（プロジェクト出力）


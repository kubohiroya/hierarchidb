# 6 プラグインモジュールによるAOPでの機能拡張

## 6.1 概要

### 6.1.1 統合プラグインアーキテクチャ

**NodeTypeRegistryによる統合管理**: [7-aop-architecture.md](7-aop-architecture.md)で定義された統合プラグインレジストリ（NodeTypeRegistry）を基盤として、プラグインによる機能拡張を実現する。

**UnifiedPluginDefinition**: 従来のNodeTypeDefinitionにReact Routerルーティング機能とプラグインメタデータを統合した定義を使用。

### 6.1.2 workerの拡張

workerでのAPIサービスを、アスペクト志向でのクロスカット・ジョインポイントを用いて、拡張できるようにする。
とくに、APIサービスを通じて取り扱うノードのライフサイクルに応じて、ノードに紐づけたエンティティを管理することができるようにする。

**ライフサイクルマネージャー統合**: NodeLifecycleManagerによりライフサイクルフックが自動的に実行され、プラグイン固有の処理が適切なタイミングで呼び出される。

### 6.1.3 apiの拡張

エンティティおよびサブエンティティの種類ごとに、追加的なAPI定義を行う。

**Worker API拡張**: WorkerAPIExtensionsインターフェースを通じて、ノードタイプ固有のAPI操作を定義・実行可能。

### 6.1.4 uiの拡張

エンティティおよびサブエンティティの種類ごとに、追加的なReactコンポーネントを提供する。
これにより、ノードの作成とともに、エンティティ・サブエンティティを作成するダイアログを利用できるようにする。

**UIComponentRegistry統合**: 動的コンポーネント登録により、プラグイン固有のUIコンポーネントが自動的に利用可能になる。


## 6.2 統合プラグインアーキテクチャによる拡張モジュール

### 6.2.1 ツリー分類とプラグイン配置

**Resourcesツリー専用プラグイン**:
- basemap, stylemap, shapes, locations, routes, propertyresolver
- 地図表示に必要な各種リソースデータを管理
- 各プラグインは独立してリソースを提供
- 命名規則: NodeType 識別子は原則として「1対1対応のデータを管理するプラグインは単数形（例: basemap, stylemap, propertyresolver, project）、1対n対応のデータを管理するプラグインは複数形（例: shapes, locations, routes）」とする。

**Projectsツリー専用プラグイン**:
- project
- Resourcesツリーの複数ノードを参照・統合してプロジェクト表示
- TreeNode参照機能により他ツリーの内容を集約

**共通プラグイン**:
- folder
- Resources/Projects両ツリーで使用可能な汎用フォルダ機能

### 6.2.2 プラグイン定義の統一

**UnifiedPluginDefinition活用**: すべての拡張モジュールは、[7-aop-architecture.md](7-aop-architecture.md)で定義されたUnifiedPluginDefinitionを使用してNodeTypeRegistryに登録される。

```typescript
// 例: BaseMapプラグイン定義
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<BaseMapEntity, never, BaseMapWorkingCopy> = {
  // AOP機能（従来のNodeTypeDefinition）
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  database: { entityStore: 'basemaps', schema: {}, version: 1 },
  entityHandler: new BaseMapHandler(),
  lifecycle: { afterCreate, beforeDelete },
  
  // React Routerルーティング統合
  routing: {
    actions: {
      'view': { component: lazy(() => import('./MapView')), displayName: 'Map View' },
      'edit': { component: lazy(() => import('./MapEditor')), displayName: 'Map Editor' }
    },
    defaultAction: 'view'
  },
  
  // プラグインメタデータ
  meta: {
    version: '1.0.0',
    description: 'MapLibreGLJSで表示する基本的な地図を提供',
    tags: ['map', 'resources', 'visualization']
  }
};
```

### 6.2.2 ツリーノード拡張（統合プラグインとして実装）

#### 6.2.2.1 basemap（基本地図プラグイン）
- **機能**: MapLibreGLJSで表示する基本的な地図を提供
- **エンティティ**: BaseMapEntity（地図スタイル、中心座標、ズーム等）
- **ルーティング**: view（マップ表示）、edit（マップ設定編集）
- **ライフサイクル**: afterCreate（初期地図設定）、beforeDelete（マップリソースクリーンアップ）

#### 6.2.2.2 stylemap（スタイル情報プラグイン）
- **機能**: CSVデータをもとにスタイル情報を提供
- **エンティティ**: StyleMapEntity（CSVパス、スタイル定義、カラーマップ等）
- **ルーティング**: import（CSVインポート）、preview（スタイルプレビュー）、export（スタイル出力）
- **API拡張**: parseCSVStyles、applyStyles、validateStyleData

#### 6.2.2.3 shapes（ベクトルデータプラグイン）
- **機能**: GeoJSONを選択的に読み込み簡略化しベクトルタイルデータを生成して提供
- **エンティティ**: ShapeEntity（GeoJSONパス、簡略化レベル、フィルタ条件等）
- **サブエンティティ**: FeatureSubEntity（個別のGeoJSONフィーチャー情報）
- **ルーティング**: upload（GeoJSONアップロード）、simplify（形状簡略化）、tiles（ベクトルタイル生成）

#### 6.2.2.4 locations（地点情報プラグイン）
- **機能**: 都市、港湾、空港、駅、インターチェンジをもとに、地図上の地点情報を提供
- **エンティティ**: LocationEntity（地点タイプ、座標、名称、属性情報等）
- **バリデーション**: 座標検証、地点タイプ制約、重複チェック
- **ルーティング**: search（地点検索）、batch（一括登録）、geocode（住所解析）

#### 6.2.2.5 routes（経路情報プラグイン）
- **機能**: 海路、空路、道路、鉄道などの、地図上の経路情報を提供
- **エンティティ**: RouteEntity（経路タイプ、始点・終点、ウェイポイント、交通手段等）
- **ワーキングコピー**: 経路編集中の一時的な状態を安全に管理
- **ルーティング**: plan（経路計画）、optimize（最適化）、export（経路出力）

#### 6.2.2.6 propertyresolver（プロパティマッピングプラグイン）
- **機能**: MapLibreGLJSでの色・スタイル表示時のプロパティ名変換ルールを定義
- **目的**: shapes, locations, routesが提供するGeoJSON featuresのpropertiesを統一化
- **問題解決**: 同じ意味だが異なるproperty名や値で表現されているデータの変換
- **エンティティ**: PropertyResolverEntity（変換ルール、マッピング定義、条件式等）
- **処理対象**: GeoJSON features.properties の変換・正規化
- **ルーティング**: rules（変換ルール設定）、test（マッピングテスト）、apply（一括適用）
- **初期化優先度**: プライオリティ値による昇順初期化

#### 6.2.2.7 project（プロジェクト統合プラグイン）
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

## 6.3 統合プラグインアーキテクチャによる導入方法

### 6.3.1 プラグイン開発・パッケージング

**プラグイン構成**:
```
packages/plugins/{plugin-name}/
├── src/
│   ├── index.ts              # プラグインエントリポイント
│   ├── types/                # エンティティ定義
│   │   └── {Plugin}Entity.ts
│   ├── handlers/             # EntityHandler実装
│   │   └── {Plugin}Handler.ts
│   ├── ui/                   # UIコンポーネント
│   │   ├── {Plugin}Dialog.tsx
│   │   ├── {Plugin}Panel.tsx
│   │   └── {Plugin}Form.tsx
│   └── definitions/          # UnifiedPluginDefinition
│       └── {Plugin}Definition.ts
├── package.json
└── tsconfig.json
```

### 6.3.2 プラグイン登録

**NodeTypeRegistryへの統合登録**:
```typescript
// アプリケーション初期化時
import { BaseMapPlugin } from '@hierarchidb/plugin-basemap';
import { ShapesPlugin } from '@hierarchidb/plugin-shapes';

const registry = NodeTypeRegistry.getInstance();
const pluginLoader = new PluginLoader(pluginContext);

// 統合プラグインの読み込み
await pluginLoader.loadPlugin(BaseMapPlugin);
await pluginLoader.loadPlugin(ShapesPlugin);
// ... 他のプラグイン
```

### 6.3.3 導入手順

1. **依存関係の追加**:
   ```bash
   pnpm add @hierarchidb/plugin-basemap @hierarchidb/plugin-shapes
   ```

2. **プラグイン設定（プライオリティ指定）**:
   ```typescript
   // app.config.ts
   export const pluginConfig = {
     basemap: { enabled: true, priority: 10, settings: { defaultStyle: 'streets' } },
     shapes: { enabled: true, priority: 20, settings: { maxFileSize: '10MB' } },
     propertyresolver: { enabled: true, priority: 30 }, // shapes等の後に初期化
     project: { enabled: true, priority: 40 } // 最後に初期化
   };
   ```

3. **アプリケーション統合**:
   ```typescript
   // main.ts
   import { initializePlugins } from './plugin/PluginInitializer';
   
   await initializePlugins(pluginConfig);
   ```

4. **データベーススキーマ統合**:
   - 各プラグインのデータベーススキーマが自動的に統合される
   - 初回起動時にDexieによるスキーママイグレーションが実行される

5. **ルーティング統合**:
   - React Routerの動的ルート生成により、プラグインのルーティングアクションが自動的に利用可能になる

6. **プラグイン初期化順序**:
   - プライオリティ値の昇順で初期化実行（10→20→30→40）
   - 依存関係のあるプラグイン（propertyresolver等）を後に配置

### 6.3.4 開発環境での統合

**モノレポ構成での開発**:
```bash
# プラグイン開発
cd packages/plugins/basemap
pnpm dev

# アプリケーションとの統合テスト
cd ../../..
pnpm build:plugins
pnpm dev
```

**型安全性の保証**:
- TypeScriptの型システムにより、プラグイン間の整合性を静的に検証
- UnifiedPluginDefinitionの型制約により、必要なインターフェースの実装を強制

### 6.3.5 プロダクション配布

**NPMパッケージとしての配布**:
```json
// package.json (プラグイン)
{
  "name": "@hierarchidb/plugin-basemap",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@hierarchidb/core": "^1.0.0",
    "react": "^18.0.0"
  }
}
```

**プラグインレジストリ（将来拡張）**:
- 公式/サードパーティプラグインのレジストリ
- バージョン管理とアップデート通知
- プラグイン間の依存関係解決

## 6.4 エラーハンドリング方針

### 6.4.1 設定時エラー
- **対象**: プラグイン定義の型エラー、必須フィールド不備等
- **処理**: ビルドエラーとして標準エラー出力に詳細を出力
- **停止**: ビルドプロセスを停止し、修正を促す

### 6.4.2 実行時エラー
- **対象**: ライフサイクルフック実行エラー、API呼び出しエラー等
- **処理**: console.errorでエラー内容をテキスト出力
- **継続**: 可能な限りアプリケーション実行を継続

### 6.4.3 エラー例
```
// 設定時エラー例
TypeError: Plugin 'basemap' missing required field 'entityHandler'

// 実行時エラー例
console.error('Lifecycle hook afterCreate failed for basemap:', error);
```

## 6.5 パフォーマンス設計

### 6.5.1 プラグイン検索の効率化
- **方式**: ノードのtreeNodeType値からO(1)でプラグイン特定
- **実装**: Map<TreeNodeType, UnifiedPluginDefinition>による高速検索
- **スケーラビリティ**: プラグイン数に依存しない一定時間アクセス

### 6.5.2 初期化コスト
- **方針**: 問題観測後の最適化アプローチ
- **現状**: 基本的な実装でスタート、パフォーマンス問題発生時に対応
- **監視**: 初期化時間やメモリ使用量の測定機能を将来追加
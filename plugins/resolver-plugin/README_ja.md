# @hierarchidb/resolver-plugin

最終更新: 2026-04-05

異なるデータスキーマ間でプロパティをマッピングし、下流プラグインが一貫した属性を読み取れるよう統一構造へ変換するプラグイン。スキーマ自動検出、バリデーション、重複解決、コンパイル最適化を備える。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `resolver` |
| extends | `folder` |
| category | `data` |
| priority | `60` |

resolver-plugin は folder-plugin を継承し、異種スキーマ間のプロパティマッピング機能を提供する。Styler プラグインと連携することで、異なるプロパティ名を持つデータセットを統一的にスタイリングできる。

## UI 層

### ダイアログ

resolver-plugin の UI は `PluginStepRegistry` ベースのステップ登録方式を採用している。`getDialogComponent()` は非推奨（deprecated）であり、現在は null を返す。

ステップ登録は `src/ui/components/steps-provider.tsx` で行われ、nodeType `resolver` に対して以下の 6 ステップを提供する:

1. **Schema Selection** — ソーススキーマとターゲットスキーマの定義・自動検出
2. **Property Mapping** — ソース→ターゲットのプロパティマッピングルール定義
3. **Validation Rules** — 必須チェック・型チェック・範囲チェック・パターンマッチング等のバリデーション設定
4. **Duplicate Resolution** — 重複データの処理戦略（ignore / overwrite / merge / skip / custom）
5. **Build** — マッピングのコンパイル・最適化（オプション）
6. **Preview / Test** — マッピング結果のプレビューとテスト実行

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `ResolverPanel` | Resolver 設定の概要表示・統計・アクションパネル |
| `SchemaSelectionStep` | スキーマ選択ステップ |
| `PropertyMappingStep` | プロパティマッピングステップ |
| `ValidationConfigStep` | バリデーション設定ステップ |
| `DuplicateResolutionStep` | 重複解決ステップ |
| `ResolverBuildStep` | ビルド（コンパイル）ステップ |
| `PreviewTestStep` | プレビュー・テストステップ |

### アイコン

```typescript
// Entry point: @hierarchidb/resolver-plugin/icon
import { ResolverPluginIcon } from '@hierarchidb/resolver-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Extension` |
| Emoji | 🧩 |
| カラー | `#ffb3c1` |

## Worker 層

### ResolverEntityService

`ResolverEntityService` は CoreDB の `TreeNode` payload/draft を通じて Resolver エンティティの CRUD 操作を行う。

Worker の `preload` 設定として `registerResolverWorkerStores` が登録されている。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerResolverWorkerStores'],
}
```

### ライフサイクル

- **作成**: TreeNode の作成 + payload/draft へのスキーマ・マッピングルール格納
- **更新**: マッピングルール・バリデーションルール・重複解決戦略の更新
- **削除**: TreeNode payload/draft のクリア
- **検索**: nodeType `resolver` による TreeNode 検索、名前フィルタリング
- **複製**: 既存 Resolver の設定をコピーして新規ノードに作成
- **バリデーション**: スキーマ存在チェック、マッピングルール整合性検証、重複ターゲット検出
- **コンパイル**: マッピングルールの最適化関数へのコンパイル

### サービス層

| サービス | 説明 |
| --- | --- |
| `MappingCompiler` | マッピングルールを最適化された JavaScript 関数にコンパイル。実行計画の構築、定数畳み込み・共通部分式除去・デッドコード除去・ループ融合・並列化等の最適化を適用 |
| `SimpleMappingCompiler` | テスト用のシンプルなマッピングコンパイラ。ドット記法パスによる値取得・設定、変換関数の適用をサポート |
| `ChainManager` | 複数 Resolver の連鎖実行を管理。sequential / parallel / conditional / fallback / weighted の 5 つの実行戦略と、last-wins / first-wins / merge / error / custom の競合解決をサポート |

## データベーススキーマ

resolver-plugin は Dexie データベース `resolver-db` を使用する。

```typescript
// plugin-manifest.ts
database: {
  dbName: 'resolver-db',
  tableName: 'resolvers',
  version: 1,
  schema: {
    fields: [
      { name: 'id', indexed: true },
      { name: 'nodeId', indexed: true },
      { name: 'name', indexed: true },
    ],
  },
}
```

### データ構造

Resolver エンティティは `PeerEntity` を拡張した型として定義される:

```typescript
// ResolverEntity extends PeerEntity
type ResolverEntity = PeerEntity<ResolverEntityPayload>;

type ResolverEntityPayload = {
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
  mappingRules: PropertyMappingRule[];
  validationRules: ValidationRule[];
  duplicateResolution: DuplicateResolutionStrategy;
  dataTransformations: DataTransformation[];
  previewConfig?: PreviewConfig;
  isCompiled?: boolean;
  lastCompiled?: number;
  compiledFunction?: string;
  compiledMetadata?: Record<string, unknown>;
  lastValidation?: MappingValidationResult | null;
};
```

### 主要な型定義

```typescript
interface PropertyMappingRule {
  id: string;
  sourceProperty: string;
  targetProperty: string;
  transformFunction?: string;
  isRequired: boolean;
  defaultValue?: unknown;
  description?: string;
}

interface ValidationRule {
  id: string;
  property: string;
  ruleType: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: Record<string, unknown>;
  errorMessage?: string;
}

interface DuplicateResolutionStrategy {
  strategy: 'ignore' | 'overwrite' | 'merge' | 'skip' | 'custom';
  customFunction?: string;
  mergeProperties?: string[];
}

interface SchemaInfo {
  name: string;
  properties: PropertyInfo[];
  sampleData?: Record<string, unknown>[];
}
```

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

resolver-plugin は folder-plugin を継承し、フォルダのコンテナ機能を基盤として利用する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  relationalData: true,
}
```

### Tags

```typescript
tags: ['mapping', 'schema']
```

### Visibility

```typescript
visibility: {
  hidden: true,  // tree menu from direct creation is hidden
}
```

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `resolver-plugin` |
| ロケール | `en`, `ja` |

## 使用例

### PluginManifest の参照

```typescript
import { ResolverPluginManifest } from '@hierarchidb/resolver-plugin';

console.log(ResolverPluginManifest.nodeType); // 'resolver'
console.log(ResolverPluginManifest.extends);  // 'folder'
```

### ResolverPluginIcon の使用

```tsx
import { ResolverPluginIcon } from '@hierarchidb/resolver-plugin/icon';

<ResolverPluginIcon />
```

### ResolverEntityService による CRUD

```typescript
import { ResolverEntityService } from '@hierarchidb/resolver-plugin/worker';
import type { NodeId } from '@hierarchidb/core-types';

const service = new ResolverEntityService();

// Create a resolver entity
const entity = await service.createEntity(nodeId, {
  name: 'CSV to Styler Mapper',
  description: 'Map CSV properties to Styler schema',
  sourceSchema: csvSchema,
  targetSchema: stylerSchema,
  mappingRules: [
    {
      id: 'rule-1',
      sourceProperty: 'prefecture_name',
      targetProperty: 'name',
      isRequired: true,
    },
  ],
  duplicateResolution: { strategy: 'skip' },
});

// Validate mapping configuration
const validation = await service.validateMapping(nodeId);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
}
```

### ChainManager による複数 Resolver の連鎖実行

```typescript
import { ChainManager } from '@hierarchidb/resolver-plugin';

const chainManager = new ChainManager();

// Create a sequential chain
const chain = await chainManager.createChain({
  name: 'Multi-source Pipeline',
  strategy: 'sequential',
  conflictResolution: 'last-wins',
  resolvers: [
    { resolverId: csvNormalizerId, order: 1, enabled: true },
    { resolverId: geoEnhancerId, order: 2, enabled: true },
  ],
});

// Execute the chain
const result = await chainManager.executeChain(chain.id, sourceData);
console.log('Success:', result.success);
console.log('Processed:', result.statistics.recordsProcessed);
```

## ディレクトリ構成

```text
src/
├── index.ts                  # Root entry point (types + manifest + lazy loaders)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── entities/
│   │   └── ResolverEntity.ts # Entity types and payload definitions
│   ├── i18n/
│   │   └── index.ts          # i18n stub (registration in ui/i18n.ts)
│   └── types/
│       └── index.ts          # Re-exports from entities
├── icon/
│   └── index.ts              # ResolverPluginIcon (re-export of MUI Extension)
├── services/
│   ├── ChainManager.ts       # Multi-resolver chain execution manager
│   ├── MappingCompiler.ts    # Optimizing mapping compiler with execution plans
│   └── SimpleMappingCompiler.ts # Simple mapping compiler for testing
├── ui/
│   ├── i18n.ts               # i18n resource bundle registration
│   ├── index.ts              # UI entry point (step registration + i18n)
│   ├── locales/
│   │   ├── en.json           # English locale
│   │   └── ja.json           # Japanese locale
│   └── components/
│       ├── index.ts           # Component exports + lazy loaders
│       ├── ResolverPanel.tsx  # Main resolver panel (overview + actions)
│       ├── useResolverPanel.ts # Panel hook (compilation, statistics)
│       ├── steps-provider.tsx # PluginStepRegistry registration (6 steps)
│       └── steps/
│           ├── SchemaSelectionStep.tsx
│           ├── PropertyMappingStep.tsx
│           ├── ValidationConfigStep.tsx
│           ├── ValidationConfigStepViewElements.tsx
│           ├── DuplicateResolutionStep.tsx
│           ├── ResolverBuildStep.tsx
│           ├── PreviewTestStep.tsx
│           └── hooks/         # Step-specific hooks
└── worker/
    └── ResolverEntityService.ts # CRUD + validation + compilation service
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/resolver-plugin` | 型定義、PluginManifest、遅延ローダー |
| `@hierarchidb/resolver-plugin/ui` | UI コンポーネント（ステップ登録、i18n） |
| `@hierarchidb/resolver-plugin/icon` | ResolverPluginIcon |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode、TreeNodeUpdaterPayload 型定義
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — CoreDB アクセス（Worker 層）
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — プラグインサービス API
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/ui-dialog`](../packages/ui/dialog/) — ダイアログ基盤（DialogSafeMenu）
- [`@hierarchidb/ui-plugin-basic-info`](../packages/ui/plugin-basic-info/) — プラグイン基本情報ステップ
- [`@hierarchidb/ui-i18n`](../packages/ui/i18n/) — 国際化基盤
- [`@hierarchidb/ui-worker-provider`](../packages/ui/worker-provider/) — Worker プロバイダ
- [`@hierarchidb/util`](../packages/util/) — ユーティリティ

### 継承元プラグイン

- [`folder-plugin`](../plugins/folder-plugin/) — 基盤コンテナプラグイン

### 関連プラグイン

- [`spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — CSV/TSV/Excel ソース管理（マッピング元データ）
- [`styler-plugin`](../plugins/styler-plugin/) — スタイル定義・Map スタイル適用（マッピング先連携）
- [`shape-plugin`](../plugins/shape-plugin/) — 形状データ（マッピング対象データ）

## ライセンス

MIT

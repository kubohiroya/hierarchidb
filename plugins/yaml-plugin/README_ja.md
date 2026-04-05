# @hierarchidb/yaml-plugin

最終更新: 2026-04-05

HierarchiDB の YAML ファイルノードプラグイン。IDE-GSM 統合のための YAML 設定ファイルをツリーノードとして管理する。JSON Schema ベースのスキーマ選択・バリデーション付きエディタを提供し、YAML コンテンツの構造化された編集を可能にする。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `yaml-file` |
| extends | `folder` |
| category | `yaml`（menuGroup: `yaml`、createOrder: `500`） |
| priority | `500` |

yaml-plugin は folder-plugin を継承し、YAML ファイルの管理機能を追加する。

## UI 層

### ダイアログステップ

`PluginStepRegistry` ベースの 3 ステップウィザードを提供する:

| ステップ | ID | コンポーネント | 説明 | バリデーション |
| --- | --- | --- | --- | --- |
| 1 | `basic-info` | `YamlBasicInfoStep` | 名前の入力 | `name` が空でないこと |
| 2 | `schema-selection` | `YamlSchemaSelectionStep` | スキーマ ID の選択 | `schemaId` が選択されていること |
| 3 | `schema-editor` | `YamlSchemaEditorStep` | JSON Schema Form によるコンテンツ編集 | 常に有効（保存可能） |

スキーマエディタは `@rjsf/core` + `@rjsf/mui` を使用し、選択されたスキーマに基づくフォーム UI を動的に生成する。

### アイコン

```typescript
// Entry point: @hierarchidb/yaml-plugin/icon
import { YamlPluginIcon } from '@hierarchidb/yaml-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Description` |
| Emoji | 📄 |
| カラー | `#4caf50` |

## Worker 層

`registerYamlWorkerStores` が `preload` として登録され、`@hierarchidb/yaml-store` の `YamlDB` シングルトンを初期化する。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerYamlWorkerStores'],
}
```

CRUD 操作は `@hierarchidb/yaml-store` の API を通じて行われる。

## データベーススキーマ

yaml-plugin は `@hierarchidb/yaml-store` が提供する `YamlDB`（Dexie ベース）を使用する。専用のデータベース定義は yaml-store パッケージ側に存在する。

### エンティティ構造

```typescript
// YamlFileNodeData (from @hierarchidb/yaml-api)
interface YamlFileNodeData {
  name: string;
  schemaId: string;
  content: string;  // YAML content as string
}

// Draft type for create/edit
type YamlDraft = Partial<YamlFileNodeData>;
```

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,
  canBeRoot: false,
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'schemaId', type: 'string', required: true },
    { name: 'content', type: 'string', required: false },
  ],
}
```

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `yaml-plugin` |

## 使用例

### PluginManifest の参照

```typescript
import { YamlPluginManifest, YAML_NODE_TYPE } from '@hierarchidb/yaml-plugin';

console.log(YamlPluginManifest.nodeType); // 'yaml-file'
console.log(YamlPluginManifest.extends);  // 'folder'
console.log(YAML_NODE_TYPE);              // 'yaml-file'
```

### YamlPluginIcon の使用

```tsx
import { YamlPluginIcon } from '@hierarchidb/yaml-plugin/icon';

<YamlPluginIcon sx={{ color: '#4caf50' }} />
```

## ディレクトリ構成

```text
src/
├── index.ts                  # Root entry point (manifest + constants)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── constants.ts          # YAML_NODE_TYPE re-export
│   └── types/
│       └── YamlEntity.ts     # YamlDraft type
├── icon/
│   ├── index.ts              # Icon entry point
│   └── YamlPluginIcon.tsx    # MUI Description icon
├── ui/
│   ├── index.ts              # UI entry point (step exports)
│   └── components/
│       ├── steps-provider.tsx # PluginStepRegistry registration (3 steps)
│       └── steps/
│           ├── YamlBasicInfoStep.tsx       # Basic info step
│           ├── YamlSchemaSelectionStep.tsx # Schema selection step
│           └── YamlSchemaEditorStep.tsx    # Schema editor step (RJSF)
└── worker/
    ├── index.ts                        # Worker entry point
    └── registerYamlWorkerStores.ts     # YamlDB singleton initialization
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/yaml-plugin` | PluginManifest、YAML_NODE_TYPE、YAML_PLUGIN_ID |
| `@hierarchidb/yaml-plugin/ui` | UI コンポーネント（3 ステップ） |
| `@hierarchidb/yaml-plugin/icon` | YamlPluginIcon |
| `@hierarchidb/yaml-plugin/worker` | registerYamlWorkerStores |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/core-types`](../../packages/core-types/) — NodeType 等の共有型定義
- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — PluginManifest、PluginStepRegistry
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YamlFileNodeData 型定義
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — YamlDB（Dexie データストア）

### 親プラグイン

- [`folder-plugin`](../folder-plugin/) — 基盤コンテナノード

## ライセンス

MIT

# @hierarchidb/yaml-plugin

最終更新: 2026-08-20

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

現行実装では`registerYamlWorkerStores`が`preload`として登録され、`@hierarchidb/yaml-store`のlegacy YamlDB v1 singletonを初期化する。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerYamlWorkerStores'],
}
```

このpreloadは一時的なlegacy runtime pathであり、YAML storage authorityではない。後続Issueでlegacy rowをinventory / recoveryしてからruntime pathを除去する。既存YamlDB mutation helperはlegacy専用であり、canonical dialog、ZIP、simulation、Step 4 pathから呼び出してはならない。現行の[folder YAML import](../folder-plugin/README_ja.md#legacy-yaml-snapshot-boundary)はnon-canonicalであり、cutoverをblockedとする。新しいCRUD caller、YamlDB write、dual-write、fallback readを追加してはならない。

## Storage authority

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- committed filename / payload stateはCoreDB `TreeNode.metadata/data`へ保存する。
- draft filename / payload stateはCoreDB `TreeNode.draftMetadata/draftData`へ保存する。
- filenameは対応metadataの`name`だけに保存する。
- canonical payloadは`{ subtype, schemaId, content }`とする。
- YamlDB v1はfrozenかつnon-authoritativeなlegacy recovery sourceであり、cacheまたはdual-write先ではない。

CoreDBとYamlDBは別IndexedDBであるため、CoreDB migrationとYamlDB inventory/recoveryは別atomic boundaryとする。missing name、空schema ID、unknown tuple、conflictはerrorとし、plugin側で推測または補完しない。

### 現行legacy entity shape

全consumerを協調してcutoverするcanonical writer / CoreDB migration Issueが完了するまで、sourceは次のlegacy型を使用する。これは現行コードの説明であり、正規storage契約を上書きしない。

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

canonical writerは`name`を対応metadata slotへ移し、registryで検証した明示的な`subtype`を追加し、不完全または不一致なrecordを保存前に拒否しなければならない。

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
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — legacy YamlDB v1 recovery boundary（authoritative runtime storeではない）
- [`正規storage契約`](../../docs/yaml-plugin-ide-gsm-step4-spec.md) — CoreDB authority、migration、recovery、rollback規則

### 親プラグイン

- [`folder-plugin`](../folder-plugin/) — 基盤コンテナノード

## ライセンス

MIT

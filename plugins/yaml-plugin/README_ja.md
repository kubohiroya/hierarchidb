# @hierarchidb/yaml-plugin

最終更新: 2026-08-21

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

`PluginStepRegistry` ベースの既存3ステップウィザードを提供する。appがUI plugin load前に
`yamlIdeGsmStep4Enabled` runtimeをenabledとして注入した場合だけ、任意のIDE-GSM command stepを追加する。

| ステップ | ID | コンポーネント | 説明 | バリデーション |
| --- | --- | --- | --- | --- |
| 1 | `basic-info` | `YamlBasicInfoStep` | 名前の入力 | `name` が空でないこと |
| 2 | `schema-selection` | `YamlSchemaSelectionStep` | スキーマ ID の選択 | `schemaId` が選択されていること |
| 3 | `schema-editor` | `YamlSchemaEditorStep` | JSON Schema Form によるコンテンツ編集 | 常に有効（保存可能） |
| 4 | `ide-gsm-command` | `YamlIdeGsmCommandStep` | subtypeで許可されたIDE-GSM command実行 | 任意のUI-only action |

スキーマエディタは `@rjsf/core` + `@rjsf/mui` を使用し、選択されたスキーマに基づくフォーム UI を動的に生成する。
Step 4はappから注入されたruntime capabilityだけを読む。app config、environment variable、
credential、IndexedDB、localStorageを直接読まない。editor-only subtypeは実行可能commandなしとして表示し、
upstream blockedなSSH lifecycle commandは正規registryに存在しないため表示しない。

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

plugin manifestはstorage preloadを持たず、worker entryもYamlDBを初期化しない。runtime YAML persistenceはorigin coordinatorとCoreDB activationがcanonical-ready evidenceを公開した後のCoreDBだけが担う。

## Storage authority

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- committed filename / payload stateはCoreDB `TreeNode.metadata/data`へ保存する。
- draft filename / payload stateはCoreDB `TreeNode.draftMetadata/draftData`へ保存する。
- filenameは対応metadataの`name`だけに保存する。
- canonical payloadは`{ subtype, schemaId, content }`とする。
- YamlDB v1はfrozenかつnon-authoritativeなlegacy recovery sourceであり、cacheまたはdual-write先ではない。

CoreDBとYamlDBは別IndexedDBであるため、CoreDB migrationとYamlDB inventory/recoveryは別atomic boundaryとする。missing name、空schema ID、unknown tuple、conflictはerrorとし、plugin側で推測または補完しない。

### Dialog draft input

dialog編集中のUI draft fieldはpartialになり得る。

```typescript
// YamlFileNodeData (from @hierarchidb/yaml-api)
interface YamlFileNodeData {
  name: string;
  schemaId: string;
  content: string;  // YAML content as string
}

// Draft type for create/edit
type YamlDraft = Partial<YamlFileNodeData> & { subtype?: YamlSubtype };
```

永続化前に`TreeNodeUpdaterService`がexact writer inputを構築する。canonical writerは`name`を`draftMetadata.name`だけへ保存し、registryで検証した`{ subtype, schemaId, content }`を`draftData`だけへ保存する。不完全または不一致なrecordはwriteせず拒否する。

### Canonical writer

独立subpath `@hierarchidb/yaml-plugin/canonical-writer`は、exactなdialog write inputを検証し、caller注入のwrite portへatomic-shaped requestを1回だけ送る。filename / payload検証は`@hierarchidb/yaml-api/validation`だけへ委譲し、filenameは`draftMetadata.name`だけ、検証済み`{ subtype, schemaId, content }`は`draftData`へ設定する。requestの`onNameConflict`は`error`固定とし、validation failureまたはport failure時にretry、auto-rename、overwrite、legacy writer fallbackを行わない。

production `TreeNodeUpdaterService`はYAML dialogのsave / save-draftでこのwriterを呼び、1回のinternal CoreDB updateを実行する。generic CoreDB writeも完全なYAML postimageを検証するため、別mutation APIからlegacyまたはpartial payloadを保存できない。[canonical Step 4契約](../../docs/yaml-plugin-ide-gsm-step4-spec.md)を参照する。

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
├── canonical-writer/
│   ├── index.ts                              # Strict writer entry point
│   ├── writeYamlCanonicalDialogDraft.ts      # Strict validation and one port call
│   └── yamlCanonicalDialogWriterTypes.ts     # Public input/request/result types
├── icon/
│   ├── index.ts              # Icon entry point
│   └── YamlPluginIcon.tsx    # MUI Description icon
├── ui/
│   ├── index.ts              # UI entry point (step exports)
│   └── components/
│       ├── steps-provider.tsx # PluginStepRegistry registration (3 or 4 steps)
│       └── steps/
│           ├── YamlBasicInfoStep.tsx       # Basic info step
│           ├── YamlSchemaSelectionStep.tsx # Schema selection step
│           ├── YamlSchemaEditorStep.tsx    # Schema editor step (RJSF)
│           └── YamlIdeGsmCommandStep.tsx   # Optional Step 4 command UI
└── worker/
    └── index.ts                        # Worker-safe canonical writer export
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/yaml-plugin` | PluginManifest、YAML_NODE_TYPE、YAML_PLUGIN_ID |
| `@hierarchidb/yaml-plugin/ui` | UI コンポーネント（3 ステップ、任意のStep 4） |
| `@hierarchidb/yaml-plugin/icon` | YamlPluginIcon |
| `@hierarchidb/yaml-plugin/worker` | Worker-safe canonical writer export |
| `@hierarchidb/yaml-plugin/canonical-writer` | Strict canonical dialog writer |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/core-types`](../../packages/core-types/) — NodeType 等の共有型定義
- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — PluginManifest、PluginStepRegistry
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YamlFileNodeData 型定義
- [`正規storage契約`](../../docs/yaml-plugin-ide-gsm-step4-spec.md) — CoreDB authority、migration、recovery、rollback規則

### 親プラグイン

- [`folder-plugin`](../folder-plugin/) — 基盤コンテナノード

## ライセンス

MIT

# @hierarchidb/folder-plugin

最終更新: 2026-08-20

HierarchiDB のツリー構造における基本的なコンテナノードを提供するプラグイン。フォルダノードは階層的にさまざまな種類のノードを整理・格納するためのコンテナとして機能する。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `folder` |
| extends | なし（基盤プラグイン） |
| category | `core` |
| priority | `1000` |

folder-plugin は HierarchiDB プラグインシステムの基盤プラグインであり、他のプラグイン（spreadsheet-plugin、styler-plugin 等）が継承する親ノードタイプとなる。folder-plugin 自体は他のプラグインに依存しない。

## UI 層

### ダイアログ

folder-plugin の UI は `PluginStepRegistry` ベースのステップ登録方式を採用している。`FolderDialogHost` は非推奨（deprecated）であり、現在は null を返す。

ステップ登録は `src/ui/components/steps-provider.tsx` で行われ、以下の 2 つの nodeType に対してステップを提供する:

- **`folder`**: 空のステップ配列（基本情報は `@hierarchidb/ui-plugin-basic-info` が提供）
- **`folder-export`**: 5 ステップのエクスポートウィザード（後述）

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `FolderIcon` | 開閉状態に応じて `Folder` / `FolderOpen` アイコンを切り替える |
| `TagInput` | タグ入力 UI コンポーネント |
| `CategorySelector` | カテゴリ選択 UI コンポーネント |

### フォルダエクスポートウィザード

フォルダのコンテキストメニューからアクセスできる 5 ステップのエクスポートフロー:

1. **Purpose** — エクスポート目的の選択（`continuity` / `distribution`）
2. **Target Nodes** — 対象ノードの範囲（`all` / `shapeOnly`）
3. **Output Format** — 出力形式（continuity: `json` 固定、distribution: `pbf.zip` / `mvf`）
4. **Options** — distribution モード時のオプション（`minZoom`, `maxZoom`, `maxTileBytes`）
5. **Review** — 設定確認とエクスポート実行

### アイコン

```typescript
// Entry point: @hierarchidb/folder-plugin/icon
import { FolderPluginIcon } from '@hierarchidb/folder-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Folder` |
| Emoji | 📁 |
| カラー | `#c0eeff` |

## Worker 層

folder-plugin は **Worker レス設計** を採用している。フォルダノードのデータは CoreDB の `TreeNode` payload/draft に直接格納され、専用の Worker データベースや EntityHandler は存在しない。

Worker の `preload` 設定として `registerFolderWorkerStores` が登録されており、payload peer store の登録のみを行う。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerFolderWorkerStores'],
}
```

### ライフサイクル

フォルダの CRUD 操作は CoreDB TreeNode API を通じて行われる:

- **作成**: TreeNode の作成 + payload/draft への name/description 格納
- **更新**: TreeNode metadata の更新
- **削除**: TreeNode の削除（子ノードの存在確認あり）
- **移動/コピー**: TreeNode のツリー操作

## データベーススキーマ

folder-plugin は **専用の Dexie データベースを持たない**。

> かつて `FolderDatabase`（`hdb-folder-entities-db`）が存在したが、現在は廃止されている。フォルダのデータは CoreDB の `TreeNode` payload/draft のみが唯一の永続情報源である。

### データ構造

フォルダノードは `TreeNode` のエイリアスとして定義される:

```typescript
// FolderEntity is an alias for Core TreeNode
type FolderEntity = TreeNode;

// Peer data stored in TreeNode payload
interface FolderPeerData {
  schemaVersion: 1;
  domain: Record<string, unknown>;
}
```

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: []
```

folder-plugin は他のプラグインに依存しない。逆に、多くのプラグインが folder-plugin を基盤として継承する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: true,   // child nodes allowed
  canBeRoot: true,         // can be a root node
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
  ],
}
```

### バリデーション定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `NAME_MIN_LENGTH` | 1 | 名前の最小文字数 |
| `NAME_MAX_LENGTH` | 255 | 名前の最大文字数 |
| `DESCRIPTION_MAX_LENGTH` | 1000 | 説明の最大文字数 |
| `MAX_TAGS` | 10 | タグの最大数 |
| `MAX_TAG_LENGTH` | 50 | タグの最大文字数 |
| `MAX_DEPTH` | 20 | 最大階層深度 |
| `MAX_CHILDREN_DEFAULT` | 1000 | デフォルトの最大子ノード数 |

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `folder-plugin` |
| ロケール | `en`, `ja` |

## 使用例

### PluginManifest の参照

```typescript
import { FolderPluginManifest } from '@hierarchidb/folder-plugin';

console.log(FolderPluginManifest.nodeType); // 'folder'
console.log(FolderPluginManifest.capabilities.canHaveChildren); // true
```

### FolderIcon の使用

```tsx
import { FolderIcon } from '@hierarchidb/folder-plugin/ui';

// Closed folder
<FolderIcon />

// Open folder
<FolderIcon open={true} />
```

## Legacy YAML snapshot boundary

現行の`exportYamlNodesToSnapshot`と`importYamlNodesFromSnapshot` helperはlegacyかつnon-canonicalな実装である。exportは`data.name`を読み、importは空schema IDを持つYamlDB-only rowを逐次writeし、authoritativeなCoreDB `TreeNode`を作成しない。後続writeが失敗するとYamlDBに部分rowが残り得る。

これらをcanonical IDE-GSM snapshot pathまたはStep 4 runtime dependencyとして使用してはならない。cutoverはCoreDB migration成功までblockedとし、その後の別Issueで全entry preflightとnode / parent更新を含むCoreDB単一transactionを実装する。[正規YAML storage契約](../../docs/yaml-plugin-ide-gsm-step4-spec.md)と[legacy YamlDB boundary](../../packages/yaml-store/README_ja.md)を参照する。

## ディレクトリ構成

```text
src/
├── index.ts                  # Root entry point (types + manifest + YAML utilities)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── locales/              # i18n resources (en, ja)
│   ├── shared/
│   │   ├── folderValidation.ts   # Name/data validation
│   │   ├── yamlFolderExport.ts   # YAML snapshot export
│   │   └── yamlFolderImport.ts   # YAML snapshot import
│   └── types/
│       ├── constants.ts      # Validation/display constants
│       ├── FolderEntity.ts   # FolderEntity type (TreeNode alias)
│       ├── metadata.ts       # Plugin metadata
│       └── types.ts          # CreateFolderData, UpdateFolderData, FolderPeerData
├── icon/
│   └── index.ts              # FolderPluginIcon (re-export of MUI Folder)
└── ui/
    ├── FolderDialogHost.tsx   # Deprecated dialog host (returns null)
    ├── index.ts               # UI entry point
    └── components/
        ├── CategorySelector.tsx
        ├── FolderIcon.tsx     # Open/closed folder icon
        ├── TagInput.tsx
        ├── steps-provider.tsx # PluginStepRegistry registration
        └── folder-export/    # 5-step export wizard components
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/folder-plugin` | 型定義、PluginManifest、YAML ユーティリティ |
| `@hierarchidb/folder-plugin/ui` | UI コンポーネント（FolderDialogHost、ステップ登録） |
| `@hierarchidb/folder-plugin/icon` | FolderPluginIcon |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/tree-api`](../../packages/tree-api/) — TreeNode 型定義
- [`@hierarchidb/tag-api`](../../packages/tag-api/) — TagId、TagSuggestion 型
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YAML ノード型定義
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — Legacy YamlDB recovery boundary
- [`@hierarchidb/util`](../../packages/util/) — generateId 等のユーティリティ
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/plugin-service-api`](../../packages/plugin-service-api/) — プラグインサービス API
- [`@hierarchidb/components`](../../packages/components/) — 共有 UI コンポーネント（notify 等）
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — ダイアログ基盤
- [`@hierarchidb/ui-plugin-basic-info`](../../packages/ui/plugin-basic-info/) — プラグイン基本情報ステップ

### folder-plugin を継承するプラグイン

- [`spreadsheet-plugin`](../spreadsheet-plugin/) — CSV/TSV/Excel ソース管理
- [`styler-plugin`](../styler-plugin/) — スタイル定義・Map スタイル適用
- [`linker-plugin`](../linker-plugin/) — プロジェクト領域管理

## ライセンス

MIT

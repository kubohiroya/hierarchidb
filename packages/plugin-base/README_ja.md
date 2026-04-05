# @hierarchidb/plugin-base

最終更新: 2026-04-05

HierarchiDB プラグインシステムの基盤パッケージ。プラグインマニフェスト型定義、ステップレジストリ、ダイアログオーケストレーション、ライフサイクルフック等の共通インターフェースを提供する。全プラグインがこのパッケージに依存する。

## 主要な機能

- `PluginManifest` — プラグインのメタデータ・capabilities・スキーマ・Worker 設定を定義する型
- `PluginStepRegistry` — マルチステップダイアログのステップ登録・取得を管理するシングルトンレジストリ
- `HostProfileRegistry` — ホストプロファイル（ダイアログホスト環境）の登録
- `composeStepConfigs` — 複数ステップ設定の合成ユーティリティ
- `draftAtoms` — jotai ベースのドラフト状態管理 atom
- ライフサイクルフック型（`EntityLifecycleHooks`）
- 検索条件型（`BaseSearchCriteria`）

## インストール

```jsonc
// package.json (pnpm workspace)
"peerDependencies": {
  "@hierarchidb/plugin-base": "workspace:*"
}
```

## 公開 API

### PluginManifest

プラグインの全設定を定義する中心的な型:

```typescript
interface PluginManifest {
  id?: string;
  name?: string;
  displayName?: string;
  nodeType?: NodeType;
  version?: string;
  extends?: string;
  dependencies?: string[];
  icon?: PluginIconConfig;
  category?: PluginCategoryConfig;
  capabilities?: PluginCapabilities;
  schema?: PluginManifestSchema;
  worker?: { preload?: string[] } | null;
  database?: PluginManifestDatabaseConfig | null;
  // ... and more
}
```

### PluginStepRegistry

マルチステップダイアログのステップを登録・取得するシングルトン:

```typescript
import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { PluginStepConfig, PluginStepProps } from '@hierarchidb/plugin-base';

const registry = PluginStepRegistry.getInstance();

// Register steps for a nodeType
registry.registerConfigProvider({
  nodeType: 'my-plugin' as NodeType,
  getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<MyDraft>> {
    return [
      {
        id: 'step-1',
        label: 'Step 1',
        componentFactory: (props: PluginStepProps<MyDraft>) => <MyStep {...props} />,
        validate: (data) => Boolean(data?.name),
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
```

### PluginCapabilities

```typescript
interface PluginCapabilities {
  canHaveChildren?: boolean;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  canBeCopied?: boolean;
  supportsBuildProcessing?: boolean;
  draft?: boolean;
  [key: string]: boolean | undefined;
}
```

## 依存関係

| パッケージ | 種別 | 用途 |
| --- | --- | --- |
| `@hierarchidb/core-types` | peer | NodeType 等の ID 型 |
| `@hierarchidb/ui-dialog` | peer | ダイアログ基盤型 |
| `jotai` | peer | ドラフト atom |
| `react` | peer | コンポーネントファクトリ |

## ディレクトリ構成

```text
src/
├── index.ts                          # Public API exports
├── atoms/
│   └── draftAtoms.ts                 # Jotai draft state atoms
├── registry/
│   ├── DialogStepLocalizationRegistry.ts  # Step label i18n registry
│   ├── HostProfileRegistry.ts        # Host profile registry
│   └── PluginStepRegistry.ts         # Step config registry (singleton)
├── services/
│   └── composeStepConfigs.ts         # Step config composition utility
└── types/
    ├── api-types.ts                  # API type definitions
    ├── BaseSearchCriteria.ts         # Search criteria base type
    ├── EntityLifecycleHooks.ts       # Entity lifecycle hook types
    ├── plugin-definition.ts          # Plugin definition types
    ├── plugin-manifest.ts            # PluginManifest, PluginCapabilities, etc.
    ├── plugin-metadata.ts            # Plugin metadata types
    ├── PluginDBQueryAPI.ts           # DB query API types
    ├── PluginExtensionAPI.ts         # Extension API types
    ├── PluginLifecycleAPI.ts         # Lifecycle API types
    ├── PluginTreeAPI.ts              # Tree API types
    └── registry.ts                   # Registry types
```

## 関連パッケージ

- [`@hierarchidb/core-types`](../core-types/) — 共有型定義（NodeType 等）
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — ダイアログ基盤
- [`@hierarchidb/plugin-registry`](../plugin-registry/) — プラグイン登録・解決
- [`@hierarchidb/plugin-ui-sdk`](../plugin-ui-sdk/) — プラグイン UI SDK
- 全プラグインが本パッケージに依存

## ライセンス

MIT

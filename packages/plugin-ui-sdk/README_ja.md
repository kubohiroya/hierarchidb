# @hierarchidb/plugin-ui-sdk

最終更新: 2026-04-05

HierarchiDB プラグイン UI 開発のための SDK パッケージ。プラグインダイアログのステップコンポーネント開発に必要なフック・ユーティリティを提供する。

## 主要な機能

- `useTreeNodeUpdater` — TreeNode の payload/draft を読み書きするフック（dirty 検出、バリデーション連携）
- `useSingleSourceDialogAtom` — jotai atom を単一ソースとするダイアログデータ管理フック
- `useDialogViewState` — ダイアログの表示状態（ローディング、エラー等）管理フック
- `createTreeNodeUpdaterActions` — TreeNode 更新アクションの生成ユーティリティ
- `wrapDialogStepComponent` — ダイアログステップコンポーネントのラッパー

## 公開 API

```typescript
import {
  useTreeNodeUpdater,
  useSingleSourceDialogAtom,
  useDialogViewState,
  createTreeNodeUpdaterActions,
  wrapDialogStepComponent,
} from '@hierarchidb/plugin-ui-sdk';
```

### useTreeNodeUpdater

```typescript
const { data, isDirty, updateField, save, reset } = useTreeNodeUpdater<MyDraft>({
  nodeId,
  nodeType: 'my-plugin',
});
```

### useSingleSourceDialogAtom

```typescript
const { value, setValue, isDirty } = useSingleSourceDialogAtom<MyDraft>({
  atom: myDraftAtom,
  initialValue: defaultDraft,
});
```

## 依存関係

| パッケージ | 用途 |
| --- | --- |
| `@hierarchidb/core-types` | NodeId、NodeType |
| `@hierarchidb/tree-api` | TreeNode 型 |
| `@hierarchidb/worker-api` | Worker API |
| `@hierarchidb/ui-worker-provider` | Worker クライアント |
| `@hierarchidb/ui-dialog` | ダイアログ基盤 |
| `@hierarchidb/plugin-service-api` | プラグインサービス API |
| `jotai` | 状態管理 |

## 関連パッケージ

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginStepRegistry（ステップ登録先）
- [`@hierarchidb/plugin-ui-host`](../plugin-ui-host/) — ダイアログホスト
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — ダイアログ基盤

## ライセンス

MIT

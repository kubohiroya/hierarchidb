# @hierarchidb/plugin-ui-sdk

## Purpose (Inner logic)
- Shared **inside-the-dialog** utilities: `useTreeNodeUpdater`, Basic Info normalization, common hooks/components used by dialog hosts.
- Field-level helpers and form logic that multiple plugin dialogs reuse.

## Boundaries
- Does **not** own the dialog shell or step navigation — those belong to `@hierarchidb/plugin-ui-host`.
- Keep presentation/icon lookup out of here; use `@hierarchidb/plugin-presentation` from host or app layer.

## When to use
- Implementing plugin dialogs and steps that need draft state wiring, basic info handling, or reusable form helpers.
- Sharing common UI logic across plugin dialog hosts without duplicating code.

## Avoid
- Shell/step-navigation concerns (keep them in `plugin-ui-host`).
- Plugin-specific one-off components that should live in the plugin package itself.

## Single-Source Dialog State (useSingleSourceDialogAtom)
Dialog dataの正を TreeNodeUpdater に一本化し、ステップ内ローカルや jotai 多重管理による更新ループを避けるためのフックです。

### 使い方（最小例）
```tsx
import { useSingleSourceDialogAtom } from '@hierarchidb/plugin-ui-sdk';
import { Provider, useAtom, useSetAtom } from 'jotai';

function SpreadsheetStep({ nodeId, treeId, nodeType }: Props) {
  const { store, draftAtom, metadataAtom, setDraft, setMetadata, commit, discard } =
    useSingleSourceDialogAtom<SpreadsheetEntity>({
      mode: 'edit',
      nodeId,
      nodeType,
      treeId,
      workerClient, // WorkerProvider から取得
    });

  // jotai atoms は Provider 経由で配下に渡す
  return (
    <Provider store={store}>
      <StepContent
        draftAtom={draftAtom}
        metadataAtom={metadataAtom}
        onCommit={commit}
        onDiscard={discard}
      />
    </Provider>
  );
}

function StepContent({ draftAtom, metadataAtom, onCommit }: {
  draftAtom: Parameters<typeof useAtom>[0];
  metadataAtom: Parameters<typeof useAtom>[0];
  onCommit: () => Promise<unknown>;
}) {
  const [draft, setDraftLocal] = useAtom(draftAtom);
  const [meta] = useAtom(metadataAtom);
  const setDraftUpstream = useSetAtom(draftAtom); // 同値ガード付きで upstream に反映

  const handleNameChange = (name: string) => {
    setDraftUpstream((prev) => ({ ...prev, name }));
  };

  return (
    <>
      <input value={meta.name} onChange={(e) => handleNameChange(e.target.value)} />
      <button onClick={() => onCommit()}>Save</button>
    </>
  );
}
```

### 設計メモ
- TreeNodeUpdater の draftData/draftMetadata を単一ソースとし、同値ガードで不要な setState をスキップします。
- jotai store は hook 内で生成・共有し、`Provider store={store}` で配下に渡します。
- `setDraft`/`setMetadata` は immer なしの浅い同値判定で参照を安定化し、更新ループを防ぎます。
- commit/discard は既存の useTreeNodeUpdater をラップして提供します。

### 適用範囲
- Tabular 系ステップ（Spreadsheet/Location/Timeline 等）、Basic Info + 個別ステップで TreeNodeUpdater を正にしたい場合。
- MultiStepDialog 配下で jotai state を使う際の入り口として利用し、ステップ内ローカル state は一時バッファに限定する運用を推奨します。

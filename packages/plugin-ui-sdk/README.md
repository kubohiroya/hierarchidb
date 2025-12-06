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

## Plugin dialog implementation guidelines
- **単一ソースの徹底**: draftData / draftMetadata を TreeNodeUpdater に集約し、ステップ内ローカル state は一時入力バッファにとどめる。`useSingleSourceDialogAtom` を入口にする。
- **同値ガード**: `setDraft` / `setMetadata` は浅い同値判定を必ず通し、同じ参照や構造を再代入しない。useEffect は依存配列＋同値チェックをセットで記述する。
- **Commit / Save Draft の意味**:  
  - Save: metadata ← draftMetadata のコピー、data ← draftData のコピー、draft* は null にリセット。  
  - Save Draft: metadata ← draftMetadata のコピー、draftMetadata は null、draft/draftData は維持。
- **入出力タイミングの明示**: フォーム入力は onChange でローカル更新、onBlur/Enter など確定操作で upstream draft に反映する。逐次 setState でフォーカスを失わないようにする。
- **ステップ遷移時のハンドオフ**: ステップ enter/exit で必要な同期を 1 箇所に集約し、副作用の揺れを最小化する。URL / view mode 同期も「ユーザー操作起点＋同値チェック」で扱う。
- **react-table 等の再計算抑止**: pagination や autoReset* が連続で走ると更新ループを誘発するため、manual モードや必要最小限のリセットに絞る。
- **焦点喪失対策（Tabular フォーム）**: 入力フィールドには安定した key を与え、同値ガード付きの onChange/upstream 反映と組み合わせて再レンダリングによる focus ロスを防ぐ。

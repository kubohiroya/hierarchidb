# Plugin Entity/Dialog 命名・型設計ガイド（TreeNodeUpdater 基軸）

本ドキュメントは、プラグイン固有のエンティティ・ダイアログ型を **PluginNameEntity** を中心に統一し、Working Copy/ダイアログ更新を `TreeNodeUpdaterPayload<T>` / `TreeNodeUpdaterState<T>`（既存の共通型）に集約するための方針と手順をまとめる。プラグインホストが共通コードとして再利用でき、各プラグインで重複実装しなくて済むことを目的とする。新規プラグイン開発および既存コードのリファクタリング時に必ず参照すること。

## 現状の課題（抜粋）
- 型・命名のバラツキ: `BaseMapDraftPayload` / `SpreadsheetDialogData` / `StylerDialogData` / `LocationDraft` など、エンティティとダイアログ専用型が混在し、`draft` ネストや `metadata` 埋め込みがまちまち。
- 共通型の重複定義: `TreeNodeUpdaterPayload` が `@hierarchidb/common-types` と `plugin-ui-host` 双方で定義され、UI/Worker 間の契約が読みづらい。
- 責務境界の不明瞭さ: ダイアログ側が name/description/tags を `draftData` に入れたり、UI 一時状態を Entity/PeerData に混入させるケースがある。
- 参照箇所の分散: basemap/location/spreadsheet/styler それぞれで `DialogData` / `DialogState` / `PeerData` が別ファイル・別命名で存在し、共通ガイドがなく移行のコストが高い。

## 目指す型構成と命名
- **フィールド命名の統一**: `TreeNodeUpdaterPayload` でも `TreeNodeUpdaterState` でも主キーは `treeNodeId` に揃える（従来の `id` は廃止）。UI/Worker 間で同じキー名を使い、意味の揺れを無くす。
- **部分更新型の名称**: パッチ用の差分型は `TreeNodeUpdaterPatch<T>`（旧 `TreeNodeUpdatePayload`）に一本化し、`draftMetadata?` / `draftData?` をオプションで受ける。
- **PluginNameEntity**: プラグイン固有の永続データ構造。`plugins/<plugin>/src/common/entities/<PluginName>Entity.ts` に定義する。
- **PluginNamePeerData**: Peer store（永続補助データ）が必要な場合のみ定義。`schemaVersion` を含め、UI 一時状態は含めない。
- **Working Copy / ダイアログ更新**: `TreeNodeUpdaterPayload<PluginNameEntity>` を単一のドラフト型として使用し、name/description/tags は `draftMetadata`、プラグイン固有フィールドは `draftData: Partial<PluginNameEntity>` に限定する。UI 側は `TreeNodeUpdaterState<PluginNameEntity>`（`useTreeNodeUpdater` の返却型）で扱う。
  - ダイアログは `updateTreeNodeUpdater` / `commitTreeNodeUpdater` / `discardDraft` を `useTreeNodeUpdater<PluginNameEntity>` 経由で利用し、独自の `DialogState` 型を作らない。
- **PluginNameDialog**: ステッパーを含むダイアログホスト。`useTreeNodeUpdater<PluginNameEntity>` を使い、各 StepComponent へ `draftData`（`Partial<PluginNameEntity>`）のみを渡す。基本情報はホストが `draftMetadata` として管理する。
- **命名テーブル（推奨）**
  - 永続: `PluginNameEntity`
  - Peer: `PluginNamePeerData`
  - ダイアログコンポーネント: `PluginNameDialog`（HeadlessPluginDialog を内包）
  - ステップ設定: `pluginNameStepConfigs` / `PluginNameSteps`
  - 初期値: `create<PluginName>Draft()`（`TreeNodeUpdaterPayload<PluginNameEntity>` を返すヘルパー）

## 実装ガイドライン（新規プラグイン）
1) **エンティティ定義**  
`plugins/<plugin>/src/common/entities/<PluginName>Entity.ts` に永続データ型を定義する。UI 専用フィールドやダイアログ状態は含めない。
```ts
export interface BaseMapEntity {
  mapStyle: MapStyle;
  viewport?: MapViewport;
}
```

2) **Working Copy 初期化**  
Worker 側で `TreeNodeUpdaterPayload<BaseMapEntity>` を生成するヘルパーを用意し、初期 draftData は `Partial<BaseMapEntity>` に限定する。
```ts
export const createBaseMapDraft = (): TreeNodeUpdaterPayload<BaseMapEntity> => ({
  treeNodeId: '' as NodeId, // will be replaced by initTreeNode
  draftMetadata: { name: '', description: '', tags: [] },
  draftData: { mapStyle: { style: 'streets' } },
});
```

3) **ダイアログホスト**  
`PluginNameDialog` で `useTreeNodeUpdater<PluginNameEntity>` を使用し、`draftMetadata`（基本情報）と `draftData`（プラグイン固有フィールド）を明確に分ける。
```tsx
const BaseMapDialog: FC<PluginDialogProps> = ({ nodeType, parentId, onClose }) => {
  const {
    treeNodeUpdater,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
  } = useTreeNodeUpdater<BaseMapEntity>({ mode: 'create', nodeType, parentId });

  const handleStyleChange = (next: Partial<BaseMapEntity>) =>
    updateTreeNodeUpdater({ draftData: next });

  const handleSave = async () => {
    const nodeId = await commitTreeNodeUpdater();
    onClose?.(nodeId);
  };
  // ...pass draftData to steps/components
};
```

4) **Step コンポーネント**  
Step には `Partial<PluginNameEntity>` のみを渡し、必要に応じて `merge` した上で `updateTreeNodeUpdater` を呼ぶ。name/description/tags は基本情報ステップが `draftMetadata` として管理する。

## 既存コードからの移行計画
- **Phase 0: 互換整理**  
  - `plugin-ui-host` 側の重複型を撤去し、`@hierarchidb/common-types` が提供する `TreeNodeUpdaterPayload` / `TreeNodeUpdaterState` へ一本化する。
  - `TreeNodeUpdaterPayload` の `id` を `treeNodeId` にリネームし、`TreeNodeUpdaterState` も同名フィールドで揃える。パッチ型は `TreeNodeUpdaterPatch<T>` 名に切り替える。
- **Phase 1: 実態棚卸し**  
  - `rg "DialogData|DialogState|WorkingCopy|draft"` を用い、basemap/location/spreadsheet/styler など主要プラグインの命名とデータ構造をリストアップする。
  - `TASKS.md` にプラグインごとの移行サブタスクを追加し、依存関係と優先度を明示する。
- **Phase 2: 型統合**  
  - 各プラグインで `PluginNameEntity` を基点に `TreeNodeUpdaterPayload<PluginNameEntity>` に収束させる。`metadata` はホスト（basic info）へ移し、`draft` ネストや UI 専用フィールドを除去。
  - `plugin-ui-host` / `plugin-ui-sdk` 側は `@hierarchidb/common-types` の `TreeNodeUpdaterPayload` を唯一の契約とし、ローカル定義を削除。
- **Phase 3: ダイアログ実装の統一**  
  - すべての `PluginNameDialog` が `useTreeNodeUpdater<PluginNameEntity>` を使用するように置き換え、`DialogData` / `DialogState` などの冗長型を alias 経由で段階的に削除。
  - Step バリデーション/シリアライズは `Partial<PluginNameEntity>` を前提に再整理する。
- **Phase 4: クリーニング & バリデーション**  
  - 残存する旧名称の type import を `TreeNodeUpdater*` へ置換し、`rg "DialogData|DialogState"` が残らないことを確認。
  - テスト/型チェック: `pnpm lint && pnpm typecheck`、必要に応じて `pnpm --filter @hierarchidb/<plugin> test` を実行し、`TASKS.md` 運用ログに結果を記録。
- **Phase 5: ドキュメント更新**  
  - 本ガイドと `docs/plugins/working-copy-baseline.md` / `docs/workingcopy-dialog-hosting.md` の整合性を再確認し、差分があれば反映する。

## ロールバック指針と検証
- ロールバック: 本ガイドに従って加えた型/命名変更は個別コミットで管理し、必要に応じて該当コミットを revert。エイリアス導入で広範囲に影響する場合は feature flag ではなく段階的ブランチで統制する。
- 検証コマンド（例）:
  - `pnpm lint && pnpm typecheck`
  - `pnpm --filter @hierarchidb/<plugin> typecheck`
  - `pnpm --filter @hierarchidb/plugin-ui-host test`
- 失敗時は `TASKS.md` の運用ログにコマンド・終了コード・要約を記載し、必要ならエイリアス導入前の状態へ戻す。

## 関連ドキュメント
- `docs/plugins/working-copy-baseline.md` — Working Copy の基本方針。
- `docs/workingcopy-dialog-hosting.md` — ダイアログホスト責務とレジストリ連携。
- `packages/common/types/src/tree-node-batch-types.ts` — `TreeNodeUpdaterPayload` などの共通型。

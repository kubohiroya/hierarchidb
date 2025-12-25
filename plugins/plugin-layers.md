# プラグイン層アーキテクチャ図（2025-12-07 更新）

TreeNodeUpdaterAPI / useTreeNodeUpdater / useSingleSourceDialogAtom への一本化を踏まえ、プラグイン間で共通化すべき層と接続点を整理します。

## 凡例（共通の 6 層）
- 🟥 UI ホスト: app shell + plugin-ui-host（HeadlessPluginDialog）
- 🟧 UI プラグイン: ダイアログ/ステップ/アイコン（useTreeNodeUpdater + TreeNodeUpdaterAPI）
- 🟨 Worker 共通: runtime-worker bootstrap（wirePluginsFromModules, DraftService, Query/Mutation/Subscription）
- 🟩 Worker ドメイン: EntityHandler / BatchManager / Lifecycle
- 🟦 Worker Dexie: プラグイン専用スキーマ/ストア
- 🟪 Stage Worker: 孫Worker（バッチ/タイル/処理系）

## 共通リファレンスフロー
```
🟥 UI host (HeadlessPluginDialog)
   └─ useTreeNodeUpdater (TreeNodeUpdaterAPI)
      ├ updateTreeNodeDraftMetadata
      ├ updateTreeNodeDraftData
      └ commitDraft / discardDraft
🟨 runtime-worker DraftService (TreeNodeUpdaterAPI impl)
   └─ CoreDB.nodes draftMetadata/draftData マージ
🟧 UI Single Source: useSingleSourceDialogAtom/useTreeNodeDialog(useSingleSource) が TreeNodeUpdater を唯一の正とする jotai store を提供
🟩 EntityHandler / BatchManager
   └─ QueryAPI / MutationAPI / StageProcessingFacade を利用
🟦 Dexie schema
🟪 Stage worker (必要な場合のみ)
```

## プラグイン別の接続状況（2025-12-07 時点）
- **linker / location / shape / styler / timeline / resolver / route / basemap / spreadsheet**: いずれも TreeNodeUpdater + draftMetadata/draftData 経路に統一済み（working copy 用語は撤廃）。
- **UI 層の推奨**: `useSingleSourceDialogAtom` または `useTreeNodeDialog` の `useSingleSource` オプションで jotai store を一元化し、同値ガードでループを防止する。
- **Stage worker**: バッチ/タイル等が必要な場合のみ孫 Worker を立て、必ず Facade/Comlink 経由で呼び出す（不要なら省略）。
- **残課題が出た場合の方針**: 既存の TreeNodeUpdaterAPI パイプラインを壊さず、draftData/draftMetadata を唯一の正とする。個別プラグインでのローカル state 二重管理は避ける。

## 理想的な層構成（全プラグイン共通の型）
```
🟥 App Shell / RuntimeWiring
   └─ PluginDefinition → plugin-registry → UI/Worker エントリ解決
🟧 UI Plugin (useTreeNodeUpdater + TreeNodeUpdaterAPI)
   └─ Step onUpdate → draftMetadata/draftData にマージ
   └─ useSingleSourceDialogAtom / useTreeNodeDialog(useSingleSource) で jotai store を単一ソースに
🟨 runtime-worker bootstrap (wirePluginsFromModules)
   └─ registerRuntimeExports({ createEntityHandler, lifecycle, batch? })
🟩 Plugin Worker Services (EntityHandler / BatchManager)
   └─ Query/Mutation/Subscription API, StageProcessingFacade を利用
🟦 Dexie schema (Group/Relation store only; PeerStore廃止)
🟪 Stage worker (必要時のみ Comlink.expose)
```

## 実装チェックリスト
- UI: useTreeNodeUpdater／useSingleSourceDialogAtom 経由で TreeNodeUpdaterAPI の update/commit を呼んでいるか（ローカル state 二重管理なし）
- Worker: DraftService (TreeNodeUpdaterAPI) 経由で draftMetadata/draftData をマージしているか
- Export: plugin-registry で UI/Worker/Icon/DB entry を登録しているか
- Stage worker: 孫Workerが必要な場合のみ Facade を経由させ、直接 import しない
- 用語: working copy / DraftAPI は使用しない。draftMetadata/draftData / TreeNodeUpdaterAPI に統一

# プラグイン層アーキテクチャ図（2025-12 更新）

TreeNodeUpdaterAPI / useDialogDraft への一本化を踏まえ、プラグイン間で共通化すべき層と接続点を整理します。

## 凡例（共通の 6 層）
- 🟥 UI ホスト: app shell + plugin-ui-host（HeadlessMultiStepDialog）
- 🟧 UI プラグイン: ダイアログ/ステップ/アイコン（useDialogDraft + TreeNodeUpdaterAPI）
- 🟨 Worker 共通: runtime-worker bootstrap（wirePluginsFromModules, DraftService, Query/Mutation/Subscription）
- 🟩 Worker ドメイン: EntityHandler / BatchManager / Lifecycle
- 🟦 Worker Dexie: プラグイン専用スキーマ/ストア
- 🟪 Stage Worker: 孫Worker（バッチ/タイル/処理系）

## 共通リファレンスフロー
```
🟥 UI host (HeadlessMultiStepDialog)
   └─ useDialogDraft (TreeNodeUpdaterAPI)
      ├ updateTreeNodeDraftMetadata
      ├ updateTreeNodeDraftData
      └ commitDraft / discardDraft
🟨 runtime-worker DraftService (TreeNodeUpdaterAPI impl)
   └─ CoreDB.nodes draftMetadata/draftData マージ
🟩 EntityHandler / BatchManager
   └─ QueryAPI / MutationAPI / StageProcessingFacade を利用
🟦 Dexie schema
🟪 Stage worker (必要な場合のみ)
```

## プラグイン別の接続状況と次アクション
- **linker (🟧未実装)**: ダイアログ追加時は useDialogDraft + TreeNodeUpdaterAPI を必須化し、draftMetadata/draftData を唯一の経路にする。Stage worker は不要ならスキップ。
- **location (部分的)**: 独自更新をやめ、MultiStep 化して onUpdate→useDialogDraft→updateTreeNodeDraftData/Metadata に統一。進捗/プレビューも draftData から描画。
- **shape (legacy doc)**: WorkingCopy 表記を削除し、TreeNodeUpdater 用語に置換。UI/Worker を useDialogDraft + DraftService 経路へリプレース。stageWorker 呼び出しも Facade 経由に整理。
- **styler (未マルチステップ)**: ダイアログ導入時に useDialogDraft を先に組み込み、スタイル一時データを draftData に集約。commit は TreeNodeUpdaterAPI 経由。プレビューもドラフトから参照。
- **timeline (未導入)**: 実装開始時に TreeNodeUpdaterAPI を前提としたダイアログ骨格を用意し、ファイル取込/プレビューを draftData ベースにする。
- **resolver/route/basemap/spreadsheet**: 既に draftMetadata/draftData 経路で統一済み。維持。

## 理想的な層構成（全プラグイン共通の型）
```
🟥 App Shell / RuntimeWiring
   └─ PluginDefinition → plugin-registry → UI/Worker エントリ解決
🟧 UI Plugin (useDialogDraft + TreeNodeUpdaterAPI)
   └─ Step onUpdate → draftMetadata/draftData にマージ
🟨 runtime-worker bootstrap (wirePluginsFromModules)
   └─ registerRuntimeExports({ createEntityHandler, lifecycle, batch? })
🟩 Plugin Worker Services (EntityHandler / BatchManager)
   └─ Query/Mutation/Subscription API, StageProcessingFacade を利用
🟦 Dexie schema (storeRegistry.registerPeer)
🟪 Stage worker (必要時のみ Comlink.expose)
```

## 実装チェックリスト
- UI: useDialogDraft 経由で TreeNodeUpdaterAPI の update/commit を呼んでいるか
- Worker: DraftService( TreeNodeUpdaterAPI ) 経由で draftMetadata/draftData をマージしているか
- Export: plugin-registry で UI/Worker/Icon/DB entry を登録しているか
- Stage worker: 孫Workerが必要な場合のみ Facade を経由させ、直接 import しない
- 用語: working copy / DraftAPI は使用しない。draftMetadata/draftData / TreeNodeUpdaterAPI に統一

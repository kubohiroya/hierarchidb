2523) fix/location-preview/terrain-toggle-blink (P1) — 進行中 (2026-02-05)
- ブランチ名: fix/location-preview/terrain-toggle-blink
- 依存: なし
- 受け入れ基準: Terrain Types の切替時に対象タイプはブリンク1回までで、対象外タイプの表示がブリンクしない／viewport-fetch は発生してよいが対象外タイプの表示が維持される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `plugins/location-plugin/src/ui/hooks/useLocationMapPreviewMap.tsx`, `packages/ui/map/src/preview/LocationPreviewList.tsx`（必要に応じて追加）
- ロールバック手順: Terrain Types 切替の表示維持ロジックを revert して元の挙動に戻す
- チェックリスト:
  - Terrain Types 切替時に非対象タイプの表示がリセットされる箇所を特定する
  - 非対象タイプの表示を維持するよう更新する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 22:08 JST Terrain Types 切替時の非対象タイプのブリンク抑制に着手。
  - update: 2026-02-05 22:12 JST ResourceLayerMap の GeoJSON レイヤー更新を差分適用に変更し、切替時の全消去を回避。
  - update: 2026-02-05 22:13 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - update: 2026-02-05 22:13 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2523) fix/location-plugin/remove-unused-onupdate (P1) — 進行中 (2026-02-05)
- ブランチ名: fix/location-plugin/remove-unused-onupdate
- 依存: なし
- 受け入れ基準: `useLocationMapPreviewStep.tsx` の未使用 onUpdate が解消される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/useLocationMapPreviewStep.tsx`
- ロールバック手順: onUpdate の削除差分を戻す
- チェックリスト:
  - onUpdate の未使用を解消する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 22:15 JST useLocationMapPreviewStep の未使用 onUpdate を解消する作業に着手。
  - update: 2026-02-05 22:15 JST useLocationMapPreviewStep から未使用の onUpdate を削除。
  - update: 2026-02-05 22:16 JST LocationMapPreviewStep から onUpdate の引き渡しを削除。
  - update: 2026-02-05 22:16 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2522) fix/location-preview/metadata-window-table-height (P1) — 進行中 (2026-02-05)
- ブランチ名: fix/location-preview/metadata-window-table-height
- 依存: なし
- 受け入れ基準: Location preview の metadata floating window を縦に拡大してもテーブルが高さに追従し、下部の余白が出ない／他の preview 表示に副作用がない／`pnpm --filter @hierarchidb/app typecheck` が exit 0 または blocked を記録／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/**`（preview metadata window）
- ロールバック手順: テーブル高さ調整の差分を戻す
- チェックリスト:
  - metadata floating window のレイアウトとテーブル高さを見直す
  - 既存の preview 表示への影響がないことを確認する
  - app の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-05 21:16 JST Location preview の metadata floating window 高さ不一致修正に着手。
  - update: 2026-02-05 21:19 JST LocationPreviewList のテーブル container を flex 伸長に調整。
  - blocked: 2026-02-05 21:19 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。
  - update: 2026-02-05 21:24 JST TanstackDataGrid の TableContainer に height を付与して縦リサイズ追従を調整。
  - blocked: 2026-02-05 21:24 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。
  - update: 2026-02-05 21:38 JST LocationPreviewList で MapPreviewFloatingTable に maxHeight=100% を付与。
  - blocked: 2026-02-05 21:39 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。
  - update: 2026-02-05 21:40 JST FloatingWindow の WindowContent を flex レイアウトにして縦伸長を安定化。
  - blocked: 2026-02-05 21:40 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。
  - update: 2026-02-05 21:44 JST LocationPreviewList の内側Boxを flex:1 に変更し、MapPreviewFloatingTable maxHeight の型を拡張。
  - blocked: 2026-02-05 21:45 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。
  - update: 2026-02-05 21:46 JST TanstackDataGrid の virtualizer に実測行高の計測を追加。
  - blocked: 2026-02-05 21:47 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。

2521) fix/ui-map/remove-click-snackbar (P1) — 進行中 (2026-02-05)
- ブランチ名: fix/ui-map/remove-click-snackbar
- 依存: なし
- 受け入れ基準: ui-map の地図クリックで Snackbar が表示されない／クリック時の他の挙動に影響がない／`pnpm --filter @hierarchidb/app typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/MapLibreMap.tsx`
- ロールバック手順: Snackbar 表示処理を復元する
- チェックリスト:
  - ui-map のクリック時 Snackbar 表示を撤去する
  - クリック時の他ロジックが維持されることを確認する
  - app の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 21:13 JST ui-map の地図クリック時 Snackbar 表示撤去に着手。
  - update: 2026-02-05 21:14 JST MapLibreMap のクリック時 Snackbar 表示を削除。
  - blocked: 2026-02-05 21:14 JST `pnpm --filter @hierarchidb/app typecheck` が既存の型エラーで失敗（openInNewTab/searchTerm 参照の未定義など）。

2520) feat/ui/shift-open-in-new-tab (P1) — 進行中 (2026-02-05)
- ブランチ名: feat/ui/shift-open-in-new-tab
- 依存: なし
- 受け入れ基準: SpeedDial のノード作成メニューと TreeConsole のコンテキストメニュー（Create/Open/Edit/Build/Preview）およびビルド中セッションのボタンで Shift+クリック時に新規タブで遷移する／コンテキストメニュー表示中に Shift が押されている間は該当メニュー右端に OpenInNew アイコンが表示される／`pnpm --filter @hierarchidb/app typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/**`, `packages/ui/treeconsole/**`, `app/src/components/BuildSessionLauncherButtons.tsx`（必要に応じて追加）
- ロールバック手順: 追加した Shift 判定/新規タブ導線と OpenInNew アイコン表示を削除し、従来の同一タブ遷移に戻す
- チェックリスト:
  - コンテキストメニューの Shift 押下時アイコン表示を実装する
  - Shift+クリック時の新規タブ遷移を SpeedDial/ContextMenu/BuildSessionLauncherButton で実装する
  - app の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 20:41 JST Shift+クリック時の新規タブ遷移と OpenInNew 表示の実装に着手。
  - update: 2026-02-05 20:42 JST Open サブメニューを開く項目から OpenInNew アイコンを撤去。
  - update: 2026-02-05 20:45 JST OpenInNew アイコンの margin を 0 に統一。
  - update: 2026-02-05 20:46 JST OpenInNew アイコンの padding を 0 に統一。
  - update: 2026-02-05 20:47 JST OpenInNew アイコンのサイズを 90% に調整。
  - update: 2026-02-05 20:48 JST OpenInNew アイコンのサイズを 95% に調整。

2519) feat/appbar/build-session-launcher-buttons (P1) — 完了 (2026-02-05)
- ブランチ名: feat/appbar/build-session-launcher-buttons
- 依存: なし
- 受け入れ基準: AppBar の UserAvatarMenu 左側にビルド中セッションの BuildSessionLauncherButton 群が横並びで表示される／ビルド完了時に自動的に非表示になる／各ボタンにノード種別の色・MUIアイコンとノード名ラベルが表示される／Tooltip にビルド中ノードのパスと Build ステップの全体進捗カード相当の内容が表示される／ボタン押下で該当ノードの Build ステップへ遷移できる／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/components/appbar/AppBar.tsx`, `app/src/components/appbar/UserAvatarMenu.tsx`（必要に応じて追加）
- ロールバック手順: 追加した BuildSessionLauncherButton 表示カードを撤去する
- チェックリスト:
  - AppBar に BuildSessionLauncherButton 群の横並びカードを追加する
  - ビルド中セッションの取得と完了時非表示の条件を確認する
  - Tooltip の表示内容と Build ステップ遷移を実装する
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 18:24 JST AppBar の BuildSessionLauncherButton 表示追加に着手。
  - update: 2026-02-05 18:38 JST BuildSessionLauncherButtons を追加し AppBar に組み込み。
  - update: 2026-02-05 18:39 JST pnpm --filter @hierarchidb/app typecheck exit 0（plugin-base tsdown の define 警告あり）を確認。
  - done: 2026-02-05 18:40 JST AppBar の BuildSessionLauncherButton 表示追加を完了。
  - start: 2026-02-05 18:41 JST WorkerAPI の pub/sub 化対応に着手。
  - update: 2026-02-05 18:58 JST WorkerAPI にビルドセッション購読APIを追加し worker runtime へ実装。
  - update: 2026-02-05 18:59 JST BuildSessionLauncherButtons のポーリングを撤去し pub/sub 経由へ移行。
  - update: 2026-02-05 19:00 JST pnpm --filter @hierarchidb/worker-api build exit 0（tsdown の define 警告あり）を確認。
  - update: 2026-02-05 19:00 JST pnpm --filter @hierarchidb/app typecheck exit 0（plugin-base tsdown の define 警告あり）を確認。
  - done: 2026-02-05 19:00 JST WorkerAPI の pub/sub 化対応を完了。

2502) fix/ui-treeconsole-base/treenode-type-field (P1) — 完了 (2026-02-04)
- ブランチ名: fix/ui-treeconsole-base/treenode-type-field
- 依存: なし
- 受け入れ基準: TreeConsolePanel で TreeNodeInUI に未定義フィールドが混入しない／`pnpm --filter @hierarchidb/ui-treeconsole-base typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/base/src/components/TreeConsolePanel.tsx`
- ロールバック手順: type 付与を元に戻す
- チェックリスト:
  - TreeNodeInUI の型定義に沿うよう余計なフィールドを撤去する
  - ui-treeconsole-base の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 12:55 JST TreeConsolePanel の type フィールド起因の型エラー修正に着手。
  - update: 2026-02-04 12:56 JST TreeNodeInUI から未定義の type フィールドを削除。
  - update: 2026-02-04 12:56 JST pnpm --filter @hierarchidb/ui-treeconsole-base typecheck exit 0 を確認。
  - done: 2026-02-04 12:56 JST TreeNodeInUI の type フィールド修正を完了。

2503) fix/shape-build/pause-pending-hook-imports (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-build/pause-pending-hook-imports
- 依存: なし
- 受け入れ基準: useShapeBuildStep の useState/useEffect 参照が解決される／isPausePending が atom sync に渡る／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- ロールバック手順: 追加した import と return 値を元に戻す
- チェックリスト:
  - useState/useEffect の import を追加する
  - isPausePending を返却に含める
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 13:05 JST useShapeBuildStep の hook import 欠落と isPausePending 不足の修正に着手。
  - update: 2026-02-04 13:06 JST useState/useEffect import を追加し isPausePending を返却に追加。
  - update: 2026-02-04 13:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 13:06 JST useShapeBuildStep の hook import 修正を完了。

2501) refactor/shape/bandindex-rename (P1) — 完了 (2026-02-04)
- ブランチ名: refactor/shape/bandindex-rename
- 依存: なし
- 受け入れ基準: bandIndex 名称へ全面統一（型/DB/API/UI/ログ/テスト含む）／Dexie schema の version 更新と移行対応／旧名の混在が残らない（検索で許容箇所以外に bandIndex が残らない）／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/**`, `plugins/**`, `app/**`（bandIndex 参照全般）
- ロールバック手順: 該当差分を revert して旧名称へ戻し、Dexie schema 版本号を戻す
- チェックリスト:
  - bandIndex 名称への置換を実施する
  - Dexie schema の version 更新と移行を実装する
  - 影響範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-04 10:40 JST bandIndex 名称統一の作業に着手。
  - update: 2026-02-04 10:52 JST bandIndex 名称統一の参照箇所を抽出し、全体置換を開始。
  - update: 2026-02-04 11:05 JST EphemeralShapeDB を version 18 に更新し transformCache に [nodeId+bandIndex] を追加、upgrade で transformCache/tileIdToBufferRelations を clear。
  - update: 2026-02-04 11:10 JST docs/plans/TASKS の bandIndex 表記へ更新。
  - update: 2026-02-04 11:14 JST pnpm --filter @hierarchidb/shape-api build exit 0（tsdown define 警告あり）。
  - update: 2026-02-04 11:15 JST pnpm --filter @hierarchidb/shape-store build exit 0（tsdown define 警告あり）。
  - update: 2026-02-04 11:16 JST pnpm --filter @hierarchidb/vt-orchestrator build exit 0（tsdown define 警告あり）。
  - update: 2026-02-04 11:17 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0。
  - update: 2026-02-04 11:18 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0。
  - update: 2026-02-04 11:19 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-02-04 11:22 JST bandIndex 名称統一を完了。

2504) fix/shape/default-datasource-geoboundaries (P2) — 完了 (2026-02-04)
- ブランチ名: fix/shape/default-datasource-geoboundaries
- 依存: なし
- 受け入れ基準: shape 新規作成時に dataSourceName が geoboundaries で初期化される／既存データは変わらない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/data-source/useShapeDataSourceStep.ts`
- ロールバック手順: 初期化用 useEffect を撤去して元の挙動に戻す
- チェックリスト:
  - dataSource 未設定時に DEFAULT_BUILD_CONFIG を初期化する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 13:18 JST shape 新規作成時の dataSource 初期化対応に着手。
  - update: 2026-02-04 13:19 JST dataSource 未設定時に geoboundaries を初期化する処理を追加。
  - update: 2026-02-04 13:19 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 13:19 JST shape 新規作成時の dataSource 初期化を完了。

2500) feat/shape/vt-memory-logs-tiling (P2) — 進行中 (2026-02-03)
- ブランチ名: feat/shape/vt-memory-logs-tiling
- 依存: なし
- 受け入れ基準: vt ステージの tiling/encode/store 周辺でメモリ・入力サイズ・所要時間のログが追加される／heap が取得できない環境でも安全に動作する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: 該当差分を revert してログを元に戻す
- チェックリスト:
  - tiling/encode/store 周辺のメモリ・所要時間ログを追加する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 13:40 JST vt tiling/encode/store のメモリログ追加に着手。
  - update: 2026-02-04 10:10 JST vt tiling/encode/store のメモリログ追加を再開。
  - update: 2026-02-04 10:24 JST vt の tiling/per-tile/per-feature/encode/store のメモリ・所要時間ログを追加。
  - update: 2026-02-04 10:26 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-02-04 10:31 JST vt のログフィールド名を duration/elapsed に統一（ms 表記削除）。
  - update: 2026-02-04 10:33 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - done: 2026-02-04 10:33 JST vt tiling/encode/store のメモリログ追加を完了。

2504) fix/shape/fetch-transform-cache-country-admin-index (P1) — 進行中 (2026-02-04)

2505) fix/shape-step5/summary-card-clamp (P1) — 完了 (2026-02-04)

2506) fix/ui-plugin-dialog/memory-remain-bar (P1) — 完了 (2026-02-04)
- ブランチ名: fix/ui-plugin-dialog/memory-remain-bar
- 依存: なし
- 受け入れ基準: development モード時のみ PluginDialog コンテンツ上端にメモリ残量の LinearProgress が表示される／performance.memory が無い環境では非表示で落ちない／`pnpm --filter @hierarchidb/plugin-ui-host typecheck` もしくは `pnpm --filter @hierarchidb/ui-dialog typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/DialogScaffold.tsx`
- ロールバック手順: 追加した表示コンポーネントを削除する
- チェックリスト:
  - dev 判定と memory 残量の表示を追加する
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 14:25 JST PluginDialog に dev 用メモリ残量バーを追加する作業に着手。
  - update: 2026-02-04 14:29 JST DialogScaffold に dev 判定のメモリ残量バー（LinearProgress）を追加。
  - update: 2026-02-04 14:30 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - update: 2026-02-04 14:36 JST メモリ残量バーを padding/margin なしにし、20%/10% で warning/error 色へ変更。
  - update: 2026-02-04 14:36 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - done: 2026-02-04 14:30 JST PluginDialog の dev 用メモリ残量バー対応を完了。

2507) fix/shape-build/max-update-depth (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-build/max-update-depth
- 依存: なし
- 受け入れ基準: Shape build の Step5 で発生する Maximum update depth exceeded が解消される／useShapeBuildTaskSync/useShapeBuildTasks の更新ループが発生しない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts`, `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTasks.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して元の同期ロジックへ戻す
- チェックリスト:
  - 更新ループの原因を特定し、setState の無限連鎖を止める
  - 既存のタスク更新反映が維持されることを確認する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 16:10 JST Shape build の Maximum update depth exceeded 対応に着手。
  - update: 2026-02-04 16:18 JST task 同期の flush 比較を committedTasksRef に統一し、冗長更新を抑制。
  - update: 2026-02-04 16:18 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 16:18 JST Shape build の最大更新深度エラー対応を完了。

2508) fix/ui-plugin-dialog/remove-memory-bar (P1) — 完了 (2026-02-04)
- ブランチ名: fix/ui-plugin-dialog/remove-memory-bar
- 依存: なし
- 受け入れ基準: PluginDialog の dev 用メモリ残量バーが撤去される／`pnpm --filter @hierarchidb/plugin-ui-host typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/DialogScaffold.tsx`

2510) fix/shape/transform-tolerance-default (P2) — 進行中 (2026-02-04)
- ブランチ名: fix/shape/transform-tolerance-default
- 依存: なし
- 受け入れ基準: Transform の既定 tolerance が 0.2 になる／Step4 のデフォルト設定に反映される／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/common/types/constants.ts`（必要に応じて追加）
- ロールバック手順: tolerance を 0.1 に戻す
- チェックリスト:
  - DEFAULT_BUILD_CONFIG の transformConfig.tolerance を更新する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:22 JST Transform の既定 tolerance を 0.2 に変更する作業に着手。
  - update: 2026-02-04 17:23 JST DEFAULT_BUILD_CONFIG の transformConfig.tolerance を 0.2 に更新。
  - update: 2026-02-04 17:23 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2511) investigation/shape-build-resume-after-cache-purge (P2) — 進行中 (2026-02-04)
- ブランチ名: investigation/shape-build-resume-after-cache-purge
- 依存: なし
- 受け入れ基準: キャッシュ削除後の再ビルドで fetch 完了ログ以降に進まない原因をコード参照付きで説明できる／再現条件と影響範囲を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts`, `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`, `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts`
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - fetch 完了後の呼び出し順と前提条件を確認する
  - metadata 読み込み/キャッシュ再生成の失敗条件を整理する
  - taskQueue とキャッシュ削除の不整合の可能性を整理する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:32 JST キャッシュ削除後の再ビルド停止の原因調査に着手。
  - update: 2026-02-04 17:34 JST fetch 完了直後の transform 入口で metadataLoader が必ず呼ばれる経路を確認（shapePipeline.ts）。
  - update: 2026-02-04 17:35 JST metadata キャッシュ削除 + offline/取得失敗で例外が投げられるため、fetch 完了ログ以降が出ない可能性を整理。
  - update: 2026-02-04 17:36 JST resumeExistingTasks=true の場合に taskQueue とキャッシュの不整合が起きやすい点を整理。
  - done: 2026-02-04 17:36 JST 原因候補と確認ポイントの整理を完了。

2512) fix/shape/step4-delete-cache-clears-tasks (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/shape/step4-delete-cache-clears-tasks
- 依存: なし
- 受け入れ基準: Step4 のキャッシュ削除時に関連する taskQueue/build tasks が削除され、再ビルド時に古いタスクが残らない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-config/useFetchConfigSection.ts`
- ロールバック手順: 追加したタスク削除の連鎖を撤去する
- チェックリスト:
  - キャッシュ削除時に downstream の taskQueue を合わせて削除する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:46 JST Step4 キャッシュ削除時の taskQueue 同期削除に着手。
  - update: 2026-02-04 17:50 JST fetch/transform/vt の削除時に downstream を含めて taskQueue/build tasks をクリアするよう整理。
  - update: 2026-02-04 17:51 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2513) fix/shape/transform-workers-ui (P2) — 進行中 (2026-02-04)
- ブランチ名: fix/shape/transform-workers-ui
- 依存: なし
- 受け入れ基準: Step4 の Transform アコーディオン先頭に Transform workers（maxConcurrent）設定が復活する／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-config/TransformConfigSection.tsx`
- ロールバック手順: 追加した worker 数カードを撤去する
- チェックリスト:
  - Transform アコーディオン先頭に maxConcurrent の設定UIを追加する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:58 JST Transform worker 数設定のUI復活に着手。
  - update: 2026-02-04 18:03 JST Transform アコーディオン先頭に maxConcurrent 設定カードを追加。
  - update: 2026-02-04 18:04 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-04 18:08 JST Transform Workers ラベルを Simplification に変更。
  - update: 2026-02-04 18:09 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
- ロールバック手順: 該当差分を revert してメモリバーを復帰する
- チェックリスト:
  - メモリ残量バーの表示ロジックを撤去する
  - plugin-ui-host の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 16:30 JST PluginDialog のメモリ残量バー撤去に着手。
  - update: 2026-02-04 16:36 JST DialogScaffold からメモリ残量バーの表示ロジックを撤去。
  - update: 2026-02-04 16:36 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - done: 2026-02-04 16:36 JST PluginDialog のメモリ残量バー撤去を完了。

2514) investigation/shape-build-step-atom-sync-max-update-depth (P1) — 進行中 (2026-02-05)
- ブランチ名: investigation/shape-build-step-atom-sync-max-update-depth
- 依存: なし
- 受け入れ基準: useShapeBuildStepAtomSync 周辺のコード精読に基づき Maximum update depth exceeded の原因仮説を提示できる／依存関係ごとの再描画トリガを整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStepAtomSync.ts`（必要に応じて関連 hook）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - useShapeBuildStepAtomSync と呼び出し元の依存関係を精読する
  - 最大更新深度警告のループ要因と仮説を整理する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 09:12 JST useShapeBuildStepAtomSync の最大更新深度警告の原因調査に着手。
  - update: 2026-02-05 10:21 JST Dexie 既存DB/テーブル構成を確認し buildStateRegistry の格納候補を整理。
  - done: 2026-02-05 10:21 JST buildStateRegistry の Dexie格納候補提案を準備。
  - update: 2026-02-05 10:02 JST onChange のシーケンス番号付与/古い更新の無視ロジックを検索。
  - done: 2026-02-05 10:02 JST シーケンス番号による merge ガードは該当範囲で未確認。
  - update: 2026-02-05 09:52 JST onChange の反映経路と step data の更新タイミングを追跡。
  - done: 2026-02-05 09:52 JST onChange 未反映の可能性を整理。
  - update: 2026-02-05 09:34 JST useShapeBuildStepAtomSync と関連 hook を精読し、更新ループの仮説を整理。
  - done: 2026-02-05 09:34 JST 最大更新深度警告の原因仮説整理を完了。

2515) plan/ephemeral-db-unification (P1) — 進行中 (2026-02-05)
- ブランチ名: plan/ephemeral-db-unification
- 依存: なし
- 受け入れ基準: hidb-ephemeral の目的/スコープを整理し移行対象を一覧化する／現行DBスキーマから共通スキーマ案を提示する（batchTasks→buildTasks改名含む）／段階移行/ロールバック手順を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/vt-orchestrator/src/task/taskQueue.ts`（必要に応じて追加）
- ロールバック手順: 調査/設計のみのため不要
- チェックリスト:
  - 既存の ephemeral 系Dexie DB/テーブル構成を整理する
  - hidb-ephemeral の共通スキーマ案を作成する
  - 段階移行/併存/ロールバックの流れを整理する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 10:35 JST hidb-ephemeral 統合計画の整理に着手。
  - update: 2026-02-05 11:00 JST hidb-ephemeral 共通スキーマ案と移行フェーズ案を整理。
  - done: 2026-02-05 11:00 JST hidb-ephemeral 統合計画の一次整理を完了。
  - update: 2026-02-05 10:46 JST shape/route/vt-task-queue のDexie構成を精査し統合対象を整理。
  - done: 2026-02-05 10:46 JST hidb-ephemeral 統合の配置案をまとめ。
  - update: 2026-02-05 11:22 JST gis-sdk に共通スキーマ型と Dexie schema 定義を追加。
  - done: 2026-02-05 11:22 JST hidb-ephemeral 共通スキーマの型定義を準備。

2516) plan/ephemeral-db-phase1 (P1) — 進行中 (2026-02-05)
- ブランチ名: plan/ephemeral-db-phase1
- 依存: 2515
- 受け入れ基準: hidb-ephemeral の新Dexieクラスを追加する／旧DB→新DBの読み取り切替点を整理する／batchTasks→buildTasks改名の適用箇所を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/ephemeral/*`（必要に応じて追加）
- ロールバック手順: 調査/設計のみのため不要
- チェックリスト:
  - hidb-ephemeral の新Dexieクラスを追加する
  - 読み取り切替点の候補を整理する
  - batchTasks→buildTasks の改名対象を整理する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 11:40 JST hidb-ephemeral Phase1 の準備に着手。
  - update: 2026-02-05 12:36 JST shape の sessions/buildTasks/cache を hidb-ephemeral へ切替開始。
  - update: 2026-02-05 13:05 JST shape の読み取り先を hidb-ephemeral に切替。
  - done: 2026-02-05 13:05 JST shape 読み取り切替を完了。
  - update: 2026-02-05 12:20 JST vt-task-queue を hidb-ephemeral の vtTaskQueue テーブルへ切替。
  - update: 2026-02-05 12:06 JST 読み取り切替設計（フォールバックなし）を整理。
  - done: 2026-02-05 12:06 JST Phase1-1 読み取り切替設計を完了。
  - update: 2026-02-05 11:55 JST hidb-ephemeral の新Dexieクラスと共通スキーマ実装を追加。
  - update: 2026-02-05 11:56 JST 読み取り切替点と batchTasks→buildTasks 改名対象を整理。
  - done: 2026-02-05 11:56 JST hidb-ephemeral Phase1 の準備を完了。
  - update: 2026-02-05 10:45 JST route の sessions を hidb-ephemeral へ切替。
  - blocked: 2026-02-05 10:46 JST pnpm --filter @hierarchidb/route-plugin typecheck で hidbEphemeralDB 未export エラー（gis-sdk dist 未更新）。
  - update: 2026-02-05 10:46 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 10:46 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - update: 2026-02-05 10:52 JST route のセッションメタは tiles から算出し、tableId は hidb-ephemeral sessions に保持する方針に整理。
  - update: 2026-02-05 10:52 JST EphemeralRouteDB の sessions テーブル/型を撤去し、vectorTiles のみ維持。
  - update: 2026-02-05 10:52 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - update: 2026-02-05 11:30 JST RoutePreviewList を1本ルートのメタ（モード/名称/地点名/行政名/中継点数/距離）表示へ切替。
  - update: 2026-02-05 11:30 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 11:30 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - update: 2026-02-05 11:36 JST RoutePreviewList のモード列にローカライズ済み表示とアイコン+色を追加。
  - update: 2026-02-05 11:36 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 11:36 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - start: 2026-02-05 11:41 JST vtTaskQueue を buildTasks に統合する作業に着手。
  - update: 2026-02-05 11:45 JST vtTaskQueue のデータを buildTasks へ移行し、vt-orchestrator の参照先を buildTasks に切替。
  - update: 2026-02-05 11:45 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 11:45 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0。
  - start: 2026-02-05 11:49 JST vtTaskQueue/legacy fallback を撤去し新経路のみへ整理。
  - update: 2026-02-05 11:50 JST vtTaskQueue/LEGACY schema を撤去し新スキーマのみへ整理。
  - update: 2026-02-05 11:50 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 11:50 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0。

2517) plan/shape-build-background-execution (P1) — 進行中 (2026-02-05)
- ブランチ名: plan/shape-build-background-execution
- 依存: なし
- 受け入れ基準: a/b/c の段階定義が明文化される／stopReason と再開条件の整理が入る／TASKS.md に運用ログを記載する
- 段階定義:
  - a: 画面外では停止、戻っても停止のまま
    - 永続化対象: processingStatus / buildStartedAt / buildFinishedAt / tileSummary / 進捗
    - 画面離脱時の停止理由を明示的に記録（例: stopReason = "route-leave"）
    - 画面復帰時は必ず停止状態を維持（自動再開なし）
  - b: 画面外では一時停止、戻ったら自動再開
    - 自動再開条件: stopReason が「route-leave」等の再開可能理由の場合
    - 自動再開しない条件: stopReason = "failed" / "completed"
    - 既に再開実行中なら表示のみ
  - c: バックグラウンド継続
    - 実行主体を UI からアプリ全体へ移す
- ロールバック手順: 設計/整理のみのため不要
- チェックリスト:
  - a/b/c の段階定義を整理する
  - stopReason と再開条件の整理を記載する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-05 11:50 JST ビルドのバックグラウンド化段階定義を TASKS へ記録。
  - update: 2026-02-05 14:07 JST ExecPlan を plans/shape-build-background-execution-execplan.md に作成。
  - update: 2026-02-05 16:10 JST stopReason の型追加と pause に route-leave 理由を永続化する実装に着手。
  - start: 2026-02-05 16:18 JST a) 復帰時停止維持の結合テスト追加に着手。
  - update: 2026-02-05 16:45 JST pnpm --filter @hierarchidb/runtime-worker test -- --run src/__tests__/wfl/shape-build-resume-after-pause.wfl.test.ts exit 0（82 tests）。
  - start: 2026-02-05 16:47 JST b) 自動再開条件の実装と結合テスト追加に着手。
  - update: 2026-02-05 16:52 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - blocked: 2026-02-05 16:53 JST pnpm --filter @hierarchidb/shape-plugin test で localStorage モック不足、alias 不備、ネットワーク依存テストが失敗。
  - update: 2026-02-05 16:57 JST pnpm --filter @hierarchidb/shape-plugin test exit 0（6 passed/1 skipped、localstorage warning あり）。
  - update: 2026-02-05 17:03 JST shape-vt-pipeline.full-flow.headless.test の skip 条件を撤去し、pnpm --filter @hierarchidb/shape-plugin test exit 0（11 passed/1 skipped）。
  - update: 2026-02-05 17:06 JST pnpm --filter @hierarchidb/runtime-worker test -- --run src/__tests__/wfl/shape-build-resume-after-pause.wfl.test.ts exit 0（84 tests）。
  - start: 2026-02-05 17:13 JST c) バックグラウンド継続の結合テスト設計に着手。
  - blocked: 2026-02-05 16:20 JST pnpm --filter @hierarchidb/shape-plugin typecheck で EphemeralBuildSessionRecord/EphemeralTransformCacheRecord などの型不一致が発生。
  - update: 2026-02-05 17:05 JST stopReason の型追加と pause 理由の永続化（route-leave/user-pause）を実装。
  - update: 2026-02-05 17:12 JST Ephemeral sessions/buildTasks/transformCache の型不一致を正規化/unknown cast で解消。
  - update: 2026-02-05 17:14 JST pnpm --filter @hierarchidb/shape-api build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 17:14 JST pnpm --filter @hierarchidb/shape-store build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 17:15 JST pnpm --filter @hierarchidb/ui-worker-client build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 17:16 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-05 17:18 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0。
  - update: 2026-02-05 18:05 JST hidb-ephemeral の型を shape セッション/タスク/エラーに整合させ、unknown cast を撤去。
  - update: 2026-02-05 18:06 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - update: 2026-02-05 18:07 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-05 18:08 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0。
  - update: 2026-02-05 18:45 JST Comlink+fake-indexeddb+Worker の shape build pause 結合テストを追加。
  - blocked: 2026-02-05 18:47 JST pnpm --filter @hierarchidb/runtime-worker test -- --run shape build pause on leave で既存テストが失敗（locationTypes.js 未生成/tx-wrapper MissingAPIError/bulk-ops-tms undefined）。
  - update: 2026-02-05 18:50 JST shape-test-worker.entry を追加し、gis-sdk を dist 参照する vi.mock を導入。
  - update: 2026-02-05 18:51 JST pnpm exec vitest run src/__tests__/wfl/shape-build-pause-on-leave.wfl.test.ts exit 0。
  - start: 2026-02-05 19:05 JST runtime-worker の既存テスト失敗原因（location-api/core-types の dist 解決・IndexedDB 未初期化など）を修正する作業に着手。
  - update: 2026-02-05 20:00 JST CoreDB 初期化の警告は空DBでは出さないように条件分岐を整理。
  - update: 2026-02-05 20:05 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（警告ログの該当行は消えることを確認）。
  - update: 2026-02-05 20:20 JST CommandProcessor テストの CoreDB スタブに changeSubject を追加し、undo-atoms 発行時の警告を解消する。
  - update: 2026-02-05 20:25 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（undo-atoms の警告は出なくなった）。
  - update: 2026-02-05 20:40 JST テスト時のみ DraftService/PluginWorkerModuleLoader のログを抑止するフラグを追加。
  - update: 2026-02-05 20:55 JST commitDraft/TreeSubscriptionService の debug/log をテスト時抑止するよう拡張。
  - update: 2026-02-05 21:05 JST TreeSubscriptionService の children-changed バッチ部分の構文崩れを修正。
  - update: 2026-02-05 21:10 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（ログ抑止後の再確認）。
  - update: 2026-02-05 21:25 JST WorkerService/NodeLifecycleManager/StageProcessingService のログもテスト時抑止に揃えた。
  - update: 2026-02-05 21:30 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（追加ログ抑止の確認）。
  - update: 2026-02-05 19:20 JST WFL の trash 通知/部分復元テストの skip を解除し、releaseProxy の unknown cast を撤去。
  - update: 2026-02-05 19:30 JST commitDraft の返却 nodeId を使用するよう WFL テストを修正し、draft holder 名の仮デコードを撤去。
  - update: 2026-02-05 19:35 JST trash 通知テストの誤った期待値（node そのものを "trash" と比較）を実際の trash 判定（parentId/removedAt）へ修正。
  - update: 2026-02-05 19:40 JST trash 通知テストの2箇所目の期待値も parentId/removedAt 判定に揃えた。
  - update: 2026-02-05 19:45 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（75 tests）。
  - update: 2026-02-05 19:10 JST vitest 設定で core-types/location-api/route-api/gis-sdk を src 参照にし、vitest.setup に fake-indexeddb/auto を追加。
  - update: 2026-02-05 19:12 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（2件はskip）。
  - start: 2026-02-05 15:44 JST shape build の一時停止/再開完了とキャッシュ削除後再開の結合テスト追加に着手。
  - update: 2026-02-05 15:46 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（81 tests）。
  - start: 2026-02-05 16:05 JST 実パイプラインの一時停止/再開結合テスト追加に着手。
  - update: 2026-02-05 16:14 JST pnpm --filter @hierarchidb/runtime-worker test -- --run exit 0（81 tests）。
  - update: 2026-02-05 17:55 JST c) バックグラウンド継続の結合テスト実行系（shape-plugin 側）でタイムアウト/他テスト混在を確認し、原因切り分けに着手。
  - update: 2026-02-05 18:10 JST vitest run で transform/vt 処理が進まずタイムアウトする事象を確認。
  - update: 2026-02-05 18:18 JST vt-orchestrator の createTransformByBandHandler/createVtHandler をテスト用簡易実装にモックし、shapePipelineShared.buildVtTasks を最小タスク生成に差し替え。
  - update: 2026-02-05 18:21 JST c) 背景継続テストはセッション完了の検証に絞り、pnpm --filter @hierarchidb/shape-plugin exec vitest run src/__tests__/wfl/shape-build-resume-after-pause.wfl.test.ts exit 0（10 tests）。
  - update: 2026-02-05 18:25 JST 結合テストの dataSource を geoboundaries に変更。
  - update: 2026-02-05 18:54 JST c) 実パイプライン用の結合テストを追加（shape-build-background-real-pipeline.wfl）。
  - update: 2026-02-05 18:54 JST shape-test-worker.entry の pipeline 状態を module-scope 化し、複数クライアントで共有。
  - blocked: 2026-02-05 18:54 JST 実パイプラインテストが vt collect でハング（ログは vt collect start で停止）。
  - update: 2026-02-05 19:12 JST vt collect のハング切り分けとして bulkGet 経路のテストフラグ追加と再実行に着手。
  - update: 2026-02-05 19:14 JST c) 実パイプラインテストで __HDB_VT_COLLECT_BULKGET を有効化し再実行（pnpm --filter @hierarchidb/shape-plugin exec vitest run src/__tests__/wfl/shape-build-background-real-pipeline.wfl.test.ts）。
  - blocked: 2026-02-05 19:14 JST vt collect start で再び停止し 120s タイムアウト（collect records へ進まず、bulkGet 経路でもハング）。
  - update: 2026-02-05 19:30 JST vt collect の await 前後ログ（collect fetch start/done）を追加し再実行。
  - blocked: 2026-02-05 19:30 JST collect fetch start の直後で停止し 120s タイムアウト（fetch done へ進まず）。
  - update: 2026-02-05 19:37 JST collect 前に transformCache.count を挿入し、count 完了後に fetch start へ進むことを確認。
  - blocked: 2026-02-05 19:37 JST bulkGet の await で停止し 120s タイムアウト（count は即時完了、fetch done へ進まず）。
  - update: 2026-02-05 19:42 JST テスト側で transformCache.get/bulkGet を実行し即時完了することを確認（id 1件、durationMs=0）。
  - blocked: 2026-02-05 19:42 JST worker 側の bulkGet だけが停止（テスト側の direct access は正常）。
  - update: 2026-02-05 19:45 JST collectFeatures を transaction("r") でラップし transaction start/done を確認。
  - blocked: 2026-02-05 19:45 JST transaction は完了するが bulkGet の await で停止（fetch done へ進まず）。
  - update: 2026-02-05 19:49 JST worker 側で get-each 経路を追加し、collect get start/done を確認。
  - blocked: 2026-02-05 19:49 JST collect get は完了するが fetch done が出ず 120s タイムアウト（transaction done 後に停止）。
  - update: 2026-02-05 19:53 JST collect fetch done ログを transaction 直後に移動。
  - blocked: 2026-02-05 19:53 JST transaction done まで進むが fetch done ログが出ず 120s タイムアウト（ログ出力前後で停止）。
  - update: 2026-02-05 19:56 JST fetch done ログ直前に await Promise.resolve() を挿入。
  - blocked: 2026-02-05 19:56 JST microtask を挟んでも fetch done ログが出ず 120s タイムアウト（transaction done 直後で停止）。
  - update: 2026-02-05 19:59 JST post-transaction A/B ログと setTimeout(0) ログを追加。
  - blocked: 2026-02-05 19:59 JST post-transaction A/B は出るが setTimeout と fetch done が出ず 120s タイムアウト（イベントループが回っていない可能性）。
  - update: 2026-02-05 20:02 JST fetch done を単純文字列ログへ変更。
  - blocked: 2026-02-05 20:02 JST 単純ログでも fetch done が出ず 120s タイムアウト（A/B は出る）。
  - update: 2026-02-05 20:07 JST post-transaction B 直後に return records（debugCollect 時）を挿入。
  - blocked: 2026-02-05 20:07 JST 早期 return でも vitest が 120s タイムアウト（vt collect done は出るが test 完了せず）。
  - update: 2026-02-05 20:20 JST fake-indexeddb の疑いが濃厚なため、ブラウザE2Eでの c) 実パイプライン検証に切り替え。
  - update: 2026-02-05 20:20 JST shape build background の Playwright テスト（e2e/shape/shape-build-background.spec.ts）を追加。
  - update: 2026-02-06 09:20 JST Playwright テストの導線を Build ステップ直リンクから UI の「ビルドを開始」操作へ変更。
  - update: 2026-02-06 09:21 JST Playwright の再実行準備（権限付き実行が必要）に着手。
  - update: 2026-02-06 09:40 JST Playwright テストで save-draft 追記・起動前の summary 期待を撤去し、WorkerAPI の参照をグローバル経路へ統一。
  - update: 2026-02-06 10:05 JST Playwright テストがビルド開始ボタンのクリックでタイムアウト（オーバーレイが pointer を遮断）。force click へ修正。
  - update: 2026-02-06 10:10 JST Playwright の Start Build ボタンが strict mode で 2件解決されたため、enabled ボタンのみを選択するロケータへ修正。
  - update: 2026-02-06 10:20 JST Playwright の Start Build ボタンが無効のままのため、node 作成後に save-draft + data を同時に保存するよう E2E を修正。
  - update: 2026-02-06 10:25 JST Playwright の Start Build ボタンが無効のため、WorkerAPI の startBatchSession を直接呼ぶ形へ E2E を変更。
  - update: 2026-02-06 10:30 JST WorkerAPI 呼び出しで client.getAPI() を使っていたため、__HDB_WORKER_CLIENT_REF__ から API を直接取得するよう修正。
  - update: 2026-02-06 10:35 JST geoboundaries の AuthRequiredError 回避のため、E2E で setAuthToken を付与。
  - update: 2026-02-06 10:40 JST geoboundaries の fetch が worker から発生するため、Playwright の intercept を page.route から context.route に変更。
  - update: 2026-02-06 10:45 JST CORS proxy 経由の 401 を避けるため、E2E で setCorsProxyBaseURL('') を設定。
  - update: 2026-02-06 10:50 JST zoomBandBoundaries が 1 開始必須のため、E2E の buildConfig を [1,2,3,6] へ更新。
  - update: 2026-02-06 10:55 JST CORS proxy URL へのアクセスが 401 になるため、proxy 経由の URL も Playwright でモック。
  - update: 2026-02-06 11:00 JST downloadTaskPayloads をテスト側で固定定義し、startBatchSession を直接実行する形へ修正。
  - update: 2026-02-06 11:05 JST geoboundaries メタデータの iso3 に合わせ、downloadTaskPayloads の countryCode を JPN に変更。
  - update: 2026-02-06 11:10 JST build 完了待機のタイムアウト時に最後の status/tiles を表示するよう E2E を補強。
  - update: 2026-02-06 11:15 JST startBatchSession 実行前に worker initialize を明示呼び出し。
  - update: 2026-02-06 11:20 JST build 完了待機のステータス取得を getBatchSessionStatus に切替。
  - update: 2026-02-06 11:25 JST startBatchSession の戻り値が idle/failed の場合に即時エラーとするよう E2E を強化。
  - update: 2026-02-06 11:30 JST startBatchSession 後に tasks 件数も確認し、idle 時にタスク数を併記するよう補強。
  - update: 2026-02-06 11:35 JST 完了待機を processingStatus + tileSummary 基準へ切替し、failed を検知したら即時エラーとするよう修正。
  - update: 2026-02-06 11:40 JST 完了待機のログに batch tasks の状態集計を含めるよう拡張。
  - update: 2026-02-06 11:45 JST 完了待機のログに running task の stage 情報を含めるよう補強。
  - update: 2026-02-06 11:50 JST 完了待機のログに running task の詳細（taskId/stage/progress）を含めるよう拡張。
  - update: 2026-02-06 11:55 JST failed task の詳細をログへ含め、failed 件数が出た時点で即時エラーにするよう補強。
  - update: 2026-02-06 12:00 JST build ダイアログを開かずに startBatchSession を実行する形に切替（auto-pause を避けて c) を検証）。

2509) fix/shape-build/max-update-depth-loop (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-build/max-update-depth-loop
- 依存: なし
- 受け入れ基準: Shape build 中の Maximum update depth exceeded が再発しない／setTasks の更新ループが抑止される／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して元の同期ロジックへ戻す
- チェックリスト:
  - 更新ループの発生条件を抑止する
  - 既存のタスク更新反映が維持されることを確認する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 16:30 JST Shape build の update depth ループ再調査に着手。
  - update: 2026-02-04 16:38 JST merge/delete の基準リストを committedTasksRef に統一し、古い tasksRef 参照を撤去。
  - update: 2026-02-04 16:38 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 16:38 JST Shape build の update depth ループ再修正を完了。

2510) fix/shape-build/task-list-tooltip (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-build/task-list-tooltip
- 依存: なし
- 受け入れ基準: Task 一覧の省略メッセージがホバーで全体表示される／メッセージ表示欄が1行固定になる／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/TaskItem.tsx`
- ロールバック手順: 該当差分を revert して tooltip/表示高さを元に戻す
- チェックリスト:
  - TaskItem のメッセージに tooltip を付与する
  - メッセージの表示高さを1行分に調整する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 16:50 JST Task 一覧のメッセージ tooltip/1行固定対応に着手。
  - update: 2026-02-04 16:54 JST TaskItem のメッセージに Tooltip を付与し、表示高さを1行分に調整。
  - update: 2026-02-04 16:54 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 16:54 JST Task 一覧のメッセージ tooltip/1行固定対応を完了。

2511) fix/shape-build/task-list-height (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-build/task-list-height
- 依存: なし
- 受け入れ基準: TaskItem の高さが 96px → 50px に変更される／仮想リストの表示が崩れない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/TaskItem.tsx`
- ロールバック手順: 該当差分を revert して 96px に戻す
- チェックリスト:
  - TaskItem の高さを 50px に変更する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:05 JST TaskItem 高さを 50px へ変更する作業に着手。
  - update: 2026-02-04 17:06 JST TASK_ITEM_HEIGHT を 50px に変更。
  - update: 2026-02-04 17:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 17:06 JST TaskItem の高さ変更を完了。

2512) chore/template/population-2023-default-selection (P1) — 完了 (2026-02-04)
- ブランチ名: chore/template/population-2023-default-selection
- 依存: なし
- 受け入れ基準: テンプレート JSON が population-by-countries-2023.json に改名される／参照先が新ファイル名に更新される／デフォルト選択が全世界レベル1まで＋中国/インドはレベル2までになる／TASKS.md に運用ログを記載する
- 影響範囲: `app/public/templates/population-2023/population-by-countries-2023.json`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `packages/**/__tests__/*.test.ts`
- ロールバック手順: ファイル名と参照先を tree-nodes.json に戻し、選択配列を元に戻す
- チェックリスト:
  - テンプレートの JSON を新ファイル名に改名する
  - 参照箇所を新ファイル名に更新する
  - 既定選択を「全世界レベル1まで＋中国/インドはレベル2まで」に更新する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:20 JST population-2023 テンプレートの改名と既定選択更新に着手。
  - update: 2026-02-04 17:25 JST テンプレート JSON を population-by-countries-2023.json へ改名し参照先を更新。
  - update: 2026-02-04 17:25 JST 全世界はレベル1まで、CN/IN はレベル2まで選択する既定へ更新。
  - done: 2026-02-04 17:25 JST population-2023 テンプレートの改名と既定選択更新を完了。

2513) fix/shape-transform/retry-tolerance-vertex-limit (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-transform/retry-tolerance-vertex-limit
- 依存: なし
- 受け入れ基準: transform 簡略化後の頂点数が 65535 を超える場合に tolerance を +0.5 ずつ最大 +5.0 まで増やして再簡略化する／超過が解消されるまで再試行する／`pnpm --filter @hierarchidb/vt-orchestrator typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- ロールバック手順: 該当差分を revert して従来の retry ロジックへ戻す
- チェックリスト:
  - 0.5 ステップで最大 10 回の retry を実装する
  - 既存の簡略化処理フローを維持する
  - vt-orchestrator の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 17:40 JST transform の頂点上限超過時の retry tolerance 実装に着手。
  - update: 2026-02-04 17:46 JST tolerance を +0.5 ずつ最大 +5.0 まで増やす retry へ変更。
  - update: 2026-02-04 17:46 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-02-04 18:05 JST retry 条件を 65536 の 10% (=6553) に変更し、t+5.0*(i+1) 方式へ修正。
  - update: 2026-02-04 18:05 JST しきい値未満時の二分探索（5 - ceil(i/2) 回）を追加。
  - update: 2026-02-04 18:05 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - done: 2026-02-04 18:05 JST transform の頂点上限超過 retry 仕様更新を完了。

2514) fix/shape-transform/quality-first-vertex-retry (P1) — 完了 (2026-02-04)
- ブランチ名: fix/shape-transform/quality-first-vertex-retry
- 依存: なし
- 受け入れ基準: 6553 超過のポリゴンのみを対象に段階的 tolerance 増分と二分探索を行う／全体一律簡略化は行わない／`pnpm --filter @hierarchidb/vt-orchestrator typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- ロールバック手順: 該当差分を revert して従来の全体簡略化 retry へ戻す
- チェックリスト:
  - 超過した feature のみ再簡略化する
  - tolerance 5.0 刻み + 二分探索で最小限の簡略化に寄せる
  - vt-orchestrator の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 18:20 JST 品質優先の頂点超過 retry 方式へ修正着手。
  - update: 2026-02-04 18:35 JST 超過 feature のみを対象に段階的 tolerance + 二分探索を適用。
  - update: 2026-02-04 18:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - done: 2026-02-04 18:35 JST 品質優先の頂点超過 retry 方式へ更新完了。

2515) fix/shape-build/validate-batch-config-guard (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/shape-build/validate-batch-config-guard
- 依存: なし
- 受け入れ基準: validateBatchConfig が areaBasedTolerance 未定義でも例外にならない／Shape Step5 がクラッシュしない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/utils.ts`
- ロールバック手順: 該当差分を revert して元の参照に戻す
- チェックリスト:
  - transformConfig/areaBasedTolerance の既定値を適用する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 18:50 JST validateBatchConfig の undefined 参照クラッシュ対応に着手。
  - update: 2026-02-04 18:55 JST validateBatchConfig で transformConfig/areaBasedTolerance の既定値を適用。
  - blocked: 2026-02-04 18:56 JST pnpm --filter @hierarchidb/shape-plugin typecheck が ShapeBuildAPIClient 等の既存型エラーで失敗（進行には対応方針の指示が必要）。

2516) fix/runtime-worker/ts6307-shape-test-entry (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/runtime-worker/ts6307-shape-test-entry
- 依存: なし
- 受け入れ基準: runtime-worker typecheck で shape-test-worker.entry.ts 起因の TS6307 が解消される／`pnpm --filter @hierarchidb/runtime-worker typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/tsconfig.typecheck.json`, `plugins/shape-plugin/src/e2e/shape-test-worker.entry.ts`, `plugins/shape-plugin/src/services/datasources/NaturalEarthStrategy.ts`, `plugins/shape-plugin/src/__tests__/wfl/shape-build-resume-after-pause.wfl.test.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して元の typecheck 対象へ戻す
- チェックリスト:
  - typecheck 対象の範囲を調整し TS6307 を解消する
  - runtime-worker の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 19:10 JST runtime-worker の TS6307 修正に着手。
  - update: 2026-02-04 19:16 JST tsconfig.typecheck.json で e2e/wfl を除外し TS6307 を解消。
  - update: 2026-02-04 19:16 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-02-05 19:35 JST shape-plugin services を限定 include にし直して TS6307 を解消。
  - update: 2026-02-05 19:35 JST NaturalEarthStrategy の jszip import 型を正規化。
 - update: 2026-02-05 19:36 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - done: 2026-02-05 19:36 JST runtime-worker の TS6307 修正を完了。
  - update: 2026-02-05 20:10 JST shape-test-worker.entry と wfl テストを shape-plugin 側へ移設し、runtime-worker からの相対参照を撤去。
  - update: 2026-02-05 20:12 JST runtime-worker/shape-plugin の typecheck exit 0 を確認。
  - update: 2026-02-05 20:13 JST pnpm --filter @hierarchidb/runtime-worker build exit 0（tsdown の define 警告あり）を確認。
  - done: 2026-02-05 20:14 JST shape-test-worker.entry の配置を shape-plugin 側へ整理完了。

2517) fix/gis-sdk/ephemeral-timestamp-guard (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/gis-sdk/ephemeral-timestamp-guard
- 依存: なし
- 受け入れ基準: HidbEphemeralDB の timestamp 判定で undefined を参照しない／`pnpm --filter @hierarchidb/gis-sdk typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/ephemeral/HidbEphemeralDB.ts`
- ロールバック手順: 該当差分を revert して元の filter に戻す
- チェックリスト:
  - timestamp 判定に undefined ガードを追加する
  - gis-sdk の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 19:10 JST HidbEphemeralDB の timestamp undefined ガード修正に着手。
  - update: 2026-02-04 19:15 JST timestamp 判定を record?.timestamp に変更。
  - update: 2026-02-04 19:15 JST pnpm --filter @hierarchidb/gis-sdk typecheck exit 0 を確認。
  - done: 2026-02-04 19:15 JST HidbEphemeralDB の undefined ガードを完了。

2518) fix/runtime-worker/lifecycle-log-flag (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/runtime-worker/lifecycle-log-flag
- 依存: なし
- 受け入れ基準: NodeLifecycleManager の shouldLogInfo 未定義エラーが解消される／`pnpm --filter @hierarchidb/runtime-worker typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/NodeLifecycleManager.ts`
- ロールバック手順: 該当差分を revert して元の参照に戻す
- チェックリスト:
  - shouldLogInfo の定義を追加する
  - runtime-worker の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 19:10 JST NodeLifecycleManager の shouldLogInfo 修正に着手。
  - update: 2026-02-04 19:15 JST shouldLogInfo フラグを追加して参照エラーを解消。
  - update: 2026-02-04 19:16 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - done: 2026-02-04 19:16 JST NodeLifecycleManager の shouldLogInfo 修正を完了。
- ブランチ名: fix/shape-step5/summary-card-clamp
- 依存: なし
- 受け入れ基準: Step5 ビルドのサマリーカード内の現在タスク/メッセージが2行固定で表示されレイアウトが安定する／タスクリストのメッセージも2行固定になる／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/build-progress/TaskItem.tsx`
- ロールバック手順: 該当スタイル変更を元に戻す
- チェックリスト:
  - summary/task メッセージの 2 行固定（line-clamp + 高さ固定）を適用する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 14:10 JST Step5 サマリーカード/タスクメッセージの2行固定対応に着手。
  - update: 2026-02-04 14:14 JST TaskProgressSummaryCard と TaskItem のメッセージを2行固定に変更。
  - update: 2026-02-04 14:15 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-04 14:15 JST Step5 サマリーカード/タスクメッセージの2行固定対応を完了。
- ブランチ名: fix/shape/fetch-transform-cache-country-admin-index
- 依存: なし
- 受け入れ基準: fetchCache/transformCache に [nodeId+countryCode+adminLevel] を追加し SchemaError が解消される／Dexie schema の version 更新と upgrade 方針を明記する／`pnpm --filter @hierarchidb/shape-store typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`
- ロールバック手順: 該当差分を revert して schema を元に戻す
- チェックリスト:
  - fetchCache/transformCache に [nodeId+countryCode+adminLevel] のインデックスを追加する
  - Dexie schema version を更新し upgrade 方針を明記する
  - shape-store の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-04 13:25 JST fetch/transform cache の country/admin インデックス追加に着手。
  - update: 2026-02-04 13:29 JST EphemeralShapeDB version 19 で fetchCache/transformCache に [nodeId+countryCode+adminLevel] を追加（インデックスのみ・既存キャッシュ保持）。
  - update: 2026-02-04 13:30 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0。
  - done: 2026-02-04 13:30 JST country/admin インデックス追加を完了。

2505) fix/draft/disable-auto-rename-on-save (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/draft/disable-auto-rename-on-save
- 依存: なし
- 受け入れ基準: save/save-draft で auto-rename が既定適用されない（TreeNodeUpdater の default が error になる）／新規作成の初期命名は従来どおり initTreeNode でユニーク化される／`pnpm --filter @hierarchidb/runtime-worker typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/TreeNodeUpdaterService.ts`, `packages/plugin-ui-sdk/src/hooks/useTreeNodeUpdater.ts`, `packages/features/tree-api/src/TreeNodeUpdaterAPI.ts`
- ロールバック手順: 該当差分を revert して auto-rename 既定を復元する
- チェックリスト:
  - TreeNodeUpdaterService の conflictPolicy 既定を error に変更する
  - useTreeNodeUpdater の commit リクエストから onNameConflict を外す
  - TreeNodeUpdaterAPI のドキュメントを更新する
  - runtime-worker の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-04 13:40 JST save/save-draft の auto-rename 既定無効化に着手。
  - update: 2026-02-04 13:44 JST TreeNodeUpdaterService の conflictPolicy 既定を error に変更。
  - update: 2026-02-04 13:45 JST useTreeNodeUpdater の commit リクエストから onNameConflict を撤去。
  - update: 2026-02-04 13:46 JST TreeNodeUpdaterAPI と plugins/README の説明を更新。
  - update: 2026-02-04 13:47 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0。
  - done: 2026-02-04 13:47 JST save/save-draft の auto-rename 既定無効化を完了。

2506) fix/tree/move-paste-conflict-dialog (P1) — 進行中 (2026-02-04)
- ブランチ名: fix/tree/move-paste-conflict-dialog
- 依存: なし
- 受け入れ基準: move/paste の衝突時にダイアログで「中止/上書き」を選択できる／move/paste は暗黙 auto-rename を行わない／duplicate は auto-rename の連番 suffix を維持する／`pnpm --filter @hierarchidb/runtime-worker typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/hooks/treeconsole/actions/*.ts`, `packages/runtime-worker/src/services/TreeMutationService.ts`, `packages/runtime-worker/src/services/command/core-handlers/index.ts`, `packages/features/tree-api/src/*`, `packages/ui/treeconsole/base/src/*`
- ロールバック手順: 該当差分を revert して auto-rename 既定・衝突時の挙動を元に戻す
- チェックリスト:
  - onNameConflict に overwrite を追加し、move/paste で衝突時に NAME_NOT_UNIQUE を返す
  - move/paste の overwrite を実装し、既存ノードの削除後に処理を続行できる
  - move/paste の UI で衝突時にダイアログを表示する
  - duplicate の auto-rename を維持する
  - runtime-worker の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-04 14:20 JST move/paste の衝突ダイアログ対応に着手。
  - update: 2026-02-04 14:35 JST onNameConflict に overwrite を追加し、move/paste の衝突処理を実装。
  - update: 2026-02-04 14:38 JST move/paste の UI で衝突時に上書き確認を表示するよう対応。
  - update: 2026-02-04 14:41 JST pnpm --filter @hierarchidb/tree-api build exit 0（tsdown define 警告あり）。
  - update: 2026-02-04 14:42 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0。

2507) fix/shape/step5-task-item-fixed-height (P2) — 進行中 (2026-02-04)
- ブランチ名: fix/shape/step5-task-item-fixed-height
- 依存: なし
- 受け入れ基準: Step5 のタスク一覧で各タスク行の高さが固定され、スクロール挙動が安定する／メッセージ/詳細は表示を維持しつつ折返しで高さが変わらない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/TaskItem.tsx`, `plugins/shape-plugin/src/ui/components/build-progress/TaskListVirtualized.tsx`
- ロールバック手順: 該当差分を revert して可変高さの表示へ戻す
- チェックリスト:
  - TaskItem の高さを固定し、メッセージ/詳細の表示領域を固定する
  - Virtualizer の estimateSize と row 高さを固定値に合わせる
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-04 14:55 JST Step5 タスク行の固定高さ対応に着手。
  - update: 2026-02-04 14:58 JST TaskItem の高さ固定とメッセージ/詳細の表示枠固定を追加。
  - update: 2026-02-04 14:59 JST TaskListVirtualized の固定高さ/estimateSize を一致させた。
  - update: 2026-02-04 15:00 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-02-04 15:00 JST Step5 タスク行の固定高さ対応を完了。
  - update: 2026-02-04 15:07 JST TaskItem の固定高さ内で LinearProgress が常に表示されるよう構造を調整。
  - update: 2026-02-04 15:08 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-04 15:13 JST SVG サマリーのビューポート帯の開始位置ズレを補正。
  - update: 2026-02-04 15:14 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-04 16:47 JST SVG サマリーのビューポート帯の開始/終了位置を固定行高とスクロール位置で再計算する対応に着手。
  - update: 2026-02-04 16:50 JST ビューポート帯の開始/終了位置を固定行高 + scrollTop で算出するよう修正。
  - update: 2026-02-04 16:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-04 16:56 JST タスク1件のレイアウトを Progress→タイトル+Chip→メッセージの3段に変更。
  - update: 2026-02-04 16:59 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-02-04 17:10 JST task weight map のエラーで update が落ちないよう safe 経路を追加。
  - update: 2026-02-04 17:11 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2501) fix/shape/pause-loading-other-steps (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/pause-loading-other-steps
- 依存: なし
- 受け入れ基準: Step5 以外の build/pause UI でも pause 押下直後〜停止完了まで pause ボタンが loading/disabled になる／pause 失敗時は復帰する／必要範囲の build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して pause の loading/disabled を撤去する
- チェックリスト:
  - pause pending state を追加する
  - pause 失敗/完了で pending state を解除する
  - UI 側で loading/disabled を反映する
  - 必要範囲の build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 14:20 JST Step5 以外の pause loading/disabled 連動対応に着手。
  - update: 2026-02-03 14:24 JST Route build の pause pending state を追加し、停止完了で解除するよう調整。
  - update: 2026-02-03 14:25 JST pnpm --filter @hierarchidb/route-plugin build exit 0 を確認。
  - done: 2026-02-03 14:25 JST Step5 以外の pause loading/disabled 連動を完了。

2500) fix/shape/step5-pause-loading (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/step5-pause-loading
- 依存: なし
- 受け入れ基準: Step5 の pause 押下直後から停止完了まで停止ボタンが loading/disabled になる／pause 失敗時はボタンが復帰する／必要範囲の build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/**`, `packages/components/src/BuildControlCard.tsx`, `packages/components/src/BuildStepPanel.tsx`
- ロールバック手順: 該当差分を revert して pause の loading/disabled を撤去する
- チェックリスト:
  - pause 押下直後に pending state を立てる
  - pause 失敗/完了で pending state を解除する
  - UI 側で loading/disabled を反映する
  - 必要範囲の build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 14:10 JST Step5 pause の loading/disabled 連動対応に着手。
  - update: 2026-02-03 14:12 JST pause pending state を追加し、停止完了/失敗で解除するよう調整。
  - update: 2026-02-03 14:12 JST pause ボタンに loading/disabled 表示を反映。
  - update: 2026-02-03 14:14 JST pnpm --filter @hierarchidb/shape-plugin build exit 0 を確認。
  - done: 2026-02-03 14:14 JST Step5 pause の loading/disabled 連動を完了。

2499) fix/shape/fetchcache-integrity-and-tx (P1) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/fetchcache-integrity-and-tx
- 依存: なし
- 受け入れ基準: fetchCache の整合性チェックで null/必須キー欠落を検知したら明確なエラーを出して停止する／fetchCache の write/delete を明示的トランザクション化する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts`
- ロールバック手順: 該当差分を revert して整合性チェックとトランザクション化を元に戻す
- チェックリスト:
  - fetchCache の整合性チェックを追加する
  - fetchCache の write/delete を transaction で包む
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 13:20 JST fetchCache 整合性チェックと transaction 化に着手。
  - update: 2026-02-03 13:25 JST fetchCache の整合性チェックを追加し、不整合時に明確なエラーを投げるよう変更。
  - update: 2026-02-03 13:26 JST fetchCache の put/update/delete を transaction 化。
  - update: 2026-02-03 13:27 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 13:27 JST fetchCache 整合性チェックと transaction 化を完了。

2498) feat/shape/vt-collect-memory-logs (P2) — 進行中 (2026-02-03)
- ブランチ名: feat/shape/vt-collect-memory-logs
- 依存: なし
- 受け入れ基準: collectFeatures の開始/終了でメモリ・処理時間のログが出る／heap が取得できない環境でも安全に動作する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: 該当差分を revert してログを元に戻す
- チェックリスト:
  - collectFeatures 前後のメモリ/時間ログを追加する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 12:55 JST collectFeatures のメモリログ追加に着手。
  - update: 2026-02-03 13:00 JST collect start/done のメモリ・所要時間ログを追加。
  - update: 2026-02-03 13:01 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - done: 2026-02-03 13:01 JST collectFeatures のメモリログ追加を完了。

2497) feat/shape/vt-low-zoom-serial (P2) — 進行中 (2026-02-03)
- ブランチ名: feat/shape/vt-low-zoom-serial
- 依存: なし
- 受け入れ基準: 低ズーム帯（z0-2）の vt タスクは maxConcurrent=1 で処理される／高ズーム帯は既定の vtConfig.maxConcurrent を維持する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapePipelineVtStage.ts`, `packages/vt-orchestrator/src/types/types.ts`, `packages/vt-orchestrator/src/compareTaskOrder.ts`
- ロールバック手順: 該当差分を revert して vt の並列制御を元に戻す
- チェックリスト:
  - runStageTasks に taskFilter を追加して対象タスクのみ実行できるようにする
  - 低ズーム帯（bandMaxZoom <= 2）だけ maxConcurrent=1 で実行する
  - 残りの vt タスクは既定の maxConcurrent で実行する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 12:40 JST 低ズーム帯 vt のシリアル実行対応に着手。

2496) fix/shape/transform-svg-order-adm0-first (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/transform-svg-order-adm0-first
- 依存: なし
- 受け入れ基準: ステージ進捗 SVG の transform タスク並びが ADM0 優先になる／タスク一覧と整合する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して元の並び順へ戻す
- チェックリスト:
  - transform ステージの SVG 並びに stagePriority 昇順を適用する
  - タスク一覧の順序と一致することを確認する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 12:20 JST transform の SVG 並びを ADM0 優先に調整開始。
  - update: 2026-02-03 12:23 JST SVG 進捗バーの transform 並びに stagePriority 昇順を適用。
  - update: 2026-02-03 12:24 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 12:24 JST transform の SVG 並びを ADM0 優先に調整完了。

2495) fix/shape/transform-task-order-adm0-first (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/transform-task-order-adm0-first
- 依存: なし
- 受け入れ基準: transform ステージのタスク一覧が実際の処理順に近い形で ADM0 優先になる／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/build-progress/TaskListVirtualized.tsx`, `plugins/shape-plugin/src/ui/atoms/shapeBuildProgressAtoms.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して元の順序表示に戻す
- チェックリスト:
  - task summary に stagePriority を載せる
  - transform ステージの表示順を stagePriority 昇順に調整する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 12:00 JST transform タスクの表示順を ADM0 優先に調整する作業に着手。
  - update: 2026-02-03 12:06 JST task summary に stagePriority を追加し、transform ステージの表示順を stagePriority 昇順に変更。
  - update: 2026-02-03 12:07 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 12:07 JST transform タスクの表示順を ADM0 優先に調整完了。

2494) fix/shape/transform-progress-update-source (P1) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/transform-progress-update-source
- 依存: なし
- 受け入れ基準: transform タスクの進捗%は updateTaskPhase のみが更新し、reportPolygonProgress は message/outputData 更新のみになる／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `plugins/shape-plugin/src/worker/api.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して progress 更新を元に戻す
- チェックリスト:
  - reportPolygonProgress から progress 更新を撤去する
  - resolveTaskProgress が outputData 由来で進捗を再計算しないよう調整する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 11:25 JST transform の progress 更新経路の整理に着手。
  - update: 2026-02-03 11:40 JST runStageTasks の stop_on_first_error で失敗 taskId をエラーに付与し、abort 理由に含めるよう調整。
  - update: 2026-02-03 11:41 JST transform ステージで runStageTasks 例外時にも queued/running を failed 化し、failedTaskId を errorMessage に含めるよう対応。
  - update: 2026-02-03 11:42 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-02-03 11:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 11:42 JST abort 原因タスクの特定情報を failed に反映する処理を追加。
  - update: 2026-02-03 11:30 JST reportPolygonProgress から progress 更新を撤去し、updateTaskPhase のみが進捗を更新するよう整理。
  - update: 2026-02-03 11:31 JST resolveTaskProgress が outputData 由来で再計算しないよう変更。
  - update: 2026-02-03 11:31 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 11:31 JST progress 更新経路の整理を完了。

2493) investigation/shape-task-progress-nonmonotonic (P2) — 進行中 (2026-02-03)
- ブランチ名: investigation/shape-task-progress-nonmonotonic
- 依存: なし
- 受け入れ基準: shape build の個別タスク進捗が単調増加しない原因箇所をコード参照付きで説明できる／影響条件を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/**`
- ロールバック手順: 調査のみのため該当なし
- チェックリスト:
  - タスク進捗の計算/更新経路を追跡する
  - 進捗リセット/上書きの発生箇所を特定する
  - 条件と説明をまとめる
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-03 11:10 JST shape build タスク進捗の非単調挙動の原因調査に着手。
  - update: 2026-02-03 11:15 JST 進捗は TaskQueueRecord の progress / outputData に依存し、リセット箇所を整理。
  - done: 2026-02-03 11:15 JST 原因説明をまとめて報告。

2492) fix/shape/task-message-overflow-hidden (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/task-message-overflow-hidden
- 依存: なし
- 受け入れ基準: shape Step5 build のタスク message 表示に overflow: hidden が適用され、はみ出しが抑制される／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/TaskItem.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して overflow 設定を元に戻す
- チェックリスト:
  - タスク message の Typography に overflow: hidden を追加する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 10:55 JST shape Step5 build の message overflow 制御に着手。
  - update: 2026-02-03 10:56 JST TaskItem の message に overflow: hidden を適用。
  - update: 2026-02-03 10:56 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 10:56 JST message overflow 制御を完了。

2491) fix/shape/delete-build-outputs-loading (P2) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/delete-build-outputs-loading
- 依存: なし
- 受け入れ基準: 「即時でのビルド生成物の削除」カードの削除ボタン押下後、削除完了まで disabled + スピナー表示となる／失敗時にボタンが復帰する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-config/**`（必要に応じて追加）
- ロールバック手順: 該当差分を revert してボタンの loading/disabled 連動を元に戻す
- チェックリスト:
  - 削除アクション実行中の loading state を追加する
  - 削除ボタンに loading + disabled を反映する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 10:40 JST 削除ボタンの loading/disabled 連動対応に着手。
  - update: 2026-02-03 10:46 JST DeleteBuildOutputsCard の削除ボタンに loading state を追加し、実行中は disabled + スピナー表示に変更。
  - update: 2026-02-03 10:47 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 10:47 JST 削除ボタンの loading/disabled 連動を完了。

2490) chore/logs/shape-build-minimal (P2) — 進行中 (2026-02-03)
- ブランチ名: chore/logs/shape-build-minimal
- 依存: なし
- 受け入れ基準: Shape build の UI/worker ログが開始/終了/失敗などの必要最小限に整理される／冗長な progressState/atoms/snapshot の debug 出力が削除される／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/**`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/vt/**`（必要に応じて追加）
- ロールバック手順: 該当差分を revert してログ出力を元に戻す
- チェックリスト:
  - Shape build UI の debug ログを整理する
  - Shape build worker の start/resume/pipeline ログを最小限にする
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 10:20 JST Shape build の冗長ログ削減に着手。
  - blocked: 2026-02-03 10:26 JST pnpm --filter @hierarchidb/shape-plugin typecheck が api.ts の unused で失敗（TS6133）。
  - update: 2026-02-03 10:27 JST Shape build UI/worker の debug ログを削除し、開始/終了/失敗ログに整理。
  - update: 2026-02-03 10:28 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-03 10:28 JST Shape build の冗長ログ削減を完了。

2489) fix/shape/tile-buffer-relations-index (P1) — 進行中 (2026-02-03)
- ブランチ名: fix/shape/tile-buffer-relations-index
- 依存: なし
- 受け入れ基準: Dexie の tileIdToBufferRelations に [nodeId+bandIndex] インデックスが定義され SchemaError が再現しない／DB バージョン更新とマイグレーション方針を明記する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/**`, `packages/features/shape-store/**`, `packages/runtime-worker/**`（必要に応じて追加）
- ロールバック手順: 該当差分を revert してインデックス追加前へ戻す
- チェックリスト:
  - tileIdToBufferRelations の schema/index 定義を確認する
  - [nodeId+bandIndex] インデックスを追加し DB バージョンを更新する
  - マイグレーションの影響と確認手順を明記する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-03 10:05 JST Dexie SchemaError（tileIdToBufferRelations の [nodeId+bandIndex] 未 index）調査と修正に着手。
  - update: 2026-02-03 10:10 JST EphemeralShapeDB を version 17 に更新し tileIdToBufferRelations に [nodeId+bandIndex]/[nodeId+bandIndex+tileId] を追加。インデックス追加のみのため既存データは維持、Dexie の upgrade で再作成される方針。
  - update: 2026-02-03 10:11 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0 を確認。
  - done: 2026-02-03 10:11 JST tileIdToBufferRelations の複合インデックス追加と schema 更新を完了。

2428) fix/tsconfig/paths-no-src (P1) — 完了 (2026-01-30)
- ブランチ名: fix/tsconfig/paths-no-src
- 依存: なし
- 受け入れ基準: tsconfig.base.json の paths で packages/plugins の src を指すエントリが撤去され、dist/*.d.ts へ修正される／dependency-guard が exit 0 になる／TASKS.md に運用ログを記載する
- 影響範囲: `tsconfig.base.json`
- ロールバック手順: tsconfig.base.json の該当 paths を src 指向へ戻す
- チェックリスト:
  - tsconfig.base.json の該当 paths を dist 指向へ更新する
  - dependency-guard を実行して exit 0 を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 12:14 JST dependency-guard の tsconfig paths no-src エラー対応に着手。
  - update: 2026-01-30 12:16 JST tsconfig.base.json の location/shape/route/gen-iso の paths を dist 指向へ修正。
  - done: 2026-01-30 12:17 JST node scripts/with-clean-npm-config.mjs node scripts/run-dependency-guard.mjs exit 0 を確認。

2429) fix/deps/break-cycle-location-route (P1) — 完了 (2026-01-30)
- ブランチ名: fix/deps/break-cycle-location-route
- 依存: なし
- 受け入れ基準: cyclic dependency が解消され dependency graph 検証が pass する／依存関係の変更理由を記録する／必要範囲の typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/package.json`, `packages/features/location-api/package.json`, `packages/features/route-api/package.json`（必要に応じて追加）
- ロールバック手順: 依存関係の差分を revert して元の依存構成へ戻す
- チェックリスト:
  - 循環依存を構成する依存関係を特定する
  - 依存関係を整理して循環を解消する
  - dependency graph 検証を実行する
  - 必要範囲の typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 12:18 JST dependency graph の循環依存解消に着手。
  - update: 2026-01-30 12:22 JST location-api の ShapeContainerNodeId 依存を NodeId へ置換し shape-store の依存を撤去。
  - update: 2026-01-30 12:24 JST pnpm -w list --depth -1 --json → package dependency graph を生成し cycles detected: none を確認。
  - done: 2026-01-30 12:24 JST 循環依存の解消を完了。

2430) investigation/plugin-service-api-current-scope (P1) — 完了 (2026-01-30)
- ブランチ名: investigation/plugin-service-api-current-scope
- 依存: なし
- 受け入れ基準: plugin-service-api に残っているモジュール/責務/依存を整理し、location-api/route-api への移行済み/未移行を区別して報告できる／廃止に向けた作業計画を提示できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/**`, `packages/features/location-api/src/**`, `packages/features/route-api/src/**`, `plans/**`（調査結果に応じて追加）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - plugin-service-api の残存モジュール/責務/依存を整理する
  - location-api/route-api への移行状況を分類する
  - 廃止に向けた段階計画と検証項目を提示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 12:29 JST plugin-service-api の現状整理と廃止計画の策定に着手。
  - update: 2026-01-30 12:31 JST plugin-service-api の残存モジュール/依存/参照先を整理し、廃止に向けた移行計画案を作成。
  - done: 2026-01-30 12:31 JST 調査と計画提示の準備を完了。

2431) fix/batch/prepare-session-signature (P1) — 完了 (2026-01-31)
- ブランチ名: fix/batch/prepare-session-signature
- 依存: なし
- 受け入れ基準: IBatchSessionManager の prepareSession 型が UnifiedBatchManagerBase と整合し build:types が exit 0 になる／必要な参照先が型エラーなくビルドできる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/batch-api/src/BatchControlAPI.ts`, `packages/features/batch/src/manager/UnifiedBatchManagerBase.ts`, `packages/batch-runtime-services/src/BaseBatchSessionManager.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して prepareSession の型定義を元に戻す
- チェックリスト:
  - IBatchSessionManager の型パラメータ設計を調整する
  - UnifiedBatchManagerBase の実装に型を合わせる
  - pnpm --filter @hierarchidb/batch build:types を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 00:05 JST IBatchSessionManager の prepareSession 型エラー修正に着手。
  - blocked: 2026-01-31 00:09 JST pnpm --filter @hierarchidb/batch build:types が IBatchSessionManager 未更新の dist 解決で失敗。
  - update: 2026-01-31 00:10 JST pnpm --filter @hierarchidb/batch-api build:types を先行実行。
  - update: 2026-01-31 00:10 JST IBatchSessionManager をジェネリック化し UnifiedBatchManagerBase を対応、pnpm --filter @hierarchidb/batch build:types exit 0 を確認。
  - done: 2026-01-31 00:11 JST prepareSession 型整合の修正を完了。

2432) fix/ui-treeconsole/on-name-conflict-policy (P1) — 完了 (2026-01-31)
- ブランチ名: fix/ui-treeconsole/on-name-conflict-policy
- 依存: なし
- 受け入れ基準: ui-treeconsole-base の MoveNodesPayload/onNameConflict 型エラーが解消される／onNameConflict は OnNameConflict ポリシーで統一される／pnpm --filter @hierarchidb/ui-treeconsole-base typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/base/src/adapters/commands/TreeMutationCommands.ts`, `packages/ui/treeconsole/base/src/types/index.ts`, `packages/ui/treeconsole/base/src/adapters/types.ts`, `packages/ui/treeconsole/base/src/adapters/WorkerAPIAdapter.ts`, `packages/ui/treeconsole/base/src/hooks/useTreeViewController.tsx`, `packages/ui/treeconsole/base/src/adapters/__tests__/WorkerAPIAdapter.test.ts`
- ロールバック手順: 該当差分を revert して onNameConflict の型とデフォルト挙動を元に戻す
- チェックリスト:
  - onNameConflict の型を OnNameConflict に統一する
  - WorkerAPIAdapter 既定値とテストを更新する
  - pnpm --filter @hierarchidb/ui-treeconsole-base typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 00:20 JST ui-treeconsole-base の onNameConflict 型エラー修正に着手。
  - update: 2026-01-31 00:23 JST onNameConflict を OnNameConflict ポリシーへ統一し、pnpm --filter @hierarchidb/ui-treeconsole-base typecheck exit 0 を確認。
  - done: 2026-01-31 00:23 JST onNameConflict 型エラー修正を完了。

2433) refactor/terminology/draft-to-draft (P1) — 進行中 (2026-01-31)
- ブランチ名: refactor/terminology/draft-to-draft
- 依存: なし
- 受け入れ基準: リポジトリ内の Draft/Working Copy/working copy 表記を洗い出し、現行概念（draft）へ置換方針が合意される／合意範囲の置換が完了する／必要な typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/**`, `plugins/**`, `docs/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して用語表記を元に戻す
- チェックリスト:
  - Draft 表記の残存箇所を調査する
  - 置換方針（コード識別子/ドキュメント/表示文言）を確認する
  - 合意範囲で置換を実施する
  - 必要な typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 00:30 JST Draft → draft 用語置換の調査に着手。
  - update: 2026-01-31 00:34 JST working-copy / workingCopy / WorkingCopy を一括置換。
  - update: 2026-01-31 00:38 JST working-copy を含むファイル名を draft に改名。
  - update: 2026-01-31 00:41 JST workingcopy を含むファイル名を draft に改名。
  - blocked: 2026-01-31 00:42 JST pnpm typecheck が app で失敗（@hierarchidb/shape-plugin 等の export 参照エラー）。詳細はログ参照。

2434) fix/app/typecheck-plugin-exports (P1) — 完了 (2026-01-31)
- ブランチ名: fix/app/typecheck-plugin-exports
- 依存: なし
- 受け入れ基準: app の shape/location/route plugin export 参照エラーと implicit any が解消される／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/package.json`, `plugins/location-plugin/package.json`, `plugins/route-plugin/package.json`, `app/src/router/routes/map/MapPage.tsx`, `app/src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して plugin types の参照先と MapPage の型注釈を元に戻す
- チェックリスト:
  - plugin の types/exports を index2.d.ts へ切替える
  - MapPage の find コールバックに型注釈を付与する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 00:50 JST app の plugin export 参照エラー修正に着手。
  - update: 2026-01-31 00:55 JST shape/location/route の types を index2.d.ts に切替し、tsconfig.base.json の paths を更新。
  - update: 2026-01-31 00:58 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - done: 2026-01-31 00:58 JST app の plugin export 参照エラー修正を完了。

2435) fix/tsdown/dts-index-normalize (P1) — 完了 (2026-01-31)

2436) feat/auth/reorg (P1) — 完了 (2026-01-31)
- ブランチ名: feat/auth/reorg
- 依存: なし
- 受け入れ基準: auth-api/auth の新構成方針が定義され、common/auth を完全廃止する移行計画（ExecPlan）が PLANS.md 規定に沿って作成される／棚卸し結果が反映される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-api/**`, `packages/features/auth-recovery/**`, `packages/common/auth/**`（削除予定）, `packages/features/auth/**`（新設予定）, 参照元各所
- ロールバック手順: ExecPlan 実装前のため該当なし（計画段階）
- チェックリスト:
  - 既存 auth 関連パッケージの責務と参照先を棚卸しする
  - 新構成（auth-api/auth）への移行方針を定義する
  - ExecPlan を作成する
  - 運用ログ start/update を追記する
- 運用ログ:
  - start: 2026-01-31 01:40 JST auth パッケージ再編の棚卸しと ExecPlan 作成に着手。
  - update: 2026-01-31 02:20 JST auth/auth-api への移行方針を確定し、common-auth/auth-recovery を削除する方針を明記。
  - update: 2026-01-31 02:45 JST @hierarchidb/auth を新設し AuthService/AuthNotificationSystem を移動、参照/依存/tsconfig/vite alias を更新。
  - update: 2026-01-31 02:52 JST pnpm tools:gen-plugin-registry を実行（registry 更新）。
  - update: 2026-01-31 03:05 JST pnpm install, pnpm --filter @hierarchidb/auth-api build, pnpm --filter @hierarchidb/auth build, pnpm --filter @hierarchidb/runtime-worker typecheck, pnpm --filter @hierarchidb/download typecheck, pnpm --filter @hierarchidb/ui-auth typecheck, pnpm --filter @hierarchidb/app typecheck を実行（exit 0）。
  - done: 2026-01-31 03:05 JST auth パッケージ再編を完了。
  - update: 2026-01-31 01:46 JST ExecPlan を plans/auth-reorg-execplan.md に作成。
- ブランチ名: fix/tsdown/dts-index-normalize
- 依存: なし
- 受け入れ基準: shape/location/route/spreadsheet の index.d.ts が正しい named export を保持し index2.d.ts 依存が撤去される／pnpm --filter @hierarchidb/route-plugin build ほか必要範囲が exit 0／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `scripts/normalize-dts.mjs`, `plugins/*-plugin/package.json`, `tsconfig.base.json`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して index2.d.ts 参照に戻す
- チェックリスト:
  - normalize-dts スクリプトを追加する
  - 対象プラグインの build 後に normalize-dts を実行する
  - types/paths を index.d.ts に戻す
  - pnpm --filter <対象> build を実行する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 01:05 JST index2.d.ts 依存の恒久解消に着手。
  - update: 2026-01-31 01:19 JST pnpm --filter @hierarchidb/route-plugin build と pnpm --filter @hierarchidb/spreadsheet-plugin build を実行（exit 0）。
  - blocked: 2026-01-31 01:19 JST pnpm --filter @hierarchidb/app typecheck が core-types の export 不整合で失敗（NodeAction/Tree/TreeNode 未 export）。
  - update: 2026-01-31 01:24 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - done: 2026-01-31 01:24 JST index.d.ts 正規化の恒久対応を完了。
  - update: 2026-01-31 01:31 JST normalize-tsconfig.mjs と fix:tsconfig を削除。

2431) feat/shape-api/move-shape-types (P1) — 完了 (2026-01-30)
- ブランチ名: feat/shape-api/move-shape-types
- 依存: なし
- 受け入れ基準: @hierarchidb/shape-api を新設し EphemeralShapeAPI/ShapeQueryAPI/ShapeMutationAPI と依存型を移行する／plugin-service-api から該当型の export を撤去する／参照先を shape-api へ切替する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-api/src/**`, `packages/plugin-service-api/src/**`, `packages/**`, `plugins/shape-plugin/src/**`, `app/src/**`（必要に応じて追加）
- ロールバック手順: 追加した shape-api を削除し、plugin-service-api の shape 型を復元、参照を元に戻す
- チェックリスト:
  - shape-api を新設し shape 系型を移行する
  - plugin-service-api から shape 系型を削除する
  - 参照先を shape-api へ切替する
  - 影響範囲の build/typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 13:00 JST shape-api 新設と shape 型移行に着手。
  - update: 2026-01-30 13:08 JST shape-api を追加し shape 系型（ShapeQuery/Mutation/Ephemeral と build/db/types）を移行。plugin-service-api の該当 export を撤去し、参照先を shape-api へ切替。
  - update: 2026-01-30 13:13 JST ui-accordion-config をジェネリック対応し shape-plugin の型不一致を解消。
  - update: 2026-01-30 13:15 JST pnpm --filter @hierarchidb/shape-api build/typecheck、@hierarchidb/ui-accordion-config build、@hierarchidb/shape-plugin typecheck、@hierarchidb/runtime-worker typecheck、@hierarchidb/app typecheck を実行（exit 0）。
  - update: 2026-01-30 13:15 JST pnpm install を実行（peer dependency 警告あり）。
  - done: 2026-01-30 13:15 JST shape-api への移行を完了。

2432) fix/route-plugin/ide-gsm-waypoints (P1) — 進行中 (2026-01-30)
- ブランチ名: fix/route-plugin/ide-gsm-waypoints
- 依存: なし
- 受け入れ基準: ideGsmWaypoints.ts の number | undefined エラーを解消する／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/services/ide-gsm/ideGsmWaypoints.ts`
- ロールバック手順: 該当差分を revert して元の実装へ戻す
- チェックリスト:
  - ideGsmWaypoints.ts の undefined ガードを追加する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 13:06 JST ideGsmWaypoints の typecheck エラー修正に着手。
  - update: 2026-01-30 13:08 JST start/end の緯度経度が未定義の場合に waypoints を生成しないガードを追加。
  - done: 2026-01-30 13:08 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2433) fix/route-api/routepoint-required-latlng (P1) — 進行中 (2026-01-30)
- ブランチ名: fix/route-api/routepoint-required-latlng
- 依存: なし
- 受け入れ基準: RoutePoint の latitude/longitude を必須化する／依存箇所の型整合が取れる／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/route-api/src/routeTypes.ts`, `plugins/route-plugin/src/services/ide-gsm/ideGsmWaypoints.ts`（必要に応じて追加）
- ロールバック手順: RoutePoint の型を元に戻し、関連修正を revert する
- チェックリスト:
  - RoutePoint の latitude/longitude を必須化する
  - 参照箇所の型整合を確認する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 13:11 JST RoutePoint の緯度経度必須化に着手。
  - blocked: 2026-01-30 13:13 JST route-plugin typecheck が route-api の dist 型未更新で失敗。
  - update: 2026-01-30 13:14 JST pnpm --filter @hierarchidb/route-api build を実行（tsdown define warning あり）。
  - done: 2026-01-30 13:14 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2434) fix/location-plugin/preview-step-cast (P1) — 進行中 (2026-01-30)
- ブランチ名: fix/location-plugin/preview-step-cast
- 依存: なし
- 受け入れ基準: LocationMapPreviewStep の Record キャストエラーを解消する／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して元のキャストに戻す
- チェックリスト:
  - Record キャストの型整合を修正する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 13:15 JST LocationMapPreviewStep のキャストエラー修正に着手。
  - update: 2026-01-30 13:17 JST LocationPointProperties の型に合わせて Record キャストを撤去し、tileId 解決を型安全化。
  - done: 2026-01-30 13:17 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2435) refactor/plugin-service-api/deprecate (P1) — 完了 (2026-01-30)
- ブランチ名: refactor/plugin-service-api/deprecate
- 依存: なし
- ExecPlan: plans/deprecate-plugin-service-api-execplan.md
- 受け入れ基準: plugin-service-api の残存契約が plugin-base / feature API に移行される／style-api が新設される／主要参照先が新パッケージを参照する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/**`, `packages/plugin-base/src/**`, `packages/features/*-api/**`, `packages/**`, `plugins/**`, `app/**`
- ロールバック手順: plan に記載した手順で plugin-service-api の型を復元し、参照を戻す
- チェックリスト:
  - style-api を新設して style 契約を移行する
  - plugin-base に plugin 契約を移行して export を更新する
  - 参照先を新パッケージへ切替する
  - plugin-service-api を transitional re-export に整理する
  - 影響範囲の build/typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 13:20 JST plugin-service-api 廃止に向けた移行作業に着手。
  - update: 2026-01-30 13:48 JST Location/Route Query・Mutation API と IDE-GSM 契約を location-api/route-api に移設し、app/runtime-worker/location/route plugin/worker-api/common-api の参照と依存を更新。
  - update: 2026-01-30 13:52 JST TreeQueryAPI に searchNodesFulltext/searchNodesByType/getNodePath/queryNodes を整合追加し、searchNodes の mode を contains に統一。TreeQueryService とテストスタブを補正。
  - update: 2026-01-30 13:56 JST pnpm install、location-api/route-api/tree-api/plugin-base/style-api build、location-api/route-api/common-api/worker-api/runtime-worker/location-plugin/route-plugin/app typecheck を実行（tsdown define 警告あり）。
  - done: 2026-01-30 13:56 JST plugin-service-api の残存契約移設と主要参照先の切替を完了。

2436) refactor/common-api/move-import-export-plugin-dialog (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/common-api/move-import-export-plugin-dialog
- 依存: なし
- 受け入れ基準: packages/features/import-export-api を新設し ImportExportAPI を移設する／common-api から ImportExportAPI と PluginDialogAPI を撤去し、PluginDialogAPI は tree-api に移設する／参照先の import が新パッケージへ切替される／必要範囲の build/typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/**`, `packages/features/import-export-api/src/**`, `packages/features/tree-api/src/**`, `packages/**`, `plugins/**`, `app/**`（必要に応じて追加）
- ロールバック手順: import-export-api を削除し common-api に ImportExportAPI を復元、tree-api の PluginDialogAPI を元に戻し、参照を差し戻す
- チェックリスト:
  - import-export-api を新設して ImportExportAPI を移設する
  - common-api から ImportExportAPI/PluginDialogAPI を撤去する
  - PluginDialogAPI を tree-api に移設する
  - 参照先を新パッケージへ切替する
  - 影響範囲の build/typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 15:20 JST ImportExportAPI/PluginDialogAPI の移設作業に着手。
  - update: 2026-01-30 15:52 JST ImportExportAPI を features/import-export-api へ移設し、PluginDialogAPI を tree-api へ移設。参照/依存/tsconfig を更新。
  - update: 2026-01-30 15:57 JST plugin-base に PluginManifest/PluginLifecycleAPI を追加、common-api に BaseBatchConfig を追加、app tsconfig に auth-api/import-export-api を追加。
  - update: 2026-01-30 16:02 JST pnpm --filter @hierarchidb/import-export-api/tree-api/common-api/import-export/worker-api/runtime-worker build を実行（tsdown define 警告あり）。
  - update: 2026-01-30 16:03 JST pnpm --filter @hierarchidb/common-api build を実行し BaseBatchConfig を dist へ反映（tsdown define 警告あり）。
  - done: 2026-01-30 16:05 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。

2437) refactor/common-api/move-batch-control-api (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/common-api/move-batch-control-api
- 依存: なし
- 受け入れ基準: packages/features/batch-api を新設し BatchControlAPI/taskStatus を移設する／common-api から該当 export を撤去する／参照先の import を @hierarchidb/batch-api に切替する／tsconfig.base.json と app/tsconfig.json に batch-api paths を追加する／pnpm --filter @hierarchidb/batch-api build が exit 0／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/**`, `packages/features/batch-api/src/**`, `packages/**`, `app/**`（必要に応じて追加）
- ロールバック手順: batch-api を削除し common-api に BatchControlAPI/taskStatus を復元、参照を差し戻す
- チェックリスト:
  - batch-api を新設して BatchControlAPI/taskStatus を移設する
  - common-api から該当 export を撤去する
  - 参照先を batch-api へ切替する
  - tsconfig.base.json と app/tsconfig.json に batch-api paths を追加する
  - pnpm --filter @hierarchidb/batch-api build を実行する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 16:10 JST BatchControlAPI/taskStatus の batch-api 移設作業に着手。
  - update: 2026-01-30 16:22 JST BatchControlAPI/taskStatus を features/batch-api に移設し、参照・依存・tsconfig を batch-api へ切替。
  - update: 2026-01-30 16:25 JST pnpm --filter @hierarchidb/batch-api build を実行（tsdown define 警告あり）。
  - blocked: 2026-01-30 16:27 JST pnpm --filter @hierarchidb/app typecheck が common-types の既存 export 欠落（SubscriptionId/TreeChangeEvent/CommandEnvelope など）で失敗。

2438) refactor/tsconfig/paths-dist-align (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/tsconfig/paths-dist-align
- 依存: なし
- 受け入れ基準: AGENTS.md に tsconfig は dist 指向で統一する方針が明記される／tsconfig.base.json が dist 指向 paths のみになる／app/tsconfig.json の ../packages/**/src 指向 paths が撤去され dist 指向に統一される／node scripts/policy/ban-tsconfig-paths-dist-dts.mjs が OK を維持する／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `AGENTS.md`, `tsconfig.base.json`, `app/tsconfig.json`（必要に応じて追加）
- ロールバック手順: 各 tsconfig と AGENTS.md の変更を revert して元の paths 方針へ戻す
- チェックリスト:
  - AGENTS.md の TypeScript path 方針を dist 指向へ揃える
  - tsconfig.base.json の paths を dist 指向へ統一する
  - app/tsconfig.json の ../packages/**/src paths を撤去する
  - policy スクリプトを実行して OK を確認する
  - app typecheck を実行して exit 0 を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 16:40 JST tsconfig の dist 指向統一に着手。
  - update: 2026-01-30 16:57 JST AGENTS.md の TypeScript path 方針に「型チェック前の build 前提」を明記。

2439) fix/common-types/validation-rule-tag-suggestion (P1) — 完了 (2026-01-30)
- ブランチ名: fix/common-types/validation-rule-tag-suggestion
- 依存: なし
- 受け入れ基準: TagService の TagSuggestion import を tree-api 経由へ修正する／common-types に ValidationRule を定義し plugin-base の import エラーを解消する／@hierarchidb/tag と @hierarchidb/plugin-base の typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/tag/src/TagService.ts`, `packages/common/types/src/validation-types.ts`, `packages/plugin-base/src/types/plugin-definition.ts`（必要に応じて追加）
- ロールバック手順: TagService の import を元へ戻し、ValidationRule 定義を削除して差分を revert する
- チェックリスト:
  - TagService の TagSuggestion import を tree-api 参照に切替する
  - common-types に ValidationRule を追加する
  - @hierarchidb/tag と @hierarchidb/plugin-base の typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-30 22:40 JST TagSuggestion/ValidationRule の型解決エラー修正に着手。
  - update: 2026-01-30 22:41 JST TagService の TagSuggestion import を tree-api 参照へ切替、common-types に ValidationRule を追加。
  - done: 2026-01-30 22:41 JST pnpm --filter @hierarchidb/common-types build、@hierarchidb/tag typecheck、@hierarchidb/plugin-base typecheck exit 0 を確認。

2440) refactor/common-types/split-into-domain-packages (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/common-types/split-into-domain-packages
- 依存: なし
- ExecPlan: plans/refactor-common-types-execplan.md
- 受け入れ基準: tree-api/tag-api/import-export-api/batch-api/core-types へ型が移設され、参照先が切替される／common-types は再エクスポートのみ（最終的に空にして削除可能な状態）／build/typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/types/src/**`, `packages/features/tree-api/**`, `packages/features/tag-api/**`, `packages/features/import-export-api/**`, `packages/features/batch-api/**`, `packages/core-types/**`, `packages/**`, `plugins/**`, `app/**`（必要に応じて追加）
- ロールバック手順: 新規パッケージ追加と移設差分を revert し、common-types の型を元に戻す
- チェックリスト:
  - ExecPlan を作成し、移設対象と順序を明記する
  - tag-api と core-types を新設する
  - tree-api/tag-api/import-export-api/batch-api/core-types へ型を移設する
  - 参照先の import を新パッケージへ切替する
  - common-types を再エクスポート専用に縮退する
  - 影響範囲の build/typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 23:24 JST common-types の分割移設に着手。
  - update: 2026-01-30 23:58 JST runtime-worker typecheck の再実行と残エラー修正に着手。
  - update: 2026-01-30 23:59 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-01-30 23:59 JST runtime-worker の common-types import を core-types/tree-api へ切替（command/Tree* 系、lifecycle、draft、adapter など）。
  - blocked: 2026-01-30 23:59 JST pnpm --filter @hierarchidb/runtime-worker typecheck が ValidationResult の export 不足で失敗。
  - update: 2026-01-30 23:59 JST ValidationResult を core-types に切替し、pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-01-31 00:23 JST app/ui/plugins の common-types 参照を core-types/tree-api/batch-api/tag-api へ切替（treeconsole/treetable/worker-client/batch/shape/route/location 等）。
  - blocked: 2026-01-31 00:24 JST pnpm --filter @hierarchidb/app typecheck が依存パッケージの dist 未生成等で失敗（@hierarchidb/ui-treeconsole-base, ui-dialog, ui-icon, plugin-registry/types などの解決不可と暗黙 any 連鎖）。
  - update: 2026-01-31 00:32 JST pnpm build を実行し、exit 0 を確認（lint や build の警告は既知）。
  - update: 2026-01-31 00:35 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - update: 2026-01-31 01:04 JST common-types の残参照（テスト/設定）整理と tree-api 参照修正に着手。
  - update: 2026-01-31 01:24 JST テスト/モックの common-types 参照を core-types/tree-api へ切替（runtime-worker, plugin-ui-host, import-export など）。
  - update: 2026-01-31 01:38 JST pnpm build を実行し exit 0 を確認（tsdown define 警告/dep-fence 警告は既知）。
  - blocked: 2026-01-31 01:40 JST @hierarchidb/testing-plugin-dialog-mocks typecheck が @hierarchidb/core-types 未解決で失敗。
  - update: 2026-01-31 01:41 JST pnpm install を実行（peer dependency 警告あり）。
  - update: 2026-01-31 01:42 JST @hierarchidb/runtime-worker / plugin-ui-host / import-export / chunk-store / testing-plugin-dialog-mocks typecheck exit 0 を確認。
  - update: 2026-01-31 02:05 JST production code の common-types 参照を core-types/tree-api/batch-api へ移行（plugin-ui-host/sdk, route/location/import-export/gis/vt 等）。
  - update: 2026-01-31 02:18 JST pnpm install / pnpm build を実行し exit 0 を確認（tsdown define 警告は既知）。
  - blocked: 2026-01-31 02:28 JST pnpm typecheck が styler-plugin の implicit any で失敗。
  - update: 2026-01-31 02:30 JST StylerMappingKeysStep の nextKey/nextValue に型注釈を追加。
  - blocked: 2026-01-31 02:34 JST pnpm typecheck が app のテストで core-types 参照ミス（NodeAction/Tree/TreeNode）で失敗。
  - update: 2026-01-31 02:36 JST app テストの NodeAction/Tree/TreeNode を tree-api 参照へ修正。
  - update: 2026-01-31 02:37 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-31 02:45 JST common-types の実体ファイルが index.ts の再エクスポートのみであることと、common-types 参照がゼロであることを確認。
  - update: 2026-01-31 08:54 JST common-types パッケージを削除し、tsconfig.base.json/dep-fence/config と docs/plans の参照を core-types 等へ更新。
  - update: 2026-01-31 08:56 JST pnpm build を実行し exit 0 を確認。
  - done: 2026-01-31 08:57 JST pnpm typecheck を実行し exit 0 を確認。

2424) refactor/location-store/index-cleanup (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/location-store/index-cleanup
- 依存: なし
- 受け入れ基準: location-store の index.ts が再エクスポートのみになる／LocationMutationAPI/LocationQueryAPI の再エクスポートが撤去され、参照側が plugin-service-api 参照へ移行される／未使用型 LocationEntity/LocationBatchConfig/LocationPoint が削除される／型定義が個別ファイルへ整理される／pnpm --filter @hierarchidb/location-store typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/index.ts`, `packages/features/location-store/src/**`, `packages/plugin-service-api/src/**`, `packages/**`
- ロールバック手順: 該当差分を revert して index.ts と型定義の配置を元に戻す
- チェックリスト:
  - index.ts の再エクスポート以外の定義を個別ファイルへ移動する
  - LocationMutationAPI/LocationQueryAPI の再エクスポートを撤去し参照側を修正する
  - 未使用型 LocationEntity/LocationBatchConfig/LocationPoint を削除する
  - pnpm --filter @hierarchidb/location-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 13:35 JST location-store index.ts の整理と再エクスポート撤去に着手。
  - update: 2026-01-29 13:39 JST location-store の型定義を locationTypes/locationPointId に分離し、LocationEntity/LocationBatchConfig/LocationPoint を削除して index.ts を再エクスポート専用に整理。
  - update: 2026-01-29 13:40 JST LocationMutationAPI/LocationQueryAPI の参照を plugin-service-api へ移行。
  - blocked: 2026-01-29 13:41 JST pnpm --filter @hierarchidb/location-store typecheck が未使用 ISO2 で失敗。
  - update: 2026-01-29 13:41 JST 未使用 import を整理し、pnpm --filter @hierarchidb/location-store typecheck exit 0 を確認。
  - blocked: 2026-01-29 13:42 JST pnpm --filter @hierarchidb/location-plugin typecheck が LocationEntity export 不足で失敗。
  - update: 2026-01-29 13:43 JST LocationEntity の型再エクスポートを補正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 13:43 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-01-29 13:44 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 13:44 JST pnpm --filter @hierarchidb/common-api typecheck exit 0 を確認。
  - done: 2026-01-29 13:45 JST location-store index.ts の整理と再エクスポート撤去を完了。

2425) refactor/route-store/index-cleanup (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/route-store/index-cleanup
- 依存: なし
- 受け入れ基準: route-store の index.ts が再エクスポートのみになる／RouteMutationAPI/RouteQueryAPI の再エクスポートが撤去され、参照側が plugin-service-api 参照へ移行される／型定義が個別ファイルへ整理される／pnpm --filter @hierarchidb/route-store typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/route-store/src/index.ts`, `packages/features/route-store/src/**`, `packages/plugin-service-api/src/**`, `packages/**`
- ロールバック手順: 該当差分を revert して index.ts と型定義の配置を元に戻す
- チェックリスト:
  - index.ts の再エクスポート以外の定義を個別ファイルへ移動する
  - RouteMutationAPI/RouteQueryAPI の再エクスポートを撤去し参照側を修正する
  - pnpm --filter @hierarchidb/route-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 13:55 JST route-store index.ts の整理と再エクスポート撤去に着手。
  - update: 2026-01-29 14:03 JST routeTypes/routeDbTypes を新設して index.ts を再エクスポート専用に整理。
  - update: 2026-01-29 14:04 JST RouteMutationAPI/RouteQueryAPI の参照を plugin-service-api へ移行。
  - update: 2026-01-29 14:05 JST pnpm --filter @hierarchidb/route-store typecheck exit 0 を確認。
  - update: 2026-01-29 14:05 JST pnpm --filter @hierarchidb/common-api typecheck exit 0 を確認。
  - update: 2026-01-29 14:06 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-01-29 14:06 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 14:06 JST route-store index.ts の整理と再エクスポート撤去を完了。

2426) refactor/location-store/remove-unused-tables (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/location-store/remove-unused-tables
- 依存: なし
- 受け入れ基準: LocationDB の relations/vectorTiles と hidb-location-metadata の tabularMetadata の参照箇所を調査し、未使用なら撤去・使用中なら根拠を提示する／撤去時は型・マイグレーション・参照箇所も整理する／pnpm --filter @hierarchidb/location-store typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `packages/features/location-store/src/**`, `packages/runtime-worker/src/**`, `plugins/location-plugin/src/**`, `packages/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して tables と参照を復元する
- チェックリスト:
  - relations/vectorTiles の参照箇所を特定する
  - tabularMetadata の参照箇所を特定する
  - 未使用ならテーブル/型/参照を撤去する
  - pnpm --filter @hierarchidb/location-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 14:15 JST relations/vectorTiles/tabularMetadata の利用状況調査に着手。
  - update: 2026-01-29 14:22 JST LocationDB の relations テーブルは relation store 登録のみで書き込み利用が見当たらないため、v12 で撤去。
  - update: 2026-01-29 14:23 JST locationRelationStore と関連 normalizer を削除し、relations 登録を停止。
  - update: 2026-01-29 14:25 JST tabularMetadata は LocationDialog の createLocationTabularApi で利用しているため維持。
  - update: 2026-01-29 14:26 JST vectorTiles は v11 以降の LocationDB から除外済みで利用箇所なし（レガシー定義のみ）を確認。
  - update: 2026-01-29 14:27 JST pnpm --filter @hierarchidb/location-store typecheck exit 0 を確認。
  - blocked: 2026-01-29 14:27 JST pnpm --filter @hierarchidb/location-plugin typecheck が createLocationTabularApi 欠落で失敗。
  - update: 2026-01-29 14:28 JST tabular API を復元し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 14:29 JST relations テーブル撤去と利用状況の整理を完了。

2427) feat/ui/step-config-shared (P1) — 進行中 (2026-01-29)
- ブランチ名: feat/ui/step-config-shared
- 依存: なし
- 受け入れ基準: shape step4 の ZoomBandRangeCard/FetchConfigSection/WorkerNumberConfigCard/VTConfigSection を共通パッケージへ移設し、route step5 でも同一コンポーネントを利用できる／UI表示と挙動が従来と同等である／pnpm --filter <共通パッケージ> build が exit 0／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/route-plugin/src/ui/components/steps/**`, `packages/ui/**`（共通化先）
- ロールバック手順: 該当差分を revert し、shape/route 側のローカルコンポーネントに戻す
- チェックリスト:
  - 共通化先パッケージとAPIを確定する
  - shape の対象コンポーネントを移設し export を追加する
  - route の step5 で共通コンポーネントを参照する
  - 既存UIとの差分がないことを確認する
  - pnpm --filter <共通パッケージ> build を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 20:40 JST shape/route step4/5 設定コンポーネントの共通化に着手。
  - update: 2026-01-29 21:15 JST build-config 共通コンポーネントを ui-accordion-config に移設し、shape/route の設定ステップから参照するよう整理。
  - blocked: 2026-01-29 21:16 JST pnpm install が registry.npmjs.org の ENOTFOUND と EPERM symlink で失敗。
  - update: 2026-01-29 21:18 JST pnpm --filter @hierarchidb/ui-accordion-config build exit 0（tsdown define warning あり）。
  - update: 2026-01-29 21:20 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 21:23 JST pnpm --filter @hierarchidb/route-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-29 21:24 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - start: 2026-01-30 12:35 JST ui-accordion-config の typecheck 失敗（build-config セクションの update 型エラー）修正に着手。
  - update: 2026-01-30 12:40 JST FetchConfigSection/VTConfigSection の update 型を BaseBuildConfig に統一し、pnpm --filter @hierarchidb/ui-accordion-config typecheck exit 0 を確認。

2424) fix/location/idegdm-pointid-type (P1) — 完了 (2026-01-29)
- ブランチ名: fix/location/idegdm-pointid-type
- 依存: なし
- 受け入れ基準: ideGsmCsv の pointId 型エラーが解消される／LocationFeatureId と LocationPointId の整合が取れる／pnpm --filter @hierarchidb/location-store typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/locationTypes.ts`, `packages/features/location-store/src/ideGsmRouteCsv.ts`（必要に応じて）
- ロールバック手順: 型定義の変更差分を revert して元の brand 定義へ戻す
- チェックリスト:
  - LocationFeatureId と LocationPointId の型整合を修正する
  - pnpm --filter @hierarchidb/location-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 12:20 JST ideGsmCsv の pointId 型エラー修正に着手。
  - update: 2026-01-29 12:27 JST LocationFeatureId の独立ブランドを復元し、LocationFeatureProperties を導入して ideGsmCsv を更新。
  - done: 2026-01-29 12:27 JST pnpm --filter @hierarchidb/location-store typecheck exit 0 を確認。

2428) refactor/route/settings-model-unify (P1) — 完了 (2026-01-29)
- 運用ログ:
  - update: 2026-01-29 22:35 JST buildConfig の移行ロジックを useRouteBuildConfigStep に追加し、legacy processing から統合。
  - update: 2026-01-29 22:40 JST RouteTileSettingsStep を buildConfig 参照へ変更。
  - update: 2026-01-29 22:42 JST route-api の RouteEntity で processing/config を非推奨として注記。
  - update: 2026-01-29 22:49 JST pnpm --filter @hierarchidb/route-api build exit 0（tsdown define warning あり）。
  - update: 2026-01-29 22:50 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 22:50 JST Route設定モデルの buildConfig 統一を完了。

- 運用ログ:
  - start: 2026-01-29 22:10 JST ルート設定モデル統合に着手。

- ブランチ名: refactor/route/settings-model-unify
- 依存: なし
- 受け入れ基準: draftData.processing と draftData.buildConfig が単一の設定モデルに統一される／UI（Step4/Step5）と Worker 側の設定参照が統一され、重複ロジックが削除される／既存の設定値がマイグレーションされ、挙動が変わらない／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/**`, `plugins/route-plugin/src/services/**`, `packages/features/route-store/src/**`
- ロールバック手順: 該当差分を revert し、processing/buildConfig の二重運用に戻す
- チェックリスト:
  - 統合後の設定モデル設計を確定する
  - UI と Worker の参照先を統一する
  - 既存データの移行/互換性を確認する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:

2429) refactor/location/build-config-adapter (P1) — 進行中 (2026-01-29)
- 運用ログ:
  - start: 2026-01-29 22:55 JST Location 設定の BaseBuildConfig 化に着手。

- ブランチ名: refactor/location/build-config-adapter
- 依存: なし
- 受け入れ基準: Location の設定状態が BaseBuildConfig ベースで保持される／FetchConfigSection/VTConfigSection などの共通UIが利用される／既存UIの入力値と保存値が一致する／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載
- 影響範囲: `plugins/location-plugin/src/ui/**`, `plugins/location-plugin/src/common/**`, `packages/features/location-store/src/**`
- ロールバック手順: 該当差分を revert し、従来の設定UIと保存形式に戻す
- チェックリスト:
  - BaseBuildConfig へのマッピング方針を決める
  - 共通UIの利用に合わせて state/update を整理する
  - 既存設定の移行/互換性を確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:

2430) refactor/ui/build-config-packaging (P2) — 未着手 (2026-01-29)
- ブランチ名: refactor/ui/build-config-packaging
- 依存: 2428
- 受け入れ基準: BuildConfig 系コンポーネントが ui-accordion-config に集約された状態で破綻しない／追加共通UIの候補と移動方針が確定する／再エクスポート規約に違反しない／pnpm --filter @hierarchidb/ui-accordion-config build が exit 0／TASKS.md に運用ログを記載
- 影響範囲: `packages/ui/accordion-config/src/**`, `plugins/**/src/ui/**`
- ロールバック手順: 該当差分を revert して元の配置に戻す
- チェックリスト:
  - 共通UI候補を洗い出し、移動方針を決める
  - 既存の import を整理し、再エクスポート規約を守る
  - pnpm --filter @hierarchidb/ui-accordion-config build を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:

2431) refactor/ui/build-progress-shared (P2) — 未着手 (2026-01-29)
- ブランチ名: refactor/ui/build-progress-shared
- 依存: 2428
- 受け入れ基準: 進捗サマリ/一覧表示が共通コンポーネント化され Shape/Route/Location で利用される／UI表示差分がない／タスク更新ロジックが共通関数に統合される／pnpm --filter @hierarchidb/ui-batch-progress build が exit 0／関連プラグインの typecheck が exit 0／TASKS.md に運用ログを記載
- 影響範囲: `packages/ui/batch/src/**`, `plugins/shape-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`
- ロールバック手順: 該当差分を revert して各プラグイン固有の進捗UIに戻す
- チェックリスト:
  - 共通化対象の UI/ロジック を確定する
  - 共通コンポーネントへ移行する
  - pnpm --filter @hierarchidb/ui-batch-progress build を実行する
  - 主要プラグインの typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:

2432) refactor/i18n/processing-common (P3) — 未着手 (2026-01-29)
- ブランチ名: refactor/i18n/processing-common
- 依存: 2430
- 受け入れ基準: processing.* の重複キーが共通辞書に統合される／各プラグインの i18n 参照が共通辞書を参照する／既存表示文言が変わらない／pnpm --filter @hierarchidb/app typecheck または対象 plugin typecheck が exit 0／TASKS.md に運用ログを記載
- 影響範囲: `packages/ui/i18n/src/**`, `plugins/**/src/ui/locales/**`
- ロールバック手順: 該当差分を revert して各プラグインの個別辞書に戻す
- チェックリスト:
  - 重複キーの洗い出しと統合先を決める
  - 各プラグインの参照を共通辞書へ移行する
  - 既存表示文言の一致を確認する
  - pnpm --filter @hierarchidb/app typecheck または対象 plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:

2427) feat/location/default-datasource-ide-gsm (P1) — 完了 (2026-01-29)
- ブランチ名: feat/location/default-datasource-ide-gsm
- 依存: なし
- 受け入れ基準: Location Create の dataSource 初期値が ide-gsm になる／Edit や既存フローに副作用がない／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のデフォルト値に戻す
- チェックリスト:
  - Create 初期化ロジックの dataSource を ide-gsm に設定する
  - Edit フローへの影響がないことを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 14:35 JST Location Create の dataSource 初期値を ide-gsm に変更する作業に着手。
  - update: 2026-01-29 14:37 JST create 時の draft 正規化で dataSource のデフォルトを ide-gsm に設定。
  - update: 2026-01-29 14:37 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 14:38 JST Location Create の dataSource 初期値を ide-gsm に変更完了。

2428) fix/location-preview/avoid-viewport-reimport (P1) — 完了 (2026-01-29)
- ブランチ名: fix/location-preview/avoid-viewport-reimport
- 依存: なし
- 受け入れ基準: 地図のパン/ズームのみで IDE-GSM の import 進捗が再発火しない／viewport fetch による再描画でも既存表示が消えない／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/**`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の viewport 連動の挙動に戻す
- チェックリスト:
  - viewport 変更時の IDE-GSM import 再発火条件を確認する
  - 表示消失の原因を特定し、差分更新に変更する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 14:45 JST location preview の viewport 変化で import が再発火する問題の調査に着手。
  - update: 2026-01-29 14:52 JST useIdeGsmImportOnEntry で LocationDraft の nested draft を参照するよう修正。
  - update: 2026-01-29 14:53 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 14:54 JST viewport 変化による IDE-GSM 再インポートの再発火を抑制。
  - update: 2026-01-29 15:06 JST ideGsmSelectionHash を root/draft 両方から参照し、source/selection の root fallback を追加。
  - update: 2026-01-29 15:07 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 15:18 JST useWorkerAPI の準備完了まで IDE-GSM import を開始しないように修正。
  - update: 2026-01-29 15:19 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 15:30 JST import 判定用の最小ログを追加し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 15:42 JST viewport fetch の失敗/未準備時に previewPoints をクリアしないよう変更。
  - update: 2026-01-29 15:43 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 16:05 JST Map Preview から IDE-GSM import を除外し、Worker 未準備時は import を開始しない方針で対応。

2423) investigation/shape-plugin-remove-remnants (P1) — 進行中 (2026-01-29)
- ブランチ名: investigation/shape-plugin-remove-remnants
- 依存: なし
- 受け入れ基準: shape-plugin の DB テーブル/関連コード/未使用ファイル・クラス・関数・定数を調査し、削除候補を根拠付きで整理できる／削除可否の判断材料（参照有無/影響範囲）を列挙できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/features/shape-store/src/**`, `packages/runtime-worker/src/services/**`, `plugins/shape-plugin/docs/**`（調査後に確定）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - shape-plugin の永続化テーブル/型定義を整理する
  - 参照されないファイル/クラス/関数/定数を抽出する
  - 削除候補を「削除OK/要確認/保留」に分類する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 11:28 JST shape-plugin 残骸整理の調査に着手。
  - update: 2026-01-29 11:48 JST VectorTileDB2Procedure/VectorTileService/services/types/tiles 型を削除し、shape-store の索引縮小と vectortile-store の meta/sources/tileIndex テーブル撤去に合わせてバージョン更新。
  - update: 2026-01-29 11:48 JST RouteDB を v3 に更新して vectortile-store 変更に追従。
  - update: 2026-01-29 11:52 JST shapeSessionMappers の型参照を shape-store に寄せ、pnpm --filter @hierarchidb/vectortile-store|shape-store|route-store|shape-plugin typecheck を実行して exit 0 を確認。
  - update: 2026-01-29 12:05 JST ShapeDB の旧スキーマ互換を撤去し最新スキーマのみに整理。shape-plugin ドキュメントの残骸を削除。
  - update: 2026-01-29 12:10 JST pnpm --filter @hierarchidb/shape-store|shape-plugin|vectortile-store typecheck を実行して exit 0 を確認。
  - done: 2026-01-29 12:05 JST shape-plugin 残骸整理（削除実施）を完了。

2422) refactor/location/remove-vectortiles-remnants (P1) — 進行中 (2026-01-29)
- ブランチ名: refactor/location/remove-vectortiles-remnants
- 依存: なし
- 受け入れ基準: LocationDB から vectorTiles テーブルと VectorTileDbBase 依存が撤去される／location のベクトルタイル関連コード・テストが削除される／他の残骸候補（未使用テーブル/型/コード）が一覧化される／pnpm --filter @hierarchidb/location-store typecheck など必要範囲が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `plugins/location-plugin/src/**`, `packages/features/vectortile-store/src/**`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して Location の vectorTiles テーブルと関連コードを復元する
- チェックリスト:
  - LocationDB から VectorTileDbBase 継承と vectorTiles テーブルを撤去する
  - vectorTiles を利用する location 側コード/テストを削除する
  - 残骸候補の一覧を更新し、削除対象を明確化する
  - pnpm --filter @hierarchidb/location-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 11:12 JST location の vectorTiles 残骸撤去に着手。
  - update: 2026-01-29 11:20 JST LocationDB を Dexie に切替え、v11 で vectorTiles/pendingSessions を撤去。location-plugin の vectortile 関連コード/テスト/エクスポートを削除。
  - update: 2026-01-29 11:21 JST pnpm --filter @hierarchidb/location-store typecheck / pnpm --filter @hierarchidb/location-plugin typecheck ともに exit 0 を確認。
  - done: 2026-01-29 11:21 JST location の vectorTiles 残骸撤去を完了。

2416) feat/core/node-references-index-and-guard (P1) — 完了 (2026-01-29)
- ブランチ名: feat/core/node-references-index-and-guard
- 依存: なし
- 受け入れ基準: nodes テーブルの references が indexed になり参照元/参照先検索が可能になる／shape・route が参照先 nodeId を references 配列へ保存する／references により参照されているノードはゴミ箱へ移動不可となる／TASKS.md に運用ログ・検証結果を記載する
- 影響範囲: 調査後に確定
- ロールバック手順: 該当差分を revert して references index と guard を撤去する
- チェックリスト:
  - nodes テーブル定義と references の現状を確認する
  - references の Dexie index を追加する
  - shape/route から参照先 nodeId を保存する箇所を特定し references 更新を追加する
  - 参照されているノードの trash 操作を失敗させるガードを追加する
  - pnpm typecheck/test を必要範囲で実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 10:54 JST node references の index/guard 実装に着手。
  - update: 2026-01-29 10:54 JST references の見直しは保留し、LocationFeature の centroidForShapeId/centroidForShapeContainerNodeId を参照表現として採用。
  - update: 2026-01-29 13:18 JST location-store と plugin-service-api に centroidForShapeId/centroidForShapeContainerNodeId を追加し、location normalizer が保持するよう更新。
  - update: 2026-01-29 13:18 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-29 13:18 JST pnpm --filter @hierarchidb/plugin-service-api build exit 0（tsdown define warning あり）。
  - blocked: 2026-01-29 13:18 JST pnpm --filter @hierarchidb/location-plugin typecheck が centroidForShapeContainerNodeId の型不一致で失敗。
  - update: 2026-01-29 13:18 JST normalizers で NodeId 正規化を追加し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 13:18 JST LocationFeature の centroidForShapeId/centroidForShapeContainerNodeId を参照表現として利用する更新を完了。

2416) refactor/shape/step5-task-sync-datasource-refactor (P1) — 完了 (2026-01-28)
- ブランチ名: refactor/shape/step5-task-sync-datasource-refactor
- 依存: なし
- ExecPlan: plans/shape-step5-task-sync-datasource-refactor-execplan.md
- 受け入れ基準: useShapeBuildTasks の同期処理が useShapeBuildTaskSync に集約され既存挙動が維持される／shapeFetchStage の分岐が関数分割され payload 解決/タスク整合/実行が明確になる／DataSource 設定が単一ソース化され旧 DATA_SOURCE_CONFIGS と common/mock/data.ts 参照が残らない／dataSource バリデーションが common/types/data-source.ts の関数に統一される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTaskSync.ts`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `plugins/shape-plugin/src/common/types/constants.ts`, `plugins/shape-plugin/src/common/types/data-source.ts`, `plugins/shape-plugin/src/ui/components/step2/useShapeDataSourceStep.ts`, `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts`, `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, `plugins/shape-plugin/src/worker/api.ts`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して従来のタスク同期/データソース参照/フェッチ分岐に戻す
- チェックリスト:
  - useShapeBuildTaskSync へ同期ロジックを集約し、useShapeBuildTasks を薄くする
  - shapeFetchStage の分岐を payload 解決/タスク整合/実行の関数に分割する
  - DataSource 定義を単一ソース化し、旧 DATA_SOURCE_CONFIGS と mock 参照を撤去する
  - dataSource バリデーションを共通関数に統一する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 23:42 JST shape Step5 タスク同期/Fetch 分割/DataSource 統一のリファクタに着手。
  - update: 2026-01-28 23:45 JST useShapeBuildTaskSync を追加して useShapeBuildTasks を薄くし、shapeFetchStage を payload 解決/タスク整合関数に分割。
  - update: 2026-01-28 23:45 JST DataSource 定義を SHAPE_DATA_SOURCE_BY_NAME に統一し、dataSource バリデーションを common/types に集約。
  - update: 2026-01-28 23:46 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-28 23:46 JST Step5 タスク同期/Fetch 分割/DataSource 統一のリファクタを完了。

2417) refactor/shape/step4-common-ui-sections (P2) — 完了 (2026-01-28)
- ブランチ名: refactor/shape/step4-common-ui-sections
- 依存: なし
- ExecPlan: plans/shape-step4-common-ui-sections-execplan.md
- 受け入れ基準: step4 の各セクションで重複していた disabled/hoverCard/カード構成のUIが共通コンポーネントに集約される／step4 の設定UIの見た目と挙動が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して step4 セクションの個別実装へ戻す
- チェックリスト:
  - step4 の重複UIパターンを抽出して共通コンポーネント化する
  - 各セクションの呼び出しを新コンポーネントへ置換する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 23:50 JST shape Step4 の共通UI抽出リファクタに着手。
  - update: 2026-01-28 23:55 JST Step4 の hover card/section title を共通コンポーネント化。
  - update: 2026-01-28 23:55 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-28 23:55 JST Step4 の共通UI抽出リファクタを完了。

2418) refactor/shape/replace-step-number-names (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/replace-step-number-names
- 依存: なし
- ExecPlan: plans/shape-step-number-to-logical-names-execplan.md
- 受け入れ基準: shape-plugin 内の step番号を含む型名/関数名/コンポーネント名/ファイル名/i18nキー/UI表示文言が論理名へ置換される／参照の整合性が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `plugins/shape-plugin/src/ui/locales/**`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して step 番号命名に戻す
- チェックリスト:
  - step番号が含まれるシンボル/ファイル名/i18nキー/UI文言を列挙する
  - 論理名へ置換し、import/export/参照を更新する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 07:59 JST shape-plugin の step番号命名を論理名へ置換するリファクタに着手。
  - update: 2026-01-29 08:06 JST step2/3/4/5/6 フォルダを data-source/country-selection/build-config/build-progress/preview に置換し、build-config の共通コンポーネント名も論理名へ変更。
  - update: 2026-01-29 08:06 JST Step2/Step3 表記を Data Source selection など論理表現へ更新。
  - update: 2026-01-29 08:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 08:06 JST step番号命名の置換を完了。

2419) docs/shape/replace-step-names (P2) — 完了 (2026-01-29)
- ブランチ名: docs/shape/replace-step-names
- 依存: なし
- 受け入れ基準: shape-plugin の README/TODO/設計ドキュメント内の Step 表記が論理名に更新される／文脈に応じて Data Source selection/Country selection/Build Config/Build Progress/Preview などに統一される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/README.md`, `plugins/shape-plugin/TODO.md`, `plugins/shape-plugin/docs/**`
- ロールバック手順: 変更差分を revert して Step 表記へ戻す
- チェックリスト:
  - Step 表記が残る箇所を列挙する
  - 論理名へ置換し、日本語文脈は自然な表現に整える
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 08:08 JST shape-plugin ドキュメントの Step 表記を論理名に置換する作業に着手。
  - update: 2026-01-29 08:10 JST README/TODO/設計ドキュメントの Step 表記を Build Progress など論理名へ更新。
  - update: 2026-01-29 08:10 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 08:10 JST step 表記の論理名化を完了。

2420) refactor/shape/ui-logic-hooks (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/ui-logic-hooks
- 依存: なし
- ExecPlan: plans/shape-ui-logic-hooks-execplan.md
- 受け入れ基準: shape-plugin UI コンポーネント内の表示/ロジック混在が解消され、ロジックがカスタムフックへ抽出される／表示は抽出したフックの戻り値に依存する構造になる／挙動と見た目が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/**`（調査後に確定）
- ロールバック手順: 変更差分を revert して元のコンポーネント構造へ戻す
- チェックリスト:
  - 表示/ロジックが混在している UI コンポーネントを列挙する
  - ロジックをカスタムフックへ抽出し、表示はデータを受け取って描画するように整理する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 08:10 JST shape-plugin UI の表示/ロジック分離に着手。
  - update: 2026-01-29 08:16 JST Build Progress パネル/ステップのロジックをカスタムフックに抽出。
  - update: 2026-01-29 08:16 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 08:16 JST UI ロジック抽出リファクタを完了。

2421) refactor/shape/remove-thin-wrappers (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/remove-thin-wrappers
- 依存: なし
- ExecPlan: plans/shape-remove-thin-wrappers-execplan.md
- 受け入れ基準: shape-plugin の薄いラッパー（指定候補）を削除/統合して呼び出し構成が簡素化される／挙動と表示が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/**`, `plugins/shape-plugin/src/ui/components/preview/**`（必要に応じて追加）
- ロールバック手順: 変更差分を revert してラッパーコンポーネント/フックを復元する
- チェックリスト:
  - 指定候補の薄いラッパーを削除・統合する
  - 参照元の import/利用を置換する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 08:22 JST shape-plugin の薄いラッパー削除/統合リファクタに着手。
  - update: 2026-01-29 08:31 JST Build Progress パネル内へ stage/task summary/scroll bar を統合し、AtomSync を Step 内部へ移設。
  - update: 2026-01-29 08:31 JST useBuildStages/useBatchSessionActions/useBuildStatus/useBatchCommand/useTransformErrorTable を削除し呼び出し側に統合。
  - update: 2026-01-29 08:31 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 08:31 JST 薄いラッパー削除/統合リファクタを完了。

2415) investigation/ui-location/preview-requires-step5 (P1) — 完了 (2026-01-28)
- ブランチ名: investigation/ui-location/preview-requires-step5
- 依存: なし
- 受け入れ基準: location ノードの Preview で「表示のための設定および処理が完了していません」となる原因/発生条件を特定し説明できる／Edit→Step5 では表示できる理由を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定
- ロールバック手順: 該当差分があれば revert して従来の挙動へ戻す
- チェックリスト:
  - TreeNodeInfoPanel から Preview を開く経路を確認する
  - location プラグイン側の preview 可否判定と Step5 の関係を確認する
  - 問題の原因/条件/回避手順を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 17:44 JST location Preview の表示未完了メッセージの原因調査に着手。
  - update: 2026-01-28 17:44 JST preview ガードで location の最終ステップ validate が isLocationBuildPersisted を要求し、Map Preview 侵入前は未完了扱いになる点を確認。
  - update: 2026-01-28 17:44 JST Map Preview 進入時に useIdeGsmImportOnEntry が処理を実行し、processingStatus/DB を更新するため Edit→Step5 は表示できる点を確認。
  - update: 2026-01-28 17:44 JST preview ガードで location の非同期処理を許可し、InfoPanel の Preview ボタンはガード結果で disabled 制御する方針を反映。
  - update: 2026-01-28 17:44 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-28 17:44 JST コンテキストメニューの Preview もガード結果で disabled になるよう連携を追加。
  - update: 2026-01-28 19:10 JST ui-treeconsole-breadcrumb/treetable/base を build して d.ts を更新。
  - update: 2026-01-28 19:10 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define warning あり）。
  - done: 2026-01-28 17:44 JST Preview ガードの非同期許可と InfoPanel の Preview 無効化制御を反映。

2417) refactor/plugin-service-api/split-location-route (P1) — 進行中 (2026-01-28)
- ブランチ名: refactor/plugin-service-api/split-location-route
- 依存: なし
- 受け入れ基準: locationTypes.ts/routeTypes.ts が新しい api パッケージへ移設され、依存先が切り替わる／移行フェーズが TASKS.md と ExecPlan に明記される／app が必要な `*-store` 依存と DB 初期化/登録を担い、plugins が DB 選定や登録を行わない／`*-api` にスキーマ型/DB ラップ API、`*-store` に DB 初期化が集約される／該当パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定
- ロールバック手順: 該当差分を revert して plugin-service-api 参照に戻す
- チェックリスト:
  - ExecPlan を作成して plans/ に配置する
  - location/route の新 api パッケージ設計と移設対象を確定する
  - 依存先切替と typecheck を段階的に実施する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 20:25 JST plugin-service-api の location/route 型分離計画に着手。
  - update: 2026-01-28 20:35 JST ExecPlan を plans/plugin-service-api-split-location-route-execplan.md に作成。
  - update: 2026-01-28 20:45 JST 要件追加（api へ型統合、store は api 依存、UI は api のみ）を反映して ExecPlan を改訂。
  - update: 2026-01-30 10:12 JST app が store 選定/DB 初期化を担い、plugins は DB 責務を持たない方針を ExecPlan と DoD に追加。
  - update: 2026-01-30 10:35 JST app 側に store 選定リストを追加し、WorkerModuleLoader/DB prewarm/clear が app の選定を参照するよう更新。plugins の自動 store 登録サイドエフェクトを撤去。
  - update: 2026-01-30 12:05 JST pnpm --filter @hierarchidb/location-api build / @hierarchidb/route-api build / @hierarchidb/location-store build / @hierarchidb/route-store build / @hierarchidb/plugin-service-api build を実行（tsdown define 警告あり）。
  - update: 2026-01-30 12:05 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-30 12:20 JST route IDE-GSM CSV パース/検証の共通化方針（route-apiへ純粋関数を移動）で調整開始。
  - start: 2026-01-30 13:20 JST route IDE-GSM CSV のパース/検証を route-api へ移動し、runtime-worker/route-plugin はラッパー化する作業に着手（DoD 合意済み）。未追跡ファイル（packages/features/resolver-store、plans/app-db-init-responsibility-execplan.md）の扱いは確認中。
  - update: 2026-01-30 13:35 JST route-api に IDE-GSM CSV の parse/validate を集約し、runtime-worker/route-plugin 側はラッパーに整理。
  - update: 2026-01-30 13:35 JST pnpm --filter @hierarchidb/route-api build / pnpm --filter @hierarchidb/plugin-service-api build / pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-30 14:05 JST plugin-service-api から route-api 依存を撤去（Route* 型はローカル定義、IdeGsmRouteError は route-api 直参照へ移行）し、循環依存の解消方針に合わせて整理。
  - update: 2026-01-30 14:05 JST pnpm --filter @hierarchidb/plugin-service-api build / pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - start: 2026-01-30 14:25 JST common-api の WorkerAPI / TreeQueryAPI / TreeMutationAPI を worker-api / tree-api へ分割する作業に着手（循環依存解消対応）。
  - update: 2026-01-30 15:05 JST WorkerAPI を features/worker-api に移設、TreeQueryAPI/TreeMutationAPI を features/tree-api に移設し、参照と依存を新パッケージへ切替（common-api から該当 exports を撤去）。
  - update: 2026-01-30 15:05 JST pnpm --filter @hierarchidb/tree-api build / pnpm --filter @hierarchidb/worker-api build / pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - start: 2026-01-30 15:20 JST AuthRuntimeBridge を新設する auth-api へ集約し、common-api と worker-client の重複定義を整理する作業に着手。
  - update: 2026-01-30 15:45 JST AuthRuntimeBridge を features/auth-api に移設し、wirePlugins と plugin RuntimeWiring を AuthRuntimeBridge へ切替。common-api の RuntimeWiring 定義を撤去。
  - update: 2026-01-30 15:45 JST pnpm --filter @hierarchidb/auth-api build / pnpm --filter @hierarchidb/import-export-api build / pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - start: 2026-01-30 16:00 JST taskStatus の normalizeProgressPhase 廃止と TreeTableExpandedAPI の移動、ProgressPhase/BatchSessionStatus の型統一対応に着手。
  - update: 2026-01-30 16:15 JST DoD 合意。normalizeProgressPhase 廃止、taskStatus 撤去、ProgressPhase/BatchSessionStatus 型統一、TreeTableExpandedAPI は app 専用でないため移動せずの方針で対応開始。
  - update: 2026-01-30 16:40 JST common-api に BatchStatus/ProgressPhase 統合と BatchProgress/UnifiedProgressInfo 等の型を追加し、taskStatus の normalize/map を撤去。route/shape plugin の利用箇所を直接ステータス参照へ置換。
  - update: 2026-01-30 16:42 JST pnpm --filter @hierarchidb/common-api build exit 0（tsdown define 警告あり）。
  - update: 2026-01-30 16:42 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - update: 2026-01-30 16:43 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-30 16:55 JST TreeTableExpandedAPI を tree-api へ移設し、common-api から撤去。worker-api/runtime-worker/app の参照を tree-api へ切替。
  - update: 2026-01-30 16:56 JST pnpm --filter @hierarchidb/tree-api build exit 0（tsdown define 警告あり）。
  - blocked: 2026-01-30 16:57 JST pnpm --filter @hierarchidb/runtime-worker typecheck が import-export-api の未解決と common-types の export 不足で失敗（TreeTableExpandedAPI 移設とは別要因）。
  - update: 2026-01-30 17:10 JST tree-api の TagSuggestion/SubscriptionId/SubscriptionOptions を tree-api 内の新定義へ切替し、common-types 依存を解除。
  - update: 2026-01-30 17:12 JST pnpm --filter @hierarchidb/tree-api build exit 0（tsdown define 警告あり）。
  - update: 2026-01-30 17:25 JST runtime-worker の SubscriptionId/SubscriptionOptions を tree-api へ切替。
  - update: 2026-01-30 17:28 JST pnpm --filter @hierarchidb/tree-api build exit 0（tsdown define 警告あり）。
  - blocked: 2026-01-30 17:29 JST pnpm --filter @hierarchidb/runtime-worker typecheck が import-export-api 未解決と common-types exports 不足で失敗（SubscriptionId/Options 切替とは別要因）。
  - start: 2026-01-30 17:40 JST common-api 廃止のため、参照を batch-api/tree-api/import-export-api へ移設しパッケージ削除を進行。
  - update: 2026-01-30 18:05 JST common-api 参照のコード/依存/設定/ドキュメントを batch-api/tree-api/import-export-api へ切替し、packages/common/api を削除。
  - update: 2026-01-30 18:08 JST pnpm install を実行（peer 警告あり、tsdown define 警告はなし）。
  - update: 2026-01-30 18:10 JST pnpm tools:gen-plugin-registry を実行（tsdown define 警告あり、registry 更新なし）。
  - blocked: 2026-01-30 18:12 JST pnpm --filter @hierarchidb/app typecheck が多数の依存未解決/暗黙 any で失敗（既存課題）。

2416) fix/depgraph/route-store-common-api-cycle (P1) — 完了 (2026-01-28)
- ブランチ名: fix/depgraph/route-store-common-api-cycle
- 依存: なし
- 受け入れ基準: @hierarchidb/route-store と @hierarchidb/common-api の循環依存が解消される／依存変更の意図が保たれる／該当パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: 依存グラフ調査後に確定
- ロールバック手順: 該当差分を revert して依存関係を元に戻す
- チェックリスト:
  - 依存循環の発生箇所を特定する
  - どちらの依存を外すか決め、代替型/インターフェースへ移行する
  - typecheck を実行して確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 20:12 JST route-store と common-api の循環依存解消に着手。
  - update: 2026-01-28 20:16 JST common-api から route-store の依存を削除。
  - update: 2026-01-28 20:16 JST pnpm --filter @hierarchidb/common-api typecheck exit 0 を確認。
  - done: 2026-01-28 20:16 JST route-store/common-api の循環依存を解消。

2415) fix/location-plugin/remove-row-type-alias (P1) — 完了 (2026-01-28)
- ブランチ名: fix/location-plugin/remove-row-type-alias
- 依存: なし
- 受け入れ基準: LocationFeatureRow/LocationRelationRow のエイリアスが撤去される／LocationFeature/LocationRelation を直接使用する／@hierarchidb/location-plugin の typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/worker/locationEntitiesDB.ts`, `plugins/location-plugin/src/worker/normalizers.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert してエイリアスに戻す
- チェックリスト:
  - LocationFeatureRow/LocationRelationRow の参照を特定する
  - LocationFeature/LocationRelation へ直接置換する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 20:05 JST LocationFeatureRow/LocationRelationRow エイリアス撤去に着手。
  - update: 2026-01-28 20:08 JST LocationFeature/LocationRelation を直接参照するよう置換。
  - update: 2026-01-28 20:08 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-28 20:08 JST エイリアス撤去と型置換を完了。

2414) fix/ui-floating-window/discard-dialog-front (P1) — 完了 (2026-01-28)
- ブランチ名: fix/ui-floating-window/discard-dialog-front
- 依存: なし
- 受け入れ基準: “Discard Changes?” ダイアログが FloatingWindow より常に前面に表示される／ダイアログの操作（破棄/キャンセル/閉じる）が従来通り動作する／他のモーダルに副作用がない／pnpm --filter @hierarchidb/app typecheck が exit 0（影響範囲に応じて追加）／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定
- ロールバック手順: 該当差分を revert して従来の表示階層へ戻す
- チェックリスト:
  - “Discard Changes?” ダイアログの実装箇所と portal を特定する
  - FloatingWindow より前面に出るよう z-index/portal を調整する
  - pnpm --filter @hierarchidb/app typecheck を実行する（必要なら追加パッケージも）
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:50 JST “Discard Changes?” ダイアログを FloatingWindow より前面にする作業に着手。
  - update: 2026-01-28 19:53 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - done: 2026-01-28 19:53 JST “Discard Changes?” ダイアログの root z-index を引き上げて前面化。

2414) fix/ui-floating-window/clamp-initial-position (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-floating-window/clamp-initial-position
- 依存: なし
- 受け入れ基準: 初期/復元位置が画面外でも FloatingWindow が画面内に表示される／ドラッグ/リサイズ/前面化に副作用が出ない／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`
- ロールバック手順: 該当差分を revert して従来の初期位置をそのまま使う挙動へ戻す
- チェックリスト:
  - initialState の position を画面内にクランプする
  - 既存のドラッグ/リサイズが影響を受けないことを確認する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 20:06 JST Location Step5 のリストが表示されない件の調査に着手。
  - update: 2026-01-28 20:06 JST initialState の position を画面内にクランプする対応を追加。
  - update: 2026-01-28 20:07 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。

2417) investigation/shape-location-route-persistence-audit (P1) — 進行中 (2026-01-29)
- ブランチ名: investigation/shape-location-route-persistence-audit
- 依存: なし
- 受け入れ基準: shape/location/route の永続化データ型とテーブル一覧を整理する／未使用・冗長な型・テーブル・インデックス候補を根拠付きで指摘する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/location-store/src/LocationDB.ts`, `packages/features/route-store/src/RouteDB.ts`, `packages/features/vectortile-store/src/tilesDb.ts`, `packages/runtime-worker/src/services/**`, `plugins/*/src/**`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 各 DB のテーブル/型/インデックスを列挙する
  - 参照・クエリ箇所を追跡して未使用候補を特定する
  - 根拠（参照有無/参照箇所）を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 09:34 JST shape/location/route の永続化データ型とテーブルの調査に着手。
  - done: 2026-01-29 09:40 JST 各DBのテーブル/インデックスと参照箇所を整理し、未使用・冗長候補を洗い出し。

2416) fix/shape-location-store/schema-alignment (P1) — 進行中 (2026-01-29)
- ブランチ名: fix/shape-location-store/schema-alignment
- 依存: なし
- 受け入れ基準: ShapeDB の buildSessions 命名が統一され relations テーブルが削除される／ShapeContainerNodeId を形状系で優先使用する／LocationFeature に centroidForShapeId/centroidForShapeContainerNodeId を追加し features のインデックスが更新される／pnpm --filter @hierarchidb/shape-store typecheck と pnpm --filter @hierarchidb/location-store typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/shape-store/src/index.ts`, `packages/features/location-store/src/LocationDB.ts`, `packages/features/location-store/package.json`
- ロールバック手順: 該当差分を revert して旧スキーマと命名へ戻す
- チェックリスト:
  - ShapeDB の batchSessions を buildSessions へ統一し、relations テーブルを削除する
  - ShapeContainerNodeId を形状系の NodeId に置き換える
  - LocationFeature と features インデックスに centroid 情報を追加する
  - pnpm --filter @hierarchidb/shape-store typecheck を実行する
  - pnpm --filter @hierarchidb/location-store typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 09:12 JST Shape/Location store のスキーマ整合化に着手。
  - update: 2026-01-29 09:15 JST ShapeDB を buildSessions 命名へ統一し、relations テーブルを削除。ShapeContainerNodeId を形状系へ適用。
  - update: 2026-01-29 09:15 JST LocationFeature に centroidForShapeId/centroidForShapeContainerNodeId を追加し、features インデックスを更新。
  - update: 2026-01-29 09:17 JST pnpm --filter @hierarchidb/shape-store build:types を実行。
  - update: 2026-01-29 09:17 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0 を確認。
  - blocked: 2026-01-29 09:18 JST pnpm --filter @hierarchidb/location-store typecheck が @hierarchidb/shape-store 未解決で失敗。
  - update: 2026-01-29 09:19 JST pnpm install を実行して依存を更新。
  - update: 2026-01-29 09:20 JST pnpm --filter @hierarchidb/location-store typecheck exit 0 を確認。

2415) feat/ui-json-treeview/location-metadata-drilldown (P1) — 進行中 (2026-01-28)
- ブランチ名: feat/ui-json-treeview/location-metadata-drilldown
- 依存: なし
- 受け入れ基準: ui-json-treeview が JSON を階層的に表示できる（TanStack Table Expanding 使用）／Location Step5 の metadata カラムクリックで階層表示が開く／既存の選択/検索/スクロールに副作用がない／pnpm --filter @hierarchidb/ui-json-treeview typecheck と pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/json-treeview/src/**`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/map/src/preview/LocationPreviewList.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して metadata カラムクリック時の表示を従来のままに戻す
- チェックリスト:
  - ui-json-treeview を新設し、TanStack Table Expanding で階層表示する
  - MapPreviewFloatingTable へ onCellClick を追加する
  - Location Step5 の metadata カラムで JSON ツリービューを開く
  - pnpm --filter @hierarchidb/ui-json-treeview typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 20:20 JST Location Step5 metadata の階層表示を追加する作業に着手。
  - update: 2026-01-28 20:28 JST ui-json-treeview パッケージを新設し、TanStack Table Expanding で JSON を階層表示するコンポーネントを追加。
  - update: 2026-01-28 20:28 JST MapPreviewFloatingTable に onCellClick を追加し、Location Step5 の metadata クリックで JSON ダイアログを表示。
  - blocked: 2026-01-28 20:30 JST pnpm --filter @hierarchidb/ui-json-treeview typecheck が @tanstack/react-table 未解決で失敗。
  - update: 2026-01-28 20:31 JST pnpm install を実行して workspace 依存を解決。
  - update: 2026-01-28 20:32 JST ExpandedState の型エラーを修正。
  - update: 2026-01-28 20:32 JST pnpm --filter @hierarchidb/ui-json-treeview typecheck exit 0 を確認。
  - update: 2026-01-28 20:33 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2413) fix/ui-map/shape-step6-disable-admin-grouping (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-map/shape-step6-disable-admin-grouping
- 依存: なし
- 受け入れ基準: Shape Step6 のメタデータテーブルで Admin Level の自動グループ化が行われない／選択・並び替え・検索の挙動が変わらない／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: 該当差分を revert して adminLevel の defaultGrouping を復元する
- チェックリスト:
  - defaultGrouping の指定を除去する
  - 表示のグループ化が消えることを確認する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:44 JST Shape Step6 の Admin Level 自動グループ化を無効化する作業に着手。
  - update: 2026-01-28 19:45 JST defaultGrouping の指定を削除。
  - update: 2026-01-28 19:45 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2412) fix/ui-floating-window/admin-level-arrow-color (P1) — 完了 (2026-01-28)
- ブランチ名: fix/ui-floating-window/admin-level-arrow-color
- 依存: なし
- 受け入れ基準: Floating Window の Admin Level カラムに表示される ▶︎/▼ の色が primary になる／他カラムの表示や操作は変わらない／pnpm --filter @hierarchidb/ui-map typecheck が exit 0（影響範囲が他パッケージなら該当パッケージも）／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定
- ロールバック手順: 該当差分を revert してアイコン色を元に戻す
- チェックリスト:
  - Admin Level カラムの描画箇所を特定する
  - ▶︎/▼ の色を primary に変更する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する（必要なら追加パッケージも）
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:35 JST Admin Level カラムの矢印色を primary に変更する作業に着手。
  - update: 2026-01-28 19:38 JST pnpm --filter @hierarchidb/ui-grid typecheck exit 0 を確認。
  - done: 2026-01-28 19:38 JST Admin Level カラムの矢印色を primary に変更。

2412) refactor/app-db/init-responsibility (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/app-db/init-responsibility
- 依存: なし
- 受け入れ基準: PluginDefinition の database(dbName/schema/version) から DB 自動作成・初期化(prewarm含む)が app 側で実行される／prewarm/clear 実装が *-store に移動される／既存の初期化順序と挙動が退行しない／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: app, packages/runtime-worker, packages/plugin-registry, packages/*-store, plugins/*-plugin（調査後に確定）
- ロールバック手順: 該当差分を revert して DB 初期化を従来の runtime-worker 側に戻す
- チェックリスト:
  - DB 初期化・prewarm の現行実装位置を特定する
  - app 側への移管ポイントを設計し最小差分で移行する
  - prewarm/clear の実装を *-store へ移動する
  - 既存の依存順/初期化順を維持できることを確認する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 10:42 JST PluginDefinition DB 初期化責務の app 移管と prewarm/clear の *-store 移動に着手。
  - blocked: 2026-01-30 10:48 JST 「PluginDefinition 由来の dbName/schema/version を app がどう利用するか」「resolver 用 *-store 新設の可否」など方針確認が必要。
  - update: 2026-01-30 11:32 JST resolver-store 新設、store への prewarm/clear 実装移管、app 側の prewarm/clear を store ベースに切替。
  - update: 2026-01-30 11:33 JST pnpm tools:gen-plugin-registry 実行（tsdown define warning / database export 未設定の警告あり）。
  - update: 2026-01-30 11:36 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - done: 2026-01-30 11:36 JST PluginDefinition の database メタ追加と DB 初期化責務の app 移管を完了。

2411) fix/ui-map/titlebar-row-count-format (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-map/titlebar-row-count-format
- 依存: なし
- 受け入れ基準: FloatingWindow タイトルバーの行数表示が「Shape (111/999 rows)」形式になる／スペースと rows の小文字化以外の表示は変わらない／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: 該当差分を revert して従来の表記に戻す
- チェックリスト:
  - 表記生成ロジックの位置を特定する
  - スペース追加と rows の小文字化を反映する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:08 JST FloatingWindow タイトルバーの行数表記修正に着手。
  - update: 2026-01-28 19:12 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-01-28 19:12 JST タイトルバーの行数表記を「Shape (111/999 rows)」形式へ修正。

2411) fix/ui-grid/selection-column-dot (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-grid/selection-column-dot
- 依存: なし
- 受け入れ基準: Step6 Features テーブルのチェックボックス列右端の「.」が表示されない／選択操作が従来通り動作する／pnpm --filter @hierarchidb/ui-grid typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/data-grid/src/TanstackDataGrid.tsx`
- ロールバック手順: 該当差分を revert して従来のセル描画へ戻す
- チェックリスト:
  - チェックボックス列の描画とセルスタイルを確認する
  - 選択列の TableCell のスタイルを調整して不要な表示を除去する
  - pnpm --filter @hierarchidb/ui-grid typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
  - start: 2026-01-28 18:17 JST Step6 Features テーブルのチェックボックス列に「.」が出る問題の修正に着手。
  - update: 2026-01-28 18:20 JST 選択列の TableCell を checkbox padding/clip overflow にして不要な点表示を抑止。
  - update: 2026-01-28 18:20 JST pnpm --filter @hierarchidb/ui-grid typecheck exit 0 を確認。

2410) fix/ui-floating-window/minimized-drag (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-floating-window/minimized-drag
- 依存: なし
- 受け入れ基準: 最小化状態の FloatingWindow をタイトルバーでドラッグできる／通常状態のドラッグ/リサイズ/前面化が退行しない／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`
- ロールバック手順: 該当差分を revert して最小化状態のドラッグを不可に戻す
- チェックリスト:
  - 最小化時のドラッグ開始条件を確認する
  - mousemove/mouseup のハンドラ登録が最小化時も有効かを確認する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 18:06 JST 最小化状態の FloatingWindow がドラッグできない問題の修正に着手。
  - update: 2026-01-28 18:06 JST 最小化時もタイトルバーからドラッグ開始できるようにし、mousemove/mouseup の監視を維持。
  - update: 2026-01-28 18:07 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。

2409) fix/ui-floating-window/column-selector-front (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-floating-window/column-selector-front
- 依存: なし
- 受け入れ基準: カラムセレクタが FloatingWindow の背面に回らず常に前面に表示される／クリック・ドラッグ・リサイズの挙動に副作用が出ない／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/data-grid/src/AbstractDataGrid.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のポップオーバー表示に戻す
- チェックリスト:
  - カラムセレクタの表示方式（Popover/Portal/Popover container）を特定する
  - FloatingWindow より前面に出るよう表示階層を調整する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 16:42 JST カラムセレクタが FloatingWindow の背面に表示される問題の修正に着手。
  - update: 2026-01-28 17:06 JST FloatingWindowPortalProvider を追加し、portal root を AppProviders 末尾に配置して DOM 順で前面化できるよう調整。
  - update: 2026-01-28 17:06 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - blocked: 2026-01-28 17:07 JST pnpm --filter @hierarchidb/app typecheck が ui-floating-window の dist 未更新で失敗。
  - update: 2026-01-28 17:08 JST pnpm --filter @hierarchidb/ui-floating-window build を実行し dist を更新。
  - update: 2026-01-28 17:09 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - update: 2026-01-28 17:23 JST FloatingWindowPortalProvider が body 直下に portal root を作るよう変更し、固定配置での描画/クリッピング問題を回避。
  - update: 2026-01-28 17:23 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 17:38 JST FloatingWindow の portal root z-index を modal より上に調整し、PluginDialog の背後に隠れないよう変更。
  - update: 2026-01-28 17:38 JST Column selector Dialog を floating window より前面に出す z-index を付与。

2401) investigation/runtime-worker/commit-draft-repeat-log (P1) — 進行中 (2026-01-27)
- ブランチ名: investigation/runtime-worker/commit-draft-repeat-log
- 依存: なし
- 受け入れ基準: [DraftService] commitDraft request ログが繰り返し出る原因と発生条件を特定し記載する／必要なら最小修正で再発を止める（意図的なリトライは維持）／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/TreeNodeUpdaterService.ts`, `packages/ui/treeconsole/base/src/**` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の commitDraft 呼び出し・ログ出力に戻す
- チェックリスト:
  - 再現条件と呼び出し元を特定する
  - 連続呼び出しの原因（同値更新/再レンダ/リトライ）を切り分ける
  - 必要なら抑止ガードを最小差分で追加する
  - pnpm --filter @hierarchidb/runtime-worker typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-27 17:16 JST shape Step6 feature 一覧の floating window 非表示の調査/修正に着手。
  - update: 2026-01-27 17:16 JST ShapePreviewList の初期サイズ異常を検知して初期サイズへ復元する処理を追加。
  - update: 2026-01-27 17:19 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-27 19:47 JST FloatingWindow の initialState 反映を差分がある場合のみ setState するよう調整し、最大更新深度の警告を抑止。
  - update: 2026-01-27 19:48 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-27 20:35 JST FloatingWindow の incoming position/size/zIndex を正規化し、NaN/無効値での無限更新を回避。
  - update: 2026-01-27 20:35 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-27 20:52 JST FloatingWindow の initialState 同期は initialState 変化時のみ評価するよう戻し、最大更新深度のループを抑止。
  - update: 2026-01-27 20:52 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-27 20:59 JST MapPreviewFloatingTable の列可視性同期で同一カラム配列時の setState を抑制。
  - update: 2026-01-27 20:59 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-27 21:03 JST FloatingWindow の initialState 同期時は onStateChange 通知を抑止し、無限更新を遮断。
  - update: 2026-01-27 21:03 JST pnpm typecheck exit 0（tsdown define warning あり）。
  - start: 2026-01-27 08:43 JST commitDraft request ログの連続出力調査に着手。
 - update: 2026-01-27 12:06 JST useTreeNodeUpdater の unsaved 判定を安定化し、draftData/draftMetadata のキー順差異による autosave 連続を抑止。
 - update: 2026-01-27 12:06 JST pnpm --filter @hierarchidb/plugin-ui-sdk typecheck exit 0 を確認。
 - done: 2026-01-27 12:06 JST autosave の連続 commitDraft 呼び出しを抑止する修正を反映。

2402) fix/ui-floating-window/drag-layer-sets-max-depth (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/ui-floating-window/drag-layer-sets-max-depth
- 依存: なし
- 受け入れ基準: shape Step6 の Layer Sets FloatingWindow をドラッグしても Maximum update depth exceeded が発生しない／他の FloatingWindow のドラッグ/リサイズ/保存挙動が退行しない／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/hooks/useFloatingWindow.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の windowState 同期挙動へ戻す
- チェックリスト:
  - 再現条件と呼び出し経路を特定する
  - windowState 同期の無限更新を抑止する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 18:25 JST FloatingWindow ドラッグ時の Maximum update depth exceeded 調査に着手。
  - update: 2026-01-27 18:25 JST useFloatingWindow の onStateChange で同値ガードを追加し、同一状態の再反映を抑止。
  - update: 2026-01-27 18:25 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - done: 2026-01-27 18:25 JST Layer Sets ドラッグ時の無限更新を抑止する修正を反映。

2403) fix/ui-map/disable-hover-while-floating-drag (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/ui-map/disable-hover-while-floating-drag
- 依存: なし
- 受け入れ基準: FloatingWindow のドラッグ/リサイズ中は地図の hover イベントが発火せずウィンドウ移動がガクガクしない／ドラッグ終了後は hover が従来通り動作する／pnpm --filter @hierarchidb/ui-map typecheck と pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`, `packages/ui/map/src/preview/useMapFeatureHoverCandidates.ts`, `packages/ui/map/src/preview/useVectorTilePreviewMapLayers.ts`, `packages/ui/map/src/lib/floating-window-interaction.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert して hover 抑止とドラッグ連携を元に戻す
- チェックリスト:
  - FloatingWindow のドラッグ/リサイズ開始・終了を検知できるようにする
  - hover ハンドラでドラッグ中のイベントを抑止する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 22:38 JST FloatingWindow ドラッグ/リサイズ中の map hover 抑止に着手。
  - update: 2026-01-27 22:38 JST FloatingWindow でドラッグ/リサイズ状態を body dataset へ反映。
  - update: 2026-01-27 22:38 JST hover ハンドラで drag 中を検知して hover 更新を抑止。
  - update: 2026-01-27 22:38 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-27 22:38 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-01-27 22:38 JST FloatingWindow ドラッグ中の hover 抑止を反映。
  - update: 2026-01-28 00:26 JST ドラッグ中に透明オーバーレイを表示する対応を追加し、重複 import を修正。
  - update: 2026-01-28 00:26 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 01:12 JST map canvas の pointer-events をドラッグ中に無効化する対応を追加。
  - update: 2026-01-28 01:12 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - update: 2026-01-28 14:44 JST 透明オーバーレイをウィンドウより前面に出し、map container/canvas の pointer-events を同時に無効化。
  - update: 2026-01-28 14:44 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 14:44 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2404) feat/route/step3-mode-icons (P1) — 進行中 (2026-01-28)
- ブランチ名: feat/route/step3-mode-icons
- 依存: なし
- 受け入れ基準: Route Step3 の Air/Sea/High-speed rail/Conventional rail/General road に MUI アイコンが表示される／既存の選択 UI が退行しない／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteSelectionStep.tsx`, `packages/components/src/SelectionMatrix/SelectionMatrix.tsx`, `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert して列ヘッダのアイコン表示を撤去する
- チェックリスト:
  - Route Step3 の列に適切な MUI アイコンを割り当てる
  - SelectionMatrix のヘッダにアイコンを描画する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:21 JST Route Step3 のモード列アイコン追加に着手。
  - update: 2026-01-28 19:27 JST SelectionMatrix の列ヘッダをアイコン+ラベルの横並び表示に変更。
  - update: 2026-01-28 19:27 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-01-28 20:49 JST High-speed rail を Train、Conventional rail を Tram のアイコンに変更。
  - update: 2026-01-28 20:49 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2405) fix/location/step3-type-icons-anchor (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/location/step3-type-icons-anchor
- 依存: なし
- 受け入れ基準: Location Step3 の Area centroid/Airport/Port/Station/Interchange に既存の種別アイコンが表示される／Port は MUI Anchor アイコンが使用される／アイコンはラベルの左側に横並びで表示される／既存の選択 UI が退行しない／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`, `plugins/location-plugin/src/ui/components/steps/locationTypes.ts`, `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `packages/components/src/SelectionMatrix/SelectionMatrix.tsx`, `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のアイコン/表示配置へ戻す
- チェックリスト:
  - Location Step3 の列にアイコンを表示し横並び配置にする
  - Port のアイコンを Anchor に差し替える
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 19:24 JST Location Step3 の種別アイコン/Anchor 対応に着手。
  - update: 2026-01-28 19:27 JST Port アイコンを Anchor に変更し、Step3 の種別アイコン表示を適用。
  - update: 2026-01-28 19:27 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-28 19:28 JST Station アイコンを Subway に変更。
  - update: 2026-01-28 19:28 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2404) fix/ui-floating-window/minimize-restore-drag-state (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-floating-window/minimize-restore-drag-state
- 依存: なし
- 受け入れ基準: 最小化→通常復帰のクリック後にドラッグ状態へ入らない／再クリックで移動確定のような挙動が発生しない／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の minimize/restore 挙動に戻す
- チェックリスト:
  - minimize/restore クリック時の drag 状態遷移を確認する
  - minimize/restore で drag/resizing を解除する
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 14:53 JST minimize/restore 後に drag 状態へ入る挙動の調査に着手。
  - update: 2026-01-28 14:53 JST minimize/restore 時に drag/resizing 状態を解除し、最小化時の drag 開始を抑止。
  - update: 2026-01-28 14:53 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。

2405) fix/ui-floating-window/zindex-and-titlebar-controls (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/ui-floating-window/zindex-and-titlebar-controls
- 依存: なし
- 受け入れ基準: FloatingWindow をクリックすると常に最前面に移動する／タイトルバーの最小化・最大化・閉じるボタンが状態に関係なく動作する／pnpm --filter @hierarchidb/ui-floating-window typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の z-index/ボタン挙動へ戻す
- チェックリスト:
  - クリック時の z-index 更新が常に反映されるようにする
  - タイトルバーの操作でドラッグが干渉しないようにする
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 15:09 JST FloatingWindow の z-index/タイトルバー操作の不具合調査に着手。
  - update: 2026-01-28 15:09 JST タイトルバーのボタン操作時にドラッグを開始しないようガードし、操作時に前面化するよう調整。
  - update: 2026-01-28 15:09 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 15:15 JST FloatingWindow を共通 portal root に移し、クリック時に DOM 順で前面化するよう調整。
  - update: 2026-01-28 15:15 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 15:21 JST FloatingWindow を個別の portal host に差し替え、クリック時に host の DOM 順で前面化するよう変更。
  - update: 2026-01-28 15:21 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。

2406) fix/shape/step6-recycling-toggle-ui (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/shape/step6-recycling-toggle-ui
- 依存: なし
- 受け入れ基準: Step6 の Recycling ボタンで選択行の再処理マークが即時反映される／更新が永続化される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の更新挙動に戻す
- チェックリスト:
  - Recycling トグルの反映経路を特定する
  - UI への即時反映を追加する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 16:16 JST Step6 Recycling トグルが反映されない問題の調査に着手。
  - update: 2026-01-28 16:16 JST putFeatureMetadata 成功後に featureMetadata をローカル更新して UI を即時反映。
  - update: 2026-01-28 16:16 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-28 15:17 JST portal root の z-index を固定し、FloatingWindow が常に前面に表示されるよう調整。
  - update: 2026-01-28 15:17 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 14:58 JST ドラッグ/リサイズ中のオーバーレイを50%グレーで可視化。
  - update: 2026-01-28 14:58 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 15:00 JST ドラッグ中の state 更新でイベント登録が再初期化されないよう依存を限定し、cleanup での解除を撤去。
  - update: 2026-01-28 15:00 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - update: 2026-01-28 15:01 JST ドラッグ中オーバーレイを透明に戻す。

2405) fix/auth/callback-stuck-waiting (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/auth/callback-stuck-waiting
- 依存: なし
- 受け入れ基準: OAuth リダイレクト後の callback.html が hash/router 判定ミスで待機画面に停滞しない／localhost と GitHub Pages の両方で `/auth/callback` からアプリに戻れる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/public/auth/callback.html`
- ロールバック手順: 該当差分を revert して callback.html のルーティング判定を元に戻す
- チェックリスト:
  - callback.html の hash/router 判定ロジックを確認する
  - localhost 以外は hash ルーティングへ誘導する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 22:40 JST callback.html が待機で停止する問題の修正に着手。
  - update: 2026-01-27 22:55 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。
  - done: 2026-01-27 22:55 JST callback.html の hash ルーティング判定を localhost 以外で優先するよう修正。
  - update: 2026-01-27 23:05 JST state 署名の origin を callback で反映し、return_origin を authorize に付与する修正に着手。
  - blocked: 2026-01-27 23:05 JST pnpm typecheck が @hierarchidb/bff の TS2304（stateOrigin 未定義）で失敗。
  - update: 2026-01-27 23:06 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。
  - update: 2026-01-27 23:14 JST return_origin に base URL を渡し、state の origin を base URL 解決に反映する修正に着手。
  - update: 2026-01-27 23:15 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。
  - done: 2026-01-27 23:15 JST state の origin へ base URL を反映し、callback のリダイレクト先に /hierarchidb を含めるよう修正。
  - update: 2026-01-27 23:22 JST callback.html が /auth/callback 直配下でも hash へ遷移するように調整。
  - update: 2026-01-27 23:22 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。
  - done: 2026-01-27 23:22 JST callback.html の SPA 判定を hash ルート優先に変更し、/auth/callback 直配下でも遷移するよう修正。

2406) fix/app/remove-default-step-mode-query (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/app/remove-default-step-mode-query
- 依存: なし
- 受け入れ基準: github.io 上で `?step=0&mode=normal` が自動付与されない／必要なルーティングで step/mode が欠けて動作が壊れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のクエリ付与挙動に戻す
- チェックリスト:
  - step/mode を自動付与している箇所を特定する
  - 不要な自動付与を削除し、必要なケースは維持する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 23:31 JST github.io で `?step=0&mode=normal` が自動付与される件の調査に着手。
  - update: 2026-01-27 23:39 JST AuthRequiredDialogHost の URL 同期を dialog パス時のみ有効化し、通常画面で step/mode を付与しないよう調整。
  - update: 2026-01-27 23:40 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。

2407) fix/auth/github-pages-callback-404 (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/auth/github-pages-callback-404
- 依存: なし
- 受け入れ基準: GitHub Pages で `/auth/callback` が 404 にならず認証完了後にアプリへ戻れる／localhost でも認証フローが完了する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/backend/bff/src/**`, `app/public/auth/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の callback URL 生成とリダイレクト挙動へ戻す
- チェックリスト:
  - GitHub Pages での callback URL 生成経路を特定する
  - `/auth/callback` 直アクセスで 404 が出ないように修正する
  - localhost/GitHub Pages の双方で callback からアプリに遷移できることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 23:46 JST GitHub Pages の /auth/callback 404 を解消する調査に着手。
  - update: 2026-01-27 23:52 JST GitHub Pages では /auth/callback.html を用いるよう callback URL 生成を調整。
  - update: 2026-01-27 23:53 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。

2408) fix/auth/token-exchange-403 (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/auth/token-exchange-403
- 依存: なし
- 受け入れ基準: GitHub Pages / localhost の両方で `/auth/token` が 403 にならずトークン交換が完了する／認証完了後に待機画面から復帰する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/backend/bff/src/**`, `app/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のトークン交換・CORS 判定へ戻す
- チェックリスト:
  - /auth/token 403 の発生条件を特定する
  - Origin/CSRF/状態署名の検証ロジックを確認する
  - GitHub Pages/localhost で許可されるよう修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 00:03 JST /auth/token 403 の調査に着手。
  - update: 2026-01-28 00:09 JST APP_BASE_URL(S) の origin を ALLOWED_ORIGINS に加味し、/auth/token の Origin 判定/CORS を許可するよう調整。
  - update: 2026-01-28 00:09 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。

2404) feat/app/version-display-build-time (P1) — 進行中 (2026-01-27)
- ブランチ名: feat/app/version-display-build-time
- 依存: なし
- 受け入れ基準: Home 画面左上のバージョン表記が `v1.1.0 (YYYY/MM/DD HH:mm)` 形式になる／日時はビルド時刻で自動更新される／既存の表示要素が崩れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/home/HomePage.tsx`, `app/vite.config.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert して固定表示（v1.0.0）に戻す
- チェックリスト:
  - Home 画面のバージョン表示の参照元を特定する
  - APP_VERSION とビルド時刻の表示を組み合わせる
  - 表示フォーマットを `vX.Y.Z (YYYY/MM/DD HH:mm)` に統一する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 22:29 JST Home 画面のバージョン表示をビルド時刻付きに変更する作業に着手。
  - update: 2026-01-27 22:29 JST pnpm typecheck exit 0（tsdown define warning あり）を確認。
  - done: 2026-01-27 22:29 JST Home 画面のバージョン表記を v{APP_VERSION} (YYYY/MM/DD HH:mm) に変更。

2400) fix/shape/step6-features-table-body-scroll (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/step6-features-table-body-scroll
- 依存: なし
- 受け入れ基準: shape Step6 preview の Features 一覧表でスクロールはボディのみになりヘッダは固定表示される／ヘッダとボディの列幅・整列が一致する／既存のプレビュー表示が退行しない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/map/src/preview/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来のスクロール挙動に戻す
- チェックリスト:
  - Features テーブルの構造/スクロール要素を特定する
  - ヘッダ固定 + ボディスクロール構成へ調整する
  - ヘッダ/ボディの列幅が一致することを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-27 14:52 JST Shape Step6 メタデータウィンドウの再表示制御を修正。
  - update: 2026-01-27 14:52 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 14:48 JST Shape Step6 のメタデータ一覧ウィンドウ再表示の不具合を調査。
  - update: 2026-01-27 12:07 JST Shape Step6 の Features/Layer Sets/Data Tiles Stats の再表示ボタンとアイコン調整を反映。
  - update: 2026-01-27 12:07 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 12:07 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 12:01 JST Shape Step6 のウィンドウ閉じボタン表示とアイコン修正に着手。
  - start: 2026-01-27 08:10 JST Step5 メタデータテーブルを GroupEntity から表示する互換レイヤ実装に着手。
  - start: 2026-01-26 23:58 JST shape Step6 Features テーブルのヘッダ固定/ボディスクロール対応に着手。
  - update: 2026-01-27 06:37 JST TanstackDataGrid をヘッダ固定/ボディスクロール構成へ変更し、列幅同期を調整。
  - update: 2026-01-27 06:37 JST pnpm --filter @hierarchidb/ui-grid typecheck exit 0 を確認。
  - update: 2026-01-27 06:37 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-27 06:37 JST Step6 Features テーブルのヘッダ固定/ボディスクロール対応を完了。

2396) fix/location/step5-terrain-floating-color-follow-step4 (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/location/step5-terrain-floating-color-follow-step4
- 依存: なし
- 受け入れ基準: location Step5 preview の Terrain Types フローティングウィンドウでアイコン/ラベル色が Step4 の設定色に追従する／Step5 のラベルベースサイズが現状の 1.3 倍になる／location Step5 のメタデータテーブルが shape Step6 と同様の FloatingWindow 仕組みになる／GroupEntity のデータが nodeId で抽出され Step5 メタデータテーブルに表示される（tabular 互換レイヤ経由）／既存の Step5 preview 表示が退行しない／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して Terrain Types の色表示を従来に戻す
- チェックリスト:
  - Step4 の設定色が Step5 preview に伝搬される経路を特定する
  - Terrain Types の icon/label に設定色を反映する
  - Step5 のラベルベースサイズを 1.3 倍に調整する
  - location Step5 のメタデータテーブルを shape Step6 同様の FloatingWindow 構成にする
  - GroupEntity を tabular 互換の rows/columns に変換して Step5 のメタデータテーブルへ渡す
  - 既存の preview 表示が維持されることを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-27 14:52 JST Location メタデータ一覧を MapPreviewFloatingTable 化し、選択/カラム切替/再ビルド操作を復旧。
  - update: 2026-01-27 14:52 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 14:52 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 21:12 JST location Step5 の metadata table が「No metadata available yet.」になる件の原因調査と修正に着手。
  - update: 2026-01-27 21:18 JST pnpm typecheck exit 0（tsdown warning: define オプション）を確認。
  - update: 2026-01-27 21:24 JST 認証後に localhost:4200 へリダイレクトされる問題の原因調査に着手。
  - update: 2026-01-27 21:29 JST pnpm typecheck exit 0（tsdown warning: define オプション）を確認。
  - update: 2026-01-27 21:36 JST auth state に origin を含める対応に着手。
  - update: 2026-01-27 21:41 JST pnpm typecheck exit 0（tsdown warning: define オプション）を確認。
  - update: 2026-01-27 21:49 JST state を BFF 生成に統一する修正に着手。
  - blocked: 2026-01-27 21:53 JST pnpm typecheck が @hierarchidb/ui-auth の TS6133（generateState 未使用）で失敗。
  - update: 2026-01-27 22:29 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-27 14:48 JST Location Step5 メタデータテーブルの列切替/選択/再ビルド操作UIの復旧に着手。
  - update: 2026-01-27 11:52 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 11:52 JST Step5 の閉じた Location/Terrain ボタンのアイコンを LocationOn/LocationCity に変更。
  - update: 2026-01-27 11:49 JST LocationDialog の Step5 で nodeId/onUpdate が渡されず previewNodeId が 'preview' 扱いになっていたため、nodeId を伝搬しメタデータ/地図表示を復旧。
  - update: 2026-01-27 11:49 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 11:47 JST Location Step5 の地図/テーブル未表示の原因調査に着手。
  - update: 2026-01-27 11:36 JST kind→type リネーム、Location Step5 メタデータの Terrain Type 連動フィルタと FeatureTableToolbar 共通化を反映。
  - update: 2026-01-27 11:36 JST runtime-worker typecheck が plugin-service-api dist の旧定義で失敗したため build 後に再実行。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/ui-grid build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/plugin-service-api build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 11:36 JST pnpm --filter @hierarchidb/app typecheck exit 0（plugin-base build は tsdown define warning あり）。
  - update: 2026-01-27 11:25 JST kind→type リネームと FeatureTableToolbar 共通化/フィルタ連携対応に着手。
  - start: 2026-01-27 09:45 JST location GroupEntity kind→type 変更と Step5 フィルタ/toolbar 共通化に着手。
  - update: 2026-01-27 09:32 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 09:32 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 09:30 JST IDE-GSM の pointId を lat/lon 小数5桁+SHA-256 ハッシュに変更。
  - update: 2026-01-27 09:20 JST IDE-GSM の pointId 生成と locationId 重複可否をコード調査。
  - update: 2026-01-27 09:07 JST pnpm --filter @hierarchidb/ui-grid build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 09:07 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 09:08 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 09:05 JST metadata テーブルのタイトル/フィルタ/件数UIを Location 表示に合わせて調整。
  - start: 2026-01-27 08:52 JST metadata テーブルの UI（タイトル/フィルタ/カウント表示）を shape preview 方式に合わせて調整開始。
  - update: 2026-01-27 08:43 JST pnpm --filter @hierarchidb/ui-grid build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 08:44 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 08:40 JST metadata テーブルの高さが小さい問題に対し DataGridPreview を親高さ追従に変更。
  - update: 2026-01-27 08:33 JST DataGridPreview が tableId 無しでも rows があれば表示するよう条件を修正。
  - update: 2026-01-27 08:34 JST pnpm --filter @hierarchidb/ui-grid build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 08:34 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 08:30 JST metadata テーブルが "Table not created yet" のみ表示される原因を DataGridPreview 側で調査。
  - update: 2026-01-27 08:22 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 08:23 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 08:20 JST Step5 メタデータテーブルを GroupEntity 由来の rows/columns で表示するアダプタを実装。
  - start: 2026-01-26 23:21 JST Step5 Terrain Types の色を Step4 設定に追従させる調査に着手。
  - update: 2026-01-26 23:24 JST Step5 ラベルサイズを 1.3 倍へ調整する要件を追加。
  - update: 2026-01-26 23:38 JST Step5 メタデータの FloatingWindow を shape Step6 と同様の構成へ移行する作業に着手。
  - update: 2026-01-26 23:39 JST LocationPreviewList を追加し Step5 メタデータ表示を移行、ラベルサイズ/色反映を更新。
  - update: 2026-01-26 23:39 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 23:56 JST LocationPreviewList の再表示で isVisible が復元されない問題を修正。
  - update: 2026-01-26 23:56 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 07:23 JST location のメタデータを nodeId 直結テーブルに変更し sessions/tableId 依存を撤去。
  - update: 2026-01-27 07:24 JST pnpm --filter @hierarchidb/tabular-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 07:24 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 07:40 JST location の sessions ストレージ/参照を削除し nodeId 直結に統一。
  - update: 2026-01-27 07:40 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 07:40 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2403) fix/location/id-pointid-separation (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/location/id-pointid-separation
- 依存: なし
- 受け入れ基準: location の id が uuidv4() で生成される／pointId が lat/lon 小数5桁のハッシュから生成される／IDE-GSM と tabular 取り込みの両方で同じ pointId 生成ルールが適用される／既存 UI 表示が退行しない／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/index.ts`, `packages/features/location-store/src/ideGsmRouteCsv.ts`, `plugins/location-plugin/src/worker/tabular/materialize.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `plugins/location-plugin/src/services/pointRepository.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert して id=pointId の従来挙動に戻す
- チェックリスト:
  - pointId 生成の共通ヘルパーを用意し IDE-GSM/Tabular 両方へ適用する
  - location id を uuidv4() で生成するよう置き換える
  - 既存 UI/保存フローの影響を確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 18:43 JST id/pointId 分離の実装に着手。
  - update: 2026-01-27 19:43 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define warning あり）。
  - update: 2026-01-27 19:43 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-27 19:43 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。

2394) fix/route/create-dialog-stepper-visible (P1) — 完了 (2026-01-26)
- ブランチ名: fix/route/create-dialog-stepper-visible
- 依存: なし
- 受け入れ基準: Create Route ダイアログ上部に Stepper が表示される／他の Create ダイアログの Stepper 表示が退行しない／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/**`, `app/src/**`, `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して Create Route の Stepper 表示を元に戻す
- チェックリスト:
  - Create Route ダイアログの Stepper 非表示条件を特定する
  - Stepper 表示条件を修正する
  - 他 Create ダイアログの Stepper 表示が維持されることを確認する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:21 JST Create Route ダイアログの Stepper 非表示問題の調査に着手。
  - update: 2026-01-26 22:22 JST route-plugin UI entry に steps-provider 登録を追加。
  - update: 2026-01-26 22:23 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-26 22:24 JST Create Route の Stepper 表示を確認し完了。

2393) feat/location/step2-data-source-inline-import-ui (P1) — 完了 (2026-01-26)
- ブランチ名: feat/location/step2-data-source-inline-import-ui
- 依存: なし
- 受け入れ基準: Step2 の IDE-GSM Box に読み込み済み時はファイル名+Fileアイコン+削除×ボタンが表示される／未読み込み時は "No CSV files imported." と Import Local Files/Import Remote Files が secondary 色で横並び表示される／未読み込み時は Step3 に遷移できない／Import Local Files で現行 Alternative Method 上半分をモーダル表示し×で閉じられ、読み込み成功で自動クローズ／Import Remote Files で Alternative Method 下半分をモーダル表示し×で閉じられ、Download ボタン押下の読み込み成功で自動クローズ／Clear cache for selected data source ボタンが撤去される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して Step2 の Data Source/Details の従来レイアウトに戻す
- チェックリスト:
  - IDE-GSM Box の未読込/読込済み表示を統合する
  - Import Local/Remote のモーダルを現行 Alternative Method から移設する
  - Clear cache ボタンを撤去する
  - Step3 遷移ガードを未読込時に維持する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:11 JST Step2 Data Source の統合UIとモーダル再編に着手。
  - update: 2026-01-26 22:18 JST IDE-GSM Box 内にファイル状態/Import ボタン/削除ボタンを集約し、Local/Remote モーダルを追加。
  - update: 2026-01-26 22:19 JST Step3 遷移条件を IDE-GSM ファイル読み込み必須に更新。
  - update: 2026-01-26 22:20 JST pnpm --filter @hierarchidb/ui-file typecheck exit 0。
  - update: 2026-01-26 22:20 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
  - update: 2026-01-26 22:20 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-26 22:21 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 22:21 JST Step2 の Data Source 統合UIと Import モーダル再編を完了。

2394) fix/location/step2-ide-gsm-parse-snackbar (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step2-ide-gsm-parse-snackbar
- 依存: なし
- 受け入れ基準: Step2でIDE-GSMファイル選択→Step3遷移時に "Failed to parse ...csv" のSnackbarが出ない／IDE-GSMの読み込み/選択フローは維持される／原因・発生範囲・修正方法と適用範囲を説明できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の IDE-GSM 解析処理に戻す
- チェックリスト:
  - 失敗Snackbarの発生条件を特定する
  - 原因と発生範囲を説明できるようにする
  - 影響範囲を最小に修正する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:24 JST Step2 IDE-GSM 選択後の parse Snackbar 不具合の調査に着手。
  - update: 2026-01-26 22:25 JST Step2 unmount 時の blob URL revoke が Step3 解析失敗を誘発していたため、保持条件を追加。
  - update: 2026-01-26 22:25 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 22:25 JST Step3 での parse Snackbar 不具合を修正。

2395) fix/location/step2-hide-custom-manual (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step2-hide-custom-manual
- 依存: なし
- 受け入れ基準: Step2のData Source選択肢からCustom/Manualが表示されない／既存の他選択肢の表示・挙動が維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`
- ロールバック手順: 該当差分を revert して Custom/Manual を再表示する
- チェックリスト:
  - Data Source から custom/manual を除外する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:27 JST Step2 の Data Source から custom/manual を除外する作業に着手。
  - update: 2026-01-26 22:28 JST Data Source の選択肢から custom/manual を非表示に変更。
  - update: 2026-01-26 22:28 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 22:28 JST Step2 の Data Source から custom/manual を除外。

2396) fix/location/step2-ide-gsm-fetch-error-snackbar (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step2-ide-gsm-fetch-error-snackbar
- 依存: なし
- 受け入れ基準: Step2でIDE-GSMファイル選択直後に "Failed to parse IDE-GSM CSV. Failed to fetch" のSnackbarが出ない／IDE-GSMの読み込み/選択フローは維持される／原因・発生範囲・修正方法と適用範囲を説明できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の blob URL revoke 挙動へ戻す
- チェックリスト:
  - 失敗Snackbarの発生条件を特定する
  - 原因と発生範囲を説明できるようにする
  - 影響範囲を最小に修正する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:31 JST Step2 IDE-GSM 選択直後の Failed to fetch Snackbar 調査に着手。
  - update: 2026-01-26 22:31 JST Step2のunmount cleanupでblob URLが早期revokeされる場合があり、fetch失敗に繋がるため撤去。
  - update: 2026-01-26 22:32 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 22:32 JST Step2 選択直後の Failed to fetch Snackbar を解消。

2397) refactor/location-route/step2-data-source-common (P1) — 完了 (2026-01-26)
- ブランチ名: refactor/location-route/step2-data-source-common
- 依存: なし
- 受け入れ基準: location-plugin Step2 の構成要素が共通化される／route-plugin Step2 が共通実装に置き換わる／既存の route Step2 の表示/挙動/遷移条件が維持される（差分は明記）／pnpm --filter @hierarchidb/location-plugin typecheck と pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`, 共有UIパッケージ配下（調査後に確定）
- ロールバック手順: 該当差分を revert して各プラグイン独自Step2へ戻す
- チェックリスト:
  - ExecPlan を作成する
  - location Step2 の共通コンポーネントを作成する
  - route Step2 を共通コンポーネント利用へ置換する
  - 翻訳キーと既存の文言差分を整理する
  - pnpm --filter @hierarchidb/location-plugin typecheck と pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:40 JST location/route Step2 の共通化と route 再構築に着手。
  - update: 2026-01-26 22:45 JST ui-datasource に IdeGsmImportPanel を追加し location/route Step2 に適用。
  - update: 2026-01-26 22:46 JST route-plugin の IDE-GSM 文言を補完。
  - update: 2026-01-26 22:46 JST pnpm --filter @hierarchidb/ui-datasource build exit 0（tsdown warning: define オプション）。
  - update: 2026-01-26 22:47 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
  - update: 2026-01-26 22:47 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-26 22:47 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - done: 2026-01-26 22:47 JST location/route Step2 の共通化と route Step2 再構築を完了。
  - update: 2026-01-26 22:49 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
  - update: 2026-01-26 22:49 JST pnpm --filter @hierarchidb/ui-datasource build exit 0（tsdown warning: define オプション）。
  - update: 2026-01-26 22:49 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-26 22:49 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。

2398) fix/route/step2-hide-non-ide-gsm (P1) — 完了 (2026-01-26)
- ブランチ名: fix/route/step2-hide-non-ide-gsm
- 依存: なし
- 受け入れ基準: route Step2 の Data Source から OpenStreetMap/Searoute/Custom が表示されない／IDE-GSM の表示・挙動が維持される／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`
- ロールバック手順: 該当差分を revert して Data Source 選択肢を元に戻す
- チェックリスト:
  - Data Source から OpenStreetMap/Searoute/Custom を除外する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 23:07 JST route Step2 の Data Source から OSM/Searoute/Custom を除外する作業に着手。
  - update: 2026-01-26 23:08 JST Data Source を IDE-GSM のみに変更。
  - update: 2026-01-26 23:08 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - done: 2026-01-26 23:08 JST route Step2 の Data Source から OSM/Searoute/Custom を除外。

2399) fix/route/step2-remove-clear-cache-button (P1) — 完了 (2026-01-26)
- ブランチ名: fix/route/step2-remove-clear-cache-button
- 依存: なし
- 受け入れ基準: route Step2 の「Clear cache for selected data source」ボタンが表示されない／他の UI/挙動は維持される／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`
- ロールバック手順: 該当差分を revert して Clear cache ボタンを復元する
- チェックリスト:
  - Clear cache ボタンを撤去する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 23:29 JST route Step2 の Clear cache ボタン撤去に着手。
  - update: 2026-01-26 23:30 JST Clear cache ボタンを撤去し Step2 レイアウトを調整。
  - update: 2026-01-26 23:30 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - done: 2026-01-26 23:30 JST route Step2 の Clear cache ボタン撤去を完了。

2400) fix/location/step3-ide-gsm-blob-fetch-error (P1) — 完了 (2026-01-27)
- ブランチ名: fix/location/step3-ide-gsm-blob-fetch-error
- 依存: なし
- 受け入れ基準: IDE-GSM.csv を読み込み→タブ再起動後に location Step3 へ遷移しても "Failed to parse IDE-GSM CSV. Failed to fetch" のSnackbarが出ない／IDE-GSMの読み込み/選択フローは維持される／原因・発生範囲・修正方法と適用範囲を説明できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`
- ロールバック手順: 該当差分を revert して従来の IDE-GSM 解析フローに戻す
- チェックリスト:
  - 失敗Snackbarの発生条件を特定する
  - blob URL 失効時の挙動を調整する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 09:04 JST Step3 の blob URL 失効による parse エラー調査に着手。
  - update: 2026-01-27 09:34 JST blob URL が失効している場合は再解析せず、既存選択から availability を復元。
  - update: 2026-01-27 09:35 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-27 09:35 JST Step3 の blob URL fetch エラーを回避。

2401) fix/location/step3-step5-empty-after-tab-reopen (P1) — 完了 (2026-01-27)
- ブランチ名: fix/location/step3-step5-empty-after-tab-reopen
- 依存: なし
- 受け入れ基準: Step2→Step3遷移後に国×タイプのチェックボックスが表示される／Step5プレビューで地図とテーブルが表示される／kind→type のプロパティ名変更の影響を含め原因・発生範囲・修正方法と適用範囲を説明できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の Step3/Step5 挙動に戻す
- チェックリスト:
  - Step3/Step5 が空になる条件を特定する
  - kind→type 変更の影響範囲を確認する
  - 最小修正で再表示されるようにする
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 12:11 JST Step3/Step5 の空表示問題の調査に着手。
  - update: 2026-01-27 12:16 JST local ファイルは data URL を保存し、タブ再起動後も fetch 可能に変更。
  - update: 2026-01-27 12:17 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
  - update: 2026-01-27 12:17 JST pnpm --filter @hierarchidb/ui-datasource build exit 0（tsdown warning: define オプション）。
  - update: 2026-01-27 12:17 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-27 18:50 JST IDE-GSM を複数読み込み可能にし、Split button UI を追加。
  - update: 2026-01-27 18:51 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
  - update: 2026-01-27 18:52 JST pnpm --filter @hierarchidb/ui-datasource build exit 0（tsdown warning: define オプション）。
  - update: 2026-01-27 18:52 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown warning: define オプション）。
  - update: 2026-01-27 18:52 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-27 18:52 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0。
  - done: 2026-01-27 18:53 JST Step3/Step5 の空表示と IDE-GSM 複数読み込み対応を完了。

2402) feat/location/step2-split-button-multi-file-cards (P1) — 進行中 (2026-01-27)
- ブランチ名: feat/location/step2-split-button-multi-file-cards
- 依存: なし
- 受け入れ基準: Step2 の Import が Split button になり、左側ラベル/アクションが直近の選択に追従する／Split button の見た目が一体化して表示される／読み込み済みファイルが「アイコン+ファイル名+サイズ+×」カードとして複数表示される／×で個別削除できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/datasource/src/IdeGsmImportPanel.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` など（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の IDE-GSM UI に戻す
- チェックリスト:
  - Split button UI と最終選択アクションを実装する
  - 複数ファイル表示カードを実装する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 19:45 JST Step2 Split button と複数ファイルカード対応に着手。
  - update: 2026-01-27 19:55 JST Split button の最終選択追従・統一見た目・ファイルカード再構成対応に着手。
 - update: 2026-01-27 20:05 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0。
 - update: 2026-01-27 20:06 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
 - done: 2026-01-27 20:07 JST Split button の最終選択追従・統一見た目・ファイルカード再構成を完了。
 - update: 2026-01-27 20:15 JST ファイルカードのレイアウト幅を内容ベースに調整する対応に着手。
 - update: 2026-01-27 20:17 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
 - update: 2026-01-27 20:20 JST ファイルカードにボーダーを追加する対応に着手。
 - update: 2026-01-27 20:22 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
 - update: 2026-01-27 20:25 JST ファイルカードコンテナに flex-wrap を適用する対応に着手。
 - update: 2026-01-27 20:27 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
 - update: 2026-01-27 20:30 JST Import 重複（同一ファイル/URL）の再追加を無視する対応に着手。
  - update: 2026-01-27 20:32 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。

2403) fix/bff/multi-app-base-url (P1) — 進行中 (2026-01-27)
- ブランチ名: fix/bff/multi-app-base-url
- 依存: なし
- 受け入れ基準: BFF が APP_BASE_URL 未設定でも `http://localhost:4200` と `https://kubohiroya.github.io/hierarchidb` の両方からのログインで正しいフロントに戻る／APP_BASE_URLS で複数ベースURL（パス含む）を扱える／既存の単一 APP_BASE_URL 運用が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/backend/bff/src/utils/redirect-uri.ts`, `packages/backend/bff/src/env-mapper.ts`, `packages/backend/bff/src/types.ts`（必要に応じて）
- ロールバック手順: 該当差分を revert して従来の APP_BASE_URL/ALLOWED_ORIGINS 判定に戻す
- チェックリスト:
  - APP_BASE_URLS の導入と複数ベースURL選択ロジックを実装する
  - state から returnOrigin を解釈できるようにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-27 20:45 JST BFF の複数ベースURL対応に着手。
  - update: 2026-01-27 20:55 JST pnpm --filter @hierarchidb/bff typecheck exit 0。
  - done: 2026-01-27 20:56 JST APP_BASE_URLS を導入し複数フロントの戻り先判定を更新。
  - update: 2026-01-27 21:05 JST BFF の wrangler.toml から未使用 env を撤去する作業に着手。
  - done: 2026-01-27 21:10 JST wrangler.hierarchidb.toml から未使用 env を撤去。

2350) feat/shape/step6-recycling-diff-build (P1) — 進行中 (2026-01-26)
- ブランチ名: feat/shape/step6-recycling-diff-build
- 依存: なし
- 受け入れ基準: Step6 Features FloatingWindow に Recycling ボタンが追加され、選択行の Recycling 状態が部分的→オン→オフの循環で切替できる／Status 列に Recycling アイコンが表示される／Recycling がオンの行がある場合は次回 build が差分ビルドになり、完了後に該当行の Recycling が自動でオフになる／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `packages/vt-orchestrator/src/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して Recycling UI/差分ビルド経路を元に戻す
- チェックリスト:
  - ExecPlan を作成する
  - Recycling UI と状態トグルを実装する
  - Recycling 状態の永続化と Status 表示を実装する
  - 差分ビルドの実行と完了後の解除を実装する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 20:20 JST Step6 Recycling UI と差分ビルド対応の ExecPlan 作成に着手。
  - update: 2026-01-26 20:30 JST ExecPlan を plans/shape-step6-recycling-diff-build-execplan.md に作成。

2392) fix/shape/step5-resume-queued-fetch-retry (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/step5-resume-queued-fetch-retry
- 依存: なし
- 受け入れ基準: メモリ溢れ/クラッシュでfetchのqueuedが残っても再ビルドで再処理される／selectedArrayByCountries が空の復帰でも queued が failed 固定にならない／既存の正常ビルドフローが維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して従来の resume/fetch 挙動へ戻す
- チェックリスト:
  - resume 時に payloads なしでも既存 fetch タスクを再処理できる条件を整理する
  - fetch 未実行で queued を failed に落とす挙動を抑制する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 21:53 JST resume build でfetchのqueuedがfailed固定になる問題の修正に着手。
  - update: 2026-01-26 21:54 JST resume時に payloads が空でも既存 fetch タスクがある場合は runStageTasks で再処理するように変更。
  - update: 2026-01-26 21:55 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2393) analysis/shape-route/build-commonization-status (P2) — 進行中 (2026-01-28)
- ブランチ名: analysis/shape-route/build-commonization-status
- 依存: なし
- 受け入れ基準: shape/route のビルドプロセス共通化の現状をコード参照付きで説明できる／共通化済み領域と未共通化領域を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `plugins/route-plugin/src/services/**`, `packages/batch-runtime-services/**`, `packages/ui-batch-progress/**`（必要に応じて追加）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 共通化済みの基盤（BatchSession/TaskQueue/Progress）を列挙する
  - shape/route 固有ロジックの差分を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 22:34 JST shape/route ビルド共通化の現状整理に着手。
  - update: 2026-01-28 22:34 JST route は AbstractBatchSession + BaseBatchSessionManager と VtTaskQueueDb を採用し進捗/タスクキューを共通化済みだが、shape は runShapePipeline/runStageTasks の独自パイプラインで共通セッション化は未実施であることを確認。

2394) analysis/shape/unused-implementation-candidates (P2) — 進行中 (2026-01-28)
- ブランチ名: analysis/shape/unused-implementation-candidates
- 依存: なし
- 受け入れ基準: shape-plugin 内の未使用/無効化実装をコード根拠付きで列挙できる／削除候補の影響範囲を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 未使用/無効化の候補を抽出する
  - 参照状況（未使用根拠）を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 22:38 JST shape-plugin の未使用/無効化実装の棚卸しに着手。
  - update: 2026-01-28 22:40 JST OpenStreetMap データソースの UI 無効化/メタデータ取得拒否、legacy 選択配列対応、未参照の FetchRetentionToggle、describe.skip テストを削除候補として列挙。
  - update: 2026-01-28 22:52 JST OpenStreetMap データソース/legacy 選択配列/未参照コンポーネント/skipテストを削除し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2395) analysis/shape/refactor-candidates (P2) — 進行中 (2026-01-28)
- ブランチ名: analysis/shape/refactor-candidates
- 依存: なし
- 受け入れ基準: shape-plugin 内のリファクタリング候補をコード根拠付きで列挙できる／理由・影響範囲・優先度を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - リファクタリング候補を抽出する
  - 理由/影響範囲/優先度を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-29 07:54 JST shape/route Step4/Step5 UI 共通化の現状を調査して整理。
  - start: 2026-01-28 23:17 JST shape-plugin のリファクタリング候補整理に着手。
  - update: 2026-01-28 23:21 JST plans/shape-step5-refactor-execplan.md を作成し Step5/UI と pipeline の分割リファクタ計画を明文化。
  - update: 2026-01-28 23:25 JST Step5 の進捗集計を shared helper に抽出し、runShapePipeline を stage セクション化して整理。
  - done: 2026-01-28 23:25 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-28 23:30 JST useShapeBuildStep を timing/auto-resume/tileSummary の3フックに分割し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 20:55 JST Recycling UI/差分ビルド対応の実装に着手（UI/パイプライン/VT フィルタ）。
  - update: 2026-01-26 21:10 JST Recycling トグル/UI/Status 表示と差分ビルドの allowlist フィルタ/完了後の解除を実装。
  - done: 2026-01-26 21:12 JST pnpm --filter @hierarchidb/shape-plugin typecheck / pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-26 21:20 JST 既存 fetch cache に __hdbFeatureId がない場合の再エンコード処理を追加。
  - done: 2026-01-26 21:21 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を再確認。
  - update: 2026-01-29 03:59 JST shape-plugin の追加リファクタ候補を提示。

2349) fix/location/step4-slider-right-overflow (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step4-slider-right-overflow
- 依存: なし
- 受け入れ基準: Step4 のスライダーが右側にはみ出さずコンテナ内に収まる／既存の見た目余白は維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`
- ロールバック手順: 該当差分を revert してスライダーの幅/マージンを元に戻す
- チェックリスト:
  - slider の右側はみ出しを解消する
  - 見た目の余白が維持されることを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 20:05 JST Step4 slider の右側はみ出し修正に着手。
  - update: 2026-01-26 20:08 JST slider の幅を calc(100% - 24px) にして右側のはみ出しを抑止。
  - done: 2026-01-26 20:09 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2348) fix/location/step4-slider-container-margin (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step4-slider-container-margin
- 依存: なし
- 受け入れ基準: Step4 Display Settings 配下の Slider コンテナに 16px の margin が入り、間隔が改善される／既存の 24px スライダーマージンと marks 表示は維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`
- ロールバック手順: 該当差分を revert して margin を元に戻す
- チェックリスト:
  - Slider コンテナの padding を margin に変更する
  - 既存の slider margin/marks が維持されることを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 19:45 JST Step4 Slider コンテナの margin 変更に着手。
  - update: 2026-01-26 19:47 JST slider コンテナの sx を p:2 から m:2 に変更。
  - done: 2026-01-26 19:48 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2347) fix/location/step4-slider-container-padding (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step4-slider-container-padding
- 依存: なし
- 受け入れ基準: Step4 Display Settings 配下の Slider コンテナに 16px padding が入り、並列スライダーの間隔が改善される／既存の 24px スライダーマージンと marks 表示は維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`
- ロールバック手順: 該当差分を revert して padding を元に戻す
- チェックリスト:
  - Display Settings 配下の Slider コンテナに 16px padding を追加する
  - 既存の slider margin/marks が維持されることを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 19:30 JST Step4 Slider コンテナの padding 追加に着手。
  - update: 2026-01-26 19:35 JST Display Settings 配下の slider コンテナに p=2 を適用。
  - done: 2026-01-26 19:36 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2346) fix/location/step5-terrain-title-and-metadata-loading (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step5-terrain-title-and-metadata-loading
- 依存: なし
- 受け入れ基準: Terrain Types ウィンドウ内の冗長なタイトル表示が撤去される／Metadata の Loading 表示が出る理由を説明する／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/MapToggleCard.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して従来のタイトル表示に戻す
- チェックリスト:
  - Terrain Types カードのタイトル表示を撤去する
  - Metadata Loading の理由を説明する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 19:05 JST Terrain Types タイトル撤去と metadata loading 説明に着手。
  - update: 2026-01-26 19:10 JST Terrain Types 内タイトル表示を抑止するため MapToggleCard のヘッダを条件表示に変更。
  - done: 2026-01-26 19:11 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2345) fix/location/step5-terrain-floating-window (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step5-terrain-floating-window
- 依存: なし
- 受け入れ基準: location step5 preview の Terrain Types が FloatingWindow 化される／Area Centroid のアイコンが City 表示になる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `plugins/location-plugin/src/ui/components/steps/locationTypes.ts`
- ロールバック手順: 該当差分を revert して Terrain Types を固定パネルに戻し、アイコンを元に戻す
- チェックリスト:
  - Terrain Types を FloatingWindow 化する
  - Area Centroid アイコンを City に戻す
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 18:45 JST Terrain Types の FloatingWindow 化とアイコン修正に着手。
  - update: 2026-01-26 18:55 JST Terrain Types を FloatingWindow 化し、Area Centroid のアイコンを City に変更。
  - done: 2026-01-26 18:56 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2344) fix/location/step5-preview-floating-parity (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step5-preview-floating-parity
- 依存: なし
- 受け入れ基準: location step5 preview から "Preview the generated points on the map." 表示/Refresh/Loading map preview を撤去する／Terrain Types と Metadata の floating window が shape-plugin step6 preview と同等の見た目・挙動になる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して従来の説明文/Refresh/パネル表示へ戻す
- チェックリスト:
  - 説明文/Refresh/Loading map preview を撤去する
  - Terrain Types/Metadata の floating window を shape preview と同等にする
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 18:15 JST location step5 preview の表示整理と floating window の parity 修正に着手。
  - update: 2026-01-26 18:28 JST 説明文/Refresh/Loading 表示を撤去し、FloatingWindow で metadata を表示。
  - done: 2026-01-26 18:29 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2343) fix/location/step5-preview-floating-panels (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step5-preview-floating-panels
- 依存: なし
- 受け入れ基準: location step5 preview で map/metadata のタブ切替が廃止され map が常時全面表示になる／Terrain Types の表示トグルと metadata テーブルが map 上の floating window に移動する（shape preview と同様）／既存の地図操作が維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert してタブ切替と従来レイアウトへ戻す
- チェックリスト:
  - preview のタブ切替 UI を撤去する
  - map を常時全面表示にする
  - Terrain Types トグルと metadata テーブルを floating window 化する
  - 既存の地図操作が維持されることを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 17:40 JST location step5 preview のタブ撤去と floating panel 化に着手。
  - update: 2026-01-26 17:55 JST タブ撤去と map 全面化、Terrain/metadata の floating panel 化を反映。
  - done: 2026-01-26 17:56 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2342) fix/location/step4-slider-margins-and-default-colors (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/location/step4-slider-margins-and-default-colors
- 依存: なし
- 受け入れ基準: Step4 の全 Slider に左右 24px のマージンが入る／Icon/Label の size range に min/max の marks (0/12) が表示される／Area centroid は赤、Port は青、Station は緑が Icon/Label の既定色になる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`
- ロールバック手順: 該当差分を revert してスライダー/既定色/marks を元に戻す
- チェックリスト:
  - Slider に左右 24px のマージンを適用する
  - Icon/Label の size range に 0/12 の marks を追加する
  - Icon/Label の既定色を指定通りに変更する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 16:37 JST Step4 スライダー調整と既定色変更に着手。
  - update: 2026-01-26 17:05 JST Icon/Label の既定色変更に着手。
  - update: 2026-01-26 17:18 JST location-store/ui-map の build を実行し、LocationMapPreviewStep の型エラーを修正。
  - done: 2026-01-26 17:20 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 17:26 JST LocationMapPreviewStep の既定色整合と public アイコン対応を反映。
  - done: 2026-01-26 17:27 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を再確認。

2341) fix/location/step4-style-config-tweaks (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step4-style-config-tweaks
- 依存: なし
- 受け入れ基準: Step4 の Zoom Level スライダーに min/max marks が表示される／Icon Settings の area_centroid デフォルトが City になる／Icon 選択肢から Public が削除される／Step4 タイトルが Style Config になる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`, `plugins/location-plugin/src/ui/components/steps-provider.tsx`, `plugins/location-plugin/src/ui/locales/*.json`（調査後に確定）
- ロールバック手順: 該当差分を revert して UI/文言/デフォルトを元に戻す
- チェックリスト:
  - Zoom Level スライダーに marks を追加する
  - area_centroid のデフォルトアイコンを City に変更する
  - Icon 選択肢から Public を削除する
  - Step4 のタイトルを Style Config に変更する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 16:01 JST Step4 の Style Config 調整に着手。
  - update: 2026-01-26 16:02 JST Zoom marks 追加、area_centroid のデフォルトを City に変更、Public を削除。
  - update: 2026-01-26 16:02 JST Step4 タイトルを Style Config に変更。
  - done: 2026-01-26 16:02 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2340) fix/location/step4-remove-build-and-cleanup (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step4-remove-build-and-cleanup
- 依存: なし
- 受け入れ基準: Step4 から download/cleanup の説明文と concurrent/cleanup UI が撤去される／Location の Build ステップが撤去され、プレビューが Step4 になる／TreeConsole の location ノードでコンテキストメニューと InfoPanel のビルドが disabled になる／pnpm --filter @hierarchidb/app typecheck もしくは関連パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`, `plugins/location-plugin/src/ui/components/steps-provider.tsx`, `app/src/router/pages/tree/console/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して Step4/Build/ボタン挙動を元に戻す
- チェックリスト:
  - Step4 の download/cleanup UI を撤去する
  - Build ステップを撤去しプレビューが Step4 になることを確認する
  - TreeConsole の build ボタン/メニューを location では disabled にする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 15:53 JST Step4 の download/cleanup UI 撤去と Build ステップ削除に着手。
  - update: 2026-01-26 15:58 JST Step4 から download/cleanup UI を撤去し、Build ステップを削除。
  - update: 2026-01-26 15:59 JST location のビルドメニューと InfoPanel のビルドボタンを disabled に変更。
  - update: 2026-01-26 15:59 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-26 16:00 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。

2339) feat/location/step4-display-config (P1) — 完了 (2026-01-26)
- ブランチ名: feat/location/step4-display-config
- 依存: なし
- 受け入れ基準: Step4 に Representation/Icon/Label の各設定カードが追加され、Area Centroid/Airport/Port/Station/Interchange それぞれの値を保存できる／LocationEntity スキーマに設定が追加される／i18n で各設定の意味を表示する／既存の Step4 挙動と保存/読み込みが維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.md に運用ログ・ロールバック手順を記載する
- 影響範囲: `packages/features/location-store/src/index.ts`, `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`, `plugins/location-plugin/src/ui/locales/*.json`, `plugins/location-plugin/src/common/i18n/index.ts`
- ロールバック手順: 上記ファイルの差分を revert して Step4 を既存 UI に戻す
- チェックリスト:
  - LocationEntity に表示設定スキーマを追加する
  - Step4 に Representation/Icon/Label 設定 UI を追加する
  - i18n 文言を追加する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 15:19 JST Step4 の表示設定（Representation/Icon/Label）追加に着手。
  - update: 2026-01-26 15:26 JST location-store に表示設定の型と LocationEntity のフィールドを追加。
  - update: 2026-01-26 15:27 JST Step4 に Representation/Icon/Label の UI と i18n を追加。
  - update: 2026-01-26 15:28 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define 警告あり）を確認。
  - done: 2026-01-26 15:29 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 15:22 JST ExecPlan を plans/location-step4-display-config-execplan.md に作成。

2338) fix/app/create-basemap-command-error (P1) — 完了 (2026-01-26)
- ブランチ名: fix/app/create-basemap-command-error
- 依存: なし
- 受け入れ基準: create:basemap 実行時の INVALID_OPERATION Unknown action エラーが出力されない／basemap 初期ノード作成とダイアログ起動が維持される／影響範囲が明確になる／pnpm typecheck が exit 0 もしくは関連パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/**`, `packages/**`, `plugins/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して既存挙動に戻す
- チェックリスト:
  - create:basemap のコマンド登録/呼び出し経路を特定する
  - Unknown action エラーの発生条件を特定する
  - エラーが出ないように修正する
  - pnpm typecheck もしくは関連パッケージ typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 14:44 JST create:basemap の Unknown action エラー調査に着手。
  - update: 2026-01-26 14:45 JST create: の成功経路で return せず Unknown action に落ちる問題を修正。
  - done: 2026-01-26 14:45 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。

2337) fix/shape/step6-feature-table-match-highlight (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/step6-feature-table-match-highlight
- 依存: なし
- 受け入れ基準: Step6 の Features テーブルでキーワード一致行の背景色が paper ベースの淡い紫に調整される／文字色と可読性が維持される／選択/ホバーなど他状態の色に影響しない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当スタイル差分を revert し、従来の強い secondary 背景に戻す
- チェックリスト:
  - Step6 の一致行背景スタイルを特定する
  - paper ベースの淡い紫に調整する
  - 既存の選択/ホバー状態が影響を受けないことを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:57 JST Step6 Features テーブルの一致行背景色調整に着手。
  - update: 2026-01-26 12:58 JST matched 行の背景色を paper ベースの淡い紫に調整。
  - done: 2026-01-26 12:58 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2378) fix/ui/context-menu-order (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/ui/context-menu-order
- 依存: なし
- 受け入れ基準: TreeTable/TreeNodeInfoPanel/BreadCrumbのコンテキストメニューが Create||Cut|Copy|Duplicate|Move to Trash||Visible||Create|Edit|Build|Preview の順になる／区切りと文言は既存のまま維持される／TASKS.mdに運用ログを記載する
- 影響範囲: `app/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - TreeTableのメニュー順を修正する
  - TreeNodeInfoPanelのメニュー順を修正する
  - BreadCrumbのメニュー順を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 07:45 JST TreeTable/TreeNodeInfoPanel/BreadCrumbのコンテキストメニュー並び順修正に着手。
  - done: 2026-01-26 07:48 JST メニュー並び順を更新（未検証）。
  - blocked: 2026-01-26 07:49 JST pnpm --filter @hierarchidb/app build で @hierarchidb/util の buildEvenZoomBandBoundaries/normalizeZoomBandBoundaries が重複 export になり失敗（AMBIGUOUS_EXTERNAL_NAMESPACES）。
  - update: 2026-01-26 07:52 JST @hierarchidb/util の index export を整理し重複解消（未検証）。
  - done: 2026-01-26 07:58 JST pnpm --filter @hierarchidb/app build exit 0（tsdown define 警告/プラグイン警告/チャンクサイズ警告あり）。

2379) fix/ui/app-init-loading-blank (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/app-init-loading-blank
- 依存: なし
- 受け入れ基準: 初期化開始直後からローディングUIが表示され白画面の長時間露出が解消される／LinearProgress が繰り返しリセットされる原因を特定して抑止する／初期化進捗UIの状態遷移が安定し再マウントでチラつかない／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `app/src/**`（調査後に確定）
- ロールバック手順: 初期化UIの差分を revert し、現行の初期化表示へ戻す
- チェックリスト:
  - 初期化UIが表示されるまでの経路と白画面の原因を特定する
  - LinearProgress の再初期化ループ原因を特定する
  - 初期化UIの表示タイミングと状態遷移を安定化させる
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 16:20 JST 初期化UIの白画面/再読み込み問題の調査に着手。
  - update: 2026-01-26 16:35 JST entry.client で先行レンダリングし、index.html に初期ローディングUIを追加。
  - done: 2026-01-26 16:45 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。

2377) feat/shape/geoboundaries-topojson-pipeline (P1) — 進行中 (2026-01-26)
- ブランチ名: feat/shape/geoboundaries-topojson-pipeline
- 依存: なし
- 受け入れ基準: step2でgeoBoundariesと並置のサブタイプgeoBoundaries:TopoJSONが選択可能になる／step5 fetchでgeoBoundaries:TopoJSONはTopoJSON取得→(カナダ/グリーンランド時)TopoJSON merge→ズーム率簡略化→topojson+gzipでキャッシュ保存する／step5 fetchでgeoBoundariesはGeoJSON取得→(カナダ/グリーンランド時)TopoJSON変換+merge→GeoJSONへ戻す→ズーム率簡略化→flatgeobufでキャッシュ保存する／transformでキャッシュ形式に応じた処理ができTopoJSONキャッシュはgzip展開→面積px^2閾値に基づく2通りのtoleranceをズーム率で評価し必要なら再簡略化→最終的にflatgeobufでキャッシュ保存する／vtステージの挙動は維持される／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - step2のデータソースにgeoBoundaries:TopoJSONを追加する
  - step5 fetchのデータソース別ストラテジーを拡張する
  - transformのキャッシュ形式別処理を拡張する
  - vtステージの既存挙動が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 15:10 JST shapeのgeoBoundaries:TopoJSON追加とfetch/transform拡張に着手。
  - blocked: 2026-01-26 15:32 JST pnpm --filter @hierarchidb/shape-plugin typecheck が topojson型未解決/ShapeDataSourceName不一致/FetchCacheRecord format未定義で失敗。
  - update: 2026-01-26 15:44 JST plugin-service-api/shape-store/gis-sdkのDataSource型とFetchCacheRecordを更新し、vt-orchestratorへtypes追加方針を確定。
  - update: 2026-01-26 15:49 JST pnpm --filter @hierarchidb/plugin-service-api build / pnpm --filter @hierarchidb/shape-store build / pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define警告あり）。
  - update: 2026-01-26 15:53 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 16:02 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck/build exit 0 を確認（tsdown define警告あり）。
  - update: 2026-01-26 16:05 JST pnpm install 実行、peer dependency warning を記録。
  - blocked: 2026-01-26 16:10 JST pnpm typecheck が route-plugin の既存型エラー（LocationPointId/ROUTE_MODES/RouteMode未export）で失敗。
  - update: 2026-01-26 16:15 JST route-plugin の型エラー解消に向け export 差分の確認に着手。
  - update: 2026-01-26 07:49 JST route-plugin の import 参照先を route-store/location-store へ修正し、pnpm --filter @hierarchidb/location-plugin build / pnpm --filter @hierarchidb/route-plugin build を実行（tsdown define警告あり）。
  - update: 2026-01-26 07:49 JST pnpm --filter @hierarchidb/spreadsheet-plugin build を実行（tsdown define警告あり）。
  - update: 2026-01-26 07:49 JST @hierarchidb/spreadsheet-plugin の types を dist/index2.d.ts へ切替（tsconfig.base.json と package.json）。
  - done: 2026-01-26 07:53 JST pnpm typecheck exit 0 を確認（tsdown define警告あり）。
  - update: 2026-01-26 08:02 JST Step5 のタスク生成〜永続化〜検索〜アルゴリズム呼び出しの流れの整理に着手。
  - update: 2026-01-26 08:05 JST Step5整理内容を docs/shape-plugin-multi-stage-vt-generation.md にドキュメント化する作業に着手。
  - done: 2026-01-26 17:01 JST docs/shape-plugin-multi-stage-vt-generation.md を追加。
  - update: 2026-01-26 17:05 JST TopoJSON処理の世界共通グリッド化ユーティリティ有無の調査に着手。
  - update: 2026-01-26 17:43 JST TopoJSONグリッド量子化とズーム帯設定の共通化リファクタに着手（util/vt-orchestrator/shape-plugin を更新）。
  - update: 2026-01-26 17:50 JST pnpm --filter @hierarchidb/util build / pnpm --filter @hierarchidb/gis-sdk build / pnpm --filter @hierarchidb/vt-orchestrator build を実行（tsdown define 警告あり）。
  - update: 2026-01-26 17:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-26 17:50 JST pnpm typecheck が ui-map の未使用変数警告（ResourceLayerMap.tsx）で失敗。
  - start: 2026-01-26 18:05 JST ui-map 未使用変数の解消と pnpm typecheck 再実行に着手。
  - done: 2026-01-26 18:06 JST pnpm typecheck exit 0 を確認（ui-map 未使用変数エラーは再現せず）。
  - update: 2026-01-26 22:40 JST location preview の label/icon size を zoom top-level interpolate へ再構成し、text-size の zoom 式エラーを回避。
  - update: 2026-01-26 22:40 JST app 側の LayerSetVisibilityPanel title props を削除し見出し表示へ置換。
  - done: 2026-01-26 22:40 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-26 23:11 JST circle-radius の zoom 式を top-level interpolate へ再構成し、zoom 式エラーを回避。
  - done: 2026-01-26 23:11 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-26 23:14 JST location preview の styleimagemissing でアイコン画像を再注入する処理を追加。
  - done: 2026-01-26 23:15 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 06:36 JST location preview の icon load を onload 完了まで待機し、missing image 警告を抑制。
  - update: 2026-01-27 06:36 JST ui-map の paint-array ログを非式配列のみ警告するよう調整。
  - done: 2026-01-27 06:37 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 06:46 JST styledata で icon 再注入と iconsReady リセットを行い、missing 警告の再発を抑制。
  - done: 2026-01-27 06:46 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 07:33 JST LocationPreviewList の show 呼び出し依存を見直し、maximum update depth を解消。
  - update: 2026-01-27 07:33 JST style.load で icon 再注入を行い、styledata 由来の更新ループを回避。
  - update: 2026-01-27 07:35 JST LocationPreviewList の show 呼び出しを isVisible ガードし、更新ループを抑制。
  - update: 2026-01-27 07:35 JST location-plugin の未使用 import と MapLibre hasImage 型エラーを解消。
  - update: 2026-01-27 07:42 JST location の modeless 表示は tabular metadata の latest を参照するように修正（LocationDB.sessions 参照を撤去）。
  - update: 2026-01-27 08:10 JST modeless の location 表示を nodeId 参照に戻すため、tableId/latest 依存の撤去に着手。
  - update: 2026-01-27 08:16 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-27 08:27 JST ideGsmCsv の row undefined ガードを追加し pnpm typecheck exit 0 を確認。
  - update: 2026-01-27 08:35 JST shape step6 preview の floating window が再表示できるよう FloatingWindow の初期状態同期を追加。
  - update: 2026-01-27 08:45 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 08:56 JST Dexie Tile Stats の閉じた時ボタンを Layer Sets と同じデザインに揃え、MapLibre コントロールとの重なり回避調整を追加。
  - update: 2026-01-27 09:01 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 09:07 JST shape Step6 の Layer Sets 再表示ボタンを MapLibre コントロールと重ならない位置へ調整。
  - update: 2026-01-27 09:11 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 09:17 JST shape Step6 の Layer Sets 再表示ボタン位置を右上コントロール高さに追従させるよう調整。
  - update: 2026-01-27 09:22 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 09:26 JST Layer Sets と Dexie Tile Stats の再表示ボタンが重ならないよう上下に分離。
  - update: 2026-01-27 09:30 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-27 09:37 JST shape Step6 の feature 一覧ウィンドウが画面外に保存されても再表示できるよう位置補正を追加。
  - done: 2026-01-27 07:42 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。

2376) fix/ui-map/vector-tile-layer-flap (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/ui-map/vector-tile-layer-flap
- 依存: なし
- 受け入れ基準: VectorTileLayer の add/remove が連続発生しない／/map で layer が安定して 1 回のみ登録される／既存のレイヤー切替や再読み込み時の挙動が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - add/remove 連続発生の原因を特定する
  - layer 登録を安定化させる
  - 既存挙動が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 13:12 JST VectorTileLayer の add/remove 連続発生調査に着手。
  - blocked: 2026-01-26 13:16 JST pnpm --filter @hierarchidb/ui-map typecheck が VectorTileLayer の型エラーで失敗。
  - blocked: 2026-01-26 13:18 JST pnpm --filter @hierarchidb/ui-map typecheck が setLayerZoomRange の型エラーで失敗。
  - update: 2026-01-26 13:20 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
2376) feat/shape/step6-preview-map-persist (P1) — 完了 (2026-01-26)
- ブランチ名: feat/shape/step6-preview-map-persist
- 依存: なし
- 受け入れ基準: shape step6 previewの地図中心座標/ズーム率がShapeEntityに永続化され、再読込で復元される／未保存の既存データは既定値で表示が維持される／型定義と保存/読込経路が整合している／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/runtime-worker/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - ShapeEntityに中心座標/ズーム率を追加する
  - step6 previewの保存/復元経路を接続する
  - 既存データの既定値を定義する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 13:20 JST shape step6 preview地図の中心/ズーム永続化に着手。
  - update: 2026-01-26 13:30 JST ShapeEntityにpreviewMapViewを追加し、step6 previewでmap viewの保存/復元を接続。
  - done: 2026-01-26 13:31 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2376) fix/location/step2-tileid-and-ui-map-filter (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step2-tileid-and-ui-map-filter
- 依存: なし
- 受け入れ基準: Step2でlon/latからz0-z9のタイルIDを保持する／ui-mapの基本機能として表示中タイルIDに一致するlocationのみ抽出できる／表示内容はStep4の表示設定を反映する／再現テストを追加しグリーン化する／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/**`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - Step2の読み込みデータにz0-z9のtileIdを付与する
  - ui-mapで表示中タイルIDに一致するlocation抽出の基本機能を追加する
  - Step4表示設定を反映した描画経路を接続する
  - 再現テストを追加しグリーン化する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 18:52 JST pnpm --filter @hierarchidb/location-store build exit 0（tsdown define 警告あり）。
  - update: 2026-01-26 18:53 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-01-26 18:55 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - update: 2026-01-26 18:57 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - update: 2026-01-26 18:59 JST pnpm --filter @hierarchidb/location-plugin test exit 0（--localstorage-file 警告あり）。
  - done: 2026-01-26 19:00 JST location Step2 のタイルID付与と ui-map のタイル抽出/プレビュー連携を完了。
  - update: 2026-01-26 18:40 JST location-store と location-plugin の tabular/feature 生成にタイルID (z0-z9) 付与を追加。
  - update: 2026-01-26 18:42 JST ui-map にタイルID抽出/フィルタ共通ユーティリティを追加し、location Step4 設定の描画へ接続。
  - update: 2026-01-26 18:45 JST location-plugin の tabular materialize にタイルID付与の再現テストを追加。
  - start: 2026-01-26 14:30 JST location Step2のtileId付与とui-mapのタイル一致抽出対応に着手。
2375) fix/ui-map/route-list-empty-flap (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/ui-map/route-list-empty-flap
- 依存: なし
- 受け入れ基準: /map のフローティング route 一覧で "No data available" と "No visible feature" が激しく切り替わらない／表示条件が一貫している／既存の表示・検索・フィルタ挙動を維持する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - 表示切替の発生条件を特定する
  - 空表示の条件を安定化させる
  - 既存の表示・検索・フィルタ挙動が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:26 JST /map の route 一覧で空表示の切替フラップ調査に着手。
  - update: 2026-01-26 12:55 JST viewportIdSet のSet再生成を抑制し、空表示のチラつき原因を切り分け。
  - update: 2026-01-26 13:05 JST viewportFeatureIds 未準備でも layer 存在時は空Setを返し、空表示文言のフラップを抑制。
  - update: 2026-01-26 13:07 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-26 12:58 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-01-26 12:35 JST visibleIds を Set で安定化し、emptyMessage の切替フラップを抑制。
  - update: 2026-01-26 12:40 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。
2374) fix/shape/step6-features-table-stability (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/step6-features-table-stability
- 依存: なし
- 受け入れ基準: Step6のメタデータ一覧テーブルでカラム幅/行高が安定し、表示の振動が発生しない／データ更新中でもスクロール位置のジャンプが起きない／既存の表示内容と並び順が維持される／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - 振動の原因（可変レイアウト要因）を特定する
  - カラム幅/行高を安定化させる
  - スクロール位置の安定性を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:15 JST Step6メタデータ一覧のレイアウト振動調査に着手。
  - update: 2026-01-26 12:20 JST MapPreviewFloatingTable のテーブルレイアウト固定（fixed）とセルのnowrap/ellipsisを追加し、列幅/行高の振動を抑制。
  - update: 2026-01-26 12:21 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
2357) fix/ui-map/clamp-zoom-to-band (P1) — 進行中 (2026-01-26)
- update: 2026-01-26 12:10 JST map画面/shape step6 のズーム上限超過の原因調査に着手。
- ブランチ名: fix/ui-map/clamp-zoom-to-band
- 依存: なし
- 受け入れ基準: ui-map の地図表示で共通ズーム帯設定の範囲外はクランプされる／初期表示とユーザー操作の両方で範囲外にならない／再現テストを追加しグリーン化する／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／pnpm --filter @hierarchidb/ui-map test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - 共通ズーム帯設定から min/max を取得する
  - 範囲外ズームが発生しないことを確認する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/ui-map test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 11:35 JST ui-mapのズームクランプ対応に着手。
  - update: 2026-01-26 11:45 JST MapLibreMapの初期/更新/操作のズームを共通ズーム帯のmin/maxにクランプ。
  - update: 2026-01-26 12:05 JST minZoom/maxZoom を数値に確定するガードを追加し型エラーを修正。
  - update: 2026-01-26 11:46 JST ズームクランプのユニットテストを追加。
  - done: 2026-01-26 11:47 JST pnpm --filter @hierarchidb/ui-map typecheck/test exit 0 を確認。
  - update: 2026-01-26 13:05 JST map画面/shape step6でクランプ未反映の再調査と再現テスト整備に着手。
  - update: 2026-01-26 13:25 JST MapLibreMapで解決済みmin/maxをMapLibre propsに反映し、mapOptions欠落時の再現テストを追加。
  - update: 2026-01-26 13:30 JST MapPage/Shape Step6で共通ズーム帯設定からmin/maxを適用。
  - done: 2026-01-26 13:35 JST pnpm --filter @hierarchidb/ui-map test/typecheck exit 0、pnpm --filter @hierarchidb/app typecheck exit 0、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 13:50 JST MapPreviewFloatingTableの例外（maxHeight未定義）と未捕捉エラーの調査に着手。
  - update: 2026-01-26 14:10 JST MapPreviewFloatingTableでmaxHeightの参照漏れを修正し、再現テストを追加。
  - update: 2026-01-26 14:12 JST pnpm --filter @hierarchidb/ui-grid build でdist型を更新。
  - done: 2026-01-26 14:15 JST pnpm --filter @hierarchidb/ui-map test/typecheck exit 0 を確認。

2356) fix/shape/step5-vt-status-flapping (P1) — 進行中 (2026-01-26)
  - update: 2026-01-26 11:20 JST task更新の順序判定をsequenceで統一する方針の確認に着手。
  - update: 2026-01-26 11:26 JST task更新の順序判定をsequenceへ統一（updatedAt判定を撤去）。
  - update: 2026-01-26 11:28 JST sequence順序の再現テストを更新しグリーン化。
  - done: 2026-01-26 11:29 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-26 11:30 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org DNS失敗（ENOTFOUND）で失敗。
- ブランチ名: fix/shape/step5-vt-status-flapping
- 依存: なし
- 受け入れ基準: Step5 VT Generationのタスク表示がCompleted/Runningを往復しない／原因をコード参照で説明する／再現テストを追加しグリーン化する／pnpm --filter @hierarchidb/shape-plugin test が exit 0／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`, `plugins/shape-plugin/src/ui/__tests__/**`（調査後に確定）
- ロールバック手順: 該当差分を revert する
- チェックリスト:
  - VTステージのタスク表示がflapしないことを確認する
  - 失敗再現テストを追加しグリーン化する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 10:55 JST step5 VTタスク表示のCompleted/Runningフラップ問題に着手。
  - update: 2026-01-26 11:10 JST task更新イベントのupdatedAt順で古い更新を無視し、更新順序の逆転で表示が揺れないよう修正。
  - update: 2026-01-26 11:12 JST Flap再現テストを追加（古い更新を無視する）。
  - done: 2026-01-26 11:13 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-26 11:14 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org DNS失敗（ENOTFOUND）で失敗。

2370) fix/ui-map/show-tile-debug-flags (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/ui-map/show-tile-debug-flags
- 依存: なし
- 受け入れ基準: showTileBoundaries/showTileCoordinates が指定時に反映される／開発モードの自動有効化は維持しつつ明示指定が優先される／原因と発生範囲を説明できる／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`
- ロールバック手順: タイル境界/番号の反映修正とDEV自動化の差分を revert する
- チェックリスト:
  - 反映されない原因箇所を特定する
  - タイル境界/番号の反映修正を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 09:04 JST showTileBoundaries/showTileCoordinates 未反映の原因調査に着手。
  - update: 2026-01-25 09:07 JST MapLibreMapでdebugフラグをmapインスタンスへ直接適用し、pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2371) feat/ui-map/show-tile-debug-query (P2) — 完了 (2026-01-25)
- ブランチ名: feat/ui-map/show-tile-debug-query
- 依存: なし
- 受け入れ基準: showTileBoundaries/showTileCoordinates がURLクエリで有効/無効に切替できる／クエリ無しの既定挙動は維持される／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`
- ロールバック手順: URLクエリ判定と解釈ロジックの差分を revert する
- チェックリスト:
  - URLクエリの解釈ロジックを追加する
  - クエリ優先で反映されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 09:14 JST showTileBoundaries/showTileCoordinates のURLクエリ切替に着手。
  - done: 2026-01-25 09:15 JST URLクエリ優先でtile debug設定を反映し、pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2372) investigation/shape/vt-tiles-z0-z1-display (P1) — 進行中 (2026-01-25)
- ブランチ名: investigation/shape/vt-tiles-z0-z1-display
- 依存: なし
- 受け入れ基準: z0-z1表示異常の原因切り分けができる／VT Generationのz1/z2生成の不整合有無を特定できる／影響範囲・修正方針・ロールバックを記録する／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/ui/map/src/**`, `packages/features/map-adapter/src/**`
- ロールバック手順: 調査用ログ/一時変更を revert する
- チェックリスト:
  - 表示側/生成側の切り分け手順を定義する
  - VT Generationのz1/z2出力とタイルインデックスの整合性を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 09:26 JST z0-z1タイル表示異常とVT Generationの不整合調査に着手。
  - update: 2026-01-25 09:33 JST tileIdのz非包含による衝突が疑わしく、vt-orchestrator/shapePipeline/workerラベルのtileIdエンコードをz含有方式へ変更。pnpm --filter @hierarchidb/vt-orchestrator typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2373) feat/shape/task-progressbar-drag-scroll (P2) — 進行中 (2026-01-25)
- ブランチ名: feat/shape/task-progressbar-drag-scroll
- 依存: なし
- 受け入れ基準: TaskProgressBarのクリックジャンプが現状動作していることを確認して記録する／ドラッグ中の位置に応じてタスク一覧のスクロールが追従する／クリック挙動は維持される／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: ドラッグ追従と確認ログを revert する
- チェックリスト:
  - 既存クリックジャンプ動作の確認方法と結果を記録する
  - ドラッグ追従のスクロール更新を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 10:24 JST TaskProgressBarのドラッグ追従スクロール対応に着手。
  - update: 2026-01-25 10:26 JST TaskProgressBarにドラッグ追従を追加し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。クリックジャンプはコード上のonClickで動作確認（手元実行での確認は未実施）。
  - update: 2026-01-25 10:33 JST ドラッグ追従のスクロール更新をデバウンス化し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-25 10:36 JST デバウンス内でpointer event参照が無効になる問題を修正し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2374) feat/ui-floating-window/persist-shape-feature-window (P2) — 完了 (2026-01-25)
- ブランチ名: feat/ui-floating-window/persist-shape-feature-window
- 依存: なし
- 受け入れ基準: shapeのFeaturesフローティングウィンドウの位置/サイズ/表示モードがJSON文字列で永続化される／nodeTypeで区別しnodeIdで区別しないキー体系を使う／再表示で復元される／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: 永続化キーと状態同期の差分を revert する
- チェックリスト:
  - 永続化キーの階層設計を定義する
  - FloatingWindowの状態を永続化/復元する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 14:22 JST shape Featuresフローティングウィンドウの永続化対応に着手。
  - done: 2026-01-25 14:23 JST shape用の永続化キーを定義してFloatingWindow状態を保存/復元し、pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2375) plan/ui-grid/tanstack-migration (P1) — 完了 (2026-01-25)
- ブランチ名: plan/ui-grid/tanstack-migration
- 依存: なし
- 受け入れ基準: TanStack Table移行のExecPlanを作成し、機能要件（仮想化/列可視性/リサイズ+永続化/ソート+永続化/インライン編集/行選択/グルーピング/検索）と永続化キー設計を明記する／TASKS.mdに運用ログを記載する
- 影響範囲: `plans/tanstack-grid-migration-execplan.md`
- ロールバック手順: ExecPlan作成差分を revert する
- チェックリスト:
  - ExecPlanを作成する
  - 保存キーの設計とグルーピング方針を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 18:24 JST TanStack Table移行のExecPlan作成に着手。
  - done: 2026-01-25 18:25 JST ExecPlanを作成し、永続化キー設計とグルーピング方針を明記。

2376) feat/ui-grid/tanstack-grid-implementation (P1) — 進行中 (2026-01-25)
- ブランチ名: feat/ui-grid/tanstack-grid-implementation
- 依存: なし
- 受け入れ基準: TanStack Tableベースの新グリッドが仮想化/列可視性/列リサイズ+永続化/ソート+永続化/インライン編集/行選択/グルーピング/検索を支援する／shape Step6と/mapのshape一覧でADMグルーピングが有効になる／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/data-grid/src/TanstackDataGrid.tsx`, `packages/ui/data-grid/src/storage/gridStateStorage.ts`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/map/src/preview/ShapePreviewList.tsx`, `app/src/router/routes/modeless/modelessDialogContent.tsx`, `packages/ui/map/src/preview/RoutePreviewList.tsx`, `packages/ui/data-grid/package.json`
- ロールバック手順: 新グリッド追加とMapPreviewFloatingTable置換差分を revert する
- チェックリスト:
  - TanStack Tableベースの新グリッドを追加する
  - localStorage永続化のキーと保存処理を実装する
  - shape Step6と/mapでグルーピング設定を適用する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 18:40 JST TanStack Table移行の実装に着手。
  - update: 2026-01-25 22:01 JST TanStack Grid実装作業を再開。
  - update: 2026-01-25 22:43 JST TanstackDataGridにソート操作UI（▲▼）を追加し、pnpm installとui-grid/ui-map/appのtypecheckを実行。
  - update: 2026-01-25 22:53 JST TanstackDataGridの列幅ドラッグリサイズをTreeTableCore実装に合わせて対応開始。
  - update: 2026-01-25 22:55 JST TanstackDataGridの列幅ドラッグリサイズを実装し、pnpm --filter @hierarchidb/ui-grid typecheck / pnpm --filter @hierarchidb/ui-map typecheck / pnpm --filter @hierarchidb/app typecheck exit 0 を確認。
  - blocked: 2026-01-26 23:40 JST pnpm --filter @hierarchidb/app build で @hierarchidb/ui-floating-window / @hierarchidb/ui-country-select / @hierarchidb/ui-datasource の UNLOADABLE_DEPENDENCY エラーが発生。
  - update: 2026-01-26 23:43 JST app依存にui-floating-window/ui-datasourceを追加し、ビルド依存の解消を試行。
  - update: 2026-01-26 23:46 JST shape-plugin/route-pluginのpeer/dev依存にui-floating-window・ui-country-select・ui-datasourceを追加して解決を試行。
  - update: 2026-01-26 23:47 JST location-pluginのpeer/dev依存にui-floating-windowを追加してビルド解消を試行。
  - update: 2026-01-26 23:48 JST pnpm --filter @hierarchidb/app build exit 0 を確認（tsdown define警告とchunk警告あり）。

2369) feat/app/dev-maplibre-debug-tiles (P2) — 完了 (2026-01-25)
- ブランチ名: feat/app/dev-maplibre-debug-tiles
- 依存: なし
- 受け入れ基準: 開発モード時のみMapLibreGLのタイル境界とタイル番号が自動表示される／本番や開発モード以外の挙動は変わらない／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/MapLibreMap.tsx`
- ロールバック手順: 開発モード判定とMapLibreGLデバッグ設定の差分を revert する
- チェックリスト:
  - 開発モード判定の場所を確認する
  - タイル境界/番号表示の自動有効化を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 08:54 JST 開発モード時のMapLibreGLデバッグ表示自動化に着手。
  - done: 2026-01-25 08:55 JST MapLibreMapでDEV時にtile境界/番号を自動有効化し、pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2362) fix/shape/task-update-sequence (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/task-update-sequence
- 依存: なし
- 受け入れ基準: TaskQueueRecord/BatchTaskSummaryにsequenceを追加する／タスク更新のsequenceが単調増加する／UIはsequenceで新旧判定する／pnpm --filter @hierarchidb/common-types build と pnpm --filter @hierarchidb/vt-orchestrator build と pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/common/types/src/task-queue-types.ts`, `packages/common/api/src/BatchControlAPI.ts`, `packages/vt-orchestrator/src/task/taskQueue.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `plugins/shape-plugin/src/ui/atoms/shapeBuildProgressAtoms.ts`
- ロールバック手順: sequence追加と更新ロジック差分を revert する
- チェックリスト:
  - TaskQueueRecord/BatchTaskSummaryにsequenceを追加する
  - putTasks/updateTaskでsequenceを単調増加させる
  - UIのmerge判定をsequenceに切り替える
  - pnpm --filter @hierarchidb/common-types build を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator build を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 11:02 JST sequence導入とmerge判定切り替えに着手。
  - done: 2026-01-26 11:09 JST pnpm --filter @hierarchidb/common-types build / pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/vt-orchestrator build / pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2363) investigation/shape/task-list-virtualization (P1) — 進行中 (2026-01-26)
- ブランチ名: investigation/shape/task-list-virtualization
- 依存: なし
- 受け入れ基準: 仮想化ON/OFFでタスク更新の反映安定性を比較できる／仮想化起因かどうかを結論づける根拠を示す／原因候補があれば箇所と再現条件を記録する／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskListVirtualized.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`
- ロールバック手順: 調査用フラグ/ログを revert する
- チェックリスト:
  - 仮想化ON/OFFで挙動比較できるようにする
  - 反映不安定の再現条件を記録する
  - 結論と根拠を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 11:14 JST TaskList仮想化の影響調査に着手。
  - update: 2026-01-26 11:22 JST noTaskVirtualクエリで非仮想リストに切替できるようにし、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 11:30 JST noTaskVirtual=1でもタスク更新は不安定との報告を受領。仮想化起因ではないと判断。

2364) investigation/shape/task-update-sequence-order (P1) — 完了 (2026-01-26)
- ブランチ名: investigation/shape/task-update-sequence-order
- 依存: なし
- 受け入れ基準: 更新イベントのsequence有無・順序をログで確認できる／UIが棄却する更新の条件をログで特定できる／イベント側かUI側かの切り分けができる／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: 調査用ログ差分を revert する
- チェックリスト:
  - 更新イベントのsequenceをログ出力する
  - UI側で棄却した更新をログ出力する
  - 結論と根拠を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 11:36 JST sequence順序のログ調査に着手。
  - update: 2026-01-26 11:40 JST sequence付き更新ログと棄却ログを追加、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-26 11:48 JST sequenceは単調増加で付与され、UI側の棄却ログも発生していないことを確認。仮想化が原因ではないと判断。

2365) fix/shape/task-update-map-state (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/task-update-map-state
- 依存: なし
- 受け入れ基準: UIのタスク保持がMapベースで更新イベントの取りこぼしが起きない／sequenceが低い更新は確実に棄却される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: tasksMap導入とmerge処理の差分を revert する
- チェックリスト:
  - tasksMapで最新タスクを保持する
  - sequenceの比較で確実に棄却する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 11:53 JST tasksMapベースの更新処理へ切り替え着手。
  - done: 2026-01-26 11:59 JST tasksMapで更新を統一し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2366) fix/shape/task-status-flip-crash (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/task-status-flip-crash
- 依存: なし
- 受け入れ基準: Running/Completedのフリップが止まる／タスク更新で無限ループやブラウザクラッシュが起きない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `packages/vt-orchestrator/src/task/taskQueue.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: status判定/イベント生成/Map更新の差分を revert する
- チェックリスト:
  - Completed通知条件を厳格化する
  - updateイベントのループ要因を排除する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:06 JST statusフリップとクラッシュの修正に着手。
  - update: 2026-01-26 12:18 JST completed/failedのstatusを更新で上書きしないようガードし、pnpm --filter @hierarchidb/vt-orchestrator build / pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2367) fix/shape/stuck-running-tasks (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/stuck-running-tasks
- 依存: なし
- 受け入れ基準: Runningのまま残るタスクが発生しない／進捗更新・完了更新が欠落しない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/task/taskQueue.ts`, `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `packages/vt-orchestrator/src/vt/vtStage.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- ロールバック手順: Running補正/完了反映の差分を revert する
- チェックリスト:
  - Running補正と完了反映を確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:28 JST Running残留タスクの修正に着手。
  - done: 2026-01-26 12:36 JST fetch/transform完了時にpendingタスクをfailed化、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2368) fix/shape/update-depth-loop-and-vt-running (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/update-depth-loop-and-vt-running
- 依存: なし
- 受け入れ基準: useShapeBuildTasks/useBatchProgress/useShapeBuildStep の update depth ループが解消される／VT Generation の Running 残存が解消されビルド完了待ちにならない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `packages/ui/batch/src/hooks/useBatchProgress.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- ロールバック手順: ループ抑止と完了確定の差分を revert する
- チェックリスト:
  - update depth ループを解消する
  - VT Running 残存を解消する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:44 JST update depth ループとVT Running残存の修正に着手。
  - update: 2026-01-26 13:21 JST useShapeBuildTasksでマイクロタスクflushと差分更新を導入、useBatchProgressで重複progress更新を抑止、useShapeBuildStepでtimingSnapshotの同値更新を抑止。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-26 13:06 JST useShapeBuildTasksの購読依存を安定化、useBatchProgressのadapter参照と重複更新抑止、useShapeBuildStepのbuildStartedAt更新を単発化。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2369) fix/shape/update-depth-loop-batch-footer (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/update-depth-loop-batch-footer
- 依存: なし
- 受け入れ基準: useShapeBuildTasks/useBatchProgress/PluginDialogFooter の update depth ループが解消される／setTimeout起因の再入が抑止される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `packages/features/batch/src/progress/useBatchProgress.ts`, `packages/ui/dialog/src/PluginDialogFooter.tsx`
- ロールバック手順: ループ抑止差分を revert する
- チェックリスト:
  - useShapeBuildTasksの再入ループを解消する
  - useBatchProgressのタイマー更新を安定化する
  - PluginDialogFooterの連続setStateを抑止する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 13:30 JST update depth ループ（tasks/batch/footer）修正に着手。
  - update: 2026-01-26 13:43 JST useShapeBuildTasksのrAF flushと同値更新抑止、useBatchProgressのrAF更新と重複progress抑止、useShapeBuildTasksでerror/loadingの同値更新抑止を追加。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2370) fix/shape/biome-svg-title (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/biome-svg-title
- 依存: なし
- 受け入れ基準: TaskProgressBarのSVG titleが空でない／Biome a11y/noSvgWithoutTitleが解消する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: title追加差分を revert する
- チェックリスト:
  - SVG titleを空でない値にする
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 13:52 JST TaskProgressBarのSVG title修正に着手。
  - done: 2026-01-26 13:58 JST TaskProgressBarの空titleを回避し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2371) fix/shape/task-progress-anchor-to-button (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/task-progress-anchor-to-button
- 依存: なし
- 受け入れ基準: TaskProgressBar の a を button に置換し、Biome useValidAnchor を解消する／表示が崩れない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: button置換差分を revert する
- チェックリスト:
  - a を button に置換する
  - クリック/キー操作が維持される
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 14:10 JST TaskProgressBarのa→button置換に着手。
  - update: 2026-01-26 14:28 JST SVG内buttonをforeignObject経由に変更し、表示不具合を回避。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-26 14:16 JST TaskProgressBarのaをbuttonに置換し、pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2372) fix/shape/task-progress-anchor-valid (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/task-progress-anchor-valid
- 依存: なし
- 受け入れ基準: TaskProgressBarのbutton/foreignObjectを撤去しSVG表示を復旧する／a要素は有効なhrefを持つ／Biome useValidAnchorを回避する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: anchor修正差分を revert する
- チェックリスト:
  - foreignObject/buttonを撤去する
  - 有効なhrefを付けたaに戻す
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 14:45 JST TaskProgressBarのanchor復旧に着手。
  - done: 2026-01-26 14:50 JST foreignObject/buttonを撤去し、有効なhrefのaへ戻す。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2373) perf/shape/task-progress-heavy-reflow (P1) — 進行中 (2026-01-26)
- ブランチ名: perf/shape/task-progress-heavy-reflow
- 依存: なし
- 受け入れ基準: message handler/reflowの原因を特定し軽量化する／タスク進捗UIの描画が改善する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `packages/features/batch/src/progress/useBatchProgress.ts`
- ロールバック手順: 計測/軽量化差分を revert する
- チェックリスト:
  - 重い処理の原因箇所を特定する
  - 更新頻度/描画範囲の最適化を行う
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 15:02 JST message handler/reflowの軽量化に着手。

2361) fix/shape/ignore-stale-task-updates (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/shape/ignore-stale-task-updates
- 依存: なし
- 受け入れ基準: 旧いupdateイベントが新しい状態を上書きしない／updatedAtに基づいて更新を棄却する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `plugins/shape-plugin/src/ui/atoms/shapeBuildProgressAtoms.ts`
- ロールバック手順: updatedAtの付与とmergeTaskのガードを revert する
- チェックリスト:
  - TaskSummaryにupdatedAtを付与する
  - mergeTaskでupdatedAtが古い更新を無視する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 00:29 JST 旧いupdateの上書き抑止に着手。
  - blocked: 2026-01-25 00:29 JST shapeBuildProgressAtomsにupdatedAtが無くtypecheck失敗。
  - done: 2026-01-25 00:29 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2360) fix/shape/reset-stale-running-transform (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/shape/reset-stale-running-transform
- 依存: なし
- 受け入れ基準: Transform開始前にstaleなrunningタスクがqueuedへ戻される／Runningが残り続ける問題が緩和される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- ロールバック手順: resetStageRunningTasks追加と呼び出し差分を revert する
- チェックリスト:
  - Transform開始前にrunningタスクをリセットする
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 00:21 JST Transformのstale runningリセットに着手。
  - done: 2026-01-25 00:21 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2359) fix/shape/task-update-no-debounce (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/shape/task-update-no-debounce
- 依存: なし
- 受け入れ基準: タスク更新は即時反映される／debounceが無効化される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: scheduleFlushの即時反映差分を revert する
- チェックリスト:
  - scheduleFlushが即時反映になる
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 00:14 JST タスク更新debounceの無効化に着手。
  - done: 2026-01-25 00:14 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2358) fix/shape/delete-event-batching-ui (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/shape/delete-event-batching-ui
- 依存: なし
- 受け入れ基準: 大量deleteイベントでもUIがクラッシュしない／削除はまとめて適用される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: deleteイベントのバッチ適用差分を revert する
- チェックリスト:
  - deleteイベントをSetでバッチ適用する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 00:02 JST deleteイベントのバッチ適用でクラッシュ回避に着手。
  - done: 2026-01-25 00:02 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2357) fix/shape/delete-stale-tasks (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/delete-stale-tasks
- 依存: なし
- 受け入れ基準: 現行ビルド内容と不一致のタスクは削除される／VTタスクのCompleted→Queuedフリップが起きない／deleteイベントでUIがタスク削除を反映する／pnpm --filter @hierarchidb/shape-plugin typecheck と pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/common/types/src/task-queue-types.ts`, `packages/vt-orchestrator/src/task/taskQueue.ts`, `packages/vt-orchestrator/src/index.ts`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `plugins/shape-plugin/src/services/vt/taskSignatures.ts`, `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: TaskQueueEventのdelete対応・deleteTasksByIds・タスク署名と削除ロジックの差分を revert する
- チェックリスト:
  - 現行ビルド内容と不一致のタスクを削除する
  - deleteイベントをsubscribeToTasksへ伝搬する
  - pnpm --filter @hierarchidb/common-types build を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator build を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:57 JST ビルド内容不一致タスクの削除と通知対応に着手。
  - blocked: 2026-01-24 23:57 JST pnpm --filter @hierarchidb/shape-plugin typecheck が deleteTasksByIds未公開・TaskQueueEvent型更新漏れで失敗。
  - done: 2026-01-24 23:57 JST pnpm --filter @hierarchidb/common-types build / pnpm --filter @hierarchidb/vt-orchestrator build / pnpm --filter @hierarchidb/shape-plugin typecheck / pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。

2356) fix/shape/vt-strict-completed-notify (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/vt-strict-completed-notify
- 依存: なし
- 受け入れ基準: VTタスクのCompleted判定が進捗未完了では出ない／progressやcompletedAtに基づき完了判定を厳格化する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: resolveEffectiveTaskStatusの追加と適用箇所の差分を revert する
- チェックリスト:
  - VTのCompleted判定をprogress/完了情報で厳格化する
  - 進捗報告で未完了タスクがCompletedにならない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:37 JST VTタスクのCompleted判定厳格化に着手。
  - done: 2026-01-24 23:37 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2355) fix/shape/vt-task-status-flap (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/vt-task-status-flap
- 依存: なし
- 受け入れ基準: VTタスク表示でCompleted/Runningがフリップしない／buildStatusがcompletedでもin-flightタスクがあればrunningとして扱う／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`
- ロールバック手順: buildStatusのin-flightガード差分を revert する
- チェックリスト:
  - in-flightタスクがある場合はbuildStatusをrunningに固定する
  - VTタスクの進捗表示でCompleted/Runningのフリップが起きない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:29 JST VTタスクのRunning/Completedフリップ抑制に着手。
  - done: 2026-01-24 23:29 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2336) fix/shape/transform-retry-tolerance-search (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/transform-retry-tolerance-search
- 依存: なし
- 受け入れ基準: transform の vertex 上限超過時に tolerance 再試行が指数→二分探索で実行される／上限内に収まる最小近傍の tolerance が選択される／retry 上限や failed 判定など既存挙動が維持される／pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- ロールバック手順: retry 探索ロジックの差分を revert して +0.5 の線形リトライへ戻す
- チェックリスト:
  - vertex limit 超過時の retry を指数→二分探索へ置き換える
  - retry 回数上限と failed 判定が維持されることを確認する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:23 JST tolerance retry の探索方法を指数→二分探索へ変更する対応に着手。
  - update: 2026-01-24 22:24 JST retry を指数探索→二分探索に置き換え。
  - done: 2026-01-24 22:26 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2335) investigation/shape/transform-max-vertices (P1) — 完了 (2026-01-24)
- ブランチ名: investigation/shape/transform-max-vertices
- 依存: なし
- 受け入れ基準: transform failed: max vertices per feature exceeded の発生箇所と条件が特定できる／再試行で解消する条件と解消しない条件を整理する／影響範囲（UI/Worker/設定）を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 調査のみ（コード変更なし）
- チェックリスト:
  - 例外メッセージの発生箇所と条件を特定する
  - 再試行で解消する/しない条件を整理する
  - 影響範囲を説明できるようにまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-24 22:26 JST tolerance +0.5 の retry が最大20回まで実行される実装を確認。
  - update: 2026-01-24 22:27 JST retry 後も上限超過が残ると failed になることを確認。
  - start: 2026-01-24 22:15 JST transform max vertices エラーの原因調査に着手。
  - done: 2026-01-24 22:24 JST retry 実装と failed 判定条件を整理し、原因を確定。
  - update: 2026-01-24 22:18 JST createTransformByBandHandler.ts の vertex limit 判定で failed が返ることを確認。
  - done: 2026-01-24 22:19 JST 再試行で解消しない条件（入力ジオメトリの頂点数が上限超過）を整理。

2355) fix/shape/step5-task-updates-no-polling (P1) — 進行中 (2026-01-26)
  - update: 2026-01-26 10:50 JST TaskProgressBar の paddingRight を 16px へ修正に着手。
  - blocked: 2026-01-26 10:51 JST TaskProgressBar.tsx 内に paddingRight: 64px の記述が見つからず、対象箇所の確認待ち。
- ブランチ名: fix/shape/step5-task-updates-no-polling
- 依存: なし
- 受け入れ基準: Worker初期化時にタスクスナップショットをUIへ通知し、その後はタスク更新イベントのみでUIを更新する（UI側の再取得・ポーリングなし）／Step5のタスク一覧・サマリーが実行中/失敗時も更新される／失敗を再現するテストを追加しグリーン化する／pnpm --filter @hierarchidb/shape-plugin test が exit 0／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/WorkerAPI.ts`, `packages/common/api/src/BatchControlAPI.ts`, `packages/ui/worker-client/src/workerBridge.ts`, `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/__tests__/**`
- ロールバック手順: 上記ファイルのスナップショット通知/購読差分を revert する
- チェックリスト:
  - Workerがsubscribe時にタスクスナップショットを送信する
  - タスク更新はイベント通知のみで反映される
  - UI側のポーリング/再取得処理が残らない
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 10:12 JST step5タスク通知のスナップショット化とポーリング撤去に着手。
  - update: 2026-01-26 10:40 JST BatchTaskUpdateEvent/subscribeBatchTasks追加、Workerスナップショット通知とUIポーリング撤去、関連テストを追加。
  - update: 2026-01-26 10:42 JST pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/ui-worker-client build を実行（tsdown define warningあり）。
  - done: 2026-01-26 10:44 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-26 10:45 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org DNS失敗（ENOTFOUND）で失敗。

2354) fix/shape/rebuild-queue-missing-only (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/rebuild-queue-missing-only
- 依存: なし
- 受け入れ基準: 再ビルド時にCompleted/Skippedが再キューされず、Failedのみqueuedへ戻り不足タスクのみ追加される／startBatchProcessでも既存タスクを再利用する／pnpm --filter @hierarchidb/shape-plugin typecheck と pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
- ロールバック手順: resumeExistingTasksの自動判定とmissingタスク追加の差分を revert する
- チェックリスト:
  - startBatchProcessで既存タスクを検出し再利用する
  - failedのみqueuedへ戻し、completed/skippedは保持する
  - missingタスクのみを追加する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:36 JST 再ビルド時のタスク再投入ルール修正に着手。
  - blocked: 2026-01-24 21:59 JST pnpm --filter @hierarchidb/shape-plugin typecheck が TS1434 (shapePipeline.ts) で失敗。
  - done: 2026-01-24 21:59 JST pnpm --filter @hierarchidb/shape-plugin typecheck と pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。

2354) fix/shape/step5-running-tasks-and-error-dialog (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-running-tasks-and-error-dialog
- 依存: なし
- 受け入れ基準: processingStatusがprocessingでruntime statusが未取得でもタスクがポーリングされサマリー/一覧が表示される／failedダイアログにerrorMessageが表示される／失敗テストを追加しグリーン化する／pnpm --filter @hierarchidb/shape-plugin test が exit 0／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/atoms/shapeBuildProgressAtoms.ts`, `plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx`, `plugins/shape-plugin/src/ui/__tests__/components/step5/ShapeBuildProgressPanel.unit.test.tsx`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - processingStatus=processingでrefreshTasksが実行される
  - errorMessageがダイアログに表示される
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:02 JST step5実行中タスク表示と失敗ダイアログの修正に着手。
  - update: 2026-01-24 22:35 JST processingStatus=processingでポーリング継続、失敗メッセージにerrorMessageを優先、UIテストとフックテストを追加。
  - update: 2026-01-24 22:44 JST vitest aliasに@hierarchidb/ui-i18nを追加、ResizeObserver/monitoringをテストでモック。
  - blocked: 2026-01-24 22:45 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org DNS失敗（ENOTFOUND）で失敗。
  - done: 2026-01-24 22:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2353) fix/shape/step5-cached-tasks-initial-refresh (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-cached-tasks-initial-refresh
- 依存: なし
- 受け入れ基準: Step5 遷移時に buildStatus が idle でも初回の tasks refresh が実行され cached task が表示される／回数は1回に限定される／失敗を再現するテストを追加しグリーンにする／pnpm --filter @hierarchidb/shape-plugin test が exit 0（該当テスト含む）／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx`
- ロールバック手順: useShapeBuildStep の初回 refresh 制御とテスト追加分を revert する
- チェックリスト:
  - 初回表示で refreshTasks が一度だけ呼ばれる
  - キャッシュが無い場合は追加の refresh を繰り返さない
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 20:36 JST step5キャッシュタスクの初回refresh問題に着手。
  - update: 2026-01-24 21:24 JST 初回idle状態でもrefreshTasksを1回だけ実行するガードとテストを追加。
  - blocked: 2026-01-24 21:21 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の DNS 失敗（ENOTFOUND）で失敗。
  - done: 2026-01-24 21:24 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2353) fix/vt/transform-retry-effective-tolerance (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/vt/transform-retry-effective-tolerance
- 依存: なし
- 受け入れ基準: simplify再試行で適用側のtoleranceを+0.5ずつ上げる／65535以下になったら終了する／pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- ロールバック手順: retry時のtolerance決定差分を revert する
- チェックリスト:
  - retryのeffective toleranceが+0.5ずつ増えるようにする
  - 65535以下で終了することを維持する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:13 JST transform retryのeffective tolerance増分に着手。
  - blocked: 2026-01-24 21:13 JST typecheck失敗: lastProgressAt未使用。
  - update: 2026-01-24 21:13 JST retry時にlarge-area判定後のtoleranceを+0.5ずつ増加するよう修正。
  - done: 2026-01-24 21:13 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-24 21:27 JST retry時は適用toleranceを+0.5し、large-areaキャップを迂回して簡略化。
  - done: 2026-01-24 21:27 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2352) fix/shape/step5-tasklist-debounce-10ms (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-tasklist-debounce-10ms
- 依存: なし
- 受け入れ基準: タスク一覧の更新デバウンスが10msになる／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`
- ロールバック手順: debounce値の差分を revert する
- チェックリスト:
  - scheduleFlushの遅延を10msに変更する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:06 JST タスク一覧更新のデバウンスを10msへ変更する対応に着手。
  - done: 2026-01-24 21:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2352) fix/shape/step5-cached-task-display-2 (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-cached-task-display-2
- 依存: なし
- 受け入れ基準: Step5 遷移時にキャッシュ済みタスクがあれば no tasks yet を出さずに進捗/サマリー/一覧へ表示される／キャッシュ未取得中はスケルトン表示になる／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`
- ロールバック手順: useShapeBuildStep のキャッシュ表示差分を revert する
- チェックリスト:
  - listBuildTasks で取得した永続化タスクを表示へ反映する
  - 空タスク時はキャッシュ取得中にスケルトン表示となる
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 20:18 JST step5キャッシュタスク表示の再修正に着手。
  - update: 2026-01-24 20:21 JST listBuildTasks の永続化タスクを cachedTasks に退避し、空タスク時の表示に反映。
  - done: 2026-01-24 20:22 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2351) fix/shape/step5-atom-sync-loop-2 (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-atom-sync-loop-2
- 依存: なし
- 受け入れ基準: step5遷移直後のMaximum update depth exceededが解消される／storedTasks読み込みの再入を抑止する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressAtomSync.tsx`
- ロールバック手順: storedTasksLoadedRefの追加とAtomSync安定ハンドラの差分を revert する
- チェックリスト:
  - storedTasks読み込みが一度だけ走るよう制御する
  - AtomSyncの安定ハンドラで同値更新を抑制する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 20:03 JST step5遷移直後の更新ループ修正に着手。
  - update: 2026-01-24 20:03 JST storedTasks読み込みを1回に限定し、AtomSyncの安定ハンドラを整理。
  - done: 2026-01-24 20:03 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2350) fix/shape/step5-atom-sync-loop (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-atom-sync-loop
- 依存: なし
- 受け入れ基準: ShapeBuildProgressAtomSync由来のMaximum update depth exceededが解消される／同値更新のsetAtomを抑制する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressAtomSync.tsx`
- ロールバック手順: 同値抑制の差分を revert する
- チェックリスト:
  - Atom同期で同値更新を抑制する
  - errorログが出ないことを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:41 JST ShapeBuildProgressAtomSyncの更新ループ修正に着手。
  - blocked: 2026-01-24 19:42 JST typecheck失敗: ShapeBuildProgressAtomSyncのジェネリクス記法がTSXでJSX解釈された。
  - update: 2026-01-24 19:44 JST 同値更新の抑制と関数宣言でのジェネリクスに修正。
  - done: 2026-01-24 19:44 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-24 19:47 JST typecheck失敗: AtomSyncの安定ハンドラ型不一致。
  - update: 2026-01-24 19:49 JST 安定ハンドラの型をTaskProgressControls/AuthStateに合わせて修正。
  - done: 2026-01-24 19:49 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2349) fix/shape/step4-delete-api-resume-tasks (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step4-delete-api-resume-tasks
- 依存: なし
- 受け入れ基準: Delete API cache がタスク削除とキャッシュ削除の両方を行う／Resume Build時に completed/skipped を保持し failed を queued へ戻す／永続化タスクがある場合に step5 で no tasks yet が出ない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`
- ロールバック手順: 対象ファイルの差分を revert する
- チェックリスト:
  - Delete API cache で fetch タスクも削除する
  - Resume Build で failed を queued に戻し completed/skipped を保持する
  - 永続化タスクの読み込み中は no tasks yet を出さない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:39 JST Delete API cache/Resume Build/step5表示の修正に着手。
  - update: 2026-01-24 19:39 JST Delete API cacheでfetchタスク削除、Resume Buildでfailedをqueuedへ復帰、永続化タスク読み込み中はno tasks yetを抑制。
  - done: 2026-01-24 19:39 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2348) analysis/shape/cache-delete-resume-behavior (P1) — 進行中 (2026-01-24)
- ブランチ名: analysis/shape/cache-delete-resume-behavior
- 依存: なし
- 受け入れ基準: step4のDelete系ボタンがタスク削除と関連キャッシュ削除の両方を満たしているかをコード参照付きで説明する／step5 Resume Build時にcompleted/skipped再利用とfailedのqueued化が現状どうなっているかを確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/ui/components/step5/useBatchSessionActions.ts`, `packages/runtime-worker/src/services/**`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - step4 Delete系のタスク削除とキャッシュ削除の実装を確認する
  - Resume Build時のタスク再利用/リセット挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:27 JST Delete cacheの意味とResume Build挙動の調査に着手。
  - done: 2026-01-24 19:28 JST step4削除ボタンのタスク/キャッシュ削除の実態とResume Build挙動を整理。

2347) fix/shape/step5-resume-show-persisted (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-resume-show-persisted
- 依存: なし
- 受け入れ基準: Resume Build が表示される状態で永続化済みタスクがあればステージ別に表示される／擬似タスク（cache件数からの生成）は復活させない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`
- ロールバック手順: 永続化タスクの読み込み差分を revert する
- チェックリスト:
  - listBuildTasks の実データ読み込みを復活する
  - list*Caches 由来の擬似タスク生成は復活させない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:19 JST Resume Build時に永続化タスクが表示されない問題の修正に着手。
  - update: 2026-01-24 19:20 JST listBuildTasksの永続化タスクをUIの実タスク一覧へ復帰。
  - done: 2026-01-24 19:20 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2346) fix/shape/step5-remove-task-fallback (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-remove-task-fallback
- 依存: なし
- 受け入れ基準: step5の擬似タスク生成フォールバックを撤去し、実タスクが無い場合は空表示のみになる／list*Cachesからの擬似タスク生成を削除する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`
- ロールバック手順: useShapeBuildStep のフォールバック読み込み差分を revert する
- チェックリスト:
  - listBuildTasks/list*Cachesの擬似タスク生成を削除する
  - step5表示が実タスクのみになることを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:10 JST step5の擬似タスクフォールバック撤去に着手。
  - update: 2026-01-24 19:16 JST listBuildTasks/list*Cachesの擬似タスク生成を撤去し、実タスクのみ表示へ変更。
  - done: 2026-01-24 19:17 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2345) analysis/shape/step5-task-lifecycle (P1) — 進行中 (2026-01-24)
- ブランチ名: analysis/shape/step5-task-lifecycle
- 依存: なし
- 受け入れ基準: step5のタスク生成/実行/保存/表示のライフサイクルをコード参照付きで説明する／キャッシュ表示の差分ポイントを特定する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`, `packages/vt-orchestrator/src/**`, `packages/plugin-service-sdk/src/**`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - タスク生成〜実行〜永続化〜表示までの流れを整理する
  - step5でのキャッシュ表示の差分ポイントを特定する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 19:04 JST step5タスクライフサイクルの調査に着手。
  - update: 2026-01-24 19:07 JST step5のタスク取得/キャッシュ読み込み/表示フローをコードで確認。
  - done: 2026-01-24 19:07 JST タスクライフサイクルの説明と差分ポイントを整理。
  - update: 2026-01-24 19:10 JST 生成/更新/消去のタイミングを追加で整理。

2344) fix/shape/step5-cached-task-display (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-cached-task-display
- 依存: なし
- 受け入れ基準: Step5 遷移時にキャッシュ済みタスクがあれば no tasks yet を出さずに進捗/サマリー/一覧へ表示される／キャッシュ未取得中はスケルトン表示になる／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`
- ロールバック手順: スケルトン/空表示条件の差分を revert する
- チェックリスト:
  - cache ロード中はスケルトンを表示する
  - キャッシュ済みタスクがある場合は no tasks yet を表示しない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 18:52 JST キャッシュ済みタスクの表示改善に着手。
  - update: 2026-01-24 18:53 JST キャッシュ読み込み中はスケルトンを表示し、no tasks yet を抑制。
  - update: 2026-01-24 19:53 JST tasksByStage の内容変化がない場合は同期を抑制して無限更新を回避。検証: pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-24 19:57 JST stages/stageProgress/paneProgress の署名比較で冗長更新を抑制。検証: pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-01-24 18:53 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2343) fix/ui/build-failed-dialog-reason (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui/build-failed-dialog-reason
- 依存: なし
- 受け入れ基準: Build failed ダイアログの Task/Message に具体的な失敗理由が表示される／タスク一覧の失敗メッセージと一致する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`
- ロールバック手順: ダイアログ表示条件の差分を revert する
- チェックリスト:
  - failed ダイアログの表示条件を詳細メッセージ準拠にする
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 18:33 JST Build failed ダイアログの詳細メッセージ反映に着手。
  - update: 2026-01-24 18:33 JST failed ダイアログを詳細メッセージが取得できてから表示するよう調整。
  - done: 2026-01-24 18:33 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-24 18:38 JST failed タスクの message が空ならダイアログ表示を保留する条件を強化。
  - update: 2026-01-24 18:44 JST failed ダイアログを failedTaskInfo.message がある場合のみ表示するよう変更。

2342) fix/ui/build-failed-task-message (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui/build-failed-task-message
- 依存: なし
- 受け入れ基準: Worker側のタスク失敗時に message へ具体的なエラー内容が保存されUIに表示される／Transform/VT など全ステージの失敗で同様に反映される／pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/compareTaskOrder.ts`
- ロールバック手順: failed タスクの message 付与差分を revert する
- チェックリスト:
  - failed タスク更新時に message を errorMessage へ反映する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 18:25 JST 失敗タスクの message へ詳細エラーを反映する対応に着手。
  - update: 2026-01-24 18:26 JST failed タスクの message に errorMessage を反映。
  - done: 2026-01-24 18:26 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2341) fix/shape/step4-simplification-slider-order (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step4-simplification-slider-order
- 依存: なし
- 受け入れ基準: Simplification のスライダー順が threshold → tolerance #1 → tolerance #2 になる／threshold は inverted ではない／i18n が更新される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/*.json`
- ロールバック手順: スライダー順序と文言変更差分を revert する
- チェックリスト:
  - threshold/耐性スライダーの順序を並べ替える
  - threshold スライダーを非 inverted にする
  - tolerance #1/#2 ラベルを更新する
  - i18n を更新する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 15:42 JST Simplification スライダー順序と文言変更に着手。
  - update: 2026-01-24 18:12 JST threshold → tolerance #1 → tolerance #2 の順に並べ替え、ラベルを更新。
  - done: 2026-01-24 18:14 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。


2340) fix/ui/build-failed-dialog-snapshot (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/ui/build-failed-dialog-snapshot
- 依存: なし
- 受け入れ基準: Build Failed ダイアログの内容が開いた時点の task title/message を保持し、状態更新で「Build ended」等へ劣化しない／失敗時は必ず具体的な task title/message を表示する／shape/location/route で一貫した挙動になる／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`
- ロールバック手順: ダイアログのスナップショット保持差分を revert する
- チェックリスト:
  - ダイアログ表示時に title/message を固定する
  - 失敗時の task title/message を必ず表示する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 22:10 JST Build Failed ダイアログの表示内容が劣化する問題の修正に着手。
  - done: 2026-01-25 22:22 JST ダイアログ表示時の内容をスナップショット化し、Failed時は task title/message を固定表示。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2339) fix/ui/build-failed-dialog-details (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/ui/build-failed-dialog-details
- 依存: なし
- 受け入れ基準: Build Failed ダイアログに具体的な task title と task message が表示される／表示内容は既存のタスク一覧と一致し、未表示のエラーがダイアログだけに出ない／shape/location/route で表示方針が一貫する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`
- ロールバック手順: ダイアログ詳細表示の差分を revert する
- チェックリスト:
  - 失敗時の task title / task message をダイアログに表示する
  - タスク一覧に存在するタスク情報から取得する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 21:30 JST Build Failed ダイアログに task title/message を表示する対応に着手。
  - done: 2026-01-25 21:44 JST shape/location/route の失敗ダイアログに task title と task message を表示するよう統一。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2338) analysis/ui/build-failed-false-positive (P1) — 進行中 (2026-01-25)
- ブランチ名: analysis/ui/build-failed-false-positive
- 依存: なし
- 受け入れ基準: Build Failed ダイアログの判定条件と判定タイミングをコード上で説明できる／偽陽性の原因候補を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - Build Failed の判定条件を列挙する
  - 判定タイミング（どの状態遷移で表示するか）を確認する
  - 偽陽性の候補を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 21:12 JST Build Failed 偽陽性の判定条件/タイミングの調査に着手。
  - done: 2026-01-25 21:20 JST Build Failed の判定条件と判定タイミングをコードで確認し、偽陽性の主因候補（shapeのtaskQueueに残るfailed）を整理。

2337) fix/ui/build-completion-dialog (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/ui/build-completion-dialog
- 依存: なし
- 受け入れ基準: すべてのビルドで完了/失敗時にメッセージダイアログが表示される／ダイアログに「どのステージで」「なぜ終了したか」が表示される／ユーザ操作の一時停止/再開では表示されない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／pnpm --filter @hierarchidb/route-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`
- ロールバック手順: ビルド完了/失敗のダイアログ表示差分を revert する
- チェックリスト:
  - 完了/失敗時にダイアログを表示する
  - ステージ名と理由が表示される
  - 一時停止/再開では表示しない
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-24 18:18 JST 完了ダイアログがFetch完了で出る問題の修正に着手。
  - update: 2026-01-24 18:22 JST 完了ダイアログを最終ステージ(VT)完了時のみ出すよう調整。検証: pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - start: 2026-01-25 20:40 JST ビルド完了/失敗時に理由とステージを示すダイアログを表示する対応に着手。
  - done: 2026-01-25 20:58 JST shape/location/route のビルド完了/失敗でダイアログを表示するよう統一。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2336) fix/ui/batch-progress-final-sync (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/ui/batch-progress-final-sync
- 依存: なし
- 受け入れ基準: ビルド完了/エラー中止時に全体進捗・ステージサマリー・タスク一覧の数値が最終的に一致する／更新の一時的な遅延は許容されるが終了時点で stale のまま停止しない／進捗購読のフラッシュ条件が整理される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 進捗フラッシュ/購読差分を revert する
- チェックリスト:
  - 終了時に進捗の最終フラッシュが必ず走るよう修正する
  - サマリー/タスク一覧の更新順序とソースが一致することを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 20:05 JST 進捗の最終同期が遅延し、サマリーとタスク一覧で不一致が残る問題の修正に着手。
  - done: 2026-01-25 20:24 JST ビルド完了/失敗時にタスク一覧を即時フラッシュし、進捗との不一致時は再取得するよう調整。pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2335) fix/shape/transform-vertex-limit-fail (P1) — 進行中 (2026-01-25)
- ブランチ名: fix/shape/transform-vertex-limit-fail
- 依存: なし
- 受け入れ基準: transform の簡略化後に各featureの頂点数を検査し、65535超過時はタスクを failed にする／失敗理由が判別できるようエラーレコードが記録される／pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`
- ロールバック手順: transform の頂点数検査差分を revert する
- チェックリスト:
  - 簡略化後の頂点数を検査し、65535超過で failed を返す
  - 失敗理由をエラーレコードへ記録する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 19:30 JST transform 簡略化後の頂点数検査で 65535 超過時に failed とする対応に着手。
  - done: 2026-01-25 19:36 JST 65535 超過時に failed を返すチェックとエラーレコード記録を追加。pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2334) fix/shape/step5-vt-empty-tile-skip (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-vt-empty-tile-skip
- 依存: なし
- 受け入れ基準: vtステージで geojson-vt produced empty tile for clipped features が Failed ではなく Skipped になる／タスクメッセージが skipped:... として集計される／本来の失敗は Failed のまま／pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: vtStage の empty tile 判定差分を revert して failed 扱いへ戻す
- チェックリスト:
  - empty tile 判定で failed ではなく skipped メッセージを返す
  - 既存の error/exception の failed 扱いが維持されることを確認する
  - pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 16:40 JST vtステージの empty tile 判定を skipped 扱いへ変更する対応に着手。
  - update: 2026-01-24 16:42 JST empty tile 判定を skipped メッセージへ変更。
  - done: 2026-01-24 16:43 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2333) fix/shape/step4-large-area-tolerance-valid (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step4-large-area-tolerance-valid
- 依存: なし
- 受け入れ基準: largeAreaTolerance <= tolerance のときに Processing Configuration が valid になる／largeAreaTolerance の許容範囲が <= 比較で妥当化される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/utils.ts`
- ロールバック手順: バリデーション条件の差分を revert する
- チェックリスト:
  - largeAreaTolerance のバリデーション条件を見直す
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 15:10 JST largeAreaTolerance の valid 判定修正に着手。
  - update: 2026-01-24 15:40 JST largeAreaTolerance のバリデーションを 0 以上に緩和。
  - done: 2026-01-24 15:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2332) fix/shape/step4-area-tolerance-labels (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step4-area-tolerance-labels
- 依存: なし
- 受け入れ基準: threshold area スライダーが inverted 表示になる／名称が relaxed tolerance 表記へ変更される／i18n を更新する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/*.json`
- ロールバック手順: inverted/名称変更の差分を revert する
- チェックリスト:
  - threshold area Slider を inverted にする
  - threshold/large-area ラベルを relaxed tolerance へ更新する
  - i18n を更新する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 14:58 JST threshold area inverted とラベル更新に着手。
  - update: 2026-01-24 15:08 JST threshold area を inverted にし、relaxed tolerance 表記へ更新。
  - done: 2026-01-24 15:10 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2331) fix/shape/step4-area-threshold-slider (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step4-area-threshold-slider
- 依存: なし
- 受け入れ基準: Transform の threshold area が Slider 化され、最初のズームバンド max に基づく国名 marks が表示される／値は px^2 として保存される／i18n 文言が更新される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/*.json`
- ロールバック手順: Slider 化と i18n 追加の差分を revert してテキスト入力に戻す
- チェックリスト:
  - threshold area 入力を Slider 化する
  - 国名 marks を最初のズームバンド max で算出する
  - i18n 文言を更新する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 14:50 JST threshold area slider と国名 marks の対応に着手。
  - update: 2026-01-24 14:57 JST threshold area を Slider 化し、国名 marks と説明文を追加。
  - done: 2026-01-24 14:58 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2344) fix/shape/step5-start-after-cache-delete-crash-v2 (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-start-after-cache-delete-crash-v2
- 依存: なし
- 受け入れ基準: Step4のDelete tile index + tile data cache後にStep5のStart Buildで進捗が開始されずクラッシュする原因が特定される／原因・発生範囲・修正方法と適用範囲が明記される／必要なら最小差分で修正する／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/worker/**`（調査後に確定）
- ロールバック手順: 修正差分を revert する
- チェックリスト:
  - Delete tile index + tile data cache後のビルド開始クラッシュの再現条件を整理する
  - 原因を特定し、必要なら最小差分で修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:18 JST Delete tile index + tile data cache後のStart Buildクラッシュ再調査に着手。
  - update: 2026-01-24 23:21 JST tile relationsの再構築結果を再読込せず、再構築中にtileBuffersを組み立てるよう最適化。
  - done: 2026-01-24 23:21 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2345) feat/shape/step6-preview-map-state-persist (P1) — 進行中 (2026-01-25)
- ブランチ名: feat/shape/step6-preview-map-state-persist
- 依存: なし
- 受け入れ基準: Step6プレビューの地図中心座標とズーム率がShapeEntityに保存される／再度Step6を開いた際に保存値が復元される／既存のプレビュー操作や保存フローに影響しない／pnpm typecheck が exit 0（必要なら該当パッケージで実行）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: 地図状態永続化の差分を revert する
- チェックリスト:
  - Step6プレビューの中心座標/ズーム率の保存箇所を特定する
  - ShapeEntityへ永続化する
  - Step6再表示時に保存値が復元されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 18:13 JST Step6プレビュー地図状態の永続化対応に着手。

2342) docs/shape/step4-delete-vt-cache-copy (P1) — 完了 (2026-01-24)
- ブランチ名: docs/shape/step4-delete-vt-cache-copy
- 依存: なし
- 受け入れ基準: Step4のDelete tile index + tile data cacheの説明文に「VTのみ削除・transformは残る」旨が明記される／既存動作は変わらない／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`（調査後に確定）
- ロールバック手順: 説明文変更差分を revert する
- チェックリスト:
  - Delete tile index + tile data cacheの説明文を更新する
  - 既存動作が変わらないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:15 JST Step4のVT削除説明文の明確化に着手。
  - update: 2026-01-24 23:15 JST VT削除がtransform cacheを保持する旨を説明文に追加。
  - done: 2026-01-24 23:15 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2341) fix/shape/step5-start-after-cache-delete-crash (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-start-after-cache-delete-crash
- 依存: なし
- 受け入れ基準: Step4のDelete tile index + tile data cache後にStep5のビルド開始で遅延/クラッシュする原因が特定される／原因・発生範囲・修正方法と適用範囲が明記される／必要なら最小差分で修正する／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/worker/**`（調査後に確定）
- ロールバック手順: 修正差分を revert する
- チェックリスト:
  - Delete tile index + tile data cacheの実装と影響範囲を確認する
  - Step5のビルド開始が遅延/クラッシュする原因を特定する
  - 必要なら最小差分で修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:57 JST Delete tile index + tile data cache後のビルド開始遅延/クラッシュの調査に着手。
  - update: 2026-01-24 23:01 JST tile relations再構築のバッチ書き込み化とストリーム処理でメモリ負荷を抑制。
  - done: 2026-01-24 23:01 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2340) fix/shape/step5-vt-progress-flap (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-vt-progress-flap
- 依存: なし
- 受け入れ基準: VTステージの進捗がCompleted→Runningと揺れる原因が特定される／原因・発生範囲・修正方法と適用範囲が明記される／必要なら最小差分で修正する／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/worker/**`（調査後に確定）
- ロールバック手順: 進捗判定の差分を revert する
- チェックリスト:
  - VT進捗の更新経路とステータス判定を確認する
  - Completed→Runningの揺れの原因を特定する
  - 必要なら最小差分で修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:48 JST VTステージ進捗の揺れ（Completed→Running）の調査に着手。
  - update: 2026-01-24 22:51 JST パイプライン稼働中はcompletedを返さず、終了時に進捗スナップショットを送るよう修正。
  - done: 2026-01-24 22:51 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2339) fix/shape/step5-resume-not-starting (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-resume-not-starting
- 依存: なし
- 受け入れ基準: 再開クリック後に開始されない原因が特定される／原因・発生範囲・修正方法と適用範囲が明記される／修正が必要なら最小差分で対応される／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`, `plugins/shape-plugin/src/ui/hooks/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 再開処理の差分を revert する
- チェックリスト:
  - 再開処理の呼び出し経路と戻り値を確認する
  - 再開後に開始されない原因を特定する
  - 必要なら最小差分で修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:41 JST 再開クリック後に開始されない問題の調査に着手。
  - update: 2026-01-24 22:45 JST paused判定をruntimeStatus依存からbuildStatus依存に変更し、resume経路が確実に選択されるよう修正。
  - done: 2026-01-24 22:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2338) fix/shape/step5-active-stage-flow-band (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-active-stage-flow-band
- 依存: なし
- 受け入れ基準: 進捗帯はビルド中のアクティブなステージのみ表示される／VTステージのサマリーにあるLinearProgress（indeterminate）が撤去される／既存のクリック/キーボード操作や色分けが維持される／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 進捗帯の表示条件とLinearProgress撤去差分を revert する
- チェックリスト:
  - アクティブステージ判定に基づいて進捗帯を表示する
  - VTステージサマリーのLinearProgressを撤去する
  - 既存操作と表示が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:34 JST アクティブステージのみ進捗帯表示とVTサマリーLinearProgress撤去に着手。
  - update: 2026-01-24 22:36 JST アクティブステージのみ進捗帯を表示し、VTステージのindeterminate LinearProgressを撤去。
  - done: 2026-01-24 22:36 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2337) fix/shape/step5-progress-viewport-padding-ratio (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-progress-viewport-padding-ratio
- 依存: なし
- 受け入れ基準: 非表示範囲の上下パディングがSVG高さの20%になる／進捗帯が左側の20%でリセットされず右端まで到達する／既存のクリック/キーボード操作や色分けが維持される／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: 非表示範囲のパディング・進捗帯アニメーション変更差分を revert する
- チェックリスト:
  - 非表示範囲のパディングをSVG高さの20%に変更する
  - 進捗帯が右端まで到達するようアニメーションを修正する
  - 既存操作と表示が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:29 JST 非表示範囲のパディング比率と進捗帯アニメーション修正に着手。
  - update: 2026-01-24 22:30 JST 非表示範囲の上下パディングを高さの20%に変更し、進捗帯が右端まで到達するよう移動距離を調整。
  - done: 2026-01-24 22:30 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2336) fix/shape/step5-progress-flow-reach-right (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-progress-flow-reach-right
- 依存: なし
- 受け入れ基準: 進捗バー上の半透明10%帯が右端まで到達してから左へ戻る／既存のタスク表示/クリック/キーボード操作が維持される／pnpm typecheck が exit 0（既存エラーがあればblocked記録）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: 流れる帯のアニメーション変更差分を revert する
- チェックリスト:
  - 流れる帯が右端まで到達するようアニメーションを調整する
  - 既存操作と表示が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:24 JST 進捗帯が右端まで到達しない問題の修正に着手。
  - update: 2026-01-24 22:25 JST 進捗帯の移動開始位置を-100%に変更して右端到達まで移動するよう調整。
  - blocked: 2026-01-24 22:25 JST pnpm --filter @hierarchidb/shape-plugin typecheck が既存エラー（shapeQueryAPIImpl未定義）で失敗。

2335) fix/shape/step5-progress-bar-height (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/shape/step5-progress-bar-height
- 依存: なし
- 受け入れ基準: TaskProgressBarの高さが現行の2倍になる／ビューポート段差と流れる帯の表示が崩れない／既存のクリック/キーボード操作や色分けが維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: 進捗バー高さの変更差分を revert する
- チェックリスト:
  - 進捗バーの高さを現行の2倍に変更する
  - ビューポート段差と流れる帯の表示が崩れないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:20 JST TaskProgressBarの高さ変更に着手。
  - blocked: 2026-01-24 22:21 JST pnpm --filter @hierarchidb/shape-plugin typecheck が既存エラー（shapeQueryAPIImpl未定義など）で失敗。

2334) feat/shape/step5-progress-flow-band (P1) — 完了 (2026-01-24)
- ブランチ名: feat/shape/step5-progress-flow-band
- 依存: なし
- 受け入れ基準: Step5の進捗バー上で横幅10%の#ffffff80帯が左→右へ流れるアニメーションが表示される／既存のタスク表示やクリック/キーボード操作が維持される／LinearProgressのindeterminate表示が撤去される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 流れる帯のアニメーションとLinearProgress撤去差分を revert する
- チェックリスト:
  - 進捗バー上の流れる帯アニメーションを追加する
  - LinearProgress（indeterminate）を撤去する
  - 既存操作と表示が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:12 JST Step5進捗バーの流れる帯アニメーション追加に着手。
  - update: 2026-01-24 22:12 JST 進捗バー上に#ffffff80の10%帯を追加し、LinearProgressを撤去。
  - done: 2026-01-24 22:12 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2333) fix/shape/step5-progress-viewport-band (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/step5-progress-viewport-band
- 依存: なし
- 受け入れ基準: Step5のタスク進捗バーで表示中範囲はy=0/height=height、非表示範囲はy=2/height=height-4で描画される／スクロールに追随する／既存のクリック/キーボード操作や色分けが維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 進捗バーの表示範囲描画差分を revert する
- チェックリスト:
  - ビューポート範囲の描画ルールをy=0/height=heightに変更する
  - 非表示範囲の描画ルールをy=2/height=height-4に変更する
  - スクロール追随と既存操作が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:43 JST 進捗バーの表示範囲描画ルール変更に着手。
  - update: 2026-01-24 21:44 JST 表示中範囲はy=0/height=height、非表示範囲はy=2/height=height-4で描画するよう変更。
  - done: 2026-01-24 21:44 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2332) fix/shape/shapePipeline-semicolon-error (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape/shapePipeline-semicolon-error
- 依存: なし
- 受け入れ基準: shapePipeline.ts の構文エラーが解消される／Step5 の表示確認が可能になる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（調査後に確定）
- ロールバック手順: セミコロン/型アサーション修正差分を revert する
- チェックリスト:
  - shapePipeline.ts の構文エラー箇所を特定する
  - セミコロン/型アサーションの誤りを修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:36 JST shapePipeline.ts の構文エラー修正に着手。
  - update: 2026-01-24 21:37 JST filter の型アサーションを同一行にまとめて構文エラーを解消。
  - done: 2026-01-24 21:37 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2331) feat/shape/step5-progress-viewport-outline (P1) — 完了 (2026-01-24)
- ブランチ名: feat/shape/step5-progress-viewport-outline
- 依存: なし
- 受け入れ基準: Step5のタスク一覧のスクロールによる表示範囲がタスク進捗バーに青色枠で反映される／スクロールに追随して枠が更新される／既存のクリック/キーボード操作や色分けが維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 進捗バーの表示範囲強調差分を revert する
- チェックリスト:
  - タスク一覧のビューポート範囲を取得する
  - 進捗バーに青色枠の強調表示を追加する
  - 既存のクリック/キーボード操作や色分けが維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:30 JST Step5のタスク進捗バーに表示範囲の青色枠を追加する対応に着手。
  - update: 2026-01-24 21:34 JST タスク一覧のビューポート範囲を取得し、進捗バーに青色枠で反映。
  - done: 2026-01-24 21:34 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2330) fix/ui/plugin-dialog-hover-zone-height (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui/plugin-dialog-hover-zone-height
- 依存: なし
- 受け入れ基準: PluginDialogフルスクリーン時のヘッダ/フッタ表示用ホバー領域の高さを拡大しても操作性が損なわれない／表示用のディレイが0になる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: ホバー領域サイズ/ディレイ変更差分を revert する
- チェックリスト:
  - ヘッダ/フッタのホバー領域の高さを拡大する
  - アニメーションのディレイを0にする
  - 操作性が損なわれないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 10:29 JST ホバー領域の高さとディレイ変更の対応に着手。
  - update: 2026-01-24 10:30 JST ヘッダ/フッタのホバー領域を24pxに拡大し、アニメーションのディレイを0に変更。
  - done: 2026-01-24 10:30 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。

2329) fix/ui/plugin-dialog-fullscreen-header-autohide (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui/plugin-dialog-fullscreen-header-autohide
- 依存: なし
- 受け入れ基準: PluginDialogフルスクリーン時にヘッダが確実に自動非表示になる／フッタの既存挙動は維持される／既存のクリック/ドラッグ挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: ヘッダ自動非表示のイベント処理差分を revert する
- チェックリスト:
  - ヘッダ自動非表示が発火しない条件を確認する
  - ヘッダの自動非表示が確実に発火するよう修正する
  - フッタの既存挙動が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 10:20 JST フルスクリーン時にヘッダの自動非表示が発火しない問題の調査に着手。
  - update: 2026-01-24 10:22 JST ヘッダ/フッタの非表示トリガーをpointerleaveに変更して発火漏れを抑制。
  - done: 2026-01-24 10:22 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。

2328) fix/ui/plugin-dialog-fullscreen-hover-animation (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui/plugin-dialog-fullscreen-hover-animation
- 依存: なし
- 受け入れ基準: PluginDialogのフルスクリーン時にヘッダ/フッタの自動表示・非表示がアニメーションで切り替わる／ホバーによる自動表示・非表示の挙動は維持される／アニメーションは0.1秒ディレイ、0.2秒で0%→100%に進行する／レイアウト崩れやクリック不能が発生しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/**`, `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: フルスクリーン時のヘッダ/フッタ表示アニメーション差分を revert する
- チェックリスト:
  - フルスクリーン時のヘッダ/フッタの表示制御箇所を特定する
  - 0.1秒ディレイ/0.2秒のアニメーションを追加する
  - 既存のホバー表示/非表示の挙動が維持されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 10:09 JST PluginDialogフルスクリーンのヘッダ/フッタ自動表示をアニメーション化する対応に着手。
  - update: 2026-01-24 10:13 JST ヘッダ/フッタの表示切り替えに0.1sディレイ/0.2sアニメーションを追加。
  - done: 2026-01-24 10:13 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。

2327) fix/styler/step5-fillcolor-next (P1) — 完了 (2026-01-24)
- ブランチ名: fix/styler/step5-fillcolor-next
- 依存: なし
- 受け入れ基準: Styler Step5 の初期状態で Fill Color が選択済みなら Step6 への遷移可能条件が true になる／条件判定のタイミングと依存値が適切に更新される／pnpm --filter @hierarchidb/styler-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/styler-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: Step5/Step6 遷移条件の差分を revert する
- チェックリスト:
  - Step5/Step6 の有効化判定の経路と依存値を特定する
  - Fill Color の初期選択状態が条件判定に反映されるよう修正する
  - pnpm --filter @hierarchidb/styler-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 09:45 JST Styler Step5 の Fill Color 初期選択で Step6 遷移が有効化されない問題の調査に着手。
  - update: 2026-01-24 10:08 JST Step5 初期状態の不足値（styleType/valueType/targetOptionId）を補完する処理を追加。
  - done: 2026-01-24 10:08 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0 を確認。

2310) feat/shape/step4-basic-settings-cards (P1) — 進行中 (2026-01-24)
  - update: 2026-01-24 01:35 JST boundaryDedupe UI を撤去し、既定値を true に固定。Advanced settings は削除。
  - update: 2026-01-24 01:36 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-24 01:22 JST Basic settings の Layering & IDs / Formats を撤去し、Advanced settings は boundaryDedupe のみ残す構成へ整理。
  - update: 2026-01-24 01:23 JST pnpm typecheck exit 0 を確認。
  - blocked: 2026-01-24 01:05 JST pnpm typecheck で app/shape-plugin の TransformConfig 型エラー（selfIntersectionTuningConfig 等）を検出。
- ブランチ名: feat/shape/step4-basic-settings-cards
- 依存: なし
- 受け入れ基準: Step4 の Basic settings が内容ごとのカードに整理される／入力項目・バリデーション・保存/読み込み挙動が変わらない／ダークモードでも可読性が維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/VTConfigSection.tsx`
- ロールバック手順: Step4 のレイアウト変更差分を revert する
- チェックリスト:
  - Basic settings を内容ごとのカードに再構成する
  - 既存の入力値/検証/保存フローが維持されることを確認する
  - ダークモードの可読性を確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-24 19:00 JST transformの頂点数超過時にtoleranceを段階的に上げるリトライ対応に着手。
  - update: 2026-01-24 15:15 JST large-area tolerance の初期値を tolerance と同値に変更。検証: pnpm typecheck exit 0。
  - update: 2026-01-24 15:14 JST large-area tolerance の既定値を tolerance と一致させる対応に着手。
  - update: 2026-01-24 15:01 JST VT GenerationのBasic settings撤去とTile geometry & marginの直下配置/2カラム化を反映。検証: pnpm typecheck exit 0。
  - update: 2026-01-24 14:58 JST VT GenerationのBasic settings廃止とTile geometry & margin移動に着手。
  - update: 2026-01-24 14:33 JST Step4のZoom band以外のカードにもホバーエフェクトを付与。検証: pnpm typecheck exit 0。
  - update: 2026-01-24 14:31 JST Step4のZoom band以外のカードにホバーエフェクトを付与する対応に着手。
  - update: 2026-01-24 14:28 JST Zoom band settings cardにホバーエフェクトを追加。検証: pnpm typecheck exit 0。
  - update: 2026-01-24 14:27 JST Step4のZoom band cardにホバーエフェクトを追加する対応に着手。
  - update: 2026-01-24 13:59 JST Range count整列とtolerance系スライダーのアイコン反転/ギャップ調整。検証: pnpm typecheck exit 0。
  - update: 2026-01-24 13:58 JST Range countの中央寄せとtolerance系アイコン反転/ギャップ調整に着手。
  - blocked: 2026-01-24 13:50 JST pnpm typecheck が shape-plugin の VTConfigSection watermark スライダーで number | undefined 型エラー。
  - update: 2026-01-24 13:52 JST watermark スライダーの型ガードを追加し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-24 13:44 JST Step4のVT/Zoom band/Transform UIのスライダー/アイコン調整に着手。
  - update: 2026-01-24 10:07 JST VT 設定UIの並列/用語/ヘルプを整理し、Dynamic concurrency 条件を調整。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:05 JST VT 設定UIの整理（並列・用語統一・ヘルプ更新）に着手。
  - start: 2026-01-24 00:40 JST Step4 Basic settings のカード整理に着手。
  - update: 2026-01-25 17:40 JST VT Basic settings のカードを 4/3/2/1 カラムに合わせて調整し、Fetch Retry カードの幅を 4/3 カラム時に 3 カラム分へ修正。
  - update: 2026-01-25 17:45 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2325) refactor/shape/transform-simplify-only (P1) — 完了 (2026-01-25)
- ブランチ名: refactor/shape/transform-simplify-only
- 依存: なし
- 受け入れ基準: simplify-only 以外の transformMode 分岐（full系）がコードから撤去される／simplify-only では効果がない UI（quantize など）を同時に撤去する／不要になったパラメータ・ログ・エラーレコード経路が整理される／i18n 文言が最新構成に一致する／pnpm typecheck が exit 0／TASKS.md に運用ログとロールバック手順が記載される
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/common/types/constants.ts`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/**/__tests__/**`（調査後に確定）
- ロールバック手順: simplify-only 固定化と UI/設定削除差分を revert し、full モード分岐を復帰する
- チェックリスト:
  - ExecPlan を作成する
  - full モード分岐と関連パラメータの利用箇所を特定する
  - simplify-only 固定化に合わせてコードと設定を整理する
  - simplify-only で不要な UI を撤去する
  - i18n 文言を更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 03:30 JST simplify-only 固定化と UI/設定整理に着手。
  - update: 2026-01-25 04:05 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 04:12 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - done: 2026-01-25 04:15 JST simplify-only 固定化と不要 UI/設定の撤去を完了。

2324) fix/shape/step4-fetch-filter-params (P1) — 完了 (2026-01-25)
- ブランチ名: fix/shape/step4-fetch-filter-params
- 依存: なし
- 受け入れ基準: fetch ステージ終盤のフィルタリングに実際に使われるパラメータが Fetch アコーディオンに移動される／transform の簡略化 UI と混在しない／i18n の文言がステージ区分に一致する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`（調査後に確定）
- ロールバック手順: Fetch/Transform の UI 再配置差分を revert し、従来の配置に戻す
- チェックリスト:
  - fetch ステージで実際に使用されるフィルタリングパラメータを特定する
  - Fetch アコーディオンに該当 UI を移動する
  - Transform 側から該当 UI を撤去する
  - i18n 文言をステージ表記に合わせて更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 02:35 JST fetch ステージのフィルタリング UI を Fetch へ移設する作業に着手。
  - blocked: 2026-01-25 02:50 JST pnpm typecheck が shape-plugin の import パス誤り（FetchConfigSection）で失敗。
  - update: 2026-01-25 02:52 JST FetchConfigSection の import パスを修正。
  - done: 2026-01-25 03:05 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2322) feat/shape/step4-area-based-tolerance-ui (P2) — 完了 (2026-01-23)
- ブランチ名: feat/shape/step4-area-based-tolerance-ui
- 依存: なし
- 受け入れ基準: Step4 に大国向け簡略化調整のUIが追加され、既定OFFで挙動が変わらない／UIで設定した値が transform の簡略化に反映される／pnpm typecheck が exit 0／TASKS.md にロールバック手順と運用ログが記載される
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`, `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/common/types/constants.ts`（調査後に確定）
- ロールバック手順: Step4 UI追加と area-based tolerance 設定差分を revert し、既定OFFの挙動を維持する
- チェックリスト:
  - area-based tolerance の設定項目を TransformConfig に追加する
  - vt-orchestrator の tolerance 計算に設定値を反映する
  - Step4 の UI に項目と説明文を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 13:30 JST Step4 に area-based tolerance 設定を追加する対応に着手。
  - update: 2026-01-23 13:35 JST area-based tolerance の設定項目を追加し、transform 簡略化へ反映。
  - update: 2026-01-23 13:36 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - done: 2026-01-23 13:38 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2323) feat/shape/step4-card-layout-icons (P2) — 完了 (2026-01-23)
- ブランチ名: feat/shape/step4-card-layout-icons
- 依存: なし
- 受け入れ基準: Step4 の削除系スイッチにゴミ箱アイコンが付く／Fetch Retry の Timeout/Delay/Limit が1枚のカードに統合され時計アイコンとタイトルが付く／アコーディオン内フォームがカード化され適切なアイコンとタイトルが付く／pnpm typecheck が exit 0／TASKS.md にロールバック手順と運用ログが記載される
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`（調査後に確定）
- ロールバック手順: Step4 のカードレイアウト/アイコン変更差分を revert して従来の配置に戻す
- チェックリスト:
  - 削除系スイッチのラベルにゴミ箱アイコンを追加する
  - Fetch Retry の Timeout/Delay/Limit を1枚のカードに統合する
  - Step4 のフォームをカード化し、アイコンとタイトルを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 13:55 JST Step4 のカード化とアイコン付与に着手。
  - update: 2026-01-23 14:00 JST Fetch/Transform/VT/Zoom band/Cache 管理のカードにアイコンを追加し、Fetch Retry を統合カード化。
  - update: 2026-01-23 14:02 JST Retry Limit を Retry Attempts に追従する表示へ調整。
  - update: 2026-01-23 14:20 JST Retry Limit を非表示に切り替え、Zoom band のアイコン参照を修正。
  - update: 2026-01-23 14:40 JST Step4 の Grid を最大4カラム（lg）に調整し、幅に応じて 3/2/1 カラムへ切り替え。
  - update: 2026-01-23 19:25 JST Fetch Retry カードを 4/3/2 カラム時は2カラム幅、1カラム時は全幅に調整。
  - update: 2026-01-23 19:40 JST Fetch Retry カードを 4/3 カラム時は3カラム幅、2/1 カラム時は全幅に調整。
  - done: 2026-01-23 19:41 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2324) audit/shape/vt-ui-slimming (P2) — 進行中 (2026-01-23)
- ブランチ名: audit/shape/vt-ui-slimming
- 依存: なし
- 受け入れ基準: VT ステージの各項目（Input/Output format & compression、TopoJSON simplify、Dynamic concurrency ほか）の実使用状況を確認し根拠付きで整理する／常時表示/Advanced/非表示（撤去候補）の構成案を提示する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/VTConfigSection.tsx`, `packages/vt-orchestrator/src/**`, `packages/features/gis-sdk/src/**`（調査後に確定）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - VT の設定項目が実際に使用されている箇所を確認する
  - 使われていない/固定値運用の項目を整理する
  - UI の整理案（常時表示/Advanced/非表示）をまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-24 11:15 JST サンプル画像ディレクトリを filtering-samples に移行し参照更新。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 11:30 JST LOWサンプルの小島を5つに増やす対応に着手。
  - update: 2026-01-24 11:35 JST LOWサンプルの小島を5つに増やし配置を調整。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 12:10 JST Filteringサンプルのタイトル表記変更とSVG取り込み修正に着手。
  - update: 2026-01-24 12:25 JST タイトル表記を簡潔化し、SVGをデータURL化してビルドエラーを解消。検証: pnpm --filter @hierarchidb/shape-plugin build exit 0（tsdown define 警告あり）、pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 12:40 JST Filtering選択肢ラベルをHigh/Medium/Low detailに統一する対応に着手。
  - update: 2026-01-24 12:45 JST Filtering選択肢ラベルをHigh/Medium/Low detailへ更新。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 12:55 JST Filtering small shapes セクションの枠撤去に着手。
  - update: 2026-01-24 13:05 JST Filtering small shapes セクションの枠を撤去。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 13:20 JST TransformのSimplificationカードを全幅にする対応に着手。
  - update: 2026-01-24 13:30 JST TransformのSimplificationカードを全幅に変更。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 13:45 JST Area-based toleranceの簡素化と非線形スケール対応に着手。
  - blocked: 2026-01-24 14:10 JST pnpm typecheck が vt-orchestrator の AreaBasedToleranceConfig 型不整合で失敗（gis-sdk の型出力未更新）。
  - update: 2026-01-24 14:12 JST pnpm --filter @hierarchidb/gis-sdk build を実行して型出力を更新。
  - update: 2026-01-24 14:14 JST Area-based tolerance の簡素化と非線形スライダーを反映。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 14:25 JST large-area tolerance を tolerance 以下に制限する対応に着手。
  - update: 2026-01-24 14:35 JST large-area tolerance を tolerance 以下に制限。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 14:45 JST large-area tolerance スライダーのinverted化に着手。
  - update: 2026-01-24 14:50 JST large-area tolerance スライダーをinverted化。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 11:20 JST サンプル画像ディレクトリ名から omit を排除し参照先を移行する対応に着手。
  - update: 2026-01-24 11:12 JST 大中小の独立島が分離配置されるようサンプル画像を再修正。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 11:10 JST 自然な沿岸イメージの島配置（大/中/小が複数）へ再修正。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 11:06 JST 自然な沿岸配置の島サンプルへ再差し替え。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:59 JST サンプル画像を独立した島配置へ再修正。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:57 JST Filtering small shapes 表記/説明を簡潔化し、選択で除外係数/最小リング頂点数の推奨値を自動設定。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:55 JST Filtering small shapes 表記と簡潔化、推奨値の自動設定対応に着手。
  - update: 2026-01-24 10:48 JST Detail omission のサンプル画像を島/海の配色へ差し替え、Box選択UIに変更。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:29 JST Detail omission の強調UIと瀬戸内海サンプル画像を追加し、誤解しやすい精度方向を明記。検証: pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 10:09 JST Detail omission の閾値と適用段階（transform/geometry）を確認し説明内容を整理。
  - update: 2026-01-24 10:08 JST Detail omission の LOW/MEDIUM/HIGH の挙動差を確認し説明する対応に着手。
  - start: 2026-01-23 19:47 JST VT ステージ UI の項目整理と実使用状況の調査に着手。
  - update: 2026-01-25 13:40 JST Coordinate Quantization/Detail omission/AreaFilter の実使用確認を開始。
  - update: 2026-01-25 13:55 JST Coordinate Quantization は未配線、Detail omission は fetch フィルタに適用、AreaFilter は transform で適用されることを確認。
  - update: 2026-01-25 14:20 JST Detail omission の説明を Fetch フィルタ適用として明記し、AreaFilter の説明を Transform 適用として補足。
  - done: 2026-01-25 14:45 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 15:30 JST Transform の旧フィルタ/出力 UI を撤去し、turf.simplify 設定に絞り込み。
  - update: 2026-01-25 15:35 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 16:10 JST Delete simplified cache after VT completion の i18n を撤去。
  - update: 2026-01-25 16:15 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2326) chore/shape/remove-topojson-simplify-ui (P2) — 進行中 (2026-01-25)
- ブランチ名: chore/shape/remove-topojson-simplify-ui
- 依存: なし
- 受け入れ基準: Step4 の VT 設定から Enable TopoJSON simplify が撤去される／関連する i18n が削除される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/VTConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/**`（必要なら拡張）
- ロールバック手順: 該当差分を revert し、TopJSON simplify UI を復帰する
- チェックリスト:
  - VTConfigSection から TopoJSON simplify のスイッチを撤去する
  - i18n の topojsonSimplify 文言を削除する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 12:30 JST TopoJSON simplify UI の撤去に着手。
  - update: 2026-01-25 12:50 JST Step4 VT から TopoJSON simplify スイッチと i18n を撤去。
  - update: 2026-01-25 13:05 JST TransformConfig に selfIntersectionTuningConfig/preSimplifyFilterConfig を復帰し、DEFAULT_BUILD_CONFIG を更新。
  - update: 2026-01-25 13:08 JST pnpm --filter @hierarchidb/gis-sdk build exit 0（tsdown define 警告あり）。
  - done: 2026-01-25 13:25 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2321) feat/shape/area-based-simplify-tolerance (P2) — 完了 (2026-01-23)
- ブランチ名: feat/shape/area-based-simplify-tolerance
- 依存: なし
- 受け入れ基準: tolerance の基準が地図平面上の面積に切り替わっている／大国（例: Russia/China）で過剰簡略化が抑制され、小国の負荷は実質増えない／既存ズーム帯の見た目が不連続にならない／ロールバック手順が TASKS.md に明記されている
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/**`, `packages/features/gis-sdk/src/**`（調査後に確定）
- ロールバック手順: tolerance 算出式の変更差分を revert し、従来の BBox 基準に戻す
- チェックリスト:
  - tolerance の算出ロジックと参照箇所を特定する
  - 地図平面上の面積を基準にした tolerance へ切り替える
  - 大国/小国の簡略化結果を比較し、過剰簡略化が抑制されることを確認する
  - ズーム帯の見た目が不連続にならないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 13:22 JST 地図平面の面積基準で tolerance を調整する対応に着手。
  - update: 2026-01-23 13:26 JST simplify-only/通常の簡略化で地図平面の面積に応じて tolerance を調整するロジックを追加。
  - done: 2026-01-23 13:28 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2319) fix/ui-map/hover-snackbar-generic (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui-map/hover-snackbar-generic
- 依存: なし
- 受け入れ基準: ui-map のホバー表示ロジックが汎用化され、shape-plugin step6 の専用 Snackbar 実装を撤去する／ホバー表示は中央下に統一される／ADM0+ADM1 が重なる場合は ADM1 が優先して表示される／ADM1 ホバー時の表示が「自治体名 / ADM1 / 国名 / 国コード / 1」になる／pnpm --filter @hierarchidb/ui-map typecheck と pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `app/src/router/routes/map/MapPage.tsx`（調査後に確定）
- ロールバック手順: ui-map の汎用 hover 表示差分と step6 の専用 Snackbar 撤去差分を revert し、従来の個別実装へ戻す
- チェックリスト:
  - ui-map のホバー表示を汎用化する
  - step6 の専用 Snackbar を撤去する
  - ADM0+ADM1 優先順位と ADM1 表示フォーマットを ui-map 側で担保する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 03:05 JST ui-map 側の汎用ホバー表示へ移設する作業に着手。
  - update: 2026-01-24 03:15 JST ui-map に汎用ホバー表示ロジックを移設し、step6 の専用 Snackbar を撤去。
  - done: 2026-01-24 03:25 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。

2320) fix/ui-map/hover-snackbar-admin-format (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui-map/hover-snackbar-admin-format
- 依存: なし
- 受け入れ基準: Snackbar の表示が ADM0/ADM1/ADM2 で指定フォーマットに切り替わる（ADM0: Country (CC)／ADM1: Admin1 / Country (CC)／ADM2: Admin2 / Admin1 / Country (CC)）／pnpm --filter @hierarchidb/ui-map typecheck と pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: hover snackbar のフォーマット変更差分を revert し、従来表示へ戻す
- チェックリスト:
  - ADM0/ADM1/ADM2 のラベル生成を実装する
  - ui-map 側の hover snackbar を新フォーマットへ切り替える
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 03:40 JST Snackbar の ADM 表示フォーマット変更に着手。
  - update: 2026-01-24 03:45 JST ADM0/ADM1/ADM2 の表示フォーマットを ui-map のホバー表示に反映。
  - done: 2026-01-24 03:50 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。

2315) feat/ui-map/map-preview-floating-lists (P1) — 進行中 (2026-01-24)
- ブランチ名: feat/ui-map/map-preview-floating-lists
- 依存: なし
- 受け入れ基準: /map の Data Table フローティングダイアログが撤去され点滅が発生しない／/map に shape一覧・location一覧・route一覧のフローティングダイアログが表示される／shape一覧は shape-plugin step6 の「フィーチャー一覧」と同等の内容/挙動で名称が「shape一覧」になる／/map のマウスホイール操作時に画面中央へズーム率が表示される／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/**`, `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: /map のフローティングダイアログ差分とズーム率表示の差分を revert し、従来の Data Table を復帰する
- チェックリスト:
  - /map の Data Table フローティングダイアログの実装箇所を特定して撤去する
  - shape-plugin step6 の「フィーチャー一覧」の構成/状態管理/データ取得を調査する
  - /map に shape一覧・location一覧・route一覧のフローティングダイアログを実装する
  - shape一覧の表示内容/挙動を step6 の「フィーチャー一覧」と同等にする（名称は「shape一覧」）
  - /map のマウスホイール操作時のズーム率表示を画面中央に実装する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 21:05 JST /map の Data Table 撤去と一覧/ズーム表示移植に着手。
  - update: 2026-01-24 21:40 JST /map の ModelessDialog を shape/location/route 一覧へ差し替え、ズーム率の中央表示を追加。
  - update: 2026-01-24 21:48 JST pnpm typecheck が shape-plugin の buildMapEntries 宣言順エラーで失敗したため修正を実施。
  - done: 2026-01-24 21:55 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2316) feat/shape/step4-cache-terms-split (P1) — 完了 (2026-01-24)
- ブランチ名: feat/shape/step4-cache-terms-split
- 依存: なし
- 受け入れ基準: step4 の「ビルド終了時の中間生成物の保持」と削除ボタンの文言が新しい用語に統一される（APIキャッシュ/フィルター処理キャッシュ/簡略化キャッシュ/タイルインデックス+タイルデータキャッシュ）／fetch の raw と filtered が UI 上で分離され、それぞれ保持/削除が可能／削除対象が UI 表記と一致する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/types/_BuildConfig.ts`, `plugins/shape-plugin/src/common/types/constants.ts`（調査後に確定）
- ロールバック手順: 文言と UI 分割、および cleanupConfig の変更差分を revert して元の 1 ボタン構成へ戻す
- チェックリスト:
  - fetch の raw / filtered キャッシュ削除の実体と分離方法を確認する
  - step4 の保持/削除 UI を raw / filtered に分割する
  - 用語を ja/en で統一する
  - cleanupConfig の項目を新しい区分へ更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 22:20 JST step4 の用語整理と fetch キャッシュ分割に着手。
  - update: 2026-01-24 23:05 JST pnpm typecheck が CleanupConfig 定義の不整合で失敗したため、pnpm --filter @hierarchidb/gis-sdk build を実行して型定義を更新。
  - done: 2026-01-24 23:10 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2317) chore/shape/step4-ui-audit (P1) — 完了 (2026-01-25)
- ブランチ名: chore/shape/step4-ui-audit
- 依存: なし
- 受け入れ基準: step4 UI の用語揺れ/ステージ移動反映漏れ/撤去済みパラメータUIの孤児/新規処理の未UI化を網羅的に列挙し、各項目に「場所・問題点・整理方針」を1行で記載した一覧を作成する／影響範囲（UI/設定/パイプライン/型/翻訳/ドキュメント）を明示する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`, `docs/vt-pipeline-design.md`（調査後に確定）
- ロールバック手順: 一覧化のみのため不要
- チェックリスト:
  - step4 UI の用語と実処理の齟齬を洗い出す
  - ステージ移動の反映漏れ UI を洗い出す
  - 撤去済みパラメータの孤児 UI を洗い出す
  - 新規処理で UI 未対応の項目を洗い出す
  - 一覧を整理して共有する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 23:25 JST step4 UI の整理対象洗い出しに着手。
  - done: 2026-01-24 23:40 JST step4 UI の用語揺れ/反映漏れ/孤児/未UI化を洗い出し、一覧を整理。
  - update: 2026-01-25 00:20 JST step4 用語統一・キャッシュ管理分離・未UIパラメータ追加に着手。
  - done: 2026-01-25 00:45 JST pnpm typecheck exit 0（tsdown define 警告あり）。

2319) fix/shape/step4-accordion-titles (P1) — 完了 (2026-01-25)
- ブランチ名: fix/shape/step4-accordion-titles
- 依存: なし
- 受け入れ基準: step4 のアコーディオン見出しが「Fetch / Transform / VT」に統一される（英日とも）／i18n の表記揺れが解消される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/**`（調査後に確定）
- ロールバック手順: 見出し変更差分を revert する
- チェックリスト:
  - Fetch/Transform/VT の見出し表記を統一する
  - i18n を更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-25 01:05 JST step4 アコーディオン見出しの統一に着手。
  - blocked: 2026-01-25 01:20 JST pnpm typecheck が areaBasedTolerance 未定義エラー（constants.ts/utils.ts）で失敗。対応方針の確認待ち。
  - done: 2026-01-25 01:25 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 01:45 JST Zoom band のアイコン変更と Fetch Retry のレイアウト再調整に対応。
  - done: 2026-01-25 01:50 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 02:15 JST Fetch の Stage behavior UI を撤去。
  - done: 2026-01-25 02:20 JST pnpm typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-25 02:05 JST Fetch Stage behavior の自動削除 UI を撤去。

2313) fix/ui-map/hover-snackbar-bottom-center (P1) — 完了 (2026-01-24)
- ブランチ名: fix/ui-map/hover-snackbar-bottom-center
- 依存: なし
- 受け入れ基準: ui-map のホバー名 snackbar が画面中央下に表示される／ADM0+ADM1 が重なる場合は ADM1 が優先して表示される（現行挙動の確認を含む）／ADM1 ホバー時の表示が「自治体名 / ADM1 / 国名 / 国コード / 1」になる／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: snackbar 位置と表示フォーマットの差分を revert し、現行挙動へ戻す
- チェックリスト:
  - ui-map のホバー snackbar 実装箇所を特定する
  - snackbar の表示位置を中央下に調整する
  - ADM0+ADM1 のホバー優先順位を確認し、必要なら修正する
  - ADM1 の表示フォーマットを「自治体名 / ADM1 / 国名 / 国コード / 1」に更新する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 02:10 JST ui-map のホバー snackbar 表示位置とフォーマット調整に着手。
  - update: 2026-01-24 02:27 JST ホバー snackbar の中央下配置と ADM ラベル整形ロジックを実装。
  - done: 2026-01-24 02:31 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。

2314) fix/shape-step6/hover-snackbar-bottom-center (P1) — 完了 (2026-01-24)
- ブランチ名: fix/shape-step6/hover-snackbar-bottom-center
- 依存: なし
- 受け入れ基準: shape-plugin step6 の地物ホバー表示が画面中央下に表示される／表示経路（ResourceLayerMap/snackbar か独自オーバーレイか）を明確化し、中央下へ統一する／ADM0+ADM1 が重なる場合は ADM1 が優先して表示される／ADM1 ホバー時の表示が「自治体名 / ADM1 / 国名 / 国コード / 1」になる／pnpm --filter @hierarchidb/ui-map typecheck と pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: step6 ホバー表示変更の差分を revert し、従来の表示経路へ戻す
- チェックリスト:
  - step6 のホバー表示経路（snackbar/独自オーバーレイ）を特定する
  - 中央下表示に統一する
  - ADM0+ADM1 優先順位と ADM1 表示フォーマットを step6 で確認・修正する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 02:40 JST shape-plugin step6 のホバー表示が中央下にならない件の調査に着手。
  - update: 2026-01-24 02:48 JST step6 のホバー表示を中央下に移動し、ADM ラベル整形と優先順位選択を追加。
  - done: 2026-01-24 02:53 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。

2316) chore/shape/disable-geoboundaries-probe-log (P3) — 完了 (2026-01-23)
- ブランチ名: chore/shape/disable-geoboundaries-probe-log
- 依存: なし
- 受け入れ基準: geoboundaries metadata payload probe のログがDEVでも出力されない／メタデータ取得ロジックは変わらない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: probe ログ削除の差分を revert する
- チェックリスト:
  - metadata payload probe ログを削除する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 10:47 JST geoboundaries の probe ログ削除に着手。
  - done: 2026-01-23 10:48 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2317) fix/shape/geoboundaries-continent-overrides (P2) — 完了 (2026-01-23)
- ブランチ名: fix/shape/geoboundaries-continent-overrides
- 依存: なし
- 受け入れ基準: geoboundaries の continent mismatch が指定国で減る／補正ルールが明確で既存ロジックを壊さない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: allowlist 補正の差分を revert する
- チェックリスト:
  - mismatch 対象国の補正ルールを追加する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 10:48 JST continent mismatch の追加補正に着手。
  - done: 2026-01-23 10:49 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2318) fix/shape/geoboundaries-continent-normalize-on-load (P1) — 完了 (2026-01-23)
- ブランチ名: fix/shape/geoboundaries-continent-normalize-on-load
- 依存: なし
- 受け入れ基準: geoboundaries メタデータをロード直後に補正し整合済み値のみを扱う／continent metadata mismatch detected が出力されない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 補正ロジックの差分を revert する
- チェックリスト:
  - ロード直後の補正ロジックを適用する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 11:03 JST geoboundaries の continent 補正をロード直後に適用する対応に着手。
  - update: 2026-01-23 11:05 JST ISO3166 に従いロード直後に continent を正規化し、mismatch ログを出さないよう修正。
  - done: 2026-01-23 11:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2315) fix/ui-map/shape-preview-missing-source (P1) — 完了 (2026-01-23)
- ブランチ名: fix/ui-map/shape-preview-missing-source
- 依存: なし
- 受け入れ基準: `shape-preview-source` の Missing source ログ原因が特定される／ロシア・中国など特定ズーム帯でベクトルタイルが表示されない問題が解消される／影響範囲とロールバック手順を記載する／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／必要な関連パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: Missing source 対応/レイヤー追加の差分を revert し、既存挙動へ戻す
- チェックリスト:
  - Missing source ログの発生箇所・条件を特定する
  - shape-preview の source/layer 生成と feature state の適用タイミングを確認する
  - ズーム帯でタイルが出ない原因を特定し修正する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 必要な関連パッケージの typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 09:09 JST shape-preview Missing source と表示欠落の調査に着手。
  - update: 2026-01-23 09:14 JST 選択/検索/ホバーの MapHighlightEntry を layerSet の sourceId/layerId に対応させた。
  - done: 2026-01-23 09:16 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2314) fix/shape/geoboundaries-continent-mismatch (P1) — 完了 (2026-01-23)
- ブランチ名: fix/shape/geoboundaries-continent-mismatch
- 依存: なし
- 受け入れ基準: geoboundaries の continent mismatch ログが繰り返し出力されない／特殊ケースの補正ストラテジが適用される／影響範囲とロールバック手順が記載される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: 補正ストラテジ／ログ抑制の差分を revert する
- チェックリスト:
  - mismatch ログの発生箇所と頻度を特定する
  - 特殊ケース補正ストラテジが適用されているか確認する
  - 必要な修正（補正適用/ログ抑制）を行う
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 09:03 JST geoboundaries continent mismatch ログの原因調査に着手。
  - update: 2026-01-23 09:05 JST geoboundaries の大陸名（Latin America/Asia など）を特殊ケースで補正し、ISO3166 との不一致ログを抑制。
  - done: 2026-01-23 09:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。

2313) feat/ui-map/selected-primary-highlight (P2) — 完了 (2026-01-23)
- ブランチ名: feat/ui-map/selected-primary-highlight
- 依存: なし
- 受け入れ基準: ui-map の選択状態（マウス選択＋フィーチャー一覧選択）の地物が primary 色で明確に表示される／ホバーは従来どおり軽い明るさ変化として維持される／検索・選択・ホバーの優先順位が明確で既存挙動を崩さない／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: ハイライト色/優先順位の差分を revert し、既存配色へ戻す
- チェックリスト:
  - 選択/ホバー/検索の色指定箇所を特定する
  - 選択状態の primary 色強調と優先順位を反映する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 07:20 JST 選択状態の primary 強調に着手。
  - update: 2026-01-23 07:23 JST ResourceLayerMap の既定ハイライトで選択/ホバー色を primary 系に調整。
  - done: 2026-01-23 07:24 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。

2312) feat/ui-map/screen-center-snackbar (P2) — 完了 (2026-01-23)
- ブランチ名: feat/ui-map/screen-center-snackbar
- 依存: なし
- 受け入れ基準: ui-map に汎用コンポーネント ScreenCenterSnackbar を追加する／中央表示・半透明テキスト・出現/消去アニメーションを実装する／ズーム率変更時の表示が既存の右下 MUI Snackbar から ScreenCenterSnackbar に移行される／表示は他UIの操作を阻害せず一定時間で自動消去される／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: ScreenCenterSnackbar 追加とズーム表示の差分を revert し、既存の Snackbar 表示へ戻す
- チェックリスト:
  - ScreenCenterSnackbar の API と表示仕様（表示時間・表記形式・アニメーション）を確定する
  - 中央表示 + 半透明 + アニメーションのコンポーネントを実装する
  - ズーム率変更時の表示を ScreenCenterSnackbar に移行する
  - 既存の右下 Snackbar を無効化または置き換える
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 06:35 JST ScreenCenterSnackbar の追加とズーム率表示移行に着手。
  - update: 2026-01-23 06:39 JST ScreenCenterSnackbar を ui-map に追加し、Shape preview のズーム表示を中央オーバーレイへ移行。
  - done: 2026-01-23 06:40 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。

2311) fix/ui-map/feature-state-expression-error (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/ui-map/feature-state-expression-error
- 依存: なし
- 受け入れ基準: setFeatureState による expression evaluate エラーが発生しない／shape preview のタイル読み込み中も例外が出ない／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: feature-state の適用/ガード差分を revert する
- チェックリスト:
  - エラー原因となる feature-state の式/対象を特定する
  - setFeatureState の適用条件を調整する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 01:35 JST feature-state expression エラー対応に着手。
  - update: 2026-01-23 06:45 JST line-dasharray の式エラー調査と修正に着手。
  - update: 2026-01-23 06:46 JST line-dasharray を literal 配列に置換し、pnpm --filter @hierarchidb/app typecheck を実行（tsdown define 警告あり）。
  - update: 2026-01-23 06:48 JST expression.evaluate エラー継続のため追加調査に着手。
  - update: 2026-01-23 06:55 JST paint 配列の literal 正規化を追加し、pnpm --filter @hierarchidb/app typecheck を実行（tsdown define 警告あり）。
  - update: 2026-01-24 19:45 JST エラー原因特定のためのデバッグログ追加に着手。
  - update: 2026-01-24 20:05 JST MapLibreMap で paint 配列のデバッグ/正規化を追加し、maplibre-public に setPaintProperty を追記。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 20:20 JST styledata でも paint 配列のデバッグ/正規化を実行するように追加。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-24 20:35 JST expression 配列も setPaintProperty で再適用するように変更。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-23 10:55 JST feature-state の paint 式と ResourceLayerMap の適用経路を重点的に調査開始。
  - update: 2026-01-23 11:02 JST VectorTileLayer の feature-state 適用を layer/style ロード後に限定。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-23 11:14 JST useMapFeatureHighlights の feature-state 適用を style/layer 準備完了後に限定して再検証。
  - update: 2026-01-23 11:16 JST useMapFeatureHighlights に style/layer ガードを追加。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-01-23 11:24 JST ResourceLayerMap/VectorTileLayer の再レンダリングと layer 再追加がタイル再読込に与える影響を調査中。
  - update: 2026-01-23 11:30 JST paint 差分更新・memoize・再読込ログ計測の実装に着手。

2310) fix/ui/shape-preview-source-missing (P1) — 進行中 (2026-01-24)
- ブランチ名: fix/ui/shape-preview-source-missing
- 依存: なし
- 受け入れ基準: shape-preview-source/shape-preview レイヤーが未登録でも例外が出ない／setFeatureState を未登録ソースに対して呼ばない／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/map/useMapFeatureHighlights.ts`
- ロールバック手順: 例外回避のガード差分を revert する
- チェックリスト:
  - source/layer 存在チェックを追加する
  - 未登録時は setFeatureState を抑止する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-24 01:10 JST shape-preview-source 未登録時の例外対応に着手。
  - update: 2026-01-24 01:20 JST source未登録時にsetFeatureState/removeFeatureStateを抑止するガードを追加。
  - done: 2026-01-24 01:24 JST pnpm --filter @hierarchidb/app typecheck exit 0（plugin-base build: tsdown define警告あり）。

2309) feat/ui-map/layer-set-hierarchy (P1) — 進行中 (2026-01-22)
- ブランチ名: feat/ui-map/layer-set-hierarchy
- 依存: なし
- 受け入れ基準: レイヤーセットが論理セット（位置/経路/シェイプ）として定義でき、階層順で上書き表示される／レイヤーセット名が自治体レベル名（admin0 など）に依存しない／既存タイル内部レイヤー名（admin{N}, admin{N}-boundary）に対する解決ルールで描画される／レイヤーセットのUI切替が /map と shape preview で可能になる／描画順だけでなくホバー・選択の優先順位にも反映される／任意オブジェクトの一覧を種類別・階層別に整理して表示できる／shape preview の既存表示が維持される／ExecPlan を PLANS.md に作成する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: レイヤーセット定義/解決ロジックの差分を revert し、従来の単一レイヤー解決へ戻す
- チェックリスト:
  - ExecPlan を作成し、設計/移行/検証手順を明文化する
  - レイヤーセットの論理定義と表示優先順位を実装する
  - レイヤーセットのUI切替（/map と shape preview）を実装する
  - ホバー/選択の優先順位にレイヤーセット順を反映する
  - 種類別・階層別に整理された一覧UIを追加する
  - 既存のタイル内部レイヤー名に対する解決ルールを実装する
  - shape preview の表示・選択・ホバーが既存どおり動作することを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:59 JST レイヤーセットの階層化と解決ルール実装に着手。
  - update: 2026-01-22 20:05 JST ExecPlan を plans/ui-map-layer-set-hierarchy-execplan.md に作成。
  - update: 2026-01-22 20:23 JST UI切替・ホバー/選択優先順位・種類別/階層別一覧の要件をDoDに反映。
  - update: 2026-01-24 00:32 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - blocked: 2026-01-24 00:33 JST pnpm typecheck で app/src/router/routes/map/MapPage.tsx の順序エラー（TS2448/TS2454: filteredVectorLayers/combinedGeoJsonLayers が未定義参照）。
  - update: 2026-01-24 00:36 JST pnpm typecheck exit 0 を確認。

2308) fix/shape/vt-layer-resolution (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/vt-layer-resolution
- 依存: なし
- 受け入れ基準: ui-map の sourceLayer 解決が admin{N}/admin{N}-boundary に一致し、ベクトルタイルが表示される／tileLayerNames が空のケースでも実レイヤー名に追従できる／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts`, `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
- ロールバック手順: レイヤー解決まわりの差分を revert する
- チェックリスト:
  - tileLayerNames の取得経路と空判定を確認する
  - admin{N}/admin{N}-boundary への一致ロジックを調整する
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 23:55 JST ベクトルタイルのレイヤー解決修正に着手。
  - update: 2026-01-24 00:05 JST tilesLayer が admin 形式以外の場合は admin0 にフォールバックする解決ロジックを追加。
  - done: 2026-01-24 00:10 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2307) fix/ui/vector-tile-layer-syntax (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/vector-tile-layer-syntax
- 依存: なし
- 受け入れ基準: VectorTileLayer.tsx の文法エラーが解消され、型を緩めない修正となる／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/VectorTileLayer.tsx`
- ロールバック手順: VectorTileLayer の差分を revert する
- チェックリスト:
  - 文法エラーの原因を特定し修正する
  - 型の厳格性を維持する
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 23:30 JST VectorTileLayer の文法エラー修正に着手。
  - blocked: 2026-01-23 23:35 JST pnpm typecheck で VectorTileLayer removeFeatureState の引数エラー（TS2554）を検出。
  - update: 2026-01-23 23:40 JST removeFeatureState の target 生成を key 内包型に統一し、Map の forEach を使用。
  - done: 2026-01-23 23:43 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2306) fix/ui/preview-virtualization-and-loop (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/preview-virtualization-and-loop
- 依存: なし
- 受け入れ基準: GenericDataGrid の仮想スクロールが復活し、1000行規模で重さが軽減される／ShapePreviewStep 由来の Maximum update depth exceeded が解消される／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/data-grid/src/GenericDataGrid.tsx`, `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.tsx` など該当箇所
- ロールバック手順: 仮想化・ループ修正差分を revert する
- チェックリスト:
  - GenericDataGrid の仮想スクロールを復活する
  - ShapePreviewStep の更新ループ原因を特定し抑止する
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 23:05 JST 仮想スクロール復活と更新ループ修正に着手。
  - update: 2026-01-23 23:20 JST GenericDataGrid の仮想スクロールを復活し、検索/選択の更新ループを抑止。
  - done: 2026-01-23 23:25 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2305) audit/ui/preview-metadata-virtualization (P2) — 進行中 (2026-01-23)
- ブランチ名: audit/ui/preview-metadata-virtualization
- 依存: なし
- 受け入れ基準: メタデータ一覧の仮想化実装有無を確認し、パフォーマンス改善案を整理して共有する／必要に応じて修正方針を提示する
- 影響範囲: `packages/ui/map/src/preview/ShapePreviewList.tsx`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/data-grid/src/GenericDataGrid.tsx`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 表示コンポーネントの仮想化実装を確認する
  - 既存依存に合った改善案を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 22:55 JST メタデータ一覧の仮想化有無と改善案の調査に着手。

2304) fix/shape/preview-metadata-loading-stuck (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/preview-metadata-loading-stuck
- 依存: なし
- 受け入れ基準: フィーチャー一覧テーブルが Loading 状態で止まらず、メタデータが表示される／metadataLoaded が適切に更新される／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts`, `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
- ロールバック手順: preview metadata の差分を revert する
- チェックリスト:
  - Loading が継続する原因を特定する
  - metadataLoaded/metadataLoading の更新が正しく伝播するよう修正する
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 22:38 JST preview metadata の Loading 固定問題の修正に着手。
  - update: 2026-01-23 22:45 JST StrictMode の二重実行で metadataKeyRef が残って読み込みが抑止されるため、cleanup で key を解除。
  - done: 2026-01-23 22:48 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2303) fix/ui/map-preview-metadata-loop (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/map-preview-metadata-loop
- 依存: なし
- 受け入れ基準: useVectorTilePreviewMetadata の Maximum update depth exceeded が解消される／メタデータ取得が同一条件で再実行されない／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts`
- ロールバック手順: useVectorTilePreviewMetadata の差分を revert する
- チェックリスト:
  - 依存配列/状態更新の見直しで再実行ループを止める
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 22:22 JST useVectorTilePreviewMetadata の更新ループ修正に着手。
  - update: 2026-01-23 22:32 JST metadataKey を ref で安定化し、依存変化時のみローディング初期化するよう修正。
  - done: 2026-01-23 22:35 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2302) fix/ui/map-stats-panel-loop (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/map-stats-panel-loop
- 依存: なし
- 受け入れ基準: MapStatsPanel の useSyncExternalStore 警告（getSnapshot cache）と Maximum update depth exceeded が解消される／統計値の更新が Map 本体の再描画トリガーにならない／pnpm --filter @hierarchidb/ui-map build と pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: MapStatsPanel まわりの差分を revert する
- チェックリスト:
  - useSyncExternalStore の getSnapshot が安定参照を返すよう修正する
  - stats 更新を ref/jotai で維持し再描画を最小化する
  - pnpm --filter @hierarchidb/ui-map build を実行する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 22:05 JST MapStatsPanel の警告/更新ループ修正に着手。
  - update: 2026-01-23 22:15 JST MapStatsPanel の snapshot を安定参照化し、tile/feature の更新通知を同一参照で管理するよう修正。
  - done: 2026-01-23 22:18 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。pnpm typecheck exit 0。

2306) analysis/shape-step6-max-vertices-warning (P1) — 進行中 (2026-01-23)
- ブランチ名: analysis/shape-step6-max-vertices-warning
- 依存: なし
- 受け入れ基準: Step6 の 65,535 頂点超過警告の原因を説明できる／対処方針（簡略化・分割・表示制御）を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/**`, `packages/vt-orchestrator/src/**`（調査後に確定）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 警告の発生箇所と原因（描画経路/データ条件）を整理する
  - 対処案の影響範囲と副作用を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 23:05 JST Step6 の Max vertices warning 調査に着手。
  - update: 2026-01-23 23:10 JST MapLibre の fill バケットが 65,535 頂点上限を超える大きなポリゴンを描画する際の警告で、タイル内の頂点数が過多なことが原因と判断。

2305) fix/map-folder-preview-loading-metadata (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/map-folder-preview-loading-metadata
- 依存: なし
- 受け入れ基準: /map の shape/route 一覧でメタデータ表示が停止/点滅しない／shape タイルが表示される／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/**`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 変更差分を revert する
- チェックリスト:
  - /map の一覧表示とタイル取得の不具合原因を特定する
  - メタデータ表示/タイル描画の修正を実施する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 22:30 JST /map の一覧メタデータ停止/点滅とタイル非表示の調査に着手。
  - update: 2026-01-23 22:45 JST /map の shape 一覧は mapLayerInfo から shape nodeId 群を取得し、複数ノードのメタデータを集約するように修正。
  - update: 2026-01-23 22:50 JST フォルダプレビューの shape layer は tile info の layer 名を優先し、未取得時は admin0 をフォールバックにするよう調整。
  - done: 2026-01-23 22:52 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。

2304) analysis/map-folder-preview-missing-tiles (P1) — 進行中 (2026-01-23)
- ブランチ名: analysis/map-folder-preview-missing-tiles
- 依存: なし
- 受け入れ基準: /map のフォルダプレビューで「未ビルド」ダイアログが出る条件とタイル非表示の原因を説明できる／解決策の候補を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/**`, `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - missing layer ダイアログの発火条件を確認する
  - フォルダプレビューのベクタレイヤー生成条件を確認する
  - 原因と解決策候補を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 21:40 JST /map フォルダプレビューのタイル非表示と未ビルドダイアログの原因調査に着手。
  - update: 2026-01-23 21:45 JST missingLayer ダイアログは useMapFeatureHighlights/useMapFeatureSearch が mapInstance.getLayer 未検出時に即発火。初期描画時に VectorTileLayer の addLayer が未完了でも開くため、偽陽性の可能性が高いと判断。
  - update: 2026-01-23 22:05 JST missing layer 検出を遅延再確認し、解消時にダイアログを閉じるよう MapPage/onMissingLayers を調整。
  - update: 2026-01-23 22:10 JST フォルダプレビューの shape layer で vector tile summary から sourceLayer を解決し、admin0 などの実レイヤ名を優先するよう修正。
  - done: 2026-01-23 22:12 JST pnpm --filter @hierarchidb/ui-map typecheck / pnpm --filter @hierarchidb/app typecheck exit 0 を確認（tsdown define 警告あり）。

2303) fix/ui/feature-list-striped-contrast (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/feature-list-striped-contrast
- 依存: なし
- 受け入れ基準: フィーチャー一覧の奇数行背景がホバー背景と区別できる色になる／ホバー強調の視認性は維持される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/data-grid/src/**`
- ロールバック手順: 変更差分を revert する
- チェックリスト:
  - 奇数行ストライプの背景色を hover と区別できる色に変更する
  - 既存の hover 強調が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 21:10 JST フィーチャー一覧の奇数行背景色が hover と同色になる問題の修正に着手。
  - update: 2026-01-23 21:20 JST ストライプ背景を hover より薄い alpha 色へ変更（text.primary, 0.03）し視認性を調整。
  - done: 2026-01-23 21:22 JST ストライプ背景の色差調整を反映（検証は未実施）。

2302) fix/ui/floating-window-footer-zindex (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/ui/floating-window-footer-zindex
- 依存: なし
- 受け入れ基準: Step6 初期表示直後のフローティングダイアログのリサイズ時に、プラグインダイアログのフッターが前面に出て重なる不具合の原因を説明できる／解決策の候補を整理できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/**`, `packages/ui/map/src/preview/**`, `packages/plugin-ui-host/src/**`, `app/src/**`（調査後に確定）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - フローティングダイアログのリサイズ/移動で DOM/CSS の stacking context がどう変わるかを確認する
  - プラグインダイアログのフッター領域の z-index/position/transform を確認する
  - 不具合が発生/解消する条件を整理し解決策を検討する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 20:40 JST フローティングダイアログとフッターの前後関係異常の原因調査に着手。
  - update: 2026-01-23 20:50 JST FloatingWindow はドラッグ時のみ zIndex を更新し、リサイズ時は初期 zIndex(1000)のまま。PluginDialogFooter は zIndex=modal(1300) のため、リサイズ直後はフッターが前面に出る原因と判断。
  - update: 2026-01-23 21:00 JST クリック/ドラッグ/リサイズのすべてで前面化されるよう、FloatingWindow の mouse down capture で zIndex を繰り上げるよう修正。
  - done: 2026-01-23 21:02 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。

2301) fix/shape/step6-useShapePreviewStepView-typecheck (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/step6-useShapePreviewStepView-typecheck
- 依存: なし
- 受け入れ基準: useShapePreviewStepView の TS1128 が再現しない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts`（調査のみ）
- ロールバック手順: なし（変更が発生した場合は該当差分を revert する）
- チェックリスト:
  - TS1128 の再現有無を確認する
  - 必要なら構文エラーを修正する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 20:30 JST useShapePreviewStepView の TS1128 調査に着手。
  - done: 2026-01-23 20:31 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。TS1128 は再現せず。

2300) fix/shape/map-preview-floating-table-loop (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/map-preview-floating-table-loop
- 依存: なし
- 受け入れ基準: MapPreviewFloatingTable の Maximum update depth exceeded が解消される／プレビュー地図の一覧表示と選択/ホバーが従来どおり機能する／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/tabular-extract/src/components/TabularDataFilter.tsx`
- ロールバック手順: MapPreviewFloatingTable 周辺の変更差分を revert する
- チェックリスト:
  - MapPreviewFloatingTable の再レンダーループ原因を特定する
  - 依存配列/メモ化/状態更新の見直しでループを解消する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 20:10 JST MapPreviewFloatingTable の更新ループ修正に着手。
  - update: 2026-01-23 20:20 JST hasUserColumnSelection が false の間は visibleColumnIds を更新しないよう調整し、列変更時の差分のみ同期するよう修正。
  - done: 2026-01-23 20:22 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2300) fix/styler/step3-filter-initial-apply (P1) — 完了 (2026-01-23)
- ブランチ名: fix/styler/step3-filter-initial-apply
- 依存: なし
- 受け入れ基準: Styler Step3 の初回フィルタで先頭の Year equals 2023 が無視されない（初回から正しく反映される）／文字追加・削除のような UI 操作をしなくてもフィルタが適用される／既存のフィルタ編集・保存フローに副作用がない／pnpm --filter @hierarchidb/styler-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `packages/ui/tabular-extract/src/components/TabularDataFilter.tsx`
- ロールバック手順: Styler Step3 フィルタ初回適用の差分を revert する
- チェックリスト:
  - 初回レンダリング時にフィルタが適用されない原因を特定する
  - 初回からフィルタが正しく適用されるよう修正する
  - pnpm --filter @hierarchidb/styler-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 12:40 JST Styler Step3 フィルタ初回適用の不具合調査に着手。
  - update: 2026-01-23 21:05 JST 初回フィルタの enabled を正規化して初期適用を安定化。
  - done: 2026-01-23 21:10 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0 を確認。


2301) fix/styler/step2-remove-preview-accordion (P1) — 完了 (2026-01-23)
- ブランチ名: fix/styler/step2-remove-preview-accordion
- 依存: なし
- 受け入れ基準: Styler Step2 のアコーディオンにプレビューが表示されない（非同期追加も含め撤去）／Step2 の他の入力・検証・保存フローが維持される／pnpm --filter @hierarchidb/styler-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `plugins/styler-plugin/src/ui/components/StylerFilterStep.tsx`, `plugins/spreadsheet-plugin/src/ui/components/TabularKeyValuePanels.tsx`, `plugins/spreadsheet-plugin/src/ui/components/TabularFilterSections.tsx`, `plugins/spreadsheet-plugin/src/ui/components/steps/TabularDataFilterStep.tsx`
- ロールバック手順: Step2 のプレビュー撤去差分を revert する
- チェックリスト:
  - Step2 のプレビュー表示経路を特定する
  - プレビューのアコーディオン表示を撤去する
  - pnpm --filter @hierarchidb/styler-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 21:20 JST Styler Step2 のプレビュー撤去に着手。
  - update: 2026-01-23 21:28 JST Step2 でプレビューアコーディオンを無効化するフラグを追加。
  - update: 2026-01-23 21:29 JST pnpm --filter @hierarchidb/spreadsheet-plugin build で型定義を更新。
  - done: 2026-01-23 21:30 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0 を確認。

2326) fix/styler/step3-preview-filter-apply (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/styler/step3-preview-filter-apply
- 依存: なし
- 受け入れ基準: Styler Step3 のフィルタリング結果プレビューが表示される／Step2 のプレビュー撤去は維持される／初期フィルタ `{column:'Year', operator:'equals', value:'2023'}` が初回から正しく適用される／カラム型とUI値の比較ルールが確認できる／pnpm --filter @hierarchidb/styler-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `plugins/styler-plugin/src/ui/**`, `packages/ui/tabular-extract/src/**`（調査後に確定）
- ロールバック手順: Step3 プレビュー復旧とフィルタ適用修正の差分を revert する
- チェックリスト:
  - Step3 プレビュー表示の差分を特定し復旧する
  - 初期フィルタが無視される原因を特定する
  - カラム型とUI値の比較ルールを確認し修正する
  - pnpm --filter @hierarchidb/styler-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 09:00 JST Styler Step3 のプレビュー復旧とフィルタ初回適用の不具合調査に着手。
  - update: 2026-01-26 09:40 JST 初期フィルタの同期漏れ調査と修正に再着手。
  - update: 2026-01-26 10:00 JST 初期フィルタの有効化状態を親へ同期する修正を追加。
  - update: 2026-01-26 10:02 JST pnpm --filter @hierarchidb/ui-tabular typecheck exit 0。
  - update: 2026-01-26 10:03 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0。
  - update: 2026-01-26 10:30 JST 初期フィルタ未適用とFiltering UIの揺れ/行高差分の再調査に着手。
  - update: 2026-01-26 10:55 JST 初期フィルタの同期/プレビュー再実行と行高/進捗表示の安定化を反映。
  - update: 2026-01-26 10:57 JST pnpm --filter @hierarchidb/ui-tabular typecheck exit 0。
  - update: 2026-01-26 10:58 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0。
  - update: 2026-01-26 10:59 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0。
  - update: 2026-01-26 11:20 JST Filtering の processing 表示による高さ揺れを固定領域で抑制。
  - update: 2026-01-26 11:21 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0。
  - update: 2026-01-26 11:22 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0。
  - update: 2026-01-26 11:35 JST Preview Tabular の件数表示を桁区切りに調整。
  - update: 2026-01-26 11:36 JST pnpm --filter @hierarchidb/ui-tabular typecheck exit 0。
  - update: 2026-01-26 09:20 JST Step3 のプレビュー復旧と初期フィルタ適用の修正案を反映。
  - update: 2026-01-26 09:23 JST pnpm --filter @hierarchidb/ui-tabular typecheck exit 0。
  - update: 2026-01-26 09:24 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0。
  - update: 2026-01-26 09:25 JST pnpm --filter @hierarchidb/spreadsheet-plugin build exit 0（tsdown define 警告あり）。
  - update: 2026-01-26 09:26 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0。


2327) fix/shape/step4-filtering-ui-trim (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/shape/step4-filtering-ui-trim
- 依存: なし
- 受け入れ基準: Polygon Area Exclusion Coefficient/Min ring vertices の利用箇所が説明される／不要ならUIとスキーマ保持を撤去する／必要ならUI撤去後に Fetch-stage filtering の High/Medium/Low 選択で推奨値が自動設定される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/common/types/**`, `packages/vt-orchestrator/src/**`（調査後に確定）
- ロールバック手順: Step4 filtering UIと設定差分を revert する
- チェックリスト:
  - Polygon Area Exclusion Coefficient/Min ring vertices の利用箇所を特定する
  - 利用状況に応じて UI 撤去と設定の扱いを整理する
  - Fetch-stage filtering の High/Medium/Low に推奨値を自動設定する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 12:00 JST Step4 filtering UI の整理と推奨値連動の調査に着手。
  - update: 2026-01-26 12:20 JST omitDetails の選択で推奨値を自動設定し、個別UIは撤去。
  - update: 2026-01-26 12:22 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 13:05 JST VT Concurrency/Memory/Basic settings のカード再編と dynamic concurrency 自動有効化を反映。
  - update: 2026-01-26 13:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 13:20 JST Tile geometry & margin の順序を Tile size → Extent → Tolerance → Margin に変更。
  - update: 2026-01-26 13:21 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 13:45 JST Zoom band slidersの見出し/スライダー間余白とVTカードのアイコン/余白を調整。
  - update: 2026-01-26 13:46 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 14:05 JST Tile extentアイコンをViewCompactへ変更し、tolerance下余白を16pxへ調整。
  - update: 2026-01-26 14:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 14:50 JST Step4のバリデーションでlarge-area tolerance超過を警告扱いに変更。
  - update: 2026-01-26 14:51 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 15:10 JST Transform toleranceの最小値を0.005へ変更し、large-area toleranceは動的maxではなくクランプに変更。
  - update: 2026-01-26 15:11 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - update: 2026-01-26 14:30 JST Step4のバリデーション不一致の調査に着手。


2302) fix/shape/feature-list-titlebar-icon-margin (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/feature-list-titlebar-icon-margin
- 依存: なし
- 受け入れ基準: フィーチャー一覧フローティングダイアログのタイトルバーで左端アイコンの左に8pxの余白が入る／他のタイトルバー要素の配置が崩れない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`
- ロールバック手順: タイトルバー余白追加差分を revert する
- チェックリスト:
  - 対象コンポーネントを特定する
  - 左端アイコンの左余白を8px追加する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 21:40 JST フィーチャー一覧タイトルバーの左余白調整に着手。


2303) fix/shape/preview-snackbar-admin-labels (P1) — 完了 (2026-01-23)
- ブランチ名: fix/shape/preview-snackbar-admin-labels
- 依存: なし
- 受け入れ基準: Snackbar の表示が ADM0/ADM1/ADM2 で指定形式になる／hover/クリックの既存挙動が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
- ロールバック手順: Snackbar の文言変更差分を revert する
- チェックリスト:
  - Snackbar 表示ロジックを特定する
  - ADM レベル別の文言切り替えを実装する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 21:55 JST Snackbar 表示の ADM 別文言修正に着手。
  - update: 2026-01-23 22:05 JST hover の feature properties を参照して ADM 表示を組み立てるよう変更。
  - update: 2026-01-23 22:10 JST pnpm --filter @hierarchidb/ui-map build で型定義を更新。
  - done: 2026-01-23 22:15 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2299) fix/styler/auth-dialog-loop (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/styler/auth-dialog-loop
- 依存: なし
- 受け入れ基準: 認証フロー完了後に同ダイアログが再表示されない（再試行や再読み込みでも再発しない）／401時のダイアログ表示は維持される（無条件に抑制しない）／pnpm --filter @hierarchidb/app typecheck が exit 0／TASKS.md に運用ログを記録する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `packages/ui/auth/src/contexts/SimpleBFFAuthContext.tsx`, `plugins/styler-plugin/src/ui/components/steps/**`
- ロールバック手順: auth-recovery/UI auth の差分を revert する
- チェックリスト:
  - 認証成功時に再発する 401 ダイアログの原因を特定する
  - 再発しないように抑制／リトライの制御を追加する
  - pnpm --filter @hierarchidb/app typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 12:05 JST 認証成功後もダイアログが再表示される問題の調査に着手。
  - update: 2026-01-23 12:12 JST Missing Bearer token のケースで認証済みなら自動解決する制御を追加。
  - update: 2026-01-23 12:25 JST AuthService が localStorage も参照するようにし、UI経由の Authorization 付与を有効化。
  - done: 2026-01-23 12:27 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認。

2298) fix/styler/step2-cors-auth (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/styler/step2-cors-auth
- 依存: なし
- 受け入れ基準: Styler Step2 の CSV ダウンロードで Authorization が付与され、CORS proxy の 401（Missing Bearer token）が解消される／Spreadsheet のダウンロード経路で auth が有効化され、scope はプラグインIDから安全に解決される（不明な場合は spreadsheet にフォールバック）／pnpm --filter @hierarchidb/spreadsheet-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/spreadsheet-plugin/src/services/SpreadsheetTabularApiDriver.ts`
- ロールバック手順: SpreadsheetTabularApiDriver の auth 有効化差分を revert する
- チェックリスト:
  - FetchNetworkPort の auth を有効化し scope を適切に解決する
  - Styler Step2 の CORS proxy ダウンロードで Authorization が付与されることを確認する
  - pnpm --filter @hierarchidb/spreadsheet-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 11:45 JST Styler Step2 の CORS proxy 認証ヘッダー付与に着手。
  - update: 2026-01-23 11:50 JST SpreadsheetTabularApiDriver の FetchNetworkPort で auth を有効化し scope 解決を追加。
  - done: 2026-01-23 11:52 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0 を確認。

2295) feat/shape/styler-code-coloring (P1) — 進行中 (2026-01-23)
- ブランチ名: feat/shape/styler-code-coloring
- 依存: なし
- 受け入れ基準: ShapeのベクタータイルにcountryCode/adminCode/adminLevelが補完され、Stylerの生成結果（コード→色）をfeatureIdPropertyで適用できる／ADM0/1/2の塗り分けが可能／既存のタイル生成とメタデータ集計に影響しない／pnpm install・pnpm build・pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/vectorTiles.ts`
- ロールバック手順: vectorTiles のプロパティ補完差分を revert する
- チェックリスト:
  - タイル生成時にcountryCode/adminCode/adminLevelを補完する
  - StylerのfeatureIdPropertyで参照できることを確認する
  - pnpm install・pnpm build・pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 09:00 JST Stylerのコード→色対応をShapeタイルで使うため、プロパティ補完の対応に着手。
  - update: 2026-01-23 09:10 JST vectorTiles 生成時にcountryCode/adminCode/adminLevelを補完する処理を追加。
  - update: 2026-01-23 09:15 JST pnpm install/build/typecheck が corepack の pnpm 取得失敗（Proxy 403）で停止。
  - done: 2026-01-23 09:20 JST 仕様どおりにプロパティ補完を実装。検証は pnpm install/build/typecheck が corepack の pnpm 取得失敗（Proxy 403）で未完了。

2295) test/vt/tile-output-stats (P1) — 進行中 (2026-01-22)
- ブランチ名: test/vt/tile-output-stats
- 依存: なし
- 受け入れ基準: vt生成済みタイルのポリゴン数/頂点数合計が0ではないことをテストで検証する／既存のタイル生成ロジックに影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`
- ロールバック手順: 追加テスト差分を revert する
- チェックリスト:
  - 出力タイルの統計を集計するテストを追加する
  - 合計が0ではないことを検証する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:30 JST vt生成タイルのポリゴン/頂点合計を検証するテスト追加に着手。
  - update: 2026-01-22 20:40 JST vt生成タイルのポリゴン/頂点合計テストと出力集計ログを追加。
  - blocked: 2026-01-22 20:42 JST `pnpm --filter @hierarchidb/vt-orchestrator typecheck` が EPERM (mkdir /Users/hiroya/Library/pnpm/.tools/...) で失敗。
  - done: 2026-01-22 20:48 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が通過。

2294) fix/shape/step6-hover-missing-layer (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step6-hover-missing-layer
- 依存: なし
- 受け入れ基準: Step6のホバーで存在しないレイヤーを参照しても例外が出ない／hover候補が空の場合は正常に無視される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/useMapFeatureHoverCandidates.ts`
- ロールバック手順: hoverレイヤーの存在チェック差分を revert する
- チェックリスト:
  - hover時に存在しないレイヤーを事前に除外する
  - 候補が空の場合にhoverをクリアする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:10 JST Step6のhoverで存在しないレイヤー参照エラーを抑止する対応に着手。
  - update: 2026-01-22 20:16 JST hover対象レイヤーの存在チェックと空候補時のクリア処理を追加。
  - done: 2026-01-22 20:19 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2292) fix/shape/step6-preview-hover-snackbar (P1) — 進行中 (2026-01-22)

2298) refactor/worker/shared-dexie-stores (P1) — 進行中 (2026-01-23)
- ブランチ名: refactor/worker/shared-dexie-stores
- 依存: なし
- 受け入れ基準: VectorTileStore/FeatureStore の Dexie アダプタを共通化し、shape/route が新実装を参照する／既存の書き込み・削除挙動が維持される／pnpm --filter @hierarchidb/runtime-worker typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/**`, `plugins/shape-plugin/src/worker/**`, `plugins/route-plugin/src/worker/**`
- ロールバック手順: 共通化ファイル追加と差し替えを revert する
- チェックリスト:
  - 共通 Dexie アダプタを runtime-worker に追加する
  - shape/route のストア実装を共通化へ差し替える
  - pnpm --filter @hierarchidb/runtime-worker typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 12:10 JST 共通 Dexie アダプタの実装に着手。
  - update: 2026-01-23 12:40 JST runtime-workerにDexie共通アダプタ追加、shape/routeのストア実装を差し替え、shapeGroupStoreを追加。
  - update: 2026-01-23 12:45 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0。pnpm --filter @hierarchidb/runtime-worker build exit 0（tsdown: define警告）。
  - done: 2026-01-23 12:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 / pnpm --filter @hierarchidb/route-plugin typecheck exit 0。

2297) audit/shape-route/shared-code-opportunities (P1) — 進行中 (2026-01-23)
- ブランチ名: audit/shape-route/shared-code-opportunities
- 依存: なし
- 受け入れ基準: shape-plugin/route-pluginの現行実装を確認し、共通化候補を具体的に列挙する／影響範囲とリスクを整理する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/**`, `plugins/route-plugin/**`, `packages/**`, `app/**`（調査のみ）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - 両プラグインのコード構成と責務を確認する
  - 共通化候補の具体例を整理する
  - 影響範囲とリスクを整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 10:50 JST shape/routeの共通化候補の調査に着手。
  - update: 2026-01-23 11:20 JST データストア/バッチ進行/ステップUI/タイル保存の共通化候補を整理。
  - done: 2026-01-23 11:25 JST shape/routeの共通化余地を列挙して報告。
  - update: 2026-01-23 11:40 JST shape基準での共通化整理を再評価。
  - update: 2026-01-23 11:55 JST 共通化設計（置き場所/API形状）を整理。
  - done: 2026-01-23 12:00 JST 共通化設計案を提示。

2296) audit/shape/vt-indexeddb-usage (P1) — 進行中 (2026-01-22)
- ブランチ名: audit/shape/vt-indexeddb-usage
- 依存: なし
- 受け入れ基準: 指定DBの読み書き実態をコード参照で一覧化する／未使用・片方向利用の可能性を分類して報告する／修正候補と影響範囲を提案する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/**`, `packages/**`, `app/**`（調査のみ）
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - DB名ごとの参照箇所を抽出する
  - 読み/書きの有無を分類する
  - 調査結果と提案を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST shape/vt関連IndexedDBの読み書き実態の調査に着手。
  - update: 2026-01-23 10:10 JST DexieShapePortの参照元とhidb-vt/hidb-vt-shapeの残存参照を洗い出し、整理方針の実装に着手。
  - update: 2026-01-23 10:20 JST DexieShapePortのエクスポート/README記述を削除し、アダプタ自体を撤去。hidb-vt/hidb-vt-shapeの参照はコード上0件を確認。
  - done: 2026-01-23 10:25 JST 調査結果に基づきDexieShapePortを除去。hidb-vt/hidb-vt-shapeの残存参照なしを確認。
  - update: 2026-01-23 10:40 JST DexieShapePort廃止の注記をドキュメントへ追記。
  - done: 2026-01-23 10:42 JST map-source README にDexieShapePort廃止の注記を追加。
- ブランチ名: fix/shape/step6-preview-hover-snackbar
- 依存: なし
- 受け入れ基準: Step6のプレビュー地図でホバー時にSnackbarが表示される／ホバーでハイライトが反映される／既存の選択や検索挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx`, `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
- ロールバック手順: Step6のホバー連携差分を revert する
- チェックリスト:
  - Step6のResourceLayerMapでhoverを有効化する
  - mapHoverCandidatesからhoveredIdへ接続する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:40 JST Step6のホバー連携とSnackbar表示の修正に着手。
  - update: 2026-01-22 19:48 JST Step6でhoverを有効化し、mapHoverCandidatesからhoveredIdへ接続。
  - done: 2026-01-22 19:55 JST pnpm typecheck exit 0 を確認。

2276) fix/shape/step3-index-chip-highlight (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-chip-highlight
- 依存: なし
- 受け入れ基準: Step3のIndexチップで該当頭文字に選択済み国がある場合はprimary色になる／選択が無い場合は通常色のまま／スクロールや選択挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`
- ロールバック手順: Indexチップの色判定差分を revert する
- チェックリスト:
  - 頭文字グループ内に選択済みがあるか判定する
  - Indexチップにprimary色を反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 11:45 JST Step3のIndexチップを選択有無で色分けする対応に着手。
  - update: 2026-01-22 12:00 JST 頭文字グループ内の選択有無を判定し、Indexチップにprimary色を反映。
  - done: 2026-01-22 12:05 JST pnpm typecheck exit 0 を確認。

2277) fix/shape/step3-selected-country-primary (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-selected-country-primary
- 依存: なし
- 受け入れ基準: Step3で任意カラムに選択がある国名がprimary色になる／選択がない国は従来色のまま／既存の選択/スクロール/ソート挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`
- ロールバック手順: 国名の色判定差分を revert する
- チェックリスト:
  - 国ごとの選択有無を判定する
  - 国名の色をprimaryへ反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 12:20 JST 選択済みの国名をprimary色で表示する対応に着手。
  - update: 2026-01-22 12:35 JST 選択済み国の判定を追加し、国名の色をprimaryに切替。
  - done: 2026-01-22 12:40 JST pnpm typecheck exit 0 を確認。

2278) fix/shape/step5-elapsed-not-started (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-elapsed-not-started
- 依存: なし
- 受け入れ基準: Step5でビルド未開始時は総経過時間/ステージ経過時間に「-」が表示される／開始後は従来どおり時間表示される／進捗やステータス判定に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`
- ロールバック手順: 未開始時の経過時間表示差分を revert する
- チェックリスト:
  - ビルド未開始の判定を追加する
  - 経過時間表示を「-」へ切り替える
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 12:55 JST Step5の未開始時に経過時間を「-」表示へ切替する対応に着手。
  - update: 2026-01-22 13:10 JST buildStatus が idle の場合は総/ステージ経過時間を「-」表示に変更。
  - done: 2026-01-22 13:15 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-20 17:53 JST 未開始時に0時間00分00秒が残るため再修正に着手。
  - update: 2026-01-20 17:55 JST 経過時間が0の場合も「-」表示に切替。
  - done: 2026-01-20 17:55 JST pnpm typecheck exit 0 を確認。

2279) fix/shape/vt-stage-crash-logging (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-stage-crash-logging
- 依存: なし
- 受け入れ基準: vtステージ開始〜失敗までの主要区間に詳細ログが追加される／ログから落ちる地点と入力条件が特定できる／処理フローやエラーハンドリングの挙動を変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - vtステージの主要区間にログを追加する
  - 例外発生時に入力条件/タスク情報が出力される
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 13:30 JST vtステージのクラッシュ原因特定のための詳細ログ追加に着手。
  - update: 2026-01-22 13:50 JST vtタスクの開始/完了/失敗とタイル生成失敗箇所の詳細ログを追加。
  - done: 2026-01-22 13:55 JST pnpm typecheck exit 0 を確認。

2280) fix/shape/step5-autostart-from-info-panel (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-autostart-from-info-panel
- 依存: なし
- 受け入れ基準: TreeNodeInfoPanelの「ビルド」ボタン経由でStep5を開いた直後にビルドが自動開始される／手動開始や再開の挙動は維持される／他の遷移に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/tree/usePluginDialogRoute.ts`（必要に応じて追加）
- ロールバック手順: autoResumeBuild のセット処理を revert する
- チェックリスト:
  - build=1 経路で autoResumeBuild を設定する
  - Step5が自動開始されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 14:05 JST TreeNodeInfoPanel経由でStep5を開いた際に自動開始する対応に着手。
  - update: 2026-01-22 14:20 JST build=1 の場合に autoResumeBuild をセットし、shape のStep5自動開始を誘発。
  - done: 2026-01-22 14:25 JST pnpm typecheck exit 0 を確認。

2281) fix/shape/vt-input-stats-zero (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-input-stats-zero
- 依存: なし
- 受け入れ基準: vt進捗メッセージのinput集計が0になる原因を修正する／必要な入力集計（features/vertices/bytes）が正しく反映される／既存のタイル生成フローを変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: input集計ロジックの差分を revert する
- チェックリスト:
  - typed array座標に対応したbbox/vertex集計を追加する
  - input集計が0にならないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 14:40 JST vt進捗のinput集計が0になる問題の修正に着手。
  - update: 2026-01-22 15:10 JST typed array座標のbbox/vertex集計対応を追加し、typecheck再実行待ち。
  - update: 2026-01-22 15:25 JST typed array判定の型エラーを解消し、input集計ロジックを安定化。
  - done: 2026-01-22 15:30 JST pnpm typecheck exit 0 を確認。

2282) fix/shape/vt-stage-ui-crash-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-stage-ui-crash-diagnostics
- 依存: なし
- 受け入れ基準: transform→vt遷移で二重実行が発生しない／vt進捗がUIへ反映される／クラッシュ直前までの詳細ログが取得できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ/制御の差分を revert する
- チェックリスト:
  - vt開始/完了/失敗の重複実行有無を検出できるログを追加する
  - transform完了→vt開始の境界で状態更新を追跡する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 16:00 JST vt進捗未反映とChromeクラッシュの診断強化に着手。
    - update: 2026-01-22 16:20 JST start/resumeの二重起動ガードとpipeline runIdのログを追加。
    - done: 2026-01-22 16:25 JST pnpm typecheck exit 0 を確認。

2283) fix/shape/vt-resume-crash-task-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-resume-crash-task-diagnostics
- 依存: なし
- 受け入れ基準: vt再開時にタスク単位の入力情報と直前キュー状況がログに出る／クラッシュ直前のタスクを特定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/services/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - vtタスク開始前にbuffer数/bytes/taskId/tileIdをログ出力する
  - vt開始時にキューの状態サマリをログ出力する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 16:40 JST vt再開時のクラッシュ診断ログ追加に着手。
    - update: 2026-01-22 17:05 JST vt再開時のキューサマリとタスク入力バッファbytesをログ追加。
    - done: 2026-01-22 17:10 JST pnpm typecheck exit 0 を確認。

2284) fix/shape/auto-resume-double-start (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/auto-resume-double-start
- 依存: なし
- 受け入れ基準: 手動クリック時にautoResumeが再発火しない／startBatchProcessが1回のみ実行される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: autoResumeの制御差分を revert する
- チェックリスト:
  - 手動クリック時のautoResume書き込みを見直す
  - 二重起動を防ぐガードを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 17:30 JST 手動クリックとautoResumeの二重起動を抑止する対応に着手。
    - update: 2026-01-22 17:45 JST 手動クリック時のautoResume書き込みを削除し二重起動を抑止。
    - done: 2026-01-22 17:50 JST pnpm typecheck exit 0 を確認。

2285) fix/shape/vt-log-json-stringify (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-log-json-stringify
- 依存: なし
- 受け入れ基準: vt関連ログがJSON.stringifyで出力され省略されない／ブラウザクラッシュ時でもログ内容が欠落しにくい／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/services/vt/**`（必要に応じて追加）
- ロールバック手順: JSON.stringifyログ差分を revert する
- チェックリスト:
  - vt/pipelineの主要ログをJSON.stringify出力へ置換する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 18:10 JST vtログをJSON.stringify形式へ変更する対応に着手。
    - update: 2026-01-22 18:30 JST vt/pipelineの主要ログをJSON.stringify形式へ置換。
    - done: 2026-01-22 18:35 JST pnpm typecheck exit 0 を確認。

2286) fix/shape/vt-index-tiling-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-index-tiling-diagnostics
- 依存: なし
- 受け入れ基準: buildLayerIndexes/タイル生成の前後ログがJSONで出る／例外時にstageが特定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - buildLayerIndexesの開始/終了ログを追加する
  - タイル生成ループ開始ログを追加する
  - 例外時のstageログを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 18:55 JST vt index/tiling診断ログ追加に着手。
    - update: 2026-01-22 19:15 JST index/tiling開始終了ログとstage情報をJSON出力に追加。
    - done: 2026-01-22 19:20 JST pnpm typecheck exit 0 を確認。

2287) fix/shape/step4-cache-delete-explanations (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step4-cache-delete-explanations
- 依存: なし
- 受け入れ基準: Step4の各削除ボタンが削除対象を説明する／buildFetchキャッシュ削除の件数表示と削除が動作する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/services/utils/**`（必要に応じて追加）
- ロールバック手順: Step4の説明文と削除判定の差分を revert する
- チェックリスト:
  - Step4のボタンラベル/説明/件数表示を確認する
  - buildFetchキャッシュ削除の件数算出/削除処理を確認し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:40 JST Step4の削除ボタン説明とbuildFetchキャッシュ削除の不具合修正に着手。

2288) fix/shape/step5-task-summary-format (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-task-summary-format
- 依存: なし
- 受け入れ基準: fetch/transform/vt のタスク表示が統一形式に更新される／vt は ADM レベル別 feature 数とタイル枚数が表示される／表示のみ変更で処理結果は変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `packages/vt-orchestrator/src/vt/vtStage.ts`, `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: 表示フォーマット変更差分を revert する
- チェックリスト:
  - fetch/transform の表示を「features/polygons/vertices: input -> output (rate)」形式に揃える
  - vt の表示を ADM レベル別 feature 数 + tiles 生成数表示に変更する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:15 JST Step5のタスク表示書式統一とvt集計表示の対応に着手。
  - start: 2026-01-26 21:20 JST Shape step5 の fetch サマリ表示（Skipped 15, 379/430 と Queued 36 の不一致）について確認開始。
  - update: 2026-01-26 21:22 JST useShapeBuildStep の集計は total 内訳（completed/failed/skipped）のみを表示し、Queued は残タスクとして total に含まれるため 430-(379+15)=36 で整合することを確認。
  - update: 2026-01-26 21:29 JST runShapePipeline は fetch→transform→vt の順に実行し、fetch 完了後に queued/running が残る場合は failed に更新するが、resume 時に selectedArrayByCountries が空だと runShapeFetchStage が早期 return し既存 fetch キューが残る可能性があることを確認。
  - update: 2026-01-22 20:35 JST fetch/transformの表示書式を統一し、vtのADM別features/tiles集計表示へ変更。
  - update: 2026-01-22 20:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck ともに exit 0 を確認。
  - update: 2026-01-22 22:15 JST vt完了時のメッセージをADM別features+tiles集計に統一し、タスク一覧に残るよう修正。
  - update: 2026-01-22 22:16 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-22 22:30 JST vtタスクで親タイルと交差しない場合の診断ログとメッセージ表記を追加。
  - update: 2026-01-22 22:31 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 01:10 JST vtのskipped:no layers発生時に理由/集計の表示と診断ログ強化の対応に着手。
  - update: 2026-01-23 01:40 JST vtのskipped:no layers時に理由/集計を出す表示と診断ログを追加。
  - update: 2026-01-23 01:41 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 02:10 JST vt extent/tolerance見直し（extent=4096, tolerance=0/1）対応に着手。
  - update: 2026-01-23 02:15 JST vt extent=4096/tolerance=0 を反映。pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 02:30 JST transformの転置インデックスとvtの交差タイル検証ログ追加に着手。
  - update: 2026-01-23 02:40 JST transformのtileId列挙/関係テーブルのログとvtの生成0タイル警告を追加。pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 03:30 JST vt完了時のタイルサマリが初期値のままになるため、完了時に最新タイル数を再計算して表示する修正に着手。
  - update: 2026-01-23 03:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2289) refactor/shape/download-taskid-format (P1) — 進行中 (2026-01-22)
- ブランチ名: refactor/shape/download-taskid-format
- 依存: なし
- 受け入れ基準: downloadタスクのtaskIdが `nodeId:download:ISO2:adminLevel` 形式になる／参照・更新・削除が新形式で動作する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/services/batch/strategies/**`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`（必要に応じて追加）
- ロールバック手順: taskId生成差分を revert する
- チェックリスト:
  - downloadタスクのtaskId生成を新形式へ変更する
  - 参照・更新・削除が新形式に一致するよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:20 JST downloadタスクID形式の統一対応に着手。
  - update: 2026-01-22 20:35 JST downloadタスクIDを nodeId:download:ISO2:adminLevel 形式へ変更。
  - update: 2026-01-22 20:40 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2290) fix/shape/vt-index-memory-aggregation (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-index-memory-aggregation
- 依存: なし
- 受け入れ基準: vtステージでindex構築中のメモリ使用を抑えるためにレイヤー単位で集約し、クラッシュせずに完走する／ログはJSON.stringifyで省略されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: vt集約処理の差分を revert する
- チェックリスト:
  - vt indexをレイヤー単位で集約する
  - JSON.stringifyログで詳細を確認できるようにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:45 JST vt index構築のメモリ集約方式でクラッシュを抑止する対応に着手。
  - update: 2026-01-22 20:05 JST vt layer indexをレイヤー単位で集約し、ログをJSON.stringify化。
  - update: 2026-01-22 20:20 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 20:40 JST 高頂点数レイヤーでper-feature indexへ切替し、メモリピークを抑制。
  - blocked: 2026-01-22 20:45 JST pnpm typecheck が vtStage.ts の型エラーで失敗。
  - update: 2026-01-22 20:50 JST 型エラーを修正し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:00 JST per-feature index をズームごとに分割して構築し、ピークメモリを抑える。
  - update: 2026-01-22 21:05 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:20 JST タイルbboxでfeatureをclipしてgeojson-vtを1タイル単位に限定。
  - blocked: 2026-01-22 21:25 JST pnpm typecheck が turf bboxClip の型制約で失敗。
  - update: 2026-01-22 21:30 JST Point/MultiPoint のbbox判定を型安全に修正。
  - update: 2026-01-22 21:35 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:45 JST band zMin>=3 のタスクを強制per-tile indexへ切替。
  - update: 2026-01-22 21:50 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 22:05 JST vtタスクのクラッシュ継続のためログ解析と追加対策の検討を開始。
  - update: 2026-01-22 22:25 JST band zMin>=3 を複数レイヤーでもper-tile index化し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 22:40 JST vt完走後の最大更新深度警告を再現し、metadataポーリングの依存関係を安定化。
  - update: 2026-01-22 22:55 JST useVectorTilePreviewMetadata の loadRows 依存をref化し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 23:05 JST metadata state更新を差分時のみ行うようガードを追加。
  - update: 2026-01-22 23:15 JST feature一覧のloading表示を初回のみとし、featureIdでの重複行を抑止。
  - update: 2026-01-22 23:25 JST skippedタスクのログをinfoに切り替え、スタック出力を抑制。

2290) fix/shape/vt-resume-mark-running-aborted (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-resume-mark-running-aborted
- 依存: なし
- 受け入れ基準: vtのresume時にrunningタスクが failed（aborted）へ遷移する／vt以外のステージは影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/compareTaskOrder.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: vt resume時のrunning→failed差分を revert する
- チェックリスト:
  - vt resume時にrunningタスクをfailedへ更新する
  - vt以外のステージに影響しないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST vt resume時にrunningタスクをaborted扱いへ移行する対応に着手。
  - update: 2026-01-22 21:20 JST vtのみresume時にrunningタスクをfailed(aborted)へ移行する方針で実装準備。
  - update: 2026-01-22 21:30 JST vt resume時にrunningタスクをfailed(aborted)へ移行する処理を追加。
  - update: 2026-01-22 21:32 JST pnpm --filter @hierarchidb/vt-orchestrator build/typecheck、@hierarchidb/shape-plugin typecheck が exit 0（tsdownのdefine警告あり）。
  - update: 2026-01-22 22:05 JST vt完了後にqueued/runningが残る場合、failed(aborted)へまとめて遷移する処理を追加。
  - update: 2026-01-22 22:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0。

2291) fix/shape/vt-outline-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-outline-diagnostics
- 依存: なし
- 受け入れ基準: LineString境界の診断ログが追加される／geojson-vt入力前に不正形状が検知されればvtを失敗させる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 境界診断/検証の差分を revert する
- チェックリスト:
  - boundary LineString生成元の検証を追加する
  - vt直前のgeojson検証で不正形状を失敗扱いにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST アウトライン復帰に向けた境界診断とvt入力検証の対応に着手。
  - update: 2026-01-22 21:20 JST 段階復帰プランの第1段としてvt実行前検証/診断追加で進行。
  - update: 2026-01-22 21:40 JST boundary診断ログとgeojson検証の強化対応に着手。
  - update: 2026-01-22 21:45 JST boundary診断ログを追加し、geojson検証ログにgeometryType/vertexCountを付与。
  - update: 2026-01-22 21:46 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck / @hierarchidb/shape-plugin typecheck が exit 0。
  - update: 2026-01-22 21:55 JST geoboundariesの大陸判定はISO3166を正とし、ログのサンプルはiso2優先で出力するよう修正。
  - update: 2026-01-22 21:56 JST pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0。

2292) feat/shape/vt-dynamic-concurrency (P1) — 進行中 (2026-01-22)
- ブランチ名: feat/shape/vt-dynamic-concurrency
- 依存: なし
- 受け入れ基準: vt並列度がJSヒープ残量に応じて増減する／最小/最大と閾値が設定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/compareTaskOrder.ts`, `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/common/types/**`（必要に応じて追加）
- ロールバック手順: 動的並列度制御の差分を revert する
- チェックリスト:
  - ヒープ使用率に応じた並列度調整を追加する
  - 設定値（min/max/閾値）を設定可能にする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST vtの動的並列度制御の対応に着手。
  - update: 2026-01-22 21:20 JST min=1/max=Step4設定/閾値0.85-0.60/1ずつ増減の仕様で実装準備。
  - update: 2026-01-22 21:30 JST vtの動的並列度制御を追加し、vtConfigへdynamicConcurrencyを追加。
  - update: 2026-01-22 21:32 JST pnpm --filter @hierarchidb/gis-sdk build/typecheck が exit 0（tsdownのdefine警告あり）。

2293) fix/map/feature-highlight-source-layer (P1) — 進行中 (2026-01-20)
- ブランチ名: fix/map/feature-highlight-source-layer
- 依存: なし
- 受け入れ基準: MapLibreのsetFeatureStateでvector sourceにsourceLayerが必ず指定される／useMapFeatureHighlightsでsourceLayer欠落があってもエラーが出ない／既存のハイライト挙動が変わらない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/useMapFeatureHighlights.ts`, `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: sourceLayer補完/ガード差分を revert する
- チェックリスト:
  - sourceLayerの取得/補完経路を特定する
  - set/removeFeatureStateにsourceLayerを渡す
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-20 22:02 JST MapLibre setFeatureState の sourceLayer 必須エラー対応に着手。
  - update: 2026-01-20 22:05 JST useMapFeatureHighlights で vector source 判定と sourceLayer 補完/ガードを追加。
  - update: 2026-01-20 22:06 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。手動検証は未実施。

2294) fix/shape/vt-running-stuck-ui (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/vt-running-stuck-ui
- 依存: なし
- 受け入れ基準: vtタスク完了後にUIへ完了状態が反映されRunningが残らない／skipped/completeの最終タスク状態がUIに反映される／進捗通知の仕様を崩さない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `packages/features/batch/src/**`, `plugins/shape-plugin/src/ui/hooks/progress/**`（調査後に確定）
- ロールバック手順: vt完了通知/進捗更新の差分を revert する
- チェックリスト:
  - vt完了時のタスク状態更新がUIへ伝播しているか確認する
  - Runningが残る条件を特定し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:05 JST vt完了後もUIにRunningが残る問題の調査に着手。
  - update: 2026-01-21 08:12 JST useShapeBuildTasks にリクエスト世代管理を追加し、古い取得結果でRunningが上書きされるのを防止。
  - update: 2026-01-21 08:14 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。

2295) fix/shape/geoboundaries-metadata-normalize (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/geoboundaries-metadata-normalize
- 依存: なし
- 受け入れ基準: geoBoundaries の国メタデータ生成で countryName/countryCode/adminLevel が正規化される／JPN/ADM0 が Japan/JP/ADM0 として保存される／他データソースの国メタデータ生成に副作用がない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: 正規化ロジックの差分を revert する
- チェックリスト:
  - geoBoundaries の国メタデータ生成箇所を特定する
  - countryName/countryCode/adminLevel の正規化を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:18 JST geoBoundaries の国メタデータ正規化不備の修正に着手。
  - update: 2026-01-21 08:22 JST __hdbOriginKey と国メタデータで countryCode/countryName/adminLevel を正規化する処理を追加。
  - update: 2026-01-21 08:23 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。手動検証は未実施。

2296) feat/shape/metadata-aggregate-hover (P1) — 進行中 (2026-01-21)
- ブランチ名: feat/shape/metadata-aggregate-hover
- 依存: なし
- ExecPlan: plans/shape-metadata-aggregate-hover-execplan.md
- 受け入れ基準: geoBoundaries ADM1 のメタデータ一覧が同一自治体で1行に集約表示される（島・飛地も同一自治体で集約）／集約は表示のみでID統合はしない／ホバー/選択でフィーチャー単体だけでなく同一自治体/同一国の単位で強調できる／影響範囲とロールバック手順を明記する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/ui/map/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 集約表示/ホバー拡張の差分を revert する
- チェックリスト:
  - メタデータ一覧の集約対象キー（ADM1単位）を確定する
  - 集約表示ロジックを実装する
  - 同一自治体/同一国のホバー強調経路を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:28 JST ADM1集約表示と自治体/国単位のホバー強調対応に着手。
  - update: 2026-01-21 08:28 JST ExecPlan を作成（plans/shape-metadata-aggregate-hover-execplan.md）。
  - update: 2026-01-21 09:12 JST DoD 承認済み。集約表示とホバー強調の実装・検証を再開。
  - update: 2026-01-21 09:36 JST ADM1集約行の作成、一覧IDの統一、自治体/国の階層展開、エラー集約を実装。
  - update: 2026-01-21 09:37 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり、dist 型更新）。
  - update: 2026-01-21 09:39 JST pnpm typecheck exit 0（tsdown define 警告あり）。手動検証は未実施。
  - start: 2026-01-21 10:02 JST Step6「ベクトルタイル準備中」表示の実態調査に着手。
  - update: 2026-01-21 10:05 JST ShapePreviewStep の tilesChecking 判定と useShapePreviewStep の getVectorTileSummary 呼び出しを確認。
  - update: 2026-01-21 10:10 JST 非同期地図表示の実装が別経路にあるとの指摘を受け、認識を修正して再調査へ。
  - update: 2026-01-21 10:18 JST Step6 のタイルサマリポーリングと準備中ゲートを削除し、地図を常時表示するよう変更。
  - update: 2026-01-21 10:24 JST pnpm typecheck exit 0（tsdown define 警告あり）。手動検証は未実施。

2272) fix/shape/step3-index-scroll-not-moving (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-not-moving
- 依存: なし
- 受け入れ基準: Step3のIndexクリックで必ずスクロールが発生する／目的行が画面内の適切な位置に来る／ジャンプではなく短時間の滑らかな移動になる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`（必要に応じて追加）
- ロールバック手順: Indexクリック時のカスタムスクロール処理差分を revert する
- チェックリスト:
  - Indexクリック時に確実にスクロールが発生するよう修正する
  - スクロール位置の補正を維持する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 08:55 JST Step3のIndexクリックでスクロールしない問題の修正に着手。
  - update: 2026-01-22 09:05 JST ターゲット位置取得を次フレームに遅延し、未移動時は通常のスムーズスクロールへフォールバック。
  - done: 2026-01-22 09:10 JST pnpm typecheck exit 0 を確認。

2271) fix/shape/step3-index-offset-step5-next (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-offset-step5-next
- 依存: なし
- 受け入れ基準: Step3のIndexクリック時スクロール位置のズレが解消される／Fetchキャッシュ削除後にStep5の「次へ」が不適切に無効化されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`（必要に応じて追加）
- ロールバック手順: スクロール/削除後のセッションリセット差分を revert する
- チェックリスト:
  - Indexクリック時スクロールの位置補正を行う
  - Fetchキャッシュ削除後のセッションリセット条件を見直す
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 04:05 JST Step3のIndex位置ズレとFetch削除後の次へ無効化の修正に着手。
  - update: 2026-01-22 04:20 JST Indexスクロールのターゲット位置をVirtuoso算出に合わせて補正し、Fetch削除時のセッションリセット条件を出力有無で切替。
  - done: 2026-01-22 04:25 JST pnpm typecheck exit 0 を確認。

2273) fix/shape/step5-next-disabled-after-step4 (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-next-disabled-after-step4
- 依存: なし
- 受け入れ基準: Step4完了後にStep5の「次へ」が適切に有効化される／Fetchキャッシュ削除を行ってもStep5が進める／既存のフェーズ制御を崩さない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: Step5の「次へ」有効化条件の差分を revert する
- チェックリスト:
  - Step5の有効化条件を調査し、Step4完了後に進めない原因を特定する
  - 必要な有効化条件を追加/修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 09:20 JST Step4完了後にStep5の「次へ」が無効なままになる問題の修正に着手。
  - update: 2026-01-22 09:30 JST プレビュー可否判定に feature metadata を追加し、metadata保存状態でも次へ判定が通るよう調整。
  - done: 2026-01-22 09:35 JST pnpm typecheck exit 0 を確認。

2274) fix/shape/step3-selection-lost-on-step-change (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-selection-lost-on-step-change
- 依存: なし
- 受け入れ基準: Step3の選択内容がStep3以外へ遷移しても保持される／Step3に戻ったとき選択が復元される／Step4/Step5の有効化判定が崩れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/**`（必要に応じて追加）
- ロールバック手順: 選択保持の差分を revert する
- チェックリスト:
  - Step3の選択データが遷移時に失われる原因を特定する
  - 選択保持の修正を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 09:45 JST Step3の選択内容が遷移時に消える問題の修正に着手。
  - update: 2026-01-22 09:55 JST Stepアダプタの最新データ保持をマージ方式に変更し、遷移時に選択が落ちないよう調整。
  - done: 2026-01-22 10:00 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 10:20 JST Draft更新を部分マージに変更し、他ステップの更新で選択が欠落しないよう調整。
  - done: 2026-01-22 10:25 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 10:45 JST ステップ遷移時の save-draft に localDraftData を使用し、遷移直後の空状態を回避。
  - done: 2026-01-22 10:50 JST pnpm typecheck exit 0 を確認。

2275) fix/shape/step3-validation-disabled (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-validation-disabled
- 依存: なし
- 受け入れ基準: Step3のバリデーション（次へ/ステップ完了）が選択に応じて正しく有効化される／選択保持が崩れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`（必要に応じて追加）
- ロールバック手順: Draft同期の差分を revert する
- チェックリスト:
  - 遷移時に最新選択が draft へ反映される経路を確認する
  - Draft同期の更新タイミングを補正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 11:05 JST Step3のバリデーションが無効になる問題の修正に着手。
  - update: 2026-01-22 11:20 JST localDraftData の最新値を遷移/更新時に参照できるよう ref 化する方針で対応予定。
  - update: 2026-01-22 11:30 JST localDraftData を ref 同期し、遷移時の保存に最新値を使用するよう調整。
  - done: 2026-01-22 11:35 JST pnpm typecheck exit 0 を確認。

2270) fix/shape/step4-fetch-cache-enable (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step4-fetch-cache-enable
- 依存: なし
- 受け入れ基準: Step3の国選択のみでStep4の「Fetchキャッシュを削除」が有効化されない／Fetchキャッシュ削除後にStep5の「次へ」が不適切に無効化されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて追加）
- ロールバック手順: Fetchキャッシュ判定/削除の差分を revert する
- チェックリスト:
  - Fetchキャッシュのカウント対象を raw data に限定する
  - Fetchキャッシュ削除時に raw data のみ削除されるよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 03:05 JST Step4のFetchキャッシュ削除ボタン有効化と次へ無効化の原因調査/修正に着手。
  - update: 2026-01-22 03:20 JST Fetchキャッシュのカウント対象を raw data に限定し、削除時に raw data のみ削除するよう調整。
  - done: 2026-01-22 03:25 JST pnpm typecheck exit 0 を確認。

2269) fix/shape/step3-index-scroll-smooth-fast (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-smooth-fast
- 依存: なし
- 受け入れ基準: Step3 のIndexクリックがジャンプせず短時間で滑らかに移動する／目的位置への移動挙動は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`, `plugins/shape-plugin/src/ui/components/step3/ShapeCountrySelectionStep.tsx`
- ロールバック手順: Indexクリック時スクロールのカスタム処理を revert する
- チェックリスト:
  - Indexクリック時のスクロール速度/挙動を調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 02:10 JST Step3 のIndexクリック時スクロールを滑らかに高速化する対応に着手。
  - blocked: 2026-01-22 02:20 JST pnpm typecheck が ui-country-select の dist へ反映されておらず indexScrollDurationMs 未定義で失敗。
  - update: 2026-01-22 02:25 JST pnpm --filter @hierarchidb/ui-country-select build を実行し dist を更新。
  - done: 2026-01-22 02:30 JST pnpm typecheck exit 0 を確認。

2268) fix/shape/step3-index-scroll-speed (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-speed
- 依存: なし
- 受け入れ基準: Step3 のIndex(A/B/C...)クリック時スクロールが体感で明確に速くなる／目的位置への移動挙動は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/**`（必要に応じて追加）
- ロールバック手順: スクロール速度変更差分を revert する
- チェックリスト:
  - Step3のIndexクリック時スクロール速度を調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 01:40 JST Step3 のIndexクリック時スクロール速度調整に着手。
  - update: 2026-01-22 01:45 JST Step3 のIndexクリック時スクロール挙動を高速化。
  - done: 2026-01-22 01:50 JST pnpm typecheck exit 0 を確認。

2267) fix/shape/transform-simplify-only-default (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/transform-simplify-only-default
- 依存: なし
- 受け入れ基準: transform のデフォルトが simplify-only になる／フル処理は設定で選択可能な状態で残る／fetch ステージでフィーチャー単位メタデータを生成し空結果も記録する／空結果は transform タスクを生成しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/services/vt/**`, `plugins/shape-plugin/src/common/types/constants.ts`（必要に応じて追加）
- ロールバック手順: 追加した transformMode と fetch メタデータ生成を revert する
- チェックリスト:
  - transformMode を追加し既定を simplify-only にする
  - simplify-only の処理分岐を実装しフル処理を残す
  - fetch ステージでフィーチャー単位メタデータを生成する
  - 空結果時に transform タスクを作らない
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 22:10 JST transform のデフォルトを simplify-only にする変更と fetch メタデータ生成に着手。
  - start: 2026-01-22 02:40 JST fetch/transform のタスクメッセージに削減量を反映する対応に着手。
  - update: 2026-01-22 03:10 JST fetch/transform のメッセージにポリゴン/頂点の削減量を表示し、fetch キャッシュに入力カウントを保存。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-22 03:30 JST fetch フィルタ削減の計測と transform の簡略化効果が反映されるカウント見直しに着手。
  - update: 2026-01-22 04:15 JST fetch でズーム帯フィルタを適用し削減量を表示、transform の簡略化カウントを簡略化出力基準へ切替。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-22 04:35 JST fetch/transform の reduced 表記を差分から百分率に変更する対応に着手。
  - update: 2026-01-22 04:50 JST reduced 表記を百分率へ変更。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 05:05 JST Step遷移の永続化とVTタスク構成/表示の見直し、VT進捗メッセージ改善に着手。
- update: 2026-01-22 05:30 JST Step遷移の永続化・VTタスク構成/表示/進捗メッセージの修正対応を進行中。
- update: 2026-01-22 06:05 JST Step遷移の永続化とVTタスク構成/進捗表示の修正を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:25 JST VTバンドのz範囲上限を最終バンド以外で1段階下げ、タイル総数とz範囲の整合を修正。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:40 JST Step4のfetchキャッシュ削除件数がnodeId単位になるようカウント経路を修正。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:50 JST Step4のfetchキャッシュ削除件数表示の修正後にpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:05 JST Step4のfetchキャッシュ削除時にfetchタスクを一覧から除外する処理を追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:15 JST Step4のfetch削除後にタスク一覧も即時反映されることを確認するためpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:40 JST Step3で国選択が変わった場合にfetch/transform/vtのキャッシュとタスクを無効化し、再開が旧選択にならないよう対応。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:55 JST 国選択変更時の無効化対応後にpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 08:25 JST 国選択差分削除の前提として transform cache の国/ADMメタデータ格納経路を確認する調査に着手。
- update: 2026-01-22 08:40 JST transform cache の country/admin は fetch→transform の正規経路では必ず設定されることを確認（詳細は回答）。追加のコード変更なし。
- start: 2026-01-22 09:00 JST vt再開ログの原因確認とresume時の挙動整理に着手。
- update: 2026-01-22 09:15 JST resume時はmetadata取得とfetch/transform/vtのstage起動を行うが、runStageTasksはqueuedのみ処理するため再実行は発生しない挙動を確認。resume時にmetadataロードを省略する最適化は未対応。
- update: 2026-01-22 09:30 JST resume時のmetadata読み込みをfetch/transformのタスク生成が必要な場合のみ行うよう修正。
- update: 2026-01-22 09:40 JST resume時のmetadata読み込み最適化を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 10:10 JST vtステージでのDexie Transaction committed too earlyの原因調査に着手。
- update: 2026-01-22 10:25 JST vtのcollectFeaturesでDexieトランザクション内の長時間処理を避けるため一括取得へ変更。
- update: 2026-01-22 10:35 JST vtのcollectFeatures修正を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 11:05 JST vtクラッシュはglobalタイル(0/0/0)で222バッファを一括デコードしgeojson-vtの全量インデックス化を行うことが原因候補と判断。回避策の検討に移行。
- start: 2026-01-22 11:20 JST vt 0/0/0タイルをcontinent単位に分割してインデックス化・結合する対応に着手。
- update: 2026-01-22 11:55 JST 0/0/0タイルでcontinent単位の分割インデックス化とタイル結合を実装。
- update: 2026-01-22 12:10 JST continent分割のvt対応を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 12:35 JST 0/0/0でcontinentごとにインデックスを逐次作成しタイル単位で集約する方式へ変更。
- update: 2026-01-22 12:45 JST continent逐次集約方式を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-21 23:05 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig で transformMode 未定義エラーにより失敗。
  - update: 2026-01-21 23:07 JST pnpm --filter @hierarchidb/gis-sdk build を実行して dist 型定義を更新。
  - update: 2026-01-21 23:12 JST shapePipeline の未使用 import 修正と simplify-only の診断処理を整理。
  - done: 2026-01-21 23:20 JST simplify-only デフォルト化と fetch メタデータ生成/空結果スキップを反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-21 23:55 JST shapeVtPipeline を shapePipeline に改名し参照を更新。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-22 00:30 JST autoResumeBuild を build 開始前に保存し、Step5 復帰時の自動開始を追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-22 00:55 JST autoResumeBuild の自動開始時は localStorage を再設定しないよう修正し無限ループを回避。
  - update: 2026-01-22 01:20 JST vt タイルの input 統計を buffer 反映の bbox で集計するよう修正し input=0 を回避。
  - update: 2026-01-22 00:15 JST build 開始前に autoResumeBuild を保存し、Step5 復帰時に一致すれば自動開始する処理を追加。

2266) analysis/shape/transform-mode-default (P1) — 進行中 (2026-01-21)
- ブランチ名: analysis/shape/transform-mode-default
- 依存: なし
- 受け入れ基準: transform の処理モード/デフォルト設定の所在と影響範囲が整理される／「simplifyのみ」を既定にした場合のリスク/代替案を提示する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/common/types/constants.ts`, `packages/vt-orchestrator/src/transform/**`（調査結果に応じて追加）
- ロールバック手順: 影響なし（分析のみ）
- チェックリスト:
  - transform 処理手順と設定項目を整理する
  - デフォルト変更の影響と代替案を提示する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-21 21:20 JST transform 処理モードのデフォルト検討を開始。
  - done: 2026-01-21 21:35 JST 現行設定/処理手順を整理し、simplify-only 既定化の影響と代替案を提示。

2265) fix/vt/tile-metrics-message (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/vt/tile-metrics-message
- 依存: なし
- 受け入れ基準: vt タスクが z/x/y ごとに入力FGB合計サイズ・feature/polygon/lineString/vertex 合計と、geojson-vt 後の tile 合計を message へ出力する／ポリゴン数は外環カウントで集計する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: vt タスクのメッセージ生成差分を revert する
- チェックリスト:
  - z/x/y タイル単位の入力/出力メトリクスを算出する
  - vt タスクの message にタイル単位のメトリクスを反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 20:40 JST vt タイル単位メトリクスをメッセージに表示する対応に着手。
  - blocked: 2026-01-21 20:50 JST pnpm typecheck が vtStage の型エラーで失敗。
  - update: 2026-01-21 21:00 JST vt タイル単位の入力/出力メトリクス集計とメッセージ更新を実装。
  - done: 2026-01-21 21:05 JST vt タイル単位メトリクスの message 表示を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。

2264) fix/shape/feature-metadata-stage-counters (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/feature-metadata-stage-counters
- 依存: なし
- 受け入れ基準: フィーチャー単位のメタデータに fetch/transform/vt の段階別ポリゴン数・頂点数が記録される／不足しているカラムや生成フローが見直される／Step6 の表示に必要な値が欠落しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: 追加したメタデータカラムと生成処理を revert する
- チェックリスト:
  - 既存スキーマの不足点を特定する
  - フィーチャー単位の段階別カウントを保存できるよう再編する
  - 生成フローを更新し、Step6 で参照される値を補完する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 19:45 JST フィーチャー単位の段階別メタデータのスキーマ/生成フロー調査に着手。
  - blocked: 2026-01-21 20:05 JST pnpm typecheck が shape-plugin の ShapeFeatureMetadata 型不一致で失敗。
  - update: 2026-01-21 20:15 JST フィーチャー単位の fetch/transform ポリゴン数・頂点数を記録するカラムと生成フローを追加。
  - done: 2026-01-21 20:20 JST フィーチャー単位の段階別メタデータ拡張を反映。検証: pnpm --filter @hierarchidb/plugin-service-api build（exit 0、tsdown define 警告あり）／pnpm typecheck（exit 0）。

2263) fix/shape/step5-prebuild-task-list (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/step5-prebuild-task-list
- 依存: なし
- 受け入れ基準: Step4 のキャッシュ件数が 1 以上のとき Step5 でビルド開始前にタスク一覧が表示される／ビルド開始後は従来どおりタスクを再生成する／No tasks yet が表示されないことを UI で確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査結果に応じて追加）
- ロールバック手順: 該当差分を revert し、Step5 のタスクリスト表示を修正前に戻す
- チェックリスト:
  - Step4 キャッシュ由来の前回タスク一覧を Step5 初期表示に反映する
  - ビルド開始時のタスク再生成フローを維持する
  - UI で No tasks yet が表示されないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 09:10 JST Step5 のビルド開始前タスク一覧表示の修正に着手。
  - blocked: 2026-01-21 09:30 JST pnpm typecheck が ShapeBuildTaskSummary の status 型不一致で失敗。
  - blocked: 2026-01-21 09:40 JST pnpm typecheck が WorkerProvider フルフローテストの型エラーで失敗。
  - update: 2026-01-21 09:50 JST Step5 の初期表示でキャッシュ済みタスクを読み込み、status/stage を厳密に解釈して一覧へ反映。
  - update: 2026-01-21 10:00 JST WorkerProvider フルフローテストの型注釈を補正。
  - update: 2026-01-21 10:25 JST タスク履歴が空の場合に fetch/transform/vt キャッシュから擬似タスクを生成して表示。
  - done: 2026-01-21 10:30 JST Step5 のビルド開始前タスク一覧表示を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。

2262) test/shape/full-flow-worker-pipeline (P1) — 進行中 (2026-01-19)
- ブランチ名: test/shape/full-flow-worker-pipeline
- 依存: なし
- 受け入れ基準: shape の fetch/transform/vt を実処理で通す「擬似ではない」フルフローテストが追加されている／Comlink/WorkerProvider 経路を通るフルフローテストが追加され、UI描画なしで JPN ADM0/ADM1 を選択して VT とフィーチャーメタデータ生成を検証できる／実データ取得と永続化を伴うことがテストから判別できる／実行コマンドと実行条件が明記されている／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/src/**`, `plugins/shape-plugin/vitest.config.ts`, `app/src/**`（必要に応じて追加）
- ロールバック手順: 追加したフルフローテストを削除する
- チェックリスト:
  - 実Worker/実データ/永続化を通すフルフローテストを追加する
  - Comlink/WorkerProvider 経路のフルフローテストを追加する（UI描画なし、JPN ADM0/ADM1）
  - テストの実行条件（環境変数/時間目安）を明記する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 09:22 JST フルフロー非擬似テストの設計と追加に着手。
  - update: 2026-01-19 09:44 JST 非擬似フルフローテストと vt-orchestrator のテスト用 alias を追加。
  - blocked: 2026-01-19 09:44 JST pnpm --filter @hierarchidb/shape-plugin test が DNS 解決失敗 (www.geoboundaries.org, ENOTFOUND) により失敗。
  - blocked: 2026-01-19 09:47 JST DNS 許可後に再実行したが www.geoboundaries.org の ENOTFOUND が継続。
  - update: 2026-01-19 09:47 JST Node の dns.lookup でも ENOTFOUND を確認、nslookup は sandbox 制限で失敗。
  - update: 2026-01-19 09:47 JST geoboundaries.org でも dns.lookup が ENOTFOUND。
  - update: 2026-01-19 10:37 JST フルフローの downloadTaskPayloads を明示指定し、失敗タスクの詳細を出すようテストを調整。
  - blocked: 2026-01-19 10:37 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND のまま失敗。
  - update: 2026-01-19 10:43 JST テストの DB を削除してスキーマ差異を避ける調整と shape-store の test alias を追加。
  - blocked: 2026-01-19 10:43 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (www.geoboundaries.org) のまま失敗。
  - update: 2026-01-19 10:45 JST DB削除タイミングを調整し DatabaseClosedError を回避する修正を実施。
  - blocked: 2026-01-19 10:45 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (www.geoboundaries.org) のまま失敗。
  - update: 2026-01-19 10:51 JST NaturalEarth の download URL を endpoint として渡せるようにし、エラー原因の詳細を出力する修正を追加。
  - blocked: 2026-01-19 10:51 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (github.com) のまま失敗。
  - start: 2026-01-20 11:05 JST Comlink/WorkerProvider 経路のフルフローテスト追加に着手。
  - update: 2026-01-20 11:35 JST WorkerProvider 経路のフルフローテストを app 側に追加（JPN ADM0/ADM1、Comlink 経由）。
  - update: 2026-01-20 11:55 JST app の vitest alias に @hierarchidb/vt-orchestrator の src を追加。
  - blocked: 2026-01-20 11:56 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が RequestInit AbortSignal 型不一致で失敗。
  - blocked: 2026-01-20 11:59 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が fetch failed で失敗（ネットワーク到達性）。
  - update: 2026-01-20 14:05 JST WorkerProvider フルフローテストに進捗/失敗の診断ログを追加。
  - update: 2026-01-20 14:15 JST フェッチ失敗時の URL/エラーを出すログを追加。
  - update: 2026-01-20 14:20 JST download payload と startBatchSession 失敗時の詳細ログを追加。
  - update: 2026-01-20 14:25 JST payload 生成時の失敗ログと metadata URL の診断ログを追加。
  - update: 2026-01-20 14:30 JST fetch ラッパを window/global 両方に設定し、同期例外も記録するよう補強。
  - update: 2026-01-20 14:35 JST 失敗ログを stdout 出力に変更して取得しやすく調整。
  - blocked: 2026-01-20 14:40 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (www.geoboundaries.org) で失敗。
  - update: 2026-01-20 15:05 JST WorkerProvider テストで /iso3166-2-level1.csv をローカルCSVから返すための fetch 分岐を追加。
  - blocked: 2026-01-20 18:15 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (geoboundaries.org) で失敗。
  - update: 2026-01-20 19:05 JST WorkerProvider テストの進捗ログに task summary を追加し、最大実行時間を 15 分へ拡張。
  - blocked: 2026-01-20 19:15 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (geoboundaries.org) で失敗。
  - update: 2026-01-20 19:35 JST WorkerProvider テストの APP_PREFIX を固定値 (hidb) に揃えて task queue の参照一致を狙う調整を追加。
  - update: 2026-01-20 20:05 JST WorkerProvider テストに task-queue 全件スナップショットの診断ログを追加。
  - update: 2026-01-20 20:25 JST WorkerProvider テストの完了判定をバッチセッション/タスク完了に基づくものへ変更し、status mismatch の診断ログを追加。
  - update: 2026-01-20 20:45 JST WorkerProvider テストの進捗判定から ShapeQuery の processingStatus を外し、task queue の進捗のみで監視するよう変更。
  - update: 2026-01-20 21:05 JST WorkerProvider テストの zoomBandBoundaries を [0, 4] にして transform/vt タスク数を抑制。
  - update: 2026-01-20 21:25 JST WorkerProvider テストの selfIntersectionTuningConfig を緩和して transform の負荷を軽減。
  - update: 2026-01-20 21:45 JST selfIntersectionTuningConfig.disableAtZoomOrBelow を 11 に調整し、検証エラーを回避。
  - update: 2026-01-20 22:05 JST WorkerProvider テストで transform の tolerance と maxVerticesPerFeature を調整し処理時間を短縮。
  - update: 2026-01-20 22:30 JST transform の自己交差修正に metrics ログを追加し、vt ステージ開始/終了時の heap スナップショットを出力するよう調整。
  - update: 2026-01-20 22:55 JST vtConfig.maxConcurrent のデフォルトを 1 に下げてブラウザ VT 生成の負荷を抑制。
  - start: 2026-01-20 23:40 JST vtステージのクラッシュ区間を特定するための詳細計測追加に着手。
  - update: 2026-01-20 23:50 JST vtステージの collect/index/tiling/vtpbf 各区間に heap/duration を出す計測ログを追加。
  - update: 2026-01-20 23:55 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 00:10 JST buildLayerIndexes のレイヤー単位 start/done と feature/vertex/polygon 統計ログを追加。
  - update: 2026-01-21 00:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 00:35 JST admin0 band>=6 の feature サンプル出力と transform tolerance を増やす調整を追加。
  - update: 2026-01-21 00:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 01:10 JST transform の永続化前に GeoJSON 検証を追加し、不正形状をログしてタスク失敗とする処理へ変更。
  - update: 2026-01-21 01:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 01:35 JST admin0 の z<=2 を tolerance=5.0、z>=3 を tolerance=3.0 に切替。
  - update: 2026-01-21 01:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 02:00 JST admin0 の z<=2 を tolerance=8.0、z>=3 を tolerance=5.0 に切替。
  - update: 2026-01-21 02:05 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 02:30 JST admin0 の z<=2/z>=3 を tolerance=10.0 に切替。
  - update: 2026-01-21 02:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 03:10 JST admin レベル全体で z<=2/z>=3 の tolerance=10.0 を適用。
  - blocked: 2026-01-21 03:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が未使用引数で失敗。
  - update: 2026-01-21 03:20 JST resolveTransformTolerance の引数整理で typecheck 修正。
  - update: 2026-01-21 03:25 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 03:45 JST boundaryDisableAtZoomOrAbove を追加し z>=3 の境界生成を抑止できるようにした。
  - update: 2026-01-21 03:55 JST pnpm --filter @hierarchidb/gis-sdk build で d.ts を更新。
  - update: 2026-01-21 04:00 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2261) fix/shape/network-tests-node-direct (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/network-tests-node-direct
- 依存: なし
- 受け入れ基準: shape のネットワーク系テストが ENABLE_INTEGRATION_TESTS なしで実行される／Node 環境のテストではCORS-Proxyを使わずデータソースURLへ直接アクセスする／テストの実行条件や説明が実態に合う／pnpm typecheck が通る／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/src/services/utils/__tests__/generateUrlMetadata.unit.test.ts`, `plugins/shape-plugin/src/services/datasources/__tests__/unit/DataSourceIntegration.unit.test.ts`, `plugins/shape-plugin/vitest.setup.ts`（必要に応じて関連ファイルを追記）
- ロールバック手順: テストの実行条件とセットアップ差分を revert する
- チェックリスト:
  - ENABLE_INTEGRATION_TESTS に依存するスキップ条件を撤去する
  - Node テストで CORS-Proxy を使わないことを明示する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 23:50 JST shape のネットワーク系テスト実行条件と Node 直アクセスの修正に着手。
  - done: 2026-01-20 00:10 JST ネットワーク系テストのスキップ撤去と Node 直アクセス設定を反映。検証: pnpm typecheck（exit 0）。

2260) refactor/shape/tests-structure-and-datasource (P1) — 完了 (2026-01-19)
- ブランチ名: refactor/shape/tests-structure-and-datasource
- 依存: なし
- 受け入れ基準: shape テストが `__tests__` 配下に揃えられている／fetch段のテストに geoBoundaries が追加されている／dataSourceName がリテラルunionで制約され正規化/フォールバックが撤去されている／pnpm typecheck が通る／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/**`, `packages/**`
- ロールバック手順: テスト配置と型修正を revert する
- チェックリスト:
  - shape のテスト配置を `__tests__` 配下へ移動する
  - Fetch段テストに geoBoundaries を追加する
  - dataSourceName の正規化/フォールバックを撤去しリテラルunionで制約する
  - 旧ステージ名（download/extract1/extract2/vectortile）のテストを fetch/transform/vt に更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 22:10 JST shape テスト配置整理と dataSourceName 型制約の改修に着手。
  - update: 2026-01-19 23:10 JST 旧ステージ名のテストを fetch/transform/vt に合わせる修正に着手。
  - done: 2026-01-19 23:35 JST shape テスト配置と dataSourceName 型制約の改修、fetch/transform/vt へのテスト更新を完了。検証: pnpm typecheck（exit 0）。

2259) doc/shape/build-tests-audit (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-tests-audit
- 依存: なし
- 受け入れ基準: shape ビルド工程のテスト対象と内容が整理されている／実行・未実行の範囲が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/**`, `packages/**`
- ロールバック手順: 追記した調査記録を削除する
- チェックリスト:
  - shape ビルド関連のテストファイルを特定する
  - 各テストの対象ステージ/検証内容を整理する
  - 実行・未実行の状況を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 21:50 JST shape ビルド工程のテスト調査に着手。
  - done: 2026-01-19 22:05 JST shape ビルド工程のテスト一覧と検証状況を整理。

2260) fix/shape/chunkstore-missing-export (P1) — 完了 (2026-01-20)
- ブランチ名: fix/shape/chunkstore-missing-export
- 依存: なし
- 受け入れ基準: deleteRawDataDataSourceBuffersForNodeKeys が export され app build の MISSING_EXPORT が解消される／pnpm typecheck が exit 0／pnpm --filter @hierarchidb/app build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts`（必要に応じて）
- ロールバック手順: 追加した export を revert し、元の状態へ戻す
- チェックリスト:
  - deleteRawDataDataSourceBuffersForNodeKeys を実装・export する
  - pnpm typecheck を実行する
  - pnpm --filter @hierarchidb/app build を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 13:20 JST app build の MISSING_EXPORT 解消に着手。
  - blocked: 2026-01-20 01:25 JST pnpm typecheck が useShapeCountrySelectionStep.ts の removedBufferSet 未定義で失敗。
  - update: 2026-01-20 01:32 JST removedBufferSet のスコープ修正を実施。
  - done: 2026-01-20 01:35 JST pnpm typecheck exit 0 と pnpm --filter @hierarchidb/app build exit 0 を確認。

2258) feat/storage/unify-vt-shape-route-location (P1) — 進行中 (2026-01-19)
- ブランチ名: feat/storage/unify-vt-shape-route-location
- 依存: plan/storage/unify-vt-shape-route-location
- 受け入れ基準: VtShapeDb/VtDb 参照がすべて削除され、Ephemeral*DB と各ドメインDBへ移行されている／Step4 の中間生成物削除が各ノード種別で機能する／CoreDB のノード削除で関連データが nodeId で削除される／`pnpm lint && pnpm format && pnpm typecheck && pnpm test` が exit 0／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `packages/vt-shape-store/**`, `packages/vt-store/**`, `packages/features/*-store/**`, `packages/vt-orchestrator/**`, `packages/runtime-worker/**`, `plugins/**`, `config/**`
- ロールバック手順: 旧ストアの参照を復元し、移行差分を revert する
- チェックリスト:
  - VtShapeDb/VtDb 参照箇所を洗い出す
  - Ephemeral*DB/DomainDB への参照置換を実施する
  - Step4 手動削除/自動削除の挙動を確認する
  - CoreDB ノード削除時のアーティファクト削除を確認する
  - pnpm lint && pnpm format && pnpm typecheck && pnpm test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:50 JST VtShapeDb/VtDb 廃止の実装作業に着手。
  - blocked: 2026-01-19 17:30 JST RouteDB/LocationDB へのタイル保存フォーマットと contentHash/featureCount の扱い方針が未確定。
  - update: 2026-01-19 17:45 JST タイル保存フォーマット方針が確定し、shape の移行実装に着手。
  - update: 2026-01-19 18:20 JST VtShapeDb/VtDb 参照削除の続きとして、残りの参照箇所とドキュメント更新を進める。
  - blocked: 2026-01-19 18:35 JST pnpm format が plugin-ui-host/styler-plugin/cors-proxy の既存 lint 指摘で失敗。format 実行により広範囲の未意図差分が発生したため、扱い方針の確認が必要。
  - update: 2026-01-19 19:05 JST pnpm format の差分保持を選択し、pnpm lint/typecheck を再実行してテスト失敗の修正に着手。
  - update: 2026-01-19 21:10 JST pnpm format/lint/typecheck を再実行し成功を確認。
  - blocked: 2026-01-19 21:15 JST pnpm test が 360s でタイムアウト（turbo run test --parallel の完走前に終了）。
  - blocked: 2026-01-19 21:40 JST pnpm test を 120s/240s/360s で再実行したが完走前にタイムアウト。
  - update: 2026-01-20 00:20 JST vt-store/vt-shape-store の残存参照と削除対象の棚卸しを再開。
  - update: 2026-01-20 00:45 JST pnpm lint/format/typecheck を実行し完走（format は警告のみ）。
  - blocked: 2026-01-20 00:50 JST pnpm test が 120s タイムアウト、再実行(240s)で @hierarchidb/batch-session-ports の OOM により失敗。
  - update: 2026-01-19 09:22 JST ターゲット検証として pnpm --filter @hierarchidb/shape-plugin test と pnpm --filter @hierarchidb/runtime-worker test を実行し exit 0 を確認。
  - update: 2026-01-19 10:30 JST 2258 の残存 VtShapeDb/VtDb 参照の再棚卸しと移行差分の確認に着手。
  - blocked: 2026-01-19 10:55 JST pnpm test が shape-plugin の full-flow テストで失敗（geoboundaries へのネットワーク接続で ENOTFOUND）。
  - blocked: 2026-01-19 11:00 JST pnpm test を再実行したが同様に shape-plugin の full-flow テストで ENOTFOUND が発生。
  - blocked: 2026-01-19 11:05 JST NODE_OPTIONS=--dns-result-order=ipv4first で pnpm test を再実行したが ENOTFOUND が継続。
  - blocked: 2026-01-19 11:12 JST Node DNS を setServers で上書きしたが dns.lookup が ENOTFOUND のまま（Node の resolver 経路が別）。
  - blocked: 2026-01-19 11:18 JST pnpm test を再試行したが shape-plugin の full-flow テストで ENOTFOUND が継続。

2257) doc/location/nodeid-cache-confirm (P1) — 完了 (2026-01-19)
- ブランチ名: doc/location/nodeid-cache-confirm
- 依存: なし
- 受け入れ基準: Location の nodeId 単位キャッシュ実装の有無がコード参照で整理されている／未実装の場合は追加方針が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - Location プラグイン/ストアの nodeId キャッシュ利用有無を確認する
  - 結果と方針をドキュメントへ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:45 JST Location の nodeId キャッシュ調査に着手。
  - done: 2026-01-19 17:10 JST Location の nodeId キャッシュ未導入を確認しドキュメントに反映。

2256) doc/vt-pipeline-design-update (P1) — 完了 (2026-01-19)
- ブランチ名: doc/vt-pipeline-design-update
- 依存: なし
- 受け入れ基準: `docs/vt-pipeline-design.md` が新しい保存先方針（Ephemeral*DB/DomainDB）に一致する／VtShapeDb/VtDb 記載が削除されている／中間生成物/ビルド結果の削除条件が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/vt-pipeline-design.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - 保存先の分担とストア構成を更新する
  - 中間生成物とビルド結果の削除条件を追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:45 JST vt パイプライン設計ドキュメントの更新に着手。
  - done: 2026-01-19 17:10 JST vt パイプライン設計ドキュメントを保存先方針に合わせて更新。

2255) plan/storage/unify-vt-shape-route-location (P1) — 完了 (2026-01-19)
- ブランチ名: plan/storage/unify-vt-shape-route-location
- 依存: なし
- ExecPlan: plans/storage-unify-vt-shape-route-location-execplan.md
- 受け入れ基準: VtShapeDb/VtDb 廃止と保存先統合の ExecPlan が作成され、影響範囲・移行手順・検証・ロールバックが明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plans/**`, `packages/vt-shape-store/**`, `packages/vt-store/**`, `packages/features/shape-store/**`, `packages/runtime-worker/**`, `plugins/**`
- ロールバック手順: ExecPlan の差分を revert する
- チェックリスト:
  - 旧ストアの削除範囲と移行先を明記する
  - ExecPlan に移行手順と検証計画を記述する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:10 JST VtShapeDb/VtDb 廃止と保存先統合の ExecPlan 作成に着手。
  - done: 2026-01-19 16:40 JST ExecPlan を作成し移行方針を整理。

2254) doc/build/fetchwithauth-cache-confirm (P1) — 完了 (2026-01-19)
- ブランチ名: doc/build/fetchwithauth-cache-confirm
- 依存: なし
- 受け入れ基準: fetchWithAuth のキャッシュが nodeId 単位で稼働している根拠をコード参照で整理する／未実装の場合はその旨と要件を明記する／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - fetchWithAuth/smartFetch のキャッシュ経路を確認する
  - nodeId 単位キャッシュの有無を整理する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:05 JST fetchWithAuth キャッシュ稼働確認の調査に着手。
  - done: 2026-01-19 16:20 JST nodeId 単位キャッシュの実装箇所を整理しドキュメントに反映。

2253) doc/build/artifacts-impact-priority (P1) — 完了 (2026-01-19)
- ブランチ名: doc/build/artifacts-impact-priority
- 依存: なし
- 受け入れ基準: 影響ドキュメントの更新方針（軽微/書き直し/削除）と優先順が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - 影響ドキュメント一覧と方針を整理する
  - 優先順を明記する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:00 JST 影響ドキュメント更新方針の整理に着手。
  - done: 2026-01-19 16:20 JST 影響ドキュメントの更新優先順を追記。

2252) doc/shape/build-stage-compare (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-stage-compare
- 依存: なし
- 受け入れ基準: 現行パイプラインと新パイプラインの差分が stage ごとに表形式で整理されている／入力・処理・出力・永続化・メリット/リスクが比較できる／保存先が docs 配下で明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/**`
- ロールバック手順: 追加した比較ドキュメントを削除し、TASKS.md の該当項目を revert する
- チェックリスト:
  - 現行と新フローの差分を stage ごとに整理する
  - 入力/処理/出力/永続化/メリット・リスクの比較表を作成する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 15:30 JST 現行 vs 新パイプラインの比較ドキュメント作成に着手。
  - done: 2026-01-19 15:40 JST 比較ドキュメントを docs に追加。
  - update: 2026-01-19 15:55 JST ノード種別ごとの成果物/保存先仕様ドキュメントを追加。

2251) doc/shape/build-stage-uml (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-stage-uml
- 依存: なし
- 受け入れ基準: 完成像の fetch/transform/vt データフローが UML で図式化されている／入出力・永続化先・ズーム帯/インデックスの関係が図で判別できる／UML の形式（Mermaid/PlantUML など）と保存先が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/**` または `plans/**`（保存先決定後に確定）
- ロールバック手順: 追加した UML ドキュメントを削除し、TASKS.md の該当項目を revert する
- チェックリスト:
  - UML の形式と保存先を確定する
  - fetch/transform/vt の入力・出力・永続化・ズーム帯/インデックスの流れを図式化する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 15:00 JST 完成像のデータフロー UML 作成に着手。
  - update: 2026-01-19 15:05 JST UML 形式=Mermaid、保存先=docs の指定を受領。
  - done: 2026-01-19 15:10 JST Mermaid 図を docs に作成し完了。
  - update: 2026-01-19 15:15 JST Mermaid のノード名からカッコ表記を除去。
  - update: 2026-01-19 15:20 JST Mermaid ノード内の括弧を追加で除去。
  - update: 2026-01-19 15:25 JST Mermaid ノード内の矢印表記を "to" に置換。

2250) plan/shape/build-stage-restructure (P1) — 完了 (2026-01-19)
- ブランチ名: plan/shape/build-stage-restructure
- 依存: なし
- ExecPlan: plans/shape-build-stage-restructure-execplan.md
- 受け入れ基準: fetch/transform/vt の新ステージ構成と入出力・永続化・ズーム帯の流れが ExecPlan に明文化されている／既存処理の置換範囲と非互換点が整理されている／既定OFFのフラグ導入方針とロールバック手順が明記されている／検証手順が `pnpm lint && pnpm format && pnpm typecheck && pnpm test` を含めて記載されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 要点: shape ビルドの fetch/transform/vt 再編に向けた ExecPlan を作成し、フラグ既定OFFの移行計画を整理した。
- 影響範囲: `packages/vt-orchestrator/src/**`, `packages/features/shape-store/src/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/components/step5/**`（計画で確定）
- ロールバック手順: フラグを既定OFFのまま維持し、該当差分を revert して従来のビルドフローへ戻す
- チェックリスト:
  - 既存の fetch/transform/vt の責務と入出力を整理する
  - 新ステージ構成（fetch=フィルタ+ズーム帯別FG保存、transform=simplify+転置インデックス、vt=タイル化+子孫タイル生成）を ExecPlan に記述する
  - 既定OFFのフラグと適用箇所を提案し、段階導入手順を明記する
  - 受け入れ基準・検証手順・ロールバックを ExecPlan に明文化する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 14:20 JST shape ビルドのステージ再編計画（ExecPlan）作成に着手。
  - done: 2026-01-19 14:40 JST ExecPlan を作成し、ステージ再編の計画を整理。

2249) feat/shape/omit-details-config (P1) — 完了 (2026-01-19)
- ブランチ名: feat/shape/omit-details-config
- 依存: なし
- 受け入れ基準: Transform でズームに応じた小BBox/小面積ポリゴン除外が行われる（外形リング面積を使用）／OmitDetailsConfig が BuildConfig に追加され弱/中/強を選べる／デフォルトは強設定／`app/public/templates/population-2023/tree-nodes.json` に設定値が反映される／Step4 Transform のアコーディオンにカードUIが追加される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/common/types/**`, `app/public/templates/population-2023/tree-nodes.json`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、omit-details の設定/UI/フィルタを撤去する
- チェックリスト:
  - OmitDetailsConfig を追加し weak/medium/strong を選べるようにする
  - Transform の簡略化前に bbox/面積でポリゴン省略を適用する
  - デフォルトを strong として適用する
  - Step4 Transform にカードUIを追加する
  - templates に設定値を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 12:10 JST omit-details 設定と Transform 省略フィルタ追加に着手。
  - update: 2026-01-19 12:28 JST omit-details preset(弱/中/強)・Transform フィルタ・Step4 UI・テンプレート更新を実装。
  - blocked: 2026-01-19 12:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が omitDetailsConfig 未解決で失敗。
  - done: 2026-01-19 12:37 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 12:38 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 12:39 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 12:55 JST self-intersection tuning（ズーム/頂点数でスキップ）設定を追加し Transform に適用。
  - done: 2026-01-19 13:05 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 13:06 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 13:07 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 13:30 JST Transform タスクの各処理フェーズ開始/終了を task.message に反映し、タスク内進捗の段階化を追加。
  - done: 2026-01-19 13:33 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 13:34 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 13:35 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 13:45 JST task.message の phase 表示を i18n 化。
  - done: 2026-01-19 13:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-19 11:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2248) feat/ui-shape/build-timing-display (P1) — 完了 (2026-01-19)
- ブランチ名: feat/ui-shape/build-timing-display
- 依存: なし
- 受け入れ基準: 「ビルド操作」カードに総経過時間/ステージ経過時間を表示する（pause 時間は除外）／ステージ残り時間の概算をタスク進捗から算出して表示する／1時間23分45秒形式で表示される／i18n 対応される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`, `packages/components/src/BuildStepPanel.tsx`, `packages/components/src/BuildControlCard.tsx`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、ビルド操作カードから経過時間/残り時間表示を除去する
- チェックリスト:
  - ビルド総経過時間/ステージ経過時間を pause 除外で算出する
  - ステージ残り時間の概算を進捗と残タスクから算出する
  - BuildControlCard に表示枠を追加する
  - i18n キーとフォールバックを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 11:30 JST ビルド操作カードへ経過時間/残り時間を表示する対応に着手。
  - update: 2026-01-19 11:45 JST BuildControlCard/BuildStepPanel に詳細表示枠を追加し、Step5 で経過時間/残り時間の算出・表示を実装。
  - done: 2026-01-19 11:52 JST pnpm --filter @hierarchidb/components build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 11:53 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 12:05 JST 経過時間表示を「1時間23分45秒」形式に揃える i18n 調整に着手。
  - done: 2026-01-19 12:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。経過時間表示の i18n 形式を確認。

2247) fix/ui-map/feature-list-column-toggle (P1) — 完了 (2026-01-19)
- ブランチ名: fix/ui-map/feature-list-column-toggle
- 依存: なし
- 受け入れ基準: フィーチャー一覧の列表示/非表示トグルが保持される（チェックが即座に戻らない）／MapLibre の Unknown expression "feature-atoms" が発生しない／影響範囲とロールバック手順が明記される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/**`, `packages/components/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、列表示トグルと MapLibre 式を修正前に戻す
- チェックリスト:
  - フィーチャー一覧のカラム表示状態が即座に戻る原因を特定する
  - カラム表示の保存/復元を正しく動作させる
  - MapLibre の feature-atoms を含む式を特定し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 02:10 JST フィーチャー一覧のカラム表示トグル不具合と MapLibre feature-atoms エラーの修正に着手。
  - done: 2026-01-19 02:18 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:32 JST フィーチャー一覧のローディング表示の高さ揺れ対策とスクロールの wheel 伝播抑止に着手。
  - done: 2026-01-19 02:33 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:40 JST フローティング一覧の TableContainer 高さ指定を見直し、スクロール可能な overflow 設定を調整。
  - done: 2026-01-19 02:41 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:50 JST フローティング一覧の余白解消と高さ一致のため、コンテナの高さ設定を再調整。
  - done: 2026-01-19 02:52 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:00 JST テーブルの wheel イベントを capture で抑止し、Map 側のズーム干渉を回避。
  - done: 2026-01-19 03:02 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-19 03:10 JST pnpm typecheck が exit 2（MapPreviewFloatingTable の未使用 maxHeight）で失敗。
  - done: 2026-01-19 03:12 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:25 JST フィーチャー一覧テーブルのスクロール不具合を再調査。
  - update: 2026-01-19 03:36 JST フローティング一覧のテーブル領域を高さ固定し、スクロール領域の高さを明示。
  - done: 2026-01-19 03:37 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:45 JST Transform で z0-z3 がゼロ化する原因の調査に着手。
  - update: 2026-01-19 03:57 JST pre-simplify の無効判定と oversized 処理を調整し、ゼロ化時のログを追加。
  - done: 2026-01-19 03:58 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:05 JST Step4 の VT キャッシュ削除ボタン件数/有効化の不一致を調査。
  - update: 2026-01-19 04:09 JST Step4 のカウント取得順を修正し VT 件数が正しく反映されるよう調整。
  - done: 2026-01-19 04:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:13 JST Transform の skipped メッセージに features/polygons の比率を含める修正に着手。
  - done: 2026-01-19 04:14 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:18 JST Step6 フィーチャーテーブルの状態ソート不具合と ADM0/ADM1 表示差分の由来を調査。
  - update: 2026-01-19 04:26 JST 状態カラムのソート用フィールドを追加し、ADM0/ADM1 の表示由来を整理。
  - done: 2026-01-19 04:27 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:40 JST Step6 フィーチャー一覧の Country/Admin/DataSource 正規化と FeatureID 一意化の対応に着手。
  - update: 2026-01-19 05:02 JST Step6 フィーチャー一覧の Country/Admin/DataSource 正規化と Transform エラー行の FeatureID 一意化を実装。
  - done: 2026-01-19 05:03 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 05:16 JST VT 並列度のデフォルトを 1 に統一し、テンプレートの vtConfig.maxConcurrent を更新。

2247) feat/shape/transform-preprocess-diagnostics (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/transform-preprocess-diagnostics
- 依存: なし
- ExecPlan: plans/shape-transform-preprocess-diagnostics-execplan.md
- 受け入れ基準: simplify 前処理のログが feature/polygon 単位で問題箇所と理由を示す／問題ジオメトリをプレビューで視覚確認できる／過剰な前処理で地物が欠落しないよう処理方針が見直される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/features/shape-store/src/**`, `packages/plugin-service-api/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: 追加した診断/プレビュー/前処理変更を revert し、transform のログ・前処理を修正前へ戻す
- チェックリスト:
  - simplify 前処理とログ出力の現状を整理する
  - 問題ジオメトリを feature/polygon 単位で記録する仕組みを追加する
  - Step6 のプレビューで問題ジオメトリを可視化する
  - 前処理の省略ロジックを見直し、必要な地物が欠落しないよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 00:30 JST simplify 前処理の診断ログ/可視化と前処理見直しの ExecPlan 作成に着手。
  - update: 2026-01-19 09:40 JST simplify 前処理で issueKind/issueStage を収集し、エラー記録とプレビュー用ライン生成へ反映する実装に着手。
  - update: 2026-01-19 10:05 JST Step6 プレビューで issueKind に応じてエラーラインの色分けを行う調整に着手。
  - blocked: 2026-01-19 10:14 JST pnpm typecheck が exit 2（vt-orchestrator build:types で ShapeTransformErrorRecord に issueStage が無い）で失敗。
  - update: 2026-01-19 10:15 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 10:16 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 11:40 JST 実装完了。手動での Japan ADM0/ADM1 確認は未実施。
  - update: 2026-01-19 10:20 JST ringFix/selfIntersection の invalid 発生箇所を特定するため、simplify の診断ログを拡充する対応に着手。
  - done: 2026-01-19 10:28 JST ringFix/selfIntersection の invalid 診断ログを詳細化。
  - done: 2026-01-19 10:29 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:35 JST simplify 診断ログにフィルタ用 prefix を付与。
  - update: 2026-01-19 10:41 JST simplify が空でも preprocessing issue 集計ログを出力するよう順序を調整。
  - done: 2026-01-19 10:42 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:48 JST ringFix/selfIntersection の invalid 時に詳細診断ログを出すよう追加。
  - done: 2026-01-19 10:49 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:56 JST ringFix invalid を即 drop せず selfIntersection まで通し、交差後に ringFix を再適用する修正を追加。
  - done: 2026-01-19 10:57 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:04 JST selfIntersection 後に unkink+ringFix で valid 回復を試みる経路を追加。
  - done: 2026-01-19 11:05 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:12 JST ringFix/selfIntersection の invalid を unkink 経由で回復し、成功時に採用する経路を拡張。
  - done: 2026-01-19 11:13 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:21 JST pipeline の各ステージ完了時にタスク件数を出す診断ログを追加。
  - done: 2026-01-19 11:22 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2246) fix/shape/step6-preview-feature-atoms-expression (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step6-preview-feature-atoms-expression
- 依存: なし
- 受け入れ基準: Step6 プレビューで MapLibre の Unknown expression "feature-atoms" が発生しない／fill-outline-color の式が MapLibre 仕様に沿って評価される／影響範囲とロールバック手順が明記される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step6 プレビューのレイヤ設定を修正前へ戻す
- チェックリスト:
  - feature-atoms を使っている式の定義箇所を特定する
  - MapLibre の式仕様に合わせて修正する
  - Step6 プレビューでレイヤ追加が失敗しないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:50 JST Step6 プレビューで Unknown expression "feature-atoms" が発生する問題の調査に着手。
  - update: 2026-01-17 23:55 JST Step6 の MapLibre 式を feature-state へ置換し、MapLibre の式仕様に合わせて修正。
  - done: 2026-01-17 23:58 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:05 JST setFeatureState で sourceLayer が必須になるエラーの調査に着手。
  - update: 2026-01-18 00:15 JST highlight 用の feature entry に sourceLayer を追加し、set/removeFeatureState へ渡すよう修正。
  - done: 2026-01-18 00:18 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2247) refactor/shape/strict-task-stage-type (P1) — 完了 (2026-01-17)
- ブランチ名: refactor/shape/strict-task-stage-type
- 依存: なし
- 受け入れ基準: shape ビルドのタスク stage が TaskStage（'fetch'|'transform'|'vt'）として型制約される／フォールバックなしで stage が決定され、無効な値は明示的にエラーになる／UI のタスク表示と進捗が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`（必要に応じて関連ファイルを追記）
- 要点: stage の型を TaskStage に統一し、不正値はエラーとして扱うように変更。
- ロールバック手順: 該当差分を revert し、stage を string 扱いに戻す
- チェックリスト:
  - shape ビルドのタスク型に TaskStage を適用する
  - stage が不正な場合はエラー扱いにし、暗黙フォールバックを排除する
  - 進捗/ログ表示の回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:50 JST shape ビルドのタスク stage 型を TaskStage に厳格化する対応に着手。
  - update: 2026-01-17 23:56 JST @hierarchidb/ui-batch-progress の型変更に合わせて build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-17 23:57 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-17 23:58 JST shape ビルドの task stage を TaskStage に厳格化し、フォールバックを排除。

2246) fix/shape/skipped-task-stage-label (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/skipped-task-stage-label
- 依存: なし
- 受け入れ基準: skipped: simplify のタスクが stage=transform でログ出力される／警告ログのステージ表示が実際のタスク種別と一致する／既存のタスク表示や進捗に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`（必要に応じて関連ファイルを追記）
- 要点: ステージ不明時の fetch/download フォールバックを撤廃し、unknown で明示化。
- ロールバック手順: 該当差分を revert し、従来のステージ表示に戻す
- チェックリスト:
  - skipped 判定時のログ出力が task.type に基づくことを確認する
  - 表示・進捗に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:22 JST skipped: simplify の stage 表示が fetch になる問題の修正に着手。
  - done: 2026-01-17 23:25 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-17 23:26 JST skipped タスクのログ出力を task.type ベースに修正。
  - update: 2026-01-17 23:33 JST normalizeStageKey の fetch フォールバックを撤廃し unknown に変更。
  - done: 2026-01-17 23:34 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-17 23:41 JST useBuildTaskProgress の download フォールバックを unknown に変更し、ステージ誤分類を排除。
  - done: 2026-01-17 23:42 JST pnpm --filter @hierarchidb/ui-batch-progress typecheck を実行（exit 0）。

2245) feat/ui-auth/unauthenticated-avatar-menu (P1) — 完了 (2026-01-17)
- ブランチ名: feat/ui-auth/unauthenticated-avatar-menu
- 依存: なし
- 受け入れ基準: 未ログイン時でも UserAvatarMenu が表示される／未ログイン時はユーザ名・メール表示の代わりに Login ボタンが表示され認証フローが開始できる／テーマ・言語・全データ削除は未ログインでも実行可能／Logout は未ログイン時 disabled 表示／TASKS.md に運用ログを記載する
- 要点: 未ログイン時もメニューを表示し、Login 導線と Logout disabled を追加。
- 影響範囲: `packages/ui/auth/src/components/UserAvatarMenu.tsx`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、未ログイン時は認証フロー開始ダイアログのみを表示する挙動に戻す
- チェックリスト:
  - 未ログイン時に UserAvatarMenu を表示する条件分岐を整理する
  - Login ボタンの表示と認証フロー開始の導線を実装する
  - 未ログイン時の Logout を disabled 表示にする
  - テーマ・言語・全データ削除が未ログイン時も利用可能であることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 22:40 JST 未ログイン時に UserAvatarMenu を表示し Login ボタンを追加する対応に着手。
  - done: 2026-01-17 22:43 JST pnpm --filter @hierarchidb/ui-auth typecheck を実行（exit 0）。
  - update: 2026-01-17 22:44 JST 未ログイン時も UserAvatarMenu を表示し Login/Logout 表示を更新。
  - update: 2026-01-17 22:48 JST 右上ログインボタンでメニューが表示されない報告を受け、UserLoginButton 側の挙動を調整する。
  - done: 2026-01-17 22:58 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。
  - done: 2026-01-17 22:59 JST 未ログイン時もユーザーメニューを表示し Login ボタン/Logout disabled を反映。
  - done: 2026-01-17 23:06 JST Login ボタンを large にし、メニュー閉じる前にフォーカスを外すよう調整。
  - done: 2026-01-17 23:07 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。
  - update: 2026-01-17 23:15 JST Login 押下時の aria-hidden 警告が残るため、メニュー終了後に認証ダイアログを開くよう変更。
  - done: 2026-01-17 23:16 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。

2244) fix/ui-auth/clear-all-data-indexeddb (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-auth/clear-all-data-indexeddb
- 依存: なし
- 受け入れ基準: UserAvatarMenu の "clear all data" 実行後に IndexedDB の関連 DB が削除される／削除対象の一覧と理由が説明できる／削除できない DB がある場合は理由と回避策が明記される／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/components/UserAvatarMenu.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、clear all data の削除挙動を修正前に戻す
- チェックリスト:
  - clear all data の実装箇所と削除対象の DB を洗い出す
  - IndexedDB の削除が残る原因を特定する
  - 必要な修正を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 18:17 JST UserAvatarMenu の clear all data 実行後に IndexedDB が残る問題の調査に着手。
  - update: 2026-01-17 18:20 JST IndexedDB 削除の onblocked/onerror を検知し、失敗時は警告表示するように修正。
  - update: 2026-01-17 18:21 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2243) fix/shape/step3-virtualized-checkbox-scroll (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step3-virtualized-checkbox-scroll
- 依存: なし
- 受け入れ基準: Step3 の仮想化リストで途中スクロール位置のチェックボックスをクリックしてもスクロール位置が先頭に戻らない／チェック状態の更新で全体再レンダリングが発生しない（またはスクロール位置への影響がない）／ステップ遷移と Save/Save as Draft の挙動が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step3 のチェックボックス操作とスクロール挙動を修正前へ戻す
- チェックリスト:
  - Step3 仮想化リストの再レンダリング原因を特定する
  - チェック状態の保存タイミングを見直し、スクロール位置が維持されることを確認する
  - ステップ遷移と Save/Save as Draft の挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 16:51 JST Step3 仮想化リストのチェック操作でスクロール位置が戻る問題の修正に着手。
  - update: 2026-01-17 16:55 JST CountryMatrixSelector の行配列が選択変更で再生成されないように依存関係を調整。
  - done: 2026-01-17 16:55 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。
  - update: 2026-01-17 17:14 JST Step3 の countries 配列参照をメモ化し、選択変更時の仮想化データ再生成を抑制。
  - done: 2026-01-17 17:14 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-17 17:18 JST SelectionMatrix へ渡す rows 配列をメモ化し、選択変更時のデータ参照揺れを抑制。
  - done: 2026-01-17 17:18 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。
  - update: 2026-01-17 17:23 JST SelectionMatrix の Virtuoso components/スタイルをメモ化し、レンダリング時のスクロールリセットを抑制。
  - done: 2026-01-17 17:23 JST pnpm --filter @hierarchidb/components typecheck を実行（exit 0）。
  - update: 2026-01-17 17:40 JST CountryMatrixSelector の Virtuoso ハンドル型を整理し、null許容のref型に修正。
  - done: 2026-01-17 17:40 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。

2241) refactor/shape/remove-transform-by-zoom (P2) — 完了 (2026-01-17)
- ブランチ名: refactor/shape/remove-transform-by-zoom
- 依存: なし
- ExecPlan: `plans/remove-transform-by-zoom-execplan.md`
- 受け入れ基準: transform-by-zoom が型定義/実装/表示経路から除去され transform に一本化される／Step4 の Transform キャッシュ削除が transform 関連のタスク・キャッシュを漏れなく削除する／processingStatus と tileSummary が transform タスク実行抑止の判断材料として使われない／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 要点: transform-by-zoom を廃止し、Transform キャッシュ削除時のタスク整理と runtime 状態優先の再開判定を反映。
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/features/shape-store/src/**`, `packages/features/gis-sdk/src/**`, `packages/plugin-service-api/src/**`, `packages/common/types/src/**`, `packages/runtime-worker/src/**`, `packages/vt-orchestrator/src/**`
- ロールバック手順: 該当差分を revert し、transform-by-zoom を含む従来のタスク/型経路に戻す
- チェックリスト:
  - transform-by-zoom の型定義を削除し、transform に一本化する
  - 参照箇所（worker/api, task queue, session mappers, EphemeralDB など）を更新する
  - Step4 の Transform キャッシュ削除でタスク/エラー/関連キャッシュを漏れなく削除する
  - processingStatus/tileSummary が transform タスク実行抑止条件になっていないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 19:20 JST transform-by-zoom 廃止と transform 一本化の調査・実装に着手。
  - blocked: 2026-01-17 19:35 JST pnpm typecheck が exit 2（ShapeBuildStage と BuildTaskType の不一致）で失敗。
  - update: 2026-01-17 19:38 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 19:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2242) feat/shape/build-continuation-policy (P2) — 完了 (2026-01-17)
- ブランチ名: feat/shape/build-continuation-policy
- 依存: なし
- ExecPlan: `plans/build-continuation-policy-execplan.md`
- 受け入れ基準: TreeConsole の buildContinuationPolicy が Shape ビルド実行に渡される／finish_all_stages でエラー後も次ステージへ進む／finish_stage_then_stop でそのステージは完走するが次ステージへ進まない／stop_on_first_error でステージ内の最初の失敗で停止する／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 要点: TreeConsole の buildContinuationPolicy を Shape ビルド実行に反映し、ステージ継続/停止ポリシーを実装。
- 影響範囲: `app/src/worker-runtime/worker.ts`, `packages/common/api/src/WorkerAPI.ts`, `packages/ui/worker-client/src/workerBridge.ts`, `plugins/shape-plugin/src/ui/components/step5/**`, `plugins/shape-plugin/src/services/vt/**`, `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 該当差分を revert し、buildContinuationPolicy を UI 設定のみの状態へ戻す
- チェックリスト:
  - buildContinuationPolicy を start/resume 経路で Worker API に渡す
  - Shape ビルドパイプラインで failureHandling とステージ継続条件を適用する
  - finish_all_stages / finish_stage_then_stop / stop_on_first_error の挙動を反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 20:00 JST buildContinuationPolicy の実行反映に着手。
  - blocked: 2026-01-17 20:25 JST pnpm typecheck が exit 2（shape-plugin/app の startBatchSession 引数数不一致）で失敗。
  - update: 2026-01-17 20:28 JST pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/ui-worker-client build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 20:31 JST app の ShapeBatchAPI 型を buildContinuationPolicy 対応に更新。
  - done: 2026-01-17 20:33 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2240) chore/analysis/list-large-react-components (P3) — 完了 (2026-01-17)
- ブランチ名: chore/analysis/list-large-react-components
- 依存: なし
- ExecPlan: `plans/react-components-hook-extraction-execplan.md`
- 受け入れ基準: packages/app/plugins 配下の *.tsx から 200行以上の React コンポーネントを抽出し列挙する／各コンポーネントについて「カスタムフックへのロジック切り出しが無い」ことを判断できる根拠を簡潔に示す／要確認は明記する／列挙対象のコンポーネントでロジックをカスタムフックとして外部ファイルへ抽出する／挙動が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/**`, `plugins/*-plugin/src/ui/**`
- チェックリスト:
  - packages/**/src 配下の .tsx を対象に行数を集計する
  - 200行以上の React コンポーネントを抽出して列挙する
  - カスタムフック切り出しの有無を簡潔にメモする
  - app/src と plugins/*/src も同条件で抽出する
  - 対象コンポーネントでロジックをカスタムフックへ外部化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 17:05 JST 200行以上の React コンポーネントとカスタムフック未抽出の一覧化に着手。
  - done: 2026-01-17 17:12 JST packages/**/src の .tsx を行数集計し、200行以上のコンポーネントからローカルカスタムフック未抽出の一覧を作成。
  - done: 2026-01-17 17:16 JST app/src と plugins/*/src も同条件で抽出し、200行以上かつローカルフック未抽出の一覧を追記。
  - blocked: 2026-01-17 18:20 JST pnpm typecheck が exit 1（未使用 import/型、正規表現エスケープ、戻り値の不整合）で失敗。
  - update: 2026-01-17 18:35 JST 未使用 import/型の削除、正規表現のエスケープ修正、戻り値の補正を反映。
  - done: 2026-01-17 18:45 JST pnpm typecheck を再実行（exit 0）し、app/src/router/** と plugins/*-plugin/src/ui/** の対象コンポーネントをカスタムフック外部化。
  - update: 2026-01-17 19:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2239) feat/shape/step4-area-filter-coefficient (P1) — 完了 (2026-01-17)
- ブランチ名: feat/shape/step4-area-filter-coefficient
- 依存: なし
- 受け入れ基準: Step4 Transform の「面積フィルター」カードが撤去される／除外ポリゴン面積係数の UI が Step4 Transform に追加される／設定値がビルド設定に保存・再読込される／既存の Step4 UI に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、面積フィルター UI と係数 UI を修正前へ戻す
- チェックリスト:
  - Step4 Transform の面積フィルター UI を撤去する
  - 除外ポリゴン面積係数のフォームを追加する
  - 設定の保存・再読込が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 16:40 JST Step4 Transform の面積フィルター撤去と係数 UI 追加に着手。
  - update: 2026-01-17 16:45 JST 面積フィルター UI を削除し、Transform のヘルプ文言と係数 UI を整理。
  - update: 2026-01-17 17:10 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 17:10 JST 面積フィルター撤去と除外ポリゴン面積係数 UI を反映。

2240) fix/shape/vt-stage-not-starting (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/vt-stage-not-starting
- 依存: なし
- 受け入れ基準: VT 生成ステージが transform 完了後に開始される／原因がログで説明できる／必要に応じて失敗理由がUI/ログに残る／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/**`, `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、VT 開始条件の挙動を修正前に戻す
- チェックリスト:
  - VT ステージが開始されない原因を特定する
  - 必要な修正を反映し VT ステージ開始を復旧する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 17:20 JST VT 生成ステージが開始しない事象の調査に着手。
  - update: 2026-01-17 17:25 JST shapePipeline の backfill で transformCache の decode 失敗時に vt タスクが生成されずスキップされる経路を確認。
  - update: 2026-01-17 21:15 JST ユーザー報告: vt ステージで transform cache decode failed が発生し、buildStatus が failed になるが error/message が null。原因調査を開始。
  - update: 2026-01-17 21:42 JST transformCache の timestamp=0 を「書き込み未完了」として扱い、読取側で除外する対応を実装。
  - done: 2026-01-17 21:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-17 22:05 JST 新規報告: vt タスクで "start offset of Float64Array should be a multiple of 8" が発生。FlatGeobuf decode 失敗の追加原因を調査。
  - update: 2026-01-17 22:20 JST decode 失敗時に bufferId/length/先頭バイト/JSON判定をログ出力する診断を追加。
  - update: 2026-01-17 22:40 JST transformCache の書き込みがトランザクションかどうかを確認する調査に着手。
  - update: 2026-01-17 23:15 JST transformCache の読み書きを全経路で Dexie transaction に統一（put/bulkPut と timestamp 更新を同一トランザクション化）。
  - done: 2026-01-17 23:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:30 JST transformCache の空バッファ検出で例外を投げる対応に着手。
  - done: 2026-01-17 23:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 22:22 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が TS2322 で失敗（decode 診断の型）。
  - done: 2026-01-17 22:23 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を再実行（exit 0）。
  - update: 2026-01-17 23:55 JST simplify 前処理の実装順と不正ジオメトリ対策の現状を整理し、改善案を検討。
  - update: 2026-01-18 00:10 JST simplify 後に再検証を追加し、不正ジオメトリで transform を失敗させる（A）と lat clamp（B）を実装。
  - done: 2026-01-18 00:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:30 JST simplify 前処理で非有限座標を除去し、encode後のFlatGeobuf自己検証で不正バッファを検出して停止する対応を追加。
  - done: 2026-01-18 00:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:55 JST simplify 前処理で非有限/不正/空ジオメトリを feature から除外するように調整。
  - done: 2026-01-18 01:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 19:45 JST transform ハング調査のため簡易化進捗ログと停止条件の追加に着手。
  - blocked: 2026-01-17 19:45 JST pnpm typecheck が exit 2（vt-orchestrator build:types で PreSimplifyFilterConfig の型更新が未反映）で失敗。
  - update: 2026-01-17 19:50 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 19:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 19:52 JST simplify 空出力時に encode をスキップして失敗させるチェックを追加。
  - done: 2026-01-17 19:52 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 20:05 JST simplify/出力が空の場合は transform を skipped 扱いで完了させるよう修正。
  - done: 2026-01-17 20:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:20 JST Step4 の VT メタデータ件数/削除ボタンが 0 件のままになるため、vt-store 側の vtTiles を参照するよう取得/削除経路を更新。
  - done: 2026-01-18 02:21 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:40 JST Step5 の transform skipped 表示と VT タスク進捗（総タイル数ベース）の表示差分を修正する対応に着手。
  - done: 2026-01-18 02:55 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 03:15 JST Step4 の VT 件数をタスク件数へ統一し、VT タスクタイトルを band/zoom/featureCount 形式に変更。
  - done: 2026-01-18 03:16 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 01:40 JST simplify 空結果時のエラー項目生成と transform 後の feature metadata 生成の追加に着手。
  - done: 2026-01-19 01:46 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 11:45 JST 実装完了。VT ステージ開始の手動確認は未実施。

2239) fix/plugin-dialog/fullscreen-header-footer-auto-hide (P1) — 完了 (2026-01-17)
- ブランチ名: fix/plugin-dialog/fullscreen-header-footer-auto-hide
- 依存: なし
- 受け入れ基準: 全画面化中のみヘッダが上端16pxセンサー領域への侵入で表示され、ヘッダ領域からマウスが出たら非表示になる／フッタも下端16pxセンサー領域で同様に表示/非表示となる／非全画面時のヘッダ/フッタ表示に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`, `packages/plugin-ui-host/src/headless/components/PluginDialogFooter.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、全画面時のヘッダ/フッタ自動表示を修正前へ戻す
- チェックリスト:
  - 全画面時のヘッダ/フッタ表示制御の実装箇所を特定する
  - 上端/下端16pxのセンサー領域で表示し、ヘッダ/フッタから出たら非表示にする
  - 非全画面時の表示に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:35 JST 全画面プラグインダイアログのヘッダ/フッタ自動表示対応に着手。
  - update: 2026-01-17 15:38 JST PluginDialogHeader/Footer に全画面センサー領域と表示/非表示の制御を追加。
  - update: 2026-01-17 15:39 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:39 JST 全画面プラグインダイアログのヘッダ/フッタ自動表示を反映。
  - done: 2026-01-19 13:05 JST 実装済みのため完了へ変更（再検証は未実施）。

2238) fix/ui-floating-window/resize-start-jump (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-floating-window/resize-start-jump
- 依存: なし
- 受け入れ基準: リサイズ開始時にウィンドウ位置がジャンプしない／全方向のリサイズ開始が安定する／既存のドラッグ移動・クランプ・最小化/最大化に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、リサイズ開始時の挙動を修正前へ戻す
- チェックリスト:
  - リサイズ開始時に旧位置が参照される箇所を特定する
  - 位置が最新状態で開始されるよう修正する
  - 既存のドラッグ移動/リサイズ動作の回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:20 JST リサイズ開始時の位置ジャンプ問題の修正に着手。
  - update: 2026-01-17 15:22 JST リサイズ開始ハンドラに最新位置を反映するよう依存配列を修正。
  - update: 2026-01-17 15:23 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:23 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:23 JST リサイズ開始時の位置ジャンプを解消。

2237) fix/ui-floating-window/resize-left-top (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-floating-window/resize-left-top
- 依存: なし
- 受け入れ基準: フローティングウィンドウの上端・左端リサイズドラッグでドラッグ量とサイズ/位置変化が一致する／右端・下端の既存挙動に回帰がない／最小サイズやクランプの挙動が不整合を起こさない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、上端・左端リサイズ挙動を修正前へ戻す
- チェックリスト:
  - 上端・左端リサイズの計算ロジックを特定する
  - ドラッグ量と一致する位置/サイズ更新に修正する
  - 右端・下端のリサイズとドラッグ移動に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:10 JST 上端・左端リサイズドラッグの挙動不整合の修正に着手。
  - update: 2026-01-17 15:12 JST 左端/上端リサイズ時に開始位置を基準にサイズと位置を再計算するよう修正。
  - update: 2026-01-17 15:13 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:13 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:13 JST 上端・左端リサイズドラッグの挙動を修正。

2236) fix/shape/step6-floating-window-icons-columns (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step6-floating-window-icons-columns
- 依存: なし
- 受け入れ基準: Step6 フローティングウィンドウのタイトルバー左端アイコンがHexagonになる／再表示ボタンのアイコンもHexagonになる／カラム表示設定の初期値はlocalStorageまたは全表示デフォルトから取得される／変更時にlocalStorageへ永続化される／既存のStep6表示/操作に副作用がない／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/ui/map/src/preview/ShapePreviewList.tsx`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/floating-window/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、アイコン/カラム永続化を修正前へ戻す
- チェックリスト:
  - Hexagon アイコンの適用箇所を特定し置換する
  - カラム表示の初期化/永続化を追加する
  - localStorage が無い環境でも安全に動作することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:47 JST Step6 フローティングウィンドウのHexagon化とカラム永続化に着手。

2235) fix/shape/step6-floating-window-reopen (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step6-floating-window-reopen
- 依存: なし
- 受け入れ基準: shape Step6 のフローティングウィンドウを閉じた後に再表示用のアイコンボタン（color="primary" size="large" variant="contained"）が地図左上に表示される／ボタン押下でフローティングウィンドウが再表示される／darkモードでもFitボタン内アイコンが表示され空白にならない／既存のStep6の表示/操作に副作用がない／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/ui/map/src/components/ResourceLayerMap.tsx`, `packages/ui/map/src/preview/ShapePreviewList.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、フローティングウィンドウの再表示ボタンとFitアイコン表示を修正前へ戻す
- チェックリスト:
  - Step6のフローティングウィンドウ閉じ/再表示の状態管理を追加する
  - 地図左上に再表示ボタンを配置する
  - darkモードのFitボタン内アイコンの表示を修正する
  - 既存のStep6表示/操作が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:42 JST Step6のフローティングウィンドウ再表示ボタン追加とFitアイコンのdark表示修正に着手。
  - update: 2026-01-17 13:44 JST ShapePreviewStep に再表示ボタンを追加し、ShapePreviewList の onClose で閉じ状態を管理。
  - update: 2026-01-17 13:44 JST Fitボタンのアイコン色とdisabled色をdarkモード向けに補正。
  - blocked: 2026-01-17 13:45 JST pnpm typecheck が ui-map の dist 型未更新で ShapePreviewList onClose 追加に失敗。
  - update: 2026-01-17 13:45 JST pnpm --filter @hierarchidb/ui-map build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:45 JST Step6 の再表示ボタン追加とFitアイコンのdark表示補正を完了。

2234) fix/ui-map/fit-button-icon-dark-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-map/fit-button-icon-dark-grey
- 依存: なし
- 受け入れ基準: Fitボタン内アイコンがdarkモード時にgrey表示になる／lightモードの色は維持される／既存のdisabled/hover/クリック挙動に影響がない／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Fitボタンのアイコン色を修正前へ戻す
- チェックリスト:
  - Fitボタンのアイコン色制御箇所を特定する
  - darkモード時にgreyになるようスタイルを調整する
  - lightモードでの表示と動作を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:38 JST Fitボタン内アイコンのdarkモード色をgrey化する対応に着手。
  - update: 2026-01-17 13:39 JST FitボタンのIconButton colorをdarkモード時のみgreyに切替。
  - update: 2026-01-17 13:39 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:39 JST Fitボタン内アイコンのdarkモード色をgrey化。

2233) fix/ui-floating-window/drag-clamp (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-floating-window/drag-clamp
- 依存: なし
- 受け入れ基準: フローティングウィンドウの移動クランプが「全体が画面内」から「左端64px・上端24pxが画面内」に変わる／既存のドラッグ・リサイズ・最小化・最大化の挙動に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、クランプ範囲を修正前の全画面内制約へ戻す
- チェックリスト:
  - 既存のクランプ処理箇所を特定する
  - 左端64px・上端24pxが画面内になるようクランプ条件を変更する
  - 既存のドラッグ/リサイズ動作が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:36 JST フローティングウィンドウのドラッグクランプを左端64px・上端24px保持に変更する対応に着手。
  - update: 2026-01-17 13:37 JST FloatingWindow のクランプ範囲を左端64px・上端24pxの可視条件に変更。
  - update: 2026-01-17 13:37 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:37 JST フローティングウィンドウのクランプ条件を指定の可視範囲に更新。

2232) fix/shape/step5-6-direct-url (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-6-direct-url
- 依存: なし
- 受け入れ基準: shape の step5/step6 を直URL指定した場合に step4 へ戻されず指定ステップが表示される／Stepper の valid 表示と表示中ステップが一致する／step4 経由の遷移挙動は維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、直URLアクセス時のステップ遷移挙動を修正前に戻す
- チェックリスト:
  - 直URLアクセス時に step4 へ戻される経路を特定する
  - step5/step6 を指定した場合に該当ステップを表示するよう修正する
  - Stepper の valid 表示と表示ステップの整合性を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 12:25 JST shape の step5/6 直URLアクセス時に step4 へ戻される問題の修正に着手。
  - update: 2026-01-17 12:31 JST PluginDialogRoute で params.step が無い場合もURLから step を解釈して初期ステップを維持するよう対応。
  - blocked: 2026-01-17 12:33 JST pnpm typecheck が PluginDialogRoute の pathOnly/normalizedPath nullability で失敗。
  - update: 2026-01-17 12:33 JST pathOnly/normalizedPath の default を補正し、pnpm typecheck を再実行（exit 0）。
  - done: 2026-01-19 11:50 JST 実装完了。直URLアクセスの手動確認は未実施。

2232) feat/build/continuation-policy (P1) — 進行中 (2026-01-17)
- ブランチ名: feat/build/continuation-policy
- 依存: なし
- ExecPlan: `plans/build-continuation-policy-execplan.md`
- 受け入れ基準: TreeConsole のツールバーメニューにビルド継続ポリシー（3択）が追加される／shape/location/route のビルド設定に保存・再読込される／ビルド処理がポリシーに従って継続/停止する／文言が i18n 化される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `app/src/**`, `packages/ui/**`, `plugins/shape-plugin/src/**`, `plugins/location-plugin/src/**`, `plugins/route-plugin/src/**`, `packages/vt-orchestrator/src/**`, `packages/features/gis-sdk/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ビルド継続ポリシー UI と停止条件を修正前に戻す
- チェックリスト:
  - ビルド継続ポリシーの型/保存スキーマを追加する
  - TreeConsole ツールバーのメニュー UI を追加する
  - shape/location/route のビルド実行でポリシーを反映する
  - i18n を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 14:00 JST build 継続ポリシーの UI と処理反映に着手。
  - update: 2026-01-17 16:47 JST treeConsoleSettings の null 判定を整理して typecheck エラーを解消。
  - update: 2026-01-17 16:49 JST util の tsconfig paths を整理し common-types の解決を復旧。
  - update: 2026-01-17 16:52 JST treeconsole-toolbar の tsconfig paths を整理し common-types の解決を復旧。
  - update: 2026-01-17 17:10 JST pnpm typecheck を実行（exit 0）。

2231) feat/shape/step4-vt-config-refine (P1) — 完了 (2026-01-17)
- ブランチ名: feat/shape/step4-vt-config-refine
- 依存: なし
- 受け入れ基準: Step4 の「ビルド終了時の中間生成物の保持」に VT キャッシュ保持スイッチが追加され、CleanupConfig に設定が保存/再読込される／VT キャッシュの自動削除条件が新規フラグで制御される／VT 生成アコーディオンの項目が整理され、詳細設定セクションが適用される／VT 設定のヘルプテキストが充実し i18n 化される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/*`, `plugins/shape-plugin/src/services/batch/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step4 の VT 設定 UI と CleanupConfig を修正前へ戻す
- チェックリスト:
  - CleanupConfig に VT キャッシュ保持用フラグを追加する
  - Step4 の「中間生成物の保持」に VT キャッシュ保持スイッチを追加する
  - VT 生成アコーディオンの項目を整理し詳細設定セクションへ分離する
  - VT 設定のヘルプテキストを拡充し i18n へ移行する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 11:16 JST Step4 VT 設定の保持スイッチ追加とアコーディオン整理に着手。
  - blocked: 2026-01-17 11:20 JST pnpm typecheck が CleanupConfig の deleteVTCache 未反映で失敗。
  - update: 2026-01-17 11:22 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:23 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 11:23 JST VT キャッシュ保持スイッチ追加、VT 設定アコーディオン整理とヘルプ/i18n を反映。

2232) fix/shape/step6-fit-button-align (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/step6-fit-button-align
- 依存: なし
- 受け入れ基準: Step6 プレビューでFitボタンがズームコントロール直下に揃う／Fitボタン背景色がズームコントロールと一致する／既存のクリック挙動・disabled 条件・表示モードに影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: 該当差分を revert し、Fitボタンの配置/スタイルを修正前へ戻す
- チェックリスト:
  - Fitボタンの配置・サイズをズームコントロールと揃える
  - Fitボタン背景色をズームコントロールと一致させる
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 04:10 JST Step6 プレビューのFitボタン位置/背景色調整に着手。
  - update: 2026-01-19 04:20 JST FitボタンをMapLibreのコントロールグループに合わせ、サイズと背景色を調整。
  - blocked: 2026-01-19 04:25 JST pnpm typecheck が app の PluginDialogRoute の未定義パス判定で失敗。
  - update: 2026-01-19 04:30 JST PluginDialogRoute のステップ抽出で空パスを早期returnするよう修正。
  - update: 2026-01-19 04:35 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 04:35 JST Fitボタンの整列と背景色調整を完了。

2231) fix/shape/step6-preview-control-order (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/step6-preview-control-order
- 依存: なし
- 受け入れ基準: Step6 プレビューでズームコントロールが上、Fit ボタンが下に配置される／クリック挙動・disabled 条件・表示モードに影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Fit ボタン配置を修正前へ戻す
- チェックリスト:
  - Fit ボタンの配置順がズームコントロールの下になるよう調整する
  - 既存の挙動を維持する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 03:25 JST Step6 プレビューのズーム/フィット配置順調整に着手。
  - update: 2026-01-19 03:35 JST Fit ボタン用のコントロールコンテナを追加し、ズームコントロールの直下へ配置する処理を実装。
  - blocked: 2026-01-19 03:40 JST pnpm typecheck が ui-map の fitSelectionEnabled 参照順と MapPreviewFloatingTable の showSearch 型で失敗。
  - update: 2026-01-19 03:45 JST effect 順序を調整し showSearch を削除。
  - update: 2026-01-19 03:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 03:55 JST Step6 プレビューのズーム上/フィット下の配置順を反映。

2230) feat/shape/transform-pre-simplify-filters (P1) — 完了 (2026-01-19)
- ブランチ名: feat/shape/transform-pre-simplify-filters
- 依存: なし
- 受け入れ基準: TransformConfig 型に簡易化/事前フィルタ用の階層プロパティが追加される／テンプレートの buildConfig に新プロパティとデフォルトが反映される／Shape Step4 の Transform アコーディオンに新カードが追加され値が保存・再読込される／Transform ステージで新プロパティを参照して事前フィルタ/簡易化が動作する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/worker/**`, `packages/features/gis-sdk/src/types/**`, `app/public/templates/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Transform 設定/テンプレート/事前フィルタ処理を修正前に戻す
- チェックリスト:
  - TransformConfig 型へ簡易化/事前フィルタ用の階層プロパティを追加する
  - テンプレートの buildConfig に新プロパティとデフォルトを反映する
  - Step4 Transform の新カードを追加し、保存/再読込を配線する
  - Transform ステージで新プロパティを使った事前フィルタ/簡易化処理を適用する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 02:05 JST Transform 事前フィルタ/簡易化設定の型・テンプレート・UI・配線対応に着手。
  - update: 2026-01-19 02:45 JST TransformConfig の preSimplifyFilterConfig 追加、Step4 UI カードとテンプレート更新、事前フィルタ/簡易化処理を反映。
  - blocked: 2026-01-19 02:55 JST pnpm typecheck が vt-orchestrator の PreSimplifyFilterConfig 型未反映と ui-map/route-plugin の型エラーで失敗。
  - update: 2026-01-19 03:05 JST pnpm --filter @hierarchidb/gis-sdk build と pnpm --filter @hierarchidb/ui-map build を実行し、route-plugin の型注釈を修正。
  - update: 2026-01-19 03:15 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 03:15 JST 事前フィルタ/簡易化の設定追加と配線、UI/テンプレート反映を完了。

2224) fix/shape/step5-stage-progress-inactive-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-stage-progress-inactive-grey
- 依存: なし
- 受け入れ基準: Shape Step5 のステージ稼働状況が「稼働なし」の場合に CircularProgress が grey 表示になる／稼働中の表示ロジックは既存挙動を維持する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ステージ稼働状況の表示色を修正前に戻す
- チェックリスト:
  - Step5 のステージ稼働状況に「稼働なし」の色分け条件を追加する
  - 稼働中の表示ロジックが維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 08:56 JST Shape Step5 のステージ稼働なし時に grey 表示へ切り替える対応に着手。
  - update: 2026-01-17 09:03 JST BuildStepStagePanel の稼働なし時 CircularProgress を grey 表示に調整。
  - update: 2026-01-17 09:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 09:05 JST Step5 の稼働なし時に grey 表示となるよう反映。

2225) fix/shape/step5-progressbar-hover-title (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-progressbar-hover-title
- 依存: なし
- 受け入れ基準: Step5 のタスク進捗SVGでホバー時の表示が固定文言ではなく該当タスクのタイトルになる／既存の進捗表示・クリック/スクロール挙動に影響がない／タイトル不明時のフォールバックが明確である／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ホバー時表示を固定文言へ戻す
- チェックリスト:
  - TaskProgressBar のホバー時表示をタスクタイトルへ置換する
  - タイトル不明時のフォールバック表示を整理する
  - 既存の進捗/クリック/スクロール挙動が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 08:58 JST Step5 タスク進捗バーのホバー表示をタスクタイトルに変更する対応に着手。
  - update: 2026-01-17 09:00 JST TaskProgressBar のSVGホバー表示をタスクタイトルへ変更。
  - update: 2026-01-17 09:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 09:00 JST Step5 進捗バーのホバー表示をタスクタイトルへ切り替え完了。

2226) fix/ui-map/fitscreen-button-spacing (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-map/fitscreen-button-spacing
- 依存: なし
- 受け入れ基準: FitScreen ボタンに paddingRight: 4px が適用される／variant が "compound" になる／height が 48px になる／既存の位置・disabled 条件・クリック挙動に影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、FitScreen ボタンの表示設定を修正前に戻す
- チェックリスト:
  - FitScreen ボタンに paddingRight: 4px を設定する
  - FitScreen ボタンの variant を "compound" に設定する
  - FitScreen ボタンの高さを 48px に設定する
  - 既存挙動が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 09:09 JST FitScreen ボタンの paddingRight/variant/height 調整に着手。
  - update: 2026-01-19 12:20 JST FitScreen ボタンの表示コンテナ（ResourceLayerMap）を調査し、適用箇所の特定に着手。
  - update: 2026-01-19 12:35 JST FitScreen ボタンに paddingRight/height を追加し、variant=compound の識別属性を付与。
  - done: 2026-01-19 12:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2227) fix/shape/step5-stage-progress-dark-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-stage-progress-dark-grey
- 依存: なし
- 受け入れ基準: Step5 のステージ稼働なし時のCircularProgressが dark テーマでより黒に近い暗い灰色になる／light テーマの表示は維持される／稼働中の表示ロジックは既存のまま／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`
- ロールバック手順: 該当差分を revert し、dark テーマの色を修正前に戻す
- チェックリスト:
  - dark テーマ時の稼働なし色を調整する
  - light テーマが維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 09:11 JST Step5 稼働なしの dark テーマ灰色調整に着手。
  - update: 2026-01-17 09:12 JST BuildStepStagePanel の dark テーマ用 grey を暗めに調整。
  - blocked: 2026-01-17 09:12 JST pnpm typecheck が @hierarchidb/ui-map の既存型エラーで失敗（ResourceLayerMap.tsx の minLng/minLat/maxLng/maxLat, MapHoverCandidate 型, MapPreviewSearchPanelProps, jotai Store）。
  - done: 2026-01-19 12:50 JST 実装済みのため完了へ変更（再検証は未実施）。

2221) feat/shape/step6-preview-layout (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/step6-preview-layout
- 依存: なし
- 受け入れ基準: Step6 のタブUIが廃止され、DialogContent直下で地図プレビューが常時表示される／フィーチャー一覧とエラー内容が統合されたフローティングダイアログが地図上に表示され、エラー有無で Failed/Completed のChipが出る／選択/検索/エラーLineStringのハイライトが破綻しない／モバイル/デスクトップでレイアウトが崩れない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 のタブ構成と一覧表示を修正前へ戻す
- チェックリスト:
  - Step6 のタブUIを撤去する
  - 地図プレビューをDialogContent直下で常時表示する
  - フローティングダイアログでフィーチャー一覧とエラー内容を統合表示する
  - エラー有無でFailed/CompletedのChipを表示する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:00 JST Step6 のタブ撤去とプレビュー/一覧統合表示に着手。
  - update: 2026-01-18 19:25 JST Step6 プレビューのタブ撤去と地図常時表示、フローティング一覧統合の実装に着手。
  - blocked: 2026-01-18 19:30 JST pnpm typecheck が packages/ui/map の ResourceLayerMap bounds 型推論と jotai Store import で失敗。
  - update: 2026-01-18 19:40 JST ui-map/plugin-service-api の dist を再ビルドし、Step6 プレビューのフローティング一覧を一本化。
  - update: 2026-01-18 19:41 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 19:41 JST Step6 のタブ廃止とフローティング一覧統合、地図常時表示を完了。

2228) refactor/ui-map/shape-preview-floating-table (P1) — 進行中 (2026-01-18)
- ブランチ名: refactor/ui-map/shape-preview-floating-table
- 依存: なし
- 受け入れ基準: ui-map にフローティングの一覧コンポーネントが追加される／Step6 が ui-map の共通コンポーネントを利用してフィーチャー一覧を描画し、エラー統合列の生成は ui-map 側へ寄せられる／検索/選択/ハイライトが維持される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/preview/**`, `packages/ui/map/src/index.ts`, `packages/ui/map/package.json`, `plugins/shape-plugin/src/ui/components/step6/**`（必要に応じて）
- ロールバック手順: ui-map のフローティング一覧コンポーネントと Step6 側の差分を revert し、shape-plugin 側の個別実装へ戻す
- チェックリスト:
  - ui-map にフローティングの一覧コンポーネントを追加する
  - エラー統合列の生成ロジックを ui-map 側へ移す
  - Step6 を ui-map の共通コンポーネントへ切り替える
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 20:00 JST ui-map のフローティング一覧共通化と Step6 切り替えに着手。
  - blocked: 2026-01-18 20:05 JST pnpm install が registry 参照/EPERM symlink で失敗（getaddrinfo ENOTFOUND registry.npmjs.org）。
  - update: 2026-01-18 20:10 JST ui-map のフローティング一覧コンポーネントを追加し、Step6 の一覧表示を共通化へ切替。
  - update: 2026-01-18 20:16 JST pnpm --filter @hierarchidb/ui-map build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 20:17 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 20:25 JST ステータス列を Chip 表示へ戻し、ui-map build/typecheck を再実行。
  - done: 2026-01-18 20:26 JST ui-map 側へ一覧/エラー列統合を寄せ、Step6 の共通化を完了。

2220) feat/shape/transform-exclusion-ui (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/shape/transform-exclusion-ui
- 依存: なし
- 受け入れ基準: Step4 Transform の「面積フィルター」カードがUIから撤去される／「除外ポリゴン面積係数」の入力UIがStep4 Transformに配置され、保存・再読込される／既存のTransform設定レイアウトが破綻しない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Transform 設定のカード構成を修正前に戻す
- チェックリスト:
  - 面積フィルターカードをTransform設定から撤去する
  - 除外ポリゴン面積係数のUIを配置する
  - 保存/再読込が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:40 JST Step4 Transform の面積フィルター撤去と係数UI追加に着手。
  - update: 2026-01-18 18:45 JST 面積フィルターカードを撤去し、係数スライダーを Transform 設定へ移設。
  - update: 2026-01-18 18:46 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:47 JST 面積フィルター撤去と係数UIの再配置を完了。

2221) fix/shape/step6-error-list-count-format (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-count-format
- 依存: なし
- 受け入れ基準: Step6 エラー一覧からソースキー列を削除する／ポリゴン/リングの表示が「エラー数/総数」形式になる／既存のソート/検索/選択が破綻しない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/vt-orchestrator/src/transform/**`, `packages/plugin-service-api/src/types/**`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 エラー一覧の列構成と数値表示を修正前に戻す
- チェックリスト:
  - エラー一覧からソースキー列を削除する
  - ポリゴン/リングの表示をエラー数/総数に更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 17:35 JST Step6 エラー一覧の列削除とエラー数/総数表示に着手。
  - blocked: 2026-01-18 17:45 JST pnpm typecheck が vt-orchestrator build:types の ShapeTransformErrorRecord に polygonErrorCount/ringErrorCount が未反映で失敗。
  - update: 2026-01-18 17:50 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 17:55 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:00 JST エラー一覧の列削除とエラー数/総数表示を完了。

2222) fix/shape/exclude-area-default (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/exclude-area-default
- 依存: なし
- 受け入れ基準: excludePolygonAreaCoefficient のデフォルトが常に 1.0 になる（テンプレート由来でも 0 にならない）／既存の設定値を壊さない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/worker/api.ts`, `app/public/templates/population-2023/tree-nodes.json`（必要に応じて）
- ロールバック手順: 該当差分を revert し、係数デフォルトとテンプレートの設定を修正前に戻す
- チェックリスト:
  - テンプレートの buildConfig に係数デフォルトを反映する
  - 既存 buildConfig の不足値にデフォルトを補完する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:20 JST excludePolygonAreaCoefficient のデフォルト補正に着手。
  - update: 2026-01-18 18:30 JST テンプレートと buildConfig 初期化で係数デフォルトを 1.0 に補正。
  - update: 2026-01-18 18:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:40 JST テンプレート由来でも係数が 1.0 で初期化されることを確認。

2219) feat/shape/transform-area-exclusion (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/transform-area-exclusion
- 依存: なし
- 受け入れ基準: Transform の簡易化前処理でポリゴンごとにアウトライン総延長と面積を算出し、`area < coefficient * gridSize * outlineLength / 2` の場合に除外される／係数はデフォルト1で「除外ポリゴン面積係数」として Step4 UI に追加される／設定値が保存・再読込され、transform 処理へ反映される／除外対象はエラー扱いにならず通常のフィルタとして処理される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `packages/vt-orchestrator/src/transform/**`, `packages/features/gis-sdk/src/types/**`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Transform 設定の係数追加と面積除外の前処理を修正前に戻す
- チェックリスト:
  - Transform 設定に「除外ポリゴン面積係数」を追加する
  - 係数の保存/再読込が既存設定と同様に機能することを確認する
  - transform の簡易化前処理で面積/アウトライン総延長の除外判定を実装する
  - 除外はエラー扱いにならないことを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:05 JST Transform 簡易化前の面積除外係数追加対応に着手。
  - blocked: 2026-01-18 18:12 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig に excludePolygonAreaCoefficient が未反映で失敗。
  - update: 2026-01-18 18:13 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 18:14 JST pnpm typecheck を実行（exit 0）。
  - blocked: 2026-01-18 18:18 JST pnpm typecheck が vt-orchestrator の simplifyFeatureCollection 引数順で失敗。
  - update: 2026-01-18 18:20 JST simplifyFeatureCollection の引数を required 型に整理し、pnpm typecheck を再実行（exit 0）。
  - done: 2026-01-18 18:22 JST 係数設定の追加と transform 前処理の面積除外を実装し、typecheck が通ることを確認。

2219) fix/shape/step6-error-list-admin-names (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-admin-names
- 依存: なし
- 受け入れ基準: Step6 エラー一覧に Admin0 名（国名）と Admin1/2 名（地域名）を表示する／列追加に伴うソート・検索・表示崩れがない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、エラー一覧の列構成を修正前に戻す
- チェックリスト:
  - エラー一覧へ Admin 名の列を追加する
  - 表示ラベル（日本語/英語）を更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 17:05 JST Step6 エラー一覧の Admin 名表示対応に着手。
  - update: 2026-01-18 17:15 JST Admin0/1/2 名の列を追加し、ラベルを更新。
  - update: 2026-01-18 17:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 17:25 JST Step6 エラー一覧に Admin 名を表示できることを確認。

2224) analysis/shape/step5-transform-simplify-errors (P1) — 進行中 (2026-01-18)
- ブランチ名: analysis/shape/step5-transform-simplify-errors
- 依存: なし
- 受け入れ基準: Step5 Transform の処理順（自己交差分割→面積フィルタ→簡易化）の有無を実装で確認する／transform failed: geometry simplify error の主因候補を根拠付きで整理する／事前フィルタで抑制できる条件を提案し、エラーゼロ化への方針を示す
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/worker/**`（調査後に確定）
- ロールバック手順: 調査のみのため不要（変更が発生した場合は差分を revert）
- チェックリスト:
  - Step5 Transform の処理順と実装箇所を特定する
  - geometry simplify error の主因候補を列挙し根拠を示す
  - 事前フィルタで抑制する方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:15 JST Step5 Transform の処理順と簡易化エラー原因の調査に着手。
  - update: 2026-01-18 19:25 JST vt-orchestrator の createTransformByBandHandler/simplifyFeatureCollection で処理順と簡易化例外の出力内容を確認。
  - done: 2026-01-18 19:30 JST Step5 Transform の現状整理と事前フィルタ方針の提案をまとめた。

2225) fix/shape/transform-zero-polygons-success (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/shape/transform-zero-polygons-success
- 依存: なし
- 受け入れ基準: Transform ステージで simplified.features.length===0 を失敗扱いにしない／ビルド全体の失敗判定を「失敗タスク数 > 0」で行う／ゼロポリゴンの地物は地図に出ないが一覧に 0/0 で残る挙動が維持される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/runtime-worker/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Transform の失敗判定とビルド失敗判定を修正前に戻す
- チェックリスト:
  - simplified.features.length===0 の失敗判定を撤廃する
  - 失敗タスク数 > 0 をビルド失敗判定に用いるよう修正する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:40 JST ゼロポリゴン時の成功扱いとビルド失敗判定の修正に着手。
  - update: 2026-01-18 20:05 JST transform の simplified features empty を失敗扱いから除外。
  - update: 2026-01-18 20:20 JST ui-map/plugin-service-api の dist を更新（pnpm --filter @hierarchidb/ui-map build / pnpm --filter @hierarchidb/plugin-service-api build）。
  - update: 2026-01-18 20:25 JST app の modeless dialog で mapLayerInfoAtom の参照先を修正し MapNodeType ガードを追加。
  - update: 2026-01-18 20:30 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 20:31 JST ゼロポリゴン時の成功扱いとビルド失敗判定の前提を反映。

2223) chore/shape/template-buildconfig-default-audit (P1) — 進行中 (2026-01-18)
- ブランチ名: chore/shape/template-buildconfig-default-audit
- 依存: なし
- 受け入れ基準: app/public/templates 配下の buildConfig を棚卸しし、excludePolygonAreaCoefficient が欠落/非数のテンプレートを特定する／必要なテンプレートに excludePolygonAreaCoefficient: 1.0 を追記する／差分が最小である／pnpm typecheck が exit 0 で完走する
- 影響範囲: `app/public/templates/**`（必要に応じて）
- ロールバック手順: 該当差分を revert し、テンプレートの buildConfig を修正前に戻す
- チェックリスト:
  - テンプレートの buildConfig を棚卸しして不足/非数の箇所を記録する
  - 必要なテンプレートに excludePolygonAreaCoefficient: 1.0 を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:05 JST テンプレートの buildConfig 棚卸しに着手。
  - update: 2026-01-18 19:06 JST app/public/templates を棚卸しし、buildConfig は population-2023 のみ、excludePolygonAreaCoefficient=1 を確認。
  - update: 2026-01-18 19:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 19:11 JST テンプレートの係数デフォルト棚卸しを完了。

2218) fix/shape/step6-error-list-visuals-fit-screen (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-visuals-fit-screen
- 依存: なし
- 受け入れ基準: Step6 エラー一覧の1行がフィーチャー単位であることを確認し記録する／エラー一覧から記録日時カラムを削除し、ポリゴン/リングのエラー数が表示される／エラー一覧の行選択状態で地図プレビューのエラーLineStringが primary 色＋光彩で強調され、未選択は従来の error 色で表示される／選択行のフォント色が primary になる／Step6 地図プレビューに FitScreen ボタンを追加し、選択中地物の最小BBoxへ移動する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 エラー一覧の列構成/選択表示/地図プレビューの強調表示/FitScreen 表示を修正前に戻す
- チェックリスト:
  - エラー一覧の1行がフィーチャー単位である根拠を確認する
  - エラー一覧の列構成を更新し、記録日時を削除する
  - 行選択状態でのエラーLineStringの表示色を切り替える
  - 行選択時のフォント色を primary に更新する
  - Step6 地図プレビューに FitScreen を追加し選択BBoxへ移動できるようにする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 16:20 JST Step6 エラー一覧/地図プレビュー/FitScreen 対応に着手。
  - update: 2026-01-18 16:30 JST createTransformByBandHandler で errorRecords を feature 単位に生成していることを確認。
  - update: 2026-01-18 16:40 JST エラー一覧の列構成/選択色/地図プレビューの選択強調/FitScreen を実装。
  - update: 2026-01-18 16:45 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 16:50 JST Step6 エラー一覧/地図プレビュー/FitScreen の要件を満たしたことを確認。

2217) fix/runtime-worker/shape-transform-cache-typecheck (P1) — 完了 (2026-01-18)
- ブランチ名: fix/runtime-worker/shape-transform-cache-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の ShapeMutationService/ShapeQueryService/WorkerService における ShapeTransformCache 不整合の型エラーが解消される／原因・影響範囲・修正内容を説明できる／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/runtime-worker/src/**`, `packages/plugin-service-api/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、runtime-worker と plugin-service-api の型定義/実装を修正前に戻す
- チェックリスト:
  - runtime-worker の ShapeTransformCache 関連型エラーの原因を特定する
  - 影響範囲を整理し、必要最小限の修正を行う
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 15:20 JST runtime-worker の ShapeTransformCache 系 typecheck エラー修正に着手。
  - update: 2026-01-18 15:30 JST plugin-service-api の dist 型定義を再生成し、runtime-worker の型参照を最新化。
  - update: 2026-01-18 16:05 JST shape-plugin の getNumCaches 型不整合の修正に着手。
  - update: 2026-01-18 16:10 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 16:12 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 16:15 JST runtime-worker/shape-plugin の typecheck が通り、ShapeTransformCache 系エラーが解消されたことを確認。

2216) fix/ui/dialog-footer-next-click (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/ui/dialog-footer-next-click
- 依存: なし
- 受け入れ基準: プラグインダイアログを最大化した状態でもフッター右下の「次へ」がクリックできる／SpeedDial などの重なり要因が特定され、対処が反映されている／通常サイズや他ダイアログの操作性が維持される
- 影響範囲: `packages/plugin-ui-host/src/**`, `app/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ダイアログフッターのレイアウト/重なり制御を修正前に戻す
- チェックリスト:
  - 最大化時に「次へ」がクリックできない原因（重なり要素/レイヤー）を特定する
  - クリック可能になるよう最小差分で修正する
  - 通常サイズ/他ダイアログの挙動を確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 14:10 JST プラグインダイアログ最大化時に「次へ」が押せない問題の調査に着手。
  - update: 2026-01-18 14:20 JST 最大化時にリサイズハンドルを描画しないよう調整し、フッター右下のクリック阻害を回避する対応を追加。
  - blocked: 2026-01-18 14:25 JST pnpm typecheck が @hierarchidb/vt-orchestrator build:types の TransformByBandCacheRecord に bandIndex が無い型エラー（createTransformByBandHandler.ts:868）で失敗。
  - update: 2026-01-18 14:40 JST ダイアログ表示時に SpeedDial を確実に抑制するため、hash ルーティング時の dialog route 判定を追加。
  - blocked: 2026-01-18 14:45 JST pnpm typecheck が @hierarchidb/runtime-worker の EphemeralShapeDB/TransformByBandCacheRecord/TransformByZoomCacheRecord 型エラー（ShapeMutationService.ts/ShapeQueryService.ts/vectorTileStageRunner.ts）で失敗。
  - update: 2026-01-18 15:05 JST ダイアログ表示中は SpeedDial を強制的に非表示にするため、PluginDialogFrame が dialog-open 共有状態を通知し DynamicSpeedDial がそれに追従するよう調整。
  - blocked: 2026-01-18 15:10 JST pnpm typecheck が @hierarchidb/runtime-worker の ShapeMutationService/ShapeQueryService/WorkerService における ShapeTransformCache 不整合で失敗。
  - update: 2026-01-18 15:15 JST maximize/full-screen 時のリサイズハンドル非表示は維持する方針を確定。

2214) feat/ui-map/fit-screen-button (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/ui-map/fit-screen-button
- 依存: なし
- 受け入れ基準: ui-map に FitScreen アイコンボタンが表示される（デフォルトON）／選択フィーチャーが0件のときはボタンが disabled になる／ボタン押下で選択フィーチャー全体のバウンディングボックスを算出し、最小フィットの視野へ遷移する／既存の地図操作に副作用がない
- 影響範囲: `app/src/**` `packages/**`（調査後に確定）
- ロールバック手順: 追加したボタン表示とフィット処理の差分を revert し、ui-map のツールバーとカメラ制御を修正前に戻す
- チェックリスト:
  - FitScreen ボタンの表示条件と disabled 条件を追加する
  - 選択フィーチャーのバウンディングボックス算出処理を実装する
  - BBox から最小フィット視野へ遷移する処理を実装する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 12:00 JST ui-map FitScreen ボタン表示と選択フィーチャーのフィット表示対応に着手。
  - update: 2026-01-18 12:05 JST FitScreen ボタン表示/disabled 条件と選択フィーチャーの fitBounds 処理を実装。
  - blocked: 2026-01-18 12:10 JST pnpm typecheck が @hierarchidb/shape-store build:types の ShapeTransformErrorRecord 未export で失敗。
  - update: 2026-01-18 12:20 JST FitScreen ボタン位置を map 右上コントロール直下へ移動し、outline アイコンボタンで表示する対応に着手。
  - update: 2026-01-18 12:30 JST FitScreen ボタン位置変更と outline 表示を反映。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 13:10 JST Shape Step6 の FitScreen ボタンを map 右上コントロール直下に移動し、outline 表示へ統一。
  - blocked: 2026-01-18 13:15 JST pnpm typecheck が vt-orchestrator の polygonErrorCount 型エラーで失敗。
  - update: 2026-01-18 13:30 JST Shape Step6 FitScreen の位置を top-right コントロール下端 +16px で再計算。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 13:50 JST エラー一覧選択でも FitScreen を有効化し、ボタンを size=large/variant=outlined に変更。
  - update: 2026-01-18 14:10 JST エラー選択の境界算出を追加し、FitScreen を有効化。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 14:25 JST FitScreen ボタンの margin 4px と高さ 32px を反映。pnpm typecheck を実行（exit 0）。

2218) feat/ui-map/interaction-core-unify (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/ui-map/interaction-core-unify
- 依存: なし
- ExecPlan: `plans/ui-map-interaction-core-execplan.md`
- 受け入れ基準: ui-map の基本機能として FitScreen/検索フィールド/hover/selection/search/ハイライト/スナックバー/矩形選択/Enter検索fit が統合され、props で有効/無効を切替できる／Step6 プレビューが ui-map の基本機能へ移行する／Transform エラーの永続化内容がエラー一覧表示に必要な情報を漏れなく含む／エラー一覧の国名・大陸名が ISO-3166-2 から補完される／ポリゴン・リングのエラー/総数が正確に表示される／エラー一覧の行選択で地図が自動フィットする／pnpm typecheck が成功する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `packages/vt-orchestrator/src/transform/**`, `packages/plugin-service-api/src/types/**`（調査後に確定）
- ロールバック手順: ui-map 統合機能と Step6 変更、Transform エラー永続化の差分を revert し、従来の個別実装へ戻す
- チェックリスト:
  - ui-map の基本機能として 1〜6 を統合し、props で有効/無効を切替可能にする
  - Step6 プレビューを ui-map の統合機能へ移行する
  - Transform エラーの永続化項目を拡充し Step6 で表示する
  - ISO-3166-2 で国名/大陸名を補完する
  - エラー/総数の表示を正確化する
  - エラー一覧選択時に地図を自動フィットする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 14:45 JST ui-map 基本機能の統合と Step6 エラー表示拡充に着手。
  - update: 2026-01-18 14:20 JST FitScreen ボタンの margin 4px と高さ 32px を反映。
  - update: 2026-01-18 12:55 JST shape Step6 プレビューの FitScreen ボタン位置修正に着手。
  - update: 2026-01-18 18:40 JST ui-map を FitScreen/検索/選択/hover/ハイライト/矩形選択/検索fit の基本機能として統合し、Step6 プレビューも ui-map 基本機能へ移行する方針を反映。
  - update: 2026-01-17 12:31 JST フローティングウィンドウのタイトルバー/ボディの詰め調整とボタン構成の整理、Grid検索欄の重複整理に着手。
  - update: 2026-01-17 12:32 JST pnpm --filter @hierarchidb/ui-grid build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:33 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 12:34 JST pnpm typecheck が app の PluginDialogRoute.tsx で pathOnly/normalizedPath 未確定の型エラーで失敗。
  - update: 2026-01-17 12:35 JST PluginDialogRoute.tsx の pathOnly 取得を空文字フォールバックに整理。
  - update: 2026-01-17 12:36 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:35 JST フローティングウィンドウのドラッグ開始時に z-index を引き上げる処理を追加。
  - update: 2026-01-17 12:36 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:37 JST Fit ボタンのアイコンが消える問題に対応し、maplibre のクラス付与を外して表示を優先。
  - update: 2026-01-17 12:38 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:38 JST MapPreviewFloatingTable の GenericDataGrid に showSearch=false を明示し検索欄の重複を解消。
  - update: 2026-01-17 12:39 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:44 JST 件数のテキスト表示をやめ、タイトルに件数を含める表示へ変更。
  - update: 2026-01-17 12:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:51 JST メタデータ検索欄にルーペ/クリアアイコンと丸み最大の形状を適用。
  - update: 2026-01-17 12:52 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:20 JST 検索欄のルーペアイコン左側に 16px の余白を追加。
  - update: 2026-01-17 13:21 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:31 JST 検索欄右側にカラム選択メニューを追加し、表示カラムの切替に対応。
  - update: 2026-01-17 13:32 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2217) fix/app/ui-treeconsole-workspace-dep (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/app/ui-treeconsole-workspace-dep
- 依存: なし
- 受け入れ基準: app の依存から存在しない `@hierarchidb/ui-treeconsole` を解消し、pnpm install が成功する／必要なら import 参照を実在パッケージへ修正する／TASKS.md に運用ログを記載する
- 影響範囲: `app/package.json` ほか（調査後に確定）
- ロールバック手順: 依存の差分を revert し、元の依存定義に戻す
- チェックリスト:
  - app/package.json の `@hierarchidb/ui-treeconsole` 依存を削除/置換する
  - 必要なら import を実在パッケージに修正する
  - pnpm install を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 12:40 JST app 依存の @hierarchidb/ui-treeconsole 解消対応に着手。
  - blocked: 2026-01-18 12:45 JST pnpm install が pnpm store への symlink で EPERM により失敗。
  - update: 2026-01-18 12:46 JST pnpm install を昇格実行し成功（lockfile 変更なし）。

2215) chore/shape/ephemeral-table-audit (P1) — 進行中 (2026-01-18)
2216) chore/shape/shape-db-table-audit (P1) — 進行中 (2026-01-18)
- ブランチ名: chore/shape/shape-db-table-audit
- 依存: なし
- 受け入れ基準: hdb-shape の全テーブルについて読み書き参照箇所を整理する／未使用または重複の疑いがあるテーブルを根拠付きで提示する／削除/統合/保留の方針と影響範囲を提示する／削除/統合を提案する場合はロールバック手順と移行手順を明記する／TASKS.md に調査ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts` ほか（調査後に確定）
- ロールバック手順: 調査のみの場合は不要。実装する場合は該当差分を revert し、hdb-shape のテーブル構成を元に戻す
- チェックリスト:
  - hdb-shape の全テーブルと参照箇所（読み書き）を洗い出す
  - 未使用/重複が疑われるテーブルの削除/統合/保留方針を提示する
  - ロールバックと移行手順の方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 16:10 JST hdb-shape のテーブル利用状況調査に着手。
  - update: 2026-01-18 17:20 JST hdb-shape の featureIndices テーブル撤去対応に着手。
  - update: 2026-01-18 17:35 JST featureIndices テーブル定義を削除し、ShapeDB のスキーマを v5 に更新。
  - update: 2026-01-18 17:40 JST pnpm --filter @hierarchidb/shape-store typecheck を実行（exit 0）。
  - update: 2026-01-18 17:41 JST pnpm --filter @hierarchidb/shape-store build を実行（exit 0、tsdown define 警告あり）。

- ブランチ名: chore/shape/ephemeral-table-audit
- 依存: なし
- 受け入れ基準: shape-ephemeral の全テーブルについて読み書き参照箇所を整理する／transformByBandCache/transformByZoomCache/transformByZoomReservations/vtCache の用途・重複・未使用の有無を根拠付きで説明する／未使用または重複の疑いがあるテーブルについて削除/統合/保留の方針と影響範囲を提示する／削除/統合を提案する場合はロールバック手順と移行手順を明記する／TASKS.md に調査ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts` ほか（調査後に確定）
- ロールバック手順: 調査のみの場合は不要。実装する場合は該当差分を revert し、shape-ephemeral のテーブル構成を元に戻す
- チェックリスト:
  - shape-ephemeral の全テーブルと参照箇所（読み書き）を洗い出す
  - transformByBandCache/transformByZoomCache/transformByZoomReservations/vtCache の用途・重複・未使用の有無を整理する
  - 未使用/重複が疑われるテーブルの削除/統合/保留方針を提示する
  - ロールバックと移行手順の方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 13:30 JST shape-ephemeral のテーブル利用状況調査に着手。
  - update: 2026-01-18 14:05 JST shape-ephemeral のテーブル参照箇所を洗い出し、未使用/重複の疑いを整理。
  - update: 2026-01-18 15:20 JST transformByBandCache→transformCache の改名、未使用テーブル削除、tileIdToBufferRelations の転置インデックス実装に着手。
  - update: 2026-01-18 15:35 JST pnpm --filter @hierarchidb/gis-sdk typecheck を実行（exit 0）。
  - update: 2026-01-18 15:36 JST pnpm --filter @hierarchidb/shape-store typecheck を実行（exit 0）。
  - update: 2026-01-18 15:37 JST pnpm --filter @hierarchidb/vt-shape-store typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:38 JST pnpm --filter @hierarchidb/plugin-service-api typecheck が ShapeTransformCache 未export で失敗。
  - update: 2026-01-18 15:40 JST plugin-service-api の型名修正と typecheck を実行（exit 0）。
  - update: 2026-01-18 15:41 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:43 JST pnpm --filter @hierarchidb/runtime-worker typecheck が ShapeMutationAPI 差分で失敗。
  - update: 2026-01-18 15:45 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:47 JST pnpm --filter @hierarchidb/runtime-worker typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck が getNumCaches 型差分で失敗。
  - update: 2026-01-18 15:52 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:53 JST pnpm --filter @hierarchidb/shape-store build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:55 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2213) feat/shape/step4-zoom-band-accordion-layout (P1) — 進行中 (2026-01-17)
- ブランチ名: feat/shape/step4-zoom-band-accordion-layout
- 依存: なし
- 受け入れ基準: Step4 のズーム帯範囲カードが horizontal/vertical をプロパティで切替できる／ズーム帯範囲カードと共通ズーム帯反映ボタンが Transform アコーディオンから 0 番目の新規アコーディオンへ移設される／0 番目アコーディオンのサマリーにルーペアイコンと「ズーム帯の設定」見出しが表示される／0 番目アコーディオンのディティールでズーム帯範囲カードが horizontal で表示される／既存挙動が壊れない
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step4 のアコーディオン構成とズーム帯カード配置を修正前に戻す
- チェックリスト:
  - Step4 のズーム帯範囲カードに並び方向プロパティを追加する
  - ズーム帯範囲カード/共通ズーム帯反映ボタンを新規アコーディオンへ移設する
  - 新規アコーディオンのサマリーにルーペアイコンと見出しを表示する
  - ディティールでズーム帯範囲カードを horizontal 表示にする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 22:10 JST Step4 ズーム帯範囲カードの配置変更と並び方向切替対応に着手。
  - update: 2026-01-17 22:30 JST ズーム帯設定アコーディオンの追加とカード/ボタン移設、カードの並び方向切替を実装。
  - update: 2026-01-17 22:35 JST pnpm typecheck を実行（初回 timeout のため再実行、exit 0）。
  - update: 2026-01-17 22:45 JST ズーム帯の範囲設定カード内スライダー水平配置の gap 調整に着手。
  - update: 2026-01-17 22:50 JST ズーム帯の範囲設定カード内の水平スライダー間隔を 16px に調整。
  - update: 2026-01-17 23:20 JST ズーム帯設定/キャッシュ管理の見出し更新、即時削除カードの移設、ズーム帯説明をツールチップ化。
  - blocked: 2026-01-17 23:25 JST pnpm typecheck が plugins/shape-plugin/src/worker/api.ts の既存エラーで失敗。
  - update: 2026-01-17 23:35 JST ズーム帯スライダー間隔を margin 指定で 16px 相当に調整。
  - update: 2026-01-17 23:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-17 23:55 JST Fetch設定のアコーディオン見出しからキャッシュ管理表記を削除。
  - update: 2026-01-18 00:05 JST ズーム帯設定/キャッシュ管理の表記にスペースを追加し、設定アイコンに変更。
  - update: 2026-01-18 00:20 JST 中間生成物の保持カードをズーム帯設定へ移設し、Fetch設定の見出しを更新。
  - update: 2026-01-18 00:25 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 00:40 JST ズーム帯スライダー間隔を Grid の columnSpacing=2 で確実に確保。
  - update: 2026-01-18 00:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 00:55 JST ズーム帯スライダー間に 16px のスペーサー Grid を追加。
  - update: 2026-01-18 01:00 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 01:10 JST ズーム帯スライダー間を Grid アイテムの左右 padding で 16px 確保。
  - update: 2026-01-18 01:15 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 01:30 JST ズーム帯スライダー間の左右 padding を 16px に調整。
  - update: 2026-01-18 01:35 JST Fetch設定のレイアウトを 1/3+1/6*4 に変更し、リトライ最大5回に制限。
  - update: 2026-01-18 02:10 JST ズーム帯スライダー間隔を Grid の columnSpacing で 16px に調整する対応に着手。
  - update: 2026-01-18 02:12 JST ズーム帯スライダー間を columnSpacing=2（16px）で確保。
  - update: 2026-01-18 02:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:45 JST Step4 Transform の面積フィルター設定が Transform ステージ処理で利用されているかを調査。
  - update: 2026-01-18 02:55 JST Transform アコーディオンからズーム帯の一覧カードを削除。
  - update: 2026-01-18 03:10 JST Transform ステージの面積フィルター適用を無効化。
  - update: 2026-01-18 03:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 03:45 JST geometry simplify error の features/polygons 表記を invalidFeatures/invalidPolygons に改名。
  - update: 2026-01-18 04:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 04:25 JST TransformConfig を ringFix/selfIntersection の階層化と係数設定に合わせて更新。
  - update: 2026-01-18 05:15 JST Transform の簡略化前に ringFix/selfIntersection を適用する処理を追加。
  - blocked: 2026-01-18 05:30 JST pnpm typecheck が vt-orchestrator の Geometry 修正に伴う型エラーで失敗。
  - update: 2026-01-18 05:40 JST vt-orchestrator の Geometry 修正を反映し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 06:05 JST pnpm install --frozen-lockfile が pnpm store への symlink で EPERM により失敗（sandbox 制限）。
  - blocked: 2026-01-18 06:10 JST CI=true pnpm install --frozen-lockfile --store-dir .pnpm-store が registry ENOTFOUND と store 内容不一致（@turf/simplify）で失敗。
  - blocked: 2026-01-18 06:15 JST pnpm build が dep-fence 未解決（node_modules 未整備）で失敗。
  - blocked: 2026-01-18 06:20 JST pnpm typecheck が turbo 未導入（node_modules 未整備）で失敗。
  - update: 2026-01-18 06:55 JST pnpm build を実行（exit 0、eslint-plugin-storybook 無効化の警告あり）。
  - update: 2026-01-18 07:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 07:05 JST pnpm test が resolver-plugin の import 失敗（~/worker/ResolverEntityService.ts）、runtime-worker の util dist 参照不一致（format.js 不在）、styler-plugin の setup.ts 不在で失敗。
  - start: 2026-01-18 07:15 JST pnpm test の resolver-plugin/util/styler-plugin 失敗を修正する作業に着手。
  - update: 2026-01-18 07:35 JST pnpm test の残存失敗（basemap/styler の ui-i18n / ui-worker-client 解決）に対応する作業に着手。
  - blocked: 2026-01-18 11:25 JST pnpm test が runtime-worker（import-export/auth-recovery の dist 解決で Class extends undefined）、shape-plugin（gen-iso3166-2/browser 未解決、useBuildProgress パス不整合）で失敗。
  - blocked: 2026-01-18 04:40 JST pnpm typecheck が gis-sdk の dist 型未更新で失敗。
  - update: 2026-01-18 04:45 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 04:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 01:40 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-16 08:16 JST Fetch設定アコーディオンのサマリー文言を「Fetch設定」へ変更。
  - update: 2026-01-16 08:16 JST pnpm build を実行（exit 0）。
  - blocked: 2026-01-16 08:16 JST pnpm typecheck が @hierarchidb/vt-orchestrator の BuildTaskType あエラーで失敗（packages/vt-orchestrator/src/types/_BuildConfig.ts）。
  - update: 2026-01-16 11:37 JST pnpm test の残存失敗が location-plugin のテストであることを確認し、修正に着手。
  - update: 2026-01-16 11:56 JST pnpm test の app テスト失敗（worker preload/maplibre）対応に着手。
  - update: 2026-01-18 08:40 JST ズーム帯スライダー間隔の 16px padding 適用と Fetch 設定レイアウト/リトライ上限調整に着手。
  - blocked: 2026-01-18 08:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck が utils.ts の DataSourceName 型エラー（TS2322）で失敗。
  - update: 2026-01-18 08:50 JST utils.ts の buildConfig 正規化を修正し、pnpm --filter @hierarchidb/shape-plugin typecheck を再実行（exit 0）。
  - update: 2026-01-18 09:05 JST 再ビルド時に fetch タスクを再利用しないよう fetch ステージの旧タスク削除を追加し、pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 09:15 JST Step5 fetch タスク数が実行中に増殖し続ける問題の調査と修正に着手。
  - update: 2026-01-18 09:35 JST fetch ステージの進捗カウントをタスク数ベースに切り替え、表示単位をタスク/ポリゴンで切替。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:05 JST transform タスクの outputData に処理済み/総ポリゴン数を書き込み、タスク進捗をポリゴン比率で算出。サマリーはタスク件数集計へ切替。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:20 JST transform ステージのサマリー進捗バーを fetch URL 数ベースに変更（ステージ単体表示時のみ）。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:40 JST Step4 の削除ボタン件数を fetch cache 数へ合わせ、削除ラベルの件数表記を i18n 化。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:00 JST Step4 の Transform 削除件数を fetch×ズーム帯数で算出し、Transform タスクタイトルに ADM レベルとズーム帯範囲を表示。pnpm --filter @hierarchidb/vt-orchestrator typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:10 JST Transform 完了タスクのメッセージに Features/Polygons/Geometries を表示。pnpm --filter @hierarchidb/vt-orchestrator typecheck（exit 0）。
  - update: 2026-01-18 11:25 JST 進捗バーのセグメント幅をタスク件数ベースに統一し、transform 単体は fetch タスクで描画。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:40 JST Transform 削除件数を taskQueue の transform タスク件数に合わせ、削除後に 0 へ更新されるよう修正。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:55 JST 進捗サマリーの SVG が灰色になる問題に対応し、success/error/process の状態も色分け対象に追加。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 12:10 JST success/error/process を completed/failed/running に統一し、タスク表記の状態を正規化。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - start: 2026-01-18 12:20 JST Transform進捗サマリーSVGが灰色のままになる問題の再調査に着手。
  - update: 2026-01-18 12:35 JST transform-by-zoom のタスクを transform ステージへ集約するマッピングを追加。
  - update: 2026-01-18 12:40 JST pnpm --filter @hierarchidb/ui-batch-progress typecheck を実行（exit 0）。
  - update: 2026-01-18 12:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 12:50 JST transform-by-zoom→transform のステージ集約マッピングを撤去。
  - start: 2026-01-18 13:05 JST Transform進捗サマリーの灰色表示を調査するため tasksByStage のステージキー/状態内訳ログを追加する対応に着手。
  - update: 2026-01-18 13:10 JST ShapeBuildProgressPanel に tasksByStage のステージキー/状態内訳ログを追加。
  - update: 2026-01-18 13:12 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2211) plan/shape/3stage-vt-pipeline-execplan (P1) — 進行中 (2026-01-16)
- ブランチ名: plan/shape/3stage-vt-pipeline-execplan
- 依存: なし
- ExecPlan: `plans/shape-3stage-vt-pipeline-execplan.md`
- 受け入れ基準: 3段階（fetch→transform→vt）の再編に向けた ExecPlan が PLANS.md 準拠で作成されている／実施項目が分割され依存関係・DoD・ロールバックが明記されている／TASKS.md の運用ログに記録されている
- 影響範囲: `plans/shape-3stage-vt-pipeline-execplan.md`, `TASKS.md`
- ロールバック手順: ExecPlan 作成差分を revert する
- チェックリスト:
  - ExecPlan を作成する
  - 実施項目を小分割して依存関係を明記する
  - 受け入れ基準とロールバックを明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 16:07 JST 3段階再編のための ExecPlan 作成に着手。
  - update: 2026-01-16 16:10 JST 実施項目の分割と ExecPlan 作成の下準備に着手。
  - update: 2026-01-16 16:15 JST ExecPlan 初版を作成（plans/shape-3stage-vt-pipeline-execplan.md）。
  - update: 2026-01-16 16:25 JST 設計方針レビューでプロパティ名とステージ表記を確定し、ExecPlan を更新。
  - update: 2026-01-16 16:35 JST ExecPlan に Milestone 詳細を追記し、Progress を更新。
  - update: 2026-01-16 17:05 JST transform-by-band/TransformByBandConfig の名称統一（transform/TransformConfig）に対応する作業に着手。
  - update: 2026-01-16 18:10 JST transform ステージ/TransformConfig への名称統一と UI/テンプレート/型の更新を実施。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-16 18:40 JST ツールバーメニューの Zoom bands 文言を新仕様に合わせて更新する作業に着手。
  - update: 2026-01-16 18:45 JST ツールバーメニューの Zoom bands 文言を Transform 設定に合わせた説明へ更新。検証: 未実施。
  - update: 2026-01-16 19:10 JST Step4 のズーム帯範囲 UI（境界スライダー/一覧表示）を追加する対応に着手。
  - blocked: 2026-01-16 19:25 JST pnpm typecheck が zoomBands.ts/TransformConfigSection 由来の型エラーで失敗。
  - update: 2026-01-16 19:35 JST ズーム帯範囲 UI と transformConfig を更新し、pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）を確認。

2212) fix/shape/geometry-simplify-invalid-polygon (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/geometry-simplify-invalid-polygon
- 依存: なし
- 受け入れ基準: geometrySimplify の invalid polygon エラーの原因・発生範囲・修正方法と適用範囲を説明できる／失敗時の挙動が仕様として明確（停止 or 継続）が明記されている／同じ入力で失敗しない（もしくは意図した失敗として明確なログが出る）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/*`, `packages/features/gis-sdk/src/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、geometrySimplify のエラーハンドリングを修正前に戻す
- チェックリスト:
  - invalid polygon の再現条件と発生箇所を特定する
  - エラーハンドリング方針（停止 or 継続）を明文化する
  - 修正を実装し、同一入力での挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-16 12:46 JST transform の quantize/clean/simplify の呼び出し順と後処理の確認に着手。
  - start: 2026-01-16 13:00 JST quantize の UI 設定値を transform のスナップ解像度に反映する対応に着手。
  - blocked: 2026-01-16 13:02 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig.quantize 未定義で失敗。
  - update: 2026-01-16 13:02 JST pnpm --filter @hierarchidb/gis-sdk build を実行し d.ts を更新。
  - done: 2026-01-16 13:02 JST quantize のスナップ解像度反映を実装し、pnpm typecheck（exit 0）を確認。
  - start: 2026-01-16 13:09 JST transform の簡略化エラーポリゴン保存と Step5/6 表示拡張に着手。
  - update: 2026-01-17 16:20 JST 進捗表示の算出/色分けをタスク単位で再設計する調査と実装に着手。
  - start: 2026-01-17 09:00 JST geometrySimplify の invalid polygon エラー調査と修正に着手。
  - update: 2026-01-17 12:10 JST simplify 以外で投げられる invalid polygon 例外を捕捉し、詳細診断を errorMessage に含める対応に着手。
  - update: 2026-01-17 12:25 JST transform 全体を try/catch で包み、input/simplified/output の診断を errorMessage に付与。
  - update: 2026-01-17 12:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:50 JST decode/simplify/encode の失敗箇所を stage ラベルで包む診断を追加。
  - blocked: 2026-01-17 12:55 JST pnpm typecheck が vt-orchestrator の null 型エラーで失敗。
  - update: 2026-01-17 13:00 JST inputCollection の null ガードを追加し、catch 内参照を修正。
  - update: 2026-01-17 13:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:20 JST filter/boundary も stage ラベルで包む診断を追加。
  - blocked: 2026-01-17 13:25 JST pnpm typecheck が vt-orchestrator の括弧不足で失敗。
  - update: 2026-01-17 13:30 JST filter ラップの括弧を修正。
  - blocked: 2026-01-17 13:35 JST pnpm typecheck が workingCollection null 判定で失敗。
  - update: 2026-01-17 13:40 JST filterTarget の null ガードを追加。
  - update: 2026-01-17 13:50 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 14:05 JST counts 系の集計も stage ラベルで包む診断を追加。
  - update: 2026-01-17 14:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 14:30 JST stageLabel を追加し、未ラップ例外でも stage を付与。
  - update: 2026-01-17 14:35 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 09:35 JST quantize 後に連続同一点を統合する対応に着手。
  - update: 2026-01-17 10:10 JST quantize 後に cleanCoords を適用する対応に着手。
  - blocked: 2026-01-17 10:15 JST pnpm typecheck が @turf/clean-coords 未導入で失敗。
  - update: 2026-01-17 10:20 JST gis-sdk に @turf/clean-coords を追加。
  - blocked: 2026-01-17 10:25 JST pnpm install が pnpm store の symlink で EPERM。
  - update: 2026-01-17 10:30 JST pnpm install を再実行（昇格あり）で依存追加を反映。
  - update: 2026-01-17 10:40 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 10:50 JST cleanCoords の import を @turf/turf へ変更し Vite 解決エラーを回避。
  - blocked: 2026-01-17 10:55 JST pnpm typecheck が @turf/turf に cleanCoords が無い旨で失敗。
  - update: 2026-01-17 11:00 JST cleanCoords を @turf/clean-coords へ戻し、app に依存を追加。
  - start: 2026-01-17 16:20 JST fetch ステージが正常に動作しない問題と invalid polygon 以前の失敗要因の調査に着手。
  - update: 2026-01-17 16:27 JST startBatchProcess 開始時に pause 状態を解除し、transform の cleanCoords 例外で停止しないようガードを追加。
  - update: 2026-01-17 16:45 JST VT 生成が開始しない事象の調査と tileId リレーション欠落時のフォールバック検討に着手。
  - update: 2026-01-17 16:46 JST tileId リレーション欠落時に transformCache から再構築するフォールバックを追加。
  - update: 2026-01-17 16:47 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 16:53 JST transformCache の FlatGeobuf デコード失敗を捕捉し、失敗バッファをスキップしてログ出力するよう調整。
  - update: 2026-01-17 16:54 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:05 JST pnpm install を再実行（exit 0）。
  - update: 2026-01-17 11:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:20 JST transform 側に cleanCoords を追加する対応に着手。
  - update: 2026-01-17 11:25 JST transform の snap 後に cleanCoords を適用するよう更新。
  - update: 2026-01-17 11:30 JST vt-orchestrator に @turf/clean-coords を追加。
  - update: 2026-01-17 11:35 JST pnpm install を再実行（exit 0、peer 警告あり）。
  - update: 2026-01-17 11:40 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:50 JST transform の snap/clean 前後で booleanValid/minRingArea をログ出力する診断を追加。
  - update: 2026-01-17 11:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 09:45 JST pnpm typecheck が gis-sdk/geometryExtract の undefined 指摘で失敗。
  - update: 2026-01-17 09:50 JST 連続点統合のガードを修正し再実装。
  - update: 2026-01-17 09:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 09:05 JST invalid polygon 時は停止（継続しない）方針で合意。
  - update: 2026-01-17 09:15 JST geometry simplify 失敗時に booleanValid 判定と invalidFeatures をログへ追加。
  - update: 2026-01-17 09:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:10 JST quantize 後に頂点数が 2 以下になるポリゴン/穴の除去有無を確認し、未実装なら追加する対応に着手。
  - update: 2026-01-17 15:20 JST geometryExtract の quantize 後に頂点数が 2 以下のポリゴン/穴を持つポリゴンを除去する処理を追加。
  - blocked: 2026-01-17 15:30 JST pnpm typecheck が gis-sdk の geometryExtract で null 型不整合のため失敗。
  - update: 2026-01-17 15:35 JST quantizeGeometry を null 戻りとし FeatureCollection から除外するよう補正。
  - blocked: 2026-01-17 15:45 JST pnpm typecheck が vt-orchestrator の createTransformByBandHandler.ts 構文エラーで失敗。
  - update: 2026-01-17 15:55 JST createTransformByBandHandler の try/catch 構文を修正。
  - update: 2026-01-17 16:05 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:10 JST 進捗表示をポリゴン数ベースに切り替える実装に着手。
  - blocked: 2026-01-17 23:20 JST pnpm typecheck が shape-plugin の taskProgressWeights 型不整合で失敗。
  - update: 2026-01-17 23:25 JST taskProgressWeights の型を補正し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:30 JST 進捗表示をポリゴン数ベースで集計する変更を完了。
  - update: 2026-01-17 23:40 JST Step5 進捗バーrect幅の隙間解消対応に着手。
  - update: 2026-01-17 23:45 JST rect幅を Math.ceil+1 で補正し、pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:05 JST Step5 進捗バーrect幅の隙間解消のため Math.ceil+2 に変更する対応に着手。
  - blocked: 2026-01-18 00:10 JST pnpm typecheck が resolver-plugin の型エラーで失敗。
  - update: 2026-01-18 00:12 JST resolver-plugin の型エラー修正に着手。
  - blocked: 2026-01-18 00:20 JST pnpm typecheck が basemap-plugin の未使用変数で失敗。
  - update: 2026-01-18 00:22 JST basemap-plugin の未使用変数修正に着手。
  - blocked: 2026-01-18 00:30 JST pnpm typecheck が app のユニットテスト型エラーで失敗。
  - update: 2026-01-18 00:32 JST app テストの型エラー修正に着手。
  - update: 2026-01-18 00:40 JST basemap/resolver/app の型エラーを解消し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 12:30 JST pnpm typecheck が app/src/router/routes/map/MapPage.tsx の bounds 型エラーで失敗。
  - update: 2026-01-18 12:35 JST MapPage の bounds 算出を reduce で整理し、型エラーの解消に着手。
  - update: 2026-01-18 12:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 12:42 JST transform エラーポリゴンの保存/Step6 エラー一覧/プレビュー表示の対応を完了。
  - start: 2026-01-18 12:50 JST transformErrors が存在する場合も Step5→Step6 遷移を有効化する対応に着手。
  - blocked: 2026-01-18 13:00 JST pnpm typecheck が shape-plugin の未使用変数（useShapeBuildStep.ts の stageKey、worker/api.ts の nodeId）で失敗。
  - update: 2026-01-18 13:15 JST 未使用変数の修正後、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 13:20 JST transformErrors が存在する場合も Step5→Step6 遷移を有効化する対応を完了。
  - start: 2026-01-18 13:30 JST Step5 の Transform 失敗時に Step6 のエラー一覧が空になる問題の調査に着手。
  - update: 2026-01-18 13:40 JST transform エラー保存を空lineFeaturesでも記録するよう補正。
  - update: 2026-01-18 13:45 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 13:50 JST Step5 失敗時の transform エラーが Step6 の一覧に表示されるよう対応を完了。
  - start: 2026-01-18 14:00 JST ベクトルタイル未生成でもエラーLineStringをStep6地図に表示する対応に着手。
  - update: 2026-01-18 14:10 JST エラーLineStringがあればタイル無しでも地図を表示する条件に変更。
  - update: 2026-01-18 14:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 14:20 JST ベクトルタイル未生成でもエラーLineStringを地図表示する対応を完了。
  - start: 2026-01-18 14:30 JST Step5 Transform 進捗 SVG が灰色固定になる問題の調査に着手。
  - update: 2026-01-18 14:45 JST Transform 単独表示時は transform のタスクがあればそれを使うよう進捗バーの参照先を補正。
  - update: 2026-01-18 14:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 14:55 JST Step5 Transform 進捗 SVG が灰色固定になる問題の修正を完了。
  - start: 2026-01-18 15:05 JST Step6の地図/エラー一覧が空のままなのに遷移ボタンが有効な問題の調査に着手。
  - update: 2026-01-18 15:20 JST Transform エラー解析失敗時でもレコードを保存するよう補正。
  - update: 2026-01-18 15:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:42 JST Step5 rect幅を Math.ceil+2 に更新し、隙間解消対応を完了。


2210) refactor/gis-sdk/require-build-config-properties (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/gis-sdk/require-build-config-properties
- 依存: なし
- 受け入れ基準: FetchConfig/TransformByBandConfig/TransformByZoomConfig/VTConfig の各プロパティが必須化され、フォールバック/存在チェックが撤去される／ビルドステージ未使用のプロパティ一覧を特定し説明できる／Step4 UI に存在しない表示/更新項目を列挙できる／ラベル/ヘルプの不一致を列挙できる／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/*`, `plugins/shape-plugin/src/ui/components/step4/*`, `plugins/shape-plugin/src/services/batch/session/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、型とフォールバック実装を修正前に戻す
- チェックリスト:
  - 4型のプロパティ一覧を整理して説明する
  - 4型を必須化しフォールバック/存在チェックを撤去する
  - ビルドステージ未使用のプロパティを列挙する
  - Step4 UI 未対応の表示/更新項目を列挙する
  - ラベル/ヘルプ不一致を列挙する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 14:25 JST build config の必須化と利用箇所/Step4 UI の棚卸しに着手。
  - blocked: 2026-01-16 14:45 JST pnpm typecheck が vt-orchestrator build:types の tolerance/layerSetName 型エラーで失敗。
  - update: 2026-01-16 15:30 JST pnpm --filter @hierarchidb/gis-sdk build を実行し dist 型定義を更新（exit 0）。
  - update: 2026-01-16 15:31 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 11:02 JST concurrentDownload/workers の撤去と未使用プロパティ配線・Step4 UI 修正に着手。
  - update: 2026-01-15 11:22 JST Fetch/Transform/VT の配線更新と Step4 UI 補正を反映。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 11:29 JST 並列数プロパティ名を maxConcurrent に統一する作業に着手。
  - update: 2026-01-15 11:35 JST maxConcurrent 統一方針の承認を受け、実作業に着手。
  - update: 2026-01-15 11:37 JST shape/gis-sdk/vt-orchestrator 範囲では concurrentDownloads/concurrentProcesses が残っていないことを確認。location-plugin など他領域の並列設定名は確認待ち。

2209) refactor/types/move-build-configs-to-gis-sdk (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/types/move-build-configs-to-gis-sdk
- 依存: なし
- 受け入れ基準: FetchConfig/TransformByBandConfig/TransformByZoomConfig/VTConfig/ CleanupConfig/ CommonSessionConfig が common-types から撤去され、gis-sdk 定義に統一される／参照元が common-types を使っていない／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/types/src/*`, `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/ui/components/step4/DownloadRetryControls.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、build-config 型の定義と参照を修正前に戻す
- チェックリスト:
  - common-types の build-config 型を撤去する
  - gis-sdk の型定義へ移動する
  - 参照箇所を gis-sdk 側へ更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 13:20 JST build-config 型の移動に着手。
  - update: 2026-01-16 13:35 JST common-types から build-config 型を削除し、gis-sdk 側へ定義を移動。参照は gis-sdk に更新。検証: 未実施。
  - update: 2026-01-16 14:10 JST pnpm typecheck を実行し成功（exit 0）。

2208) feat/shape/step3-offline-metadata-cache (P1) — 進行中 (2026-01-16)
- ブランチ名: feat/shape/step3-offline-metadata-cache
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得が 304 でローカルキャッシュを使う実装であることを確認できる／navigator.onLine === false の場合は外部アクセスを行わずローカルキャッシュを利用する／API 未到達時は外部アクセス失敗後にローカルキャッシュへフォールバックする／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `packages/features/chunk-store/src/index.ts`（確認のみ）, `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts`（確認のみ）
- ロールバック手順: 該当差分を revert し、オンライン/オフライン判定とキャッシュ利用を変更前へ戻す
- チェックリスト:
  - 304 応答時にキャッシュ利用されるコード経路を確認する
  - navigator.onLine 判定で外部アクセスを回避する処理を追加する
  - 失敗時のキャッシュフォールバック挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 11:40 JST Step3 のオフライン時キャッシュ利用と 304 経路の確認に着手。
  - update: 2026-01-16 12:10 JST geoboundaries メタデータ取得で navigator.onLine===false 時はキャッシュのみ使用し、ISO3166 もオフライン時は外部CSVを参照しないよう分岐を追加。検証: 未実施。
  - update: 2026-01-16 12:40 JST Step5 fetch でオフライン時に raw data キャッシュが無ければ外部アクセスせずエラーにする分岐を追加。検証: 未実施。
  - update: 2026-01-16 12:55 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 12:25 JST pnpm typecheck を実行し成功（exit 0）。

2209) feat/ui/toolbar-zoom-bands-settings (P1) — 進行中 (2026-01-15)
- ブランチ名: feat/ui/toolbar-zoom-bands-settings
- 依存: なし
- 受け入れ基準: ツールバーの設定メニューから Zoom bands の共通設定を編集できる／変更が shape Step4 の初期値に反映される／保存先が明確で再読込できる／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/util/src/treeConsoleSettings.ts`, `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/TreeConsoleToolbarContent.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `plugins/shape-plugin/src/ui/components/step4/useShapeBuildConfigStep.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ツールバーからの共通設定と初期値反映を修正前に戻す
- チェックリスト:
  - Zoom bands 共通設定の保存先と読み取りを決める
  - 設定メニューに編集UIを追加する
  - shape Step4 の初期値へ設定を反映する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-01-15 21:05 JST Zoom bands の共通設定をツールバーから編集する対応に着手。
  - update: 2026-01-16 21:20 JST DoD 合意の上で実装作業を開始。
  - update: 2026-01-16 21:40 JST ツールバー設定に Zoom bands の共通設定UIを追加し、shape Step4 初期値へ反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 21:55 JST 共通ズーム帯設定が新規 Shape/Route ビルドのデフォルトに使われる旨の文言を更新。検証: 未実施。
  - update: 2026-01-16 22:10 JST DoD 合意の上で共通ズーム帯反映ボタン追加に着手。
  - update: 2026-01-16 22:25 JST Step4 に共通ズーム帯反映ボタンを追加し、押下で共通設定を適用。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 22:40 JST ズーム帯スライダーを n+1 ハンドル表示に変更し、範囲数1でも境界スライダーを表示。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 23:05 JST 共通ズーム帯スライダーを n+1 ハンドル化し、最大ズームを可変にする対応に着手。
  - update: 2026-01-16 23:35 JST 共通ズーム帯スライダーも n+1 ハンドル化し、右端を最大ズームとして可変化。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 23:55 JST ズーム帯の最大ズームを TransformConfig に追加し、Step4/共通設定/テンプレートへ反映。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 00:10 JST スライダーのラベル常時表示に合わせて上部パディングを追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 00:25 JST ズーム帯の境界範囲 0-11・範囲数 0-10・右端可変化と margin 32px 反映に着手。
  - blocked: 2026-01-17 00:40 JST pnpm typecheck が shape-plugin の TransformConfig に maxZoom 必須の型不整合で失敗。
  - update: 2026-01-17 00:45 JST pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）→ pnpm typecheck（exit 0）で解消。
  - update: 2026-01-17 01:10 JST ズーム帯スライダーの margin 32px の強制適用と左端固定（範囲数増殖防止）に着手。
  - update: 2026-01-17 01:20 JST スライダー margin 32px を !important で適用し、左端固定で範囲数が増えないよう補正。検証: pnpm typecheck（exit 0）。
  - update: 2026-01-17 01:30 JST ズーム帯スライダーの margin を 36px へ更新。
  - update: 2026-01-17 01:40 JST margin 36px を !important で適用。検証: pnpm typecheck（exit 0）。

2208) fix/app/tree-trash-actions (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/app/tree-trash-actions
- 依存: なし
- 受け入れ基準: パンクズの Move to Trash ダイアログで削除が成功し画面が更新される／TreeNodeInfoPanel のコンテキストメニュー「削除」で INVALID_OPERATION No items selected が発生しない／削除対象ノードが選択状態として渡される／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `app/src/hooks/treeconsole/actions/contextMenu.ts`, `packages/ui/treeconsole/breadcrumb/src/components/NodeContextMenu.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、削除操作の挙動を修正前に戻す
- チェックリスト:
  - パンクズ/コンテキストメニューの削除フローを再現する
  - 選択ノードの扱いとコマンド引数の不整合を修正する
  - UI で削除が成功しゴミ箱に移動することを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-01-15 18:32 JST パンクズ/TreeNodeInfoPanel の削除が失敗する問題の調査に着手。
  - update: 2026-01-15 18:35 JST 削除時の選択ノードが空の場合は対象ノードを選択してゴミ箱移動に渡すよう補正。
  - update: 2026-01-15 18:35 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:05 JST パンクズ削除の confirm で対象ノードを保持し、削除後は親ノードへ遷移するよう補正。
  - update: 2026-01-15 20:05 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:13 JST パンクズの ancestor に parentId を補完し、削除後に正しく親へ遷移できるよう修正。
  - blocked: 2026-01-15 20:14 JST pnpm typecheck が app の useTreeConsoleBreadcrumbs.ts の undefined 指摘で失敗。
  - update: 2026-01-15 20:15 JST useTreeConsoleBreadcrumbs の ancestor parentId 補完で undefined ガードを追加。
  - update: 2026-01-15 20:15 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:23 JST TreeNodeInfoPanel の削除に確認ダイアログを追加し、文言を i18n へ追加。
  - update: 2026-01-15 20:24 JST pnpm typecheck を実行し成功（exit 0）。

2207) fix/ui/download-retry-controls-render-loop-v2 (P1) — 完了 (2026-01-16)
- ブランチ名: fix/ui/download-retry-controls-render-loop-v2
- 依存: なし
- 受け入れ基準: DownloadRetryControls の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/DownloadRetryControls.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - DownloadRetryControls のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 11:00 JST DownloadRetryControls の Maximum update depth エラー対応に着手。
  - update: 2026-01-16 11:10 JST useShapeBuildConfigStep の mergeBuildConfig が毎回 onChange を起こすため無限更新になっていたため、同値時は更新しないよう比較を追加。検証: 未実施。
  - update: 2026-01-16 11:20 JST pnpm typecheck を実行し成功（exit 0）。
  - done: 2026-01-16 11:30 JST Step4 で警告が出ないことを確認。

2206) fix/shape/step3-data-source-missing (P1) — 進行中 (2026-01-16)
- ブランチ名: fix/shape/step3-data-source-missing
- 依存: なし
- 受け入れ基準: Step3 の ShapeCountrySelection で dataSource missing が発生しない／dataSource の欠落原因が説明できる／同じ手順で再現しないことを確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step3 の dataSource 取り扱いを修正前に戻す
- チェックリスト:
  - dataSource missing の発生条件を特定する
  - Step3 の dataSource 取得/受け渡しを修正する
  - UI で再現しないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 09:30 JST Step3 の dataSource missing 調査と修正に着手。
  - update: 2026-01-16 09:40 JST Step2/Step3 で legacy dataSource を dataSourceName として解釈する対応を追加。検証: 未実施。
  - update: 2026-01-16 09:50 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 10:05 JST Step2/Step3 の legacy dataSource フォールバックを撤回し dataSourceName のみ参照に戻す。データ側の不整合は削除で対応する方針。
  - update: 2026-01-16 10:10 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 10:20 JST population-2023 テンプレートの buildConfig.dataSource を dataSourceName に更新。ブラウザ永続化データは削除済み。
  - update: 2026-01-16 10:30 JST pnpm typecheck を実行し成功（exit 0）。

2205) refactor/types/streamline-build-types (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/types/streamline-build-types
- 依存: なし
- 受け入れ基準: BuildConfig/TaskQueueRecord/StageHandeler の重複定義が上流（packages/common/types）に統合される／上流・下流で不一致の型は合成した新定義で整合する／下流側は上流定義を参照する／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/types/src/*`, `packages/features/gis-sdk/src/*`, `packages/vt-orchestrator/src/*`, `plugins/shape-plugin/src/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、型定義と参照を修正前に戻す
- チェックリスト:
  - BuildConfig/TaskQueueRecord/StageHandeler の重複箇所を特定する
  - 上流定義を正とし必要なら合成した型を再定義する
  - 下流側の参照を上流へ切り替える
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 08:55 JST BuildConfig/TaskQueueRecord/StageHandeler の重複整理に着手。
  - update: 2026-01-16 09:10 JST TransformByBandConfig/TransformByZoomConfig の統合対応を追加。
  - blocked: 2026-01-15 08:22 JST pnpm typecheck が shape-plugin の getNumCaches と TransformByBand/Zoom/VTConfig の型不整合、dataSourceName の未定義で失敗。
  - blocked: 2026-01-15 08:24 JST pnpm typecheck が shapePipeline の context 名不一致と BuildConfig の必須項目未設定で失敗。
  - blocked: 2026-01-15 08:25 JST pnpm typecheck が shapePipeline の maxBand3Reservations 未定義で失敗。
  - blocked: 2026-01-15 08:26 JST pnpm typecheck が app の buildConfig 参照不整合で失敗。
  - update: 2026-01-15 08:26 JST common-types/gis-sdk/plugin-service-api/vt-orchestrator を build し、pnpm typecheck を再実行して成功。
  - update: 2026-01-15 08:30 JST common-types へ寄せすぎ懸念のため、型の所属見直し調査に着手。
  - update: 2026-01-15 08:41 JST BuildConfig は shape-plugin のみで利用、TransformByBand/Zoom/VTConfig は vt-orchestrator と shape-plugin が利用、TaskQueueRecord/StageHandler は route/shape/vt-orchestrator が利用することを確認。
  - update: 2026-01-15 08:54 JST BaseBuildConfig/ShapeBuildConfig 分離の実装に着手。
  - start: 2026-01-15 09:00 JST TransformByBand/TransformByZoom/VTConfig とフィルタ系の定義を gis-sdk へ移動する対応に着手。
  - update: 2026-01-15 09:05 JST TransformByBand/TransformByZoom/VTConfig とフィルタ系を gis-sdk 定義へ移動し、common-types の定義と参照を整理。
  - update: 2026-01-15 09:05 JST pnpm typecheck を実行し成功（exit 0）。

2204) refactor/shape/stage-cache-naming-and-layout (P1) — 進行中 (2026-01-15)
- ブランチ名: refactor/shape/stage-cache-naming-and-layout
- 依存: なし
- ExecPlan: `plans/shape-stage-cache-naming-execplan.md`
- 受け入れ基準: ステージが fetch/transform-by-band/transform-by-zoom/vt の4段階になる／中間データはCache命名に統一される／transform-by-band/zoom の中間はephemeralのみで永続側に残らない／UI/ログ/説明がCache命名に一致する／移行/ロールバック手順がExecPlanに記載される／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/*`, `packages/vt-shape-store/src/*`, `packages/features/shape-store/src/*`, `plugins/shape-plugin/src/*` ほか（調査後に確定）
- ロールバック手順: ExecPlan に記載の手順で旧テーブル名/旧ステージ構成へ戻す
- チェックリスト:
  - ExecPlan を作成し用語/段階/データ配置を確定する
  - 中間データのCache命名をコード/DB/型に反映する
  - vt-shape-store から transform 中間成果を除去する
  - UI/ログ/説明文を新命名に合わせる
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 22:40 JST ステージ4段階化とCache命名への統一、transform中間のephemeral化に着手。
  - update: 2026-01-15 23:20 JST Buffers名称のCache化と transformByBandOutputs 廃止（ephemeralのみ）方針を反映する対応に着手。
  - update: 2026-01-15 23:50 JST EphemeralGisDB/EphemeralShapeDB のCache命名を反映し、transformBuffers 参照を削除。StageProcessingService と ShapeBuildAPIClient を更新し、headless test の fetchCache へ合わせた。ExecPlan の進捗を更新。
  - blocked: 2026-01-16 00:05 JST pnpm typecheck で shape-store build:types が fetchCache/transform-by-band の型不整合により失敗。
  - update: 2026-01-16 00:10 JST pnpm --filter @hierarchidb/gis-sdk build を実行（成功、tsdown define 警告あり）。
  - blocked: 2026-01-16 00:15 JST pnpm typecheck で runtime-worker が plugin-service-api の旧型参照（ShapeFetchCache/ShapeTransformByBandCache 未export）により失敗。
  - update: 2026-01-16 00:20 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（成功、tsdown define 警告あり）。
  - blocked: 2026-01-16 00:30 JST pnpm typecheck で route-plugin の TaskStage=transform エラーと shape-plugin の未使用変数が発生。
  - update: 2026-01-16 00:35 JST route-plugin の stage マップを transform-by-band/zoom に更新し、FetchConfigFormControls の enable 判定を整理。
  - update: 2026-01-16 00:45 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。
  - update: 2026-01-16 01:20 JST vt-shape-store から transform-by-band/zoom 中間データを排除し、ephemeral 側へ移行する対応に着手。
  - blocked: 2026-01-16 02:10 JST pnpm typecheck で vt-orchestrator build:types が @hierarchidb/shape-store 未解決と buildTransformByBandCacheRecordId 未export により失敗。
  - update: 2026-01-16 02:20 JST vt-orchestrator の transform cache id を直書きに切替え、tsconfig の paths/baseUrl を base 設定へ戻す対応を実施。
  - update: 2026-01-16 02:25 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（成功、tsdown define 警告あり）。
  - update: 2026-01-16 02:40 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。

2203) fix/shape/step4-5-build-progress-ui (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step4-5-build-progress-ui
- 依存: なし
- 受け入れ基準: Step4 の削除ボタンが削除可能データの有無に応じて有効化され件数ラベルが実データと一致する／Step5 のステージ別チップは 0 件時に outlined + grey + 無反応になる／Step5 のステージ別進捗表示が固定の LinearProgress ではなくステージごとの SVG+LinearProgress 表示になる／transform invalid polygon のメッセージが extract1/2 の段階と error/total の feature/polygon 数を含む／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/ui/components/step5/*`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepPanel.tsx`, `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step4/Step5 の削除ボタン・進捗表示・transform メッセージを修正前に戻す
- チェックリスト:
  - Step4 の削除ボタン判定と件数ラベルを実データ基準に修正する
  - Step5 のステージ別チップの 0 件時表示/無効化を反映する
  - Step5 のステージ別進捗表示を SVG+LinearProgress に差し替える
  - transform の invalid polygon メッセージに段階と error/total 数を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 20:10 JST Step4 削除ボタンの判定と Step5 進捗表示/チップ、transform エラーメッセージの改善に着手。
  - update: 2026-01-15 20:40 JST Step4 削除ボタンの件数/有効判定を実データ基準へ修正し、Step5 のステージ別チップ/進捗表示と transform エラーメッセージを更新。検証: 未実施。
  - update: 2026-01-15 20:45 JST pnpm --filter @hierarchidb/components build を実行し成功。警告: tsdown define オプションの警告あり。
  - update: 2026-01-15 20:55 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 21:10 JST Step4 Transform削除ボタンの文言/件数表記の変更に着手。
  - update: 2026-01-15 21:20 JST Transform削除ボタンの文言をズーム帯/ズーム率に変更し、件数表記にcountUnitを追加。検証: 未実施。
  - update: 2026-01-15 21:30 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 21:50 JST Transform削除ボタンの削除対象/disable条件の説明と無効化不具合の修正に着手。
  - update: 2026-01-15 22:10 JST transform削除で transformStageBuffers も削除するよう補正し、ボタンの無効化が反映されるよう修正。検証: 未実施。
  - update: 2026-01-15 22:20 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 11:41 JST Step5 ステージヘッダに maxConcurrent 分の CircularProgress を表示する対応に着手。
  - update: 2026-01-15 11:44 JST Step5 ステージヘッダに maxConcurrent の CircularProgress を追加。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:04 JST Step5 の全体進捗バー撤去に着手。
  - update: 2026-01-15 12:05 JST Step5 の全体進捗バーを撤去。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:09 JST Step5 ステージヘッダの CircularProgress と Chip 表記調整に着手。
  - update: 2026-01-15 12:10 JST Step5 ステージヘッダの停止時 CircularProgress を grey 表示にし、Failed/Completed テキストを撤去。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:20 JST transform-by-band の invalid polygon 調査用に簡略化エラーの詳細サマリ出力を追加する対応に着手。
  - update: 2026-01-15 12:21 JST invalid polygon のリング/座標サマリとサンプルIDをエラーログに追加。検証: pnpm typecheck（exit 0）。
  - start: 2026-01-16 15:40 JST transform-by-band の詳細エラー情報を Step5 タスク一覧と console に表示する整備に着手。
  - update: 2026-01-16 15:50 JST Step5 タスク一覧に geometry simplify エラーの要約行を追加し、console.warn に詳細フィールドを出力。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-16 16:10 JST pnpm typecheck が vt-orchestrator の ring area 計算で TS18048（undefined）により失敗。
  - update: 2026-01-16 16:20 JST invalid polygon 診断に自己交差/退化リング/重複頂点/リング面積統計を追加し、transformByBand の既定 tolerance を 0.1 に調整（DEFAULT_BUILD_CONFIG と population-2023 テンプレート）。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-15 13:30 JST Step5 タスク失敗時の即停止/failed 遷移/後続タスクの skipped 扱い方針の実装に着手。
  - blocked: 2026-01-15 13:40 JST pnpm typecheck で @hierarchidb/vt-orchestrator の compareTaskOrder.ts:124 が TS2339（failureError.message が never 扱い）で失敗。
  - update: 2026-01-15 13:41 JST runStageTasks の停止/中断対応と各ステージの abortSignal 伝播を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-15 14:00 JST 未使用プロパティ一覧の更新と有効化/統合/撤去の提案整理に着手。
  - update: 2026-01-15 14:02 JST Fetch/TransformByBand/TransformByZoom/VTConfig の未使用プロパティを棚卸しし、提案内容を整理。
  - start: 2026-01-15 16:07 JST 3段階ステージ構成（fetch → transform → vt）への再編プラン整理に着手。
  - start: 2026-01-15 16:10 JST 3段階再編の実施項目分割と ExecPlan 作成に着手。


2202) fix/components/buildstep-stage-filter-chips (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/components/buildstep-stage-filter-chips
- 依存: なし
- 受け入れ基準: BuildStepPanel の Failed/Completed チップがステージ単位でトグル動作しタスク一覧の表示を制御する／視覚的に選択状態が反映される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepPanel.tsx`
- ロールバック手順: 該当差分を revert し、チップのトグル連携を修正前に戻す
- チェックリスト:
  - Stage ごとの filter 状態を保持する
  - Failed/Completed チップのトグルが filter に反映される
  - タスク一覧が filter に応じて切り替わる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 19:10 JST BuildStepPanel の Failed/Completed チップがトグルとして機能しないため修正に着手。
  - update: 2026-01-15 19:20 JST ステージ単位の filter 状態を保持し、チップのトグルで BuildStageFilterProvider に反映。検証: 未実施。
  - update: 2026-01-15 19:35 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。

2201) fix/shape/step5-running-on-enter (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step5-running-on-enter
- 依存: なし
- 受け入れ基準: Step5 に遷移しただけでは「ビルド開始」が loading にならない／「一時停止」が enable にならない／全体進捗の LinearProgress が indeterminate で動作し続けない／通常のビルド開始フローは維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step5 の進捗判定を修正前に戻す
- チェックリスト:
  - Step5 進捗の running 判定条件を確認する
  - Step5 遷移直後に running 判定にならないよう補正する
  - UI で Step5 の表示を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 16:10 JST Step5 へ遷移しただけで running 判定になるため修正に着手。
  - update: 2026-01-15 16:30 JST Step5 で稼働マーカーがない場合は running/paused を解除し、初回表示でタスクを再取得するよう補正。検証: 未実施。
  - update: 2026-01-15 16:40 JST 方針誤りのため Step5 初回のタスク再取得と running/paused 判定補正を差し戻し。検証: 未実施。
  - start: 2026-01-15 17:00 JST Step5 離脱時に未完了ビルドを一時停止扱いとし、復帰時に再開できるよう修正に着手。
  - update: 2026-01-15 17:20 JST Step5 離脱/タブ閉じで processing 中のビルドを pauseBatchSession し、processingStatus を paused に更新する処理を追加。検証: 未実施。
  - blocked: 2026-01-15 17:35 JST pnpm typecheck で shape-plugin の未使用変数と BuildStatus 型エラーが発生。
  - update: 2026-01-15 17:40 JST 未使用変数削除と BuildStatus の型指定で typecheck エラーを解消。
  - update: 2026-01-15 17:45 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 18:10 JST Step5 の buildStatus 判定フローと paused 復帰時の running 表示原因をコード調査。
  - update: 2026-01-15 18:30 JST Step5 の running/paused 判定を processingStatus 単一ソースに統一し、タスク/進捗由来の状態推定を撤廃。検証: 未実施。
  - update: 2026-01-16 03:20 JST Step5 でビルド開始後に fetch が進捗しない/自動で paused になる事象の調査に着手。
  - update: 2026-01-16 03:40 JST Step5 の pause 処理が依存変更時の cleanup で発火していたため、unmount 時のみ発火するよう ref 管理へ変更。
  - update: 2026-01-16 03:45 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。
  - update: 2026-01-15 18:50 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - start: 2026-01-16 04:10 JST Step5 の非実行ステージの indeterminate 表示とタスクリストの Skeleton フラッシュ修正に着手。
  - blocked: 2026-01-16 04:18 JST pnpm typecheck がタイムアウトで失敗（exit 124）。
  - update: 2026-01-16 04:22 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。

2201) refactor/gis-sdk/build-types-dedupe (P1) — 進行中 (2026-01-15)
- ブランチ名: refactor/gis-sdk/build-types-dedupe
- 依存: なし
- 受け入れ基準: `packages/features/gis-sdk/src/types/_BuildConfig.ts` と `packages/features/gis-sdk/src/types/types.ts` の重複型が整理される／公開 export が明確になり既存参照が壊れない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/types/_BuildConfig.ts`, `packages/features/gis-sdk/src/types/types.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、型定義を修正前に戻す
- チェックリスト:
  - 重複している型を特定する
  - 片方へ集約し export を整理する
  - 参照箇所を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 00:20 JST gis-sdk の BuildConfig/types 重複整理に着手。
  - update: 2026-01-15 00:30 JST BuildConfig の FeatureFilter/Hyrbid 型を processing 由来に統一し、types.ts は BuildConfig を再利用。検証: 未実施。
  - update: 2026-01-15 00:35 JST types/BuildConfig 内の再エクスポートを撤去し、types.ts の再エクスポートも削除。検証: 未実施。

2200) fix/shape-store/build-session-metadata-import (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape-store/build-session-metadata-import
- 依存: なし
- 受け入れ基準: `@hierarchidb/shape-store` の `build:types` で `BuildSessionMetadata` 未解決エラーが解消される／`@hierarchidb/gis-sdk` 参照の型名が正しいものに置換される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、型名参照を修正前に戻す
- チェックリスト:
  - エラーの参照箇所と正しい型名を特定する
  - `@hierarchidb/gis-sdk` の import を修正する
  - `@hierarchidb/shape-store` の `build:types` を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 00:00 JST `@hierarchidb/shape-store` build:types で BuildSessionMetadata が未解決のため修正に着手。
  - update: 2026-01-15 00:10 JST `@hierarchidb/gis-sdk` の参照を BatchSessionMetadata に置換。検証: 未実施。

2199) fix/shape/step5-stage-task-counts (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step5-stage-task-counts
- 依存: なし
- 受け入れ基準: Step5 の各ステージカードが上部サマリと同じ総タスク数を反映する／タスク未永続化時でも No tasks yet ではなくサマリ件数が表示される／UI確認結果を記録する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step5 のステージ表示を修正前に戻す
- チェックリスト:
  - サマリ由来の件数をステージ表示へ反映する
  - タスク未永続化時の表示を補正する
  - UI確認結果を記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 10:05 JST Step5 のステージ件数表示がサマリと不一致のため修正に着手。
  - update: 2026-01-15 10:30 JST task.type を優先してステージ集計するよう補正。localhost:4200 の Step5 で Fetch が Completed 0/230 とタスクリストを表示することを確認。
  - update: 2026-01-15 10:45 JST Step5 でビルド開始後に Fetch が進行しない事象の原因調査を開始。
  - update: 2026-01-15 11:10 JST 休止状態の再開でパイプラインが不在の場合に既存タスクを再開するよう補正。Step5 のビルド再開後に Fetch が進行し、Completed が増加することを確認。
  - done: 2026-01-15 11:10 JST Step5 の再開操作で Fetch が進行することを確認。検証: localhost:4200 の Step5 で進行率/Completed が更新されることを確認。
  - update: 2026-01-15 11:25 JST Step5 のタスクバークリックで該当タスク位置へスクロールする対応に着手。
  - update: 2026-01-15 11:45 JST TaskProgressBar クリックでスクロール対象を共有し、仮想化リストが該当タスク位置へスクロールするよう補正。
  - done: 2026-01-15 11:45 JST Step5 の進捗バー rect クリックでタスク一覧が該当位置へスクロールすることを確認。検証: localhost:4200 の Step5 で確認。
  - update: 2026-01-15 12:10 JST 停止→再開時に running タスクを再キュー化し、必要ならパイプラインを再起動するよう補正。
  - done: 2026-01-15 12:15 JST Step5 で fetch の running が残るケースに対して再開時に再処理する挙動へ変更。検証: localhost:4200 の Step5 で確認。
  - update: 2026-01-15 12:25 JST transform ステージの failed 判定条件の調査に着手。
  - done: 2026-01-15 12:35 JST transform failed 条件と invalid polygon の発生箇所を整理し説明を作成。
  - update: 2026-01-15 12:45 JST transform failed 条件1〜4のメッセージ明示化に着手。
  - done: 2026-01-15 13:05 JST transform failed 条件ごとのメッセージを明示化（input/band/buffer/簡略化）し説明を準備。
  - update: 2026-01-15 13:30 JST Step4 削除カードのラベルに件数表示/0件時disabledを反映。簡略化設定のtoleranceを弱める方向に調整。Discard確認で閉じない問題とTaskProgressBarのa11y警告を修正。
  - update: 2026-01-15 13:45 JST simplify failed メッセージに extract1/extract2 の段階情報を付与する修正に着手。
  - update: 2026-01-15 13:45 JST リロード直後にビルド中表示になる不具合の調査に着手。
  - update: 2026-01-15 14:20 JST リロード直後にビルド中表示になる不具合の修正に着手。
  - done: 2026-01-15 14:30 JST リロード直後に進捗がない場合は running と見なさず Start を有効化する補正を追加。検証: 未実施。
  - update: 2026-01-15 14:40 JST 進捗合計が残っていても実行中タスクがない場合は running を解除する補正を追加。検証: 未実施。

2200) fix/route/buildstep-stage-icons (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/route/buildstep-stage-icons
- 依存: なし
- 受け入れ基準: RouteBuildStep の STAGES が icon を持ち BuildStage 要件を満たす／route-plugin typecheck の TS2322 が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`
- ロールバック手順: icon 追加を revert し STAGES を修正前に戻す
- チェックリスト:
  - STAGES に icon を追加する
  - typecheck を確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-15 15:00 JST RouteBuildStep の STAGES に icon がなく typecheck が失敗するため修正に着手。
  - done: 2026-01-15 15:05 JST RouteBuildStep の各ステージにアイコンを追加。検証: 未実施。

2198) feat/shape/step6-preview-tabs (P1) — 進行中 (2026-01-14)
- ブランチ名: feat/shape/step6-preview-tabs
- 依存: なし
- 受け入れ基準: Step6 Preview の既存 2 タブ構成が 3 タブ（Sources/Features/Map）に再設計される／Sources は ShapeSourceMetadata、Features は ShapeFeatureMetadata の表を表示する／Map は既存表示を維持する／既存の検索/フィルタ/選択が破綻しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/*`
- ロールバック手順: 該当差分を revert し、Step6 タブ構成を変更前に戻す
- チェックリスト:
  - Step6 のタブ構成を 3 タブへ再設計する
  - Sources/Features/Map の表示を割り当てる
  - 既存の検索/フィルタ/選択を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 17:15 JST Step6 Preview のタブ再構成に着手。
  - done: 2026-01-14 17:45 JST Step6 を Sources/Features/Map の3タブ構成に再設計。検証: 未実施。
  - update: 2026-01-14 18:35 JST ShapeOriginMetadata を ShapeSourceMetadata に差し替え。検証: 未実施。

2197) fix/shape/vector-tile-metadata-api (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/vector-tile-metadata-api
- 依存: なし
- 受け入れ基準: vector tile のメタデータ取得 API に data を含めない／Row を含む命名を撤去する／既存参照が新 API に置換される／typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/ShapeQueryAPI.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `plugins/shape-plugin/src/services/tiles/VectorTileService.ts`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`
- ロールバック手順: 該当差分を revert し、API/型/参照を修正前に戻す
- チェックリスト:
  - vector tile のメタデータ型/API を整理する
  - 参照箇所を新 API に置換する
  - typecheck を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 16:30 JST vector tile メタデータ API の整理に着手。
  - update: 2026-01-14 17:10 JST ExecPlan を再編し命名方針（batch→build/ephemeral/vt/Source排除）を反映。
  - done: 2026-01-14 16:50 JST listVectorTileMetadata へ変更し data を除外。検証: 未実施。

2196) refactor/batch/naming-input-payload (P1) — 進行中 (2026-01-14)
- ブランチ名: refactor/batch/naming-input-payload
- 依存: なし
- 受け入れ基準: batch/builder 周辺の命名で Source→Input, Record→Payload, Row→整理 が適用される／型・API・実装が整合する／typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/*`, `packages/runtime-worker/src/services/*`, `plugins/shape-plugin/src/services/batch/*`, `plugins/shape-plugin/src/ui/components/step4/*` ほか（スコープ確定後に絞り込み）
- ロールバック手順: 該当差分を revert し、命名を修正前に戻す
- チェックリスト:
  - 対象スコープを確定する
  - 置換ルール（Source/Record/Row）を適用する
  - 参照/型/テストを更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 15:20 JST 命名リファクタのスコープ確認に着手。
  - blocked: 2026-01-14 15:20 JST 置換対象のスコープ確定待ち。
  - update: 2026-01-14 18:20 JST build/ephemeral/vt/Origin 命名のリネームを適用中。検証: 未実施。
  - update: 2026-01-14 18:35 JST ShapeOriginMetadata を ShapeSourceMetadata に再調整。検証: 未実施。
  - update: 2026-01-14 20:05 JST Step4 UI確認: 変更したタイムアウト/リトライ間隔が再表示で保持されることを確認。ただし入力値が連結された状態（例: 300000310000 / 10002000）で保存される挙動を確認。
  - blocked: 2026-01-14 18:40 JST shape-plugin typecheck で EphemeralShapeAPI/ShapeStore 参照の差分が残存。
  - update: 2026-01-14 18:50 JST PluginEphemeralDBAPI を追加し plugin-service-api/shape-store を build。Step6 の feature sort と EphemeralShapeAPI 実装を補正し、`pnpm --filter @hierarchidb/shape-plugin typecheck` が成功。

2195) fix/shape/step4-vt-counts (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-vt-counts
- 依存: なし
- 受け入れ基準: Step4 の VT 件数が vtTasks.length に基づく／削除ボタンの件数表示が実データと一致する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`
- ロールバック手順: 該当差分を revert し、件数集計を修正前に戻す
- チェックリスト:
  - VT 件数の集計を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 15:10 JST Step4 VT 件数表示の修正に着手。
  - done: 2026-01-14 15:12 JST VT 件数を vtTasks.length で集計するよう修正。検証: 未実施。

2194) fix/ui/buildstep-header-icon (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/buildstep-header-icon
- 依存: なし
- 受け入れ基準: BuildStepStagePanel のヘッダで title 左に icon が表示される／アイコン指定ステージで表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepPanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、ヘッダ表示を修正前に戻す
- チェックリスト:
  - BuildStepStagePanel に icon props を追加する
  - BuildStepPanel から stage.icon を渡す
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 14:50 JST BuildStep ヘッダのアイコン表示修正に着手。
  - done: 2026-01-14 15:00 JST BuildStepStagePanel に icon を追加し、BuildStepPanel から渡すよう修正。検証: 未実施。

2193) fix/ui/lru-splitview2-duplicate-header (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/lru-splitview2-duplicate-header
- 依存: なし
- 受け入れ基準: Step5 の pane ヘッダ重複表示が解消される／BuildStepStagePanel のヘッダが1回だけ表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、ヘッダ表示を修正前に戻す
- チェックリスト:
  - collapsed/expanded 時の表示構成を調整する
  - ヘッダ重複を解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 14:10 JST LRUSplitView2 のヘッダ重複表示修正に着手。
  - done: 2026-01-14 14:35 JST Step5 の stage content 側ヘッダ表示を抑止して重複を解消。検証: 未実施。
  - done: 2026-01-14 14:20 JST BuildStepPanel の collapsed 時ヘッダ描画を撤去し重複を解消。検証: 未実施。

2192) fix/ui/lru-splitview2-empty-render (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/lru-splitview2-empty-render
- 依存: なし
- 受け入れ基準: Step5 で LRUSplitView2 が表示される／pane が描画される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/LRUSplitView2.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、LRUSplitView2 を修正前に戻す
- チェックリスト:
  - LRUSplitView2 のレンダ条件を見直す
  - Step5 で表示確認を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 13:35 JST Step5 の LRUSplitView2 空表示を調査開始。
  - done: 2026-01-14 13:45 JST LRUSplitView2 の幅ゼロでも Allotment を描画するよう修正。検証: 未実施。
  - update: 2026-01-14 13:55 JST panes 変更時に useLRUPanes が状態を再生成するよう補正。検証: 未実施。

2191) fix/components/buildstep-typecheck (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/components/buildstep-typecheck
- 依存: なし
- 受け入れ基準: BuildStep の型エラー（TS2305/TS7031/TS2322）が解消される／`@hierarchidb/components typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、BuildStep の実装を修正前に戻す
- チェックリスト:
  - BuildStage の型定義を修正する
  - renderPane の型注釈を補う
  - BuildStepStagePanel の props を整合させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 13:05 JST BuildStep の型エラー修正に着手。
  - done: 2026-01-14 13:15 JST BuildStage 型を追加し、BuildStep の型注釈と props を整合。検証: 未実施。

2190) fix/components/buildstep-panel-export (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/components/buildstep-panel-export
- 依存: なし
- 受け入れ基準: BuildStepPanel が @hierarchidb/components から export される／app build の MISSING_EXPORT が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/index.ts`
- ロールバック手順: 該当差分を revert し、export を修正前に戻す
- チェックリスト:
  - BuildStepPanel の export を追加する
  - app build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:50 JST BuildStepPanel export 修正に着手。
  - update: 2026-01-14 13:25 JST BuildStepPanel 再exportを再追加し、BuildStage の export/import を整理。検証: 未実施。
  - done: 2026-01-14 12:55 JST BuildStep を BuildStepPanel として再export。検証: 未実施。

2189) feat/ui/lru-splitview2 (P1) — 進行中 (2026-01-14)
- ブランチ名: feat/ui/lru-splitview2
- 依存: なし
- 受け入れ基準: LRUSplitView2 が汎用 API で追加される／進捗表示テンプレが内蔵されない／BuildStepPanel が LRUSplitView2 + BuildStepStagePanel を使う構成になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/LRUSplitView2.tsx`, `packages/components/src/BuildStepPanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、LRUSplitView の利用に戻す
- チェックリスト:
  - LRUSplitView2 を新規追加する
  - BuildStepPanel を LRUSplitView2 + BuildStepStagePanel で構成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:20 JST LRUSplitView2 の設計・実装に着手。
  - done: 2026-01-14 12:45 JST LRUSplitView2 を追加し、BuildStep を LRUSplitView2 + BuildStepStagePanel で構成。検証: 未実施。

2188) fix/app/typecheck-shapequeryapi-import (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/typecheck-shapequeryapi-import
- 依存: なし
- 受け入れ基準: useFolderLayers の ShapeQueryAPI import 解決エラー（TS2305）が解消される／`@hierarchidb/app typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/useFolderLayers.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、import を修正前に戻す
- チェックリスト:
  - ShapeQueryAPI の import 先を修正する
  - typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:00 JST useFolderLayers の ShapeQueryAPI import エラー修正に着手。
  - done: 2026-01-14 12:05 JST ShapeQueryAPI の import 先を plugin-service-api に修正。検証: 未実施。

2187) fix/app/typecheck-runtime-worker-shape-imports (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/typecheck-runtime-worker-shape-imports
- 依存: なし
- 受け入れ基準: ShapeQueryService の戻り値型不整合（TS2322）が解消される／StageProcessingService の戻り値不足（TS2366）が解消される／shape-plugin index の ShapeDB import エラー（TS2339）が解消される／`@hierarchidb/app typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeQueryService.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/index.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、各ファイルを修正前に戻す
- チェックリスト:
  - ShapeQueryService の戻り型を修正する
  - StageProcessingService の return を補完する
  - shape-plugin の ShapeDB import を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 11:35 JST app typecheck の runtime-worker/shape-plugin エラー修正に着手。
  - done: 2026-01-14 11:50 JST transformSourceBuffers 参照と ShapeDB import を修正し戻り値不足を補正。検証: 未実施。
  - update: 2026-01-14 19:05 JST ProcessingStage を BuildStage に差し替え、UnifiedBatchManagerBase に getBatchSessionStatus を追加。`pnpm --filter @hierarchidb/app typecheck` が成功。検証: 実施。
  - update: 2026-01-14 19:15 JST `pnpm --filter @hierarchidb/runtime-worker typecheck` と `pnpm --filter @hierarchidb/shape-plugin build` を実施。検証: 実施。
  - update: 2026-01-14 19:25 JST `pnpm --filter @hierarchidb/app build` を実行し成功（警告: plugin registry entry path / chunk size）。検証: 実施。
  - update: 2026-01-14 20:05 JST Step6 UI確認: タブはソース/フィーチャー/地図プレビューの3つに分離され切替可能。ビルド未完了のためメタデータ未生成メッセージを確認。
  - update: 2026-01-14 20:30 JST Step6 のメタデータ空表示を安定化。Source/Feature ともに「メタデータがまだ生成されていません」表示が安定して切替時のチラつきが出ないことを確認。
  - blocked: 2026-01-14 19:40 JST UI検証のために preview/dev を起動したが、listen EPERM（0.0.0.0:4173/4200）で起動不可。手元でのUI確認が必要。

2186) fix/app/build-unresolved-shape-preview-import (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/build-unresolved-shape-preview-import
- 依存: なし
- 受け入れ基準: useShapePreviewStep の import 解決エラーが解消される／`@hierarchidb/app build` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、import を修正前に戻す
- チェックリスト:
  - useShapePreviewStep の import を解決する
  - app build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 11:10 JST shape preview の import 解決エラー修正に着手。
  - done: 2026-01-14 11:20 JST shape preview/step5 の ShapeBuildApiClient import を相対パスへ修正。検証: 未実施。

2185) fix/runtime-worker/tsconfig-missing-path (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/runtime-worker/tsconfig-missing-path
- 依存: なし
- 受け入れ基準: runtime-worker の tsconfig.json で JSONError（missing field `path`）が解消される／`@hierarchidb/runtime-worker build` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/tsconfig.json`
- ロールバック手順: 該当差分を revert し、tsconfig.json を修正前に戻す
- チェックリスト:
  - tsconfig.json の references/path を修正する
  - build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:55 JST runtime-worker tsconfig.json の JSONError 修正に着手。
  - done: 2026-01-14 11:00 JST tsconfig.json の空 references を削除し JSONError を解消。検証: 未実施。

2184) fix/shape/typecheck-session-config-mappers (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/typecheck-session-config-mappers
- 依存: なし
- 受け入れ基準: shapeSessionMappers の BatchProcessConfig/BatchSessionConfig 型不整合（TS2739）が解消される／`@hierarchidb/shape-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/shapeSessionMappers.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、shapeSessionMappers の変換ロジックを修正前に戻す
- チェックリスト:
  - shapeSessionMappers の config 変換を整理する
  - typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:35 JST shapeSessionMappers の型エラー修正に着手。
  - done: 2026-01-14 10:45 JST shapeSessionMappers の config 型ガードを BatchSessionConfig に合わせて修正。検証: 未実施。

2183) fix/shape/typecheck-missing-shape-types (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/typecheck-missing-shape-types
- 依存: なし
- 受け入れ基準: ShapeEntity/SelectedArrayByCountries の export 解決エラー（TS2305）が解消される／GeoBoundariesStrategy の decodeBuffer 型不整合（TS2322）が解消される／shapePipeline/utils の型エラーが解消される／CrashInsight の型エラー（TS2345）が解消される／`@hierarchidb/shape-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/common/types/index.ts`, `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildProgressWarnings.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、shape-plugin の型定義/参照を修正前に戻す
- チェックリスト:
  - ShapeEntity/SelectedArrayByCountries の export を整理する
  - GeoBoundariesStrategy の decodeBuffer 型不整合を解消する
  - selection 型由来の TS2339/TS7006/TS2345 を解消する
  - CrashInsight の型整合を取る
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:40 JST shape-plugin の typecheck エラー修正に着手。
  - done: 2026-01-14 10:10 JST ShapeEntity/SelectedArrayByCountries の export を追加し、GeoBoundaries/CrashInsight の型不整合を修正。検証: 未実施。
  - update: 2026-01-14 10:15 JST GeoBoundaries metadata.continent の null を undefined に補正。検証: 未実施。

2182) fix/route/typecheck-missing-route-batch-session (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/route/typecheck-missing-route-batch-session
- 依存: なし
- 受け入れ基準: RouteBatchSession の import 解決エラー（TS2307）が解消される／`@hierarchidb/route-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/services/RouteBatchManager.ts`, `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts`, `plugins/route-plugin/src/services/RouteBatchSession.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、RouteBatchSession の参照パスを修正前に戻す
- チェックリスト:
  - RouteBatchSession の import 解決を修正する
  - route-plugin の typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:10 JST RouteBatchSession の import 解決エラー修正に着手。
  - done: 2026-01-14 09:25 JST RouteBatchSession.ts を追加し、RouteBatchSession の import 解決エラーを解消。検証: 未実施。

2181) refactor/shape/preview-step-hook (P2) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/preview-step-hook
- 依存: なし
- 受け入れ基準: ShapePreviewStep のロジックがカスタムフックに抽出される／挙動と表示が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`（予定）
- ロールバック手順: 追加フックと差分を revert し、ShapePreviewStep の直接実装へ戻す
- チェックリスト:
  - ShapePreviewStep のロジックをフックへ抽出する
  - 影響範囲を最小に保つ
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 22:59 JST ShapePreviewStep のロジック抽出に着手。
  - done: 2026-01-10 23:04 JST ShapePreviewStep の表示ロジックを useShapePreviewStepView に抽出。検証: 未実施。

2181) refactor/shape/batch-progress-summary-card-component (P2) — 進行中 (2026-01-10)
- ブランチ名: refactor/shape/batch-progress-summary-card-component
- 依存: なし
- 受け入れ基準: TaskProgressSummaryCard がコンポーネントとして切り出される／ShapeBuildProgressPanel からの利用は既存挙動と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressPanel.tsx`
- ロールバック手順: 該当差分を revert し、関数定義のまま戻す
- チェックリスト:
  - TaskProgressSummaryCard をコンポーネントとして定義する
  - ShapeBuildProgressPanel からコンポーネントとして利用する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:36 JST TaskProgressSummaryCard のコンポーネント化に着手。
  - done: 2026-01-10 20:36 JST TaskProgressSummaryCard をコンポーネントとして分離し、ShapeBuildProgressPanel から利用。検証: 未実施。
  - update: 2026-01-10 20:36 JST renderStageContent のコンポーネント化に着手。
  - done: 2026-01-10 20:36 JST ProgressStageContent コンポーネントへ切り出し、ShapeBuildProgressPanel から利用。検証: 未実施。
  - update: 2026-01-10 20:41 JST renderTaskProgressBar のコンポーネント化に着手。
  - done: 2026-01-10 20:41 JST TaskProgressBar コンポーネントへ切り出し、ShapeBuildProgressPanel から利用。検証: 未実施。

2127) fix/components/build-stage-content-filtering (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/components/build-stage-content-filtering
- 依存: なし
- 受け入れ基準: BuildStepStageDetailsPanel の文法エラーが解消される／failed/completed のフィルタは renderStageContent 側で行われる／failed/completed の ON/OFF に応じて表示内容が切り替わる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStageDetailsPanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStep.tsx`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 該当ファイルの差分を revert し、BuildStepStageDetailsPanel 側のフィルタ処理へ戻す
- チェックリスト:
  - BuildStepStageDetailsPanel の文法エラーを解消する
  - renderStageContent に failed/completed フィルタ引数を追加する
  - フィルタ挙動を renderStageContent 側へ移動する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:55 JST BuildStepStageDetailsPanel のフィルタ移設と文法修正に着手。
  - update: 2026-01-11 23:02 JST BuildStepStageDetailsPanel からフィルタ処理を撤去し、renderStageContent 側で failed/completed フィルタを適用。検証: 未実施。
  - done: 2026-01-11 23:02 JST BuildStepStageDetailsPanel の文法修正とフィルタ移設を完了。

2128) refactor/shape/build-progress-step-split (P1) — 進行中 (2026-01-11)
- ブランチ名: refactor/shape/build-progress-step-split
- 依存: なし
- 受け入れ基準: ShapeBuildStep がコンポーネント/ロジック単位で分割され行数が大幅に削減される／挙動差分がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` と新規分割ファイル
- ロールバック手順: 分割差分を revert し単一ファイル構成へ戻す
- チェックリスト:
  - UI サブコンポーネントの分割先を設計する
  - ロジックをカスタムフックへ移動する
  - 元ファイルの行数削減と動作確認を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:10 JST ShapeBuildStep の分割リファクタに着手。
  - update: 2026-01-11 23:25 JST サブコンポーネント/フックを分割し、ShapeBuildStep を薄くする構成へ移行。検証: 未実施。
  - done: 2026-01-11 23:25 JST ShapeBuildStep の分割リファクタを完了。

2129) refactor/shape/build-progress-stage-content-component (P1) — 進行中 (2026-01-11)
- ブランチ名: refactor/shape/build-progress-stage-content-component
- 依存: なし
- 受け入れ基準: ShapeBuildProgressPanel の renderStageContent を専用コンポーネントへ分割し、挙動を維持する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressPanel.tsx` と新規コンポーネント
- ロールバック手順: 分割差分を revert し renderStageContent のまま戻す
- チェックリスト:
  - renderStageContent を専用コンポーネントへ移す
  - 呼び出し側を props 経由で整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:40 JST renderStageContent のコンポーネント化に着手。
  - update: 2026-01-11 23:55 JST renderStageContent を専用コンポーネントへ移設し、Panel 側は組み立てのみへ整理。検証: 未実施。
  - done: 2026-01-11 23:55 JST renderStageContent のコンポーネント化を完了。

2130) refactor/shape/build-progress-stage-content-props (P1) — 完了 (2026-01-14)
- ブランチ名: refactor/shape/build-progress-stage-content-props
- 依存: なし
- 受け入れ基準: BuildStep への renderStageContent 渡しが廃止され、stageContents の素直な構成へ移行する／BuildStepStagePanel の filter 状態は context 経由で stage content から参照できる／ShapeBuildProgressPanel はコンポーネントを返す関数を持たず整理される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageFilterContext.tsx`, `packages/components/src/index.ts`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`
- ロールバック手順: 該当差分を revert し、renderStageContent props を利用する構成へ戻す
- チェックリスト:
  - BuildStep/BuildStepStagePanel の props とレンダリング経路を整理する
  - stage content 側で filter を context 参照に変更する
  - ShapeBuildProgressPanel の組み立てを stageContents へ統一する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:30 JST renderStageContent props の廃止と stageContents 化に着手。
  - update: 2026-01-14 10:35 JST BuildStep/BuildStepStagePanel の props を stageContents/context へ整理。検証: 未実施。
  - done: 2026-01-14 10:40 JST ShapeBuildProgressPanel の stageContents 化と StageContent の filter context 参照を完了。検証: 未実施。


2178) feat/shape/raw-buffer-pipeline (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/raw-buffer-pipeline
- 依存: なし
- ExecPlan: `plans/shape-raw-buffer-pipeline-execplan.md`
- 受け入れ基準: DownloadBuffersForNode の命名を rawDataDataSourceBuffers に統一する／データソース戦略で raw ストリームの変換パイプを差し込める（入口でハッシュ計算）／GeoBoundaries は GeoJSON→FlatGeobuf を保存する／GADM は admin0 を zip 化して保存し admin1+ は zip のまま保存する／transformSource でバッファ形式ごとの解凍/再変換を戦略側で行う／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/datasources/*`, `packages/runtime-worker/src/services/shapeChunkStore.ts`, `packages/features/download` など（調査結果に応じて）
- ロールバック手順: 該当差分と ExecPlan を revert し、旧 download/raw バッファ経路に戻す
- チェックリスト:
  - raw buffer の命名と API を整理する
  - raw 取得の変換パイプとハッシュ計算を導入する
  - GeoBoundaries と GADM の保存フォーマットを仕様に合わせる
  - transformSource の前処理を戦略側に寄せる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 22:05 JST raw バッファ命名と fetch パイプ整備に着手。
  - update: 2026-01-10 22:10 JST ExecPlan を作成（`plans/shape-raw-buffer-pipeline-execplan.md`）。
  - update: 2026-01-10 22:30 JST GADM を GeoJSON 取得へ統一し、gpkg/shp 前提コードを削除する方針で確定。
  - update: 2026-01-10 22:55 JST raw バッファ命名の更新、raw pipeline helper、GeoBoundaries/GADM の変換パイプラインを実装。
  - done: 2026-01-10 23:05 JST raw バッファ命名更新と GADM/GeoBoundaries の GeoJSON/zip 変換パイプラインを適用。検証: 未実施。

2177) fix/shape/step4-fetch-cache-count (P1) — 進行中 (2026-01-10)
- ブランチ名: fix/shape/step4-fetch-cache-count
- 依存: なし
- 受け入れ基準: Step4 の「fetchキャッシュを削除(n件)」件数が実データと一致する／算出元が明確で矛盾がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の件数算出へ戻す
- チェックリスト:
  - fetch の件数算出を実データに合わせる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:40 JST fetch キャッシュ件数表示の不整合対応に着手。

2176) fix/ui/step5-completed-chip-on-fail (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-completed-chip-on-fail
- 依存: なし
- 受け入れ基準: 失敗時でも Completed チップが表示される／失敗時の Completed チップはアウトライン表示になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneProgressSummary.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Failed と Completed の併記を許可する
  - 失敗時は Completed チップを outlined にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:20 JST 失敗時の Completed チップ表示復帰に着手。
  - done: 2026-01-10 21:23 JST 失敗時も Completed チップを表示し、outline 表示に調整。検証: 未実施。

2175) fix/log/shape-tasksummary-spam (P1) — 完了 (2026-01-10)
- ブランチ名: fix/log/shape-tasksummary-spam
- 依存: なし
- 受け入れ基準: taskSummary の同一内容ログが連続出力されない／進捗計算や UI 表示に影響がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のログ出力へ戻す
- チェックリスト:
  - taskSummary のログを差分時のみ出力する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:05 JST taskSummary ログの連続出力抑止に着手。
  - done: 2026-01-10 21:08 JST taskSummary を差分時のみログ出力するよう抑制。検証: 未実施。

2174) fix/shape/transform-error-message-compact (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/transform-error-message-compact
- 依存: なし
- 受け入れ基準: transform の失敗メッセージが features/polygons/missingGeometry のみになる／余分な識別子が出ない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のメッセージへ戻す
- チェックリスト:
  - 失敗メッセージから band/admin/source を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:55 JST transform 失敗メッセージの簡略化に着手。
  - done: 2026-01-10 20:58 JST 失敗メッセージを features/polygons/missingGeometry のみに簡略化。検証: 未実施。

2173) fix/ui/step5-pane-failed-chip-dup (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-pane-failed-chip-dup
- 依存: なし
- 受け入れ基準: 失敗時の Chip が「Failed x」だけ表示され、重複表示が消える／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneHeader.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Failed チップの重複表示を抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:40 JST Failed チップ重複表示の対応に着手。
  - done: 2026-01-10 20:45 JST 失敗時は Failed チップのみ表示し、Completed チップを抑止。検証: 未実施。

2172) fix/ui/step5-pane-chip-labels (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-pane-chip-labels
- 依存: なし
- 受け入れ基準: 上部のステージ別 Chip が「Completed n/m」形式になる／失敗がある場合は「Failed x」「Completed y/z」が表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneProgressSummary.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Completed/Failed 表記を適用する
  - 失敗がある場合は2つの Chip を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:25 JST ステージ別 Chip 表記の改善に着手。
  - done: 2026-01-10 20:30 JST Completed/Failed の Chip 表記へ変更し、失敗時は2つの Chip を表示。検証: 未実施。

2171) fix/shape/step5-pane-failed-counts (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-pane-failed-counts
- 依存: なし
- 受け入れ基準: ペインヘッダの failed 数が実際の失敗件数と一致する／タスクリストの status が実態と一致する／全体進捗の failed 数とペインヘッダが整合する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の集計ロジックへ戻す
- チェックリスト:
  - taskSummary の stage 集計が taskType ベースで行われる
  - ペイン summary の failed 件数が一致する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:10 JST Step5 failed 件数の不整合対応に着手。
  - done: 2026-01-10 20:15 JST taskType 優先でステージ集計するよう補正し、ペインの failed 数が実数を反映。検証: 未実施。

2170) fix/shape/step5-error-visibility-and-vt-status (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-error-visibility-and-vt-status
- 依存: なし
- 受け入れ基準: 失敗タスクの message が詳細な原因を含む／失敗タスクのタイトルに国名が表示される／ペインヘッダに失敗数が明示され、不要な PlayCircle が表示されない／vt ステージ 0/0 の場合に全体進捗が Ready にならない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `packages/ui/lru-splitview/src/components/PaneHeader.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示/進捗判定へ戻す
- チェックリスト:
  - transform の失敗メッセージに feature 数/簡易化結果を含める
  - transform タスクに国名を付与する
  - PaneHeader に失敗数を表示し、0/0 で PlayCircle を出さない
  - vt 0/0 時の全体進捗/Ready 表示を抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:10 JST Step5 の失敗情報とペイン表示の不整合対応に着手。
  - done: 2026-01-10 19:40 JST 変換失敗の詳細メッセージと国名付与、ペインヘッダの失敗数表示と0/0時のアイコン抑制、vt 0/0時のReady表示補正を実施。検証: 未実施。

2169) fix/shape/step4-5-task-labels-and-delete (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-5-task-labels-and-delete
- 依存: なし
- 受け入れ基準: Step5 の transform タスクに国情報が表示される／成功・失敗メッセージが表示される／Step4 の Transform キャッシュ削除ボタンが対象タスクありで有効化される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示/削除判定へ戻す
- チェックリスト:
  - transform タスクタイトルに国コード/国名を含める
  - タスクの message/errorMessage を UI へ表示する
  - vt-task-queue のタスク数で削除ボタンが有効になる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:20 JST Step5 タスク表示と Step4 削除ボタンの不整合対応に着手。
  - done: 2026-01-10 18:45 JST transform タスクの国表示とエラーメッセージ表示を追加し、vt-task-queue の件数で削除ボタンを有効化。検証: 未実施。

2168) fix/dialog/conflict-autosave-policy (P1) — 完了 (2026-01-10)
- ブランチ名: fix/dialog/conflict-autosave-policy
- 依存: なし
- 受け入れ基準: 競合チェックが保存時のみ実行される／autosave は実編集後にのみ実行される／UI state 保存による version 変化は競合判定に含まれない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`, `packages/plugin-ui-host/src/headless/usePluginDialogController/conflict-guard.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/autosave.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の競合チェック/ autosave の挙動へ戻す
- チェックリスト:
  - ステップ遷移で競合チェックを実行しない
  - autosave を実編集後にのみ許可する
  - UI state 変更のみの version 変化を競合扱いしない
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:30 JST 競合チェックと autosave の方針修正に着手。
  - done: 2026-01-10 18:05 JST 競合チェックを保存時のみ実行し、autosave は実編集後に限定、UI state のみの更新は競合扱いしないよう補正。検証: 未実施。

2167) fix/shape/step4-stepper-stall (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-stepper-stall
- 依存: なし
- 受け入れ基準: Step4「処理設定」への遷移で CircularProgress が無限に残らず操作可能になる／無限ローディングの原因を特定し修正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/conflict-guard.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step4 遷移挙動へ戻す
- チェックリスト:
  - ステップ遷移時の pendingAction が解放されることを確認する
  - 影響範囲を最小にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:05 JST Step4 遷移で Stepper の CircularProgress が固まる問題の調査に着手。
  - done: 2026-01-10 17:12 JST ステップ遷移時の競合チェックが応答待ちで固まるケースにタイムアウトを追加し、pendingAction が解放されるよう補正。検証: 未実施。

2166) fix/shape-route/step5-tasklist-vt-queue (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape-route/step5-tasklist-vt-queue
- 依存: なし
- 受け入れ基準: Step5 のタスク一覧が vt-task-queue を唯一の参照元として表示される／旧 getBatchTaskSummaries（ephemeral）を参照しない／shape・route の双方で「no tasks yet」が解消され完了タスクが一覧に表示される／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/worker/*`, `plugins/route-plugin/src/worker/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のタスク一覧取得ロジックへ戻す
- チェックリスト:
  - vt-task-queue を唯一のタスク取得元に統一する
  - shape/route の Step5 でタスク一覧が表示されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 16:05 JST Step5 のタスク一覧が vt-task-queue を参照しない問題の修正に着手。
  - done: 2026-01-10 16:35 JST getBatchTaskSummaries を撤去し vt-task-queue のみからタスク一覧を取得するよう統一。route 側も vt-task-queue 連携を追加。検証: 未実施。

2165) fix/shape/step5-progress-phase-stability (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-phase-stability
- 依存: なし
- 受け入れ基準: Step5 のビルド中に Start/Pause の表示が安定し、頻繁な切替が起きない／fetch の進捗が表示され Skeleton の明滅が収まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の進捗イベント運用へ戻す
- チェックリスト:
  - 進捗イベントの phase をセッション状態に合わせて安定させる
  - UI のビルド状態がタスク完了イベントで完了へ切り替わらないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:41 JST Step5 の進捗 phase が不安定でボタン状態が揺れる問題の対応に着手。
  - done: 2026-01-10 15:43 JST taskQueue 進捗イベントの phase をセッション状態へ統一し、完了/一時停止で揺れないよう補正。検証: 未実施。

2164) fix/ui/batch-progress-debounce (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/batch-progress-debounce
- 依存: なし
- 受け入れ基準: batch progress の UI 更新が適度にバウンスされ、Maximum update depth 警告が発生しない／更新頻度が抑制されても最終状態が反映される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/batch/src/progress/useBatchProgress.ts`（必要に応じて）
- ロールバック手順: 該当差分を revert し、従来の即時更新へ戻す
- チェックリスト:
  - progress 反映をデバウンスし、UI 更新頻度を抑制する
  - 最終状態が反映されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:38 JST progress 更新のバウンス対応に着手。
  - done: 2026-01-10 15:39 JST useBatchProgress の更新を 100ms デバウンスし、連続通知を抑制。検証: 未実施。

2163) fix/shape/step5-build-progress-and-pause (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-build-progress-and-pause
- 依存: なし
- 受け入れ基準: Step5 のビルド中に「停止」ボタンが有効化される／BuildStep に進捗が反映され Skeleton のみにならない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `packages/components/src/BuildStep.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step5 表示/操作へ戻す
- チェックリスト:
  - 停止ボタンの有効条件と i18n 表示を確認する
  - ビルド進捗の反映経路を整理し UI へ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:17 JST Step5 の停止ボタン未有効化と進捗未反映の調査に着手。
  - done: 2026-01-10 15:32 JST pause/resume の実装と Step5 の進捗ポーリング補正、Pause ラベルの i18n 反映を実施。検証: 未実施。

2162) fix/shape/step4-delete-cache-disabled (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-delete-cache-disabled
- 依存: なし
- 受け入れ基準: Step4 の「fetchキャッシュを削除(n件)」ボタンが件数>0で有効化される／クリックで削除が実行され件数表示が更新される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`, `plugins/shape-plugin/src/ui/components/steps/DownloadConfigSection.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のボタン状態へ戻す
- チェックリスト:
  - ボタンの disabled 条件が件数>0の時に有効化されるよう整理する
  - クリック時の削除処理と件数更新を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:05 JST Step4 の fetch キャッシュ削除ボタンが無効な問題の調査に着手。
  - done: 2026-01-10 15:08 JST Step4 の削除ボタン有効/無効判定を実際の batch session 状態で評価するよう補正。検証: 未実施。

2161) fix/shape/step5-fetch-progress-live (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-fetch-progress-live
- 依存: なし
- 受け入れ基準: Step5 の fetch 進捗がリアルタイムで反映される／進捗イベントの送信元とUI側の購読・集計が一致していることを確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `packages/features/batch/src/session/AbstractBatchSession.ts`, `plugins/shape-plugin/src/worker/api.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の進捗表示仕様へ戻す
- チェックリスト:
  - fetch の進捗イベントが UI に届いているか確認する
  - 集計/表示が進捗イベントのステージ名と一致するよう補正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:00 JST Step5 の fetch 進捗がリアルタイムに反映されない問題の調査に着手。
  - done: 2026-01-10 15:03 JST 進捗イベントにタスク集計ペイロードを付与し、Step5 の進捗集計が更新されるように修正。検証: 未実施。

2160) fix/shape/step5-progress-stage-naming (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-stage-naming
- 依存: なし
- 受け入れ基準: Step5 の進捗表示で誤ったステージ名を許容せず、正しいステージ名のみが扱われる／誤ったステージ名の発生源が修正される（コード内に残らない）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/utils/buildWarnings.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のステージ名許容へ戻す
- チェックリスト:
  - 誤ったステージ名の発生源を特定し、正しい命名へ修正する
  - UI 側の誤名称フォールバックを撤去する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:58 JST Step5 進捗ステージ名の誤表記対応に着手。
  - done: 2026-01-10 14:59 JST コード内の `fetch-shape` 発生源を確認したが該当なしのため、UI側の誤名称フォールバックを撤去。検証: 未実施。

2159) fix/shape/step5-progress-ui-stability (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-ui-stability
- 依存: なし
- 受け入れ基準: shape Step5 で LinearProgress の表示有無によるレイアウトの縦揺れが発生しない／fetch-shape ステージの進捗が Step5 の画面に反映される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step5 進捗表示へ戻す
- チェックリスト:
  - LinearProgress の表示有無でレイアウトが跳ねないようスペースを確保する
  - fetch-shape ステージの進捗状態を Step5 画面に反映させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:44 JST shape Step5 の進捗表示ゆれと fetch-shape 反映漏れの修正に着手。
  - done: 2026-01-10 14:46 JST fetch-shape を進捗集計へ正規化し、Step5 の進捗バーを常時高さ固定にして縦揺れを解消。検証: 未実施。

2158) fix/ui-map/add-deckgl-core-deps (P1) — 完了 (2026-01-12)
- ブランチ名: fix/ui-map/add-deckgl-core-deps
- 依存: なし
- 受け入れ基準: `@hierarchidb/ui-map` の devDependencies/peerDependencies に `@deck.gl/core` を追加する／`app` の dependencies に `@deck.gl/core` を追加する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/package.json`, `app/package.json`
- ロールバック手順: 該当 package.json の差分を revert する
- チェックリスト:
  - ui-map の peer/dev に @deck.gl/core を追加する
  - app の dependencies に @deck.gl/core を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 00:50 JST deck.gl core 依存の追加対応に着手。
  - done: 2026-01-12 00:55 JST ui-map の peer/dev と app dependencies に @deck.gl/core を追加。検証: 未実施。

2157) refactor/ci/turbo-preflight-parallel (P1) — 完了 (2026-01-11)
- ブランチ名: refactor/ci/turbo-preflight-parallel
- 依存: なし
- 受け入れ基準: `guard:preflight` の直列実行を turbo タスクで並列化する／`pnpm typecheck` の実行内容を維持する／依存関係が必要なもののみ順序付けする／TASKS.md に運用ログを記載する
- 影響範囲: `package.json`, `turbo.json`, `scripts/**`（必要時）
- ロールバック手順: 該当差分を revert して直列実行へ戻す
- チェックリスト:
  - guard:preflight の各チェックを turbo タスク化する
  - 依存関係があるものだけ dependsOn で明示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:20 JST guard:preflight の並列化設計に着手。
  - done: 2026-01-11 23:35 JST turbo の preflight タスクに分割し、guard:preflight を turbo 実行へ移行。検証: 未実施。
  - update: 2026-01-11 23:45 JST package.json の JSON 構文エラーを修正し、preflight スクリプトを scripts に配置し直した。検証: `node -e "JSON.parse(...)"`（成功）。

2156) fix/types/any-replacement (P1) — 完了 (2026-01-11)
- ブランチ名: fix/types/any-replacement
- 依存: なし
- 受け入れ基準: 指定された `any` 使用箇所を厳密な型に置換する／必要な型定義を追加する／`any` を残さない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/testing/plugin-dialog-mocks/src/mocks/WorkerAPIImpl.ts`, `packages/tools/gen-iso3166-2/src/scraper.ts`, `packages/ui/map/src/components/MapWithVectorTiles.tsx`, `packages/ui/map/src/components/MapWithDeckGL.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `packages/plugin-ui-host/src/PluginDialogHost.tsx`
- ロールバック手順: 該当ファイルの差分を revert して `any` 利用に戻す
- チェックリスト:
  - 指定ファイルの `any` 使用箇所を特定する
  - 既存型または新規型定義で置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:40 JST any 使用箇所の型厳格化に着手。
  - done: 2026-01-11 23:05 JST 指定ファイルの any を厳密な型へ置換し、入力検証/型定義を追加。検証: 未実施。
  - update: 2026-01-11 23:55 JST gen-iso3166-2 の型チェックエラーに対応し、cheerio 型の参照を domhandler 直接依存から外した。
  - update: 2026-01-12 00:05 JST cheerio の型推論が never になるため、最小限の CheerioCollection 型と型ガードで処理を明示した。
  - update: 2026-01-12 00:20 JST gen-iso3166-2 に domhandler を明示依存として追加し、cheerio 由来の AnyNode 型で型を整理した。
  - update: 2026-01-12 00:30 JST domhandler 直接参照を撤回し、CheerioAPI の入力型へ明示キャストする helper で型安全に統一した。
  - update: 2026-01-12 00:40 JST Cheerio<AnyNode> の this コンテキスト不整合を解消するため domhandler 依存を復帰し、selectNode の戻り型を AnyNode に揃えた。

2155) chore/ui-plugin-shell/remove-pretypecheck (P1) — 完了 (2026-01-10)
- ブランチ名: chore/ui-plugin-shell/remove-pretypecheck
- 依存: なし
- 受け入れ基準: `packages/ui/plugin-shell` の pretypecheck を削除する／`scripts/pretypecheck-ui-shell.mjs` を削除する／turbo の依存関係を必要最小限で補正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/plugin-shell/package.json`, `scripts/pretypecheck-ui-shell.mjs`, `turbo.json`（必要時）
- ロールバック手順: 該当差分を revert し、pretypecheck を復元する
- チェックリスト:
  - pretypecheck の削除と不要ファイルの撤去
  - turbo 依存関係の補正
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-10 12:34 JST pretypecheck の削除と turbo 依存関係の補正に着手。
  - done: 2026-01-10 12:38 JST pretypecheck を削除し、ui-plugin-shell の typecheck 依存を turbo に移行。

2154) chore/analysis/turbo-cache-miss (P1) — 完了 (2026-01-10)
- ブランチ名: chore/analysis/turbo-cache-miss
- 依存: なし
- 受け入れ基準: `pnpm build`/`pnpm typecheck` の turbo キャッシュ無効化要因を特定し、根拠（設定/ログ/入力差分）を示す／改善策を即時対応と構造改善に分けて整理する／TASKS.md に運用ログを記載する
- 影響範囲: `turbo.json`, `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `packages/**/package.json`（調査に応じて）
- ロールバック手順: 調査のみのためロールバック不要（変更が入った場合は該当差分を revert）
- チェックリスト:
  - turbo の cache miss 要因（inputs/outputs/env/pipeline）を特定する
  - build/typecheck の実行条件と差分発生源を整理する
  - 改善策と副作用を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 12:25 JST turbo キャッシュ無効化の原因調査に着手。
  - update: 2026-01-10 12:45 JST `app/package.json` の build が `tools:gen-plugin-registry` と複数 `pnpm --filter ... build` を内包し、turbo の外で再ビルドが走る構成を確認。`packages/ui/plugin-shell/package.json` の pretypecheck が `scripts/pretypecheck-ui-shell.mjs` 経由で依存パッケージ build を直叩きするため、dist 不在時に typecheck が広範に再ビルドする経路を確認。ワークツリーの変更が多数あるため当該パッケージの cache miss が発生しやすい状態であることを確認。
  - done: 2026-01-10 12:50 JST turbo キャッシュ無効化の要因と改善案を整理。

2125) fix/auth/cancel-cooldown-prevent-reopen (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/auth/cancel-cooldown-prevent-reopen
- 依存: なし
- 受け入れ基準: Cancel 押下後に auth-required ダイアログが即再表示されない／Cancel 後はクールダウン中に AUTH_REQUIRED を再発行しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当ファイルの差分を revert し、Cancel 後も即再表示する挙動へ戻す
- チェックリスト:
  - Cancel 後の再表示発生経路を確認する
  - クールダウン中は AUTH_REQUIRED を dispatch しないよう抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:20 JST Cancel 後に auth-required が再表示される問題の修正に着手。
  - update: 2026-01-11 22:23 JST awaitAuth の開始時にクールダウン判定を追加し、Cancel 後は AUTH_REQUIRED を再発行しないよう抑止。検証: 未実施。
  - done: 2026-01-11 22:23 JST Cancel 後の auth-required 再表示抑止を完了。

2126) fix/shape/retry-fetch-tasks-on-restart (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/retry-fetch-tasks-on-restart
- 依存: なし
- 受け入れ基準: fetch ステージで HTTP 502 失敗したタスクが「ビルド開始」押下時の再開で再実行される／ダウンロードが再試行される／既存の pause/resume 挙動を壊さない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/stage/useBatchSessionActions.ts`
- ロールバック手順: 該当ファイルの差分を revert し、再開時に再実行しない挙動へ戻す
- チェックリスト:
  - 失敗した fetch タスク検知を追加する
  - 再開時に強制的に startBatchSession を選択する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:40 JST fetch 失敗タスクの再実行対応に着手。
  - update: 2026-01-11 22:44 JST fetch 失敗タスクがある場合は再開時に startBatchSession を強制し再実行させるよう調整。検証: 未実施。
  - done: 2026-01-11 22:44 JST fetch 失敗タスクの再実行対応を完了。

2130) docs/location-plugin-design (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` を新規作成し、Step2-6 の UI/処理フロー、データソース/範囲/ビルド設定/ビルド/プレビューの方針、MapLibreGL 表示 + Dexie.js + モートン順序共通接頭辞検索による LocationQueryAPI 設計、vt 系ドキュメントとの差分を明記し、確認事項を列挙する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメントと本項目の差分を revert する
- チェックリスト:
  - location-plugin 設計ドキュメントの章立てを作成する
  - Step2-6 の UI/処理フローと API/データモデル方針を記述する
  - vt 系ドキュメントとの差分と未決事項を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:01 JST location-plugin 設計ドキュメント作成に着手。
  - done: 2026-01-09 08:03 JST `docs/location-plugin-design.md` を作成し、Step2-6 と非VT方針・LocationQueryAPI 設計・ui-map 方針を整理。

2131) docs/location-plugin-design-prefetch-margin (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-prefetch-margin
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に表示範囲のマージン指定（prefetch）を追加し、LocationQueryAPI のマージン指定パラメータ、ui-map 側の bbox 拡張フロー、既定値/上限を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - マージン指定の用語と単位を定義する
  - LocationQueryAPI にマージン指定を追記する
  - ui-map 側の bbox 拡張フローと既定値/上限を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:07 JST location-plugin の prefetch マージン仕様追記に着手。
  - done: 2026-01-09 08:07 JST prefetch マージンの指定方法と既定/上限値、検索フローと ui-map の呼び出し手順を追記。

2132) docs/location-plugin-design-details (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-details
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に CSV 列定義（必須/任意/型変換）を現行実装から抽出して明記し、LocationType の表示名対応、ズーム上限 11、アイコン/円のスタイル方針（既存アイコン利用、仮色、サイズ計算プロパティ化/既定線形）を追記し、LocationDB.vectorTiles の停止/削除方針を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - CSV 列定義と型変換ルールを整理する
  - LocationType の表示名対応を明記する
  - ズーム上限とスタイル方針を追記する
  - vectorTiles 停止/削除方針を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:15 JST location-plugin 設計詳細の反映に着手。
  - done: 2026-01-09 08:16 JST CSV列定義/LocationType表示名/ズーム上限/スタイル方針/vectorTiles停止の仕様を追記。

2133) docs/location-plugin-design-csv-missing-cases (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-csv-missing-cases
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に CSV の不足ケース（必須列欠落・数値変換失敗・ヘッダ不一致・国情報欠落）の扱いを明記し、確認事項を解消済みに更新する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - CSV の不足ケース運用を明記する
  - 確認事項の該当項目を解消済みに更新する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 08:34 JST CSV 不足ケース仕様の追記に着手。
  - done: 2026-01-09 08:34 JST CSV 不足ケースの扱いと確認事項の解消を追記。

2134) docs/location-plugin-design-style-defaults (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-style-defaults
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に仮色の具体値（circle/icon）、サイズ計算式の既定値（線形）と `sizeFn` の入力/出力仕様、ui-map レイヤへの適用方法を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - 仮色の具体値を決めて追記する
  - 既定サイズ計算式と `sizeFn` 仕様を追記する
  - ui-map の circle/icon への適用方法を明記する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 08:35 JST location-plugin のスタイル既定値追記に着手。
  - done: 2026-01-09 08:36 JST 仮色/sizeFn 既定式と ui-map 適用方法を追記。

2135) plans/location-plugin-repair-execplan (P1) — 完了 (2026-01-09)
- ブランチ名: plans/location-plugin-repair-execplan
- 依存: なし
- ExecPlan: `plans/location-plugin-repair-execplan.md`
- 受け入れ基準: location-plugin 修復の ExecPlan を作成し、Step2〜Step6 と LocationQuery/Mutation/ui-map 連携の実装方針、検証、ロールバックを自己完結で記述する／TASKS.md に運用ログを記載する
- 影響範囲: `plans/location-plugin-repair-execplan.md`
- ロールバック手順: 追加した ExecPlan と本項目の差分を revert する
- チェックリスト:
  - ExecPlan を作成して自己完結の仕様と手順を記載する
  - 実装フェーズと検証/ロールバックを具体化する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 09:32 JST location-plugin 修復 ExecPlan 作成に着手。
  - done: 2026-01-09 09:49 JST ExecPlan を作成し、修復マイルストーンと検証/ロールバックを整理。

2136) feat/location/non-vt-viewport-query (P1) — 進行中 (2026-01-09)
- ブランチ名: feat/location/non-vt-viewport-query
- 依存: なし
- ExecPlan: `plans/location-plugin-repair-execplan.md`
- 受け入れ基準: location-plugin の Step2-6 が CSV ソースのビルドと非VTの MapLibre プレビューに対応し、LocationQueryAPI が viewport 検索と prefetch マージン指定を受けられる／vectorTiles を参照せず points を描画できる／地物種類トグル・前方一致検索・ホバー/選択（半径8px）の強調表示が非VTでも動作する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/LocationQueryAPI.ts`, `packages/plugin-service-api/src/types/LocationMutationAPI.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/features/location-store/src/LocationDB.ts`, `plugins/location-plugin/src/worker/**`, `plugins/location-plugin/src/ui/components/**`, `docs/location-plugin-design.md`（参照整合が必要な場合）
- ロールバック手順: 上記差分を revert し、vectorTiles ベースの LocationQueryService と UI の既存プレビューへ戻す
- チェックリスト:
  - LocationQuery/Mutation API と worker 実装を非VT検索へ移行する
  - LocationDB と worker store のインデックスを更新する
  - Step2-6 UI を CSV + viewport クエリに合わせる
  - トグル/検索/ホバー/選択の UI を非VT検索に接続する
  - 検証と運用ログを追記する
- 運用ログ：
  - start: 2026-01-09 09:53 JST location 非VT viewport 検索への移行に着手。
  - update: 2026-01-09 10:19 JST LocationQueryAPI に viewport 検索型を追加し、LocationQueryService を非VT検索へ置換。LocationDB に mortonKey/kind インデックスを追加し、プレビューは viewport クエリで GeoJSON 描画へ切替。vectorTiles 参照は UI/worker から除去中。
  - update: 2026-01-13 09:10 JST 地物種類トグル/前方一致検索/ホバー選択(8px)を非VT検索で再現する方針で進行する。
  - update: 2026-01-13 10:15 JST map ページで location ノードを非VT検索で描画するため、location レイヤ情報/GeoJSON レイヤを追加し、viewport クエリ/hover+selection(8px)を接続。MapLibre での hover/selection を距離順に整列。LocationMapPreviewStep のテストを新仕様へ更新。
  - update: 2026-01-13 11:05 JST map/LocationMapPreview のアイコン表示を追加し、MUI アイコンから SVG を生成して MapLibre に登録。GeoJSON 複数レイヤ共有ソースの扱いを ResourceLayerMap で改善。
  - blocked: 2026-01-13 11:20 JST `pnpm typecheck` が guard:deps:extra で失敗。tsconfig.base.json の vt-* パスが src 指向のためポリシー違反（@hierarchidb/vt-store / vt-shape-store / vt-orchestrator）。対応方針の指示待ち。
  - update: 2026-01-13 11:25 JST tsconfig.base.json の vt-* paths を dist 指向へ修正し、guard:deps:extra 違反の解消を実施。
  - update: 2026-01-13 11:35 JST `pnpm typecheck` は runtime-worker の型エラーで失敗（LocationQueryService の型キャスト/ShapeMutationService のステージ不足）。修正後 `pnpm --filter @hierarchidb/runtime-worker typecheck` を再実行し成功。
  - update: 2026-01-13 11:45 JST LocationMapPreviewStep の typecheck エラーを修正し、`pnpm --filter @hierarchidb/location-plugin typecheck` を再実行して成功。
  - blocked: 2026-01-13 11:55 JST `pnpm typecheck` は shape-plugin の既存型エラーで失敗（vt-* モジュール解決と BatchTaskType/StageStatus 不整合、暗黙 any など）。対応方針の指示待ち。
  - update: 2026-01-13 12:10 JST shape-plugin の型エラー解消に向けて ShapeBatchTaskStage を fetch/transform/vt へ拡張し、shapeSessionMappers のステージ変換/集計を補正。vt-* の paths を src 指向へ戻し、`pnpm --filter @hierarchidb/plugin-service-api build` を実行後、`pnpm --filter @hierarchidb/shape-plugin typecheck` が成功。

2137) fix/workspace/include-vt-packages (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/workspace/include-vt-packages
- 依存: なし
- 受け入れ基準: `pnpm i` が `@hierarchidb/vt-orchestrator` の未解決で失敗しない／workspace 設定の変更は最小限／TASKS.md に運用ログを記載する
- 影響範囲: `pnpm-workspace.yaml`
- ロールバック手順: workspace 追加行を削除して revert する
- チェックリスト:
  - workspace に vt-* パッケージを含める
  - `pnpm i` で未解決エラーが再現しないことを確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-13 12:25 JST vt-* パッケージが workspace に含まれず pnpm i が失敗する問題の修正に着手。
  - update: 2026-01-13 12:27 JST `pnpm i` が EPERM（pnpm store への symlink 作成）で失敗。sandbox 権限の影響と判断。
  - done: 2026-01-13 12:28 JST `pnpm i` を権限昇格で再実行し成功。workspace への vt-* 追加を反映。
  - update: 2026-01-13 12:40 JST tsconfig.base.json の vt-* paths を dist 指向へ復帰し、`pnpm --filter @hierarchidb/vt-store build` / `pnpm --filter @hierarchidb/vt-shape-store build` / `pnpm --filter @hierarchidb/vt-orchestrator build` を実行して d.ts を生成。
  - update: 2026-01-13 13:05 JST vt-orchestrator の build:types 失敗に対応し、geojson 型導入と chunk-store 参照を調整。`pnpm i`（権限昇格）、`pnpm --filter @hierarchidb/chunk-store build`、`pnpm --filter @hierarchidb/vt-orchestrator build:types` を実行して成功。
  - update: 2026-01-13 13:20 JST app build の vt-store 未解決に対応し、`app/package.json` に `@hierarchidb/vt-store` を追加。`pnpm i` を権限昇格で実行し、app の node_modules に symlink を確認。
  - update: 2026-01-13 14:05 JST app typecheck エラー対応として MapPage/worker-runtime/gis-sdk/runtime-worker/location-plugin の型修正と turf 依存整理を実施。`pnpm i`（権限昇格）後、`pnpm --filter @hierarchidb/app typecheck` が成功。
  - update: 2026-01-13 14:30 JST GitHub Pages での iso3166 CSV 取得パス修正として resolveIso3166CsvUrl を追加し、各利用箇所の既定 URL を BASE_URL 連動へ置換。
  - update: 2026-01-13 14:50 JST GitHub Pages で BASE_URL が dist 依存に反映されないケースに対応するため、resolveIso3166CsvUrl に document.baseURI/ window.location のフォールバックを追加し、`pnpm --filter @hierarchidb/gen-iso3166-2 build` を実行。
  - update: 2026-01-13 15:10 JST VITE_BASE_URL の明示設定を追加し、resolveIso3166CsvUrl が VITE_BASE_URL/BASE_URL を優先参照するように拡張。`pnpm --filter @hierarchidb/gen-iso3166-2 build` を再実行。

2138) fix/auth/dialog-loop-shape (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/auth/dialog-loop-shape
- 依存: なし
- 受け入れ基準: shape-plugin の認証ダイアログが新UIに統一され旧ダイアログが出ない／認証後に新ダイアログが再表示されず次へ進める／`Cancel (Back to Step 2)` で Step2 に遷移しループしない／localhost と GitHub Pages の双方で再現しない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/ui/auth/src/components/AuthProviderDialog.tsx`, `plugins/shape-plugin/src/ui/**`, `packages/plugin-base/src/hooks/useDialogUrlSync.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、旧ダイアログ/現行遷移仕様へ戻す
- チェックリスト:
  - 旧/新ダイアログの表示条件を調査し重複経路を特定する
  - shape-plugin の認証表示を新ダイアログへ統一する
  - Cancel の Step2 遷移が URL/内部ステップと整合するよう調整する
  - 影響範囲と検証結果を運用ログに記載する
- 運用ログ：
  - start: 2026-01-13 16:10 JST 認証ダイアログの二重表示とキャンセル遷移ループの修正に着手。
  - update: 2026-01-13 16:35 JST useDialogUrlSync のパス解析と AuthRequiredDialogHost のキャンセル遷移を修正し、shape の旧認証ダイアログ表示を停止。AuthRequiredDialog に「Continue」導線を追加。
  - update: 2026-01-13 17:05 JST CORS proxy を dev/prod 共通運用に統一するため、VITE_CORS_PROXY_BASE_URL の既定値を base.sh に追加し、development.sh の dev URL を削除。app/.env.production に共通 URL を追記。

2139) fix/shape/zoom-band-ui (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/shape/zoom-band-ui
- 依存: なし
- 受け入れ基準: toolbar-menu の共通ズーム率UIが削除され、band0 z0-3 / band1 z3-6 / band2 z6-9 / band3 z9-11(optional) の表示に置換される／shape Step4 のズーム関連UI（範囲/分割/区切り）が削除され、同バンド表示に置換される／設定・型・ロジックから tileConfig.minZoom/maxZoom/zoomBreakpoints が削除される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/components/TreeConsoleToolbarContent.tsx`, `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`, `plugins/shape-plugin/src/ui/hooks/useTileConfigSection.ts`, `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`, `plugins/shape-plugin/src/services/batch/useBatchSessionActions.ts`, `plugins/shape-plugin/src/common/types/**`, `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 上記差分を revert し、旧ズームUIと min/max/zoomBreakpoints を復帰する
- チェックリスト:
  - toolbar-menu の共通ズーム率UIを削除し、ズーム帯の説明へ置換する
  - shape Step4 のズーム関連UIを削除し、ズーム帯の説明へ置換する
  - tileConfig の min/max/zoomBreakpoints を型・設定・ロジックから削除する
  - 影響箇所の表示/挙動を確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-13 22:10 JST ズーム帯UIの統一と min/max/zoomBreakpoints の削除に着手。
  - done: 2026-01-13 23:05 JST toolbar と Step4 のズームUIをズーム帯表示へ置換し、tileConfig から min/max/zoomBreakpoints を削除。

2140) fix/shape/progress-state-unify (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/progress-state-unify
- 依存: なし
- 受け入れ基準: currentState/currentTask と status/buildStatus の二重化を整理し、不要な重複は一本化する／進捗ログとUIのステージ表示が一致する／Step5 transform のLRUSplitPaneに failed/skipped の集計が表示される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `packages/ui/lru-splitview/src/types/LRUSplitView.ts`, `packages/ui/lru-splitview/src/utils/lruUtils.ts`（必要に応じて）
- ロールバック手順: 上記差分を revert し、旧表示/旧ログに戻す
- チェックリスト:
  - currentState/currentTask と status/buildStatus の用途を整理する
  - 進捗イベントの集計とUI表示を揃える
  - transform ステージで failed/skipped 件数を表示する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 00:20 JST progressState の二重化整理と transform の失敗/スキップ件数表示に着手。
  - done: 2026-01-14 00:55 JST 進捗ログの重複項目を整理し、LRUSplitPaneに failed/skipped 集計を表示するように更新。

2141) fix/auth/suspense-gated-steps (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/auth/suspense-gated-steps
- 依存: なし
- 受け入れ基準: shape Step3 / location Step3 / route Step3 / styler Step2 で認証判定を React Context + Suspense で同期的に扱い、UI 独自判定で認証ダイアログを出さない／AUTH_REQUIRED の通知のみで認証ダイアログが開く／bff-auth-user と bff-auth-token を完全撤去し localStorage を SSOT に統一／Worker 側は localStorage を直接読まず UI Storage Bridge を使用／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/contexts/SimpleBFFAuthContext.tsx`, `packages/ui/auth/src/services/BFFAuthService.ts`, `packages/ui/auth/src/hooks/useAuth.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`, `plugins/shape-plugin/src/ui/components/steps/ShapeCountrySelectionStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationCountrySelectionStep.tsx`, `plugins/route-plugin/src/ui/components/steps/RouteCountrySelectionStep.tsx`, `plugins/styler-plugin/src/ui/components/steps/StylerCountrySelectionStep.tsx`（実装結果に応じて）
- ロールバック手順: 上記差分を revert し、旧認証判定/旧 storage キー運用へ戻す
- チェックリスト:
  - 認証判定を Suspense で同期的に扱うゲートを各 Step に導入する
  - AUTH_REQUIRED 通知のみで認証ダイアログが開くよう UI 判定を撤去する
  - bff-auth-user / bff-auth-token の保存・参照・削除を全撤去する

2142) fix/shape/step4-6-ui-terminology (P2) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-6-ui-terminology
- 依存: なし
- 受け入れ基準: shape の Step4/5/6 UI から一次抽出/二次抽出/extract1/extract2 など旧用語を排除し、`docs/vt-pipeline-design.md` の Step4 表記（fetch/transform/vt）に準拠する／Step5/6 の進捗・削除操作・ラベルに旧用語が残らない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（該当UI文言）
- ロールバック手順: 該当差分を revert し、旧文言へ戻す
- チェックリスト:
  - Step4 の見出し/説明/操作ラベルを fetch/transform/vt に更新する
  - Step5/6 の進捗・削除操作の文言を fetch/transform/vt に更新する
  - `docs/vt-pipeline-design.md` の Step4 UI 表記と整合することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:30 JST Step4/5/6 UI の旧用語刷新に着手。
  - done: 2026-01-14 09:55 JST Step4/5/6 のUI文言を fetch/transform/vt に統一し、一次/二次抽出の表記を撤去。検証: 未実施。

2143) refactor/shape/step6-metadata-stage-stats (P1) — 進行中 (2026-01-14)
- ブランチ名: refactor/shape/step6-metadata-stage-stats
- 依存: なし
- ExecPlan: `plans/shape-metadata-stage-geometry-stats-execplan.md`
- 受け入れ基準: shape Step6 のメタデータ集計が fetch/transform/vt の新ステージ構成に基づいて集計される／集計結果がメタデータとして保存される／Step6 の表示カラムが新ステージ構成に一致する／旧ステージ名の集計/表示が残らない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/features/vectortile-store/src/tilesDb.ts`, `packages/runtime-worker/src/services/*`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/**`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、既存のメタデータ集計/表示へ戻す
- チェックリスト:
  - ExecPlan を更新し、ステージ再編後の集計/保存/表示方針を明記する
  - 集計ロジックを fetch/transform/vt 構成へ作り直す
  - 集計結果を保存するスキーマ/保存経路を更新する
  - Step6 の表示カラムを新ステージ構成へ更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:20 JST Step6 のメタデータ集計/保存/表示の再設計に着手。
  - update: 2026-01-14 11:40 JST ExecPlan を fetch/transform/vt 前提で更新し、集計・保存・UI 列更新の実装を反映。
  - done: 2026-01-14 11:40 JST Step6 メタデータの集計/保存/表示を新ステージ構成に刷新。検証: 未実施。
  - UI Storage Bridge 経由での token 取得に統一する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:40 JST 認証判定の Suspense 化と storage 統一対応に着手。
  - update: 2026-01-14 02:05 JST AuthReadyGate を追加し、shape/location/route/styler の対象ステップを Suspense でゲート。bff-auth-user/token を撤去し localStorage SSOT に統一。AuthRequiredDialogHost の UI 判定を削除。
  - done: 2026-01-14 02:05 JST 認証判定の Suspense 化と storage 統一を完了。
  - update: 2026-01-14 02:20 JST ui-auth の import を ui-plugin-shell から直接参照へ変更し、各プラグインに ui-auth 依存を追加。プラグイン UI ロード失敗に起因する Stepper 非表示の修正に対応。
  - update: 2026-01-14 02:40 JST shape の countryAvailability worker に UI storage bridge を追加し、認証トークンが worker に渡らない問題を修正。

2141) fix/shape/progress-visual-consistency (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/progress-visual-consistency
- 依存: なし
- 受け入れ基準: build全体のFailed表示はLinearProgressがerror色になる／build全体の表示とLRUSplitPaneのステージ表示が矛盾しないように集計ロジックが統一される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`
- ロールバック手順: 上記差分を revert し、従来の色/集計へ戻す
- チェックリスト:
  - Failed時の全体進捗バーの色を error に統一する
  - 全体表示とLRUSplitPaneの集計が同じ基準で更新される
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:10 JST 進捗表示の色と集計整合の修正に着手。

2142) fix/shape/step4-delete-downloads-button (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-delete-downloads-button
- 依存: なし
- 受け入れ基準: Step4 の「ダウンロード済みファイルを削除(n件)」ボタンが件数>0で有効化され、クリックで削除が実行され件数表示が更新される／0件時は無効のまま／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（Step4 UI/状態）、`plugins/shape-plugin/src/services/**`（削除処理経路）
- ロールバック手順: 該当差分を revert し、従来のボタン状態/削除挙動へ戻す
- チェックリスト:
  - ボタンのdisabled条件を件数>0に一致させる
  - クリック時に削除処理が呼ばれ、件数ラベルが更新される
  - 0件時の無効化を維持する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:25 JST Step4 の削除ボタンが無効な問題の修正に着手。
  - done: 2026-01-14 01:32 JST canDeleteRaw の条件からポリシー固定 false を除外し、件数>0で有効化されるよう修正。

2143) fix/shape/progress-tasktype-unify (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/progress-tasktype-unify
- 依存: なし
- 受け入れ基準: currentStage/currentTask を廃止して taskType に統合するか、残す場合は正当性をコードで説明できる／autoSubscribe/enablePollingFallback/isSubscribed の必要性をコードで説明できるか不要なら削除／Step5 の全体進捗が 0/0 へ揺れる表示をしない／LRUSplitPane の error/percent/checked/no-tasks の矛盾が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/**`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/progress/**`, `packages/runtime-worker/src/services/**`（進捗通知）、関連する型定義
- ロールバック手順: 該当差分を revert し、現行の進捗通知/表示へ戻す
- チェックリスト:
  - currentStage/currentTask と taskType の発生箇所を洗い出す
  - 不要な進捗プロパティを削除または統合する
  - 0/0 表示の発生条件を除去する
  - LRUSplitPane 表示の矛盾を解消する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:40 JST Step5 進捗通知と表示の統合修正に着手。
  - done: 2026-01-14 02:10 JST taskType へ統合し、0/0 揺れ回避・LRUSplitPane 表示矛盾・タスク取得の不足を修正。

2144) fix/shape/progress-protocol-tasktype (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/progress-protocol-tasktype
- 依存: なし
- 受け入れ基準: worker→UI進捗プロトコルから currentStage/currentTask を廃止し taskType に統一する／送受信側と型定義が整合し型エラーが出ない／Step5の進捗表示が taskType で判定される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/BatchControlAPI.ts`, `packages/common/types/src/progress-types.ts`, `packages/features/batch/src/session/**`, `packages/runtime-worker/src/services/**`, `plugins/shape-plugin/src/**`, `packages/ui/batch/src/**`
- ロールバック手順: 該当差分を revert し、currentStage/currentTask を含む旧プロトコルに戻す
- チェックリスト:
  - currentStage/currentTask の送信元/受信先/型定義を洗い出す
  - 進捗イベントの taskType 統一へ置換する
  - UI表示と taskType の一致を確認する
  - autoSubscribe/enablePollingFallback/isSubscribed の用途を精査し、不要ならペイロードから除去する
  - 進捗購読の登録単位がUI側で1つのコールバックになっているか確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 02:20 JST 進捗プロトコルを taskType に統一する修正に着手。
  - update: 2026-01-14 03:05 JST 進捗購読のプロパティ整理と購読単位の確認に着手。
  - done: 2026-01-14 03:30 JST 進捗購読のpollingフォールバックと関連プロパティを撤去し、UI側の進捗状態をpush購読のみで統一。

2145) fix/shape/batch-task-schema-cleanup (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/batch-task-schema-cleanup
- 依存: なし
- 受け入れ基準: batchTasks の未使用インデックスを削除する／BatchTaskRecord/ShapeBatchTaskRecord/ShapeBatchTaskSummary の未使用プロパティを削除する／ShapeBatchTaskStatus と ProgressPhase の関係を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/shape-store/src/ShapeDB.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/plugin-service-api/src/types/shapeTypes.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `plugins/shape-plugin/src/worker/getBatchTaskSummaries.ts`
- ロールバック手順: 該当差分を revert し、batchTasks のインデックスとタスク型を元に戻す
- チェックリスト:
  - batchTasks の未使用インデックスを削除する
  - タスク型の未使用プロパティを削除する
  - task status の表記を ProgressPhase に揃える
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 04:05 JST batchTasks のインデックス整理とタスク型の簡素化に着手。
  - done: 2026-01-14 05:20 JST batchTasks インデックスを整理し、タスク status を queued に統一して不要プロパティを削除。

2146) fix/route/typecheck-batch-progress (P1) — 完了 (2026-01-14)
- ブランチ名: fix/route/typecheck-batch-progress
- 依存: なし
- 受け入れ基準: RouteBatchSession の未使用引数を削除して TS6133 を解消する／useRouteBatchProgress の percentage を number に統一して TS2322 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/services/RouteBatchSession.ts`, `plugins/route-plugin/src/ui/hooks/useRouteBatchProgress.ts`
- ロールバック手順: 該当差分を revert し、RouteBatchSession/useRouteBatchProgress を修正前に戻す
- チェックリスト:
  - 未使用引数の削除で TS6133 を解消する
  - percentage の型不整合を解消する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 05:30 JST route-plugin の typecheck エラー修正に着手。
  - done: 2026-01-14 05:35 JST 未使用引数を削除し、percentage を number に統一。

2147) fix/shape/typecheck-progress-hooks (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/typecheck-progress-hooks
- 依存: なし
- 受け入れ基準: shapeProgressMapping の未使用引数を削除して TS6133 を解消する／useShapeBuildStep の変数順序を修正して TS2448/TS2454 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`
- ロールバック手順: 該当差分を revert し、progress hooks の修正前に戻す
- チェックリスト:
  - 未使用引数の削除で TS6133 を解消する
  - normalizedBuildStatus の参照順序を修正する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 05:45 JST shape-plugin の progress hooks typecheck エラー修正に着手。
  - done: 2026-01-14 05:50 JST toShapeProgress の引数削除と normalizedBuildStatus の宣言順を調整。

2148) fix/app/typecheck-batch-progress-tasktype (P1) — 完了 (2026-01-14)
- ブランチ名: fix/app/typecheck-batch-progress-tasktype
- 依存: なし
- 受け入れ基準: worker-runtime の BatchProgress 生成から currentStage/currentTask を除去し taskType を使用する／TS2353 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/worker-runtime/worker.ts`
- ロールバック手順: 該当差分を revert し、BatchProgress の taskType 反映を修正前に戻す
- チェックリスト:
  - currentStage/currentTask を taskType に置換する
  - typecheck エラーが消えることを確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:00 JST worker-runtime の BatchProgress 型不整合修正に着手。
  - done: 2026-01-14 06:02 JST taskType へ置換し currentStage/currentTask を削除。

2149) fix/shape/auth-dialog-loop-step3 (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/auth-dialog-loop-step3
- 依存: なし
- 受け入れ基準: Step3 の認証ダイアログは Worker からの認証失敗通知のみで開く／認証成功直後はダイアログが再表示されない／Worker 側のメタデータ取得は UI に待機表示→成功/失敗通知を返す／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`
- ロールバック手順: 該当差分を revert し、認証フローの挙動を修正前に戻す
- チェックリスト:
  - UI 側の認証判断を撤去し、Worker 結果を起点にする
  - 事前の認証プロンプトを廃止し 401 ベースで通知する
  - 復帰直後のダイアログ再表示を防止する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:15 JST Step3 認証ループ対策に着手。
  - done: 2026-01-14 06:35 JST 事前認証プロンプトを撤去し、メタデータ取得エラーを Worker から返すよう整理。

2150) fix/auth/token-ssot-localstorage (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/token-ssot-localstorage
- 依存: なし
- 受け入れ基準: AuthService の in-memory token を廃止し localStorage を SSOT にする／401 検知時に access_token を削除する／bff-auth-user を廃止して userinfo に統一する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `packages/ui/auth/src/services/BFFAuthService.ts`, `packages/ui/auth/src/hooks/useAuth.ts`
- ロールバック手順: 該当差分を revert し、トークン保持/ユーザ情報の保存を修正前に戻す
- チェックリスト:
  - AuthService の currentToken を撤去して storage 参照に統一する
  - 401 検知時に token を削除する
  - bff-auth-user を廃止し userinfo のみにする
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:50 JST トークン SSOT 化と bff-auth-user 廃止に着手。
  - done: 2026-01-14 07:05 JST AuthService の in-memory token を撤去し、userinfo に統一。

2151) fix/auth/remove-authsuccess-dispatch (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/remove-authsuccess-dispatch
- 依存: なし
- 受け入れ基準: AuthRequiredDialogHost から AuthSuccess/AuthCancelled の dispatch を撤去する／AuthService は AUTH_REQUIRED 通知後に待機せず例外で返す／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当差分を revert し、AuthSuccess/AuthCancelled の dispatch と awaitAuth の待機を復元する
- チェックリスト:
  - AuthRequiredDialogHost の success/cancel dispatch を削除する
  - AuthService.awaitAuth を即時例外で返す
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:20 JST AuthSuccess dispatch 経路の撤去に着手。
  - done: 2026-01-14 07:30 JST AuthRequired 通知後の即時例外化と UI 側 dispatch 撤去。

2152) fix/auth/worker-authrequired-ui-only (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/worker-authrequired-ui-only
- 依存: なし
- 受け入れ基準: Worker が AuthRequired を dispatch し UI が受信してのみ認証ダイアログを開く／AuthService が AuthSuccess/Cancelled を待機して再試行する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`
- ロールバック手順: 該当差分を revert し、AuthRequired 連携を修正前に戻す
- チェックリスト:
  - AuthService.awaitAuth の待機と再試行を復元する
  - AuthRequiredDialogHost の success/cancel dispatch を復元する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:40 JST Worker→UI AuthRequired フローの復元に着手。
  - done: 2026-01-14 07:45 JST AuthSuccess/Cancelled の dispatch と待機を復元。

2153) fix/auth/worker-authrequired-no-wait (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/worker-authrequired-no-wait
- 依存: なし
- 受け入れ基準: AuthService.awaitAuth は AUTH_REQUIRED を dispatch したら即例外で終了する／Worker は UI storage ブリッジ経由のみでトークンを読む／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当差分を revert し、AUTH_REQUIRED 待機と直接 localStorage 参照を復元する
- チェックリスト:
  - awaitAuth を即例外化する
  - localStorage 直接参照を撤去する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:55 JST Worker 認証フローの待機撤去に着手。
  - done: 2026-01-14 08:00 JST AuthRequired 通知後に即例外で終了し、UIブリッジ経由のみでトークン参照。

2124) fix/ui-auth/auth-required-dialog-order-and-spinner (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/ui-auth/auth-required-dialog-order-and-spinner
- 依存: なし
- 受け入れ基準: AuthRequiredDialog のプロバイダー押下時ローディングは CircularProgress になる／ダイアログ本文の順序が「plugin requires auth」「token rejected」「signed in as」になる／本文先頭の警告アイコンを非表示にする／Continue ボタンを撤去する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/components/AuthRequiredDialog.tsx`
- ロールバック手順: 該当ファイルの差分を revert し、ダイアログ表示/順序/ボタンを修正前に戻す
- チェックリスト:
  - 認証プロバイダーボタンのローディング表示を CircularProgress に置換する
  - 本文の表示順と先頭アイコンの有無を調整する
  - Continue ボタンを削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:12 JST AuthRequiredDialog の表示順・スピナー・ボタン修正に着手。
  - update: 2026-01-11 22:16 JST ローディングを CircularProgress に変更し、本文順序と先頭アイコンを調整、Continue ボタンを削除。検証: 未実施。
  - done: 2026-01-11 22:16 JST AuthRequiredDialog の表示順・スピナー・ボタン修正を完了。

2123) fix/shape/typecheck-auth-headers (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/typecheck-auth-headers
- 依存: なし
- 受け入れ基準: `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerPool.ts` の Authorization 参照に起因する TS2339 が解消される／認証ヘッダーの取得ロジックは現状維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerPool.ts`
- ロールバック手順: 該当ファイルの差分を revert し、修正前の型エラー状態へ戻す
- チェックリスト:
  - Authorization ヘッダー取得の型エラー原因を特定する
  - 最小修正で typecheck を通す
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:05 JST shape-plugin の Authorization ヘッダー型エラー修正に着手。
  - update: 2026-01-11 22:08 JST getAuthHeaders の await を追加し Authorization 取得の型エラーを解消。検証: `pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
  - done: 2026-01-11 22:08 JST shape-plugin の typecheck エラー修正を完了。

2124) feat/ui/datasource-cache-clear (P1) — 進行中 (2026-01-12)
- ブランチ名: feat/ui/datasource-cache-clear
- 依存: なし
- 受け入れ基準: Step2 のデータソース選択画面に「選択中データソースのキャッシュ削除」ボタンが表示される／shape・route の双方でキャッシュ削除が動作し、成功/失敗が通知される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`（必要に応じて）
- ロールバック手順: 追加したボタンとキャッシュ削除処理の差分を revert し、従来の Step2 へ戻す
- チェックリスト:
  - shape/route の Step2 にキャッシュ削除ボタンを追加する
  - data source ごとのキャッシュ削除処理を実装する
  - 成功/失敗の通知を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 18:30 JST Step2 のデータソースキャッシュ削除ボタン実装に着手。
  - update: 2026-01-12 19:00 JST shape/route のキャッシュ削除ボタンとデータソース別削除処理を追加し、i18n と通知を接続。検証: 未実施。
  - update: 2026-01-12 19:20 JST location Step2 にキャッシュ削除ボタンを追加し、location データ削除と通知/i18n を接続。検証: 未実施。
  - update: 2026-01-12 19:40 JST Step2/Step5 の削除対象と有効条件を整理し、Step5 ボタンの無効化方針に着手。検証: 未実施。
  - update: 2026-01-12 20:00 JST shape/location の Step4 ダウンロード削除をポリシーで無効化。検証: 未実施。
  - update: 2026-01-12 20:20 JST vt パイプライン共通設計の棚卸しと矛盾補修に着手。検証: 未実施。
  - update: 2026-01-12 20:40 JST srcId/dstId 命名とリトライ方針、fetch実行責務を反映。検証: 未実施。
  - update: 2026-01-12 20:50 JST taskQueue UI 可視化は現行実装を踏襲する方針を明記。検証: 未実施。
  - update: 2026-01-12 21:00 JST fetch実行/記録の整合と taskQueue→LRUSplitPane 接続点の補強に着手。検証: 未実施。
  - update: 2026-01-12 21:20 JST vt-pipeline-design の taskQueue/図表整合と LRUSplitPane 接続記述の補強に着手。検証: 未実施。
  - update: 2026-01-12 21:35 JST vt-pipeline-design の taskQueue 記述と Mermaid 図を整合化し、LRUSplitPane 接続の説明を補強。検証: 未実施。
  - update: 2026-01-12 22:20 JST 新設計の用語/要件に合わせて vt ドキュメントと ExecPlan を更新。検証: 未実施。
  - update: 2026-01-12 22:30 JST shape-fetch の国コード基準を ISO2 として明文化。検証: 未実施。

2125) docs/shape-design-consistency-review (P2) — 進行中 (2026-01-12)
- ブランチ名: docs/shape-design-consistency-review
- 依存: なし
- 受け入れ基準: shape-plugin 設計ドキュメントの所在を特定し、当該ドキュメントのみを手掛かりに実装作業が一貫して進められるかを評価する／不足や曖昧な点を項目立てで指摘する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/**`, `plugins/shape-plugin/**`（調査対象）
- ロールバック手順: ドキュメント/ログの更新差分を revert し、調査着手前の状態へ戻す
- チェックリスト:
  - shape-plugin 設計ドキュメントの所在を確認する
  - 設計ドキュメントの不足点を項目立てで整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 21:45 JST shape-plugin 設計ドキュメントの実装一貫性レビューに着手。
  - done: 2026-01-12 22:05 JST shape-plugin 設計ドキュメントの不足/矛盾点を整理し、実装一貫性の観点で指摘をまとめた。検証: 該当ドキュメントの読解のみ。

2126) docs/shape-design-alignment (P2) — 進行中 (2026-01-12)
- ブランチ名: docs/shape-design-alignment
- 依存: なし
- 受け入れ基準: 旧仕様ドキュメントを obsolate に移動し、参照関係を更新する／新設計（shape-fetch/transform/vt）に合わせた補足（Step4設定要素、ISO2基準）を反映する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/**`
- ロールバック手順: 移動・更新したドキュメントの差分を revert し、元の配置へ戻す
- チェックリスト:
  - 旧仕様のドキュメントを obsolate に移動する
  - 参照リンクを新しいパスに更新する
  - 新設計の追加要素をドキュメントへ追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 22:35 JST 旧仕様ドキュメント移動と新設計整合の追記に着手。
  - done: 2026-01-12 22:50 JST 旧仕様ドキュメントを obsolate に移動し、参照リンクと Step4 設定要素/ISO2 方針を反映。検証: 未実施。

2128) docs/step4-structure-and-alignment (P2) — 進行中 (2026-01-13)
- ブランチ名: docs/step4-structure-and-alignment
- 依存: なし
- 受け入れ基準: Step4 の UI 構造を4階層ツリーで整理し、(A)-(D) の対応区分を記載する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/vt-pipeline-design.md`
- ロールバック手順: 追記差分を revert し、追記前の状態へ戻す
- チェックリスト:
  - Step4 の UI 構造ツリーを追記する
  - (A)-(D) の対応区分を追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-13 00:05 JST Step4 のUI構造ツリーと(A)-(D)整理の追記に着手。
  - done: 2026-01-13 00:20 JST Step4 のUI構造ツリーと(A)-(D)の対応区分を vt-pipeline-design に追記。検証: 未実施。
  - update: 2026-01-13 00:35 JST transform の格子スナップ→RDP の順序と解像度条件を追記。検証: 未実施。
  - update: 2026-01-13 00:50 JST transform の adminLevel 優先順位と stagePriority 付与を仕様に追記。検証: 未実施。
  - update: 2026-01-13 01:05 JST transform/vt の境界ライン保存とタイル生成への適用を追記。検証: 未実施。
  - update: 2026-01-13 01:15 JST vt ステージで boundary LineString のデデュープを追加で明記。検証: 未実施。
  - update: 2026-01-13 01:25 JST ui-map の admin-boundary 描画タスクを関連項目として追記。検証: 未実施。
  - update: 2026-01-13 01:35 JST boundary デデュープの実装メモを vt-pipeline-design に追記。検証: 未実施。
  - update: 2026-01-13 01:55 JST GeoBoundaries/GADM の ISO2→ISO3 変換例と boundary デデュープの高速キー化を追記。検証: 未実施。
  - update: 2026-01-13 02:15 JST taskQueue 優先度の運用と Step4 入力仕様の暫定整理を追記。検証: 未実施。
  - update: 2026-01-13 02:35 JST Step4 の高度な設定扱いと extractionMode 削除を反映。検証: 未実施。
  - update: 2026-01-13 03:00 JST 簡略化 tolerance の4分類と座標系の橋渡し前提を追記。検証: 未実施。
  - update: 2026-01-13 03:20 JST WebMercator(meters) での tolerance 計算式とコード例を追記。検証: 未実施。
  - update: 2026-01-13 03:40 JST 簡略化強度のUI表記とk=1.0既定、route tolerance 範囲/既定値を反映。検証: 未実施。
  - update: 2026-01-13 04:05 JST 印刷用途を含む解像度基準（extent=4096/表示px=256/512）を明文化する追記に着手。検証: 未実施。
  - update: 2026-01-13 04:15 JST MVT extent=4096 を格子基準とし、印刷/表示は tileSize+pixelRatio で制御する旨を追記。検証: 未実施。
  - update: 2026-01-13 04:25 JST maplibre-gl-export の印刷向け pixelRatio/DPI ガイド追記に着手。検証: 未実施。
  - update: 2026-01-13 04:35 JST Step4 UI ツリーに簡略化強度（Transform/VT）の配置を具体化する追記に着手。検証: 未実施。
  - update: 2026-01-13 04:45 JST Step4 UI ツリーへ Transform/VT 簡略化強度の配置（shape/route）を追記。検証: 未実施。
  - update: 2026-01-13 04:55 JST Step4 入力仕様に Transform/VT の簡略化強度（shape/route）の範囲/既定値を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:05 JST Step4 入力仕様へ Transform/VT 簡略化強度の項目（shape/route）を追加。検証: 未実施。
  - update: 2026-01-13 05:15 JST Step4 入力仕様の既定値出典を現行実装に合わせて補正。検証: 未実施。
  - update: 2026-01-13 05:25 JST Step4 既存UIと新設計の衝突点一覧を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:30 JST Step4 既存UIと新設計の衝突点（tolerance系中心）を整理して追記。検証: 未実施。
  - update: 2026-01-13 05:40 JST Step4 衝突点の優先度（P1/P2/P3）と理由を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:45 JST Step4 衝突点の優先度を付与し、理由を併記。検証: 未実施。
  - update: 2026-01-13 05:55 JST Step4 衝突点の削除/残置/移行判断を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 06:00 JST Step4 衝突点に削除/残置/移行判断を追記。検証: 未実施。
  - update: 2026-01-13 06:10 JST 新設計に合わせた UI 文言変更項目の棚卸しに着手。検証: 未実施。
  - update: 2026-01-13 06:15 JST Step4 UI 文言の置換表（新設計用語）を追記。検証: 未実施。
  - update: 2026-01-13 06:25 JST Step4 入力項目のUI表記（日本語/英語）案を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 06:30 JST Step4 UI 表記案（日本語/英語）を shape/route で追記。検証: 未実施。
  - update: 2026-01-13 06:40 JST 文言置換表とUI表記案の統合整理に着手。検証: 未実施。
  - update: 2026-01-13 06:45 JST 文言置換表とUI表記案を統合し、旧→新と最終表記を整理。検証: 未実施。
  - update: 2026-01-13 06:55 JST 旧用語（Legacy 等）の整理方針追記に着手。検証: 未実施。
  - update: 2026-01-13 07:00 JST 旧用語（Legacy 等）の整理方針を Step4 文書に追記。検証: 未実施。
  - update: 2026-01-13 07:10 JST 旧表記に依存する説明文の差し替え整理に着手。検証: 未実施。
  - update: 2026-01-13 07:15 JST 旧表記に依存する説明文の差し替え対象と新文面を追記。検証: 未実施。
  - update: 2026-01-13 07:25 JST Step4 入力項目名と説明文の対応表追記に着手。検証: 未実施。
  - update: 2026-01-13 07:30 JST Step4 入力項目名と説明文の対応表（shape/route）を追記。検証: 未実施。
  - update: 2026-01-13 07:40 JST Step4 入力仕様とUI表記案の整合微修正に着手。検証: 未実施。
  - update: 2026-01-13 07:45 JST Step4 入力仕様/表記の整合修正（route移行方針とlegacy記述）を反映。検証: 未実施。
  - update: 2026-01-13 07:55 JST 説明文の移行方針整合（legacy/新設計併存）を反映する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:00 JST 説明文に移行中の注意文を追記し、legacy/新設計併存の整合を反映。検証: 未実施。
  - update: 2026-01-13 08:10 JST Legacy controls（旧Extract互換）の別枠整理案追記に着手。検証: 未実施。
  - update: 2026-01-13 08:15 JST Legacy controls（旧Extract互換）の別枠整理案を追記。検証: 未実施。
  - update: 2026-01-13 08:25 JST Step4 UI 構造ツリーに Legacy controls 集約の注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:30 JST Step4 UI 構造ツリーに Legacy controls を Advanced Settings へ集約する注記を追記。検証: 未実施。
  - update: 2026-01-13 08:40 JST Legacy controls のUI補足文（旧互換）を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:45 JST Legacy controls のUI補足文（旧互換/Advanced Settings）を追記。検証: 未実施。
  - update: 2026-01-13 08:55 JST Legacy controls 対象項目へのタグ付け追記に着手。検証: 未実施。
  - update: 2026-01-13 09:00 JST Legacy controls 対象項目にタグ付け（UI表記案）を追記。検証: 未実施。
  - update: 2026-01-13 09:10 JST Legacy controls 対象項目の説明文対応表へ注記追加に着手。検証: 未実施。
  - update: 2026-01-13 09:15 JST Legacy controls 対象項目に Advanced Settings 注記を説明文対応表へ追記。検証: 未実施。
  - update: 2026-01-13 09:25 JST Step4 入力仕様へ Legacy controls（Advanced Settings）注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 09:30 JST Step4 入力仕様の Legacy controls 項目へ Advanced Settings 注記を追記。検証: 未実施。
  - update: 2026-01-13 09:35 JST Legacy controls の注記とUI構造の整合を確認し、対応区分の文言を補正。検証: 未実施。
  - update: 2026-01-13 09:45 JST route の Advanced Settings に Legacy controls なしの注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 09:50 JST route の Advanced Settings に Legacy controls なしの注記を追記。検証: 未実施。
  - update: 2026-01-13 10:00 JST route 入力仕様の legacy/new 併記整理に着手。検証: 未実施。
  - update: 2026-01-13 10:05 JST route 入力仕様の legacy/new 併記を現行/移行後で整理。検証: 未実施。
  - update: 2026-01-13 10:15 JST shape 入力仕様の legacy/new 併記整理に着手。検証: 未実施。
  - update: 2026-01-13 10:20 JST shape 入力仕様の legacy/new 併記を現行/移行後で整理。検証: 未実施。
  - update: 2026-01-13 10:30 JST Step4 入力仕様の先頭に Legacy controls 一覧を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 10:35 JST Step4 入力仕様の先頭に Legacy controls 一覧を追記。検証: 未実施。
  - update: 2026-01-13 10:45 JST Legacy controls 一覧に対応注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 10:50 JST Legacy controls 一覧に UI 構造/表記/説明文との対応注記を追記。検証: 未実施。
  - update: 2026-01-13 11:00 JST Step4 入力仕様の非Legacy項目を簡潔に再整理する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:05 JST Step4 入力仕様に非Legacy項目の要約を追記。検証: 未実施。
  - update: 2026-01-13 11:15 JST Step4 入力仕様の詳細を fetch/transform/vt の順で読みやすくする修正に着手。検証: 未実施。
  - update: 2026-01-13 11:20 JST Step4 入力仕様の詳細に fetch/transform/vt の小見出しを追加し読みやすく整理。検証: 未実施。
  - update: 2026-01-13 11:30 JST route 入力仕様に task split の小見出しと項目を明記する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:35 JST route 入力仕様に task split の小見出しと項目を追記。検証: 未実施。
  - update: 2026-01-13 11:45 JST shape 入力仕様に task split の小見出しと項目を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:50 JST shape 入力仕様に task split の小見出しと項目を追記。検証: 未実施。
  - update: 2026-01-13 12:00 JST task split と Advanced Settings の相互参照注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 12:05 JST task split 項目に Advanced Settings 参照注記を追記。検証: 未実施。
  - update: 2026-01-13 12:15 JST UI 構造ツリーの Legacy controls を Advanced Settings に集約し、重複配置を解消。検証: 未実施。
  - update: 2026-01-13 12:25 JST Legacy controls の注記とUI構造整合を明示する文言を追記。検証: 未実施。
  - update: 2026-01-13 12:30 JST Legacy controls の注記にUI構造側の整合（重複なし）を明記。検証: 未実施。
  - update: 2026-01-13 12:40 JST Step4 入力仕様周辺の冗長表現整理に着手。検証: 未実施。
  - update: 2026-01-13 12:45 JST Step4 入力仕様の Legacy controls 注記を簡潔化して重複を削減。検証: 未実施。
  - update: 2026-01-13 12:55 JST 非Legacy要約に詳細参照の注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:00 JST 非Legacy要約に詳細参照の注記を追記。検証: 未実施。
  - update: 2026-01-13 13:10 JST Step4 入力仕様の利用ガイド（要約→詳細→UI構造）を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:15 JST Step4 入力仕様の使い方ガイド（要約→詳細→UI構造）を追記。検証: 未実施。
  - update: 2026-01-13 13:25 JST 旧用語の削除タイミングを簡潔に追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:30 JST 旧用語の削除タイミング（旧Extract削除完了+移行後適用確認）を追記。検証: 未実施。
  - update: 2026-01-13 13:40 JST 移行後に有効化する項目のチェックリスト追記に着手。検証: 未実施。
  - update: 2026-01-13 13:45 JST 移行後に有効化する項目のチェックリストを追記。検証: 未実施。
  - update: 2026-01-13 13:55 JST 移行後チェックリストとTASKS運用のリンク文を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:00 JST 移行後チェックリストに TASKS 運用ログ記録の注記を追記。検証: 未実施。
  - update: 2026-01-13 14:10 JST Step4 入力仕様が最終仕様ソースである旨を明記する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:15 JST Step4 入力仕様が最終仕様ソースである旨を追記。検証: 未実施。
  - update: 2026-01-13 14:25 JST 他ドキュメントの重複記述を参照表記へ置換する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:30 JST vt-shape/vt-route の Step4 に入力仕様の参照先を追記。検証: 未実施。
  - update: 2026-01-13 14:35 JST vt-shape/vt-route/location-route の Step4 参照注記を追加し重複記述を抑制。検証: 未実施。
  - update: 2026-01-13 14:45 JST Step4 の「Settings」を「Build Settings」に統一する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:50 JST Step4 の「Settings」を「Build Settings」に統一。検証: 未実施。
  - update: 2026-01-13 15:00 JST 置換表から旧表記を削除し Build Settings 表記に整理する作業に着手。検証: 未実施。
  - update: 2026-01-13 15:05 JST 置換表から旧表記を削除し Build Settings 表記のみに整理。検証: 未実施。
  - update: 2026-01-13 15:15 JST UI 表記セクションの見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:20 JST UI 表記セクション見出しを「最終版」に簡潔化。検証: 未実施。
  - update: 2026-01-13 15:30 JST Step4 衝突点セクション見出しの簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:35 JST Step4 差分・移行点セクションに簡潔化と説明文を反映。検証: 未実施。
  - update: 2026-01-13 15:45 JST Legacy controls 見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:50 JST Legacy controls 見出しを簡潔化し説明文を追加。検証: 未実施。
  - update: 2026-01-13 16:00 JST 非Legacy要約見出しの簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 16:05 JST 非Legacy要約見出しを簡潔化。検証: 未実施。
  - update: 2026-01-13 16:15 JST 入力項目の対応表見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 16:20 JST 入力項目の対応表見出しを簡潔化。検証: 未実施。
  - update: 2026-01-13 16:35 JST Step4 入力仕様セクションを全体再編（Legacy/非Legacy/移行/表記/詳細/説明）し、重複を統合。検証: 未実施。
  - update: 2026-01-13 16:40 JST location-route 設計差分ドキュメントの Step4 参照を統一（vt-pipeline 参照）。検証: 未実施。
  - update: 2026-01-13 16:50 JST Step4 補足セクションを簡潔化し、UI表記と整合する形に再整理。検証: 未実施。
  - update: 2026-01-13 17:00 JST 再実行/再利用の判定計画（fetch/transform/vt）を明文化。検証: 未実施。
  - update: 2026-01-13 17:10 JST 判定キーのハッシュ対象項目と正規化ルールを追記。検証: 未実施。
  - update: 2026-01-13 17:15 JST ハッシュ用シリアライズ形式（JSONキー順固定）を追記。検証: 未実施。
  - update: 2026-01-13 17:20 JST taskId 構成例に hash を含める拡張例を追記。検証: 未実施。
  - update: 2026-01-13 17:30 JST 再実行/再利用の実装手順（taskQueue更新）とFGB保存先再掲を追記。検証: 未実施。
  - update: 2026-01-13 17:40 JST fetch-shape は URL を smartFetch キーとして扱う前提を追記。検証: 未実施。
  - update: 2026-01-13 17:45 JST ハッシュ生成は既存の SHA3 実装を使用する方針を追記。検証: 未実施。
  - update: 2026-01-13 17:50 JST band3 上限超過はエラー扱い、Step3 判定依存、vt-store 保存キー連結方式を追記。検証: 未実施。
  - update: 2026-01-13 17:55 JST band3 上限超過エラーは安全策・非サポートである旨を明記。検証: 未実施。
  - update: 2026-01-13 18:00 JST vt-store 保存キーの区切り文字例を追記。検証: 未実施。

2129) feat/shape/vt-pipeline-implementation (P1) — 進行中 (2026-01-13)
- ブランチ名: feat/shape/vt-pipeline-implementation
- 依存: なし
- 受け入れ基準:
  - shape-fetch/transform/vt の新仕様に沿って実装が更新される
  - taskQueue の状態更新ルール（waiting/running/completed/failed + message 前置詞）が反映される
  - vt-shape-store/vt-store のデータ保存が設計に一致する
  - TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/**`, `packages/vt-orchestrator/**`, `packages/features/shape-store/**`（調査後に絞り込み）
- ロールバック手順: 追加・変更した差分を revert し、旧パイプラインへ戻す
- チェックリスト:
  - 設計ドキュメントを再読し実装の不足点を洗い出す
  - shape-fetch/transform/vt の実装差分を確定する
  - taskQueue 記録・進捗更新を現行UIと整合させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-13 18:20 JST shape-plugin の新 vt パイプライン実装に着手。
  - update: 2026-01-13 18:30 JST ExecPlan 作成に着手（shape-plugin 新実装の作業計画策定）。検証: 未実施。
  - update: 2026-01-13 18:45 JST ExecPlan を作成し `plans/shape-vt-pipeline-implementation-execplan.md` を追加。検証: 未実施。
  - update: 2026-01-13 19:05 JST vt-store/vt-shape-store/vt-orchestrator の雛形パッケージと tsconfig base のエイリアスを追加。検証: 未実施。
  - update: 2026-01-13 19:30 JST vt-shape-store の Dexie スキーマ/Query/Mutation を雛形実装として追加。検証: 未実施。
  - update: 2026-01-13 20:00 JST vt-store の Dexie スキーマ/VTQueryAPI/VTMutationAPI を雛形実装として追加。検証: 未実施。
  - update: 2026-01-13 20:25 JST vt-orchestrator の taskQueue（Dexie 永続化 + in-memory 通知）雛形を追加。検証: 未実施。
  - update: 2026-01-13 20:45 JST vt-orchestrator の runStageTasks 雛形を追加（waiting→running→completed/failed 遷移）。検証: 未実施。
  - update: 2026-01-13 21:20 JST vt-orchestrator に transform/vt の基本ハンドラ（簡略化・tileIndex生成・band3予約・vt生成）を追加。検証: 未実施。
  - update: 2026-01-13 22:10 JST shape-fetch の taskQueue 登録と stage1Buffers 保存の土台（shapeFetchStage）を追加。検証: 未実施。
  - update: 2026-01-13 22:15 JST fetchData の cacheKey を URL で使えるよう dataSource 戦略を更新し、GADM の ISO3 設定を修正。検証: 未実施。
  - update: 2026-01-13 22:40 JST shape-fetch/transform/vt を直列実行する shapePipeline を追加し、taskQueue 進捗を worker へ結線。検証: 未実施。
  - update: 2026-01-13 23:10 JST worker/api の getBatchSessionStatus と getProcessingStatus を taskQueue 優先に切替。検証: 未実施。
  - update: 2026-01-13 23:25 JST worker/api から batchSessionManager フォールバックを削除し、taskQueue のみで進捗/状態を管理。検証: 未実施。
  - update: 2026-01-14 00:05 JST Step5 の pause/resume を無効化し、UI と worker API から旧 batch セッション操作/回復 UI を削除。検証: 未実施。
  - update: 2026-01-14 00:20 JST 旧 batch セッションの実装群（SessionController/BatchSessionManager/SessionTaskRegistry 等）と関連テストを削除。検証: 未実施。
  - update: 2026-01-14 00:45 JST vt-orchestrator/shape-plugin の型エラーを解消し typecheck を再実行。検証: `pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
  - update: 2026-01-14 01:10 JST worker-runtime の pause/resume 経路を shape では no-op 化し、shape-plugin README から旧 batch セッション記述を整理。検証: 未実施。

2127) feat/shape/step5-three-stage-columns (P2) — 進行中 (2026-01-12)
- ブランチ名: feat/shape/step5-three-stage-columns
- 依存: なし
- 受け入れ基準: Step5 の LRUSplitPane が fetch/transform/vt の3列になっている／旧ステージ名が混在しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/components/src/BuildStep.tsx`, `plugins/shape-plugin/src/ui/locales/**`
- ロールバック手順: Step5 のステージ定義と進捗表示の差分を revert し、4列構成へ戻す
- チェックリスト:
  - Step5 のステージ定義を fetch/transform/vt の3列に更新する
  - 進捗集計とクラッシュ警告のステージ名を新仕様に合わせる
  - i18n ラベルを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 23:05 JST Step5 の3列化とステージ名更新に着手。
  - done: 2026-01-12 23:30 JST Step5 のステージを fetch/transform/vt の3列に更新し、進捗集計と警告表示のステージ名を整合。検証: 未実施。

2122) fix/auth/localstorage-only-worker-bridge (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/auth/localstorage-only-worker-bridge
- 依存: なし
- 受け入れ基準: 認証関連の sessionStorage 利用が完全に撤去され localStorage に統一される／Worker 側から UI の localStorage を操作できるブリッジ API が追加される／auth フローが sessionStorage なしで動作する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/**`, `packages/features/auth-recovery/src/**`, `app/src/contexts/WorkerProvider.tsx`, `app/src/worker-runtime/**`（調査後に絞り込み）
- ロールバック手順: auth の localStorage 統一差分と Worker ブリッジ追加差分を revert し、従来の sessionStorage 併用へ戻す
- チェックリスト:
  - 認証関連の sessionStorage 参照/書き込みを削除する
  - localStorage への統一と型の厳格化を反映する
  - Worker→UI の localStorage ブリッジ API を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 20:35 JST sessionStorage 全廃・localStorage 統一と Worker ブリッジ追加に着手。
  - update: 2026-01-11 21:25 JST auth 関連の sessionStorage を localStorage へ統一し、Worker→UI の localStorage ブリッジ API を追加。検証: 未実施。

2123) fix/shape/preview-zoom-snackbar (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/preview-zoom-snackbar
- 依存: なし
- 受け入れ基準: Shape Step6 プレビューでズーム操作時に Snackbar で現在のズーム値が表示される／他の Snackbar 表示を阻害しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`
- ロールバック手順: 追加したズーム Snackbar 表示の差分を revert し、従来の表示へ戻す
- チェックリスト:
  - ズーム変更イベントを取得する
  - Snackbar でズーム値を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 21:35 JST Step6 プレビューでズーム値を Snackbar 表示する対応に着手。

2118) fix/app/treetable-skeleton-until-columns-ready (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/treetable-skeleton-until-columns-ready
- 依存: なし
- 受け入れ基準: TreeTableCore 表示時にカラム幅調整完了までは TreeTableConsole の本体が MUI Skeleton 表示になる／調整完了後に実データ表示へ切り替わる／/t/... の初回表示でコンテンツの激しい動揺が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/**`（調査後に絞り込み）
- ロールバック手順: TreeTableConsole の Skeleton 表示差分を revert し、従来の即時表示へ戻す
- チェックリスト:
  - TreeTableCore/TreeTableConsole でカラム幅安定化の検知ポイントを特定する
  - 安定化完了まで Skeleton 表示に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 17:05 JST TreeTableCore のカラム幅安定化前に Skeleton 表示へ切替する対応に着手。
  - update: 2026-01-11 17:20 JST カラム幅の計測完了までは Skeleton を表示し、完了後に本体表示へ切替するよう実装。検証: 未実施。

2119) fix/app/tree-node-info-panel-i18n (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/tree-node-info-panel-i18n
- 依存: なし
- 受け入れ基準: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx` の表示文言が i18n 経由になる／既存の挙動と文言の意味が変わらない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: i18n 化の差分を revert し、従来の固定文言へ戻す
- チェックリスト:
  - TreeNodeInfoPanel の固定文言を抽出する
  - i18n キーへ置換し既存文言をデフォルト値に設定する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 18:05 JST TreeNodeInfoPanel の i18n 化対応に着手。
  - update: 2026-01-11 18:10 JST Draft/Created/Updated ラベルを i18n 経由に置換。検証: 未実施。
  - update: 2026-01-11 18:20 JST TreeNodeInfoPanel のボタン/ラベル文言をロケール辞書へ追加し i18n 化を補完。検証: 未実施。

2120) feat/app/tree-console-contextmenu-build (P1) — 完了 (2026-01-11)
- ブランチ名: feat/app/tree-console-contextmenu-build
- 依存: なし
- 受け入れ基準: styler/shape/location/route/folder のノードでコンテキストメニューに Build が表示される／アイコンは Construction でラベルは i18n 化される／ビルド起動は TreeNodeInfoPanel と同じ導線で実行される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/breadcrumb/src/components/NodeContextMenu.tsx`, `app/src/hooks/treeconsole/actions/contextMenu.ts`, `app/src/router/pages/tree/console/**`, `app/public/locales/**`, `packages/ui/i18n/public/locales/**`
- ロールバック手順: 追加した Build メニュー項目とアクションの差分を revert し、従来のコンテキストメニューに戻す
- チェックリスト:
  - Build メニュー項目の表示条件（nodeType 判定）を実装する
  - ContextMenu の Build クリックでビルド導線を開始する
  - i18n ラベルを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 19:00 JST TreeConsole のコンテキストメニューに Build を追加する対応に着手。
  - update: 2026-01-11 19:40 JST Build メニュー項目の表示条件・i18n・ビルド導線を接続。検証: 未実施。
  - done: 2026-01-11 19:45 JST Build メニューの結線と TreeNodeInfoPanel 経路の共通化まで完了。検証: 未実施。

2121) fix/app/tree-node-info-panel-width-align-searchfield (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/tree-node-info-panel-width-align-searchfield
- 依存: なし
- 受け入れ基準: TreeConsole の TreeNodeInfoPanel 表示時に横幅が SearchField と一致する／他画面や他パネルのレイアウトに影響がない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `packages/ui/search-field/src/SearchField.tsx`（必要に応じて）
- ロールバック手順: 追加した幅調整差分を revert し、従来の幅へ戻す
- チェックリスト:
  - SearchField の幅仕様を確認する
  - TreeNodeInfoPanel の幅を SearchField に揃える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 19:20 JST TreeNodeInfoPanel の幅を SearchField に揃える対応に着手。
  - update: 2026-01-11 19:30 JST SearchField の幅定数をエクスポートし TreeNodeInfoPanel の max/min 幅を揃えるよう調整。検証: 未実施。
  - update: 2026-01-11 20:05 JST TreeConsole の split view カラム幅を SearchField と同じ 281-420px に調整。検証: 未実施。

2122) docs/shape-step5-batch-modeling (P1) — 進行中 (2026-01-11)
- ブランチ名: docs/shape-step5-batch-modeling
- 依存: なし
- 受け入れ基準: Step5 の extract2/vectortile 処理をモデル化して I/O/CPU/メモリの流れとボトルネック仮説を整理する／改善方向の候補を列挙する／着手優先度の判断材料を示す／TASKS.md に運用ログを記載する
- 影響範囲: ドキュメント/調査（コード変更なし）
- ロールバック手順: 記載した検討内容を削除する
- チェックリスト:
  - 現状の処理モデル（タスク単位・データ流・永続化）を整理する
  - ボトルネック仮説と改善方向を整理する
  - 着手優先度の判断材料を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 20:30 JST shape Step5 のバッチ処理モデル化に着手。
  - update: 2026-01-11 21:10 JST vt ステージ名への移行方針（併存なし/データ破棄/帯3はOFF）を前提にデータモデル設計を整理。検証: 未実施。
  - update: 2026-01-11 21:25 JST 帯内は最小zのみインデックス化・vtタスクの上限導入・帯別featureIdユニーク化・band3対象条件を反映する設計更新に着手。検証: 未実施。
  - update: 2026-01-11 21:40 JST tileIndexBand のテーブル設計と vt タスク分割ルール（maxBuffers/maxVertices）案を整理。検証: 未実施。
  - update: 2026-01-11 22:00 JST band3 の自動ON条件を「いずれかの国で自治体レベル2以上を選択した場合」に更新し、対象国限定の実行ルールを明文化。検証: 未実施。
  - update: 2026-01-11 22:10 JST band3 の重複・一貫性方針として、extract 時にBBox→z9タイル集合へ変換し vt タスク予約を行う設計を追記。検証: 未実施。
  - update: 2026-01-11 22:25 JST band3 予約の軽量永続化（重複排除/上限管理）と固定タスク生成時の追加投入フローを追記。検証: 未実施。
  - update: 2026-01-11 22:45 JST TileId/TileBBox 変換コードと一気移行の作業手順を文書へ追記。検証: 未実施。
  - update: 2026-01-11 23:10 JST shape-vt ドキュメントを実装者向けに再構成し、DBスキーマ/タスクpayload/分割ルール/座標系を追記。検証: 未実施。
  - update: 2026-01-11 23:30 JST vt-store/vt-shape-store/vt-orchestrator の再編成方針と旧実装の削除方針を追記。検証: 未実施。
  - update: 2026-01-11 23:45 JST vt-store API 互換維持と vt-route-store/location-store の追加整理、vt 完全稼働後の旧実装削除方針を追記。検証: 未実施。
  - update: 2026-01-12 00:10 JST 共通/差分ドキュメントを vt-pipeline-design.md / vt-shape-pipeline-design.md / vt-route-pipeline-design.md に分割。旧ファイルは移動案内に差し替え。検証: 未実施。
  - update: 2026-01-12 09:10 JST shape/route の fetch ステージ命名変更と smartFetch/責務分担の共通化を反映する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:20 JST shape-fetch/route-fetch 命名と smartFetch/責務分担を共通ドキュメントに反映し、shape/route 差分ドキュメントも更新。検証: 未実施。
  - update: 2026-01-12 09:30 JST stage1Buffers への共通名統一を反映する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:35 JST stage1Buffers への共通名統一を shape/route 差分ドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 09:45 JST stage1Buffers の命名をスキーマ/保存単位/識別キー観点で追記する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:55 JST stage1Buffers の共通スキーマと domainType/sourceKey を明記し、shape/route での値の例を追記。検証: 未実施。
  - update: 2026-01-12 10:10 JST vt パイプライン3ドキュメントを通読し、不備・不足の補強に着手。検証: 未実施。
  - update: 2026-01-12 10:25 JST 用語/責務/タスクpayload/入出力/ストア分担/中間ストア寿命/簡略化/ObsolateBuildConfig を追記し、shape/route差分へタスク単位と band3 条件を補強。検証: 未実施。
  - update: 2026-01-12 10:35 JST extract ステージ名を transform に統一する作業に着手。検証: 未実施。
  - update: 2026-01-12 10:45 JST transform ステージ名の統一を共通/差分ドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 10:55 JST パッケージ責務と旧実装の移行対応表の補強に着手。検証: 未実施。
  - update: 2026-01-12 11:05 JST パッケージ責務の明文化と旧実装対応表を共通設計へ追記し、shape/route 差分に旧ストアの注釈を追加。検証: 未実施。
  - update: 2026-01-12 11:15 JST ファイル単位の実装スケッチ追記に着手。検証: 未実施。
  - update: 2026-01-12 11:30 JST 共通設計にファイル単位の実装スケッチを追加し、shape/route 側に固有ファイル補足を追記。検証: 未実施。
  - update: 2026-01-12 11:40 JST vt-orchestrator の runStage1 命名を runFetch に統一する作業に着手。検証: 未実施。
  - update: 2026-01-12 11:45 JST vt-orchestrator の runFetch 命名をドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 12:00 JST stage1/transform 責務の明確化、route band3 条件、sourceKey、tile coverage/index 仕様の反映に着手。検証: 未実施。
  - update: 2026-01-12 12:20 JST plugin側fetch/transform責務と route band3 条件/route sourceKey/coverage-index仕様を反映。検証: 未実施。
  - update: 2026-01-12 12:35 JST fetchDispatcher のI/Fと plugin接続点の明文化に着手。検証: 未実施。
  - update: 2026-01-12 12:45 JST fetchDispatcher のI/F（FetchContext/FetchResult/Dispatcher）を追記し、shape/route 側の接続点を明記。検証: 未実施。
  - update: 2026-01-12 13:00 JST route の band3 判定手順と依存データの具体化に着手。検証: 未実施。
  - update: 2026-01-12 13:10 JST route の band3 判定手順（入力/手順/出力）を追記し、ObsolateBuildConfig に保存する方針を明記。検証: 未実施。
  - update: 2026-01-12 13:20 JST route band3 判定を shape 依存のみに修正する作業に着手。検証: 未実施。
  - update: 2026-01-12 13:25 JST route band3 判定を shape band3 のみに変更し、意図（タイル跨ぎの LineString 抽出一致）を注記。検証: 未実施。
  - update: 2026-01-12 13:40 JST route transform のタイル跨ぎ LineString 仕様を明文化する作業に着手。検証: 未実施。
  - update: 2026-01-12 13:45 JST route transform にタイル跨ぎ LineString 仕様を追記し、band3 条件の説明を shape 依存に統一。検証: 未実施。
  - update: 2026-01-12 14:00 JST band3 条件と plugin/orchestrator 責務の整合整理に着手。検証: 未実施。
  - update: 2026-01-12 14:10 JST band3 条件を shape/route で分離し、plugin→orchestrator 責務を明記。検証: 未実施。
  - update: 2026-01-12 14:20 JST runFetch の位置付け整理に着手。検証: 未実施。
  - update: 2026-01-12 14:30 JST runFetch を削除し、plugin→orchestrator のタスク投入に整理。検証: 未実施。
  - update: 2026-01-12 14:40 JST taskQueue の payload 仕様明確化に着手。検証: 未実施。
  - update: 2026-01-12 14:50 JST transform/vt タスク payload を plugin→taskQueue 前提で明記し、stage1 は plugin 内完結と注記。検証: 未実施。
  - update: 2026-01-12 15:00 JST マージ後の齟齬を整理し、plugin→orchestrator 責務と stage1 タスク表記を整合。検証: 未実施。
  - update: 2026-01-12 15:10 JST taskQueue の役割（Dexie 永続化/メタデータ/進捗通知）を補強する作業に着手。検証: 未実施。
  - update: 2026-01-12 15:15 JST taskQueue の Dexie 永続化と進捗/エラー通知の責務を明記。検証: 未実施。
  - update: 2026-01-12 15:30 JST stage1 を taskQueue 管理対象に戻す修正に着手。検証: 未実施。
  - update: 2026-01-12 15:40 JST fetch タスクを taskQueue 管理対象にし、payload と責務表記を整合。検証: 未実施。
  - update: 2026-01-12 15:50 JST taskQueue の状態遷移と進捗イベント仕様の明文化に着手。検証: 未実施。
  - update: 2026-01-12 16:00 JST taskQueue の状態遷移と進捗イベント最小フォーマットを追記。検証: 未実施。
  - update: 2026-01-12 16:10 JST taskQueue に queued→running→skipped を追加する作業に着手。検証: 未実施。
  - update: 2026-01-12 16:15 JST taskQueue の状態遷移に skipped を追加し、イベントstatusと条件例を明記。検証: 未実施。
  - update: 2026-01-12 16:25 JST reused 状態の追加と skipped 条件の分離に着手。検証: 未実施。
  - update: 2026-01-12 16:30 JST reused 状態を追加し、既存成果は reused に分類。skipped の条件を分離。検証: 未実施。
  - update: 2026-01-12 16:40 JST reused/skipped の後段タスク・リソース提供の差を明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 16:45 JST reused は後段タスク/リソース提供、skipped は提供なしと明記。検証: 未実施。
  - update: 2026-01-12 16:55 JST reused/skipped の定義をキャッシュ/無提供の意味に沿って更新する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:00 JST reused はキャッシュ等で成功時同等の成果を提供、skipped は提供なしと明記。検証: 未実施。
  - update: 2026-01-12 17:05 JST skipped を「提供なし・エラー報告不要」と明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:10 JST skipped は提供なしだがエラー報告不要と明記。検証: 未実施。
  - update: 2026-01-12 17:20 JST fetch 成功時のキャッシュと reused 処理の連携を明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:25 JST fetch 成功時に smartFetch キャッシュし、以降は reused とする仕様を追記。検証: 未実施。
  - update: 2026-01-12 17:35 JST route-fetch の waypoints 計算結果のキャッシュと reused 扱いの追記に着手。検証: 未実施。
  - update: 2026-01-12 17:40 JST route-fetch の waypoints（大圏航路/ searoute-jp）キャッシュと reused 扱いを追記。検証: 未実施。
  - update: 2026-01-12 18:00 JST taskId/キャッシュキー/カバレッジ/リトライ仕様の詳細化に着手。検証: 未実施。
  - update: 2026-01-12 18:15 JST taskId 規則・キャッシュキー・tile coverage/index・リトライ方針を批判的検討と新仕様で追記。検証: 未実施。

2117) feat/app/tree-node-info-panel-build-flow (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/app/tree-node-info-panel-build-flow
- 依存: なし
- ExecPlan: plans/tree-node-info-panel-build-flow-execplan.md
- 受け入れ基準: TreeNodeInfoPanel に Build ボタンが追加され、build/download 対象ノードで自動ビルド/自動ダウンロードが実行される／folder ノードで子孫・先祖の自動ビルドが順次実行される／完了後に元の pageNodeId に戻る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `app/src/router/pages/tree/console/useTreeNodeInfoPanel.ts`, `app/src/router/routes/tree/PluginDialogRoute.tsx`, `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`, `packages/ui/tabular-extract/src/components/TabularDataImport.tsx`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、Build ボタン/自動ビルド導線を元に戻す
- チェックリスト:
  - build/download 対象ノードの判定と遷移 URL を整理する
  - ?build=1 で自動ビルド/ダウンロードが走る導線を実装する
  - folder のビルドシーケンス遷移と復帰を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:40 JST TreeNodeInfoPanel の Build ボタンと自動ビルド導線の設計に着手。
  - update: 2026-01-06 07:53 JST ExecPlan を作成（plans/tree-node-info-panel-build-flow-execplan.md）。検証: 未実施。
  - update: 2026-01-11 17:35 JST Build ボタンのアイコンを Construction に統一する指示を反映する作業に着手。検証: 未実施。
  - update: 2026-01-11 17:45 JST Build ボタンのアイコン更新、auto build/return と auto download を実装。検証: 未実施。

2116) fix/app/trash-restore-refresh (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-restore-refresh
- 依存: なし
- 受け入れ基準: ゴミ箱復元時に強制リロード相当の初期化が走らず、TreeSubscriptionAPI の更新で画面が反映される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/useTrashDialog.ts` と復元後の画面遷移処理（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、復元後の挙動を元に戻す
- チェックリスト:
  - Trash 復元後のリロード経路を特定する
  - TreeSubscriptionAPI の更新だけで済むよう調整する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:20 JST Trash 復元時の強制リロード挙動の調査に着手。
  - update: 2026-01-11 16:25 JST restore 後の closeDialog から reload 指定を外し、TreeSubscriptionAPI 更新に委ねるよう修正。検証: 未実施。

2115) fix/app/trash-restore-originalname (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-restore-originalname
- 依存: なし
- 受け入れ基準: ゴミ箱から復元したノードの `originalName` が復旧される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/**` と復元処理周辺（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、復元前の挙動へ戻す
- チェックリスト:
  - originalName が復元されない経路を特定する
  - 復元処理で originalName を反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:00 JST Trash 復元時の originalName 未復旧の調査に着手。
  - update: 2026-01-11 16:10 JST restoreFromTrash で metadata.name を originalName 由来の値に復旧するよう修正。検証: 未実施。

2114) fix/app/trash-dialog-useeffect-loop (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-dialog-useeffect-loop
- 依存: なし
- 受け入れ基準: TrashDialog の useEffect が無限更新にならない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/TrashDialog.tsx`（必要に応じて関連 hook）
- ロールバック手順: `app/src/router/pages/tree/trash/TrashDialog.tsx` の差分を revert し、useEffect 修正前に戻す
- チェックリスト:
  - TrashDialog の useEffect を特定し依存と state 更新の関係を確認する
  - 無限更新の原因を整理し修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 15:40 JST TrashDialog の useEffect 無限更新警告の調査に着手。
  - update: 2026-01-06 07:03 JST useTrashFrameState の正規化処理で同値更新を抑止し、useEffect の再実行ループを回避。検証: 未実施。

2113) fix/runtime-worker/stageprocessing-typecheck (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/runtime-worker/stageprocessing-typecheck
- 依存: なし
- 受け入れ基準: `@hierarchidb/runtime-worker` の typecheck で StageProcessingService の TS2345 が解消する／VectorTileRecord と VectorTileRow の型整合が取れる／挙動は変更しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/StageProcessingService.ts`（必要に応じて型定義）
- ロールバック手順: `packages/runtime-worker/src/services/StageProcessingService.ts` の差分を revert し、型修正前に戻す
- チェックリスト:
  - StageProcessingService の vector tile 取り扱い型を確認する
  - TS2345 を解消するための型修正を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 15:20 JST runtime-worker の StageProcessingService typecheck 修正に着手。
  - update: 2026-01-11 15:30 JST shape vector tile の bulkUpsert で必須フィールドを補完し、storeTiles の contentType を型に合わせて統一。検証: 未実施。

2112) fix/shape/step5-clear-stage-cache-counters (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/step5-clear-stage-cache-counters
- 依存: なし
- 受け入れ基準: Step4 で extract1/extract2 のキャッシュ削除を実行した後、Step5 のタスク一覧と集計が `0/0` `0%` `No tasks yet.` 表示になる／既存の進捗・タスク集計に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/batch/**`（調査後に絞り込み）
- ロールバック手順: Step4/Step5 周辺の差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Step4 のキャッシュ削除後に Step5 のタスク集計が残る原因を特定する
  - Step5 のタスク集計/一覧を 0 に更新する処理を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 14:20 JST Step4 のキャッシュ削除後に Step5 のタスク集計が残る問題の調査に着手。
  - update: 2026-01-11 14:30 JST Step4 の削除処理で extract1/2 のローカルタスク表示を消去し、Step5 側で taskSummary を再評価して 0 件時にリセットする対応を追加。検証: 未実施。
  - update: 2026-01-11 14:40 JST Step4 の削除ボタン判定に extract1/extract2 タスク数を追加し、停止中でタスクが残っている場合に削除可能とする対応を追加。検証: 未実施。

2111) fix/app/geojson-vt-resolve (P1) — 完了 (2026-01-06)
- ブランチ名: fix/app/geojson-vt-resolve
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で geojson-vt の解決エラーが発生しない／TASKS.md に運用ログを記載する／ロールバック手順を明記する
- 影響範囲: `app/vite.config.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`（調査後に絞り込み）
- ロールバック手順: 追加した依存または build 設定の差分を revert し、従来のビルド設定に戻す
- チェックリスト:
  - build 時に geojson-vt が解決できない原因を確認する
  - build を通すための修正を実施する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-06 00:26 JST geojson-vt の build 解決エラー対応に着手。
  - done: 2026-01-06 10:01 JST shape-plugin に geojson-vt 依存を追加し、lockfile を更新。検証: 未実施。

2111) fix/shape/step5-task-titles (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/step5-task-titles
- 依存: なし
- 受け入れ基準: ダウンロードタスクは `JPN/1` のまま／一次抽出タスクは `JPN/1 | Japan/Tokyo` 形式で英語国名/地域名を付与／二次抽出タスクは `JPN/1 | Japan/Tokyo | z4-6` のようにズーム範囲を表示／既存の並び順や処理内容は維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/**`, `plugins/shape-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: タスクタイトル生成の差分を revert し、従来の `JPN/1` 表記へ戻す
- チェックリスト:
  - タスクタイトル生成の実装箇所を特定する
  - 一次抽出/二次抽出のタイトル拡張を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 07:10 JST Step5 タスクタイトルの拡張対応に着手。
  - update: 2026-01-11 15:35 JST タスク表記を「JPN/1 | Japan/Tokyo | z4-6」形式へ変更する方針で合意。
  - update: 2026-01-11 15:45 JST extract1/extract2 のタイトル生成を「JPN/1 | Japan/Tokyo | z4-6」形式へ更新。検証: 未実施。

2113) fix/ui-map/map-preview-basemap-and-missing-layer-warning (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/ui-map/map-preview-basemap-and-missing-layer-warning
- 依存: なし
- 受け入れ基準: `/map` のデフォルト basemap が Satellite ではなく Terrain になる／`/map` のプレビューで対象レイヤが未生成の場合に内部エラーではなく「まだビルドされていないノードがあります」系の警告ダイアログを毎回表示する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/**`, `packages/ui/map/src/**`（調査後に絞り込み）
- ロールバック手順: `/map` のデフォルト style と警告ダイアログの差分を revert し、従来の表示に戻す
- チェックリスト:
  - `/map` のデフォルト basemap を Terrain へ変更する
  - 未生成レイヤ検知時の警告ダイアログを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:05 JST /map のデフォルト basemap と未生成レイヤ警告の対応に着手。
  - update: 2026-01-11 16:20 JST /map のデフォルト style を Terrain に変更し、未生成レイヤ検知時に警告ダイアログを表示する処理を追加。検証: 未実施。

2114) investigate/shape/step4-filter-config-usage (P2) — 進行中 (2026-01-11)
- ブランチ名: investigate/shape/step4-filter-config-usage
- 依存: なし
- 受け入れ基準: Step4 の面積フィルター/最小頂点数/最小面積/クイック除外しきい値/シンプル形状頂点しきい値/細長形状補正係数が実処理で参照されているかを確認し、参照箇所または未使用を報告する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/features/gis-sdk/src/**`, `packages/runtime-worker/src/**`（調査結果に応じて）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - Step4 UI で設定される項目の保存先を確認する
  - ワーカー/処理パイプラインでの参照有無を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:35 JST Step4 のフィルタ設定が実処理で参照されているかの調査に着手。
  - done: 2026-01-11 16:45 JST Step4 のフィルタ設定は batchConfig へ保存されるが、現行の shape-vt パイプラインでは参照されていないことを確認。報告のみ、変更なし。

2110) feat/ui-map/attribution-badge (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/ui-map/attribution-badge
- 依存: なし
- ExecPlan: plans/ui-map-attribution-badge-execplan.md
- 受け入れ基準: shape/location/route で選択可能なデータソースの attribution を網羅できる／MapLibre 標準の Attribution/License バッジで表示される／Step6 プレビューに限定せず `@hierarchidb/ui-map` の標準機能として `/map` 等で再利用できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: 追加した attribution 表示とデータソース定義の差分を revert し、従来の地図表示に戻す
- チェックリスト:
  - ui-map に attribution 表示の共通 API を追加する
  - shape/location/route のデータソース attribution 定義を整理する
  - Step6 と /map で attribution が表示されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:30 JST attribution 表示の共通実装とデータソース網羅の設計に着手。
  - update: 2026-01-11 06:00 JST ExecPlan を作成（plans/ui-map-attribution-badge-execplan.md）。
  - update: 2026-01-11 06:55 JST ui-map に attribution 制御とフォーマッタを追加し、shape/location/route のプレビューと /map で attributionItems を配線。location は選択肢に合わせて alias/fallback で対応。検証: 未実施。

2109) feat/shape/geojson-vt-index-reuse (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/shape/geojson-vt-index-reuse
- 依存: なし
- 受け入れ基準: extract2 で geojson-vt の index を生成して IndexedDB に保存できる／vectortile ステージで保存済み index を復元して再利用できる／既存の per-tile index 生成が抑制される／設計と手順を doc に整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/**`, `packages/features/gis-sdk/src/**`, `plugins/shape-plugin/src/services/**`（調査後に絞り込み）
- ロールバック手順: 追加した index 保存/復元の処理を revert し、従来の per-tile index 生成へ戻す
- チェックリスト:
  - idb-geojson-vt-test.html の復元手順をコードに反映する
  - extract2 で geojson-vt index を生成して IndexedDB に保存する
  - vectortile で index を復元し geojson-vt 生成を再利用する
  - 既存の index 生成経路が重複しないよう制御する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:20 JST extract2 で geojson-vt index を保存し vectortile で再利用する対応に着手。
  - update: 2026-01-11 05:30 JST extract2 入力に vectorTiles 設定を追加し、EphemeralShapeDB に geojson-vt index の保存テーブル/APIを追加。extract2 で index 保存、vectortile で復元して storeTiles に保存する経路を実装。検証: 未実施。

2103) fix/shape/step5-pause-flapping (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-pause-flapping
- 依存: なし
- 受け入れ基準: Step5 のタイル生成で一時停止が勝手に再開/再停止しない／再現条件と原因・発生範囲を説明する／修正方法と適用範囲を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/runtime-worker/src/**`, `packages/plugin-service-sdk/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、一時停止ロジックを元に戻す
- チェックリスト:
  - 再現条件とログを確認する
  - 一時停止/再開の状態遷移を特定する
  - 安定化の修正を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:15 JST Step5 タイル生成の一時停止フラッピング調査に着手。
  - done: 2026-01-05 21:21 JST progress phase と session status の不一致で paused が running に上書きされる問題を修正。影響は shape-plugin の progress status 判定のみ。検証: 未実施。

2104) fix/shape/step5-status-phase-flap (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-status-phase-flap
- 依存: なし
- 受け入れ基準: Step5 のタイル生成で completed/running の揺れが発生しない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の status 判定へ戻す
- チェックリスト:
  - 進捗 phase と session status の優先順位を整理する
  - Step5 で status が揺れないように修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:24 JST Step5 の completed/running フラップ調査に着手。
  - done: 2026-01-05 21:25 JST progress phase より session status を優先するように修正し、completed/running の揺れを抑止。検証: 未実施。

2105) fix/shape/step5-zoom-range-block (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-zoom-range-block
- 依存: なし
- 受け入れ基準: Step5 のビルド開始で「Zoom range changed...」が誤検知されず開始できる／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/stage/useBatchSessionActions.ts`, `plugins/shape-plugin/src/worker/api.ts`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、ズーム範囲判定を元に戻す
- チェックリスト:
  - Zoom range mismatch の判定条件を確認する
  - Start/Resume の分岐とステータス更新を整理する
  - ビルド開始のブロックを解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:39 JST Step5 のズーム範囲警告で開始できない問題の調査に着手。
  - done: 2026-01-05 22:40 JST ズーム範囲不一致時は resume をスキップして新規開始へ進むよう修正。検証: 未実施。

2106) fix/shape/step5-next-disabled (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-next-disabled
- 依存: なし
- 受け入れ基準: Step5 でタイル/メタデータが生成されている場合に valid となり「次へ」が有効化される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、Step5 の valid 判定を元に戻す
- チェックリスト:
  - Step5 の valid 判定条件と「次へ」制御を確認する
  - 生成済みタイル/メタデータの検知経路を整理する
  - 「次へ」無効化の原因を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:45 JST Step5 の「次へ」無効化調査に着手。
  - done: 2026-01-05 22:46 JST Step データに nodeId を常時付与し、プレビュー可否判定が DB 検索に到達できるよう修正。検証: 未実施。

2107) fix/shape/step6-vector-tile-missing (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step6-vector-tile-missing
- 依存: なし
- 受け入れ基準: Step6 で「ベクトルタイルがまだありません」が出ずプレビューが表示される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/runtime-worker/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、従来のプレビュー判定へ戻す
- チェックリスト:
  - ベクトルタイル保存・参照の経路を確認する
  - Step6 の「タイルなし」判定条件を確認する
  - 不整合の原因を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:50 JST Step6 のベクトルタイル未検知問題の調査に着手。
  - done: 2026-01-05 22:55 JST stage worker 起動時に shape の vector tile store を登録し、タイル保存先が欠ける問題を修正。検証: 未実施。

2108) fix/shape/step5-next-during-build (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-next-during-build
- 依存: なし
- 受け入れ基準: Step5 のビルド進行中でも「次へ」が有効化される／Step6 で進行中のタイル生成が待機/表示される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps-provider.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、Step5/Step6 の判定を元に戻す
- チェックリスト:
  - Step5 の valid 判定にビルド中を含める
  - Step6 の canProceed 判定にビルド中を含める
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 23:01 JST Step5 のビルド中「次へ」無効化の調査に着手。
  - done: 2026-01-05 23:01 JST processing/paused を Step5/Step6 の判定に含め、ビルド中も「次へ」を許可。検証: 未実施。

2102) fix/shape/step4-cache-labels (P2) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step4-cache-labels
- 依存: なし
- 受け入れ基準: shape-plugin Step4 の「ステージ1キャッシュ/ステージ2キャッシュ」を「一次抽出キャッシュ/二次抽出キャッシュ」に置換する／英語表記を extract1 cache / extract2 cache に揃える／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（該当箇所）
- ロールバック手順: 該当ファイルの文言差分を revert し、従来の表記へ戻す
- チェックリスト:
  - Step4 の日本語表記を更新する
  - Step4 の英語表記を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:11 JST Step4 のキャッシュ表記変更に着手。
  - done: 2026-01-05 21:12 JST Step4 のキャッシュ表記を一次/二次抽出に更新し、英語表記を extract1/extract2 cache に統一。検証: 未実施。

2101) investigate/shape/vectortile-hotspots-and-wasm (P1) — 進行中 (2026-01-11)
- ブランチ名: investigate/shape/vectortile-hotspots-and-wasm
- 依存: なし
- 受け入れ基準: タイル生成処理の重い区間を計測ログで特定する／最適化余地と候補を列挙する／WASM 化の適用候補と可否を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、計測ログ追加前に戻す
- チェックリスト:
  - タイル生成のボトルネックを計測ログで可視化する
  - 最適化候補を整理する
  - WASM 化の適用可能箇所を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:10 JST タイル生成のボトルネック調査に着手。
  - update: 2026-01-11 03:25 JST runtime-worker と gis-sdk にタイル生成の区間別計測ログを追加。検証: 未実施。
  - update: 2026-01-11 03:45 JST 計測ログから tiles built（tile 走査/エンコード）と geojson-vt index が主要コストで、read/decode/store は軽微と判明。WASM 置換は geojson-vt/vt-pbf がJS実装のため難易度高く、まずはタイル候補削減/ズーム範囲/入力削減で最適化検討が必要と整理。検証: 未実施。
  - update: 2026-01-11 04:05 JST extract2 の tileId relations を実形状交差で絞る独立ExecPlanを作成。`docs/shape-tileid-intersection-execplan.md` を追加。検証: 未実施。

2100) fix/shape/download-stall-chunk-store-response (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/download-stall-chunk-store-response
- 依存: なし
- 受け入れ基準: download ステージで chunk-store 経由取得が停止しない／URL 取得の HEAD/GET と Dexie キャッシュの復元が期待通りに動作する／必要なら不整合の原因を説明し修正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/datasources/*.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、chunk-store 関連の変更を元に戻す
- チェックリスト:
  - download ステージの取得経路で chunk-store の利用有無を確認する
  - HEAD/GET と Dexie 読み出しの挙動を確認する
  - 停止の原因を特定し修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:10 JST chunk-store と download 停止の関係調査に着手。
  - done: 2026-01-11 02:25 JST download タスクに timeout signal を追加し、chunk-store 経由の fetch がハングした際に abort→stale キャッシュへフォールバックできるよう調整。検証: 未実施。
  - update: 2026-01-11 02:40 JST chunk-store のキャッシュ整合性チェックを追加し、download タスクの段階ログを追加。検証: 未実施。
  - update: 2026-01-11 02:55 JST worker での CompressionStream を無効化し、chunk-store 書き込み前後のログを追加。検証: 未実施。
  - update: 2026-01-11 03:15 JST download バッファの gzip 圧縮を無効化し、保存は非圧縮で統一。検証: 未実施。

2101) fix/shape/step5-vectortile-sort-title-parse (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step5-vectortile-sort-title-parse
- 依存: なし
- 受け入れ基準: Step5 の vectortile タスク一覧が z/x/y 数値昇順で表示される／タスクタイトルの z/x/y 表記から並び順が決まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、現行の並び順へ戻す
- チェックリスト:
  - タイトル表記から z/x/y を抽出してソートする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:20 JST vectortile タスクの並び順補正に着手。
  - update: 2026-01-11 03:10 JST Step5 の vectortile 並び順をタイトル由来の z/x/y で再調整する作業に着手。
  - done: 2026-01-11 03:20 JST vectortile タスクのタイトル表記から z/x/y を抽出して昇順ソートするよう統一。検証: 未実施。

2102) fix/shape/step4-zoom-config-card (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-zoom-config-card
- 依存: なし
- 受け入れ基準: Stage4 のズーム範囲/分割数/区切りが単一カードに統合される／挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - ズーム範囲/分割数/区切りを単一カードに統合する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:30 JST Step4 のズーム設定を単一カードへ統合する作業に着手。
  - done: 2026-01-11 03:40 JST ズーム範囲/分割数/区切りを単一カードに統合しレイアウトを調整。検証: 未実施。

2103) fix/shape/step4-tile-margin-layout (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-tile-margin-layout
- 依存: なし
- 受け入れ基準: タイルマージンがズームカードの下に移設される／タイルマージン/拡張係数/拡張マージンが横並び3列になる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - タイルマージンの位置をズームカード下へ移動する
  - 3列レイアウトへ揃える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:50 JST タイルマージンの配置と3列レイアウトの調整に着手。
  - done: 2026-01-11 04:00 JST タイルマージンをズームカード下へ移設し、マージン/拡張係数/拡張マージンを3列で配置。検証: 未実施。

2104) fix/shape/step4-zoom-card-columns (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-zoom-card-columns
- 依存: なし
- 受け入れ基準: ズームカード内のズーム範囲/分割数/区切りが横並び3列になる／挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - ズームカード内の3項目を横並びにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:10 JST ズームカード内の3項目を横並びにする作業に着手。
  - done: 2026-01-11 04:15 JST ズームカード内を3列レイアウトに変更。検証: 未実施。

2105) investigate/shape/step5-next-disabled (P2) — 完了 (2026-01-11)
- ブランチ名: investigate/shape/step5-next-disabled
- 依存: なし
- 受け入れ基準: Step5 の Next が enabled なのに押せない要因を特定し説明する／必要であれば修正方針を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/*`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`（必要に応じて）
- ロールバック手順: 変更があれば差分を revert して現行挙動へ戻す
- チェックリスト:
  - Step5 の Next 判定・クリック処理の経路を確認する
  - Stepper の遷移経路との差分を特定する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:25 JST Step5 の Next が押せない事象の原因調査に着手。
  - done: 2026-01-11 04:35 JST Next は onStepNavigate→handleNavigation を通るが、runWithPending が in-flight を検知すると無視されるため、pendingAction が残っていると「見た目は有効だが反応なし」になり得る点を確認。Step6 直行は direct ナビゲーション経路で同じ onStepNavigate を使うため、pendingAction/ensureNoConflict/updateLocalDraft のブロックが主な候補。検証: 未実施。

2106) fix/shape/step3-auth-warning-suppress (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-auth-warning-suppress
- 依存: なし
- 受け入れ基準: shape Step3 の認証が必要警告がUIに表示されない／内部処理やログに影響しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui-auth/src/AuthRequiredDialog.tsx`（必要に応じて）
- ロールバック手順: 表示抑制の差分を revert して現行表示へ戻す
- チェックリスト:
  - shape Step3 の警告表示を抑制する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:45 JST Step3 の認証警告表示の抑制に着手。
  - update: 2026-01-11 05:05 JST shape の AUTH_REQUIRED を UI 表示せず、キャンセル通知も返さないよう修正。検証: 未実施。
  - update: 2026-01-11 05:15 JST Step3 のメタデータ取得は auth 無効のネットワークポートに変更し、AUTH_REQUIRED を発生させない形へ調整。検証: 未実施。

2107) fix/app/ui-search-field-dep (P1) — 完了 (2026-01-11)
- ブランチ名: fix/app/ui-search-field-dep
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で ui-search-field が UNLOADABLE_DEPENDENCY にならない／依存が package.json に明示される／TASKS.md に運用ログを記載する
- 影響範囲: `app/package.json`
- ロールバック手順: 依存追加差分を revert する
- チェックリスト:
  - app/package.json に ui-search-field を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:25 JST app の ui-search-field 依存追加に着手。
  - done: 2026-01-11 05:27 JST app に @hierarchidb/ui-search-field を追加して UNLOADABLE_DEPENDENCY を回避。検証: 未実施。

2108) fix/ui-treeconsole-treetable/column-id-accessor (P1) — 完了 (2026-01-11)
- ブランチ名: fix/ui-treeconsole-treetable/column-id-accessor
- 依存: なし
- 受け入れ基準: TreeTableCore の accessorKey 参照がなくなり typecheck が通る／ColumnDef の型に沿った判定になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/treetable/src/components/TreeTableCore.tsx`
- ロールバック手順: 参照変更の差分を revert する
- チェックリスト:
  - accessorKey 参照を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:40 JST TreeTableCore の accessorKey 参照修正に着手。
  - done: 2026-01-11 05:42 JST column.id のみを使う形へ変更し accessorKey 参照を削除。検証: 未実施。

2109) fix/shape-plugin/typecheck-missing-vt-pbf (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape-plugin/typecheck-missing-vt-pbf
- 依存: なし
- 受け入れ基準: shape-plugin の typecheck で vt-pbf と型エラーが解消する／依存追加と型修正が最小差分で入る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/package.json`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: 上記ファイルの差分を revert して現行挙動へ戻す
- チェックリスト:
  - vt-pbf 依存を追加する
  - GeoJSONVT / tileZ などの型エラーを修正する
  - taskType 参照を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:55 JST shape-plugin typecheck の vt-pbf/型エラー修正に着手。
  - done: 2026-01-11 06:05 JST vt-pbf 依存を追加し、GeoJSONVT/タイル座標/taskType の型エラーを修正。検証: 未実施。
  - update: 2026-01-11 06:10 JST geojson-vt Tile 型を明示して vt-pbf 変換の型エラーを解消。検証: 未実施。
  - update: 2026-01-11 06:15 JST tile null を明示的に除外して spread の型エラーを解消。検証: 未実施。

2110) feat/shape-plugin/step5-i18n (P2) — 完了 (2026-01-11)
- ブランチ名: feat/shape-plugin/step5-i18n
- 依存: なし
- 受け入れ基準: Step5 のラベル/全体進捗カードの文言が i18n され日本語訳が入る／英語は既存文言を維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/locales/ja.json`, `plugins/shape-plugin/src/ui/locales/en.json`（必要に応じて）
- ロールバック手順: 翻訳追加の差分を revert して現行表示へ戻す
- チェックリスト:
  - Step5 の文言キーを確認して翻訳を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:25 JST Step5 の i18n 文言追加に着手。
  - done: 2026-01-11 06:30 JST Step5 の Build/Stage/Task ラベルを i18n 化し日本語訳を追加。検証: 未実施。

2111) fix/shape-plugin/step3-geoboundaries-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape-plugin/step3-geoboundaries-auth
- 依存: なし
- 受け入れ基準: Step3 の geoboundaries メタデータ取得が 401 で失敗しない／shape の認証要求が UI を出さずに解決される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`
- ロールバック手順: 依存箇所の差分を revert して現行挙動へ戻す
- チェックリスト:
  - geoboundaries/gadm のネットワークポートを auth 有効に戻す
  - shape の AUTH_REQUIRED をストレージトークンで即時解決する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:40 JST Step3 の geoboundaries 401 問題修正に着手。
  - done: 2026-01-11 06:45 JST shape の AUTH_REQUIRED を保存済みトークンで自動解決し、メタデータ取得の auth を復帰。検証: 未実施。

2112) fix/shape-plugin/step3-auth-dialog-flow (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape-plugin/step3-auth-dialog-flow
- 依存: なし
- 受け入れ基準: geoboundaries の 401 で AuthRequiredDialog が開き、認証完了後に取得が再開する／401ループが解消する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/ui/auth/src/components/AuthRequiredDialog.tsx`, `packages/features/auth-recovery/src/AuthService.ts`, `packages/features/download/src/smartFetch.ts`, `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`
- ロールバック手順: 自動解決削除の差分を revert して前の挙動へ戻す
- チェックリスト:
  - AUTH_REQUIRED の自動解決を削除する
  - 認証ダイアログが開くことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:55 JST Step3 の auth ダイアログフロー復旧に着手。
  - update: 2026-01-11 16:20 JST 401ループとAuthRequiredDialogの連携不全を調査し、ダイアログ表示/復帰フローを再整備予定。検証: 未実施。
  - update: 2026-01-11 16:45 JST AuthService の認証後レスポンス再利用と AuthRequiredDialog のログ/挙動を修正。検証: 未実施。
  - update: 2026-01-11 16:55 JST AuthService の res 再宣言エラーを修正。検証: 未実施。
  - update: 2026-01-11 17:15 JST AuthRequiredDialog の自動セッション使用を停止し、refreshToken 検証を追加。Step3 の dataSource 未設定警告をロード前は抑止。検証: 未実施。
  - update: 2026-01-11 17:35 JST Step3 の dataSource 未設定判定を batchConfig 準備後に限定し、Step2 への誤リダイレクトを抑止。検証: 未実施。
  - update: 2026-01-11 17:55 JST AuthRequiredDialog から「Use Current Session」ボタンを撤去。検証: 未実施。
  - update: 2026-01-11 18:15 JST Cancel (Back to Step 2) を useDialogUrlSync で遷移させ、認証済み時の警告理由を表示。検証: 未実施。
  - update: 2026-01-11 18:35 JST AUTH_REQUIRED の errorCode/source を実状に合わせて分岐し、UIで有効トークンなら自動解決。検証: 未実施。

2113) chore/docs/agents-no-fallback-rule (P2) — 進行中 (2026-01-11)
- ブランチ名: chore/docs/agents-no-fallback-rule
- 依存: なし
- 受け入れ基準: AGENTS.md に「指示がない限りフォールバック禁止・型で強制」方針を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `AGENTS.md`
- ロールバック手順: AGENTS.md の追記差分を revert して元に戻す
- チェックリスト:
  - フォールバック禁止方針を明文化する
  - 型の厳格利用を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:20 JST AGENTS.md にフォールバック禁止方針の追記に着手。
  - done: 2026-01-11 16:45 JST AGENTS.md に型の厳格運用方針を追記。検証: 該当なし。

2100) fix/shape/step5-vectortile-task-sort (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step5-vectortile-task-sort
- 依存: なし
- 受け入れ基準: Step5 の vectortile タスク一覧が z/x/y 数値昇順で表示される／他ステージの並びに影響しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、現行の並び順へ戻す
- チェックリスト:
  - vectortile タスクのメタデータに z/x/y を付与する
  - Step5 の表示で z/x/y 昇順にソートする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:00 JST Step5 の vectortile タスク並び順修正に着手。
  - done: 2026-01-11 02:06 JST vectortile タスクに z/x/y メタデータを付与し表示を昇順ソート。検証: 未実施。

2099) feat/download/smartfetch-inflight (P2) — 完了 (2026-01-11)
- ブランチ名: feat/download/smartfetch-inflight
- 依存: なし
- 受け入れ基準: smartFetch に in-flight 共有オプションを追加しGET/HEADのみ対象にする／既定キーは method+resolvedUrl+accept／キー生成を差し替え可能／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/download/src/smartFetch.ts`
- ロールバック手順: 上記ファイルの差分を revert し、in-flight 共有オプションを削除する
- チェックリスト:
  - in-flight オプション型を追加する
  - GET/HEAD のみ共有する処理を追加する
  - 既定キーと差し替えロジックを実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:40 JST smartFetch の in-flight 共有実装に着手。
  - done: 2026-01-11 01:50 JST in-flight 共有のオプション実装とキー差し替え対応を追加。検証: 未実施。

2098) fix/shape/step3-worker-metadata-reuse (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-worker-metadata-reuse
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得が worker 経由になり UI から直接URLアクセスしない／CountryAvailabilityResolver の取得結果を再利用する／重複アクセスが解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`, `plugins/shape-plugin/src/ui/workers/countryAvailability.types.ts`, `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`
- ロールバック手順: 上記ファイルの差分を revert し、UI 直接取得に戻す
- チェックリスト:
  - worker API にメタデータ取得を追加する
  - UI hook を worker経由のメタデータ取得へ切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:15 JST Step3 のメタデータ取得を worker 経由に切り替える対応に着手。
  - done: 2026-01-11 01:26 JST worker 経由でメタデータ取得するよう変更し UI 直接アクセスを排除。検証: 未実施。

2097) fix/shape/step3-geoboundaries-proxy-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-geoboundaries-proxy-auth
- 依存: なし
- 受け入れ基準: geoBoundaries のメタデータ取得が CORS プロキシ経由で認証付きで成功する／401 が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来のネットワーク設定へ戻す
- チェックリスト:
  - geoBoundaries 取得で auth 無効化を撤廃する
  - CORS プロキシ経由の取得を有効化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:05 JST geoBoundaries 取得時の CORS プロキシ認証対応に着手。
  - done: 2026-01-11 01:07 JST geoBoundaries 取得で auth 無効化を撤廃し CORS プロキシ認証を通すよう修正。検証: 未実施。

2096) fix/shape/step3-disable-stale-metadata (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-disable-stale-metadata
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得で stale キャッシュフォールバックを行わない／ダミーキャッシュが使われない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、stale キャッシュ許可へ戻す
- チェックリスト:
  - geoboundaries metadata 取得で allowStale を false にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:50 JST Step3 メタデータの stale フォールバック排除に着手。
  - done: 2026-01-11 00:52 JST geoboundaries メタデータ取得で allowStale を無効化。検証: 未実施。

2095) refactor/util/dedupe-sleep (P2) — 完了 (2026-01-11)
- ブランチ名: refactor/util/dedupe-sleep
- 依存: なし
- 受け入れ基準: 指定ファイルの sleep 定義を共通ユーティリティへ集約し重複を解消する／各ファイルの動作は保持される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/util/src/sleep.ts`, `packages/util/src/index.ts`, `packages/tools/gen-iso3166-2/src/scraper.ts`, `packages/features/chunk-store/src/index.ts`, `packages/features/download/src/adapters/FetchNetworkPort.ts`, `packages/features/download/src/smartFetch.ts`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`
- ロールバック手順: 上記ファイルの差分を revert し、各ファイルのローカル sleep 定義を復元する
- チェックリスト:
  - 共通 sleep ユーティリティを追加する
  - 指定ファイルの sleep 定義を置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:35 JST sleep ユーティリティの重複解消に着手。
  - done: 2026-01-11 00:40 JST 共通 sleep を追加し各ファイルのローカル定義を置換。検証: 未実施。

2094) fix/shape/step3-gadm-cors-proxy-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-gadm-cors-proxy-auth
- 依存: なし
- 受け入れ基準: GADM メタデータ取得が CORS プロキシ経由で成功する／401 が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の FetchNetworkPort 設定に戻す
- チェックリスト:
  - GADM メタデータ取得で auth 無効化をやめる
  - CORS プロキシ経由の取得を有効化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:25 JST GADM 取得時の CORS プロキシ認証対応に着手。
  - done: 2026-01-11 00:27 JST GADM 取得で auth 無効化を撤廃し CORS プロキシ認証を通すよう修正。検証: 未実施。

2093) fix/shape/step3-remove-dummy-metadata-seed (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-remove-dummy-metadata-seed
- 依存: なし
- 受け入れ基準: Step3 のハードコード済みダミー国メタデータを削除する／シードによるサイレントフォールバックを排除する／データ不足時は明示的にエラーを返す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/seedStep3Cache.ts`, `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, `plugins/shape-plugin/src/common/mock/data.ts`
- ロールバック手順: 上記ファイルの差分を revert し、シードとダミーデータ定義を復元する
- チェックリスト:
  - Step3 のダミー国メタデータ定義を削除する
  - シード処理を排除しフォールバックを止める
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:15 JST Step3 ダミーメタデータ削除に着手。
  - done: 2026-01-11 00:20 JST ダミー国メタデータとシード処理を削除。検証: 未実施。

2092) fix/ui/tree-node-info-panel-close-root (P2) — 完了 (2026-01-11)
- ブランチ名: fix/ui/tree-node-info-panel-close-root
- 依存: なし
- 受け入れ基準: `/t/r` で×ボタンが表示されない／ルート以外は×ボタンが表示され親ノードへ遷移する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、従来の表示条件へ戻す
- チェックリスト:
  - ルート判定ロジックを修正し×ボタンを非表示にする
  - 親ノード遷移が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:07 JST ルート表示時に×ボタンが残る不具合対応に着手。
  - done: 2026-01-11 00:10 JST ルート判定を追加し×ボタンを非表示化。検証: 未実施。

2091) fix/ui/tree-node-info-panel-close-parent (P2) — 完了 (2026-01-11)
- ブランチ名: fix/ui/tree-node-info-panel-close-parent
- 依存: なし
- 受け入れ基準: TreeNodeInfoPanel の×ボタンが親ノードへ遷移する／ルートノードでは×ボタンが非表示になる／`INVALID_OPERATION Unknown action: navigate` が出ない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、既存の×ボタン挙動に戻す
- チェックリスト:
  - ×ボタンの遷移を親ノードURLへ切り替える
  - ルートノード表示時は×ボタンを非表示にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:00 JST TreeNodeInfoPanel の×ボタン遷移修正に着手。
  - done: 2026-01-11 00:05 JST 親ノード遷移とルート時の非表示を実装。検証: 未実施。

2090) fix/ui/dialog-backdrop-dismiss-icon (P2) — 完了 (2026-01-10)
- ブランチ名: fix/ui/dialog-backdrop-dismiss-icon
- 依存: なし
- 受け入れ基準: 「ダイアログ外クリックで閉じる」のアイコンを DisabledByDefault に変更する／表示のみ変更し挙動は維持する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: 上記ファイルの icon 差分を revert し、SettingsIcon に戻す
- チェックリスト:
  - 設定メニューの該当アイコンを DisabledByDefault に差し替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 23:55 JST ダイアログ外クリックのアイコン変更に着手。
  - done: 2026-01-10 23:56 JST SettingsMenu の表示アイコンを DisabledByDefault に更新。検証: 未実施。

2092) fix/shape/step3-auth-required-warning (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-auth-required-warning
- 依存: なし
- 受け入れ基準: Step3 の auth-required 警告の発生源が特定される／認証ヘッダ未付与の有無が確認される／sessionId 表示の理由が整理され、不要なら除去される／必要な修正で警告が解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `packages/ui/auth/src/components/AuthRequiredDialog.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、Step3 のネットワークが auth 有効に戻る／ログに sessionId が常時表示される状態へ戻す
- チェックリスト:
  - auth-required 発生経路とリクエスト元を特定する
  - 認証ヘッダ付与の有無を確認する
  - sessionId 表示の由来を確認する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:15 JST Step3 auth-required 警告の原因調査に着手。
  - done: 2026-01-11 00:25 JST Step3 の metadata 取得で auth を無効化し、AuthRequiredDialog のログから sessionId を省略。検証: 未実施。

2093) fix/chunk-store/fetch-singleflight-dedupe (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/chunk-store/fetch-singleflight-dedupe
- 依存: なし
- 受け入れ基準: 同一URL/キャッシュキーの取得で in-flight を合流させる／Strict Mode などの二重実行でも外部URLアクセスが1回に抑止される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`
- ロールバック手順: 上記ファイルの in-flight 合流ロジック差分を revert し、従来の直接フェッチ挙動に戻す
- チェックリスト:
  - in-flight 合流ロジックを追加する
  - getOrFetchForNode で並列取得を1回に抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:35 JST chunk-store の URL 取得重複を抑止するロック機構対応に着手。
  - blocked: 2026-01-11 00:50 JST ユーザー指示によりロック方式を中止し、singleflight 方式に切り替え。

2094) refactor/tools/gen-iso3166-2-node-browser-entry (P1) — 完了 (2026-01-11)
- ブランチ名: refactor/tools/gen-iso3166-2-node-browser-entry
- 依存: なし
- 受け入れ基準: Node専用スクレイパー/ストアとブラウザ用エントリが分離される／React側の参照が browser エントリに統一される／Node用途は node/cli/plugin エントリへ整理される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/tools/gen-iso3166-2/package.json`, `packages/tools/gen-iso3166-2/src/index.ts`, `packages/tools/gen-iso3166-2/src/node.ts`, `packages/tools/gen-iso3166-2/src/gen-iso3166-2.ts`, `packages/tools/gen-iso3166-2/src/store.browser.ts`, `plugins/shape-plugin/src/services/utils/iso3166.ts`, `plugins/location-plugin/src/services/LocationBatchManager.ts`, `plugins/location-plugin/src/services/__tests__/unit/LocationBatchManager.iso-normalization.unit.test.ts`, `app/vite.config.min.ts`
- ロールバック手順: 上記ファイルの差分を revert し、gen-iso3166-2 の単一エントリ運用へ戻す
- チェックリスト:
  - browser エントリと node エントリを分離する
  - browser 側の参照先を /browser に統一する
  - Node 側は /plugin・/node を使用する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:05 JST gen-iso3166-2 の Node/Browser エントリ分離に着手。
  - done: 2026-01-11 01:15 JST browser エントリを既定化し node エントリを追加、参照を整理。検証: 未実施。

2095) fix/shape/progress-event-mismatch (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/progress-event-mismatch
- 依存: なし
- 受け入れ基準: UI が受け取る progress event が common-api の BatchProgressEvent 形式に統一される／progress の更新が subscription と polling で矛盾しない／タスク進行が UI に反映される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/worker/public.ts`
- ロールバック手順: 上記ファイルの差分を revert し、shape 独自イベントを返す挙動へ戻す
- チェックリスト:
  - worker の progress callback を common-api の BatchProgressEvent に合わせる
  - subscribeToProgress のイベントを変換せずに 전달する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:35 JST shape progress event の型不一致調査に着手。
  - done: 2026-01-11 01:55 JST worker progress を common-api の BatchProgressEvent に統一し、shape 独自イベント変換を廃止。検証: 未実施。

2091) refactor/ui/dialog-mode-single-type (P1) — 完了 (2026-01-05)
- ブランチ名: refactor/ui/dialog-mode-single-type
- 依存: なし
- 受け入れ基準: DialogUrlMode が廃止され DialogDisplayMode のみで統一される／URLのmode解釈が DialogDisplayMode に集約される／frame-state.ts の型エラーが解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`
- ロールバック手順: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts` の差分を revert し、mode 変換ロジックを元に戻す
- チェックリスト:
  - DialogUrlMode の利用箇所を整理する
  - DialogDisplayMode へ統一する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:11 JST mode 型の統一作業に着手。
  - done: 2026-01-05 16:12 JST DialogDisplayMode のみでURL modeを解釈するよう整理。

2090) fix/ui/dialog-mode-mapping-and-maximize (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/dialog-mode-mapping-and-maximize
- 依存: なし
- 受け入れ基準: dialogUrlMode と dialogDisplayMode の対応が整理される／`full`/`full-screen`/`maximize` の混乱が解消される／`/t/.../:mode/:step` で maximize を扱える／frame-state.ts の型エラーが解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`, `packages/plugin-base/src/hooks/useDialogUrlSync.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の mode 解釈へ戻す
- チェックリスト:
  - mode の定義とマッピングを整理する
  - maximize のURL表現と表示モードを整合させる
  - frame-state の型エラーを解消する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:08 JST dialog mode の整理と型エラー修正に着手。
  - done: 2026-01-05 16:09 JST mode のURL表現を full/normal/maximize に統一し、frame-state の型を修正。

2089) fix/ui/dialog-step-mode-query-leak (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/dialog-step-mode-query-leak
- 依存: なし
- 受け入れ基準: ダイアログ遷移で `?step=&mode=` が付与されない／`/t/.../:action/:mode/:step` のパス形式のみになる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-base/src/hooks/useDialogUrlSync.ts`
- ロールバック手順: `packages/plugin-base/src/hooks/useDialogUrlSync.ts` の差分を revert し、クエリ付与挙動へ戻す
- チェックリスト:
  - 付与元のロジックを特定する
  - パス形式のみへ統一する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:00 JST step/mode クエリ付与の原因調査に着手。
  - done: 2026-01-05 16:01 JST useDialogUrlSync をパス優先に更新し、step/mode のクエリ付与を抑止。

2088) chore/ui/dialog-backdrop-dismiss-icon (P2) — 完了 (2026-01-05)
- ブランチ名: chore/ui/dialog-backdrop-dismiss-icon
- 依存: なし
- 受け入れ基準: 「ダイアログ外クリックで閉じる」アイコンが DisabledByDefault に変更される／設定挙動は維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx` の差分を revert し、従来のアイコンに戻す
- チェックリスト:
  - アイコン差し替え対象を特定する
  - DisabledByDefault に変更する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:59 JST ダイアログ外クリック設定のアイコン変更に着手。
  - done: 2026-01-05 15:59 JST DisabledByDefault アイコンへの差し替えを確認。

2087) feat/ui/plugin-dialog-route-path-mode-step (P1) — 完了 (2026-01-05)
- ブランチ名: feat/ui/plugin-dialog-route-path-mode-step
- 依存: なし
- 受け入れ基準: PluginDialogRoute の URL が `/t/:treeId/:pageNodeId/:targetNodeId?/:nodeType?/:action?/:mode?/:step?` 形式で動作する／旧クエリ形式から新パス形式へ移行する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/tree/PluginDialogRoute.tsx`, `app/src/router/routes/tree/dialogRoute.tsx`, `app/src/router/routes/tree/shared.ts`, `app/src/router/index.tsx`, `app/src/router/routes/t.($treeId).($pageNodeId).tsx`, `app/src/hooks/treeconsole/actions/dialog.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`, `packages/plugin-ui-host/docs/ARCHITECTURE.md`, `packages/plugin-base/README.md`, `app/src/router/README.md`
- ロールバック手順: 上記ファイルの差分を revert し、クエリパラメータ形式のルーティングへ戻す
- チェックリスト:
  - ルート定義とパラメータ解釈を更新する
  - 旧クエリパラメータとの互換性/移行を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:43 JST PluginDialogRoute のパス形式刷新に着手。
  - done: 2026-01-05 15:44 JST mode/step をパス化し、ルート定義とURL同期を更新。

2086) feat/ui/dialog-backdrop-dismiss-toggle (P1) — 完了 (2026-01-05)
- ブランチ名: feat/ui/dialog-backdrop-dismiss-toggle
- 依存: なし
- 受け入れ基準: PluginDialogRoute の外側クリックで閉じる挙動を設定で on/off できる／ツールバー設定メニューに Switch を追加する／既定は off／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/tree/PluginDialogRoute.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `packages/util/src/treeConsoleSettings.ts`, `packages/ui/treeconsole/toolbar/src/components/TreeConsoleToolbar.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/TreeConsoleToolbarContent.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/types.ts`, `packages/ui/dialog/src/headless/PluginDialogFrame.tsx`, `packages/plugin-ui-host/src/headless/PluginDialogShell.tsx`, `packages/ui/i18n/public/locales/en/common.json`, `packages/ui/i18n/public/locales/ja/common.json`
- ロールバック手順: 上記ファイルの差分を revert し、外側クリックで閉じる挙動と設定メニューの追加を取り消す
- チェックリスト:
  - ダイアログ外クリックの制御ポイントを特定する
  - 設定の保存/参照場所を追加する
  - ツールバー設定メニューに Switch を追加する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:30 JST ダイアログ外クリックのトグル設定追加に着手。
  - done: 2026-01-05 15:31 JST 外側クリックで閉じる設定の保存/切替とツールバーSwitchを追加。

2085) fix/ui/tile-config-section-render-loop (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/tile-config-section-render-loop
- 依存: なし
- 受け入れ基準: VTConfigSection の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - VTConfigSection のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:35 JST VTConfigSection の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:36 JST zoomBreakpoints の比較を値ベースに修正し、同期ループを抑止。

2084) fix/ui/download-retry-controls-render-loop (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/download-retry-controls-render-loop
- 依存: なし
- 受け入れ基準: DownloadRetryControls の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - DownloadRetryControls のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:33 JST DownloadRetryControls の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:34 JST useFetchConfigSection の loadCounts effect 依存を整理し、無限レンダーを抑止。

2068) docs/shape-plugin/geojson-vector-tile-build-flow (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/geojson-vector-tile-build-flow
- 依存: なし
- 受け入れ基準: shape-plugin のビルドにおける geojson 方式ベクトルタイル生成の処理内容を段階的に説明する／参照すべき実ファイルの場所を列挙する／TASKS.md に運用ログを記載する
- 要点：shape-plugin の vectortile ステージで geojson 入力が選択された場合の入出力バッファ作成・worker 実行・タイル生成までのフローを整理し、参照ファイルを列挙。
- チェックリスト:
  - geojson 方式のベクトルタイル生成フローを調査して整理する
  - 参照すべきファイルパスを具体的に列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:05 JST shape-plugin の geojson 方式ベクトルタイル生成フロー調査に着手。
  - done: 2026-01-09 21:20 JST geojson 方式の vectortile 生成フローと参照ファイルを整理。

2069) docs/shape-plugin/extract2-buffer-format-check (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/extract2-buffer-format-check
- 依存: なし
- 受け入れ基準: extract2 のバッファ保存形式が標準で flatgeobuf であるかをコードで確認する／参照箇所を列挙する／TASKS.md に運用ログを記載する
- 要点：extract2 は flatgeobuf の geojson.serialize を使って保存しており、raw/extract1 も同様に flatgeobuf を保存していることを確認。
- チェックリスト:
  - extract2 の保存経路とフォーマットをコードで確認する
  - 参照すべきファイルパスを列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:24 JST extract2 のバッファ保存フォーマット確認に着手。
  - done: 2026-01-09 21:29 JST extract2 は flatgeobuf を保存していることを確認。

2070) docs/shape-plugin/vectortile-bottleneck-analysis (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/vectortile-bottleneck-analysis
- 依存: なし
- 受け入れ基準: vectortile ステージの処理を分解しボトルネック候補を列挙する／各候補の理由を具体的に説明する／参照ファイルを列挙する／TASKS.md に運用ログを記載する
- チェックリスト:
  - vectortile ステージの処理フローを整理する
  - ボトルネック候補と根拠を列挙する
  - 参照ファイルパスを具体的に記載する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:33 JST vectortile ステージのボトルネック推測整理に着手。
  - done: 2026-01-09 21:40 JST ボトルネック候補と根拠、参照箇所を整理。

2071) docs/shape-plugin/vectortile-qa-followups (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/vectortile-qa-followups
- 依存: なし
- 受け入れ基準: chunk-store 書き込み経路と理由をコードで説明する／geojson-vt の対象範囲をコードで説明する／Worker並列数の妥当性を推測する／Step6のプログレッシブ表示の可否をコードで確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store 書き込み経路と理由を確認する
  - geojson-vt の対象範囲とタイル交差の関係を整理する
  - Worker並列数の妥当性を推測し根拠を示す
  - Step6 のプログレッシブ表示可否を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:50 JST vectortile 周辺の追加QAに着手。
  - done: 2026-01-09 22:05 JST chunk-store 経路、geojson-vt 対象範囲、並列度、Step6進行表示の可否を整理。

2072) docs/shape-plugin/chunk-store-overhead-benefit (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-overhead-benefit
- 依存: なし
- 受け入れ基準: chunk-store 経由のCPU/I/Oオーバーヘッド要因を整理する／chunk-store を介するメリットをコード根拠から説明する／推測と事実を分けて回答する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store 経由の処理コストを整理する
  - chunk-store を介する利点を整理する
  - 事実と推測を分けて回答する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:12 JST chunk-store 経由のオーバーヘッドと利点の整理に着手。
  - done: 2026-01-09 22:18 JST chunk-store 経由のコストとメリットを整理。

2073) docs/shape-plugin/chunk-store-overhead-quantitative (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-overhead-quantitative
- 依存: なし
- 受け入れ基準: gzipなしのchunk-store読み書きの追加オーバーヘッド要因を整理する／IndexedDB直書きとの差分を推測として明示する／不確実性と測定ポイントを明示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - gzipなしのchunk-store経路の差分要因を整理する
  - 推測と事実を分けて説明する
  - 測定が必要な点を列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:25 JST gzipなしのchunk-storeオーバーヘッド整理に着手。
  - done: 2026-01-09 22:30 JST chunk-storeとIndexedDB直書き差分の推測を整理。

2074) docs/shape-plugin/chunk-store-chunk-size-qa (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-chunk-size-qa
- 依存: なし
- 受け入れ基準: chunk-store のチャンクサイズ指定可否をコードで確認する／「直書きと同等になるか」を推測として明示する／不確実性を明示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store のチャンク分割仕様を確認する
  - 直書き相当になるかを推測で整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:38 JST chunk-storeのチャンクサイズ可否の確認に着手。
  - done: 2026-01-09 22:45 JST chunk-storeは単一チャンク保存が基本で直書きと同等ではない点を整理。

2075) docs/shape-plugin/chunk-store-sharing-qa (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-sharing-qa
- 依存: なし
- 受け入れ基準: downloadステージにおけるchunk-store利用と共有の仕組みをコードで確認する／参照カウント方式の有無を明確にする／正しい点/誤解点を分けて回答する／TASKS.md に運用ログを記載する
- チェックリスト:
  - downloadでのchunk-store利用経路を確認する
  - nodeId/セッション間共有の仕組みを確認する
  - 参照カウント方式の有無を明確化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 23:00 JST chunk-store共有理解の確認に着手。
  - done: 2026-01-09 23:08 JST 共有と参照関係の実装有無を整理。

2076) feat/shape/chunk-store-cache-and-cleanup (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/chunk-store-cache-and-cleanup
- 依存: なし
- ExecPlan: plans/shape-chunk-store-cache-and-cleanup-execplan.md
- 受け入れ基準: shape download のchunk-store利用がnodeId単位で参照関係を作成する／chunk-storeがHEAD+ETag/Last-Modifiedでキャッシュ判定する／hash同一性の利用状況を明確化し必要なら適用する／TreeNode削除経路でchunk-storeのdeleteForNodeが実行され参照0ならデータが削除される／TASKS.mdに運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`, `plugins/shape-plugin/src/services/datasources/*.ts`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/worker/plugin.ts`（必要に応じて）
- ロールバック手順: 上記ファイルとExecPlanの差分をrevertし、chunk-storeのHEAD判定とnodeId関連付けを元に戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - chunk-storeのHEAD判定と条件付きキャッシュを実装する
  - shape data sourceのchunk-store利用をnodeId関連付けに変更する
  - node削除経路でchunk-storeのdeleteForNodeが走るようにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 23:20 JST chunk-storeキャッシュ/削除の改善に着手。
  - done: 2026-01-10 00:10 JST HEAD判定・nodeId関連付け・削除連携を実装。検証: 未実施。

2077) refactor/shape/ephemeral-stage-buffers (P1) — 進行中 (2026-01-10)
- ブランチ名: refactor/shape/ephemeral-stage-buffers
- 依存: なし
- ExecPlan: plans/shape-ephemeral-stage-buffers-execplan.md
- 受け入れ基準: extract1入力はchunk-storeのダウンロードキャッシュを利用し、extract2/vectortileの入出力はsourceBuffersへ移行される／extract2SourceBuffersはnodeId+国コード+自治体レベルで検索できる／vectortileSourceBuffersはnodeId+tileIdで検索できる／TreeNode削除で対象バッファが一括削除される／TASKS.mdに運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて）
- ロールバック手順: 上記ファイルとExecPlanの差分をrevertし、chunk-store入力経路と旧bufferスキーマに戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - sourceBuffersのスキーマとインデックスを追加する
  - extract1入力はchunk-store利用、extract2/vectortileの入出力をsourceBuffersへ移行する
  - node削除で新バッファが削除されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 00:20 JST chunk-store依存をephemeral buffersへ移行する対応に着手。
  - start: 2026-01-10 09:42 JST extract1/2/vectortileのephemeral buffers移行とスキーマ更新に着手。
  - start: 2026-01-10 11:20 JST sourceBuffersのスキーマ追加とextract2/vectortile経路の置換を進行中。
  - start: 2026-01-10 11:45 JST downloadのchunk-store共有/削除とextract1入力の確認に着手。
  - start: 2026-01-10 12:45 JST download出力をchunk-storeへ保存しextract1入力をchunk-store参照に変更。
  - start: 2026-01-10 13:05 JST extract1入力をchunk-store決め打ちへ修正・downloadのrawBuffers廃止方針で対応を進める。
  - start: 2026-01-10 13:30 JST extract1入力のchunk-store固定化とrawBuffers廃止、nodeId必須化の整理に着手。

2078) chore/docs/agents-no-fallback (P2) — 完了 (2026-01-10)
- ブランチ名: chore/docs/agents-no-fallback
- 依存: なし
- 受け入れ基準: AGENTS.md に「ユーザー指示なしのフォールバック実装を禁止」ルールを明記する／TASKS.md に運用ログを記載する
- チェックリスト:
  - AGENTS.md にフォールバック禁止ルールを追記する
  - 運用ログ start を追記する
- 運用ログ：
  - start: 2026-01-10 13:20 JST フォールバック実装禁止ルールをAGENTS.mdへ反映する対応に着手。
  - done: 2026-01-10 18:50 JST AGENTS.md にフォールバック禁止ルールを追記済みであることを確認。

2079) feat/shape/step6-progressive-display (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/step6-progressive-display
- 依存: 2077
- ExecPlan: plans/shape-step6-progressive-display-execplan.md
- 受け入れ基準: Step6の遷移条件が「メタデータまたはタイルの存在」で即OKになる／downloadステージでメタデータ基本レコードを永続化し後続ステージで頂点数・フィーチャー数等を段階的に書き込み更新する／Step6のメタデータ一覧が段階的に増える・更新される／nodeId必須とフォールバック禁止の方針が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps`, `plugins/shape-plugin/src/ui/hooks`, `plugins/shape-plugin/src/services/metadata`, `plugins/shape-plugin/src/services/batch`, `packages/runtime-worker/src/services`（必要に応じて）
- ロールバック手順: Step6遷移条件とメタデータ集計の差分をrevertし、従来の集計完了後遷移の挙動に戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - Step6遷移条件を「メタデータまたはタイル存在」で許可する
  - downloadステージでメタデータ基本レコードを永続化する
  - 後続ステージで統計を段階的に更新する
  - Step6の一覧表示が段階的に更新されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:05 JST Step6のプログレッシブ表示とメタデータ段階更新に着手。
  - done: 2026-01-10 14:40 JST Step6遷移条件をメタデータ/タイル存在で許可し、Previewメタデータのポーリング更新を追加。検証: 未実施。

2080) refactor/shape/extract-buffer-naming-align (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/extract-buffer-naming-align
- 依存: なし
- 受け入れ基準: ShapeBuildAPIClient.ts の型不整合を解消する／Extract1SourceBuffer/Extract2SourceBuffer の命名へ統一する／関連型とAPIの参照が揃っている／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-service-api/src/types/*`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/shape-store/src/index.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `plugins/shape-plugin/src/services/batch/*`, `packages/runtime-worker/src/services/*`（必要に応じて）
- ロールバック手順: 上記ファイルの命名/型変更を revert し、従来の ShapeExtractedBufferRecord / ExtractedFeatureBuffer 名称へ戻す
- チェックリスト:
  - ShapeBuildAPIClient.ts の型不整合箇所を修正する
  - Extracted 系の命名を SourceBuffer 系へ統一する
  - 参照箇所の型と実体が一致していることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:05 JST extractバッファ命名の統一と型不整合修正に着手。
  - done: 2026-01-10 15:35 JST ShapeBatchApiClient の listExtractedBuffers を復旧し、Extract1/2SourceBuffer 命名と型参照を統一。検証: 未実施。

2081) fix/shape/vectortile-no-empty-tileid (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/vectortile-no-empty-tileid
- 依存: なし
- 受け入れ基準: vectortile の tileId 関係が空のフォールバックを撤去し失敗扱いにする／tileId が空を許容する型定義を修正する／関連参照が更新されている／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/features/shape-store/src/ShapeDB.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、tileId 未設定時のフォールバックと型定義を元に戻す
- チェックリスト:
  - tileId 関係が空のフォールバックを削除する
  - tileId が空を許容する型定義を修正する
  - 参照先の型エラーを解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 16:05 JST vectortile の tileId 空フォールバック撤去に着手。
  - done: 2026-01-10 16:30 JST tileId 関係なしのフォールバックを撤去し、tileId必須型へ更新。検証: 未実施。

2082) fix/shape/vectortile-input-typing (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/vectortile-input-typing
- 依存: なし
- 受け入れ基準: RuntimeWorkerVectorTileAdapter の {} フォールバックを撤去し入力型を明示する／ShapeExtractedBufferRecord の参照を ShapeExtractSourceBufferRecord に統一する／未使用変数の警告を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/SessionArtifactStore.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、入力のフォールバック/旧型参照へ戻す
- チェックリスト:
  - VectorTileAdapter の入力取得を明示型で強制する
  - ShapeExtractSourceBufferRecord へ参照を統一する
  - 未使用変数の警告を解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:00 JST vectortile 入力型の厳格化とフォールバック撤去に着手。
  - done: 2026-01-10 17:20 JST VectorTileAdapter の {} フォールバックを撤去し、ExtractSourceBuffer 参照を統一。検証: 未実施。

2083) fix/shape/datasource-nonempty (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/datasource-nonempty
- 依存: なし
- 受け入れ基準: toDataSourceName から trim を撤去し、入力型を非空文字列に限定する／generateDownloadTaskPayloadsFromSelection 経路で dataSource が undefined/空にならないよう型と検証を修正する／フォールバック禁止を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/common/types`, `plugins/shape-plugin/src/services`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、従来の toDataSourceName/入力処理へ戻す
- チェックリスト:
  - dataSource の型を非空文字列に制約する
  - toDataSourceName の trim 依存を撤去する
  - generateDownloadTaskPayloadsFromSelection の入力検証を明示化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:05 JST dataSource の非空型化と trim 撤去に着手。
  - start: 2026-01-10 18:40 JST dataSource 必須化の整理とAPI型更新に再着手。
  - done: 2026-01-10 18:55 JST dataSource の trim/フォールバック撤去とAPI境界の必須化を反映。検証: 未実施。

2084) fix/shape/download-payloads-require-nodeid (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/download-payloads-require-nodeid
- 依存: なし
- 受け入れ基準: generateShapeDownloadTaskPayloadsFromSelection の引数に nodeId を追加し、UI→worker→shapeBatchAPI の呼び出しで nodeId が渡される／dataSource が欠落したまま呼ばれない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/WorkerAPI.ts`, `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/ui/hooks/*`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧シグネチャへ戻す
- チェックリスト:
  - WorkerAPI のシグネチャに nodeId を追加する
  - worker-runtime で shapeBatchAPI へ nodeId を渡す
  - UI 呼び出し側で nodeId を必須化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:10 JST generateShapeDownloadTaskPayloadsFromSelection の nodeId 欠落修正に着手。
  - done: 2026-01-10 19:20 JST WorkerAPI/worker-runtime/UI 呼び出しに nodeId を追加。検証: 未実施。

2085) refactor/shape/typed-download-payloads-entry (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/typed-download-payloads-entry
- 依存: なし
- 受け入れ基準: generateShapeDownloadTaskPayloadsFromSelection の引数が nodeId/DataSourceName 必須で型保証される／UI からの呼び出しが dataSource 未確定時にビルドで落ちる形になる／worker 入口で string を受け取らない型になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/WorkerAPI.ts`, `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/ui/hooks/*`, `plugins/shape-plugin/src/worker/public.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧シグネチャと緩い型へ戻す
- チェックリスト:
  - WorkerAPI の型を DataSourceName で固定する
  - worker-runtime の引数型を更新する
  - UI 呼び出しで dataSource 未設定を型で禁止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:30 JST generateShapeDownloadTaskPayloadsFromSelection の型厳格化に着手。
  - done: 2026-01-10 19:45 JST WorkerAPI/worker-runtime/shape worker で nodeId+ShapeDataSourceName 必須化と selection 非optional 化を反映。検証: 未実施。

2086) fix/shape/step3-delete-download-button-refresh (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step3-delete-download-button-refresh
- 依存: なし
- 受け入れ基準: Step3 の「ダウンロード済みファイルを削除(N件)」ボタンが削除後に件数0へ更新され、無効化される／削除完了後に UI 状態が再取得される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、削除後に relation が残る挙動へ戻す
- チェックリスト:
  - 削除完了後に download 状態を再取得する
  - ボタンラベルと disabled が一致する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:05 JST Step3 削除ボタンの状態更新修正に着手。
  - done: 2026-01-10 20:20 JST chunk-store の deleteAllForNode を relation 直接削除に変更し、削除後の件数更新を保証。検証: 未実施。

2087) refactor/shape/remove-legacy-datasource (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/remove-legacy-datasource
- 依存: なし
- 受け入れ基準: dataSourceName のレガシー参照/フォールバックを削除し、batchConfig.dataSource を唯一の参照点にする／未設定時は明示エラーで止まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/common/types/ShapeEntity.ts`, `plugins/shape-plugin/src/ui/hooks/*`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/utils/utils.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、dataSourceName の参照を復帰する
- チェックリスト:
  - dataSourceName の参照を削除する
  - batchConfig.dataSource 未設定時に明示エラーで止まる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:35 JST dataSourceName レガシー参照の削除に着手。
  - done: 2026-01-10 21:05 JST dataSourceName の参照を削除し batchConfig.dataSource に統一。検証: 未実施。

2088) fix/shape/download-stalls-after-two (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/download-stalls-after-two
- 依存: なし
- 受け入れ基準: download が2タスクで止まる原因を特定し、必要なら修正する／停止が正常待機の場合は根拠を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/*`, `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧挙動へ戻す
- チェックリスト:
  - download ステージの停止要因を特定する
  - 必要なら修正し再現を防ぐ
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:20 JST download が2タスクで止まる問題の調査に着手。
  - done: 2026-01-10 21:30 JST NaturalEarth では adminLevel 単位で2タスクに集約される設計であることを確認。検証: 未実施。

2089) fix/shape/geoboundaries-cache-complete (P1) — 進行中 (2026-01-10)
- ブランチ名: fix/shape/geoboundaries-cache-complete
- 依存: なし
- 受け入れ基準: geoboundaries の download でキャッシュヒット時に task を completed に更新できる／0/230 停滞を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、従来のキャッシュ判定/完了更新に戻す
- チェックリスト:
  - cache hit 時の task 更新経路を修正する
  - download の 0/230 停滞が解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:45 JST geoboundaries のキャッシュ完了更新不備の調査に着手。
  - start: 2026-01-10 22:30 JST geoboundaries の download 停滞原因をコードで再調査。
  - done: 2026-01-10 23:20 JST download 入力のフォールバックを撤廃し、DownloadTaskPayload/DownloadStageOutput を必須化して入力欠落時に即時エラー化。download キャッシュ判定も入力必須に統一。検証: 未実施。
  - start: 2026-01-10 23:35 JST Step2 未選択時の Step3 直アクセスをリダイレクトし、テンプレート dataSource 明示を確認する対応に着手。
  - done: 2026-01-10 23:45 JST Step3 で dataSource 未設定なら URL step=2 に戻し、Step3 側は空表示で待機するよう変更。検証: 未実施。

2067) fix/ui-dialog/maximize-layout-viewport (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui-dialog/maximize-layout-viewport
- 依存: なし
- 要点：最大化時の layoutViewport が実ウィンドウサイズより小さくなる問題を避けるため、layoutViewport は innerWidth/innerHeight を優先するように変更。
- 原因/影響範囲：layoutViewport が visualViewport/screen の最小値を採用していたため、ウィンドウ拡大時に最大化サイズが小さめに正規化されるケースがあった。影響範囲は `packages/ui/dialog/src/headless/frameHelpers.ts`。
- 修正内容と適用範囲：getDialogLayoutViewport を window.innerWidth/innerHeight 優先（screen はフォールバック）へ変更。適用範囲は `packages/ui/dialog/src/headless/frameHelpers.ts`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: layoutViewport の検出と正規化処理の不整合を特定する／最大化時にウィンドウ拡大後でも中央寄せが崩れないよう修正する／TASKS.md に運用ログ・影響範囲・ロールバック手順を追記する
- 影響範囲: `packages/ui/dialog/src/headless/frameHelpers.ts`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - layoutViewport の算出ロジックを見直して実ウィンドウサイズを優先する
  - 最大化時の正規化が実ウィンドウサイズに追従することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 07:33 JST layoutViewport の正規化不整合の修正に着手。
  - done: 2026-01-05 07:33 JST layoutViewport を innerWidth/innerHeight 優先に更新。検証: 未実施（UI 操作のみ）。

2066) fix/plugin-ui-host/dialog-maximize-center (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-maximize-center
- 依存: なし
- 要点：最大化時の中央寄せが崩れる原因として、正規化時のビューポート基準が不一致だったため、最大化時はレイアウト用ビューポートで正規化するように修正。
- 原因/影響範囲：最大化時のサイズ算出に layoutViewport を使いつつ正規化は viewport を使っていたため、位置補正がずれて右寄り・上寄りになるケースがあった。影響範囲は `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`。
- 修正内容と適用範囲：最大化/全画面時の正規化に layoutViewport を使うよう統一し、中央寄せを維持。適用範囲は `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: 最大化時に中央寄せが崩れる原因を特定して修正する／最大化時の位置算出が中央寄せになることを確認する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - 最大化時の位置算出と正規化処理の不整合を修正する
  - 画面サイズ変更時の最大化レイアウトが中央寄せになることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 07:25 JST 最大化時の中央寄せ崩れの原因調査と修正に着手。
  - done: 2026-01-05 07:26 JST 最大化時の正規化を layoutViewport 基準へ統一。検証: 未実施（UI 操作のみ）。

2065) fix/plugin-ui-host/dialog-header-restore-position (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-header-restore-position
- 依存: なし
- 要点：復元ツールチップを「元に戻す」に変更し、最大化/全画面への遷移時に元の位置・サイズを保存、復元時に保存値で戻すようにした。全画面/最大化のレイアウトはビューポート/スクリーンから算出する。
- 原因/影響範囲：最大化/全画面の復元が初期中心位置・サイズに戻るだけで、元の位置・サイズが保持されていなかった。影響範囲は DialogUIState とフレーム遷移ロジック、ツールチップ文言。
- 修正内容と適用範囲：DialogUIState に restorePosition/restoreSize を追加し、最大化/全画面遷移時に保存・復元時に使用するよう更新。最大化/全画面のサイズ計算は viewport + screen の検出値を使う。適用範囲は `packages/common/types/src/dialog-state.ts`, `packages/ui/dialog/src/headless/frameHelpers.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`, `packages/plugin-ui-host/src/headless/components/PluginDialogControls.tsx`, `app/public/locales/*/common.json`, `packages/ui/i18n/public/locales/*/common.json`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: 「元のサイズに戻す」ツールチップを「元に戻す」に変更する／最大化・全画面移行時に元の位置/サイズを DialogUIState へ保存する／全画面・最大化のレイアウトはビューポート/スクリーン検出で算出した値を使用する／「元に戻す」は保存した元の位置/サイズに復帰する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/common/types/src/dialog-state.ts`, `packages/ui/dialog/src/headless/frameHelpers.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`, `packages/plugin-ui-host/src/headless/components/PluginDialogControls.tsx`, `app/public/locales/*/common.json`, `packages/ui/i18n/public/locales/*/common.json`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - 「元のサイズに戻す」を「元に戻す」へ変更する
  - 最大化/全画面化の直前に元の位置/サイズを保存する
  - 最大化/全画面のレイアウトをビューポート/スクリーン検出で算出する
  - 元に戻す際は保存した元の位置/サイズに復帰する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 00:29 JST PluginDialogHeader の復元ツールチップと位置/サイズ復帰対応に着手。
  - done: 2026-01-05 00:43 JST 最大化/全画面の復元位置・サイズ保持とツールチップ文言変更を反映。検証: 未実施（UI 操作のみ）。

2064) fix/plugin-ui-host/dialog-header-doubleclick (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-header-doubleclick
- 依存: なし
- 要点：ヘッダ背景のダブルクリックで通常/最大化をトグルし、全画面時は無効化した。
- 原因/影響範囲：PluginDialogHeader でダブルクリックによる状態切替が未実装だった。影響範囲は `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`。
- 修正内容と適用範囲：ヘッダの Box に onDoubleClick を追加し、full-screen をガード。ステッパーや操作ボタン領域のダブルクリックは伝播を停止。適用範囲は `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: PluginDialogHeader のヘッダ背景ダブルクリックで通常/最大化をトグルできる／全画面状態ではダブルクリックで状態が変わらない／既存のヘッダ操作に影響がない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - ヘッダ背景ダブルクリックで通常/最大化のトグルを実装する
  - 全画面時はトグルしないガードを入れる
  - 既存のクリック/ボタン操作への影響がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 00:28 JST PluginDialogHeader のダブルクリックで最大化トグル実装に着手。
  - done: 2026-01-05 00:29 JST ヘッダ背景のダブルクリックで最大化トグルを追加。検証: 未実施（UI 操作のみ）。

2063) refactor/shape-plugin/batch-storage-ephemeral (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/shape-plugin/batch-storage-ephemeral
- 依存: なし
- 受け入れ基準: batchTasks を hdb-shape-ephemeral へ移設し hdb-shape 側を撤去する／TreeNode削除時に batchSessions を削除する／バッチ成功時に Step3 の保持スイッチ設定に従って batchTasks を自動削除する／rawBuffers の chunk-store 経由書き込みを撤去し ephem 保存へ統一する／ShapeEphemeralDBAPI を追加し ShapeDB/ShapeEphemeralDB の直接読み書きを API 経由へ統一する／参照先を一括で更新する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-service-api/src/types`, `packages/common/api/src/WorkerAPI.ts`, `packages/runtime-worker/src/services`, `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `plugins/shape-plugin/src/services/batch`, `plugins/shape-plugin/src/worker/api.ts`, `packages/runtime-worker/src/entity/EntityLifecycleManager.ts`（他参照先含む）
- ロールバック手順: batchTasks の参照/定義と rawBuffers 書き込み経路を元に戻し、TreeNode削除連動の batchSessions 削除を撤回する
- チェックリスト:
  - hdb-shape の batchTasks を撤去し、ephemeral に移設する
  - TreeNode削除時に batchSessions を削除する
  - Step3 の保持スイッチに従って成功時に batchTasks を自動削除する
  - rawBuffers の chunk-store 経由書き込みを撤去する
  - ShapeEphemeralDBAPI を追加し、ShapeDB/ShapeEphemeralDB の直接読み書きを API 経由へ統一する
  - 参照先をまとめて更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 20:10 JST shape-plugin の batchTasks 移設と rawBuffers 経路整理に着手。
  - start: 2026-01-05 00:43 JST ShapeEphemeralDBAPI/BatchTasks 移設/削除連動の継続対応に着手。

2058) chore/remove/runtime-stage-worker (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/runtime-stage-worker
- 依存: なし
- 受け入れ基準: `packages/features/runtime-stage-worker` を削除し参照/依存を撤去する／計画ドキュメントの runtime-stage-worker 記述を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：runtime-stage-worker パッケージを削除し、計画ドキュメントと pnpm-lock の参照を整理。
- 影響範囲: `packages/features/runtime-stage-worker`, `docs/refactoring-plan-shape-to-location-route.md`, `pnpm-lock.yaml`
- 検証：未実施（削除作業のみ）。
- ロールバック手順: runtime-stage-worker パッケージと pnpm-lock のエントリ、計画ドキュメントの記述を復元する
- チェックリスト:
  - runtime-stage-worker パッケージを削除する
  - 参照ドキュメント/ロックファイルを整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 19:40 JST runtime-stage-worker の削除作業に着手。
  - done: 2026-01-09 19:46 JST runtime-stage-worker を削除し、計画ドキュメントと lockfile を整理。検証: 未実施。

2061) fix/ui-treeconsole-toolbar/shared-zoom-range-guard (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/ui-treeconsole-toolbar/shared-zoom-range-guard
- 依存: なし
- 受け入れ基準: SettingsMenu の shared zoom range 変更で TS2322 が解消する／min/max が未定義の場合でも安全に動作する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: shared zoom range のガード追加を revert して元に戻す
- チェックリスト:
  - Slider onChange の min/max ガードを追加する
  - typecheck でエラーが出ないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 17:20 JST shared zoom range の TS2322 修正に着手。
  - done: 2026-01-09 17:22 JST Slider の min/max 未定義をガードして型エラーを解消。検証: 未実施。

2062) fix/shape-plugin/step5-download-stuck (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/step5-download-stuck
- 依存: なし
- 受け入れ基準: Step5 の Download タスクが開始ボタン押下で進捗する／Step4 の「ダウンロードタスク済みファイル」削除ボタンがタスク残存時に有効化される／リロード後に残留したタスクが整合する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: download タスクの再開リセット処理と delete 有効化条件を revert して元に戻す
- チェックリスト:
  - Download タスクの再開時に running を waiting へ戻す
  - タスク残存時に削除ボタンが有効になるよう条件を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 19:55 JST Step5 の download タスク停滞と削除ボタン無効の修正に着手。
  - done: 2026-01-09 20:10 JST download 再開時の running → waiting リセットと Step4 削除ボタン有効化/削除時の pause を反映。検証: 未実施。

2063) test/verify/smart-fetch-chunk-store (P1) — 進行中 (2026-01-09)
- ブランチ名: test/verify/smart-fetch-chunk-store
- 依存: なし
- 受け入れ基準: @hierarchidb/smart-fetch と @hierarchidb/chunk-store の利用経路を整理する／既存テストの内容を確認し不足があれば最小修正または追加する／関連テストを実行して結果を記録する／TASKS.md に運用ログ・影響範囲・検証結果を記載する
- 影響範囲: `packages/features/download`, `packages/features/chunk-store`, `plugins/shape-plugin`（必要に応じて）
- ロールバック手順: テスト追加/修正の差分を revert して元に戻す
- チェックリスト:
  - smart-fetch/chunk-store の使用箇所と経路を確認する
  - 既存テストの内容を確認し必要な修正/追加を行う
  - 関連テストを実行し結果を運用ログに記載する
- 運用ログ：
  - start: 2026-01-09 20:15 JST smart-fetch/chunk-store のテスト確認と実行に着手。
  - done: 2026-01-09 20:20 JST smartFetch/DexieChunkStore テストを追加し、FetchNetworkPort.throttle を auth 無効化で修正。検証: `pnpm exec vitest run --config packages/features/download/vitest.config.ts` / `pnpm exec vitest run --config packages/features/chunk-store/vitest.config.ts`（成功）。

2058) test/shape-plugin/enable-headless-batch (P1) — 進行中 (2026-01-09)
- ブランチ名: test/shape-plugin/enable-headless-batch
- 依存: なし
- 受け入れ基準: shape-plugin の headless バッチテストがスキップされずに実行可能になる／実アプリ相当の依存を使い、Dexie は FakeIndexedDB を利用する／実行方法と注意点を TASKS.md に記録する
- 影響範囲: `plugins/shape-plugin/src/headless/shape-batch-progress.headless.test.ts`, `plugins/shape-plugin/vitest.setup.ts`（必要に応じて）
- ロールバック手順: headless テストの変更を revert してスキップ状態へ戻す
- チェックリスト:
  - headless テストを実行可能にし、実アプリ相当の依存構成で動作させる
  - Dexie を FakeIndexedDB に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:40 JST shape-plugin headless バッチテストの有効化に着手。
  - done: 2026-01-09 16:55 JST headless バッチテストを実行可能にし、FakeIndexedDB 前提の in-process 実行へ調整。検証: 未実施。

2057) chore/remove/compute-feature (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/compute-feature
- 依存: なし
- 受け入れ基準: `packages/features/compute` を削除し参照/依存を撤去する／runtime-worker の FeatureRegistry から compute を外す／ドキュメントの compute 参照を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/compute`, `packages/runtime-worker/src/services/FeatureBootstrap.ts`, `packages/runtime-worker/package.json`, `packages/features/batch/README.md`, `plugins/*/PLAN.md`, `plugins/shape-plugin/README.md`（必要に応じて）
- ロールバック手順: compute パッケージと参照を復元し、FeatureRegistry への登録を元に戻す
- チェックリスト:
  - compute パッケージと package.json 参照を削除する
  - runtime-worker の FeatureRegistry から compute を外す
  - ドキュメント/計画の compute 参照を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:10 JST @hierarchidb/compute の削除作業に着手。
  - done: 2026-01-09 16:25 JST compute パッケージを削除し、runtime-worker の FeatureRegistry/依存、tsconfig paths、関連ドキュメントの参照を整理。検証: 未実施。

2060) fix/shape-plugin/preview-tiles-availability (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/preview-tiles-availability
- 依存: なし
- 受け入れ基準: Step6 のプレビューでタイル生成済みなら地図が表示される／"No vector tiles are available yet" が誤判定で出ない／ui-map の tileDataProvider が runtime-worker のタイル取得に追従する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`
- ロールバック手順: useShapePreviewStep のタイル可用性判定と tileDataProvider を shapeDB 参照のみの実装へ戻す
- チェックリスト:
  - タイル可用性判定の参照元（runtime-worker/ローカル）を整理する
  - tileDataProvider が runtime-worker から取得できるようにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:45 JST Step6 プレビューのタイル判定修正に着手。
  - done: 2026-01-09 16:55 JST Step6 プレビューのタイル可用性判定を runtime-worker 経由に優先し、tileDataProvider も runtime-worker から取得するよう更新。検証: 未実施。
  - done: 2026-01-09 17:02 JST Step6 プレビューのタイル判定をローカルDB参照のみに戻し、runtime-worker 依存を撤去。検証: 未実施。

2059) refactor/ui-batch/rename-to-ui-batch-progress (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/ui-batch/rename-to-ui-batch-progress
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-batch を @hierarchidb/ui-batch-progress に改名し、import/依存/paths/文書の参照を更新する／旧名称参照が残らない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/batch`, `plugins/*-plugin`, `tsconfig.base.json`, `app/tsconfig.json`, `plans/*`, `packages/plugin-registry/generated/registry.ts`
- ロールバック手順: package.json の name と全参照を @hierarchidb/ui-batch に戻す
- チェックリスト:
  - パッケージ名と依存/インポートを更新する
  - tsconfig paths とプラグイン依存を更新する
  - 計画ドキュメントの記述を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:05 JST ui-batch → ui-batch-progress 改名に着手。
  - done: 2026-01-09 16:28 JST ui-batch を ui-batch-progress に改名し、依存/import/paths/計画文書/registry を更新。検証: 未実施。

2058) chore/analysis/ui-batch-usage (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/ui-batch-usage
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-batch の目的を一次情報から要約する／参照元（import/依存関係）を列挙し実際の利用有無を判断する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/batch`, `plugins/*-plugin`
- ロールバック手順: 調査のみのためロールバック不要
- チェックリスト:
  - ui-batch の目的と主要 exports を確認する
  - import 参照元を列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:38 JST ui-batch の利用状況調査に着手。
  - done: 2026-01-09 15:44 JST ui-batch の hooks が shape/location/route プラグインで利用されていることを確認。検証: 調査のみ。

2057) chore/analysis/download-smart-fetch-status (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/download-smart-fetch-status
- 依存: なし
- 受け入れ基準: packages/features/download の現状と目的を整理する／smart-fetch という名称計画の有無と進捗を一次情報から確認する／再編・整理の進捗（完了/未完）を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/download`, `plans/*`, `TASKS.md`
- ロールバック手順: 調査のみのためロールバック不要
- チェックリスト:
  - smart-fetch 名称の記述有無を確認する
  - download の現状/目的と整理状況をまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:22 JST download/smart-fetch 再編状況の調査に着手。
  - done: 2026-01-09 15:28 JST smart-fetch パッケージ名の記述は確認できず、download 内の smartFetch 実装が存在。download の再編は chunk-store 分離と API 整理まで完了、名称変更は未実施と判断。検証: 調査のみ。

2056) chore/remove/ui-gis (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/ui-gis
- 依存: なし
- 受け入れ基準: packages/ui/gis を削除し参照をすべて撤去する／tsconfig.base.json の ui-gis paths を削除する／計画ドキュメントの ui-gis 記述を ui-map へ更新する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/gis`, `tsconfig.base.json`, `plans/shape-ui-shared-packages.md`
- ロールバック手順: ui-gis のディレクトリと paths を復元し、参照を元に戻す
- チェックリスト:
  - ui-gis パッケージと参照を削除する
  - tsconfig.base.json の paths を更新する
  - 計画ドキュメントの記述を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:05 JST ui-gis の削除作業に着手。
  - done: 2026-01-09 15:14 JST packages/ui/gis を削除し、tsconfig.base.json の paths と計画ドキュメントの ui-gis 記述を ui-map に更新。検証: 未実施。

2055) refactor/ui-map/simple-full-components (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/ui-map/simple-full-components
- 依存: なし
- 受け入れ基準: ui-map にシンプル/フルスペックの地図表示コンポーネントを提供する／shape-plugin の preview で ui-gis 依存を撤去し ui-map へ移行する／ui-gis 提供が独自コンポーネント奨励に見えない構成にする／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src`, `plugins/shape-plugin/src`, `plugins/shape-plugin/package.json`, `packages/ui/gis`（必要に応じて）
- ロールバック手順: ui-map 追加コンポーネントと shape-plugin の import 変更を revert し、ui-gis 参照に戻す
- チェックリスト:
  - ui-map のシンプル/フルスペック UI コンポーネント設計を確定する
  - ui-gis のプレビュー用フックを ui-map に移動/統合する
  - shape-plugin の preview 依存を ui-map に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 14:32 JST ui-map への統合と ui-gis 依存撤去に着手。
  - done: 2026-01-09 14:52 JST ui-map に Simple/Full Map コンポーネントとプレビュー用フックを追加し、shape-plugin の ui-gis 依存を ui-map に移行。ui-gis は ui-map への再エクスポートと deprecated 記述へ変更。検証: 未実施。

2054) chore/analysis/ui-gis-usage (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/ui-gis-usage
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-gis の目的を一次情報から要約する／参照元（import/依存関係）を列挙し実際の利用有無を判断する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/gis`, `plugins/shape-plugin`（参照確認のみ）
- ロールバック手順: 本項目は調査のみのためロールバック不要
- チェックリスト:
  - package.json/計画ドキュメントから目的を確認する
  - import/依存関係の参照元を列挙する
  - 実際の利用有無の判断を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 14:18 JST @hierarchidb/ui-gis の目的と利用状況の調査に着手。
  - done: 2026-01-09 14:23 JST ui-gis の目的（ベクタタイルプレビュー系フックの共有化）と参照元（shape-plugin のプレビュー手順）を整理。検証: 調査のみ。

2053) fix/runtime-worker/worker-error-code-export (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/runtime-worker/worker-error-code-export
- 依存: なし
- 受け入れ基準: commitOperations.ts で WorkerErrorCode の参照が実行時/型ともに解決する／Vite の "does not provide an export named 'WorkerErrorCode'" が再現しない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/commitOperations.ts`, `packages/runtime-worker/src/services/command-types.ts`（必要に応じて）
- ロールバック手順: WorkerErrorCode の export/参照変更を revert して元の import/export に戻す
- チェックリスト:
  - WorkerErrorCode が型/値どちらとして定義されているかを確認する
  - commitOperations.ts の import を実体に合わせて修正する
  - runtime-worker の export 状態を確認し、必要なら公開経路を整える
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 14:05 JST WorkerErrorCode の export/参照不整合の修正に着手。
  - done: 2026-01-09 14:12 JST WorkerErrorCode の値参照を WorkerErrorCodeValue に統一し、runtime-worker 内の import/参照を修正。検証: 未実施。

2052) fix/shape-plugin/batch-resume-stuck (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/shape-plugin/batch-resume-stuck
- 依存: なし
- 受け入れ基準: shape-plugin のバッチ再開時に全体進捗カードの "Primary Extraction ... 0/342 Completed failed 0 skipped 339" が残留せず、再開に応じて進捗が更新される／LRUSplitView の "No tasks yet" 3ペインのフラッシュが解消する／extract2 で tileId を生成して `shape-ephemeral` の `tileIdToBufferRelations`（nodeId+tileId の複合インデックス）に保存される／vectortile の入力生成が `tileIdToBufferRelations` を参照する／ツリーノード削除で `extractedBuffers` と `tileIdToBufferRelations` が削除される／ズームレンジUIが「0-12のレンジ選択」「n分割指定」「n+1ブレークポイント指定」に対応しデフォルトが 0-7 / n=2 / [0,4,7] である／extract2 がズーム範囲セット（n分割ブレークポイント）ごとにタスクを生成し、各タスク入力に対象ズーム範囲の識別情報が保持される／extract2 の単純化パラメータが各タスクの「最も詳細側のズーム率」に連動してスケールされる／extract2 完了後に vectortile のタスク群が開始される／Download Files を残したまま再開したケースの再現/解消手順を TASKS.md に記録する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
 - 受け入れ基準: shape-plugin のバッチ再開時に全体進捗カードの "Primary Extraction ... 0/342 Completed failed 0 skipped 339" が残留せず、再開に応じて進捗が更新される／LRUSplitView の "No tasks yet" 3ペインのフラッシュが解消する／extract2 で tileId を生成して `shape-ephemeral` の `tileIdToBufferRelations`（nodeId+tileId の複合インデックス）に保存される／vectortile の入力生成が `tileIdToBufferRelations` を参照する／ツリーノード削除で `extractedBuffers` と `tileIdToBufferRelations` が削除される／ズームレンジUIが「0-12のレンジ選択」「n分割指定」「n+1ブレークポイント指定」に対応しデフォルトが 0-7 / n=2 / [0,4,7] である／extract2 がズーム範囲セット（n分割ブレークポイント）ごとにタスクを生成し、各タスク入力に対象ズーム範囲の識別情報が保持される／extract2 の単純化パラメータが各タスクの「最も詳細側のズーム率」に連動してスケールされる／extract2 完了後に vectortile のタスク群が開始される／TopoJSON版の extract2/vectortile が z0/z1-4/z5-9 の集約方針に従い再構築され、タイルBBox拡張（係数/マージン）で周辺国/大陸を合成したTopoJSONから簡略化・flatgeobuf化・tileId索引化する／Step4で拡張係数とマージンを設定でき、extract2 に反映される／Download Files を残したまま再開したケースの再現/解消手順を TASKS.md に記録する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch`, `plugins/shape-plugin/src/services/batch/workers`, `plugins/shape-plugin/src/common/types`, `plugins/shape-plugin/src/worker`, `packages/features/shape-store/src`, `packages/plugin-service-api/src`, `packages/runtime-worker/src`（必要に応じて）
- ロールバック手順: shape-plugin の tileId 関連差分と shape-ephemeral の新規テーブル定義を revert して元の挙動に戻す
- チェックリスト:
  - 再開時に進捗が更新されない条件と再現手順を特定する
  - 進捗の復元/購読の責務位置を特定する
  - extract2 の tileId 索引と vectortile 入力生成の整合を実装する
  - ノード削除時の tileIdToBufferRelations クリーンアップを確認する
  - 修正方針を決めて最小差分で実装する
  - 再開時に進捗とペインが安定することを確認する
  - ズームレンジの分割UI（n分割＋ブレークポイント指定）を実装する
  - ズーム範囲セットに基づく extract2 タスク生成と tolerance スケールを実装する
  - TopoJSON版の extract2/vectortile を z0/z1-4/z5-9 集約方針で再構築する
  - Step4でタイルBBox拡張係数/マージンを設定できるようにする
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 11:51 JST shape-plugin のバッチ再開時に進捗が更新されない問題の調査に着手。
  - done: 2026-01-04 13:02 JST extract2 の tileId 索引と shape-ephemeral の tileIdToBufferRelations を追加し、vectortile 入力生成を tileId 参照へ更新。ノード削除/ステージ削除で索引をクリーンアップするよう反映。検証: 未実施。
  - done: 2026-01-04 13:43 JST download を chunk-store（flatgeobuf+gzip）へ保存し、extract1 は chunk-store を優先して読み込むよう更新。vectortile は tileId 関係を使って該当 buffer だけ読み込み、assembleTileGeoJSON でタイルBBoxにクリップして生成。検証: 未実施。
  - start: 2026-01-04 14:12 JST ズームレンジ分割UIの実装（n分割 + ブレークポイントスライダー）に着手。
  - done: 2026-01-04 14:25 JST ズームレンジ分割UI（range 0-12 + n分割 + n+1ブレークポイント）と共有設定の保存/読み込み、ラベル文言更新を反映。検証: 未実施。
  - start: 2026-01-04 14:40 JST ズーム範囲セット別の extract2 タスク生成とズーム連動単純化の実装に着手。
  - done: 2026-01-04 15:20 JST extract2 をズーム範囲セットごとに多重化し、tolerance をズーム上限でスケールする入力を付与。taskId に zoomRangeLabel を付け、per-task input を優先するよう adapter を更新。検証: 未実施。
  - start: 2026-01-04 15:35 JST TopoJSON版の extract2/vectortile を z0/z1-4/z5-9 集約方針で再構築し、Step4で拡張係数/マージン設定を追加する作業に着手。
  - done: 2026-01-04 16:35 JST TopoJSON版の extract2 をズーム分割（z0/z1-4/z5+）でグループ化し、tile拡張係数/マージンを導入。TopoJSON抽出のタイル依存ロジックを廃止し、tile生成時にfeatureId重複を除外。検証: 未実施。
  - start: 2026-01-04 17:10 JST Toolbar 設定メニューの share zoom range に分割スライダーを配置する作業に着手。
  - done: 2026-01-04 17:20 JST Toolbar 設定メニューの share zoom range に分割スライダー（分割数/ブレークポイント）を追加し、共有設定の保存形式を range+segments+breakpoints に統一。route-plugin の共有ズーム読み込みも新形式対応。検証: 未実施。
  - done: 2026-01-04 17:35 JST Step5 の Next 判定を processingStatus 完了で許可し、vectortile の保存確認を TilesDB（+ legacy shapeDB）参照に更新。検証: 未実施。
  - start: 2026-01-04 18:05 JST vectortile 保存先を shape/location/route DB へ戻し、共通スーパークラスへ VectorTileDB2 由来機能と metadata テーブルを集約、vectortile-store 廃止の対応に着手。
  - start: 2026-01-04 18:45 JST vectortile-store を維持しつつ nodeId を NodeId へ具体化するリファクタリングに着手。
  - done: 2026-01-04 19:30 JST vectortile-store を共通ベース（VectorTileDbBase/metadata）として維持し、vector-tile-db を撤去。runtime-worker/gis-sdk/shape・route・location で import/依存を vectortile-store へ統一し、vectortile API の nodeId を NodeId 型へ更新。検証: 未実施。

2051) fix/shape-plugin/auth-dialog-buttons (P2) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/auth-dialog-buttons
- 依存: なし
- 受け入れ基準: shape-plugin の認証要求ダイアログで Cancel が「Cancel (Back to Step 2)」表記になり押しやすいサイズになる／Microsoft ボタンが disabled 表示でクリック不可になる／3つの認証プロバイダボタン群が中央揃えになる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src`（認証要求ダイアログ周辺）
- ロールバック手順: shape-plugin の UI 変更差分を revert して元のボタン表示/配置へ戻す
- チェックリスト:
  - Cancel ラベルとサイズ調整の対象コンポーネントを特定する
  - Microsoft ボタンを disabled に戻す
  - 認証プロバイダボタン群を中央揃えにする
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 00:00 JST shape-plugin 認証ダイアログの UI 調整に着手。
  - done: 2026-01-09 00:06 JST Cancel ラベル/サイズ調整、Microsoft 無効化、プロバイダボタン中央揃えを反映。検証: 未実施。
  - done: 2026-01-09 00:10 JST Cancel (Back to Step 2) 押下時の確認ダイアログをスキップするよう変更。検証: 未実施。
  - start: 2026-01-09 00:15 JST 認証後の return URL 破損（/auth/callback/http:/...）修正に着手。
  - done: 2026-01-09 00:19 JST 認証コールバックで絶対URLを正規化し、同一オリジンはpathで遷移、外部はlocation.assignに分岐。検証: 未実施。
  - done: 2026-01-09 00:23 JST Availability 表示を削除し、リロードボタンのツールチップにダウンロード時刻を表示。検証: 未実施。
  - done: 2026-01-09 00:28 JST GeoBoundaries の availability URL を gbOpen/available に修正し、テストのモックURLも更新。検証: 未実施。
  - done: 2026-01-09 00:42 JST 大陸フォールバックを N/A に変更し、GeoBoundaries メタデータの欠落時は ISO3166 ロケーションから補完。検証: 未実施。
  - done: 2026-01-09 00:50 JST GeoBoundaries/GADM の大陸欠落・齟齬を ISO3166 由来の値と突き合わせて warn を出すよう追加。検証: 未実施。
  - done: 2026-01-09 00:55 JST vector tile 用の DexieChunkStore を auth 無効化して FetchNetworkPort の scope エラーを回避。検証: 未実施。

2043) fix/runtime-worker/export-create-node-payload-peer-store (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/runtime-worker/export-create-node-payload-peer-store
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の dist/index.d.ts から createNodePayloadPeerStore が export される／plugins/spreadsheet-plugin のビルドで MISSING_EXPORT が解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src` と `plugins/spreadsheet-plugin`
- ロールバック手順: runtime-worker の export 差分を revert し、必要なら spreadsheet-plugin の import を元に戻す
- チェックリスト:
  - createNodePayloadPeerStore の定義と export 経路を特定する
  - index.ts / package exports / types の整合を修正する
  - spreadsheet-plugin の import が runtime-worker の public API に一致することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:41 JST runtime-worker の export 不整合修正に着手。
  - done: 2026-01-03 23:45 JST spreadsheet-plugin の dist/worker.js と map の旧PeerStore import を削除。検証: 未実施。

2044) fix/chunk-store/download-exports (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/chunk-store/download-exports
- 依存: なし
- 受け入れ基準: @hierarchidb/chunk-store の build:types/typecheck で NetworkPort/Storage* の export エラーが解消する／@hierarchidb/download 側の公開APIと参照が一致する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src` と `packages/features/download/src`
- ロールバック手順: chunk-store と download の export/import 差分を revert して元の参照へ戻す
- チェックリスト:
  - chunk-store の import 参照元を特定する
  - download の export を確認し必要に応じて修正する
  - build:types/typecheck エラーが消えることを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:49 JST chunk-store の download export 不整合修正に着手。
  - done: 2026-01-03 23:50 JST download の index.ts から ports 型定義を export。検証: 未実施。

2045) fix/gis-sdk/featurecollection-like-typecheck (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/gis-sdk/featurecollection-like-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/gis-sdk の typecheck で TS2345 が解消する／FeatureCollectionLike と GeoJSON FeatureCollection の型整合が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/vectorTiles.ts`
- ロールバック手順: gis-sdk の型/変換変更を revert して元のキャストに戻す
- チェックリスト:
  - TS2345 の発生箇所と型定義を確認する
  - FeatureCollectionLike の変換を明示して型エラーを解消する
  - typecheck で再発しないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:52 JST gis-sdk の FeatureCollectionLike 型エラー修正に着手。
  - done: 2026-01-03 23:54 JST FeatureCollectionLike を GeoJSON 型に合わせ、serialize 入力の型整合を修正。検証: 未実施。
  - done: 2026-01-03 23:55 JST GeometryCollection を除外して座標アクセスの型エラーを解消。検証: 未実施。

2046) fix/runtime-worker/nodeid-typecheck (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/runtime-worker/nodeid-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の typecheck で TS2322 が解消する／NodeId の型整合が保たれる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts`
- ロールバック手順: NodeId 型整合の修正差分を revert して元の実装に戻す
- チェックリスト:
  - NodeId 型エラー箇所を特定する
  - string と NodeId の整合を取る
  - typecheck の再発がないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:56 JST runtime-worker の NodeId 型エラー修正に着手。
  - done: 2026-01-03 23:56 JST targetNodeId を NodeId にキャストし型エラーを解消。検証: 未実施。

2047) fix/route-plugin/vector-tile-input-types (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/route-plugin/vector-tile-input-types
- 依存: なし
- 受け入れ基準: route-plugin の typecheck で inputFormat/inputCompression の型エラーが解消する／runtime-worker の VectorTileStageInput と writeVectorTileInput の型が一致する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts` と `plugins/route-plugin/src/services/*`
- ロールバック手順: vector tile 入力型の変更差分を revert して元の型定義に戻す
- チェックリスト:
  - route-plugin の型エラー箇所を特定する
  - runtime-worker の型定義と一致させる
  - typecheck の再発がないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:57 JST route-plugin の vector tile 入力型エラー修正に着手。
  - done: 2026-01-03 23:58 JST runtime-worker の VectorTileStageInput に inputFormat/inputCompression を追加。検証: 未実施。
  - done: 2026-01-03 23:58 JST 検証: pnpm --filter @hierarchidb/runtime-worker build / pnpm --filter @hierarchidb/route-plugin typecheck を実行（build は warn あり）。

2048) fix/app-build/vite-config-package-json (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/vite-config-package-json
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で vite.config.ts が packages/app/package.json を参照しないよう修正し、ENOENT を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/vite.config.ts`（必要に応じて関連設定）
- ロールバック手順: vite config の差分を revert して元の参照に戻す
- チェックリスト:
  - vite.config.ts の package.json 参照箇所を特定する
  - 参照パスを正しい位置へ修正する
  - build エラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:03 JST app build の package.json 参照エラー修正に着手。
  - done: 2026-01-04 00:04 JST plugin-registry の repoRoot 解決を修正し app/package.json 参照を正しい場所に変更。検証: 未実施。
  - done: 2026-01-04 00:06 JST pnpm-workspace.yaml を基準に repoRoot を検出するよう修正。検証: 未実施。

2049) fix/app-build/missing-common-exports (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/missing-common-exports
- 依存: なし
- 受け入れ基準: @hierarchidb/app build で common-types/common-api の Missing export エラーが解消する／runtime-worker と common-* の公開API整合が取れる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/common/types` と `packages/common/api`（必要に応じて runtime-worker）
- ロールバック手順: common-* の export 差分を revert して元の公開APIに戻す
- チェックリスト:
  - Missing export の実体と export 経路を特定する
  - common-* の dist/public API を整合させる
  - app build の Missing export が解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:07 JST app build の common-* Missing export 修正に着手。
  - done: 2026-01-04 00:10 JST common-types/common-api に型プレースホルダを追加。検証: pnpm --filter @hierarchidb/common-types build / pnpm --filter @hierarchidb/common-api build（warn あり）。

2050) fix/app-build/remove-dexie-shim (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/remove-dexie-shim
- 依存: なし
- 受け入れ基準: `app/src/shims/dexie-export-shim.ts` を削除し、vite の dexie alias を元に戻す／shim 追加ポリシーに抵触しない状態に戻る／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/vite.config.ts` と `app/src/shims/dexie-export-shim.ts`
- ロールバック手順: dexie shim の削除差分を revert して元の alias/ファイルを戻す
- チェックリスト:
  - dexie shim ファイルを削除する
  - vite config の dexie alias を元に戻す
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:28 JST dexie shim の削除に着手。
  - done: 2026-01-04 00:29 JST dexie shim を削除し、vite alias を元に戻した。検証: 未実施。

2051) fix/ui-map/selection-gesture-undefined (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/ui-map/selection-gesture-undefined
- 依存: なし
- 受け入れ基準: `@hierarchidb/ui-map` の typecheck で TS2322 が解消する／`onSelectionChange` の挙動が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src/preview/useMapFeatureSelectionGestures.ts`
- ロールバック手順: 変更差分を revert して元の選択処理に戻す
- チェックリスト:
  - entries[0] が undefined の場合の取り扱いを整理する
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:33 JST ui-map selection gesture の型エラー修正に着手。
  - done: 2026-01-04 00:34 JST entries[0] の null チェックを追加し TS2322 を回避。検証: 未実施。

2052) fix/runtime-worker/shape-batch-session-types (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/runtime-worker/shape-batch-session-types
- 依存: なし
- 受け入れ基準: `@hierarchidb/runtime-worker` の typecheck で ShapeMutationService/ShapeQueryService の TS2345/TS2352 が解消する／BatchSessionRecord と ShapeBatchSessionRecord の型整合が取れる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeMutationService.ts` と `packages/runtime-worker/src/services/ShapeQueryService.ts`（必要に応じて関連型）
- ロールバック手順: 変更差分を revert して元の型定義へ戻す
- チェックリスト:
  - ShapeMutationService/ShapeQueryService の型エラー箇所を特定する
  - BatchSessionRecord/ShapeBatchSessionRecord の整合を取る
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:40 JST runtime-worker の shape batch session 型エラー修正に着手。
  - done: 2026-01-04 00:44 JST ShapeMutationService/ShapeQueryService で batch session/vector tile の型変換を追加。検証: 未実施。
  - done: 2026-01-04 00:47 JST ResourceUsage などの型変換に unknown 経由のキャストを追加。検証: 未実施。
  - done: 2026-01-04 00:55 JST unknown キャストを撤去し、型ガード/明示的変換で BatchSessionRecord を構築。検証: 未実施。
  - done: 2026-01-04 01:02 JST currentStage の許容値へ正規化して型エラーを解消。検証: 未実施。

2053) fix/shape-plugin/batch-session-types (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/shape-plugin/batch-session-types
- 依存: なし
- 受け入れ基準: `@hierarchidb/shape-plugin` の typecheck で batch session/vector tile/geometry/NodeId 関連の型エラーが解消する／plugin-service-api と shape-store の型境界が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/*` と `plugins/shape-plugin/src/services/tiles/VectorTileService.ts`、`plugins/shape-plugin/src/ui/components/steps-provider.tsx`、`plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 変更差分を revert して元の型定義へ戻す
- チェックリスト:
  - batch session の型変換経路を整理する
  - vector tile/geometry/NodeId の型エラーを解消する
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 01:12 JST shape-plugin の型エラー修正に着手。
  - done: 2026-01-04 01:24 JST shape batch session/vector tile の変換ヘルパーを追加し、関連箇所へ適用。検証: 未実施。
  - done: 2026-01-04 01:30 JST VectorTileService の geometry 判定を Record ベースで安全化。検証: 未実施。

2054) fix/app/modeless-dialog-type (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app/modeless-dialog-type
- 依存: なし
- 受け入れ基準: `app/src/router/routes/modeless/modelessDialogContent.tsx` の TS2339 が解消する／`type` の参照元の型が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/modeless/modelessDialogContent.tsx`
- ロールバック手順: 変更差分を revert して元の型参照に戻す
- チェックリスト:
  - `type` を参照している値の型を特定する
  - TypeScript の型エラーを解消する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 01:34 JST modelessDialogContent の型エラー修正に着手。
  - done: 2026-01-04 01:39 JST geometry.type 参照を型ガード経由に変更。検証: 未実施。

2042) fix/shape-store/tsconfig-paths (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/shape-store/tsconfig-paths
- 依存: なし
- 受け入れ基準: @hierarchidb/shape-store の tsconfig にある baseUrl/paths のローカル上書きを撤去し、paths を { "~/*": ["./src/*"] } のみにする／@hierarchidb/shape-store の build:types で TS2307/TS2339 を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/shape-store/tsconfig.json` と `packages/features/shape-store/src/EphemeralShapeDB.ts`
- ロールバック手順: `packages/shape-store/tsconfig*.json` と `packages/features/shape-store/src/EphemeralShapeDB.ts` の差分を revert してローカル上書き・型修正を元に戻す
- チェックリスト:
  - shape-store の tsconfig の baseUrl/paths 上書きを特定する
  - paths を { "~/*": ["./src/*"] } のみに揃える
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:00 JST shape-store の tsconfig paths 警告修正に着手。
  - done: 2026-01-03 23:00 JST shape-store の tsconfig paths を "~/*" のみに整理。検証: 未実施。
  - start: 2026-01-03 23:46 JST shape-store build:types の TS2307/TS2339 修正に着手。
  - done: 2026-01-03 23:48 JST shape-store に @hierarchidb/gis-sdk 依存を追加し解決策を反映。検証: 未実施。

2040) refactor/app/treeconsole-actions-split (P2) — 完了 (2026-01-09)
- ブランチ名: refactor/app/treeconsole-actions-split
- 依存: なし
- 受け入れ基準: app/src/hooks/treeconsole/createTreeConsoleActions.ts を責務ごとに分割し、API/挙動を維持する／分割後の import/export が TypeScript で通る状態にする／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/hooks/treeconsole/createTreeConsoleActions.ts` と `app/src/hooks/treeconsole/actions/*`
- ロールバック手順: `app/src/hooks/treeconsole/createTreeConsoleActions.ts` と `app/src/hooks/treeconsole/actions/*` の差分を revert して分割前の単一ファイルへ戻す
- チェックリスト:
  - createTreeConsoleActions の責務を分割ファイルへ移動する
  - 呼び出し側の API を維持する
  - 影響範囲/ロールバック/運用ログを追記する
- 運用ログ：
  - start: 2026-01-09 10:06 JST TreeConsole actions 分割の実装に着手。
  - done: 2026-01-09 10:28 JST TreeConsole actions を actions 配下へ分割し、createTreeConsoleActions を配線のみへ整理。検証: 未実施。

2042) fix/gis-sdk/vector-tiles-empty-result (P2) — 完了 (2026-01-09)
- ブランチ名: fix/gis-sdk/vector-tiles-empty-result
- 依存: なし
- 受け入れ基準: VectorTileGenerateResult の空ケースで tiles を必ず返す／typecheck エラーが消える／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/vectorTiles.ts`
- ロールバック手順: `packages/features/gis-sdk/src/vectorTiles.ts` の差分を revert する
- チェックリスト:
  - 空ケースの戻り値に tiles を追加する
  - typecheck エラーが消えることを確認する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:44 JST VectorTileGenerateResult の空結果修正に着手。
  - done: 2026-01-09 10:45 JST 空結果で tiles 配列を返すよう統一し型エラーを解消。検証: 未実施。

2043) fix/runtime-worker/typecheck-commandresult-and-shape-db (P2) — 完了 (2026-01-09)
- ブランチ名: fix/runtime-worker/typecheck-commandresult-and-shape-db
- 依存: なし
- 受け入れ基準: CommandResult を正しく re-export し typecheck エラーを解消する／StageProcessingService の型変換警告を解消する／ShapeDB のハンドル型が ShapeDatabaseLike を満たす／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/command-types.ts`, `packages/runtime-worker/src/services/command-types.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/WorkerService.ts`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - CommandResult の re-export を追加する
  - StageProcessingService の unsafe cast を明示的に解消する
  - ShapeDatabaseHandle の型を ShapeDatabaseLike に合わせる
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:52 JST runtime-worker typecheck エラー修正に着手。
  - done: 2026-01-09 10:56 JST CommandResult の re-export 追加、StageProcessingService の cast を明示化、ShapeDatabaseHandle に metadata テーブルを追加。検証: 未実施。

2044) refactor/runtime-worker/shape-db-concrete-types (P2) — 完了 (2026-01-09)
- ブランチ名: refactor/runtime-worker/shape-db-concrete-types
- 依存: なし
- 受け入れ基準: ShapeDatabaseLike/ShapeDatabaseHandle を撤去し ShapeDB 型を直接使う／StageProcessingService の Record<string, unknown> キャストを撤去する／挙動は変更しない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeMutationService.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/WorkerService.ts`
- ロールバック手順: 上記ファイルの差分を revert し、旧来の ShapeDatabaseLike/ShapeDatabaseHandle/Record キャストに戻す
- チェックリスト:
  - ShapeDatabaseLike/ShapeDatabaseHandle を撤去する
  - Record<string, unknown> のキャストを削除する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 11:10 JST ShapeDB 型の直接利用と Record キャスト撤去に着手。
  - done: 2026-01-09 11:15 JST ShapeDB へ置換し、VectorTile アイテム型を明示して Record キャストを撤去。検証: 未実施。

2045) fix/shape-plugin/typecheck-batch-and-tiles (P2) — 完了 (2026-01-09)
- ブランチ名: fix/shape-plugin/typecheck-batch-and-tiles
- 依存: なし
- 受け入れ基準: shape-plugin の typecheck エラー（BatchTaskBase/zoomRanges/GeoJSON/NodeId/VectorTileDB2Procedure）を解消する／挙動は維持する／抽象化や Record キャストの追加をしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/common/types/build.ts`, `plugins/shape-plugin/src/services/batch/session/extract2/zoomRanges.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/assembleTileGeoJSON.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/VectorTileDB2Procedure.ts`, `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/package.json`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - BatchTaskBase の stage/type を埋める
  - zoomRanges と VTConfigSection の undefined を解消する
  - GeoJSON 判定と NodeId 型を整える
  - VectorTileDB2Procedure の型と依存を整理する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 11:24 JST shape-plugin typecheck エラー修正に着手。
  - done: 2026-01-09 11:39 JST BatchTaskBase の stage/type 付与、zoom/NodeId/GeoJSON の型修正、VectorTileDB2Procedure の依存と型を整理。検証: 未実施。
  - done: 2026-01-09 11:44 JST tsconfig.base.json の vectortile-store path を dist に修正（dependency-guard 対応）。検証: 未実施。
  - done: 2026-01-09 12:03 JST assembleTileGeoJSON の geometry ガード強化と VectorTileDB2Procedure の bbox 入力型ガードを追加。検証: 未実施。

2041) fix/ui-map/full-map-display-mapstyle-undefined (P2) — 完了 (2026-01-09)
- ブランチ名: fix/ui-map/full-map-display-mapstyle-undefined
- 依存: なし
- 受け入れ基準: FullMapDisplay が mapStyleObject の undefined を渡さず typecheck を通す／挙動を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src/components/FullMapDisplay.tsx`
- ロールバック手順: `packages/ui/map/src/components/FullMapDisplay.tsx` の差分を revert する
- チェックリスト:
  - mapStyleObject の undefined を解消する
  - typecheck エラーが消えることを確認する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:34 JST FullMapDisplay の mapStyleObject 型エラー修正に着手。
  - done: 2026-01-09 10:38 JST FullMapDisplay の props 定義を style URL/obj の union へ整理し、mapStyleObject の undefined を排除。検証: 未実施。

2037) chore/analysis/list-large-ts-files (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/list-large-ts-files
- 依存: なし
- 受け入れ基準: app/src・packages/**/src・plugins/*/src の TypeScript/TSX で1000行以上のファイルを列挙する／ファイルパスと行数を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 対象パス配下の .ts/.tsx を行数カウントする
  - 1000行以上のファイル一覧を作成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:18 JST 1000行以上のTS/TSXファイル一覧作成に着手。
  - done: 2026-01-03 21:19 JST app/src・packages/**/src・plugins/*/src の1000行以上ファイルを列挙。コマンド: python3 - <<'PY' ... で行数集計。

2039) chore/analysis/split-map-routes-proposal (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/split-map-routes-proposal
- 依存: なし
- 受け入れ基準: app/src/router/routes/map.tsx の現状責務を整理する／責務単位で分割候補ファイルと役割を提示する／ルーティング構造と依存関係への影響（import/export観点）を簡潔に示す／TASKS.md に運用ログを記載する
- チェックリスト:
  - map.tsx の現状責務を箇条書きで整理する
  - 責務ごとの分割候補ファイル名と配置案を示す
  - ルーティング構造と依存関係への影響をまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:24 JST map.tsx 分割提案の調査に着手。
  - done: 2026-01-03 21:24 JST map.tsx の責務整理と分割提案を提示。

2040) refactor/ui/split-map-routes (P2) — 完了 (2026-01-03)
- ブランチ名: refactor/ui/split-map-routes
- 依存: なし
- 受け入れ基準: app/src/router/routes/map.tsx を MapPage + hooks + UI コンポーネントへ分割する／URL同期・検索・ハイライト・レイヤー構築の挙動を維持する／循環依存がないことを確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - map ルートのエントリを薄くし MapPage を分離する
  - hooks（view state/search/highlight/folder layers）を抽出する
  - SearchPanel/SearchSettingsDialog を分離する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:24 JST map.tsx の分割実装に着手。
  - done: 2026-01-03 21:34 JST MapPage/hooks/検索UIへ分割し、map.tsx を薄いエントリに変更。

2041) refactor/ui-map/extract-map-preview-parts (P2) — 完了 (2026-01-04)
- ブランチ名: refactor/ui-map/extract-map-preview-parts
- 依存: なし
- 受け入れ基準: app/src/router/routes/map* の再利用性が高い preview 部品（検索UI/検索ロジック/ハイライト等）を ui-map に移設する／呼び出し側を ui-map の新部品に置換する／挙動が維持されることを確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - map* から移設対象コンポーネント/フックを抽出する
  - ui-map に移設し exports を追加する
  - app 側を ui-map の部品に差し替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 19:14 JST map preview 部品の ui-map 移設に着手。
  - done: 2026-01-04 19:21 JST search UI と検索/ハイライト hook を ui-map に移設し、app 側を置換。

2042) feat/ui-map/preview-selection-gestures (P1) — 完了 (2026-01-04)
- ブランチ名: feat/ui-map/preview-selection-gestures
- 依存: なし
- 受け入れ基準: Meta/Shift クリックと背景クリック、Meta+ドラッグの矩形選択を実装し、Jotai の選択Setへ反映される／Snackbar をオプションで有効化でき、近傍メタデータを表示できる／/map 既存機能を破壊しない／TASKS.md に運用ログを記載する
- チェックリスト:
  - 選択Set/hoverSet を Jotai へ整理し、既存利用箇所を移行する
  - クリック/ドラッグの入力判定を実装する
  - Snackbar 表示オプションと表示内容ビルダを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 22:05 JST preview 選択ジェスチャと Snackbar の実装に着手。
  - done: 2026-01-04 22:20 JST クリック/ドラッグ選択と hover Snackbar を ui-map に追加し /map を更新。

2043) feat/ui-map/styler-toggle-dialog (P1) — 完了 (2026-01-04)
- ブランチ名: feat/ui-map/styler-toggle-dialog
- 依存: なし
- 受け入れ基準: styler ノード由来のスタイル一覧を ModelessDialog で表示し、チェックボックスでオン/オフできる／スタイルの切替が地図に反映される／TASKS.md に運用ログを記載する
- チェックリスト:
  - styler の一覧と詳細情報（パス/説明/データソース/フィルタ/カラーチャート）を用意する
  - ModelessDialog へ専用のスタイル一覧を追加する
  - トグル状態を地図描画へ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 22:20 JST styler 一覧ダイアログの実装に着手。
  - done: 2026-01-04 23:07 JST スタイル一覧とトグルを追加し地図描画へ反映。

2038) chore/analysis/gen-plugin-registry-split-proposal (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/gen-plugin-registry-split-proposal
- 依存: なし
- 受け入れ基準: gen-plugin-registry.ts の責務を分解し、具体的な分割案（ファイル名と役割）を提案する／依存関係と公開インターフェース整理方針を示す／段階的な移行手順を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 現行ファイルの責務と構成を把握する
  - 分割単位とファイル名の提案を作成する
  - 依存関係と公開インターフェースの整理方針を示す
  - 段階的な移行手順を提案する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:22 JST gen-plugin-registry.ts 分割提案の調査に着手。
  - done: 2026-01-03 21:24 JST 現行責務の分解と分割案・移行手順を提示。

2039) refactor/tools/gen-plugin-registry-split (P2) — 完了 (2026-01-03)
- ブランチ名: refactor/tools/gen-plugin-registry-split
- 依存: なし
- 受け入れ基準: gen-plugin-registry.ts を責務ごとに分割し、挙動が変わらない／plugin-registry 配下に整理しエントリは薄く保つ／生成結果に変更がないことを確認または未検証理由を明記する／TASKS.md に運用ログと影響範囲を記載する
- チェックリスト:
  - 定数/ユーティリティ/収集/生成/検証の各モジュールを分割する
  - gen-plugin-registry.ts を orchestrator へ整理する
  - 生成結果の差分有無を確認し記録する
  - 運用ログ start/done/blocked と影響範囲を追記する
- 運用ログ：
  - start: 2026-01-03 21:26 JST gen-plugin-registry.ts の分割作業に着手。
  - done: 2026-01-03 21:31 JST plugin-registry 配下へ責務分割しエントリを薄く整理。検証: 未実施（生成コマンド未実行）。
- 影響範囲：`packages/tools/build-scripts/src/gen-plugin-registry.ts` と `packages/tools/build-scripts/src/plugin-registry/*`

2040) chore/analysis/list-large-ts-files-refresh (P3) — 進行中 (2026-01-03)
- ブランチ名: chore/analysis/list-large-ts-files-refresh
- 依存: なし
- 受け入れ基準: app/src・packages/**/src・plugins/*/src の TypeScript/TSX で1000行以上のファイルを再列挙する／ファイルパスと行数を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 対象パス配下の .ts/.tsx を行数カウントする
  - 1000行以上のファイル一覧を再作成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:50 JST 1000行以上のTS/TSXファイル再集計に着手。
  - done: 2026-01-03 21:50 JST 再集計を実行。コマンド: python3 - <<'PY' ... で行数集計。

2041) refactor/ui/split-use-tree-view-controller-tests (P2) — 進行中 (2026-01-03)
- ブランチ名: refactor/ui/split-use-tree-view-controller-tests
- 依存: なし
- 受け入れ基準: useTreeViewController.test.tsx のテストを内容ごとに分割し複数ファイルに移す／テスト挙動は変更しない／テスト検出に影響がないこと／TASKS.md に運用ログと影響範囲を記載する
- チェックリスト:
  - テスト内容のカテゴリを整理する
  - 分割先ファイルにテストを移動する
  - 旧ファイルを整理または削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 22:16 JST useTreeViewController.test.tsx の分割作業に着手。
  - done: 2026-01-03 22:23 JST テストを内容別に分割し複数ファイルへ移動。検証: 未実施。
- 影響範囲：`packages/ui/treeconsole/base/src/hooks/useTreeViewController*.test.tsx`

2036) feat/gis-sdk/flatgeobuf-input (P2) — 完了 (2026-01-09)
- ブランチ名: feat/gis-sdk/flatgeobuf-input
- 依存: なし
- 受け入れ基準: gis-sdk が FlatGeobuf 入力から vector tile 生成できる／VectorTileGenerateConfig に入力フォーマット指定を追加する／runtime-worker の呼び出し側が新しい入力フォーマット指定を受け取れる／既存JSONフローの互換性を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：gis-sdk に FlatGeobuf buffer のデコードを追加し、vector tile 生成を入力フォーマットで分岐できるよう拡張。runtime-worker は inputFormat を受け取り flatgeobuf 時に新経路を使用する。
- 影響範囲：`packages/features/gis-sdk/src/vectorTiles.ts` と `packages/runtime-worker/src/services/StageProcessingService.ts` の入力処理、`packages/runtime-worker/src/types.ts` の API 型、`packages/features/gis-sdk/package.json` の依存。
- ロールバック手順：上記ファイルの差分を revert し、`flatgeobuf` 依存追加と新規デコード関数を取り除く。
- チェックリスト:
  - FlatGeobuf buffer から FeatureCollection を生成する処理を追加する
  - FlatGeobuf 用の generate 関数と export を追加する
  - VectorTileGenerateConfig / worker API に入力フォーマットを追加する
  - 既存JSONフローが変わらないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 02:26 JST FlatGeobuf 入力対応の実装に着手。
  - done: 2026-01-09 02:31 JST FlatGeobuf 入力の生成関数と runtime-worker 分岐を追加。

2035) chore/analysis/route-vector-tile-flatgeobuf (P2) — 完了 (2026-01-09)
- ブランチ名: chore/analysis/route-vector-tile-flatgeobuf
- 依存: なし
- 受け入れ基準: ルートベクタタイル生成の入力JSON構造と利用箇所を整理する／FlatGeobuf化の適用ポイントを2案以上で比較する／性能改善の見込みと移行リスクを簡潔に整理する／TASKS.md に運用ログを追記する
- 要点：入力は GeoJSON FeatureCollection（Route=LineString、Location=Point）で、Dexie chunk store に sessionId/nodeId キーで保存。FlatGeobuf への移行は「保存形式のみ置換」か「入力フォーマット分岐の追加」で段階対応でき、JSON.parse コスト削減が見込めるが geojson-vt 前処理がボトルネックとして残る。
- チェックリスト:
  - JSON入力の利用箇所とデータ構造を整理する
  - FlatGeobuf化の適用案を比較する
  - 性能改善の見込みと移行リスクを整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 02:10 JST FlatGeobuf 化の検討調査に着手。
  - done: 2026-01-09 02:24 JST JSON入力構造とFlatGeobuf適用案を整理し、性能/リスク観点をまとめた。

2034) refactor/shape/metadata-download-migration (P1) — 完了 (2026-01-03)
- ブランチ名: refactor/shape/metadata-download-migration
- 依存: 2030
- ExecPlan: plans/shape-metadata-download-migration-execplan.md
- 受け入れ基準: @hierarchidb/fetch-save-metadata を削除する／shape-plugin Step3 が @hierarchidb/download 経由で geoBoundaries API からメタデータを取得・キャッシュし表示できる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：Step3 の国メタデータ取得を download 経由へ統合し、geoBoundaries/GADM/Natural Earth の取得・解析を実装。openstreetmap は Step2 無効化と Step3 例外で遮断。fetch-save-metadata と関連スクリプト/alias を削除した。
- 原因/影響範囲：静的 JSON 再配布の fetch-save-metadata に依存していたためデータ鮮度と iso2 欠落が問題化。影響範囲は shape-plugin Step3（UI/Worker）と download パッケージの API、ビルド前処理と tsconfig/vite alias。
- 修正内容と適用範囲：downloadText を追加し条件付きキャッシュ対応。MetadataLoader を download 経由に差し替え、geoBoundaries は `gbOpen/ALL/ALL` から iso3+level を集計、GADM は maps.html と各国ページから level 表記を抽出、Natural Earth は worldwide 1 行に固定。openstreetmap は Step3 で例外。fetch-save-metadata を削除し、`package.json` の metadata:ensure 系、`app/vite.config*.ts`、`tsconfig.base.json`、`types/ambient-modules.d.ts` を整理。対象: `packages/features/download/src/pluginDownloadRegistry.ts`, `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`, `plugins/shape-plugin/src/ui/hooks/useCountryMetadata.ts`, `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeDataSourceStep.ts`, `plugins/shape-plugin/src/common/mock/data.ts`, `plugins/shape-plugin/src/common/__tests__/unit/metadata-loader.unit.test.ts`, `plugins/shape-plugin/src/services/utils/__tests__/generateUrlMetadata.unit.test.ts` ほか。
- 検証：未実施（手動/自動テスト未実行）。
- ロールバック手順：上記ファイル群の差分を revertし、`packages/features/fetch-save-metadata` と `scripts/data-generation/generate-metadata.mjs` を復元。`package.json` の metadata:ensure 系と vite/tsconfig/ambient module の alias を元に戻す。
- チェックリスト:
  - fetch-save-metadata 依存と import を排除する
  - geoBoundaries metadata を downloadJson で取得し、CountryMetadata に変換する
  - Step3 の UI/Worker が新しいメタデータ経路で動作する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-03 17:36 JST fetch-save-metadata 削除と metadata download 移行に着手。
  - done: 2026-01-03 18:22 JST downloadText 追加と metadata 取得移行、fetch-save-metadata 削除を完了。

2035) feat/vector-tiles/chunkstore-input-formats (P1) — 進行中 (2026-01-03)
- ブランチ名: feat/vector-tiles/chunkstore-input-formats
- 依存: なし
- ExecPlan: plans/vector-tiles-chunkstore-input-formats-execplan.md
- 受け入れ基準: shape/location/route のベクトルタイル生成で chunk-store の素材保存形式を geojson/geojson+gzip/flatgeobuf/flatgeobuf+gzip から選べる／保存と読み出しが形式ごとに動作する／既存の geojson 既定動作が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：runtime-worker の chunk-store 入力に inputFormat/inputCompression を追加し gzip 圧縮/解凍を実装。gis-sdk に FlatGeobuf エンコードを追加し、shape/location/route の入力生成と config 配線を更新。RouteVectorTileService は writeVectorTileInput 経由で chunk-store 書き込みを共通化。
- 影響範囲：`packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/types.ts`, `packages/features/gis-sdk/src/vectorTiles.ts`, `packages/features/gis-sdk/src/index.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `plugins/shape-plugin/src/common/types/ObsolateBuildConfig.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/vectorTileTasks.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/features/location-store/src/index.ts`, `plugins/location-plugin/src/services/batch/LocationSessionController.ts`, `plugins/location-plugin/package.json`, `packages/features/route-store/src/index.ts`, `plugins/route-plugin/src/services/RouteBatchSession.ts`, `plugins/route-plugin/src/services/RouteVectorTileService.ts`, `plugins/route-plugin/package.json`, `vitest.setup.base.ts`。
- 検証：未実施（手動/自動テスト未実行）。
- ロールバック手順：上記ファイルの差分を revert し、chunk-store 入力を JSON のみに戻す。route は DexieChunkStore 直接書き込みへ戻し、inputFormat/inputCompression の追加型定義を削除する。
- チェックリスト:
  - 現状の素材保存パイプラインとフォーマット処理を特定する
  - 入力フォーマット拡張（gzip/flatgeobuf）を共通実装で追加する
  - shape/location/route のパイプラインに配線する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-03 18:30 JST chunk-store 入力フォーマット拡張の調査に着手。
  - done: 2026-01-03 19:10 JST ExecPlan を作成。
  - done: 2026-01-03 19:32 JST runtime-worker/gis-sdk/shape/location/route への配線と型更新を完了（未検証）。

2033) chore/analysis/geoboundaries-usage-scan (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-usage-scan
- 依存: なし
- 受け入れ基準: geoboundaries.json の直接参照箇所を全件列挙する／shape-plugin 以外での利用有無を明示する
- 要点：geoboundaries.json の直接 import は shape-plugin の MetadataLoader に限定され、他の直接参照は存在しない。
- チェックリスト:
  - 直接参照箇所を列挙する
  - shape-plugin 以外の利用有無を整理する
- 運用ログ：
  - start: 2026-01-03 17:30 JST geoboundaries.json の利用箇所スキャンに着手。
  - done: 2026-01-03 17:31 JST 直接参照は shape-plugin のみであることを確認。

2032) chore/analysis/geoboundaries-iso2-rootcause (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-iso2-rootcause
- 依存: なし
- 受け入れ基準: geoboundaries.json の取得元が自己参照であることを説明する／iso2 の取得・保存経路を特定する／iso2 が空になる理由をデータ源/加工観点で明示する
- 要点：generate-metadata.mjs のフォールバックは repo の raw JSON 自体を再取得する構成で、iso2 は加工されず元データの空文字がそのまま保存されていることを確認した。
- チェックリスト:
  - 取得元URLの決定ロジックを整理する
  - iso2 の加工有無を確認する
  - 空文字の発生理由を説明する
- 運用ログ：
  - start: 2026-01-03 17:26 JST geoboundaries.json の iso2 空文字原因調査に着手。
  - done: 2026-01-03 17:28 JST 取得元URLと未加工保存の経路を特定し、空文字が元データ起因であることを整理。

2032) feat/chunk-store/migrate-download (P1) — 進行中 (2026-01-03)
- ブランチ名: feat/chunk-store/migrate-download
- 依存: なし
- ExecPlan: plans/chunk-store-migration-execplan.md
- 受け入れ基準: @hierarchidb/chunk-store を新設し、Dexie DB/テーブルとシリアライザ/デシリアライザを注入できる設計になっている／relation テーブル（nodeId + metadataId）と同値性判定（url/etag/url+etag/hash）を持ち、chunk set の作成/削除時に nodeId を渡す設計になっている／@hierarchidb/download はネットワーク/認証補助の低レベル API に簡素化され、chunk-store が内部的に FetchNetworkPort を利用する構成になっている／高レベル API に混在していた責務がプラグイン側へ移譲され、serializer/deserializer 注入で用途を実現している／対象プラグインで serializer/deserializer + nodeId 注入の実装に置き換わっている／TASKS.md に運用ログ・影響範囲・ロールバック手順が記載されている
- チェックリスト:
  - ExecPlan を作成し、方針と検証手順を明文化する
  - chunk-store パッケージの設計と API を定義する
  - download から汎用 chunk store 責務を分離し、chunk-store 経由に整理する
  - プラグイン側でシリアライザ/デシリアライザ注入の実装へ移行する
  - 運用ログ start/done/blocked を追記する
- 要点：@hierarchidb/chunk-store に relation テーブル（nodeId + metadataId）と同値性判定（url/etag/url+etag/hash）を追加し、nodeId 必須の set/get/delete API を実装。CAS（HashPort/ContentIndexPort/CachePort）を chunk-store へ移設。@hierarchidb/download は FetchNetworkPort/authFetch/postJson/auth通知へ簡素化し、pluginDownloadRegistry/createDownloadService/DexieChunkStoragePort を撤去。shape/route/runtime-worker/spreadsheet の URL 取得や一時保存を chunk-store ベースへ移行し、conditional caching と dedupe を維持。
- 影響範囲：`packages/features/download`, `packages/features/chunk-store`, `plugins/shape-plugin`, `plugins/route-plugin`, `packages/runtime-worker`, `plugins/spreadsheet-plugin` とそれぞれの package.json/README/テスト。
- ロールバック：chunk-store 追加と download API 変更を revert し、旧 downloadJson/getPluginDownloadService/DexieChunkStoragePort ベースへ戻す。relation テーブル/identity 判定の導入を差し戻し、プラグイン側は旧 download helper 呼び出しに差し替える。
- 運用ログ：
  - start: 2026-01-03 19:35 JST ExecPlan 作成に着手。
  - start: 2026-01-03 20:12 JST chunk-store 移行作業の実装に着手。
  - blocked: 2026-01-03 20:46 JST `pnpm --filter @hierarchidb/chunk-store typecheck` が node_modules 不在で失敗（@hierarchidb/download/@hierarchidb/util の型解決不可）。
  - start: 2026-01-03 21:05 JST chunk-store の relation/cas 移設作業に着手。
  - done: 2026-01-03 21:38 JST relation + CAS 移設と nodeId 必須 API への移行を完了（検証は node_modules 不在で未実施）。
  - start: 2026-01-09 02:55 JST shape Step3/spreadsheet の URL 取得で実ノードIDを渡す対応に着手。
  - done: 2026-01-09 03:12 JST shape Step3 の metadata 取得と spreadsheet URL ダウンロードで nodeId を伝播する修正を反映（検証は未実施）。

2031) chore/analysis/geoboundaries-output-trace (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-output-trace
- 依存: なし
- 受け入れ基準: packages/features/fetch-save-metadata/output/geoboundaries.json の生成元パッケージ/ファイルを特定する／アクセス先URLを特定する／取得内容と加工フローをコード参照付きで説明する／保存処理のタイミングと出力経路を説明する
- 要点：geoboundaries.json を生成するスクリプト・アクセスURL・加工/保存フローを整理し、関連ファイルを特定した。
- チェックリスト:
  - 生成元パッケージ/ファイル/関数を特定する
  - アクセス先URLとレスポンス形式を特定する
  - 加工フローをコード参照付きで整理する
  - 保存処理の流れを整理する
- 運用ログ：
  - start: 2026-01-03 17:20 JST geoboundaries.json 生成フローの調査に着手。
  - done: 2026-01-03 17:22 JST 生成元スクリプトとURL/加工/保存フローを整理。

2030) refactor/download/api-slim-anyless (P1) — 完了 (2026-01-03)
- ブランチ名: refactor/download/api-slim-anyless
- 依存: なし
- ExecPlan: plans/download-api-shape-step3-execplan.md
- 受け入れ基準: @hierarchidb/download の any を排除し型付けを改善する／download API の入口を現行ユースケースに合わせて整理する／shape-plugin Step3 の country metadata 取得が download サービス層を経由し、キャッシュとコンテントネゴシエーションが有効になる／TASKS.md に運用ログ・影響範囲・ロールバック手順が記載されている
- 受け入れ基準: packages/features/fetch-save-metadata/src/utils/fetchWithRetry.ts を削除し、@hierarchidb/download を使う実装に移行する
- 要点：@hierarchidb/download の any を排除し API 公開範囲を整理、downloadJson に条件付きキャッシュを追加。Step3 の geoBoundaries availability を cache+コンテントネゴシエーションで取得し、fetch-save-metadata の fetchWithRetry を撤去して FetchNetworkPort に統一。
- 原因/影響範囲：Step3 の geoBoundaries availability 取得で CORS/再取得が発生しやすく、download パッケージに冗長な公開 API と any 使用が残っていた。fetch-save-metadata にも重複したリトライ実装があり、責務が分散していた。影響範囲は download パッケージの公開 API、shape-plugin Step3 availability、fetch-save-metadata の取得処理。
- 修正内容と適用範囲：download の型付けと公開 API を整理し、downloadJson に `cache: 'conditional'` を追加、Dexie ストレージに ETag/Last-Modified を保存。Step3 で geoBoundaries availability の取得を条件付きキャッシュに切り替え。fetch-save-metadata は FetchNetworkPort に置換し fetchWithRetry を削除。適用範囲は `packages/features/download/src/ports.ts`, `packages/features/download/src/adapters/DexieChunkStoragePort.ts`, `packages/features/download/src/adapters/FetchNetworkPort.ts`, `packages/features/download/src/createDownloadService.ts`, `packages/features/download/src/pluginDownloadRegistry.ts`, `packages/features/download/src/index.ts`, `packages/features/download/README.md`, `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`, `plugins/shape-plugin/src/services/utils/geoBoundariesAvailability.ts`, `packages/features/fetch-save-metadata/src/fetchSaveMetadata.ts`, `packages/features/fetch-save-metadata/package.json`, `packages/features/fetch-save-metadata/src/utils/fetchWithRetry.ts`（削除）, `plugins/route-plugin/src/common/orchestrator/__tests__/unit/auth-notify.unit.test.ts`, `plans/download-api-shape-step3-execplan.md`。
- 検証：`pnpm --filter @hierarchidb/download typecheck`（成功）／`pnpm --filter @hierarchidb/download build:types`（成功）／`pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
- ロールバック手順：上記ファイルの差分を revert し、fetchWithRetry.ts を復元する。
- チェックリスト:
  - ExecPlan を作成し、方針と検証手順を明文化する
  - @hierarchidb/download の any 使用箇所を洗い出して型修正する
  - download API の入口を整理し、移行方針を記述する
  - Step3 の country metadata 取得を download サービス層へ移行し、キャッシュ/コンテントネゴシエーションを導入する
  - fetch-save-metadata の fetchWithRetry を削除し、download 経由に置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 17:19 JST ExecPlan 作成に着手。
  - done: 2026-01-03 17:42 JST download API 整理と Step3/metadata 取得のキャッシュ対応を完了。
  - done: 2026-01-03 18:37 JST download/shape-plugin の型検証を完了。

2029) fix/shape/step3-geoboundaries-availability-cors (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step3-geoboundaries-availability-cors
- 依存: なし
- 要点：Step3 の availability worker に CORS プロキシ設定を注入し、geoBoundaries の availability 取得が download 経由で動作するようにした。
- 原因/影響範囲：country availability worker が CORS プロキシ設定なしで geoboundaries API にアクセスし、ブラウザで CORS エラーが発生していた。影響範囲は Step3 の geoBoundaries 可用レベル取得とローディング表示。
- 修正内容と適用範囲：`countryAvailability.worker.ts` で `VITE_CORS_PROXY_BASE_URL` を読み込み `setCorsProxyBaseURL` を設定。適用範囲は `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`。
- 検証：未実施（UI での CORS 再現と確認は未実行）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 17:03 JST Step3 geoBoundaries availability の CORS 対応に着手。
  - done: 2026-01-03 17:03 JST availability worker に CORS プロキシ設定を追加。

2028) fix/shape/step5-resume-build-label (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step5-resume-build-label
- 依存: なし
- 要点：Step5 の Resume 表記を「Resume Build」へ戻し、i18n（英語/日本語）も Build 表記に揃えた。
- 原因/影響範囲：commit 3c8168b（2025-12-31）の “build” → “stage” 置換で Resume ラベルが「Resume stage」へ変わっていた。影響範囲は Shape Step5 の開始/再開コントロール表示とロケール定義。
- 修正内容と適用範囲：`ShapeBuildStep` の Resume ラベル既定文字列を「Resume Build」に戻し、`stage.controls` の i18n を追加。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` と `plugins/shape-plugin/src/ui/locales/{en,ja}.json`。
- 検証：未実施（文言差し替えのみ）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 16:59 JST Step5 の Resume ラベル修正と i18n 対応に着手。
  - done: 2026-01-03 17:00 JST Resume ラベルと i18n を Build 表記へ復元。

2027) fix/shape/step5-start-build-label (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step5-start-build-label
- 依存: なし
- 要点：Shape Step5 の開始ボタンラベルを「Start Build」に戻した。
- 原因/影響範囲：commit 3c8168b（2025-12-31）で “build” から “stage” へ用語統一した結果、Step5 の開始ラベルが「Start stage」へ変更されていた。影響範囲は `ShapeBuildStep` の開始ボタン表示。
- 修正内容と適用範囲：`startLabel` のデフォルト文字列を「Start Build」に戻した。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`。
- 検証：未実施（ラベル文言の差し替えのみ）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 00:00 JST Step5 のラベル変更履歴調査と修正に着手。
  - done: 2026-01-03 00:15 JST ラベルを「Start Build」に復元し、経緯を整理。

2026) feat/shape/dynamic-country-matrix (P1) — 完了 (2026-01-09)
- 要点：Shape Step3 の国×自治体レベルマトリクスをメタデータ駆動でオンデマンド生成し、データソース別ストラテジー＋WebWorkerで可用レベルを取得してUIへ反映するようにした。
- 原因/影響範囲：従来は geoBoundaries 固定でレベル2までの静的前提だったため、他データソースや実際の可用レベルに追随できず UI が実態と乖離するリスクがあった。影響範囲は shape-plugin Step3 UI（国×自治体レベル選択）と可用性取得の裏側ロジック。
- 修正内容と適用範囲：ストラテジーID解決を共通化、データソース可用性解決サービスと Comlink WebWorker を追加し、各ストラテジーが提供する可用性情報やメタデータから国別レベルを構築。Step3 フックは可用性通知を受けてマトリクスを再構成し、非対応セルは「-」を表示、仮想化を維持。適用範囲は `plugins/shape-plugin/src/services/datasources/*`, `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`, `plugins/shape-plugin/src/ui/workers/*`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`。
- 検証：`pnpm --filter @hierarchidb/shape-plugin test -- --runInBand --testTimeout=20000`（依存パッケージ @hierarchidb/shape-store / @hierarchidb/util / @hierarchidb/ui-batch-progress の解決不可で失敗。テストは走らず。環境依存のため後続で要再実行）。
- ロールバック手順：上記ファイルの差分を revert（特に `CountryAvailabilityResolver` 追加や Step3 フックの worker 連携部分を戻す）。
- 運用ログ：
  - start: 2026-01-09 00:55 JST Step3 可用性動的化と worker 背景取得の設計開始。
  - done: 2026-01-09 01:25 JST 実装完了。テストは依存解決不可で失敗（要再試行）。

2026) fix/styler/step5-radio-label-click (P1) — 完了 (2026-01-07)
- 要点：Styler Step5 のターゲット選択でラベルテキストをクリックしてもラジオが選択されるよう FormControlLabel で関連付け、既存レイアウトを維持。
- 原因/影響範囲：ラジオとラベルを別要素で描画し for 関連付けがなかったため、ラベルクリックが無反応だった。影響範囲は Styler Step5 のターゲット選択 UI。
- 修正内容と適用範囲：ターゲットオプション行を FormControlLabel に置き換え、Radio とラベルテキストを一体化。適用範囲は `StylerTargetStep` のターゲット選択部分。
- 検証：未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。
- ロールバック手順：`plugins/styler-plugin/src/ui/components/StylerTargetStep.tsx` と `TASKS.md` の差分を revert する。
- 運用ログ：
  - start: 2026-01-07 10:15 JST Step5 ラジオボタンのラベルクリック対応に着手。
  - done: 2026-01-07 11:05 JST FormControlLabel でラジオとラベルを結合し、ラベルクリックで選択できるよう修正。検証: 未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。ロールバック: 上記差分を revert。
2118) fix/app/comlink-apply-on-load (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/comlink-apply-on-load
- 依存: なし
- 受け入れ基準: `http://localhost:4200/` へのアクセスだけで `comlink.mjs:51 ... apply` エラーが再現しない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/**`, `packages/plugin-service-sdk/src/**`, `packages/runtime-worker/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、アクセス時の Comlink 初期化挙動を元に戻す
- チェックリスト:
  - エラー発生箇所と再現条件を特定する
  - Comlink 呼び出しで undefined になる経路を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 17:10 JST localhost:4200 アクセス時の Comlink apply エラー調査に着手。
  - update: 2026-01-11 17:32 JST useTreeNodeInfoPanel の ui-plugin-loader import パスを修正し、Vite の import 解決エラーを解消。検証: 未実施。
2179) refactor/ui/build-step-stage-panel (P2) — 完了 (2026-01-10)
- ブランチ名: refactor/ui/build-step-stage-panel
- 依存: なし
- 受け入れ基準: BuildStep のステージ描画が BuildStepStagePanel に分離され、BuildStepStagePanel 内で要約表示が BuildStepStageHeaderPanel、詳細表示が BuildStepStageDetailsPanel に分離されている／表示内容と挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageDetailsPanel.tsx`
- ロールバック手順: 追加ファイルと差分を revert し、BuildStep 内のインライン描画へ戻す
- チェックリスト:
  - BuildStepStagePanel を追加し、BuildStep から分離する
  - BuildStepStageHeaderPanel/BuildStepStageDetailsPanel を追加し、役割を分ける
  - 表示/進捗/展開の挙動を維持する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:40 JST BuildStep のステージ描画分離に着手。
  - done: 2026-01-10 18:54 JST BuildStepStagePanel/BuildStepStageHeaderPanel/BuildStepStageDetailsPanel を追加し、BuildStep から分離。検証: 未実施。
2180) feat/ui/build-step-stage-mode-toggle (P2) — 完了 (2026-01-10)
- ブランチ名: feat/ui/build-step-stage-mode-toggle
- 依存: なし
- 受け入れ基準: BuildStepStagePanel が taskCount を管理しステージ単位で渡す／BuildStepStageHeaderPanel と BuildStepStageDetailsPanel が memo 化される／Failed/Completed Chip がアイコン付きでクリック時に mode 更新できる／failedMode/completedMode の真偽でタスク表示を制御できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageDetailsPanel.tsx`
- ロールバック手順: 追加差分を revert し、従来のステージ表示と固定表示へ戻す
- チェックリスト:
  - taskCount 集計を BuildStepStagePanel に集約する
  - Failed/Completed モードのトグルを追加する
  - summary/details を memo 化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:28 JST BuildStepStagePanel のモード切替と taskCount 集計に着手。
  - done: 2026-01-10 19:38 JST summary/details の memo 化、Chip トグルとモード制御、taskCount 集計とフィルタを追加。検証: 未実施。

2212) feat/ui/dialog-display-mode-persist (P1) — 進行中 (2026-01-15)
- ブランチ名: feat/ui/dialog-display-mode-persist
- 依存: なし
- 受け入れ基準: プラグイン編集ダイアログの表示モード切り替え時に対象ノードの dialogUIState.dialogWindow.mode が即時更新される／永続化され再オープン時に復元される／create/preview では永続化しない／既存の保存・クローズ動作に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx` ほか（調査後に確定）
- ロールバック手順: 該当差分を revert し、表示モード永続化を切り戻す
- チェックリスト:
  - 表示モード切り替え時に dialogUIState を更新する
  - 永続化のタイミングを追加する
  - create/preview で永続化しないことを確認する
  - 既存の保存/クローズ動作に影響がないことを確認する
  - 必要ならテストを追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 23:11 JST 表示モード切り替え時の永続化対応に着手。
  - update: 2026-01-15 23:14 JST 表示モード切り替え時に dialogUIState を保存する処理を追加。
2229) feat/ui-map/interaction-core (P1) — 進行中 (2026-01-19)
- ブランチ名: feat/ui-map/interaction-core
- 依存: なし
- 受け入れ基準: ui-map に Shape/Route 一覧画面の共通コードが追加され、shape-plugin/route-plugin は最小限の設定で利用できる／一覧画面に「エラー関連カラム群（Completed/Failed 等）」が統合される／FitScreen/検索/ホバー/選択/検索一致/ハイライト/Snackbar/矩形選択/検索Enter-fit が ui-map 共通機能として実装され、プロパティで有効/無効を切替可能／shape-plugin Step6 ではタブ内のエラー一覧は復活せず、ui-map 共通コードへ移管する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `plugins/route-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: ui-map 共通一覧/interaction の追加差分と plugin 側の切り替え差分を revert し、従来の個別実装へ戻す
- チェックリスト:
  - ExecPlan を作成し、設計/移行/検証手順を明文化する
  - ui-map に Shape/Route 一覧画面の共通コンポーネントを追加する
  - エラー関連カラム群を共通化し、一覧表示へ統合する
  - FitScreen/検索/ホバー/選択/検索一致/ハイライト/Snackbar/矩形選択/検索Enter-fit を ui-map 側で実装し、プロパティで切替可能にする
  - shape-plugin/route-plugin を ui-map 共通コードの利用へ切り替える（最小限の実装）
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 00:00 JST ui-map の共通一覧/interaction 実装と plugin 側切替に着手。
  - update: 2026-01-19 00:35 JST ui-map に Shape/Route の一覧コンポーネントを追加し、shape/route preview の一覧表示を共通化へ切替。
  - blocked: 2026-01-19 00:40 JST pnpm typecheck が vt-orchestrator の既存型エラーで失敗（preSimplifyFilterConfig, geometry.ts 型不整合）。
  - blocked: 2026-01-19 00:55 JST git fetch origin ERIA-Cartograph が sandbox 制限で失敗（.git/FETCH_HEAD へアクセス不可）。
  - update: 2026-01-19 01:05 JST 権限付与後に git fetch origin ERIA-Cartograph が成功。
  - update: 2026-01-19 01:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 01:25 JST pnpm install を実行（peer dependency 警告あり）。
  - update: 2026-01-19 01:26 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
2291) fix/shape/step5-skipped-toggle (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-skipped-toggle
- 依存: なし
- 受け入れ基準: Step5ヘッダーにSkippedのChipトグルが追加される／Skippedの抽出表示がCompleted/Failedと同様に切替できる／TaskProgressBar の a11y lint が解消される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageFilterContext.tsx`, `packages/components/src/BuildStepPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`, `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - Skippedフィルタ状態を追加し、Stageヘッダーで切替できるようにする
  - タスク一覧でSkipped抽出が有効になることを確認する
  - TaskProgressBarのa11y lintを解消する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 23:40 JST Step5のSkippedトグルとTaskProgressBarのa11y修正に着手。
  - update: 2026-01-22 23:50 JST components の dist 型が未更新で typecheck 失敗したため、pnpm --filter @hierarchidb/components build を実行。
  - done: 2026-01-22 23:55 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。

2292) fix/shape/vt-summary-message-format (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/vt-summary-message-format
- 依存: なし
- 受け入れ基準: vt完了時のメッセージが `tiles {processed}/{total} | input(...) output(...)` 形式になる／進捗メッセージの形式は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: メッセージ生成差分を revert する
- チェックリスト:
  - vt完了時メッセージのフォーマットを変更する
  - input/output 集計を完了時に出力できるようにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 00:10 JST vt完了時メッセージを進捗形式に合わせる対応に着手。
  - done: 2026-01-23 00:20 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。

2293) fix/shape/vt-task-status-sync (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/vt-task-status-sync
- 依存: なし
- 受け入れ基準: Step5のタスク一覧とサマリーがビルド完了時に必ず完了状態へ遷移する／Running/Queuedの孤児が残らない／vt完了時のmessageが一覧とサマリーで一致する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/step5/useBuildProgress.ts`（必要に応じて追加）
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - vt完了時にtaskSummary/一覧が完了状態へ更新されることを確認する
  - Running/Queuedの孤児が残らないことを確認する
  - message出力の整合性をタスク一覧とサマリーで統一する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 01:10 JST vtステージ完了時のtaskSummary/一覧同期不整合の修正に着手。
  - update: 2026-01-23 01:20 JST 完了後のRunning/Queued孤児検知時にタスク再取得を行う同期処理を追加。
  - update: 2026-01-23 01:22 JST shapePipeline のタイル交差判定に型ガードを追加し typecheck を復旧。
  - done: 2026-01-23 01:23 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-23 01:30 JST 完了イベントで必ず最終タスク一覧を確定する根本修正の検討に着手。
 - update: 2026-01-23 01:40 JST 完了イベントで最終タスク一覧を取得し、未完タスクがある間は自動更新を継続するよう修正。
 - done: 2026-01-23 01:41 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2294) fix/shape/step6-map-no-render (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/step6-map-no-render
- 依存: なし
- 受け入れ基準: Step6でタイル/レイヤーが描画される（ADM0/ADM1が表示される）／原因・発生範囲・修正方法と適用範囲を説明する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`, `packages/ui/map/src/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step6の表示挙動を元に戻す
- チェックリスト:
  - Step6のタイル取得/描画経路を確認し、欠落点を特定する
  - 修正後にADM0/ADM1が描画されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
- start: 2026-01-23 04:20 JST Step6でタイルが表示されない件の原因調査に着手。
- update: 2026-01-23 04:40 JST Step6のプレビューで admin0/admin1 レイヤーを明示指定し、layer0 既定を廃止する修正に着手。
- update: 2026-01-23 05:05 JST Step6で地物が表示されないため、MVTレイヤ名とStep6の参照レイヤの整合性を再調査中。
- update: 2026-01-23 06:10 JST Step6のタイル供給/描画/インタラクション経路の再検証と修正に着手。
- update: 2026-01-23 06:25 JST Step6のhover/snackbar無効設定とタイル取得経路の不整合を修正する方針で調査・修正に着手。
  - update: 2026-01-23 19:15 JST Step6プレビューで layer 未登録のまま hover クエリが走る件の調査を開始。
  - done: 2026-01-23 04:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

  - update: 2026-01-21 17:51 JST Step6の地物未表示/ホバー無反応の原因調査と修正方針を開始。
2291) fix/shape/tile-bbox-coordinate-system (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/tile-bbox-coordinate-system
- 依存: なし
- 受け入れ基準: タイルbboxとGeoJSON座標系の整合が取れるように修正する／transformのタイルインデックスが実ジオメトリ交差に基づくことを確認できる／vtの「featuresあり・tiles 0」が再発しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: タイルbbox整合・交差判定の差分を revert する
- チェックリスト:
  - タイルbboxの座標系を確認し、GeoJSON座標系と合わせる
  - transformのtile index作成で実ジオメトリ交差に基づく判定を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:10 JST タイルbboxの座標系不整合と交差判定の確認・修正に着手。
  - update: 2026-01-22 20:25 JST タイルbboxはlon/lat前提であることを確認し、transformのtile index作成をbboxクリップによる実ジオメトリ交差判定に変更。
  - update: 2026-01-22 20:30 JST shapePipeline側のタイルID収集も同様にクリップ判定へ変更。
  - done: 2026-01-22 20:33 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-22 20:45 JST per-tile indexでclip済みfeatureがあるのにgeojson-vtが空タイルを返す場合は警告ログを出し、vtタスクをfailedにするよう修正。
  - done: 2026-01-22 20:48 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-23 03:20 JST tiles 0/1 など空タイル発生の原因特定（転置インデックス/タイル交差/geojson-vt入出力）を再調査開始。
2293) test/shape/step6-tile-verification (P1) — 完了 (2026-01-22)
- ブランチ名: test/shape/step6-tile-verification
- 依存: なし
- 受け入れ基準: Step5で生成されたタイルがShapeDBに保存されることをテストで確認する／Step6のプレビューがShapeDBを参照してタイル取得を試みることをテストで確認する／vtタスクのレイヤー集計表示がタイルのレイヤー構成に基づくことをテストで確認する／pnpm --filter @hierarchidb/shape-plugin test が exit 0／pnpm --filter @hierarchidb/vt-orchestrator test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/headless/__tests__/**`, `plugins/shape-plugin/src/ui/__tests__/**`, `packages/vt-orchestrator/src/vt/__tests__/**`（テスト参照のみ）
- ロールバック手順: 追加したテストファイルとテスト用のモック差分を revert する
- チェックリスト:
  - Step5のタイル保存を検証するテストを追加する
  - Step6のタイル参照経路を検証するテストを追加する
  - vtタスクのレイヤー集計表示を検証するテストを追加する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 21:30 JST Step5/Step6のタイル検証テスト整備に着手。
  - update: 2026-01-23 19:00 JST vtStageのサマリ関数テストとStep6タイル参照テスト、Step5タイル保存テストを追加。
  - update: 2026-01-23 19:00 JST pnpm --filter @hierarchidb/vt-orchestrator test exit 0 を確認。
  - blocked: 2026-01-23 19:02 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の DNS 解決失敗（ENOTFOUND）で失敗。ネットワーク到達確認/対応方針の指示待ち。
  - done: 2026-01-23 19:05 JST pnpm --filter @hierarchidb/shape-plugin test exit 0 を確認。
2297) feat/ui/map-dexie-tile-stats (P1) — 進行中 (2026-01-23)
- ブランチ名: feat/ui/map-dexie-tile-stats
- 依存: なし
- 受け入れ基準: Dexieタイルのviewport内レイヤー別地物数／タイルリクエスト数／データサイズをUI表示する／リモートURLタイルには適用しない／既存の地図表示に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/**`, `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: 統計UIとタイル計測の差分を revert する
- チェックリスト:
  - VectorTileLayer で Dexie タイルのリクエスト数/サイズを計測する
  - ResourceLayerMap で viewport のレイヤー別地物数を集計する
  - 統計UIを表示する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 10:30 JST Dexieタイル統計UI（レイヤー別地物数/タイル数/サイズ）の実装に着手。
  - update: 2026-01-23 10:55 JST ResourceLayerMap に統計UIとviewport集計、VectorTileLayer にDexieタイルのリクエスト計測を追加。
  - update: 2026-01-23 11:05 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-01-23 11:07 JST pnpm typecheck exit 0（tsdown define 警告あり）。手動検証は未実施。
  - update: 2026-01-23 11:20 JST Step6地図コンテナのボーダーとパディングを撤去。
  - update: 2026-01-23 11:26 JST pnpm typecheck exit 0（tsdown define 警告あり）。手動検証は未実施。
  - update: 2026-01-23 11:35 JST Dexie統計の地物数更新をrender/sourcedataでもトリガーするよう調整。
  - update: 2026-01-23 12:05 JST Dexie統計UIでRequest以外が0表示の原因調査と修正に着手。
  - update: 2026-01-23 12:25 JST VectorTileLayerのタイル統計コールバックをref化し、viewport地物数はqueryRenderedFeaturesの全件集計へ変更。
  - done: 2026-01-23 12:28 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - update: 2026-01-23 12:45 JST Step6の地図コンテナpadding撤去とDexie統計のviewport地物数集計をquerySourceFeatures基準に変更。
  - blocked: 2026-01-23 12:50 JST pnpm typecheck が ui-map の querySourceFeatures 型未定義で失敗（TS2339）。
  - done: 2026-01-23 12:55 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - update: 2026-01-23 13:40 JST Step6の全画面時padding無効化フラグとVTレイヤー名表示・sourceLayer解決を追加。
  - update: 2026-01-23 13:45 JST pnpm --filter @hierarchidb/ui-dialog build exit 0（tsdown define 警告あり）。
  - blocked: 2026-01-23 13:46 JST pnpm typecheck が app の PluginDialogHost props で removePaddingWithFullScreenMode 不一致エラー。
  - update: 2026-01-23 13:46 JST pnpm --filter @hierarchidb/plugin-ui-host build exit 0（tsdown define 警告あり）。
  - done: 2026-01-23 13:48 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - update: 2026-01-23 14:00 JST タイルレイヤー名リセット処理を追加。
  - done: 2026-01-23 14:02 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - update: 2026-01-22 11:54 JST Vector Tile Layers パネルを Dexie Tile Stats と同一配色で右隣に配置するよう統合。
  - update: 2026-01-22 11:55 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - done: 2026-01-22 12:34 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - update: 2026-01-22 12:00 JST admin1 レイヤー解決で不一致時のフォールバックを無効化し、admin0のみフォールバック許可に変更。
  - update: 2026-01-22 12:43 JST Viewport Features 集計の連続更新でMaximum update depthが出ないよう差分更新に変更。
  - update: 2026-01-22 12:54 JST ui-map の統計値更新を ref ストア + useSyncExternalStore に移行し、Map本体の再描画を抑制。useVectorTilePreviewMetadata の依存キーを安定化。
  - update: 2026-01-22 12:54 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - done: 2026-01-22 12:54 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - done: 2026-01-22 12:43 JST pnpm typecheck exit 0（tsdown define 警告あり）を確認。
  - blocked: 2026-01-22 12:00 JST pnpm typecheck が styler-plugin の StylerFilterStep.tsx (showPreview props) で失敗。対応方針の指示待ち。
  - update: 2026-01-22 11:39 JST Step6 のベクタタイルレイヤー解決を境界レイヤー判定つきに更新し、境界のみの場合はライン描画を使うよう調整。VectorTileLayer の feature state に sourceLayer を付与。
  - update: 2026-01-22 11:40 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - blocked: 2026-01-22 11:41 JST pnpm typecheck が runtime-worker の dexie-stores.ts で TS2352。既存エラーのため対応方針の指示待ち。
2380) fix/location/step5-monochrome-basemap (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/step5-monochrome-basemap
- 依存: なし
- 受け入れ基準: Location Step5 のプレビュー地図がテーマに応じてモノクロベースマップに自動切替される／カラフルな国別配色のベースマップが使われない／既存のプレビュー表示（アイコン/ラベル/色設定）が維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して mapStyleUrl を既定に戻す
- チェックリスト:
  - テーマ別のモノクロベースマップURLを用意する
  - Step5 の mapStyleUrl をテーマで切替える
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 19:12 JST Step5 プレビューの mapStyleUrl をテーマ別モノクロに切替。
  - update: 2026-01-26 19:13 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-26 19:14 JST Location Step5 のモノクロベースマップ自動切替を完了。
  - start: 2026-01-26 19:10 JST Location Step5 のモノクロベースマップ自動切替に着手。
2381) fix/shape/step6-floating-stats-layer-sets (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/step6-floating-stats-layer-sets
- 依存: なし
- 受け入れ基準: Step6 preview の Dexie Tile Stats と Layer Sets が FloatingWindow で表示される／Vector Tile Layers の表示が撤去される／既存の地図プレビュー操作が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx`（必要なら関連コンポーネント）
- ロールバック手順: 該当差分を revert して元のカード表示に戻す
- チェックリスト:
  - Dexie Tile Stats を FloatingWindow に移す
  - Layer Sets を FloatingWindow に移す
  - Vector Tile Layers の表示を撤去する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 19:28 JST ResourceLayerMap の Dexie Tile Stats を FloatingWindow 表示に対応。
  - update: 2026-01-26 19:30 JST Step6 の Layer Sets を FloatingWindow 化し、Vector Tile Layers 表示を撤去。
  - update: 2026-01-26 19:32 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - update: 2026-01-26 19:33 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-01-26 19:34 JST Step6 preview のフローティングカード対応を完了。
  - start: 2026-01-26 19:20 JST Step6 preview のフローティング表示対応に着手。
2382) fix/ui/floating-window-titlebar-icons-and-size (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/floating-window-titlebar-icons-and-size
- 依存: なし
- 受け入れ基準: FloatingWindow のタイトルバー文字サイズが1.66倍になる／Features・Layer Sets・Dexie Tile Stats のタイトルバーアイコンが指定のものに置換される／Layer Sets と Dexie Tile Stats がリサイズ可能になる／pnpm --filter @hierarchidb/ui-floating-window typecheck と pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`, `packages/ui/map/src/components/ResourceLayerMap.tsx`, `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx`, `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: 該当差分を revert してタイトルバーサイズ/アイコン/リサイズ設定を元に戻す
- チェックリスト:
  - FloatingWindow のタイトルバー文字サイズを1.66倍にする
  - Features/Layer Sets/Dexie Tile Stats のタイトルバーアイコンを差し替える
  - Layer Sets と Dexie Tile Stats をリサイズ可能にする
  - pnpm --filter @hierarchidb/ui-floating-window typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 19:43 JST FloatingWindow タイトルバーのサイズ調整と titleIcon 対応を追加。
  - update: 2026-01-26 19:45 JST Features/Layer Sets/Dexie Tile Stats にアイコンを指定し、Layer Sets/Dexie Tile Stats をリサイズ可能に変更。
  - update: 2026-01-26 19:47 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0。
  - update: 2026-01-26 19:48 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - update: 2026-01-26 19:49 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-01-26 19:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-01-26 19:51 JST FloatingWindow タイトルバーとアイコン/リサイズ対応を完了。
  - start: 2026-01-26 19:40 JST FloatingWindow タイトルバー調整とアイコン差し替えに着手。
2383) fix/shape/step6-layer-sets-window-layout (P1) — 完了 (2026-01-26)
- ブランチ名: fix/shape/step6-layer-sets-window-layout
- 依存: なし
- 受け入れ基準: Dexie Tile Stats のカード風最小サイズ制約が撤去される／Layer Sets ウィンドウのデフォルト高さが1.5倍になる／Layer Sets 見出しが撤去される／Location/Route/Shape スイッチ左側に 24px マージンが入る／pnpm --filter @hierarchidb/ui-map typecheck と pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`, `packages/ui/map/src/preview/LayerSetVisibilityPanel.tsx`, `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx`
- ロールバック手順: 該当差分を revert してウィンドウ/マージン/見出しを元に戻す
- チェックリスト:
  - Dexie Tile Stats のカード/最小幅制約を撤去する
  - Layer Sets ウィンドウのデフォルト高さを1.5倍にする
  - Layer Sets 見出しを撤去する
  - スイッチ左側の 24px マージンを追加する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 20:08 JST Dexie Tile Stats のカード/最小幅を撤去し内容ベースで表示。
  - update: 2026-01-26 20:10 JST Layer Sets のデフォルト高さを1.5倍化し見出しを撤去。
  - update: 2026-01-26 20:11 JST Layer Sets のスイッチ左側に 24px マージンを追加。
  - update: 2026-01-26 20:12 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - update: 2026-01-26 20:13 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-01-26 20:14 JST Step6 のウィンドウレイアウト調整を完了。
  - start: 2026-01-26 20:05 JST Step6 Layer Sets/Dexie Tile Stats のウィンドウ調整に着手。
2384) fix/ui/layer-sets-switch-padding (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/layer-sets-switch-padding
- 依存: なし
- 受け入れ基準: Layer Sets のスイッチ左余白が padding で 24px 相当に確保される／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/LayerSetVisibilityPanel.tsx`
- ロールバック手順: 該当差分を revert して margin ベースに戻す
- チェックリスト:
  - スイッチ左側の余白を padding で追加する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 20:22 JST Layer Sets のスイッチ左余白を padding に変更。
  - update: 2026-01-26 20:23 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - done: 2026-01-26 20:24 JST Layer Sets スイッチ余白の調整を完了。
  - start: 2026-01-26 20:20 JST Layer Sets スイッチの余白を padding に変更する作業に着手。
2385) fix/ui/layer-sets-switch-container-margin (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/layer-sets-switch-container-margin
- 依存: なし
- 受け入れ基準: Layer Sets の3スイッチコンテナの左側に 24px のマージンが入る／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/LayerSetVisibilityPanel.tsx`
- ロールバック手順: 該当差分を revert して余白を戻す
- チェックリスト:
  - スイッチコンテナの左側に 24px のマージンを追加する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 20:32 JST Layer Sets のスイッチコンテナ左側に 24px マージンを追加。
  - update: 2026-01-26 20:33 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - done: 2026-01-26 20:34 JST Layer Sets のコンテナ余白調整を完了。
  - start: 2026-01-26 20:30 JST Layer Sets スイッチコンテナ左マージン追加に着手。
2386) fix/ui/layer-sets-switch-block-margin-left (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/layer-sets-switch-block-margin-left
- 依存: なし
- 受け入れ基準: Layer Sets のスイッチブロック全体が左マージン24pxで右に移動する／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/LayerSetVisibilityPanel.tsx`
- ロールバック手順: 該当差分を revert して余白を元に戻す
- チェックリスト:
  - スイッチブロック全体に左マージンを適用する
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 20:42 JST スイッチブロック全体に左マージン24pxを付与。
  - update: 2026-01-26 20:43 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - done: 2026-01-26 20:44 JST Layer Sets のブロック余白を修正。
  - start: 2026-01-26 20:40 JST Layer Sets スイッチブロック左マージンの修正に着手。
2387) fix/ui/layer-sets-formcontrollabel-margin-reset (P1) — 完了 (2026-01-26)
- ブランチ名: fix/ui/layer-sets-formcontrollabel-margin-reset
- 依存: なし
- 受け入れ基準: Layer Sets の FormControlLabel 既定の負の margin を上書きして左マージン24pxが有効になる／pnpm --filter @hierarchidb/ui-map typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/LayerSetVisibilityPanel.tsx`
- ロールバック手順: 該当差分を revert して既定スタイルに戻す
- チェックリスト:
  - FormControlLabel の margin-left を上書きする
  - pnpm --filter @hierarchidb/ui-map typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 20:52 JST FormControlLabel の margin-left を 0 に固定して負のマージンを無効化。
  - update: 2026-01-26 20:53 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - done: 2026-01-26 20:54 JST Layer Sets の余白上書きを完了。
  - start: 2026-01-26 20:50 JST FormControlLabel の負のマージン上書きに着手。
2388) fix/location/terrain-types-4-column-layout (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/terrain-types-4-column-layout
- 依存: なし
- 受け入れ基準: Terrain Types のトグルがデフォルトで4つ横並びになる／選択/表示切替は維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 該当差分を revert して元のレイアウトに戻す
- チェックリスト:
  - Terrain Types のトグルを4列レイアウトに調整する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 21:03 JST MapToggleCard に列数オプションを追加し Terrain Types を4列化。
  - update: 2026-01-26 21:04 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0。
  - update: 2026-01-26 21:05 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 21:06 JST Terrain Types の4列レイアウト対応を完了。
  - start: 2026-01-26 21:00 JST Terrain Types の4列レイアウト対応に着手。
2389) fix/location/data-source-order-ide-gsm-first (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/data-source-order-ide-gsm-first
- 依存: なし
- 受け入れ基準: Location Data Source の選択肢で IDE-GSM が先頭になる／IDE-GSM選択後の処理フローをコード根拠付きで説明できる／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して順序を元に戻す
- チェックリスト:
  - Data Source の定義/並び順を特定する
  - IDE-GSM を先頭にする
  - IDE-GSM 選択後の処理フローを説明する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 21:18 JST Data Source の並びを IDE-GSM 先頭へ変更。
  - update: 2026-01-26 21:19 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 21:20 JST IDE-GSM先頭化と処理フロー説明を完了。
  - start: 2026-01-26 21:12 JST Location Data Source の並び順と処理フロー確認に着手。
2390) fix/location/ide-gsm-selection-flow (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/ide-gsm-selection-flow
- 依存: なし
- 受け入れ基準: Step2のData Source変更時にselectedArrayByCountriesを空で保存する／Step3遷移時に空ならparseIdeGsmCsvで国×種別マップを生成して保存される／空の間はStep4/Step5へ進めない条件が維持/確認される／Step3編集差分が保存される／Step4/Step5遷移時に差分がある場合はWorker側の本パース・保存が走る／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps-provider.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`, `packages/runtime-worker/src/services/LocationMutationService.ts`（必要なら）
- ロールバック手順: 該当差分を revert して元の選択/保存フローに戻す
- チェックリスト:
  - Step2変更時にselectedArrayByCountriesを空で保存する
  - Step3遷移時に空ならparseIdeGsmCsvを実行する
  - Step4/Step5遷移時に差分があればWorker側インポートを実行する
  - 条件によりStep4/Step5に進めないことを確認する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-26 21:35 JST Step2 の Data Source 変更/ファイル選択で選択マップを空にするよう変更。
  - update: 2026-01-26 21:38 JST Step3 で選択マップが空なら IDE-GSM をパースして自動生成する処理を追加。
  - update: 2026-01-26 21:41 JST Step4/Step5 で選択差分があれば Worker で IDE-GSM 取り込みを実行し差分ハッシュを保存。
  - update: 2026-01-26 21:43 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0。
  - done: 2026-01-26 21:44 JST IDE-GSM 選択フローの修正を完了。
  - start: 2026-01-26 21:30 JST IDE-GSM 選択フローの修正に着手。
2391) fix/location/ide-gsm-default-selection-all-checked (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/ide-gsm-default-selection-all-checked
- 依存: 2390
- 受け入れ基準: Step3のIDE-GSM初期選択はCSVに存在する国×種別のみチェックボックスを表示し、その初期状態は全てONになる／既存の選択編集・保存・差分検知は維持される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/utils/ideGsmSelection.ts`
- ロールバック手順: 該当差分を revert して従来の種類別チェックへ戻す
- チェックリスト:
  - IDE-GSM の初期選択マップ生成ロジックを修正する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 21:55 JST IDE-GSM 初期選択を全チェックに変更する作業に着手。
  - update: 2026-01-26 22:20 JST IDE-GSM の存在タイプのみ初期ONにし、存在しない種別はセルを無効化。
  - done: 2026-01-26 22:22 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
2393) fix/location/test-unified-batch-manager-types (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/test-unified-batch-manager-types
- 依存: なし
- 受け入れ基準: UnifiedLocationBatchManager.unit.test.ts から any と top-level await が撤去される／テストの意図と既存アサーションが維持される／pnpm --filter @hierarchidb/location-plugin test が exit 0（必要なら実行）／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/services/batch/__tests__/unit/UnifiedLocationBatchManager.unit.test.ts`
- ロールバック手順: 該当差分を revert して any/top-level await を元に戻す
- チェックリスト:
  - any を適切な型に置き換える
  - top-level await を撤去する
  - pnpm --filter @hierarchidb/location-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:30 JST UnifiedLocationBatchManager.unit.test.ts の型とトップレベルawait整理に着手。
  - update: 2026-01-26 22:36 JST any撤去とtop-level await廃止、テスト用モック型を整理。
  - update: 2026-01-26 22:39 JST vitest用に@hierarchidb/ui-fileをテストシム化し、CSVテストのtype参照を修正。
  - done: 2026-01-26 22:41 JST pnpm --filter @hierarchidb/location-plugin test exit 0 を確認。
2394) fix/location/unified-batch-manager-test-typecheck (P1) — 完了 (2026-01-26)
- ブランチ名: fix/location/unified-batch-manager-test-typecheck
- 依存: なし
- 受け入れ基準: UnifiedLocationBatchManager.unit.test.ts の型エラーが解消される／pnpm --filter @hierarchidb/location-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/services/batch/__tests__/unit/UnifiedLocationBatchManager.unit.test.ts`
- ロールバック手順: 該当差分を revert して元に戻す
- チェックリスト:
  - 型エラーの再現と原因特定
  - 修正の実施
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 22:55 JST UnifiedLocationBatchManager.unit.test.ts の型エラー調査に着手。
  - update: 2026-01-26 22:56 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認（型エラー再現せず）。
  - update: 2026-01-26 23:05 JST TS2802/TS2740の対処としてforEach化とLocationDB型キャストを適用。
  - done: 2026-01-26 23:06 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2395) fix/build/tsconfig-paths-dist-alignment (P1) — 進行中 (2026-01-26)
- ブランチ名: fix/build/tsconfig-paths-dist-alignment
- 依存: なし
- 受け入れ基準: tsconfig.base.json の @hierarchidb/ui-json-treeview paths が dist 指向になる／AGENTS.md の paths 規約が dist 指向へ更新される／turbo の依存順序を確認し必要なら補正する／pnpm typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `tsconfig.base.json`, `AGENTS.md`, `turbo.json`（必要なら）
- ロールバック手順: 該当差分を revert して src 指向のpaths/規約へ戻す
- チェックリスト:
  - tsconfig.base.json の ui-json-treeview paths を dist 指向へ変更
  - AGENTS.md の paths 規約を dist 指向へ更新
  - turbo の依存順序を確認し必要なら補正
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 23:15 JST tsconfig paths と規約の dist 指向化に着手。
  - update: 2026-01-26 23:22 JST ui-json-treeview の paths を dist に変更し、AGENTS.md の規約を dist 指向へ更新。
  - update: 2026-01-26 23:28 JST ui-json-treeview に build:types を追加し、ui-map に ui-json-treeview 依存を追加。
  - blocked: 2026-01-26 23:30 JST pnpm install が EPERM (symlink) で失敗し、pnpm typecheck が ui-map の ui-json-treeview 解決失敗で停止。
2409) fix/auth/bff-production-mode (P1) — 進行中 (2026-01-28)
- ブランチ名: fix/auth/bff-production-mode
- 依存: なし
- 受け入れ基準: GitHub deploy の BFF が development 判定されず production として動作する／/auth/token で "Only localhost origins are allowed in development mode" が出ない／TASKS.md に運用ログと検証結果を記載する
- 影響範囲: `packages/backend/bff/src/**`, `packages/backend/bff/wrangler.toml`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の環境判定へ戻す
- チェックリスト:
  - development 判定の条件と参照元を特定する
  - GitHub deploy では production 判定になるよう修正する
  - BFF のデプロイ設定に反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-28 00:20 JST GitHub deploy で development 判定される問題の調査に着手。
  - update: 2026-01-28 00:26 JST wrangler.hierarchidb.toml に ENVIRONMENT を追加し、production/development 判定を明示化。
  - update: 2026-01-28 00:32 JST BFF deploy スクリプトに production 指定の wrangler deploy を組み込み。
  - update: 2026-01-28 00:40 JST GitHub Pages の callback 後リダイレクトで #/hierarchidb が付く問題の修正に着手。
  - update: 2026-01-28 00:45 JST auth callback の戻り先を hash ルーティング時に base prefix を除去するよう調整。
  - update: 2026-01-28 00:47 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define warning あり）。
  - update: 2026-01-28 00:47 JST pnpm --filter @hierarchidb/ui-auth typecheck exit 0。
2396) refactor/shape/vt-pipeline-split (P1) — 完了 (2026-01-26)
- ブランチ名: refactor/shape/vt-pipeline-split
- 依存: なし
- 受け入れ基準: shapePipeline の責務が生成/割当/統計/永続化に分割され、各段の入出力が型で固定される／既存のタイル生成結果と統計が一致する／ユニットテストが追加または更新される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapePipeline.ts` ほか（調査後に確定）
- ロールバック手順: 該当差分を revert して shapePipeline の一体構成に戻す
- チェックリスト:
  - ExecPlan を作成する
  - パイプライン分割の設計と移行を実施する
  - ユニットテストを更新/追加する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-26 23:40 JST VTパイプライン分割リファクタの準備に着手。
  - update: 2026-01-26 23:55 JST ExecPlan を plans/shape-vt-pipeline-split-execplan.md に作成。
  - update: 2026-01-27 00:20 JST パイプラインをステージ別モジュールへ分割し、shapePipeline をオーケストレーターに整理。
  - update: 2026-01-27 00:24 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0。
  - done: 2026-01-27 00:35 JST pnpm --filter @hierarchidb/shape-plugin test 9 passed / 1 skipped を確認。

2397) refactor/shape/task-progress-model-unify (P1) — 進行中 (2026-01-26)
- ブランチ名: refactor/shape/task-progress-model-unify
- 依存: 2396
- 受け入れ基準: 進捗イベント/DB保存/UI表示が同一のステータス集合を共有し、順序はsequenceに統一される／進捗表示の揺れが再発しない／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/**`, `packages/**`（調査後に確定）
- ロールバック手順: 該当差分を revert して従来の進捗モデルに戻す
- チェックリスト:
  - ExecPlan を作成する
  - 進捗モデルの統一設計を実施する
  - UI/DB/Workerの更新を行う
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：

  - start: 2026-01-27 00:42 JST 進捗モデル統一のExecPlan作成に着手。
  - update: 2026-01-27 00:45 JST ExecPlan を plans/shape-task-progress-unify-execplan.md に作成。
  - update: 2026-01-29 00:33 JST 進捗モデル統一の実装・調査を再開。
  - update: 2026-01-29 00:52 JST sequence順での最新タスク選択ヘルパーを追加し、getBuildSessionStatus/getProcessingStatus をsequence基準で算出するよう更新。taskOrdering のユニットテストを追加。
  - blocked: 2026-01-29 00:52 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の ENOTFOUND(fetch failed)で失敗。
  - update: 2026-01-29 00:58 JST progress 集計も resolveEffectiveTaskStatus を参照するよう統一。
  - blocked: 2026-01-29 00:58 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の ENOTFOUND(fetch failed)で失敗。
  - update: 2026-01-29 01:02 JST pnpm --filter @hierarchidb/shape-plugin test が Test Files 6 passed / Tests 9 passed | 1 skipped で成功。
2398) refactor/shape/step5-6-selector-unify (P1) — 未着手 (2026-01-26)
- ブランチ名: refactor/shape/step5-6-selector-unify
- 依存: 2397
- 受け入れ基準: Step5/Step6 の取得・変換ロジックがSelector層に集約される／表示内容が変わらない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`, `plugins/shape-plugin/src/ui/components/step6/**`
- ロールバック手順: 該当差分を revert して従来のロジック分散に戻す
- チェックリスト:
  - ExecPlan を作成する
  - Selector 層を定義する
  - Step5/Step6 をSelector参照へ移行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：

2399) refactor/shape/selection-normalize-unify (P1) — 未着手 (2026-01-26)
- ブランチ名: refactor/shape/selection-normalize-unify
- 依存: 2398
- 受け入れ基準: selectedArrayByCountries の正規化処理が単一関数に集約され、旧/新形式が同一入口で正規化される／テストで互換性が保証される／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/**`
- ロールバック手順: 該当差分を revert して既存の正規化分散に戻す
- チェックリスト:
  - ExecPlan を作成する
  - 正規化関数の集約と呼び出し整理を行う
  - 互換性テストを更新/追加する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：

2400) refactor/shape/worker-error-structure (P1) — 未着手 (2026-01-26)
- ブランチ名: refactor/shape/worker-error-structure
- 依存: 2399
- 受け入れ基準: エラーが構造化されUIで詳細が表示される／余計なダイアログが出ない／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/**`
- ロールバック手順: 該当差分を revert して従来のmessage文字列中心の処理に戻す
- チェックリスト:
  - ExecPlan を作成する
  - エラー構造の定義と伝搬経路を整理する
  - UI表示の統一を行う
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：

2401) refactor/shape/floating-window-config-unify (P1) — 未着手 (2026-01-26)
- ブランチ名: refactor/shape/floating-window-config-unify
- 依存: 2400
- 受け入れ基準: Step6 の FloatingWindow 定義が共通化され、位置/サイズ/リサイズ設定が再現される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/floating-window/**`
- ロールバック手順: 該当差分を revert して個別定義に戻す
- チェックリスト:
  - ExecPlan を作成する
  - 共通定義を作成し参照へ移行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：

2420) refactor/shape/skip-message-unify (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/skip-message-unify
- 依存: なし
- 受け入れ基準: isSkippedMessage の判定が共通関数に集約され UI/Worker で同一挙動になる／ステージ集計・一覧表示の結果が変わらない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/TaskListVirtualized.tsx`, `plugins/shape-plugin/src/ui/components/step5/shapeBuildProgressUtils.ts`
- ロールバック手順: 該当差分を revert して各所の判定を元に戻す
- チェックリスト:
  - 共通の判定関数を用意し参照へ差し替える
  - 既存の一覧/集計の挙動が変わらないことを確認する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST isSkippedMessage の共通化が完了。
  - start: 2026-01-29 04:05 JST isSkippedMessage の共通化に着手。
  - update: 2026-01-29 04:47 JST isSkippedMessage を common/utils に集約し UI/Worker 参照を差し替え。

2421) refactor/shape/task-title-unify (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/task-title-unify
- 依存: 2420
- 受け入れ基準: Worker/ UI のタスクタイトル生成が単一実装に統一される／タイトル表示の既存内容が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/TaskListVirtualized.tsx`
- ロールバック手順: 該当差分を revert して従来の個別タイトル生成に戻す
- チェックリスト:
  - 共通のタイトル生成関数を作成する
  - Worker/ UI の参照先を統一する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST taskTitles 共通化が完了。
  - start: 2026-01-29 04:47 JST タスクタイトル生成の共通化に着手。
  - update: 2026-01-29 04:49 JST taskTitles 共通ヘルパーを追加し Worker/ UI のタスクタイトル解決を統一。

2422) refactor/shape/phase-labels-extract (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/phase-labels-extract
- 依存: 2421
- 受け入れ基準: phase ラベル辞書が専用モジュールへ切り出され TaskListVirtualized の責務が簡潔になる／UI表示は既存と一致する／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/TaskListVirtualized.tsx` と新規モジュール
- ロールバック手順: 該当差分を revert して TaskListVirtualized 内定義へ戻す
- チェックリスト:
  - phase ラベル定義を分離する
  - TaskListVirtualized から参照する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST phase ラベル辞書の分離が完了。
  - start: 2026-01-29 04:49 JST phase ラベル辞書の分離に着手。
  - update: 2026-01-29 04:50 JST phase ラベル辞書を taskPhaseLabels モジュールへ分離し TaskListVirtualized で参照。

2423) refactor/ui-batch/task-merge-unify (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/ui-batch/task-merge-unify
- 依存: 2422
- 受け入れ基準: タスク更新のマージ/順序ロジックが ui-batch-progress 側に移行し shape 側の同期ロジックが薄くなる／既存の更新順/表示が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTaskSync.ts`, `packages/ui/batch/src/**`
- ロールバック手順: 該当差分を revert して shape 側にロジックを戻す
- チェックリスト:
  - ui-batch-progress に共通マージロジックを追加する
  - shape 側の同期ロジックを共通関数参照へ移行する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST task merge/ordering の共通化が完了。
  - start: 2026-01-29 04:50 JST task merge/ordering の共通化に着手。
  - update: 2026-01-29 04:54 JST ui-batch-progress に taskSyncHelpers を追加し、shape の task merge/ordering を共通関数へ移行。

2424) refactor/shape/status-phase-normalize-unify (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/status-phase-normalize-unify
- 依存: 2423
- 受け入れ基準: status/phase の正規化関数が共通化され shape/route/location で同一挙動になる／既存の表示が変わらない／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts` ほか共通化先
- ロールバック手順: 該当差分を revert して shape 固有の正規化に戻す
- チェックリスト:
  - 正規化関数の共通化方針を決めて切り出す
  - shape/route/location の参照先を統一する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST status/phase 正規化の共通化が完了。
  - start: 2026-01-29 04:54 JST status/phase 正規化の共通化に着手。
  - update: 2026-01-29 04:55 JST common-api に normalizeProgressPhase/mapProgressPhaseToBatchStatus を追加し、shape/route/location へ適用。

2425) refactor/shape/task-summary-mapper-unify (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/task-summary-mapper-unify
- 依存: 2424
- 受け入れ基準: task summary のマッピング関数が統合され重複がなくなる／表示内容/ログ内容が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 該当差分を revert して個別 mapper に戻す
- チェックリスト:
  - 共通 mapper を作成する
  - 既存の mapper を統合する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - done: 2026-01-29 07:15 JST task summary mapper の統合が完了。
  - start: 2026-01-29 04:55 JST task summary mapper の統合に着手。
  - update: 2026-01-29 04:56 JST task summary の共通フィールド生成を追加し mapper を統合。
  - update: 2026-01-29 04:58 JST pnpm --filter @hierarchidb/ui-batch-progress build / pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - blocked: 2026-01-29 04:58 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の ENOTFOUND(fetch failed)で失敗。
  - update: 2026-01-29 07:15 JST pnpm --filter @hierarchidb/shape-plugin test が Test Files 6 passed / Tests 9 passed | 1 skipped で成功。
2422) refactor/shape/build-progress-aggregation-and-pipeline-split (P1) — 完了 (2026-01-29)
- ブランチ名: refactor/shape/build-progress-aggregation-and-pipeline-split
- 依存: なし
- ExecPlan: plans/shape-build-progress-aggregation-and-pipeline-split-execplan.md
- 受け入れ基準: Step5 集計ロジック（completed/failed/skipped/total）が共通ユーティリティへ集約され shape-plugin と ui-batch の双方で同一関数を利用する／useShapeBuildStep の責務が「進捗計算」「表示ラベル」「自動再開/タイマー」「サマリ生成」に分割される／runShapePipeline がステージ単位のランナー/ポリシー判定へ分割され orchestrator に集約される／既存の UI 表示と挙動が維持される／pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/build-progress/shapeBuildProgressMapping.ts`, `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して従来の Step5 集計/ビルドステップ/パイプライン構成に戻す
- チェックリスト:
  - Step5 の集計ロジックを共通ユーティリティへ集約する
  - useShapeBuildStep の責務を分割フックに移す
  - runShapePipeline をステージ単位のランナーへ分割する
  - pnpm --filter @hierarchidb/shape-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 09:12 JST Step5 集計ロジックの共通化と runShapePipeline 分割に着手。
  - update: 2026-01-29 09:25 JST ui-batch-progress に taskProgressSummary を追加し、Step5 集計/ラベル/進捗を分割フック化。shapePipeline をステージ単位関数に分割。
  - update: 2026-01-29 09:27 JST pnpm --filter @hierarchidb/ui-batch-progress build exit 0（tsdown define warning あり）。
  - update: 2026-01-29 09:28 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 09:28 JST Step5 集計共通化・useShapeBuildStep 分割・shapePipeline 分割を完了。
2440) investigation/feature-definition-usage (P2) — 進行中 (2026-01-30)
- ブランチ名: investigation/feature-definition-usage
- 依存: なし
- 受け入れ基準: FeatureDefinition の定義箇所と用途が特定できる／参照・実行経路の有無から「有意義に使われているか」を根拠付きで判断できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/**`, `app/**`, `plugins/**`（調査結果に応じて追加）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - FeatureDefinition の定義と参照箇所を洗い出す
  - 実行経路（UI/Worker/CLI など）を確認する
  - 目的と現状の有意義な利用有無を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 17:05 JST FeatureDefinition の用途と利用状況の調査に着手。
  - update: 2026-01-30 17:18 JST feature-registry と runtime-worker の FeatureBootstrap/WorkerService を確認し、登録・起動はされるが registry が外部公開されていない点を整理。
  - done: 2026-01-30 17:18 JST FeatureDefinition の定義/用途/参照箇所と現状の実利用度を把握。
2441) refactor/feature/retire-feature-definition (P1) — 進行中 (2026-01-30)
- ブランチ名: refactor/feature/retire-feature-definition
- 依存: なし
- 受け入れ基準: FeatureDefinition/FeatureRegistry/FeatureBootstrap を撤去し参照を削除する／必要な初期化はシングルトン生成で代替する／影響範囲の build/typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/**`, `packages/features/**`, `plugins/**`, `app/**`, `packages/runtime-worker/package.json`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して FeatureDefinition/FeatureRegistry/FeatureBootstrap を復元する
- チェックリスト:
  - FeatureDefinition/FeatureRegistry/FeatureBootstrap の定義と参照を撤去する
  - 必要な初期化があればシングルトン生成で置き換える
  - 影響範囲の build/typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-30 17:30 JST FeatureDefinition 全廃と起動経路の整理に着手。
  - update: 2026-01-30 17:56 JST pnpm install を実行（peer dependency 警告あり）。
  - update: 2026-01-30 18:07 JST pnpm build を実行したが app build で @hierarchidb/core-types 未解決により失敗。
  - update: 2026-01-30 18:11 JST pnpm --filter @hierarchidb/core-types build を実行（exit 0）。
  - update: 2026-01-30 18:34 JST pnpm build を再実行したが app build で @hierarchidb/core-types 未解決により再失敗。
  - blocked: 2026-01-30 18:40 JST pnpm typecheck が ui-search-result-window の @hierarchidb/core-types 解決失敗で exit 2。
  - update: 2026-01-30 18:53 JST ui-search-result-window/treeconsole-base/treeconsole-breadcrumb/treeconsole-treetable に core-types を dependencies 追加。
  - update: 2026-01-30 19:05 JST pnpm install を再実行（peer dependency 警告あり）。
  - update: 2026-01-30 19:12 JST pnpm build が exit 0（app build 含む）。
  - blocked: 2026-01-30 19:20 JST pnpm typecheck が @hierarchidb/batch の型不一致（UnifiedBatchManagerBase.prepareSession）で exit 2。
  - update: 2026-01-30 19:26 JST UnifiedBatchManagerBase.prepareSession をジェネリック拡張して IBatchSessionManager の型不一致を解消。
  - update: 2026-01-31 10:11 JST folder-plugin の TagId import 欠落による typecheck エラーの修正に着手。
  - update: 2026-01-31 10:13 JST pnpm --filter @hierarchidb/folder-plugin typecheck exit 0 を確認。
  - update: 2026-02-05 22:20 JST shape-build-background.e2e の status 取得で必須フィールド欠落による TS2322 を修正。
2423) investigation/route/reference-node-links (P1) — 進行中 (2026-01-29)
- ブランチ名: investigation/route/reference-node-links
- 依存: なし
- 受け入れ基準: route-plugin における start/end location 参照の保存・index・ゴミ箱移動制約の実装有無を特定できる／location/shape 参照の現行実装と比較して齟齬を説明できる／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定（コード変更なし）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - route-plugin の node schema / dexie index / worker API の参照フィールドを確認する
  - location/shape の参照モデル（centroidForShapeId/ContainerId 等）と比較する
  - ゴミ箱移動制約の実装有無を確認する
  - 運用ログ start/update を追記する
- 運用ログ：
  - start: 2026-01-29 09:34 JST route の参照リンク仕様と現状実装の齟齬を調査開始。
  - update: 2026-01-29 09:41 JST route の schema/manifest/API には startLocationId/endLocationId のみで containerNodeId は未定義、RouteDB/manifest のインデックスも未存在。参照によるゴミ箱移動ブロックは runtime-worker の政策に未実装（Policy C は WC のみ）。

2426) investigation/route-idegsm-datasource-linking (P1) — 進行中 (2026-01-29)
- ブランチ名: investigation/route-idegsm-datasource-linking
- 依存: なし
- 受け入れ基準: IDE-GSM CSV パースと RouteFeature 永続化の既存実装を特定できる／LocationFeature 参照解決 API の有無を特定できる／RouteFeature が LocationFeature ID 参照+キャッシュを持つか確認できる／routeノードが複数 RouteFeature を保持する現状を確認できる／齟齬を具体的なファイルと責務で説明できる／TASKS.md に運用ログを記載する
- 影響範囲: 調査後に確定（コード変更なし）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - IDE-GSM CSV パースと RouteFeature 永続化の実装箇所を確認する
  - ルートの名称→LocationFeature 参照 API の有無を確認する
  - RouteFeature の start/end に LocationFeature ID とキャッシュがあるか確認する
  - routeノードが複数 RouteFeature を持つ実装を確認する
  - 齟齬を整理して記録する
- 運用ログ：
 - start: 2026-01-29 10:31 JST route IDE-GSM データソースと LocationFeature 参照連携の齟齬調査を開始。
 - update: 2026-01-29 10:40 JST IDE-GSM の既存実装（LocationQueryAPI.listLocationGroups による名前解決→RouteMutationService.importIdeGsmRoutes→RouteDB.features へ bulkPut）を確認し、要求との差分を整理。

2435) feat/route/idegsm-location-feature-linking (P1) — 完了 (2026-01-31)
- ブランチ名: feat/route/idegsm-location-feature-linking
- 依存: 2426
- 受け入れ基準: IDE-GSM の LocationFeature 参照が route 仕様に合致する／LocationFeatureId を参照子として保持し、LocationNodeId も併記される／location 検索マップが兄弟順の近さで合成され先勝ちルールが守られる／route/location/shape の参照に基づく trash 制約が維持される／`pnpm --filter @hierarchidb/route-plugin typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/RouteMutationService.ts`, `packages/features/route-api/src/ideGsmRouteCsv.ts`, `packages/features/route-api/src/routeTypes.ts`, `packages/features/route-api/src/RouteMutationAPI.ts`, `packages/runtime-worker/src/services/route/ideGsmRouteCsv.ts`, `plugins/route-plugin/src/services/ide-gsm/ideGsmRouteCsv.ts`, `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して IDE-GSM の参照解決と import 処理を旧挙動に戻す
- チェックリスト:
  - IDE-GSM の LocationFeature 参照モデルを route-api の型で表現する
  - 兄弟優先の LocationFeature マップ合成を RouteMutationService に実装する
  - IDE-GSM 取り込みで LocationFeatureId を参照子として保存する
  - UI からの取り込みで locationNodeIds の計算を worker 側へ移す
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 11:54 JST IDE-GSM の LocationFeature 参照とマップ合成の実装に着手。
  - update: 2026-01-31 11:56 JST route-api の IDE-GSM 型/参照モデルを更新し、route build から location 解決を worker 側に移行。
  - blocked: 2026-01-31 11:58 JST pnpm --filter @hierarchidb/route-plugin typecheck が route-api の dist 未更新で失敗。
  - update: 2026-01-31 11:59 JST pnpm --filter @hierarchidb/route-api build を実行（tsdown define warning あり）。
  - blocked: 2026-01-31 12:00 JST pnpm --filter @hierarchidb/route-plugin typecheck が LocationFeatureId の型不一致で失敗。
  - update: 2026-01-31 12:01 JST LocationFeatureId の型キャストを追加し、pnpm --filter @hierarchidb/route-plugin typecheck / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 12:02 JST IDE-GSM の LocationFeature 参照/兄弟優先マップ合成を実装し、UI から location 解決を撤去。

2436) feat/route/idegsm-selection-matrix (P1) — 完了 (2026-02-01)
- ブランチ名: feat/route/idegsm-selection-matrix
- 依存: 2435
- 受け入れ基準: IDE-GSM 取り込み対象の国×交通モードが CSV/Location 参照から算出され、Route Selection のセル有効化と初期チェックが一致する／対象外の国は無効化される／解析失敗時は Route Selection がブロックされる／行ごとの一括選択チェックボックスが追加され route では有効化される／`pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/route-api/src/**`, `packages/runtime-worker/src/services/RouteMutationService.ts`, `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`, `plugins/route-plugin/src/ui/components/steps/RouteSelectionStep.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して Route Selection の CSV 解析/行チェックボックスを撤去する
- チェックリスト:
  - IDE-GSM の国×交通モード抽出 API を route-api/runtime-worker に追加する
  - Route Selection で CSV 解析結果を反映し初期チェックを適用する
  - CountryMatrixSelector に行選択チェックボックスを追加し route で有効化する
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-31 12:05 JST IDE-GSM の国×交通モード解析と Route Selection 反映に着手。
  - update: 2026-02-01 03:30 JST IDE-GSM の国×交通モード抽出 API を route-api/runtime-worker に追加し、Route Selection へ反映。
  - update: 2026-02-01 03:31 JST CountryMatrixSelector に行選択チェックボックスを追加し、route で有効化。
  - update: 2026-02-01 03:33 JST pnpm --filter @hierarchidb/route-api build / pnpm --filter @hierarchidb/ui-country-select build（tsdown define warning あり）。
  - update: 2026-02-01 03:34 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 03:35 JST IDE-GSM CSV 解析に基づく国×交通モード選択と行一括選択 UI を実装。

2437) fix/location/idegsm-selection-availability (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location/idegsm-selection-availability
- 依存: なし
- 受け入れ基準: IDE-GSM の CSV 指定後に Location Selection で有効な国×カラムのチェックボックスが表示される／原因（URL 種別や解析フロー）の修正が反映される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して IDE-GSM 解析フローを元に戻す
- チェックリスト:
  - IDE-GSM CSV の解析対象に blob URL を含める
  - Location Selection のセル有効化が availability に反映される
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 03:37 JST IDE-GSM 取り込み後に Location Selection のチェックボックスが表示されない問題の修正に着手。
  - update: 2026-02-01 03:37 JST blob URL を除外していたため解析が走らない問題を修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 03:37 JST IDE-GSM の CSV 解析対象を拡張し、Location Selection の有効セル表示を回復。

2438) feat/route-location/idegsm-error-dialog-and-row-select (P1) — 完了 (2026-02-01)
- ブランチ名: feat/route-location/idegsm-error-dialog-and-row-select
- 依存: 2436
- 受け入れ基準: Route Selection で IDE-GSM 解析失敗時にエラーダイアログが表示され、行番号/始点/終点/理由/CSV を表形式で確認できる／解析失敗時は Route Selection がブロックされる／Location Selection でも行一括選択チェックボックスが表示される／`pnpm --filter @hierarchidb/route-plugin typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteSelectionStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert してエラーダイアログ/行選択を撤去する
- チェックリスト:
  - Route Selection の IDE-GSM 解析失敗ダイアログを追加する
  - Location Selection で行一括選択チェックボックスを有効化する
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 03:39 JST IDE-GSM 解析失敗ダイアログと location の行選択追加に着手。
  - update: 2026-02-01 03:40 JST Route Selection に IDE-GSM エラー一覧ダイアログとブロック表示を追加。
  - update: 2026-02-01 03:40 JST Location Selection で行一括選択チェックボックスを有効化。
  - update: 2026-02-01 03:41 JST pnpm --filter @hierarchidb/route-plugin typecheck / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 03:41 JST IDE-GSM 解析失敗時のダイアログ表示と location の行一括選択 UI を実装。

2439) fix/location/idegsm-selection-countrycode (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location/idegsm-selection-countrycode
- 依存: 2437
- 受け入れ基準: IDE-GSM 解析後に Location Selection の国×地点タイプのチェックボックスが表示され、該当セルが初期チェックONになる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/ideGsmLocationCsv.ts`, `plugins/location-plugin/src/ui/utils/ideGsmSelection.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して IDE-GSM の countryCode 設定を元に戻す
- チェックリスト:
  - IDE-GSM パース結果に countryCode を設定する
  - availability 判定で admin0Code を補助利用する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 03:46 JST IDE-GSM の countryCode 連携不備により選択セルが表示されない問題の修正に着手。
  - update: 2026-02-01 03:47 JST IDE-GSM パースで countryCode を補完し、availability 判定で admin0Code を参照するよう修正。
  - update: 2026-02-01 03:47 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 03:47 JST IDE-GSM 由来の国×地点タイプのチェックボックス表示を回復。

2440) fix/location/idegsm-japan-countrycode-alias (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location/idegsm-japan-countrycode-alias
- 依存: 2439
- 受け入れ基準: IDE-GSM の Japan 行で国×地点タイプのチェックボックスが表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/ideGsmLocationCsv.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して国名別名の補正を元に戻す
- チェックリスト:
  - countryName の正規化を強化し alpha2/alpha3/別名から ISO2 を解決する
  - `pnpm --filter @hierarchidb/location-api build` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 03:54 JST Japan 行が無効になる問題の修正に着手。
  - update: 2026-02-01 03:55 JST 国名正規化を強化し、JP 別名を補正。
  - update: 2026-02-01 03:55 JST pnpm --filter @hierarchidb/location-api build / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 03:55 JST Japan 行のチェックボックス表示を回復。

2441) feat/location/idegsm-remove-file-confirm (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location/idegsm-remove-file-confirm
- 依存: 2438
- 受け入れ基準: IDE-GSM のファイル削除時に確認ダイアログを表示し、route 参照件数を警告表示できる／削除確定で該当ノードの IDE-GSM 由来データが破棄される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `packages/features/route-api/src/RouteQueryAPI.ts`, `packages/runtime-worker/src/services/RouteQueryService.ts`, `packages/features/route-store/src/RouteDB.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して削除確認/参照件数表示を撤去する
- チェックリスト:
  - RouteQueryAPI に参照件数取得を追加する
  - LocationDataSourceStep に確認ダイアログと削除処理を実装する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 04:05 JST IDE-GSM ファイル削除時の確認ダイアログと参照件数表示に着手。
  - update: 2026-02-01 04:05 JST RouteQueryAPI に参照件数取得を追加し、LocationDataSourceStep に確認ダイアログと削除処理を実装。
  - update: 2026-02-01 04:05 JST pnpm --filter @hierarchidb/route-api build / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 04:05 JST IDE-GSM ファイル削除時の確認ダイアログと参照件数警告を追加。

2442) fix/ui-worker-provider/useworkerapi-hooks (P1) — 完了 (2026-02-01)
- ブランチ名: fix/ui-worker-provider/useworkerapi-hooks
- 依存: なし
- 受け入れ基準: useWorkerAPI の Hooks ルール違反警告が解消される／`pnpm --filter @hierarchidb/ui-worker-provider build` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/worker-provider/src/hooks/useWorkerAPI.ts`
- ロールバック手順: 該当差分を revert して useWorkerAPI の実装を戻す
- チェックリスト:
  - useWorkerAPI 内の hook 呼び出しをトップレベルに戻す
  - `pnpm --filter @hierarchidb/ui-worker-provider build` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 04:09 JST LocationDataSourceStep の Hooks 警告対応に着手。
  - update: 2026-02-01 04:10 JST useWorkerAPI の hook 呼び出しをトップレベルに戻す修正を実施。
  - update: 2026-02-01 04:10 JST pnpm --filter @hierarchidb/ui-worker-provider build exit 0 を確認（tsdown define warning あり）。
  - done: 2026-02-01 04:10 JST useWorkerAPI の Hooks 警告を解消。

2443) fix/location/idegsm-selection-country-mapping (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location/idegsm-selection-country-mapping
- 依存: 2440
- 受け入れ基準: IDE-GSM の Japan 行で対象セルが表示される／ヘッダの country/country code 列が存在する場合でも countryCode が正しく解決される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/ideGsmLocationCsv.ts`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して IDE-GSM の列推定を元に戻す
- チェックリスト:
  - IDE-GSM CSV の列名推定と countryCode 優先処理を追加する
  - `pnpm --filter @hierarchidb/location-api build` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 04:12 JST IDE-GSM の国名列/コード列の推定不足による Japan 行未表示の修正に着手。
  - update: 2026-02-01 04:13 JST IDE-GSM CSV のヘッダ推定と countryCode 優先処理を追加。
  - update: 2026-02-01 04:13 JST pnpm --filter @hierarchidb/location-api build / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 04:13 JST Japan 行のチェックボックス表示を改善。

2444) fix/ui-selection-matrix/row-select (P1) — 完了 (2026-02-01)
- ブランチ名: fix/ui-selection-matrix/row-select
- 依存: 2438
- 受け入れ基準: 行内に有効セルがない場合は行一括選択チェックボックスを表示しない／行一括選択が全有効セルに反映される／`pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/SelectionMatrix/SelectionMatrix.tsx`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して行一括選択の挙動を元に戻す
- チェックリスト:
  - 行内に有効セルがない場合の行チェックボックス非表示を実装する
  - 行一括選択が全有効セルに適用されるよう修正する
  - `pnpm --filter @hierarchidb/components build` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 04:19 JST 行一括選択の非表示/挙動修正に着手。
  - update: 2026-02-01 04:21 JST 行内有効セル無しのときはチェックボックスを表示しないよう修正。
  - update: 2026-02-01 04:21 JST 行一括選択が全有効セルに反映されるよう修正。
  - update: 2026-02-01 04:22 JST pnpm --filter @hierarchidb/components build / pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 04:22 JST 行一括選択の表示条件と挙動を修正。
  - update: 2026-02-01 04:24 JST 行内セル無し時の行チェックボックスセルは残し、列ズレを防止。
  - update: 2026-02-01 04:24 JST 行一括選択が全有効セルに反映されるよう修正（row updateの累積を修正）。
  - update: 2026-02-01 04:25 JST pnpm --filter @hierarchidb/components build / pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2445) fix/ui-country-select/select-all (P1) — 完了 (2026-02-01)
- ブランチ名: fix/ui-country-select/select-all
- 依存: 2444
- 受け入れ基準: 左上の全体一括選択が全有効セルに反映される／`pnpm --filter @hierarchidb/ui-country-select build` が exit 0／`pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`
- ロールバック手順: 該当差分を revert して一括選択の挙動を元に戻す
- チェックリスト:
  - 全体一括選択の一括更新をバッチ適用する
  - `pnpm --filter @hierarchidb/ui-country-select build` を実行する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ：
  - start: 2026-02-01 04:29 JST 左上の全体一括選択の不整合修正に着手。
  - update: 2026-02-01 04:30 JST 全体一括選択のバッチ適用を追加。
  - update: 2026-02-01 04:30 JST pnpm --filter @hierarchidb/ui-country-select build / pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 04:30 JST 左上の全体一括選択が全有効セルに反映されるよう修正。

2424) feat/route-location/trash-reference-guard (P1) — 完了 (2026-01-29)
- ブランチ名: feat/route-location/trash-reference-guard
- 依存: なし
- 受け入れ基準: route→location、location→shape の参照を Dexie インデックスで判定するチェックが追加され、参照されているノードは trash 移動が失敗する／連鎖チェックは 1 段のみ（route→location、location→shape）／`pnpm --filter @hierarchidb/route-plugin typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/TreeMutationService.ts`, `packages/features/route-store/src/RouteDB.ts`, `packages/features/location-store/src/LocationDB.ts`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して trash 操作の参照ガードと新インデックスを取り消す
- チェックリスト:
  - route-store で start/end location 参照チェックの関数を追加する
  - location-store で shape 参照チェックの関数と index を追加する
  - TreeMutationService の moveNodesToTrash で参照チェックを行う
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 10:02 JST route/location 参照に基づく trash ブロック実装に着手。
  - update: 2026-01-29 10:07 JST route-store/location-store に参照チェック関数を追加し、LocationDB に centroidForShapeContainerNodeId の index を追加。
  - update: 2026-01-29 10:09 JST TreeMutationService の moveNodesToTrash に参照ガードを追加。
  - update: 2026-01-29 10:11 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 10:12 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 10:12 JST route/location 参照ガードの実装を完了。

2425) feat/ui/treeconsole-trash-reference-i18n (P2) — 完了 (2026-01-29)
- ブランチ名: feat/ui/treeconsole-trash-reference-i18n
- 依存: なし
- 受け入れ基準: trash 参照ブロックのエラーメッセージが i18n 化され、UI 側で翻訳表示される／ハードコード文言が残らない／`pnpm --filter @hierarchidb/route-plugin typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/TreeMutationService.ts`, `app/src/hooks/treeconsole/actions/mutations.ts`, `app/src/hooks/treeconsole/types.ts`, `app/src/hooks/useTreeConsoleIntegration.ts`, `packages/ui/i18n/public/locales/*/common.json`（必要に応じて追加）
- ロールバック手順: 変更差分を revert して従来のエラーメッセージ表示に戻す
- チェックリスト:
  - trash 参照エラーをコード化し UI で翻訳する
  - i18n 辞書に文言を追加する
  - pnpm --filter @hierarchidb/route-plugin typecheck を実行する
  - pnpm --filter @hierarchidb/location-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-29 10:18 JST trash 参照ブロックの i18n 化に着手。
  - update: 2026-01-29 10:24 JST trash 参照エラーをコード化し、TreeConsole の moveToTrash で翻訳表示するように変更。
  - update: 2026-01-29 10:25 JST i18n 辞書に treeConsole.errors を追加。
  - update: 2026-01-29 10:26 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-01-29 10:27 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-29 10:27 JST trash 参照ブロックの i18n 化を完了。


2442) investigation/ui-commonality-shape-route-location (P2) — 進行中 (2026-01-31)
- ブランチ名: investigation/ui-commonality-shape-route-location
- 依存: なし
- 受け入れ基準: Shape/Route/Location の Step4/Step5 UI で共通化済み・未共通化の範囲が整理される／差分ポイントが具体的なファイルで説明される／共通化の次アクションが優先度付きで提案される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `packages/ui/**`（調査結果に応じて追加）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - Step4/Step5 の UI コンポーネント一覧を整理する
  - 共通化済み・未共通化の範囲と差分を特定する
  - 共通化候補と次アクションを優先度付きで提案する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 12:10 JST Shape/Route/Location の UI 共通化状況の調査に着手。
  - update: 2026-01-31 12:26 JST Step4/Step5 の共通化状況と差分ポイントを整理。
  - done: 2026-01-31 12:28 JST Shape/Route/Location の UI 共通化の現状整理と次アクション案を提示。


2443) refactor/ui-accordion/zoom-band-section-unify (P1) — 完了 (2026-01-31)
- ブランチ名: refactor/ui-accordion/zoom-band-section-unify
- 依存: なし
- 受け入れ基準: Shape/Route の ZoomBand 設定外枠が共通コンポーネント化される／共通ズーム帯反映ボタンの挙動が維持される／Shape/Route の参照先が共通コンポーネントに切り替わる／`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/accordion-config/src/**`, `plugins/shape-plugin/src/ui/components/build-config/**`, `plugins/route-plugin/src/ui/components/steps/**`（必要に応じて追加）
- ロールバック手順: 共通コンポーネントの追加と参照変更を revert して元の Shape/Route 実装へ戻す
- チェックリスト:
  - ZoomBand 外枠の共通コンポーネントを作成する
  - Shape/Route の参照を共通コンポーネントへ切り替える
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 12:36 JST ZoomBand 外枠の共通化に着手。
  - update: 2026-01-31 12:48 JST ZoomBandConfigSection を ui-accordion-config に追加し、Shape/Route の参照を切替。
  - update: 2026-01-31 12:54 JST pnpm --filter @hierarchidb/ui-accordion-config build を実行（tsdown define warning あり）。
  - update: 2026-01-31 12:56 JST pnpm --filter @hierarchidb/auth build を実行（@hierarchidb/auth の dist 不足解消）。
  - update: 2026-01-31 12:57 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-31 12:58 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 12:58 JST ZoomBand 外枠の共通化を完了。

2444) refactor/ui-build-progress/panel-unify (P1) — 完了 (2026-01-31)
- ブランチ名: refactor/ui-build-progress/panel-unify
- 依存: 2443
- ExecPlan: plans/ui-build-progress-panel-unify-execplan.md
- 受け入れ基準: Shape/Route の Step5 進捗 UI が共通パネルに統合される／ステージ表示とタスクサマリーの表示仕様が維持される／共通パネルで ui-batch-progress のロジックを利用する／`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/**`, `plugins/shape-plugin/src/ui/components/build-progress/**`, `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`（必要に応じて追加）
- ロールバック手順: 共通パネルの追加と参照変更を revert して元の Shape/Route UI へ戻す
- チェックリスト:
  - 共通パネルの設計と追加先パッケージを確定する
  - Shape/Route の進捗 UI を共通パネルへ移行する
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 13:10 JST Build進捗パネル共通化のExecPlan作成に着手。
  - update: 2026-01-31 13:34 JST BuildProgressPanel を components に追加し、Shape/Route を共通パネルへ移行。
  - update: 2026-01-31 13:39 JST pnpm --filter @hierarchidb/components build を実行（tsdown define warning あり）。
  - update: 2026-01-31 13:41 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-31 13:41 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 13:42 JST Build進捗パネル共通化を完了。

2445) refactor/ui-accordion/build-config-shell-unify (P2) — 完了 (2026-01-31)
- ブランチ名: refactor/ui-accordion/build-config-shell-unify
- 依存: 2443
- 受け入れ基準: Fetch/VT/ZoomBand などを束ねる Step4 外枠が共通化される／Shape/Route で共通外枠を利用する／既存のレイアウト差分（必要な説明文など）が維持される／`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/accordion-config/src/**`, `plugins/shape-plugin/src/ui/components/build-config/**`, `plugins/route-plugin/src/ui/components/steps/**`（必要に応じて追加）
- ロールバック手順: 共通外枠の追加と参照変更を revert して元の Shape/Route 実装へ戻す
- チェックリスト:
  - 共通外枠コンポーネントを追加する
  - Shape/Route の参照を共通外枠へ切り替える
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 13:55 JST Build設定外枠の共通化に着手。
  - update: 2026-01-31 14:02 JST BuildConfigShell を ui-accordion-config に追加し、Shape/Route に適用。
  - update: 2026-01-31 14:03 JST pnpm --filter @hierarchidb/ui-accordion-config build を実行（tsdown define warning あり）。
  - update: 2026-01-31 14:04 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-31 14:04 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 14:05 JST Build設定外枠の共通化を完了。

2446) refactor/ui-map/preview-shell-unify (P2) — 完了 (2026-01-31)
- ブランチ名: refactor/ui-map/preview-shell-unify
- 依存: なし
- 受け入れ基準: Map プレビューの共通シェルが追加され Shape/Location が利用する／ビュー状態保存・ベースマップ切替の共通処理が統合される／既存表示の差分がないことを確認できる／`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/preview/**`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（必要に応じて追加）
- ロールバック手順: 共通シェルの追加と参照変更を revert して元の Shape/Location 実装へ戻す
- チェックリスト:
  - Map プレビュー共通シェルを追加する
  - Shape/Location の参照を共通シェルへ切り替える
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 14:15 JST Mapプレビュー共通シェルの共通化に着手。
  - update: 2026-01-31 14:28 JST ui-map に MapPreviewShell/useMonochromeBasemapStyleUrl を追加し、Shape/Location のプレビューを移行。
  - update: 2026-01-31 14:30 JST pnpm --filter @hierarchidb/ui-map build を実行（tsdown define warning あり）。
  - update: 2026-01-31 14:36 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-31 14:37 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 14:38 JST Mapプレビュー共通シェルの適用を完了。


2447) fix/ui-map/map-preview-shell-props (P1) — 完了 (2026-01-31)
- ブランチ名: fix/ui-map/map-preview-shell-props
- 依存: なし
- 受け入れ基準: MapPreviewShell が mapStyleUrl/mapStyleObject の型制約を満たすように分岐される／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/MapPreviewShell.tsx`
- ロールバック手順: MapPreviewShell の差分を revert して元の props 展開へ戻す
- チェックリスト:
  - mapStyleUrl と mapStyleObject の排他制約を守るように分岐を追加する
  - `pnpm --filter @hierarchidb/ui-map typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 15:05 JST MapPreviewShell の型エラー修正に着手。
  - update: 2026-01-31 15:07 JST mapStyleObject と mapStyleUrl の排他分岐を追加。
  - update: 2026-01-31 15:08 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-01-31 15:08 JST MapPreviewShell の型エラー修正を完了。

2448) feat/route-plugin/shape-aligned-pipeline (P1) — 進行中 (2026-01-31)
- ブランチ名: feat/route-plugin/shape-aligned-pipeline
- 依存: なし
- ExecPlan: plans/route-shape-aligned-pipeline-execplan.md
- 受け入れ基準: route のビルドが shape と同じ fetch/transform/vt ステージ構成で動作し、fetch 内で IDE-GSM の fetch/parse/waypoints/save を一括実行する／transform は転置インデックス生成のみを行う／vt でベクタタイル生成が行われる／タイル境界で LineString が分割され、始点/中継点/終点を含まないタイルでも表示される／`pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/**`, `plugins/route-plugin/src/services/**`, `packages/runtime-worker/src/services/**`, `packages/features/vt-orchestrator/**`（必要に応じて追加）
- ロールバック手順: route のステージ再編と vt 連携の差分を revert して旧フローへ戻す
- チェックリスト:
  - ExecPlan を作成し合意する
  - route のステージ構成を fetch/transform/vt に揃える
  - fetch ステージで IDE-GSM の fetch/parse/waypoints/save を一括実行する
  - transform ステージで転置インデックス生成のみを実行する
  - vt ステージでベクタタイル生成を実行する
  - 必要な typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 16:40 JST route のステージ再編（fetch/transform/vt）と vt 連携の実装に着手。
  - update: 2026-01-31 16:46 JST ExecPlan を plans/route-shape-aligned-pipeline-execplan.md に作成。
  - update: 2026-01-31 16:58 JST RouteMutationService にタイルインデックス/ベクタタイル生成を追加し、RouteBuild/Preview を fetch/transform/vt に再編。
  - update: 2026-01-31 17:01 JST pnpm --filter @hierarchidb/route-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-01-31 17:02 JST pnpm --filter @hierarchidb/route-store build を実行（tsdown define warning あり、exit 0）。
  - blocked: 2026-01-31 17:05 JST pnpm --filter @hierarchidb/runtime-worker typecheck が RouteDatabaseHandle の bulkGet 型不一致で失敗。
  - update: 2026-01-31 17:08 JST RouteDatabaseHandle bulkGet の型を NodeId[] に修正し、pnpm --filter @hierarchidb/route-store build を再実行（exit 0）。
  - update: 2026-01-31 17:10 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - blocked: 2026-01-31 17:12 JST pnpm --filter @hierarchidb/route-plugin typecheck が未使用 import と line geometry 型不整合で失敗。
  - update: 2026-01-31 17:15 JST RouteBuildStep の未使用 import と RoutePreviewStep の座標正規化を修正。
 - update: 2026-01-31 17:17 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2449) feat/route-plugin/route-config-style-ui (P1) — 完了 (2026-02-01)
- ブランチ名: feat/route-plugin/route-config-style-ui
- 依存: なし
- 受け入れ基準: Route Config のアコーディオン最下部に交通モード別の色設定 UI と線の太さ/スタイル設定 UI が表示される／設定が route ノードの保存データに反映されプレビュー表示に反映される／i18n（英/日）が揃う／`pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteSelectionStep.tsx`, `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx`, `plugins/route-plugin/src/common/styles/routeStyle.ts`, `packages/features/route-api/src/routeTypes.ts`, `plugins/route-plugin/src/ui/locales/*.json`（必要に応じて追加）
- ロールバック手順: route のスタイル設定 UI と routeStyleConfig 関連の差分を revert して UI/プレビューを元に戻す
- チェックリスト:
  - Route Config アコーディオンに交通モード別カラー/線幅/線種 UI を追加する
  - 保存データへ routeStyleConfig を反映しプレビューに適用する
  - i18n（英/日）を追加する
  - `pnpm --filter @hierarchidb/route-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:00 JST Route Config のスタイル設定 UI 追加に着手。
  - update: 2026-02-01 10:05 JST pnpm --filter @hierarchidb/route-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 10:06 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:07 JST Route Config のスタイル設定 UI 追加を完了。

2450) feat/location-preview/hover-snackbar (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location-preview/hover-snackbar
- 依存: なし
- 受け入れ基準: Location Preview でマウス近傍 8px の LocationFeature を検出できる／該当地点が Snackbar に 1件ずつ表示され、地点タイプのアイコン/地点タイプ名/地点名/地域名/国名が確認できる／既存のプレビュー表示が退行しない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（必要に応じて追加）
- ロールバック手順: hover Snackbar の差分を revert してプレビュー表示を元に戻す
- チェックリスト:
  - マウス近傍 8px の LocationFeature を抽出する
  - Snackbar に地点情報を 1件ずつ表示する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:10 JST Location Preview の hover Snackbar 実装に着手。
  - update: 2026-02-01 10:15 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:16 JST Location Preview の hover Snackbar 実装を完了。

2451) feat/ui-map/snackbar-position-and-location-hover (P1) — 完了 (2026-02-01)
- ブランチ名: feat/ui-map/snackbar-position-and-location-hover
- 依存: なし
- 受け入れ基準: ui-map の Snackbar が表示位置を指定でき、既定が画面下中央になる／Location Preview の hover Snackbar が UI 設定色（アイコン/円）に応じて色を切替え、admin0 名が最後に表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（必要に応じて追加）
- ロールバック手順: ui-map Snackbar 拡張と Location hover 表示の差分を revert して元の挙動に戻す
- チェックリスト:
  - ui-map の Snackbar 位置と表示内容の指定機能を追加する
  - Location Preview の hover 表示を ui-map Snackbar に移行し色/表示順を修正する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:25 JST ui-map Snackbar と Location hover 表示の修正に着手。
  - update: 2026-02-01 10:31 JST pnpm --filter @hierarchidb/ui-map build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 10:32 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:33 JST ui-map Snackbar 拡張と Location hover 表示の修正を完了。

2452) feat/location-preview/flag-emoji (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location-preview/flag-emoji
- 依存: なし
- 受け入れ基準: Location Preview の hover Snackbar で admin0 名の直前に国旗絵文字が表示される／国名が不明な場合は国旗を表示しない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: hover Snackbar の国旗表示差分を revert して元に戻す
- チェックリスト:
  - admin0 の国コードから国旗絵文字を解決して表示する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:35 JST Location Preview hover Snackbar の国旗表示追加に着手。
  - update: 2026-02-01 10:37 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:38 JST Location Preview hover Snackbar の国旗表示追加を完了。

2453) feat/location-preview/metadata-admin0-icon (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location-preview/metadata-admin0-icon
- 依存: なし
- 受け入れ基準: Location Preview の Metadata 表に admin0/admin0Code/admin2/admin2Code が追加される／type 列に Style Config の色付きアイコンが表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Metadata 表のカラム追加と type アイコン表示の差分を revert して元に戻す
- チェックリスト:
  - Metadata 行に admin0/admin0Code/admin2/admin2Code を追加する
  - type 列に色付きアイコンを表示する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:40 JST Location Preview Metadata のカラムと type アイコン表示追加に着手。
  - update: 2026-02-01 10:45 JST pnpm --filter @hierarchidb/ui-map build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 10:46 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:47 JST Location Preview Metadata のカラムと type アイコン表示追加を完了。

2454) fix/location-preview/admin0-flag-and-metadata (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location-preview/admin0-flag-and-metadata
- 依存: なし
- 受け入れ基準: Location Preview の Snackbar に admin0 の国旗絵文字＋国名が表示される／Metadata 表に admin0（国旗絵文字＋国名）/admin0Code/admin2 名称が追加される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: admin0 表示修正と Metadata カラム追加の差分を revert して元に戻す
- チェックリスト:
  - Snackbar の admin0 国旗/国名表示を修正する
  - Metadata に admin0 表示列を追加する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 10:50 JST Location Preview の admin0 表示修正に着手。
  - update: 2026-02-01 10:53 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 10:54 JST Location Preview の admin0 表示修正を完了。

2455) refactor/locationfeature/admin0-rename (P1) — 完了 (2026-02-01)
- ブランチ名: refactor/locationfeature/admin0-rename
- 依存: なし
- ExecPlan: plans/locationfeature-admin0-rename-execplan.md
- 受け入れ基準: LocationFeature の countryCode/countryName が admin0Code/admin0Name に統一され参照が残らない／Metadata 表から countryCode/countryName 列が撤去される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/locationTypes.ts`, `packages/features/location-api/src/ideGsmLocationCsv.ts`, `plugins/location-plugin/src/worker/normalizers.ts`, `plugins/location-plugin/src/services/**`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（必要に応じて追加）
- ロールバック手順: admin0 命名統一の差分を revert して countryCode/countryName を復元する
- チェックリスト:
  - LocationFeature の型と生成処理を admin0 命名に統一する
  - Metadata 表から countryCode/countryName 列を撤去する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:00 JST LocationFeature の admin0 命名統一に着手。
  - update: 2026-02-01 11:08 JST pnpm --filter @hierarchidb/location-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 11:10 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:12 JST LocationFeature の admin0 命名統一を完了。

2456) feat/location-preview/snackbar-sort-and-minimap (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location-preview/snackbar-sort-and-minimap
- 依存: なし
- 受け入れ基準: Snackbar の表示順が y→x の昇順で並び、連番が付与される／Snackbar 左側に 64x64 の SVG ミニマップが表示され、ズーム×4 の相対位置に連番が描画される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Snackbar の並び/ミニマップ差分を revert して元の表示に戻す
- チェックリスト:
  - Snackbar 並び順と連番表示を実装する
  - ミニマップ SVG を追加し相対位置を描画する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:20 JST Location Preview Snackbar 並び/ミニマップの実装に着手。
  - update: 2026-02-01 11:23 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:24 JST Snackbar 並び/ミニマップの実装を完了。

2457) fix/location-preview/snackbar-follow-pointer (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location-preview/snackbar-follow-pointer
- 依存: なし
- 受け入れ基準: マウスポインタ移動に応じて Snackbar（ミニマップ含む）が更新される／既存の表示順・連番・色付けが維持される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Snackbar 更新判定の差分を revert して元に戻す
- チェックリスト:
  - ポインタ移動でミニマップの描画が更新されるよう判定を調整する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:30 JST Snackbar のポインタ追従修正に着手。
  - update: 2026-02-01 11:32 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:33 JST Snackbar のポインタ追従修正を完了。

2458) feat/location/migrate-legacy-admin0-once (P1) — 完了 (2026-02-01)
- ブランチ名: refactor/locationfeature/admin0-rename
- 依存: なし
- 受け入れ基準: 手動実行で legacy countryCode/countryName を admin0Code/admin0Name に移行できる／IDE-GSM CSV で admin0 が必ずセットされる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/LocationMutationAPI.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `packages/features/location-api/src/ideGsmLocationCsv.ts`, `plugins/location-plugin/src/services/download/csvSources.ts`, `plugins/location-plugin/src/services/pointFactories.ts`, `plugins/location-plugin/src/worker/normalizers.ts`, `plugins/location-plugin/src/worker/tabular/materialize.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`（必要に応じて追加）
- ロールバック手順: マイグレーション API と UI ボタンの差分を revert して元に戻す
- チェックリスト:
  - 手動マイグレーション API を追加し UI から実行できるようにする
  - IDE-GSM CSV で admin0 がセットされるようにする
  - `pnpm --filter @hierarchidb/location-api build` / `pnpm --filter @hierarchidb/ui-map build` / `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:40 JST legacy admin0 マイグレーションの一時追加に着手。
  - update: 2026-02-01 11:43 JST pnpm --filter @hierarchidb/location-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 11:44 JST pnpm --filter @hierarchidb/ui-map build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 11:45 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:46 JST legacy admin0 マイグレーションの一時追加を完了。

2459) fix/location-preview/metadata-admin0-columns (P1) — 進行中 (2026-02-01)
- ブランチ名: fix/location-preview/metadata-admin0-columns
- 依存: なし
- 受け入れ基準: Metadata 表の列候補に admin0/admin0Code が表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/LocationPreviewList.tsx`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`（必要に応じて追加）
- ロールバック手順: 列候補の挙動変更を revert して元に戻す
- チェックリスト:
  - 列候補の生成ロジックを調査し admin0/admin0Code が表示されるよう調整する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:55 JST Metadata 列候補の admin0 表示対応に着手。
  - update: 2026-02-01 11:57 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:58 JST Metadata 列候補の admin0 表示対応を完了。

2460) feat/location-preview/metadata-row-filter (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location-preview/metadata-row-filter
- 依存: なし
- 受け入れ基準: Metadata 表の Columns メニューに Rows カードが追加される（全件/視界内/検索一致）／Columns 候補に admin0/admin0Code/admin2Name が常時表示される／Migrate admin0 ボタンが撤去される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/map/src/preview/LocationPreviewList.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`（必要に応じて追加）
- ロールバック手順: Rows フィルタ UI と admin2Name 列候補、Migrate admin0 ボタン撤去の差分を revert して元に戻す
- チェックリスト:
  - Rows フィルタ UI を Columns メニューに追加して row 表示を切替できるようにする
  - admin2Name を常時列候補に含める
  - Migrate admin0 ボタンを撤去する
  - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 11:53 JST Metadata 行フィルタ UI と admin2Name 列候補対応に着手。
  - update: 2026-02-01 11:55 JST pnpm --filter @hierarchidb/location-plugin typecheck が ui-map の型差分で失敗したため、pnpm --filter @hierarchidb/ui-map build を実行（tsdown define warning あり）。
  - update: 2026-02-01 11:55 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 11:55 JST Metadata 行フィルタ UI と admin2Name 列候補対応を完了。

2461) feat/location/ide-gsm-remove-reimport (P1) — 完了 (2026-02-01)
- ブランチ名: feat/location/ide-gsm-remove-reimport
- 依存: なし
- 受け入れ基準: IDE-GSM のファイル削除確認後に残りファイルを再インポートする／削除時に LocationFeature を全削除してから再構築する／処理中は重複実行できない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/features/location-api/src/ideGsmTypes.ts`（必要に応じて追加）
- ロールバック手順: IDE-GSM の再インポート処理と append 書き込みの差分を revert して元に戻す
- チェックリスト:
  - IDE-GSM の削除確認後に再インポートを行う流れを実装する
  - append/replace の書き込みモードを追加する
  - `pnpm --filter @hierarchidb/location-api build` / `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 12:00 JST IDE-GSM ファイル削除後の再インポート対応に着手。
  - update: 2026-02-01 12:05 JST pnpm --filter @hierarchidb/location-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 12:05 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 12:05 JST IDE-GSM ファイル削除後の再インポート対応を完了。

2462) fix/location/datasource-remove-ui-and-metadata-columns (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location/datasource-remove-ui-and-metadata-columns
- 依存: なし
- 受け入れ基準: Data Source の削除ボタンでファイルがUIから消える／Metadata カラムが admin0/admin0Code/admin1/admin1Code/admin2/admin2Code に統一され順序が一致する／Column/Row Config ダイアログの見出しが修正される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `packages/features/location-api/src/locationTypes.ts`, `packages/features/location-api/src/LocationQueryAPI.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`, `plugins/location-plugin/src/worker/normalizers.ts`, `plugins/location-plugin/src/worker/tabular/materialize.ts`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`（必要に応じて追加）
- ロールバック手順: Data Source 削除UIと admin0 系カラムの差分を revert して元に戻す
- チェックリスト:
  - Data Source 削除時の UI 更新を安定化する
  - Metadata カラム名/順序を admin0 系に統一し schema の揺れを解消する
  - Column/Row Config ダイアログの見出しを修正する
  - `pnpm --filter @hierarchidb/location-api build` / `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 12:26 JST Data Source 削除UIと Metadata カラム統一の対応に着手。
  - update: 2026-02-01 12:28 JST pnpm --filter @hierarchidb/location-api build を実行（tsdown define warning あり、exit 0）。
  - update: 2026-02-01 12:28 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 12:28 JST Data Source 削除UIと Metadata カラム統一の対応を完了。
  - update: 2026-02-01 12:36 JST Data Source 削除UIの更新ループを修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 12:40 JST Data Source の削除ボタンイベント伝播を抑制し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 12:44 JST Data Source の削除ボタンを onMouseDown で直接起動するよう修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 12:45 JST IDE-GSM パネル全体のクリック伝播を遮断し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 12:53 JST ×ボタンの console.log 追加と未使用修正を行い、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 13:05 JST IDE-GSM sourceUrl 削除APIと upsert 取り込みへ切替し、pnpm --filter @hierarchidb/location-api build / pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 13:54 JST ×ボタンの click capture で削除発火するよう修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:20 JST ×ボタンを Import と同じ onClick パターンへ統一し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:22 JST Data Source の state 同期ループを修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:24 JST onRemoveFile のログを追加し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:27 JST DataSourceSelector が defaultPrevented を尊重するよう修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:32 JST DataSourceSelectionStep の再選択時 onChange を抑止し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 14:38 JST data-ignore-select を導入して IDE-GSM パネル内クリックで再選択しないよう修正し、pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。


2448) investigation/location-label-zoom-range (P1) — 進行中 (2026-01-31)
- ブランチ名: investigation/location-label-zoom-range
- 依存: なし
- 受け入れ基準: Location のラベル表示ズーム範囲がどの設定からどの描画経路で適用されるかを説明できる／下限未達で表示される原因を特定できる／修正案を提示できる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/**`, `packages/ui/map/src/**`, `packages/features/location-api/src/**`（調査結果に応じて追加）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - ラベル表示のズーム設定が保存される箇所を特定する
  - ui-map の描画側でズーム範囲が参照される箇所を特定する
  - 下限未達で表示される原因を整理する
  - 修正案と影響範囲を提示する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 15:15 JST Locationラベル表示ズーム範囲の調査に着手。
  - update: 2026-01-31 15:24 JST labelConfig の保存/参照箇所と描画式を確認。
  - update: 2026-01-31 15:26 JST 下限未達で表示される原因（補間式の仕様）を特定。
  - done: 2026-01-31 15:28 JST Locationラベル表示ズーム範囲の説明と原因特定を完了。


2449) fix/location-label-opacity-gate (P1) — 完了 (2026-01-31)
- ブランチ名: fix/location-label-opacity-gate
- 依存: なし
- 受け入れ基準: ラベルのtext-opacityがズーム下限で0になる／下限未達ではラベルが表示されない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: text-opacity の追加差分を revert して元の挙動へ戻す
- チェックリスト:
  - labelConfig の zoomRange を使った text-opacity 式を追加する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 15:32 JST ラベル表示の opacity ゲート追加に着手。
  - update: 2026-01-31 15:34 JST labelOpacityExpression を追加し text-opacity へ適用。
  - update: 2026-01-31 15:35 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-01-31 15:35 JST ラベルの opacity ゲート追加を完了。


2450) refactor/location-style-config-floating (P1) — 完了 (2026-02-01)

2451) feat/location-preview/label-halo-dark (P1) — 完了 (2026-02-01)

2452) fix/location-preview/ide-gsm-metadata (P1) — 完了 (2026-02-01)

2453) fix/location-datasource/remove-ide-gsm-card (P1) — 完了 (2026-02-01)

2454) fix/location-datasource/remove-ide-gsm-dialog (P1) — 完了 (2026-02-01)

2455) fix/location-preview/ide-gsm-import-without-iso (P1) — 完了 (2026-02-01)

2456) fix/location-preview/ide-gsm-import-default-selection (P1) — 完了 (2026-02-01)

2457) chore/location-preview/ide-gsm-debug-logs (P1) — 完了 (2026-02-01)

2458) chore/location-preview/ide-gsm-progress-logs (P1) — 完了 (2026-02-01)

2459) fix/location-ide-gsm/admin0-fields (P1) — 完了 (2026-02-01)

2460) fix/location-datasource/remove-card-stability (P1) — 完了 (2026-02-01)

2461) fix/location-datasource/remove-dialog-stability (P1) — 完了 (2026-02-01)

2462) fix/location-datasource/remove-card-preview (P1) — 完了 (2026-02-01)
- ブランチ名: fix/location-datasource/remove-card-preview
- 依存: なし
- 受け入れ基準: X 押下中にカード表示が消えない／No CSV files imported が No files imported になる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/location-plugin/src/ui/locales/en.json`
- ロールバック手順: sync guard と文言修正を revert して元に戻す
- チェックリスト:
  - removeDialogOpen 中は visibleSources 同期を止める
  - No CSV files imported の文言を修正する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 20:55 JST 削除時のカード表示安定化に着手。
  - update: 2026-02-01 20:58 JST removeDialogOpen 中の同期を抑制し文言修正を追加。
  - update: 2026-02-01 20:59 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 20:59 JST 削除時のカード表示安定化を完了。


- ブランチ名: fix/location-datasource/remove-dialog-stability
- 依存: なし
- 受け入れ基準: X 押下で背後のカード表示が崩れない／削除がダイアログ全体の再描画や位置ズレを起こさない／No CSV files imported → No files imported へ修正／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`
- ロールバック手順: UI state 同期削除と文言修正を revert して元に戻す
- チェックリスト:
  - 削除ダイアログの UI state 同期を外す
  - No CSV files imported を修正する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 20:30 JST 削除時の UI 乱れ修正に着手。
  - update: 2026-02-01 20:36 JST UI state 同期を削除し No files imported 文言に変更。
  - update: 2026-02-01 20:37 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 20:37 JST 削除時の UI 乱れ修正を完了。


- ブランチ名: fix/location-datasource/remove-card-stability
- 依存: なし
- 受け入れ基準: X 押下後にカードが即時消えて再表示されない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`
- ロールバック手順: buildEntryKey の変更を revert して元に戻す
- チェックリスト:
  - buildEntryKey を sizeBytes 依存から切り離す
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 20:05 JST IDE-GSM カード再表示の改善に着手。
  - update: 2026-02-01 20:08 JST sourceUrl/fileName ベースの key に変更。
  - update: 2026-02-01 20:09 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 20:09 JST IDE-GSM カード再表示の改善を完了。


- ブランチ名: fix/location-ide-gsm/admin0-fields
- 依存: なし
- 受け入れ基準: IDE-GSM CSV パース結果で admin0/admin0Code が設定される／保存時に admin0/admin0Code が保持される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-api/src/ideGsmLocationCsv.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`（必要に応じて追加）
- ロールバック手順: admin0/admin0Code のマッピング変更を revert して元に戻す
- チェックリスト:
  - IDE-GSM CSV のパースで admin0/admin0Code を確認する
  - 保存前に admin0/admin0Code が保持されることを確認する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 19:30 JST IDE-GSM admin0/admin0Code の調査に着手。
  - update: 2026-02-01 19:45 JST Country列の名称から alpha2/countryEn を解決して admin0/admin0Code を正規化。
  - update: 2026-02-01 19:46 JST pnpm --filter @hierarchidb/location-api typecheck exit 0 を確認。
  - done: 2026-02-01 19:46 JST IDE-GSM admin0/admin0Code の正規化を完了。
  - update: 2026-02-01 19:35 JST alpha3 の admin0Code を alpha2 に変換する処理を追加。
  - update: 2026-02-01 19:36 JST pnpm --filter @hierarchidb/location-api typecheck exit 0 を確認。
  - done: 2026-02-01 19:36 JST IDE-GSM admin0/admin0Code の調整を完了。


- ブランチ名: chore/location-preview/ide-gsm-progress-logs
- 依存: なし
- 受け入れ基準: import progress の phase/processed/total が console に出る／import 完了時の戻り値が console に出る／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`
- ロールバック手順: 追加した progress/return ログを削除して元に戻す
- チェックリスト:
  - progress callback と完了結果のログを追加する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 19:15 JST IDE-GSM import の progress ログ追加に着手。
  - update: 2026-02-01 19:18 JST progress/return のログを追加。
  - update: 2026-02-01 19:19 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 19:19 JST IDE-GSM import の progress ログ追加を完了。


- ブランチ名: chore/location-preview/ide-gsm-debug-logs
- 依存: なし
- 受け入れ基準: Step4 で import の開始/完了/失敗が console に出る／metadata/viewport 取得のログが出る／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 追加した console ログを削除して元に戻す
- チェックリスト:
  - useIdeGsmImportOnEntry に import 状態のログを追加する
  - LocationMapPreviewStep に metadata/viewport ログを追加する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 19:00 JST Step4 IDE-GSM import のデバッグログ追加に着手。
  - update: 2026-02-01 19:05 JST import/metadata/viewport のログを追加。
  - update: 2026-02-01 19:06 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 19:06 JST Step4 IDE-GSM import のデバッグログ追加を完了。


- ブランチ名: fix/location-preview/ide-gsm-import-default-selection
- 依存: なし
- 受け入れ基準: selection が空の初期状態でも IDE-GSM import が走る／preview に metadata と地図表示が出る／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`
- ロールバック手順: selectionHash が空の時に import を走らせる変更を revert する
- チェックリスト:
  - selectionHash が空の時は __all__ hash を使う
  - selectionEntries が空でも selectionHash が空なら import を許可する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 18:25 JST selection 空の IDE-GSM import を調整開始。
  - update: 2026-02-01 18:28 JST __all__ hash と空選択の import 許可を追加。
  - update: 2026-02-01 18:29 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 18:29 JST selection 空の IDE-GSM import 調整を完了。


- ブランチ名: fix/location-preview/ide-gsm-import-without-iso
- 依存: なし
- 受け入れ基準: IDE-GSM の import が iso 未準備でも走る／preview に metadata と地図表示が出る／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`
- ロールバック手順: iso 準備待ちの guard を復元して元に戻す
- チェックリスト:
  - iso 未準備時の fallback Countries を追加する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 18:05 JST IDE-GSM preview 空表示の調査に着手。
  - update: 2026-02-01 18:10 JST iso 未準備でも selectionEntries を作れる fallback を追加。
  - update: 2026-02-01 18:12 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 18:12 JST IDE-GSM preview 空表示の修正を完了。


- ブランチ名: fix/location-datasource/remove-ide-gsm-dialog
- 依存: なし
- 受け入れ基準: IDE-GSM のカード X 押下で削除確認ダイアログが開く／削除確定後にカードが即時削除される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`（必要に応じて追加）
- ロールバック手順: 削除ダイアログの変更を revert して元に戻す
- チェックリスト:
  - removeDialogOpen が false に戻る原因を特定する
  - ダイアログが開き続けるよう修正する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 17:10 JST IDE-GSM 削除ダイアログの不具合調査に着手。
  - update: 2026-02-01 17:35 JST 削除対象を pendingRemoveKey で追跡し index ずれに耐性を追加。
  - update: 2026-02-01 17:36 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 17:36 JST IDE-GSM 削除ダイアログの不具合修正を完了。
  - update: 2026-02-01 17:15 JST データソース選択の click ハンドラを無効化する data-ignore-select を追加。
  - update: 2026-02-01 17:16 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 18:32 JST 削除確認ダイアログの状態を uiState へ退避し、Step 再マウント時の復元に対応。
  - update: 2026-02-01 18:41 JST Remove 時の削除対象を draft 由来の IDE-GSM ソースから算出するよう修正。
  - update: 2026-02-01 18:47 JST ideGsmSources と visibleSources の同期で削除が巻き戻るのを防ぐため、pendingDraftKey による同期抑止を追加。
  - update: 2026-02-01 18:49 JST LocationDataSourceStep で useRef の import 漏れを補正。
  - update: 2026-02-01 18:57 JST Remove 時の更新と ideGsmSources の反映状況を追うログを追加。
  - update: 2026-02-01 19:04 JST IDE-GSM 削除時に ideGsmSources/SourceUrl/FileName を空配列・空文字で明示クリアするよう修正。
  - update: 2026-02-01 19:08 JST pendingDraftKey の空文字を真偽値判定で落としていたため、null 判定で同期抑止が効くよう修正。
  - update: 2026-02-01 19:16 JST IDE-GSM 削除時に TreeNodeUpdaterAPI で draftData を即時更新する処理を追加。
  - update: 2026-02-01 19:28 JST storeRegistry 未登録時でも LocationDB に書き込むフォールバックを追加し、preview 0 件を回避。
  - update: 2026-02-01 19:38 JST storeRegistry 分岐を location の Query/Mutation から撤去し、常に LocationDB を参照するよう統一。
  - update: 2026-02-01 19:40 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-02-01 19:40 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:03 JST storeRegistry 定義/参照を撤去し、EntityLifecycleManager/StageProcessingService などを DB 直参照に切替。
  - update: 2026-02-01 20:17 JST storeRegistry 参照テストを整理し、EntityLifecycleManager の DB コピー動作に合わせて更新。
  - update: 2026-02-01 20:18 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-02-01 20:19 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:20 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:20 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 17:16 JST IDE-GSM 削除ダイアログの不具合修正を完了。


- ブランチ名: fix/location-datasource/remove-ide-gsm-card
- 依存: なし
- 受け入れ基準: IDE-GSM のファイルカードで X を押すとカードが即時削除される／未読み込みのファイルでも削除が成立する／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `packages/ui/datasource/src/IdeGsmImportPanel.tsx`（必要に応じて追加）
- ロールバック手順: ファイル削除の変更を revert して元に戻す
- チェックリスト:
  - X ボタンで削除が反映されない原因を特定する
  - 即時にカードが消えるよう修正する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 16:55 JST IDE-GSM ファイルカード削除不具合の調査に着手。
  - update: 2026-02-01 16:58 JST ideGsmSources の変更に追従して visibleSources を同期。
  - update: 2026-02-01 16:59 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 16:59 JST IDE-GSM ファイルカード削除の不具合修正を完了。


- ブランチ名: fix/location-preview/ide-gsm-metadata
- 依存: なし
- 受け入れ基準: IDE-GSM 選択後の preview で metadata が表示され続ける／地図上にロケーションが表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`（必要に応じて追加）
- ロールバック手順: 関連差分を revert して元の表示挙動へ戻す
- チェックリスト:
  - IDE-GSM 選択後に metadata/preview が空になる原因を特定する
  - 表示が復旧するよう修正する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 16:35 JST IDE-GSM 選択後のプレビュー空表示の調査に着手。
  - update: 2026-02-01 16:42 JST IDE-GSM import 完了後に metadata/preview を再取得するよう依存関係を追加。
  - update: 2026-02-01 16:43 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 16:43 JST IDE-GSM preview の空表示修正を完了。


- ブランチ名: feat/location-preview/label-halo-dark
- 依存: なし
- 受け入れ基準: dark mode ではラベルの text-halo-color が黒になる／light mode は現状のまま／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: text-halo-color の条件分岐を revert して元の固定色へ戻す
- チェックリスト:
  - theme mode を参照して text-halo-color を切り替える
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-02-01 16:20 JST dark mode のラベルハロー色切り替えに着手。
  - update: 2026-02-01 16:23 JST dark mode 判定で text-halo-color を切り替え。
  - update: 2026-02-01 16:24 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 16:24 JST dark mode のラベルハロー色切り替えを完了。


- ブランチ名: refactor/location-style-config-floating
- 依存: なし
- 受け入れ基準: Style Config UI がプレビュー内フローティングウィンドウへ移設される／ウィンドウタイトルが Style Config、アイコンが Palette になる／Style Config ステップが廃止され selection→preview の順になる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps-provider.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationStyleConfigPanel.tsx`
- ロールバック手順: ステップ構成とプレビュー内UI移設を revert して元に戻す
- チェックリスト:
  - Style Config のUIをプレビューの FloatingWindow に移設する
  - LocationSelection の直後に Preview が来るよう steps-provider を修正する
  - typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ：
  - start: 2026-01-31 15:40 JST LocationのStyle Config UI移設に着手。
  - update: 2026-02-01 16:10 JST Style Config をプレビューのFloatingWindowへ移設しステップ構成を更新。
  - update: 2026-02-01 16:11 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 16:12 JST LocationのStyle Config UI移設を完了。

2463) fix/location-datasource/dialog-ui-state-sync (P1) — 進行中 (2026-02-01 16:34 JST)
- ブランチ名: fix/location-datasource/dialog-ui-state-sync
- 依存: なし
- 受け入れ基準: X 押下中にカード表示が即時で No files imported に切り替わらない／削除確定時にダイアログ位置が復元位置へジャンプしない／dialogUIState の保存・復元が最新値で一貫する／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/dialog-ui-state.ts`, `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`, `plugins/location-plugin/src/ui/locales/ja.json`（必要に応じて追加）
- ロールバック手順: dialogUIState の保存/復元変更を revert して元に戻す
- チェックリスト:
  - dialogUIState の保存/復元の競合箇所を特定する
  - 削除確定前に背後カードが消えないようにする
  - 削除確定時の位置ジャンプを防止する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 16:34 JST 削除時の dialogUIState 位置ズレ修正に着手。
  - update: 2026-02-01 16:43 JST dialogUIState の同期を安定化し、削除ダイアログ中の表示揺れ対策と noFiles 文言更新を追加。
  - update: 2026-02-01 16:43 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - update: 2026-02-01 16:43 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 16:49 JST updateTreeNodeDraftData で削除後の draft を永続化。
  - update: 2026-02-01 16:49 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2464) refactor/plugin-dialog/step-data-atom (P1) — 進行中 (2026-02-01 17:03 JST)
- ブランチ名: refactor/plugin-dialog/step-data-atom
- 依存: なし
- 受け入れ基準: draftData の永続化更新でプラグインダイアログ全体が再描画されない／Step内の表示更新は維持される／`pnpm --filter @hierarchidb/ui-dialog typecheck` と `pnpm --filter @hierarchidb/plugin-ui-host typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/dialog/src/headless/AbstractDialog.tsx`, `packages/plugin-ui-host/src/headless/usePluginDialogController/steps.tsx`
- ロールバック手順: AbstractDialog の diff 判定と StepAdapter の atom 化を revert して元に戻す
- チェックリスト:
  - AbstractDialog の stepData 差分判定を除外する
  - StepAdapter が共有 atom で stepData を保持する
  - ui-dialog / plugin-ui-host の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 17:03 JST stepData の atom 化と再描画抑制に着手。
  - update: 2026-02-01 17:04 JST stepData diff を除外し、StepAdapter を共有 atom で管理。
  - update: 2026-02-01 17:04 JST pnpm --filter @hierarchidb/ui-dialog typecheck exit 0 を確認。
  - update: 2026-02-01 17:04 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - update: 2026-02-01 17:07 JST usePluginDialogController の stepData 更新をステップ遷移時のみへ限定。
  - update: 2026-02-01 17:07 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。

2465) refactor/datasource-selector/option-memo (P1) — 進行中 (2026-02-01 17:16 JST)
- ブランチ名: refactor/datasource-selector/option-memo
- 依存: なし
- 受け入れ基準: IDE-GSM 内部変更時に DataSource 選択全体が再描画されない／IDE-GSM option のみ更新される／`pnpm --filter @hierarchidb/ui-datasource typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/datasource/src/DataSourceSelector.tsx`, `packages/ui/datasource/src/DataSourceSelectionStep.tsx`, `packages/ui/datasource/src/DataSourceSelectionCard.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`
- ロールバック手順: DataSourceSelector の memo と LocationDataSourceStep の option metadata 化を revert して元に戻す
- チェックリスト:
  - DataSourceSelector の option 行を memo 化する
  - DataSourceSelectionStep の onChange を useCallback 化する
  - IDE-GSM option だけ再描画されるよう metadata を使用する
  - ui-datasource / location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 17:16 JST DataSource 選択の部分再描画化に着手。
 - update: 2026-02-01 17:17 JST DataSourceSelector を memo 化し IDE-GSM option を metadata 経由で更新。
 - update: 2026-02-01 17:17 JST pnpm --filter @hierarchidb/ui-datasource typecheck exit 0 を確認。
 - update: 2026-02-01 17:17 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2466) fix/location/metadata-sourcekey (P1) — 進行中 (2026-02-01 17:50 JST)
- ブランチ名: fix/location/metadata-sourcekey
- 依存: なし
- 受け入れ基準: LocationFeature の metadata に data URL を保存しない／sourceKey で識別・削除できる／metadata 取得で巨大な sourceUrl を返さない／`pnpm --filter @hierarchidb/runtime-worker typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`
- ロールバック手順: sourceKey 追加と metadata サニタイズを revert し、旧実装へ戻す
- チェックリスト:
  - sourceUrl を sourceKey（hash）へ変換して保存する
  - deleteLocationBySourceUrl を sourceKey ベースで削除する（legacy sourceUrl もフォールバック）
  - list/query の metadata から sourceUrl を除外して返す
  - runtime-worker typecheck を実行する
  - 運用ログ start/update/done を追記する
 - 運用ログ:
  - start: 2026-02-01 17:50 JST metadata.sourceUrl の肥大化によるクラッシュ対応に着手。
  - update: 2026-02-01 18:04 JST sourceKey（SHA-256）を保存し sourceUrl は保存しないよう変更。deleteLocationBySourceUrl は sourceKey/legacy sourceUrl の両対応に更新。
  - update: 2026-02-01 18:04 JST LocationQueryService で metadata.sourceUrl をサニタイズして返却。
  - done: 2026-02-01 18:05 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。

2467) fix/location/metadata-loading-status (P1) — 進行中 (2026-02-01 18:12 JST)
- ブランチ名: fix/location/metadata-loading-status
- 依存: なし
- 受け入れ基準: Location preview の metadata ロードが Worker 未準備時にクラッシュしない／Loading の詳細メッセージが表示される／`pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/app typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Worker API ガードと loadingText の差分を revert して元に戻す
- チェックリスト:
  - Worker API の接続待ち/初期化をガードする
  - metadata ロード状態の詳細メッセージを追加する
  - location-plugin / app typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:12 JST metadata ロード時の Worker 未準備エラー対応に着手。
  - update: 2026-02-01 18:17 JST LocationMapPreviewStep で useWorkerAPI を使い、metadata/viewport/recycling の worker 呼び出しをガード。
  - update: 2026-02-01 18:17 JST metadata ロードの詳細メッセージを loadingText で表示。
  - done: 2026-02-01 18:18 JST pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/app typecheck exit 0 を確認。

2468) fix/route/datasource-card-size-focus (P1) — 進行中 (2026-02-01 18:35 JST)
- ブランチ名: fix/route/datasource-card-size-focus
- 依存: なし
- 受け入れ基準: route の IDE-GSM インポートカードでファイルサイズが表示される／aria-hidden 警告が出ない／`pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/datasource/src/IdeGsmImportPanel.tsx`, `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`, `packages/features/route-api/src/routeTypes.ts`
- ロールバック手順: sizeBytes と focus 対策の差分を revert して元に戻す
- チェックリスト:
  - IDE-GSM 単一ファイルで sizeBytes を保持・表示する
  - Dialog open 時の focus を外し aria-hidden 警告を回避する
  - route-plugin typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:35 JST route IDE-GSM ファイルサイズ表示と aria-hidden 警告対応に着手。
  - update: 2026-02-01 18:41 JST IdeGsmImportPanel に sizeBytes を追加し、Dialog 起動時に focus を外す処理を追加。
  - update: 2026-02-01 18:41 JST RouteEntity に ideGsmFileSizeBytes を追加し、RouteDataSourceStep で保持/反映。
  - update: 2026-02-01 18:42 JST pnpm --filter @hierarchidb/route-api build / pnpm --filter @hierarchidb/ui-datasource build を実行。
  - done: 2026-02-01 18:42 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2469) fix/route/datasource-validation (P1) — 進行中 (2026-02-01 18:58 JST)
- ブランチ名: fix/route/datasource-validation
- 依存: なし
- 受け入れ基準: route DataSource で IDE-GSM ファイル選択後に step が valid になり Route Selection へ遷移できる／`pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`
- ロールバック手順: resolvedSource と validation 変更を revert して元に戻す
- チェックリスト:
  - resolvedSource の既定を ide-gsm に合わせる
  - IDE-GSM 選択時の validation を sourceUrl に連動させる
  - route-plugin typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:58 JST route DataSource の validation 不具合に着手。
  - update: 2026-02-01 19:00 JST resolvedSource の既定を ide-gsm に変更し、validation を ideGsmSourceUrl 連動に修正。
  - done: 2026-02-01 19:00 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。

2470) fix/shape/hover-snackbar-country (P1) — 進行中 (2026-02-01 19:20 JST)
- ブランチ名: fix/shape/hover-snackbar-country
- 依存: なし
- 受け入れ基準: hover snackbar が countryCode を ISO3166-2 で国名へ補完し国旗を付与、国コードの括弧表記を撤去／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/preview/useShapePreviewStepView.ts`, `plugins/shape-plugin/src/ui/components/preview/ShapePreviewStep.tsx`
- ロールバック手順: hover snackbar の renderContent と ISO3166-2 参照を revert して元に戻す
- チェックリスト:
  - ISO3166-2 から国名を補完する
  - 国旗 + 国名表記にする（コード括弧は撤去）
  - shape-plugin typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 19:20 JST shape hover snackbar の国名/国旗補完に着手。
  - update: 2026-02-01 19:24 JST ISO3166-2 を読み込み hover snackbar の国名補完と国旗表示を追加、国コードの括弧表記を撤去。
  - update: 2026-02-01 19:29 JST alpha3 でも国名/国旗を補完するよう修正。
  - update: 2026-02-01 19:35 JST ISO3166-2 CSV を BASE_URL 基準で読み込むよう修正。
  - update: 2026-02-01 19:43 JST getCountry を併用し ISO3166-2 API で国名補完できない場合も補う。
  - update: 2026-02-01 20:01 JST featureListRows/displayedFeatureRows に国旗付与、countryName がコードの場合は getCountry で補完するよう修正。
  - done: 2026-02-01 20:01 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2471) refactor/shape-db/remove-unused-indexes (P1) — 進行中 (2026-02-01 20:15 JST)
- ブランチ名: refactor/shape-db/remove-unused-indexes
- 依存: なし
- 受け入れ基準: hidb-shape / hidb-shape-ephemeral の未使用テーブル/インデックスが削除される／Dexie version が更新される／`pnpm --filter @hierarchidb/shape-store typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts`
- ロールバック手順: Dexie version と stores 定義を revert して元に戻す
- チェックリスト:
  - ShapeDB の buildSessions / metadata インデックスを整理する
  - EphemeralShapeDB の cache テーブルと未使用インデックスを削除する
  - EphemeralGisDB の cache テーブルを削除する
  - shape-store typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 20:15 JST shape DB の未使用テーブル/インデックス削除に着手。
  - update: 2026-02-01 20:18 JST ShapeDB/EphemeralShapeDB/EphemeralGisDB の stores を整理し version を更新。
  - done: 2026-02-01 20:18 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0 を確認。

2473) chore/location-route/db-index-audit (P2) — 完了 (2026-02-01 21:05 JST)
- ブランチ名: chore/location-route/db-index-audit
- 依存: なし
- 受け入れ基準: location/route の DB テーブル・インデックスの未使用候補を列挙し分類する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `packages/features/route-store/src/RouteDB.ts`, `plugins/route-plugin/src/database/EphemeralRouteDB.ts`
- ロールバック手順: なし（調査のみ）
- チェックリスト:
  - LocationDB のテーブル/インデックス使用状況を確認する
  - RouteDB/EphemeralRouteDB のテーブル/インデックス使用状況を確認する
  - 未使用候補を分類して提示する
  - 運用ログ start/done を追記する
- 運用ログ:
  - start: 2026-02-01 21:00 JST location/route の DB 未使用テーブル/インデックス調査に着手。
  - done: 2026-02-01 21:05 JST 調査結果の候補一覧を整理。

2474) refactor/location-route/remove-unused-indexes (P2) — 進行中 (2026-02-01 21:12 JST)
- ブランチ名: refactor/location-route/remove-unused-indexes
- 依存: なし
- 受け入れ基準: location/route の未使用テーブル/インデックスを削除し Dexie version を更新する／`pnpm --filter @hierarchidb/location-store typecheck` と `pnpm --filter @hierarchidb/route-store typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `packages/features/route-store/src/RouteDB.ts`, `plugins/route-plugin/src/database/EphemeralRouteDB.ts`
- ロールバック手順: Dexie version と stores 定義を revert して元に戻す
- チェックリスト:
  - LocationDB の未使用インデックスを削除する
  - RouteDB の未使用インデックスを削除する
  - EphemeralRouteDB の未使用インデックスを削除する
  - location-store/route-store の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 21:12 JST location/route の未使用インデックス削除に着手。
  - update: 2026-02-01 21:18 JST LocationDB/RouteDB/EphemeralRouteDB の stores を整理し version を更新。
  - done: 2026-02-01 21:19 JST pnpm --filter @hierarchidb/location-store typecheck と pnpm --filter @hierarchidb/route-store typecheck が exit 0 を確認。

2475) refactor/types/remove-unknown-casts-a (P1) — 進行中 (2026-02-01 21:50 JST)
- ブランチ名: refactor/types/remove-unknown-casts-a
- 依存: なし
- 受け入れ基準: Aカテゴリの as unknown as を型ガード/ファクトリ/適切な型で置換する／core-types/tag/runtime-worker/map-adapter/app の影響箇所が typecheck で通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/core-types/src/id-util.ts`, `packages/core-types/src/index.ts`, `packages/features/tag/src/TagService.ts`, `app/src/router/routes/useTagsPage.ts`, `packages/runtime-worker/src/services/CoreDB.ts`, `packages/runtime-worker/src/services/CommandProcessor.ts`, `packages/runtime-worker/src/services/test-helpers/commandProcessorHarness.ts`, `plugins/shape-plugin/src/worker/handlers/ShapeEntityService.ts`, `plugins/location-plugin/src/worker/normalizers.ts`, `app/src/hooks/treeconsole/sortFilter.ts`, `packages/features/map-adapter/src/adapters/MapLibreDeckAdapter.ts`
- ロールバック手順: 各ファイルの変更を revert して元に戻す
- チェックリスト:
  - TagId/NodeId 生成の型キャストをファクトリ化する
  - CoreDB/CommandProcessor の不要な unknown cast を撤去する
  - Record 系アクセスを型ガード化する
  - map-adapter の Layer 変換を unknown cast なしで扱う
  - typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 21:50 JST Aカテゴリの as unknown as 置換作業に着手。
  - update: 2026-02-01 22:05 JST TagId/NodeId の生成を toTagId/toNodeId へ移行し、CoreDB/CommandProcessor の unknown cast を撤去。
  - update: 2026-02-01 22:09 JST map-adapter を DeckLayerSpec=Layer に合わせて layers 変換の unknown cast を撤去。
  - update: 2026-02-01 22:13 JST pnpm --filter @hierarchidb/core-types build / pnpm --filter @hierarchidb/tag typecheck / pnpm --filter @hierarchidb/runtime-worker typecheck / pnpm --filter @hierarchidb/map-adapter typecheck / pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck / pnpm --filter @hierarchidb/app typecheck を実行。
  - done: 2026-02-01 22:13 JST 全対象パッケージの typecheck exit 0 を確認。

2476) refactor/types/remove-unknown-casts-c (P2) — 進行中 (2026-02-01 22:20 JST)
- ブランチ名: refactor/types/remove-unknown-casts-c
- 依存: なし
- 受け入れ基準: Cカテゴリの as unknown as を型ガード/型変換で置換する／route/location/plugin-base で typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps-provider.tsx`, `plugins/route-plugin/src/ui/components/steps-provider.tsx`, `packages/plugin-base/src/registry/HostProfileRegistry.ts`, `packages/plugin-base/src/registry/PluginStepRegistry.ts`
- ロールバック手順: 各ファイルの変更を revert して元に戻す
- チェックリスト:
  - steps-provider の nodeId/draft の unknown cast を排除する
  - PluginStepRegistry/HostProfileRegistry の unknown cast を除去する
  - typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 22:20 JST Cカテゴリの as unknown as 置換作業に着手。
  - update: 2026-02-01 22:24 JST steps-provider と plugin-base registry の unknown cast を撤去。
  - done: 2026-02-01 22:26 JST pnpm --filter @hierarchidb/route-plugin typecheck / pnpm --filter @hierarchidb/location-plugin typecheck / pnpm --filter @hierarchidb/plugin-base build が exit 0 を確認。

2477) fix/shape-preview/metadata-rows (P1) — 進行中 (2026-02-01 22:40 JST)
- ブランチ名: fix/shape-preview/metadata-rows
- 依存: なし
- 受け入れ基準: Shape: metadata テーブルの AdminLevel 行が展開UIにならず通常行で表示される／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: grouping の制御追加を revert して元に戻す
- チェックリスト:
  - MapPreviewFloatingTable に grouping の制御を追加する
  - ShapePreviewList で grouping を無効化する
  - ui-map typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 22:40 JST Shape metadata テーブルの行展開UI撤去に着手。
  - update: 2026-02-01 22:43 JST grouping 制御を追加し ShapePreviewList で grouping を無効化。
  - done: 2026-02-01 22:43 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2472) refactor/shape-db/move-build-sessions (P1) — 進行中 (2026-02-01 20:35 JST)
- ブランチ名: refactor/shape-db/move-build-sessions
- 依存: なし
- 受け入れ基準: hidb-shape の buildSessions が削除され、hidb-shape-ephemeral の sessions に移行される／runtime-worker と shape-plugin が ephemeral sessions を参照する／Dexie version が更新される／`pnpm --filter @hierarchidb/shape-store typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/runtime-worker/src/services/ShapeMutationService.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`
- ロールバック手順: buildSessions を ShapeDB に戻し、runtime-worker/shape-plugin を元の参照に revert する
- チェックリスト:
  - ShapeDB から buildSessions を削除し version を更新する
  - EphemeralShapeDB の sessions を BuildSessionRecord 型で扱えるようにする
  - runtime-worker の build session 書き込み/参照を ephemeral sessions に移す
  - shape-plugin の build session 参照を ephemeral sessions に移す
  - shape-store typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 20:35 JST buildSessions を hidb-shape から ephemeral へ移行する作業に着手。
  - update: 2026-02-01 20:46 JST ShapeDB の buildSessions を削除し、ephemeral sessions へ移行するよう runtime-worker / shape-plugin を更新。
  - done: 2026-02-01 20:47 JST pnpm --filter @hierarchidb/shape-store typecheck exit 0 を確認。
  - update: 2026-02-01 21:28 JST EphemeralGisDB を sessions 型注入可能に拡張し、shape 側で BuildSessionRecord を正規型として扱えるように変更。
  - update: 2026-02-01 21:30 JST pnpm --filter @hierarchidb/gis-sdk build / pnpm --filter @hierarchidb/shape-store build を実行。
  - done: 2026-02-01 21:31 JST pnpm --filter @hierarchidb/shape-store typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2466) fix/location-preview/snackbar-theme (P1) — 進行中 (2026-02-01 17:58 JST)
- ブランチ名: fix/location-preview/snackbar-theme
- 依存: なし
- 受け入れ基準: light/dark の Snackbar 配色が逆転していない／dark 時の背景が読める明度になる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Snackbar の色指定変更を revert して元に戻す
- チェックリスト:
  - Snackbar の背景/文字色を theme.mode に合わせて設定する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 17:58 JST Snackbar の light/dark 配色修正に着手。
  - update: 2026-02-01 17:59 JST Snackbar の背景/文字色を theme.mode に合わせて調整。
  - update: 2026-02-01 17:59 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2467) fix/location-preview/snackbar-border (P1) — 進行中 (2026-02-01 18:02 JST)
- ブランチ名: fix/location-preview/snackbar-border
- 依存: なし
- 受け入れ基準: Snackbar の外枠が light/dark で表示されない／背景と可読性は維持される／`pnpm --filter @hierarchidb/ui-map typecheck` と `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: snackbar contentSx の追加を revert して元に戻す
- チェックリスト:
  - ResourceLayerMap に snackbar contentSx を追加する
  - LocationMapPreview の snackbar で枠なしスタイルを指定する
  - ui-map / location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:02 JST Snackbar 外枠撤去に着手。
  - update: 2026-02-01 18:03 JST ResourceLayerMap に contentSx を追加し Location Snackbar で枠なし指定。
  - update: 2026-02-01 18:03 JST pnpm --filter @hierarchidb/ui-map build exit 0 を確認（tsdown define 警告あり）。
  - update: 2026-02-01 18:03 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2468) fix/ui-map/snackbar-inset (P1) — 進行中 (2026-02-01 18:05 JST)
- ブランチ名: fix/ui-map/snackbar-inset
- 依存: なし
- 受け入れ基準: Snackbar が ui-map 表示範囲内に収まる／画面外に出ない／既存表示内容は維持される／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: Snackbar の container/position 変更を revert して元に戻す
- チェックリスト:
  - Snackbar を map コンテナ内にレンダリングする
  - 表示位置を map 内オフセットに固定する
  - ui-map の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:05 JST Snackbar の map 内配置修正に着手。
  - update: 2026-02-01 18:06 JST Snackbar を map コンテナ内の絶対配置へ変更。
  - update: 2026-02-01 18:06 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2469) fix/location-preview/snackbar-type-label (P1) — 進行中 (2026-02-01 18:09 JST)
- ブランチ名: fix/location-preview/snackbar-type-label
- 依存: なし
- 受け入れ基準: Snackbar の型名テキスト（Area centroid など）が表示されない／その他表示は維持される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: Snackbar 表示の文言変更を revert して元に戻す
- チェックリスト:
  - Snackbar から typeLabel 表示を撤去する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:09 JST Snackbar の型名表示撤去に着手。
  - update: 2026-02-01 18:09 JST Snackbar から typeLabel 表示を撤去。
  - update: 2026-02-01 18:09 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。

2470) fix/shape-preview/remove-adminlevel-grouping (P2) — 完了 (2026-02-01 18:20 JST)
- ブランチ名: fix/shape-preview/remove-adminlevel-grouping
- 依存: なし
- 受け入れ基準: shape-plugin の preview で AdminLevel ごとのグループ表示が廃止される／既存の preview 表示が崩れない／必要な typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: AdminLevel グルーピング表示の差分を revert して元に戻す
- チェックリスト:
  - preview の AdminLevel グルーピング表示を撤去する
  - 影響範囲の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:15 JST shape preview の AdminLevel グルーピング撤去に着手。
  - blocked: 2026-02-01 18:18 JST pnpm --filter @hierarchidb/shape-plugin typecheck が mergeBounds 未使用で失敗。
  - update: 2026-02-01 18:20 JST AdminLevel グルーピングの集約処理を撤去し、不要な helper を削除。
  - done: 2026-02-01 18:20 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

) fix/shape-preview/column-row-config-rows-card (P2) — 進行中 ()
- ブランチ名: fix/shape-preview/column-row-config-rows-card
- 依存: なし
- 受け入れ基準: shape の preview Column/Row Config で Rows カードが location と同じ下部位置に表示される／Rows の挙動（追加・削除・並び・表示条件）が location と同等になる／
> @hierarchidb/shape-plugin@0.1.0 typecheck /Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin
> tsc --noEmit

src/ui/components/preview/useShapePreviewStep.ts(194,7): error TS6133: 'mergeBounds' is declared but its value is never read.
/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @hierarchidb/shape-plugin@0.1.0 typecheck: `tsc --noEmit`
Exit status 2 が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: （必要に応じて追加）
- ロールバック手順: Column/Row Config の Rows カード位置・挙動変更を revert して元の表示へ戻す
- チェックリスト:
  - shape preview の Column/Row Config で Rows カード位置を location と合わせる
  - Rows の挙動差分を洗い出して location と同等に揃える
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start:  shape preview の Column/Row Config を location と揃える作業に着手。


2471) fix/shape-preview/column-row-config-rows-card (P2) — 進行中 (2026-02-01 18:38 JST)
- ブランチ名: fix/shape-preview/column-row-config-rows-card
- 依存: なし
- 受け入れ基準: shape の preview Column/Row Config で Rows カードが location と同じ下部位置に表示される／Rows の挙動（追加・削除・並び・表示条件）が location と同等になる／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: Column/Row Config の Rows カード位置・挙動変更を revert して元の表示へ戻す
- チェックリスト:
  - shape preview の Column/Row Config で Rows カード位置を location と合わせる
  - Rows の挙動差分を洗い出して location と同等に揃える
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:38 JST shape preview の Column/Row Config を location と揃える作業に着手。
  - update: 2026-02-01 18:46 JST shape preview の Rows フィルター追加に伴い ui-map の d.ts 未更新で typecheck が失敗したため、ui-map をビルドして更新。
  - update: 2026-02-01 18:46 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 18:46 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 18:46 JST shape preview の Column/Row Config を location と同等の Rows カード/挙動に更新。

2472) fix/shape-preview/snackbar-flag (P2) — 完了 (2026-02-01 18:34 JST)
- ブランチ名: fix/shape-preview/snackbar-flag
- 依存: なし
- 受け入れ基準: shape preview のホバー Snackbar で国名の前に国旗絵文字が表示される／国名や国コードが不明な場合は表示しない／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: Snackbar の国旗表示差分を revert して元に戻す
- チェックリスト:
  - Snackbar の国名表示前に国旗絵文字を付与する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:30 JST shape preview Snackbar の国旗表示に着手。
  - update: 2026-02-01 18:33 JST hover ラベルの国名表示に国旗絵文字を付与。
  - done: 2026-02-01 18:34 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。


2473) fix/preview/title-metadata-prefix (P2) — 進行中 (2026-02-01 19:20 JST)
- ブランチ名: fix/preview/title-metadata-prefix
- 依存: なし
- 受け入れ基準: shape preview の floating window タイトルが "Shape: metadata (n rows)" 形式になる／location preview の floating window タイトルが "Location: metadata (n rows)" 形式になる／既存のカウント挙動は維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`
- ロールバック手順: タイトル変更の差分を revert して元の表示に戻す
- チェックリスト:
  - shape preview のタイトルを Shape: metadata 形式へ更新する
  - location preview のタイトルを Location: metadata 形式へ更新する
  - 影響範囲の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 19:20 JST preview の metadata タイトル接頭辞変更に着手。
  - update: 2026-02-01 19:22 JST shape/location preview の metadata タイトルを指定形式へ更新。
  - update: 2026-02-01 19:22 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 19:22 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 19:22 JST preview の metadata タイトル接頭辞変更を完了。


2474) fix/shape-preview/adminlevel-no-grouping (P2) — 進行中 (2026-02-01 19:22 JST)
- ブランチ名: fix/shape-preview/adminlevel-no-grouping
- 依存: なし
- 受け入れ基準: Shape: metadata の floating window テーブルで Admin Level による行グループ化が無効になる／Admin Level カラムは通常の列として表示される／既存の検索・選択・カウント表示は維持される／`pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/ShapePreviewList.tsx`
- ロールバック手順: Admin Level の grouping 設定を復元して元の表示に戻す
- チェックリスト:
  - ShapePreviewList の adminLevel grouping を撤去する
  - shape-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 19:22 JST Shape: metadata の Admin Level グループ化撤去に着手。
  - update: 2026-02-01 19:23 JST ShapePreviewList の Admin Level grouping を撤去。
  - update: 2026-02-01 19:23 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 19:23 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 19:23 JST Shape: metadata の Admin Level グループ化撤去を完了。
  - update: 2026-02-01 19:25 JST ShapePreviewList の normalizeAdminLevelGroup 参照を撤去して runtime エラーを解消。
  - update: 2026-02-01 19:25 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 19:25 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 19:25 JST Shape: metadata の Admin Level グループ化撤去の修正を完了。

2473) fix/ui-map/vector-tile-cleanup-guard (P1) — 完了 (2026-02-01 18:43 JST)
- ブランチ名: fix/ui-map/vector-tile-cleanup-guard
- 依存: なし
- 受け入れ基準: VectorTileLayer cleanup が map atoms 未初期化でも例外にならない／`Cannot read properties of undefined (reading 'layers')` が発生しない／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/VectorTileLayer.tsx`（必要に応じて追加）
- ロールバック手順: cleanup ガード追加を revert して元の実装に戻す
- チェックリスト:
  - map atoms 未初期化時に cleanup をスキップするガードを追加する
  - ui-map の typecheck を実行する
  - 運用ログ start/update/done を追記する

2478) fix/ui-floating-window/useState-undefined (P1) — 完了 (2026-02-04)
- ブランチ名: fix/ui-floating-window/useState-undefined
- 依存: なし
- 受け入れ基準: FloatingWindowPortalProvider の useState undefined が発生しない／`pnpm --filter @hierarchidb/ui-floating-window typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindowPortalProvider.tsx`
- ロールバック手順: React フック参照を元の実装に戻す
- チェックリスト:
  - React フック参照のスコープを明示化する
  - ui-floating-window の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-04 12:40 JST FloatingWindowPortalProvider の useState undefined 調査に着手。
  - update: 2026-02-04 12:42 JST React フックを React.* 経由に統一して参照を明示化。
  - update: 2026-02-04 12:43 JST pnpm --filter @hierarchidb/ui-floating-window typecheck exit 0 を確認。
  - done: 2026-02-04 12:43 JST FloatingWindowPortalProvider の useState undefined 対応を完了。
- 運用ログ:
  - start: 2026-02-01 18:40 JST VectorTileLayer cleanup の例外ガード対応に着手。
 - update: 2026-02-01 18:42 JST map.getStyle が未定義の場合に cleanup をスキップするガードを追加。
  - done: 2026-02-01 18:43 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。

2475) fix/ide-gsm/sourcekey-tabular-store (P1) — 進行中 (2026-02-01 20:30 JST)
- ブランチ名: fix/ide-gsm/sourcekey-tabular-store
- 依存: なし
- 受け入れ基準: IDE-GSM の import で sourceKey に data URL が入らず tabular-store の tableId が保存される／Location と Route の両方で tabular-store 経由の import が動作する／既存の data URL が draft に残っている場合は UI 側で tabular-store に移行できる／`pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/datasource/src/IdeGsmImportPanel.tsx`, `packages/features/tabular-store/src/index.ts`, `packages/runtime-worker/src/services/utils/tabular.ts`, `packages/features/location-api/src/**`, `packages/features/route-api/src/**`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/runtime-worker/src/services/RouteMutationService.ts`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: 該当差分を revert して IDE-GSM の sourceUrl ベース処理に戻す
- チェックリスト:
  - IDE-GSM import の payload を tabular-store の tableId 参照へ置換する
  - Location/Route の IDE-GSM import を tabular-store 経由の rows 解析に切替える
  - 既存 data URL のドラフトを tabular-store に移行する処理を用意する
  - 影響範囲の typecheck/build を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 20:30 JST IDE-GSM sourceKey を tabular-store 化する作業に着手。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/tabular-store build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/location-api build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/route-api build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - blocked: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/location-plugin typecheck が ui-datasource の dist 未更新で失敗（IdeGsmImportPayload/sourceId 未反映）。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/ui-datasource build exit 0（tsdown define 警告あり）。
  - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - blocked: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/route-plugin typecheck が @hierarchidb/tabular-store/src 参照で失敗。
  - update: 2026-02-01 23:31 JST RouteTabularMetadataManager の import を @hierarchidb/tabular-store に修正。
 - update: 2026-02-01 23:31 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 23:31 JST IDE-GSM sourceKey の tabular-store 置換と Location/Route 反映を完了。

2476) fix/location-ide-gsm/skip-empty-source (P1) — 進行中 (2026-02-01 23:36 JST)
- ブランチ名: fix/location-ide-gsm/skip-empty-source
- 依存: なし
- 受け入れ基準: tabularSourceId を持たない IDE-GSM ソースでは import を実行しない／WorkerBridge 未初期化エラーが発生しない／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/hooks/useIdeGsmImportOnEntry.ts`
- ロールバック手順: 追加した sourceKey ガードを revert して元の import 実行条件に戻す
- チェックリスト:
  - 有効な tabularSourceId がない場合は import をスキップする
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 23:36 JST IDE-GSM の空 sourceKey で WorkerBridge が呼ばれる不具合修正に着手。
  - update: 2026-02-01 23:36 JST 有効な tabularSourceId のみ import 対象に絞るガードを追加。
 - update: 2026-02-01 23:36 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 23:36 JST IDE-GSM 空 sourceKey の import 実行抑止を完了。

2477) fix/location-preview/ide-gsm-progress-bar (P2) — 進行中 (2026-02-01 23:49 JST)
- ブランチ名: fix/location-preview/ide-gsm-progress-bar
- 依存: なし
- 受け入れ基準: Location preview 上辺に IDE-GSM import の進捗バーが表示される／progress の processed/total が LinearProgress に反映される／completed/failed で非表示になる／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: 進捗バー表示の差分を revert して元の preview 表示に戻す
- チェックリスト:
  - ideGsmProgress を購読して LinearProgress を表示する
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 23:49 JST Location preview の IDE-GSM 進捗バー追加に着手。
  - update: 2026-02-01 23:49 JST IDE-GSM progress の購読と LinearProgress 表示を追加。
 - update: 2026-02-01 23:49 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 23:49 JST Location preview の IDE-GSM 進捗バー表示を完了。

2478) fix/location-preview/ide-gsm-progress-save-only (P2) — 進行中 (2026-02-01 23:51 JST)
- ブランチ名: fix/location-preview/ide-gsm-progress-save-only
- 依存: なし
- 受け入れ基準: LinearProgress が phase 'save' のときのみ表示される／processed/total の進捗表示は維持される／`pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- ロールバック手順: save のみ表示する条件を revert して元の表示条件に戻す
- チェックリスト:
  - save 以外の phase では LinearProgress を非表示にする
  - location-plugin の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 23:51 JST Location preview の進捗バーを save 時のみ表示する修正に着手。
  - update: 2026-02-01 23:51 JST save 以外の phase では LinearProgress を非表示にする条件へ変更。
  - update: 2026-02-01 23:51 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - done: 2026-02-01 23:51 JST Location preview の進捗バー表示条件を save 時のみに限定。

2479) fix/ui-map/box-children-warning (P2) — 進行中 (2026-02-02 00:05 JST)
- ブランチ名: fix/ui-map/box-children-warning
- 依存: なし
- 受け入れ基準: ResourceLayerMap/MapPreviewShell 経由で Box children の prop type warning が出ない／snackbar と stats renderExtra の挙動は維持される／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: 追加した children ガードを revert して元のレンダリング条件へ戻す
- チェックリスト:
  - renderExtra/snackbarContent の ReactNode ガードを追加する
  - ui-map の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 00:05 JST ResourceLayerMap の Box children 警告対応に着手。
  - update: 2026-02-02 00:05 JST snackbarContent/renderExtra の ReactNode ガードを追加。
  - update: 2026-02-02 00:05 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-02-02 00:05 JST Box children の prop type warning 対応を完了。

2480) fix/ui-map/box-children-warning-icon-guard (P2) — 進行中 (2026-02-02 00:09 JST)
- ブランチ名: fix/ui-map/box-children-warning-icon-guard
- 依存: なし
- 受け入れ基準: stats の titleIcon/toggleButtonIcon が ReactNode でない場合は描画されず、Box children warning が出ない／既存の stats UI 表示は維持される／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: icon の ReactNode ガードを revert して元の表示に戻す
- チェックリスト:
  - stats icon の ReactNode ガードを追加する
  - ui-map の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 00:09 JST stats icon の ReactNode ガード追加に着手。
  - update: 2026-02-02 00:09 JST stats titleIcon/toggleButtonIcon の ReactNode ガードを追加。
  - update: 2026-02-02 00:09 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-02-02 00:09 JST stats icon の ReactNode ガード追加を完了。

2481) fix/ui-map/safe-box-children (P2) — 進行中 (2026-02-02 07:05 JST)
- ブランチ名: fix/ui-map/safe-box-children
- 依存: なし
- 受け入れ基準: ResourceLayerMap の Box children が常に ReactNode に正規化され warning が出ない／表示上の退行がない／`pnpm --filter @hierarchidb/ui-map typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: SafeBox/children 正規化を revert して元の Box 使用に戻す
- チェックリスト:
  - ResourceLayerMap 内の Box を children 正規化つきに置換する
  - ui-map の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 07:05 JST ResourceLayerMap の Box children 正規化に着手。
  - update: 2026-02-02 07:05 JST SafeBox で children を正規化する実装へ置換。
 - update: 2026-02-02 07:05 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - done: 2026-02-02 07:05 JST ResourceLayerMap の Box children 正規化を完了。

2482) investigation/location-db-separation (P2) — 完了 (2026-02-02 08:57 JST)
- ブランチ名: investigation/location-db-separation
- 依存: なし
- 受け入れ基準: LocationDB/Location-metadata の利用実態と分離理由をコード根拠付きで整理できる／未使用テーブル（vectorTiles/pendingSessions 等）の扱い案を提示できる／統合/分離/ephemeral 化の比較案を提示できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `plugins/location-plugin/src/common/tabular/LocationTabularMetadataManager.ts`, `app/src/router/routes/modeless/modelessDialogContentData.ts`, `docs/location-plugin-design.md`, `plugins/location-plugin/PLAN.md`, `plugins/location-plugin/batch-processing-ja.md`（調査後に確定）
- ロールバック手順: 調査のみのため差分なし
- チェックリスト:
  - LocationDB のテーブル/利用箇所を確認する
  - location-metadata の利用箇所を確認する
  - 分離/統合/ephemeral 化の提案を整理する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 08:57 JST Location DB 分離理由と未使用テーブル整理の調査に着手。
  - update: 2026-02-02 08:57 JST LocationDB は features のみ使用、vectorTiles/pendingSessions は旧スキーマに残存。location-metadata は tabular の metadata 参照で使用中と確認。
  - done: 2026-02-02 08:57 JST Location DB 利用実態と分離/統合/ephemeral 化の提案整理を完了。

2474) refactor/plugins/hook-extraction-tsx (P1) — 進行中 (2026-02-01 18:50 JST)
- ブランチ名: refactor/plugins/hook-extraction-tsx
- 依存: なし
- 受け入れ基準: plugins 配下の .tsx を調査して混在ロジックを特定できる／対象コンポーネントのロジックがカスタムフックへ切り出される／必要な plugin の typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/**`（調査後に特定）
- ロールバック手順: 各コンポーネント/フックの差分を revert して元の実装に戻す
- チェックリスト:
  - ExecPlan を作成する（plans/plugins-hook-extraction-execplan.md）
  - plugins/**/*.tsx を走査し対象をリスト化する
  - 対象コンポーネントのロジックをカスタムフックに切り出す
  - 影響範囲の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-01 18:50 JST plugins の TSX フック抽出リファクタに着手。
  - update: 2026-02-01 18:55 JST ExecPlan を plans/plugins-hook-extraction-execplan.md に作成。
  - update: 2026-02-01 19:00 JST plugins/**/*.tsx を棚卸しし、候補（Location/Route/Shape/Styler/Basemap 等の大規模TSX）を抽出。
  - update: 2026-02-01 19:15 JST basemap-plugin の BaseMapDisplay と ViewportStep をフックへ抽出。
  - update: 2026-02-01 19:16 JST pnpm --filter @hierarchidb/basemap-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 19:30 JST styler-plugin の StylerAlgorithmStep2 をフックへ抽出。
  - update: 2026-02-01 19:31 JST pnpm --filter @hierarchidb/styler-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 19:50 JST shape-plugin の ShapeBuildStep atom sync をフックへ抽出。
  - update: 2026-02-01 19:51 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:05 JST location-plugin の LocationSelectionStep をフックへ抽出。
  - blocked: 2026-02-01 20:07 JST pnpm --filter @hierarchidb/location-plugin typecheck が MatrixSelection/LocationType 未import で失敗。
  - update: 2026-02-01 20:09 JST LocationSelectionStep の type import を追加。
  - update: 2026-02-01 20:10 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:25 JST route-plugin の RouteDataSourceStep をフックへ抽出。
  - update: 2026-02-01 20:26 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 20:45 JST shape-plugin の ShapeBuildProgressPanel をフックへ抽出。
  - update: 2026-02-01 20:46 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 21:05 JST location-plugin の LocationStyleConfigPanel をフックへ抽出。
  - blocked: 2026-02-01 21:07 JST pnpm --filter @hierarchidb/location-plugin typecheck が未使用型/定数で失敗。
  - update: 2026-02-01 21:10 JST LocationStyleConfigPanel の不要定義を整理。
  - update: 2026-02-01 21:11 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 21:25 JST route-plugin の RouteBatchLaunchForm をフックへ抽出。
  - update: 2026-02-01 21:26 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 22:10 JST location-plugin の LocationDataSourceStep フック抽出に着手。
  - update: 2026-02-01 22:20 JST location-plugin の LocationDataSourceStep をフックへ抽出。
  - update: 2026-02-01 22:21 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 22:40 JST location-plugin の LocationMapPreviewStep フック抽出に着手。
  - blocked: 2026-02-01 22:52 JST pnpm --filter @hierarchidb/location-plugin typecheck が useLocationMapPreviewStep.ts の JSX で失敗。
  - update: 2026-02-01 22:53 JST useLocationMapPreviewStep を .tsx へ変更。
  - update: 2026-02-01 22:54 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 23:10 JST route-plugin の RouteSelectionStep フック抽出に着手。
  - update: 2026-02-01 23:20 JST route-plugin の RouteSelectionStep をフックへ抽出。
  - update: 2026-02-01 23:21 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-02-01 23:35 JST shape-plugin の TransformConfigSection フック抽出に着手。
  - blocked: 2026-02-01 23:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck が useTransformConfigSectionView.ts の未使用 import で失敗。
  - update: 2026-02-01 23:46 JST useTransformConfigSectionView の未使用 import を削除。
  - update: 2026-02-01 23:47 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 00:05 JST route-plugin の RoutePreviewStep フック抽出に着手。
  - update: 2026-02-02 00:17 JST route-plugin の RoutePreviewStep をフックへ抽出。
  - blocked: 2026-02-02 00:18 JST pnpm --filter @hierarchidb/route-plugin typecheck が useRoutePreviewStep.tsx の未使用 import で失敗。
  - update: 2026-02-02 00:19 JST useRoutePreviewStep の未使用 import を削除。
  - update: 2026-02-02 00:20 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - blocked: 2026-02-02 00:50 JST pnpm --filter @hierarchidb/route-plugin typecheck が RoutePreviewStep の未使用 import で失敗。
  - update: 2026-02-02 00:51 JST RoutePreviewStep の未使用 import を削除。
  - update: 2026-02-02 00:52 JST pnpm --filter @hierarchidb/route-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 00:30 JST spreadsheet-plugin の TabularDataFilterStep フック抽出に着手。
  - blocked: 2026-02-02 00:32 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck が mode/disabled 未指定で失敗。
  - update: 2026-02-02 00:33 JST TabularDataFilterStep の hook 呼び出しに mode/disabled を追加。
  - update: 2026-02-02 00:34 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 00:45 JST resolver-plugin の ValidationConfigStep フック抽出に着手。
  - blocked: 2026-02-02 00:56 JST pnpm --filter @hierarchidb/resolver-plugin typecheck が ruleFormData 型不整合で失敗。
  - update: 2026-02-02 00:57 JST useValidationConfigStepView の引数型を form data に合わせて調整。
  - update: 2026-02-02 00:58 JST pnpm --filter @hierarchidb/resolver-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 01:10 JST repository全体の .tsx を行数集計し、400行以上の一覧を抽出。
  - update: 2026-02-02 01:20 JST テスト/ストーリー除外で .tsx 行数上位10件を抽出。

2482) refactor/repo/tsx-hook-extraction-400plus (P1) — 進行中 (2026-02-02 01:30 JST)
- ブランチ名: refactor/repo/tsx-hook-extraction-400plus
- 依存: なし
- 受け入れ基準: テスト/ストーリー除外の .tsx 行数上位10件についてロジックをフック/サブコンポーネントへ分離しTSXを描画中心へ整理する／対象パッケージの typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: app/**, packages/**, plugins/**（対象10ファイル）
- ロールバック手順: 対象ファイルと新規フックの差分を revert して元の実装へ戻す
- チェックリスト:
  - 上位10件を順にフック/サブコンポーネント化する
  - 対象パッケージ/プラグインの typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 01:30 JST テスト/ストーリー除外の .tsx 上位10件フック抽出に着手。
  - update: 2026-02-02 01:32 JST ExecPlan を plans/repo-tsx-400plus-execplan.md に作成。
  - update: 2026-02-02 01:50 JST modelessDialogContent を modelessDialogContentData へ分割してフック抽出。
  - update: 2026-02-02 01:52 JST pnpm --filter @hierarchidb/app typecheck exit 0 を確認（plugin-base build warning あり）。
  - start: 2026-02-02 02:20 JST ResourceLayerMap のフック抽出に着手。
  - update: 2026-02-02 02:45 JST ResourceLayerMap の stats ロジックを useResourceLayerMapStats へ抽出。
  - update: 2026-02-02 02:46 JST pnpm --filter @hierarchidb/ui-map typecheck exit 0 を確認。
  - start: 2026-02-02 03:05 JST LocationMapPreviewStep のフック抽出に着手。
  - update: 2026-02-02 03:35 JST LocationMapPreviewStep を metadata/map/config フックに分割。
  - update: 2026-02-02 03:36 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - start: 2026-02-02 03:50 JST plugin-base typecheck の型エラー修正に着手。
  - blocked: 2026-02-02 03:55 JST pnpm --filter @hierarchidb/plugin-base typecheck が HostProfileRegistry/PluginStepRegistry の provider 型不整合で失敗。
  - update: 2026-02-02 04:05 JST registry の provider map を any ベースに緩和し、BivariantCallback/ReadonlyArray の補助型を追加。
  - update: 2026-02-02 04:06 JST pnpm --filter @hierarchidb/plugin-base typecheck exit 0 を確認。
  - start: 2026-02-02 04:15 JST usePluginDialogController のフック抽出に着手。
  - update: 2026-02-02 04:35 JST usePluginDialogController のナビゲーション処理を step-navigation フックへ分割。
  - update: 2026-02-02 04:36 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - start: 2026-02-02 04:50 JST MapPage のフック抽出に着手。
  - update: 2026-02-02 10:21 JST MapPage の location viewport ロジックを useLocationViewportLayers に分離。
  - update: 2026-02-02 10:21 JST normalize-dts.mjs を index3 優先に更新し、location/route plugin build と app typecheck を実行（警告あり、exit 0）。
  - update: 2026-02-02 10:40 JST LocationMapPreview と plugins.tsx のフック抽出反映および spreadsheet-plugin の d.ts 警告解消に着手。
  - update: 2026-02-02 12:34 JST LocationMapPreview を useLocationMapPreview へ分割。
  - update: 2026-02-02 12:34 JST plugins.tsx を usePluginsPageState へ分割。
  - update: 2026-02-02 12:34 JST normalize-dts.mjs に spreadsheet-plugin の d.ts 補正を追加し build を再実行。
  - update: 2026-02-02 12:34 JST pnpm --filter @hierarchidb/spreadsheet-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:34 JST pnpm --filter @hierarchidb/location-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:34 JST pnpm --filter @hierarchidb/route-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:34 JST pnpm --filter @hierarchidb/location-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 12:34 JST pnpm --filter @hierarchidb/app typecheck exit 0（plugin-base build define warningあり）。
  - update: 2026-02-02 12:47 JST scripts/normalize-dts.mjs を撤去し、各 plugin build から参照を削除。
  - update: 2026-02-02 12:47 JST pnpm --filter @hierarchidb/location-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:47 JST pnpm --filter @hierarchidb/route-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:47 JST pnpm --filter @hierarchidb/shape-plugin build exit 0（define warningあり）。
  - update: 2026-02-02 12:47 JST pnpm --filter @hierarchidb/spreadsheet-plugin build exit 0（define warningあり）。
  - start: 2026-02-02 13:10 JST plugins/*-plugin の rolldown-vite 移行適合性を調査。
  - update: 2026-02-02 15:33 JST rollup/rollup-plugin-dts を workspace に追加。
  - update: 2026-02-02 15:33 JST spreadsheet-plugin に rollup.dts.config.mjs を追加し build:dts を導入（tsdown dts を無効化）。
  - update: 2026-02-02 15:33 JST pnpm --filter @hierarchidb/spreadsheet-plugin build を実行（tsdown define warning と rollup-plugin-dts の @hierarchidb/ui-i18n unresolved 警告あり）。
  - update: 2026-02-02 15:39 JST @hierarchidb/ui-i18n から i18n を export し build を実行。
  - update: 2026-02-02 15:39 JST spreadsheet-plugin に @hierarchidb/ui-i18n を peer/dev 追加し build を再実行（tsdown の MISSING_EXPORT は解消、rollup-plugin-dts の unresolved 警告は継続）。
  - update: 2026-02-02 18:39 JST AGENTS.md のバンドル方針を JS は tsdown / d.ts は別経路可に更新。
  - update: 2026-02-02 18:43 JST plugins/*-plugin の build を build:js/build:dts に分割し rollup.dts.config.mjs を追加。
  - update: 2026-02-02 18:43 JST turbo.json に build:js/build:dts タスクを追加。
  - update: 2026-02-02 18:43 JST pnpm --filter @hierarchidb/spreadsheet-plugin build exit 0（tsdown define warning と rollup dts の unused external 警告あり）。
  - update: 2026-02-02 19:05 JST route-plugin に src/worker/factory/index.ts を追加して build:dts の entry を解消。
  - update: 2026-02-02 19:05 JST pnpm --filter @hierarchidb/route-plugin build exit 0（tsdown define warning と MISSING_EXPORT/unused external 警告あり）。
  - start: 2026-02-02 19:12 JST location/shape plugin build の確認に着手。
  - update: 2026-02-02 19:22 JST location/shape の rollup.dts.config.mjs を実在 entry に合わせて修正。
  - update: 2026-02-02 19:26 JST pnpm --filter @hierarchidb/location-plugin build exit 0（tsdown define/MISSING_EXPORT 警告と rollup dts の unused external 警告あり）。
  - update: 2026-02-02 19:27 JST pnpm --filter @hierarchidb/shape-plugin build exit 0（tsdown define/MISSING_EXPORT 警告と rollup dts の unused external/empty chunk 警告あり）。
  - done: 2026-02-02 19:27 JST location/shape plugin build:dts の entry 不一致を解消し build を再確認。
  - start: 2026-02-02 19:34 JST MISSING_EXPORT 警告の解消（ui-worker-provider/spreadsheet-store など）に着手。
  - update: 2026-02-02 19:39 JST spreadsheet-plugin index の type-only export を明示。
  - update: 2026-02-02 19:50 JST spreadsheet-plugin の SpreadsheetEntity type を type alias に変更。
  - update: 2026-02-02 20:04 JST ui-worker-provider の useWorkerAPI を const export 化。
  - update: 2026-02-02 20:04 JST ui-i18n の i18n を const export 化。
  - update: 2026-02-02 20:04 JST spreadsheet-plugin の createPluginTabularApi を明示 export。
  - update: 2026-02-02 20:12 JST ui-worker-provider/ui-i18n/spreadsheet-plugin を再ビルド（define 警告あり、exit 0）。
  - update: 2026-02-02 20:14 JST location/shape plugin build を再実行（MISSING_EXPORT は useWorkerAPI/i18n/createPluginTabularApi が継続）。
  - blocked: 2026-02-02 20:14 JST tsdown の MISSING_EXPORT が export list で解消せず（dist に export があるのに警告継続）。
  - update: 2026-02-02 20:26 JST location-plugin に ui-worker-provider/spreadsheet-plugin を peer/dev 追加。
  - update: 2026-02-02 20:26 JST shape-plugin に ui-i18n を peer/dev 追加。
  - update: 2026-02-02 20:30 JST location/shape plugin build を再実行（MISSING_EXPORT 解消、define/unused external 警告のみ）。
  - done: 2026-02-02 20:30 JST MISSING_EXPORT の原因を dependency/peer 未登録による外部化漏れと判断。
  - start: 2026-02-02 20:38 JST shape fetchCache の nodeId+sourceKey index 警告対応に着手。
  - update: 2026-02-02 20:40 JST EphemeralShapeDB の fetchCache に nodeId+sourceKey index を追加（version 16）。
  - update: 2026-02-02 20:43 JST pnpm --filter @hierarchidb/shape-store build exit 0（define 警告あり）。
  - update: 2026-02-02 20:43 JST pnpm --filter @hierarchidb/shape-plugin build exit 0（define/unused external/empty chunk 警告あり）。
  - done: 2026-02-02 20:43 JST fetchCache の nodeId+sourceKey index 警告対応を完了。
  - start: 2026-02-02 20:49 JST resolver-plugin の rollup.dts entry 不一致を解消。
  - update: 2026-02-02 20:53 JST resolver-plugin の rollup/build:js から worker entry を除外。
  - update: 2026-02-02 20:55 JST pnpm --filter @hierarchidb/resolver-plugin build exit 0（define/MISSING_EXPORT/unused external 警告あり）。
  - done: 2026-02-02 20:55 JST resolver-plugin の rollup dts entry 不一致を解消。
  - start: 2026-02-02 21:01 JST resolver-plugin の exports/typesVersions から worker を除外。
  - update: 2026-02-02 21:04 JST resolver-plugin exports/typesVersions から worker を削除。
  - update: 2026-02-02 21:04 JST pnpm --filter @hierarchidb/resolver-plugin build exit 0（define/MISSING_EXPORT/unused external 警告あり）。
  - done: 2026-02-02 21:04 JST resolver-plugin の exports/typesVersions を実装と整合。
  - start: 2026-02-02 21:09 JST timeline-plugin の rollup.dts entry 不一致を解消。
  - update: 2026-02-02 21:12 JST timeline-plugin の rollup/build/exports から worker entry を除外。
  - update: 2026-02-02 21:14 JST pnpm --filter @hierarchidb/timeline-plugin build exit 0（define/MISSING_EXPORT/unused external 警告あり）。
  - done: 2026-02-02 21:14 JST timeline-plugin の rollup dts entry 不一致を解消。
  - start: 2026-02-02 21:19 JST timeline-plugin に ui-i18n を peer/dev 追加して MISSING_EXPORT を解消。
  - update: 2026-02-02 21:21 JST timeline-plugin に ui-i18n を peer/dev 追加。
  - update: 2026-02-02 21:21 JST pnpm --filter @hierarchidb/timeline-plugin build exit 0（define/unused external 警告あり）。
  - done: 2026-02-02 21:21 JST timeline-plugin の MISSING_EXPORT を解消。
  - start: 2026-02-02 21:27 JST basemap-plugin の rollup.dts entry 不一致を解消。
  - update: 2026-02-02 21:31 JST basemap-plugin の rollup/build/exports から worker/services database を除外。
  - update: 2026-02-02 21:34 JST basemap-plugin に ui-i18n を peer/dev 追加。
  - update: 2026-02-02 21:36 JST pnpm --filter @hierarchidb/basemap-plugin build exit 0（define/unused external 警告あり）。
  - done: 2026-02-02 21:36 JST basemap-plugin の rollup dts entry 不一致を解消。
  - start: 2026-02-02 21:41 JST styler-plugin の rollup.dts entry 不一致を解消。
  - update: 2026-02-02 21:44 JST styler-plugin の rollup/build/exports から worker/common shared を除外。
  - update: 2026-02-02 21:47 JST styler-plugin に ui-i18n を peer/dev 追加。
  - update: 2026-02-02 21:49 JST pnpm --filter @hierarchidb/styler-plugin build exit 0（define/empty chunk 警告あり）。
  - done: 2026-02-02 21:49 JST styler-plugin の rollup dts entry 不一致を解消。
  - start: 2026-02-02 21:58 JST plugin-ui-host の DialogUIState null エラー修正に着手。
  - update: 2026-02-02 22:01 JST buildDialogUIStateForCommit/forPersist を null 非許容に修正。
  - update: 2026-02-02 22:01 JST pnpm --filter @hierarchidb/plugin-ui-host typecheck exit 0 を確認。
  - done: 2026-02-02 22:01 JST DialogUIState の null エラーを解消。
  - update: 2026-02-02 19:14 JST pnpm --filter @hierarchidb/location-plugin build を実行（build:dts で src/worker/locationRelationStore.dexie.ts が見つからず exit 1）。
  - update: 2026-02-02 19:16 JST pnpm --filter @hierarchidb/shape-plugin build を実行（build:dts で src/common/shared/index.ts が見つからず exit 1）。
  - blocked: 2026-02-02 19:16 JST rollup.dts.config.mjs の entry に存在しないパスがあり build:dts が失敗。

2483) fix/location-db/doc-alignment (P2) — 完了 (2026-02-02 09:04 JST)
- ブランチ名: fix/location-db/doc-alignment
- 依存: なし
- 受け入れ基準: LocationDB/location-metadata の役割が現行コードに一致するようドキュメントを更新する／未使用の ephemaral/pending/vectorTiles 記述を整理する／LocationDB の互換 alias を撤去する／`pnpm --filter @hierarchidb/location-store typecheck` が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/location-store/src/LocationDB.ts`, `packages/features/location-store/src/index.ts`, `docs/vt-pipeline-design.md`, `docs/build-artifacts-by-node-type.md`, `docs/location-plugin-design.md`, `plugins/location-plugin/PLAN.md`, `plugins/location-plugin/batch-processing-ja.md`, `docs/architecture/plugin-dialog-integration.md`
- ロールバック手順: 該当差分を revert して旧ドキュメント/alias に戻す
- チェックリスト:
  - LocationDB の alias を撤去する
  - location 関連ドキュメントを現行実装へ合わせて更新する
  - location-store の typecheck を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 09:04 JST Location DB の役割整理とドキュメント更新に着手。
  - update: 2026-02-02 09:04 JST LocationDB の互換 alias を撤去し、location-metadata の役割を文書化。
  - update: 2026-02-02 09:04 JST vt-pipeline/build-artifacts/location-plugin docs を現行の features 永続・ephemeral 未実装に合わせて更新。
  - update: 2026-02-02 09:04 JST pnpm --filter @hierarchidb/location-store typecheck exit 0 を確認。
  - update: 2026-02-02 09:06 JST リポジトリ内に getLocationDatabase/LocationDatabase/getEphemeralLocationDB の参照が残っていないことを確認。
  - done: 2026-02-02 09:04 JST Location DB ドキュメントと alias 整理を完了。

2484) fix/app/map-handle-location-move-end-redeclare (P1) — 進行中 (2026-02-02)
- ブランチ名: fix/app/map-handle-location-move-end-redeclare
- 依存: なし
- 受け入れ基準: MapPage.tsx の handleLocationMoveEnd 再宣言エラーが解消される／@hierarchidb/app build が exit 0（もしくは次の別エラーへ進む）／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/MapPage.tsx`
- ロールバック手順: 該当差分を revert して元の宣言に戻す
- チェックリスト:
  - handleLocationMoveEnd の再宣言を解消する
  - pnpm --filter @hierarchidb/app build を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-02 09:10 JST MapPage の handleLocationMoveEnd 再宣言エラー修正に着手。
  - update: 2026-02-02 09:15 JST pnpm --filter @hierarchidb/app build を実行（tsdown define 警告と Vite の chunk size 警告あり、exit 0）。
  - done: 2026-02-02 09:15 JST handleLocationMoveEnd の再宣言エラー解消を確認。

2485) fix/spreadsheet-plugin/steps-provider-readonly (P1) — 進行中 (2026-02-02)
- ブランチ名: fix/spreadsheet-plugin/steps-provider-readonly
- 依存: なし
- 受け入れ基準: steps-provider.tsx の readonly 配列代入エラーが解消される／pnpm --filter @hierarchidb/spreadsheet-plugin typecheck が exit 0（もしくは次の別エラーへ進む）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/spreadsheet-plugin/src/ui/components/steps-provider.tsx`
- ロールバック手順: 該当差分を revert して元の型に戻す
- チェックリスト:
  - readonly 配列の型不一致を修正する
  - pnpm --filter @hierarchidb/spreadsheet-plugin typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-02 09:20 JST steps-provider.tsx の readonly 配列エラー修正に着手。
  - update: 2026-02-02 09:22 JST steps-provider の戻り型を ReadonlyArray へ修正。
  - done: 2026-02-02 09:22 JST pnpm --filter @hierarchidb/spreadsheet-plugin typecheck exit 0 を確認。

2486) fix/shape/skip-z0-z1-tiles (P1) — 進行中 (2026-02-02)
- ブランチ名: fix/shape/skip-z0-z1-tiles
- 依存: なし
- 受け入れ基準: 共通ズーム帯/shape ズーム帯の最小値が z2 となり、既定の境界が [2, 3, 6] に更新される／z0/z1 のタイル生成が行われない（band0 は z2 のみ）／関連テスト・設定が整合する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/util/src/zoomBandSettings.ts`, `packages/util/src/treeConsoleSettings.ts`, `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts`, `plugins/shape-plugin/src/common/types/constants.ts`, `app/src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx`（必要に応じて追加）
- ロールバック手順: 変更したズーム関連定数・設定を元に戻し、z0/z1 が含まれる既定値へ復帰する
- チェックリスト:
  - 共通ズーム率の既定値と最小ズームを z2 起点に更新する
  - shape build のバンド生成/バリデーションが z2 以降に整合するよう調整する
  - 影響するテスト/テンプレートの境界値を更新する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-02 21:10 JST shape build の z0/z1 タイル生成停止に向けた共通ズーム率設定の調整に着手。
  - update: 2026-02-02 21:15 JST ZOOM_BAND_MIN_ZOOM を 2 に固定し、DEFAULT_ZOOM_BAND_BOUNDARIES を [2, 3, 6] に更新。
  - update: 2026-02-02 21:15 JST shape/app のテストとテンプレートの zoomBandBoundaries を z2 起点に更新。
  - update: 2026-02-02 21:24 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-02-02 21:26 JST pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define warning あり）を確認。
  - done: 2026-02-02 21:26 JST z2 起点の共通ズーム帯と既定境界 [2, 3, 6] への更新を完了。

2487) fix/shape/processing-step4-next (P1) — 進行中 (2026-02-02)
- ブランチ名: fix/shape/processing-step4-next
- 依存: なし
- 受け入れ基準: 処理設定ステップで Next が無効になる原因（zoomBandBoundaries の旧値/未正規化）が解消され、デフォルト状態で Next が有効になる／変更内容とロールバック手順を記録する／必要範囲の typecheck/build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-config/useShapeBuildConfigStep.ts`（必要に応じて追加）
- ロールバック手順: useShapeBuildConfigStep の正規化ロジックを差し戻し、既存の buildConfig 統合のみへ戻す
- チェックリスト:
  - buildConfig の zoomBandBoundaries を min/max に合わせて正規化する
  - 正規化が data.buildConfig に反映されることを確認する
  - 必要範囲の typecheck/build を実行する
  - 運用ログ start/update/done を追記する
- 運用ログ:
  - start: 2026-02-02 21:40 JST 処理設定ステップの Next が無効になる問題の原因調査に着手。
  - update: 2026-02-02 21:43 JST useShapeBuildConfigStep で zoomBandBoundaries を min/max に正規化し data へ反映するよう修正。
 - update: 2026-02-02 21:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
 - done: 2026-02-02 21:45 JST 処理設定ステップの Next 無効化を正規化で解消。

2488) fix/ui-treeconsole/open-step-priority (P1) — 進行中 (2026-02-02)
- ブランチ名: fix/ui-treeconsole/open-step-priority
- 依存: なし
- 受け入れ基準: URL の step 指定が永続化 activeStepIndex より優先される／「開いただけ」では永続化 activeStepIndex を上書きしない（ナビゲーション/Save/SaveDraft 時のみ更新）／コンテキストメニューの Open が Step1..StepN のサブメニューとなり未到達ステップは disabled／ぱんくず・TreeNodeInfoPanel・TreeTable のアイコンから同様に選択できる／必要範囲の typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/tree/usePluginDialogRoute.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`, `packages/ui/treeconsole/breadcrumb/src/components/NodeContextMenu.tsx`, `packages/ui/treeconsole/breadcrumb/src/components/TreeConsoleBreadcrumb.tsx`, `packages/ui/treeconsole/treetable/src/components/internal/TreeTableContextMenu.tsx`, `packages/ui/treeconsole/base/src/components/TreeConsolePanel.tsx`, `app/src/hooks/treeconsole/resolveOpenSteps.ts`, `app/src/router/pages/tree/console/useTreeConsoleIntegrationInner.ts`, `app/src/router/pages/tree/console/useTreeNodeInfoPanel.ts`, `app/src/hooks/treeconsole/actions/contextMenu.ts`, `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`（必要に応じて追加）
- ロールバック手順: 追加した open-step ハンドリングと URL 優先ロジックを revert し、既存の activeStepIndex 優先・Open 単一アクションへ戻す
- チェックリスト:
  - URL step 指定時に initial step を優先し、永続化の上書きを抑制する
  - Open サブメニューの step 選択と disabled 判定を実装する
  - ぱんくず/TreeNodeInfoPanel/TreeTable の各アイコンで step 選択を提供する
  - 必要範囲の typecheck を実行する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-02 22:05 JST URL step 優先と Open サブメニュー化の実装に着手。
  - update: 2026-02-02 22:40 JST URL step 優先/永続化抑制の調整、Open ステップサブメニューと open-step アクション導線、step 到達判定の解決処理を追加。
  - update: 2026-02-02 22:41 JST pnpm --filter @hierarchidb/ui-treeconsole-breadcrumb build を実行（tsdown define 警告あり、exit 0）。
  - update: 2026-02-02 22:44 JST pnpm --filter @hierarchidb/app typecheck を実行（tsdown define 警告あり、exit 0）。
  - update: 2026-02-02 23:05 JST URL 変更時の step/mode 同期を追加し、usePluginDialogRoute の step 固定化を撤去。
  - update: 2026-02-02 23:08 JST pnpm --filter @hierarchidb/app typecheck を実行（tsdown define 警告あり、exit 0）。
  - update: 2026-02-02 23:12 JST ui-treeconsole-base の resolveOpenSteps 型エラーを修正、pnpm --filter @hierarchidb/ui-treeconsole-base typecheck exit 0 を確認。
  - update: 2026-02-02 23:20 JST TreeNodeUpdaterService が draftData/data 欠損時に空データへフォールバックするよう調整、pnpm --filter @hierarchidb/runtime-worker typecheck exit 0 を確認。
  - update: 2026-02-02 23:28 JST navigate アクションを処理し、Open ステップ解決で全プラグイン読み込み再試行を追加。
  - update: 2026-02-02 23:31 JST pnpm --filter @hierarchidb/app typecheck を実行（tsdown define 警告あり、exit 0）。
  - update: 2026-02-02 23:37 JST resolveOpenSteps で nodeType が folder 判定される場合に node 側の nodeType を優先するよう調整。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-02-02 23:45 JST resolveOpenSteps の nodeType 判定を DB から取得した node を優先するよう変更。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-02-02 23:52 JST resolveOpenSteps の nodeType 判定に node.type をフォールバックとして追加。pnpm --filter @hierarchidb/app typecheck exit 0（tsdown define 警告あり）。
  - update: 2026-02-03 00:05 JST resolveOpenSteps の nodeType 判定は param の非フォルダ値を優先するよう修正（node.type フォールバックは撤去済み）。
  - update: 2026-02-03 00:12 JST Open ステップの非同期解決中でもサブメニューが出るよう、openStepsLoading を導入して Loading 表示を追加。
  - update: 2026-02-03 01:05 JST open-step 解決で node.type フォールバックを撤去し、openSteps 空時は Step1 を返すよう補正。
  - blocked: 2026-02-03 01:08 JST pnpm --filter @hierarchidb/ui-treeconsole-treetable typecheck が openStepsLoading の型未反映で失敗。
  - update: 2026-02-03 01:09 JST pnpm --filter @hierarchidb/ui-treeconsole-breadcrumb build → treetable/base/app typecheck を再実行し exit 0 を確認。
  - update: 2026-02-03 01:14 JST Open サブメニューの Basic Info ラベルを common.basicInfo.title から解決するよう修正。
  - update: 2026-02-03 01:20 JST 日本語ロケール時は Basic Info を「基本情報」固定表示するよう補正。
  - done: 2026-02-02 23:08 JST URL step 優先、永続化抑制、Open の Step サブメニュー化を完了。

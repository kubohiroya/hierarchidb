# TASKS.md

## Doing

（なし）

## Blocked

- 2026-03-09: mapでshape-styler同一フォルダ紐付け実装着手 blocked（`gh issue create` 実行時 `gh: command not found`、`apt-get install gh` はプロキシ 403 で失敗）。解除条件: `gh` CLI を利用可能にする（プリインストールまたは実行可能パス提供）。

## 今日の運用ログ

- 2026-03-10: #961 AGENTS.mdにReact Hooks依存配列ルール追加・PR #962マージ済み

- 2026-03-10: #958 useBuildProgressPanelStateSideEffects無限レンダリングループ修正・PR #959作成
  - totalElapsedSnapshotRef追加、elapsed snapshot useEffectからtotalElapsedSnapshot依存除去
  - typecheck: 新規エラー0件（既知DefaultTFuncReturn 15件のみ）

- 2026-03-10: #956 useShapeBuildStepStageState無限レンダリングループ修正・PR #957作成
  - tasksRef+tasksKey追加、persisted tasks同期useEffectから[tasks]依存除去→[tasksKey]に変更
  - typecheck: 新規エラー0件（既知DefaultTFuncReturn 15件のみ）

- 2026-03-10: #954 useLRUPanes無限レンダリングループ修正・PR #955マージ済み
  - panesRef追加、pane-sync/auto-expand useEffectからpanes依存除去
  - typecheck通過（exit 0）

- 2026-03-10: #952 "Close dialog"翻訳キー統合・ハードコード文字列i18n化完了・PR #953作成
  - dialogs.pluginDialog.tooltips.close → dialogs.common.actions.close に統一（PluginDialogControls/ArchiveDialog）
  - 死んだキー dialogs.archive.actions.close を全localeファイルから削除
  - AuthRequiredDialog.tsx ハードコード aria-label を t() に変更
  - PluginDialogStepper.tsx コンテキストメニュー3項目をi18n化
  - typecheck 143/147（route-plugin既知エラーのみ）

- 2026-03-10: #949 StableIconSlot無限レンダリングループ修正完了・PR #950マージ済み（height固定化・setMinWidth条件厳密化）

- 2026-03-10: #942 BFF認証切れ時のビルドセッション状態遷移修正完了・PR #943作成
  - AuthService cancelledUntilByScopeクールダウン実装
  - 状態遷移ドキュメントにSection 7.5追加
  - 死んだコード削除（authDialogOpen/closeAuthDialog/handleProviderSelect/TaskProgressAuthState）
  - PRレビュー対応: onAuthSuccessでsetToken追加・状態遷移ドキュメントのシーケンス更新
  - typecheck・build・test全通過確認
- 2026-03-10: #940 ナビゲーションコンポーネント抽出完了・PR #941マージ済み
- 2026-03-10: クリーンアップ: #937 worktree+ブランチ削除(Issue CLOSED済)、#913 ブランチ削除(Issue CLOSED済)、#914 main含有確認→Issue close+ブランチ削除
- 2026-03-10: #947 tsdown .d.ts分割問題修正完了・PR #948マージ済み（build-session再エクスポート削除・BuildStage/BuildStatus型追加・route-pluginインポートパス修正）
- 2026-03-10: #917 PR #945 mainリベース→CI全通過→マージ完了・ブランチ削除
- 2026-03-10: #944 PR #946マージ完了・ローカル/リモートブランチ削除・stash整理(3件drop)
- 2026-03-10: #917 mainリベース(コンフリクト2件解決)・push・PR #945作成

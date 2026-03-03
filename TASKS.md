# 運用ハブ

## Doing
- #705 / codex/refactor/ui-extract-logic-hooks / 2026-03-03 20:25
- #708 / codex/chore/ci-build-checks-separation / 2026-03-03 22:10

## Blocked
- Issue #705 進捗コメント投稿（`gh issue comment 705`）: `api.github.com` 接続不可のため保留（解除条件: ネットワーク復旧後に再実行）

## 今日の運用ログ
- 2026-03-03: Issue #709 開始 - Shape build pause同期判定を `sessionRecord` ベースへ修正
- 2026-03-03: Issue #709 進捗 - `PauseWithCancelHookActionsArgs` へ `sessionRecord` を追加し、pause同期判定を `sessionRecord?.status === 'paused'` へ更新（`pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` 成功）
- 2026-03-03: Issue #709 完了 - PR #710 を main へ squash merge、Issue #709 close、作業ブランチ追跡を prune
- 2026-03-03: Issue #708 開始 - `pnpm build` から非必須チェックを分離し、CI向け `ci:checks` と `use*.tsx` ガードを追加
- 2026-03-03: Issue #708 進捗 - `check:ui-hooks-tsx` / `ci:checks` を追加し、`dep-fence-guards.yml` で CI checks → build の順に実行する構成へ変更（`pnpm build` / `pnpm ci:checks` 成功）
- 2026-03-03: Issue #708 進捗 - `app/scripts/generate-favicon.mjs` に既存 `favicon.png`/`favicon.ico` 検出時のスキップを追加し、`pnpm -C app run generate:favicon` でスキップ動作を確認
- 2026-03-03: Issue #705 開始 - packages/ui TSX のロジック分離（カスタムフック化）
- 2026-03-03: Issue #705 進捗 - `ui-tabular` の `TabularDataImport` / `TabularDataFilter` / `TabularColumnSelect` をフック分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-tabular` の `TabularPreviewGrid` を `useTabularPreviewGrid` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-datasource` の `IdeGsmImportPanel` を `useIdeGsmImportPanel` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-file` の `FileInputWithUrl` を `useFileInputWithUrlView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-file` の `UrlDownloadSection` を `useUrlDownloadSectionView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthPanel`/`OAuthCallback` を `useAuthPanelView`/`useOAuthCallbackView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `UserAvatarMenu` を `useUserAvatarMenuView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `UserAvatar` を `useUserAvatarView` へ分離し、型不一致修正後に `typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `BffKvWarningDialog` を `useBffKvWarningDialogView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `LoginForm` を `useLoginFormView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthReadyGate` を `useAuthReadyGateView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthProviderDialog` を `useAuthProviderDialogView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthRequiredDialog` を `useAuthRequiredDialogView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthProviderPrompt` を `useAuthProviderPromptView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthMethodSettings` を `useAuthMethodSettingsView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `AuthErrorListener` を `useAuthErrorListenerView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-auth` の `OidcProvider` を `useOidcProviderView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `CrossViewSnackbar` を `useCrossViewSnackbarView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `DataGridPreview` を `useDataGridPreviewView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `AbstractDataGrid` を `useAbstractDataGridView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `GenericDataGrid` を `useGenericDataGridView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-map` の `LocationPreviewList`/`RoutePreviewList`/`ShapePreviewList` を各 `use*PreviewListView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-map` の `LayerSetVisibilityPanel` を `useLayerSetVisibilityPanelView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-map` の `MapPreviewSearchPanel` を `useMapPreviewSearchPanelView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-map` の `FeatureTableToolbar` を `useFeatureTableToolbarView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `TanstackDataGrid` の制御/同期ロジックを `useTanstackDataGridView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-grid` の `TanstackDataGrid` でテーブル生成/仮想化計算/ヘッダ同期スクロールを `useTanstackDataGridView` へ追加分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-map` の `MapInteractionProvider` で初期化副作用/store解決を `useMapInteractionProviderView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `ui-search-input` の `SearchInput` で入力解決/commit処理/イベントハンドラを `useTreeTableSearchInputView` へ分離し、`typecheck/build` を完了（`test` タスク定義なし）
- 2026-03-03: Issue #705 進捗 - `memory-usage` の `MemoryUsageChart` で描画副作用/制御ハンドラ/表示計算を `useMemoryUsageChartView` へ分離し、`typecheck/build` を完了（`test` タスク定義なし）
- 2026-03-03: Issue #705 進捗 - `ui-map` の `MapPreviewFloatingTable` で状態管理/永続化/列解決ロジックを `useMapPreviewFloatingTableView` へ分離し、`typecheck/build/test` を完了
- 2026-03-03: Issue #705 進捗 - `useMapPreviewFloatingTableView` から JSX を除去し、表示生成（Chip/Box）は `MapPreviewFloatingTable` 側へ戻してロジック/表現分離を厳密化（`typecheck/build/test` 再実行済み）
- 2026-03-03: Issue #705 進捗 - `ui-dynamic-speed-dial` の `DynamicSpeedDial` で submenu action 生成を `useDynamicSpeedDialSubmenuActions` へ分離し、`ui-treeconsole-toolbar` の `SettingsMenu` で state/イベント処理を `useSettingsMenu` へ分離（いずれも `typecheck/build` 成功）
- 2026-03-03: blocked - `gh issue comment 705` 実行時に `error connecting to api.github.com`（ネットワーク復旧待ち）
- 2026-03-03: Issue #703 完了 - Shape Plugin Pauseボタン状態管理とセッション復元の修正
  - Pauseボタンが「Pausing」状態で固まる問題を修正
  - ブラウザリロード後のセッション状態不整合を修正
  - デバッグ機能（Force Reset Stop State）を追加
  - タイムアウト処理とエラーハンドリングを改善
- 2026-03-03: Issue #704 完了 - Shape Plugin Pauseボタン loading 状態問題の追加修正
  - 開発環境でのデバッグボタン「Reset Stop」を追加（ビルド画面右上）
  - コントロールメニューに「Force Reset Stop State」項目を追加
  - forceResetStopState 関数を UI コンポーネントに適切に統合
  - 既存のタイムアウト機構とリセット機能が正常に動作することを確認
  - デバッグテストスイートが全て成功することを確認
- 2026-03-03: Issue #707 完了 - Shape Plugin real-time subscription機能の実装
  - ポーリングベースの状態同期を完全撤去し、real-time subscriptionに置き換え
  - 4通りのイベント配信経路を実装: セッション状態変化、ステージスナップショット、ハートビート（1秒間隔）、タスクプログレス
  - オンデマンド状態問い合わせAPI (`getSessionStateOnDemand`) を追加
  - Worker側でセッション状態変化時の自動イベント発火を実装
  - UI側で新しい `useShapeBuildSessionState` フックを作成し、ポーリングベースの `useShapeBuildSessionRecord` を置き換え
  - `typecheck && build` が成功し、実装完了

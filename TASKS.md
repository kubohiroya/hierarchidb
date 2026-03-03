# 運用ハブ

## Doing
- #705 / codex/refactor/ui-extract-logic-hooks / 2026-03-03 20:25

## Blocked
- Issue #705 進捗コメント投稿（`gh issue comment 705`）: `api.github.com` 接続不可のため保留（解除条件: ネットワーク復旧後に再実行）

## 今日の運用ログ
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
- 2026-03-03: Issue #705 進捗 - `ui-map` の `LocationPreviewList`/`RoutePreviewList`/`ShapePreviewList` を各 `use*PreviewListView` へ分離し、`typecheck/build/test` を完了
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
- 2026-03-03: Shape Plugin Pauseボタン問題の根本修正開始
  - デバッグボタンとメニューを撤去（問題の本質ではないため）
  - 状態同期の問題を調査：Worker SSOT → Event propagation → UI SSOT → UI rendering
  - useShapeBuildStopStateにログを追加して状態遷移を詳細に追跡
  - typecheck/buildが成功し、調査準備完了
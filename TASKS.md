# 運用ハブ

## Doing
- #705 / codex/refactor/ui-extract-logic-hooks / 2026-03-03 20:25
- #704 / fix/shape-plugin/pause-button-loading-state-issues / 2026-03-03 20:00

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
- 2026-03-03: blocked - `gh issue comment 705` 実行時に `error connecting to api.github.com`（ネットワーク復旧待ち）
- 2026-03-03: Issue #703 完了 - Shape Plugin Pauseボタン状態管理とセッション復元の修正
  - Pauseボタンが「Pausing」状態で固まる問題を修正
  - ブラウザリロード後のセッション状態不整合を修正
  - デバッグ機能（Force Reset Stop State）を追加
  - タイムアウト処理とエラーハンドリングを改善
- 2026-03-03: Issue #704 開始 - Shape Plugin Pauseボタン loading 状態問題の追加修正
  - 前回修正の検証と追加対応
  - forceResetStopState 関数の呼び出し確認
  - taskProgressControlsAtom の状態管理検証

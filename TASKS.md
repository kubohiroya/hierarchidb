# TASKS.md

## Doing

- #991 / `fix/auth/suppress-repeated-auth-dialog-991` / 2026-03-10 開始
- #988 / `fix/i18n/route-plugin-type-safety-and-import-cleanup` / 2026-03-10 開始
- #983 / `fix/shape-plugin/rename-steps-processing-to-config` / 2026-03-10 開始
- #970 / `fix/i18n/stepper-basic-info-label-key` / 2026-03-10 開始
- #969 / `refactor/review/gemini-review-batch-fixes` / 2026-03-10 開始


## Blocked

- 2026-03-09: mapでshape-styler同一フォルダ紐付け実装着手 blocked（`gh issue create` 実行時 `gh: command not found`、`apt-get install gh` はプロキシ 403 で失敗）。解除条件: `gh` CLI を利用可能にする（プリインストールまたは実行可能パス提供）。

## 今日の運用ログ

- 2026-03-10: #986 shape-plugin DefaultTFuncReturn型エラー修正・PR #987マージ済み
  - t()戻り値をString()でラップ（5ファイル11箇所）
  - typecheck: shape-plugin exit 0（100/100 tasks successful）

- 2026-03-10: #984 OrResumeキーワード全廃・Startに統一・PR #985マージ済み
  - ファイル名・シンボル名・ログプレフィックスからOrResume除去（~19ファイル）
  - build: 67/67 exit 0

- 2026-03-10: #979 クールダウン中の再ビルド開始で認証ダイアログ非表示修正・PR #980作成
  - awaitAuthでAuthRequiredError throw、runStartBuildSessionでclearCancelledCooldown呼出追加
- 2026-03-10: #977 PluginDialogツールチップi18nキー不足修正・PR #978マージ済み
  - dialogs.pluginDialog.tooltips（7キー）+ buttons（minimize/restoreMinimized）を4ロケールファイルに追加
  - dialogs.pluginDraft.pluginDialog にも minimize/restoreMinimized を追加
  - typecheck: 80/80 exit 0

- 2026-03-10: #972 URL maximize時にプリセットサイズを使用するよう修正・PR #976マージ済み
  - hydration useEffectにmaximizeケース追加（getPresetSize/initialPosition使用）
  - typecheck: 80/80 exit 0

- 2026-03-10: #973 i18n bindI18nStore再レンダリング修正+common.basicInfoキー追加・PR #975マージ済み
  - bindI18nStore: '' → 'added removed' で非同期ロード完了時の再レンダリングを有効化
  - app/public/locales・locales の en/ja に common.basicInfo キーを追加
  - typecheck: exit 0

- 2026-03-10: #969 Gemini Code Assistレビュー指摘一括対応・PR #974マージ済み
  - AGENTS.md禁止パターン2文言修正、ResourceProjectPreviewGroup useNavigate実装
  - BuildStepPanel as string除去、useShapeBuildLabelsキー修正
  - useFloatingWindowController useMemoメモ化、LoadingButton functional setState化
  - useBuildProgressPanelStateSideEffects ref更新をuseEffectに移動
  - typecheck: 全対象パッケージ通過

- 2026-03-10: #966 Build*モジュールをcomponents→ui-build-progressに統合移動・PR #968作成
  - Build*コンポーネント/フック/型を移動、BuildSessionProgressPanelShell廃止
  - サブパスエクスポート移設、全プラグインのインポートパス更新
  - build: 114/114 ✅、typecheck: 144/147 ✅（route-plugin既知エラーのみ）

- 2026-03-10: #964 maximize状態でリサイズ/移動時にdisplayModeをnormalに自動遷移・PR #965マージ済み
  - レビュー指摘対応: nextDisplayMode変数導入でenforceTopLeftMargin条件を明確化・PR #967マージ済み

- 2026-03-10: #960 CommonDialogTitle表示モードtooltip/label i18n化・PR #962→#963マージ済み
  - DISPLAY_MODE_LABELSハードコード→t()化、IconButtonにTooltip追加、localeコピー同期
  - typecheck: exit 0、test: 5/5 passed

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

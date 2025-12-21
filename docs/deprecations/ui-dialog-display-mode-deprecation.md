**Status**
- 2025-09-19: Flag撤去および旧実装のサポートを終了しました。以下は履歴として残しています。

**Scope**
- UI ダイアログの表示モード周りの旧実装/旧APIを段階的に撤廃する計画。
- 影響範囲: Dialog display mode（normal/maximize/full-screen）UI とその永続化。

**対象（旧実装/旧API）**
- 旧 API（@deprecated 済）
  - `PluginDialogProps.fullScreen`
  - `PluginDialogProps.onFullscreenChange`
  - `PluginDialogProps.maximized`
  - `PluginDialogProps.onMaximizeChange`
  - `CommonDialogTitleProps.isFullscreen`
  - `CommonDialogTitleProps.toggleFullscreen`
- 旧 永続化
  - `app/src/shared/display-mode.db.ts`（削除済み）

**新実装（置き換え先）**
- 表示モード API（制御）
  - `displayMode: 'normal'|'maximize'|'full-screen'`
  - `onDisplayModeChange(mode)`
- 永続化
  - `PeerEntity.dialogWindow.mode`（UI/Worker 共有 Dexie）
  - UI ヘルパー: `getPeerDisplayMode(nodeType, nodeId)` / `setPeerDisplayMode(nodeType, nodeId, mode)`

**フィーチャーフラグ**
- `UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE` は 2025-09-19 に削除済み（Phase 3 完了）。

**段階的撤廃（リリースフェーズ）**
- Phase 0（準備）
  - 旧APIに `@deprecated` 付与（済）。
  - 新API/永続化を全対象ダイアログに適用（Route/Resolver/Folder/ProjectWizard 済）。
  - Headless/visual dialog の display mode 操作を単体テストでカバー（2025-09-17 `feat/ui-dialog/displaymode-modernization` で追加）。
  - ドキュメント化（本書）。
- Phase 1（警告段階, vN）
  - Flag: `UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE = true`（デフォルト）。
  - 旧API使用でビルド警告（TS/ESLint）とコンソール警告を出す。
  - 変更ガイドを配布（下記「移行ガイド」）。
- Phase 2（既定無効化, vN+1）
  - Flag デフォルトを false に変更（ローカルや一時的に true 可）。
  - 旧APIは dev 環境でエラー、prod では機能を無効化してハード警告。
  - 新APIへの置換が完了したリポジトリから順次フラグ削除。
- Phase 3（完全撤廃, vN+2）
  - 旧APIコード/型/警告を物理削除。
  - フラグも削除。

**移行ガイド（サンプル）**
- コンポーネント置換
  - NG: `<PluginDialog fullScreen onFullscreenChange={...} />`
  - OK: `<PluginDialog displayMode={mode} onDisplayModeChange={setMode} />`
- タイトル部
  - NG: `<CommonDialogTitle isFullscreen toggleFullscreen={...} />`
  - OK: `<CommonDialogTitle displayMode={mode} onChangeDisplayMode={setMode} />`
- 永続化
  - NG: `display-mode.db.ts` 経由
  - OK: `peer-display-mode.ts` の `getPeerDisplayMode` / `setPeerDisplayMode`

**QA ゲート**
- 単体
  - `getPeerDisplayMode` / `setPeerDisplayMode` 正常系/異常系。
  - 旧API使用時の警告ログが出ること（Phase 1）。
  - `CommonDialogTitle` のクイック切替と `useHeadlessDialogFrame` の displayMode 状態遷移が Vitest で検証されていること。
- 結合
  - 表示モード切替（標準/最大化/全画面）と Fullscreen API 同期。
  - 対象ダイアログで永続化の往復が行えること。
- 回帰
  - moveToTrash / recoverFromTrash では PeerEntity を削除しない。
  - empty trash / discardWorkingCopy では PeerEntity を削除する。

**ロールバック計画**
- Phase 2 で問題発生時はフラグを true に戻して一時退避。
- 元のタグへリリースを巻き戻し後、該当箇所を個別修正。

**コミュニケーション**
- vN リリースノートに旧APIの非推奨化と Phase 時系列を明記。
- vN+1 リリースノートに既定無効化と最終撤廃時期（vN+2）を明記。

**所有者/責任分解**
- オーナー: UI/Dialog モジュール責任者
- レビュー: Runtime-Worker / Plugin 各モジュール責任者

**既知の非対象**
- Cross-tab/Worker 同期は導入しない（オーバースペック）。

**メトリクス（任意）**
- 旧API使用個所数（ビルド時/ランタイム収集）を簡易集計し、Phase 移行判断に活用。

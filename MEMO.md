# メモ（未完/中途半端ポイントと仕上げ提案）

このメモは、直近の要望・確認のやり取りを受けて、設計・実装が中途半端になっている可能性がある箇所と、仕上げ施策をまとめたものです。

## ダイアログ表示モード（標準/最大化/フルスクリーン）
- 現状
  - PluginDialog の `fullScreen`/`maximized` は「初期値」としてのみ扱っており、props 変更の追従（制御コンポーネントとしての動作）は未対応。
  - ExtensibleFolderDialog は NodeId 単位で表示モード（`standard`/`maximized`/`fullscreen`）を保存・復元するが、`d_mode=full`（URL）→「即フルスクリーン突入」はブラウザ制約により自動では不可。ユーザー操作でのトグルが必要。
  - TrashDialog は独自に表示モード保存・復元を実装。他のプラグインダイアログ（PluginDialog 非使用のもの）は未対応。
- 仕上げ提案
  - PluginDialog を「制御可能」に：props 変更（`fullScreen`/`maximized` あるいは displayMode）を監視し、内部 state を追従。
  - 表示モード API の一本化：`displayMode: 'normal' | 'maximize' | 'full-screen'` を追加し、`fullScreen`/`maximized` を内部概念に。`onDisplayModeChange` で外部と同期。
  - ほかのプラグインダイアログ（Route/Resolver 等）にも NodeId/ContextId 単位の保存・復元を横展開。

## TreeConsole 列幅の永続化と削除
- 現状
  - 列幅は `persistenceKey`（`tree:<rootNodeId>`）で保存。ゴミ箱「完全削除」時（Empty All／単体永久削除）に当該ノードのキーを削除する導線は実装済み。
  - 他の永久削除経路（別ダイアログや将来のAPI）から削除された場合のクリーンアップは未配線。
- 仕上げ提案
  - Worker 側の removeNodes 完了イベント（将来のイベントバス）を購読して、クリーンアップを一元化。
  - 永続化キーの粒度（ツリー種別・ビュー種別・ユーザー）を要件に合わせて最終確定。

## Undo/Redo とツールバー状態
- 現状
  - `canUndo`/`canRedo` はポーリング（600ms）で反映。イベント駆動ではないため、瞬時更新や履歴数表示は未実装。
  - Cut/Copy/Paste は簡易グローバル（`__HDB_CLIPBOARD__`）で、Worker 連携のクリップボードは未実装。
- 仕上げ提案
  - コマンドイベントバスに接続し、`canUndo`/`canRedo` をイベント駆動化。履歴数や最後の操作内容の表示も可能に。
  - クリップボードの Worker 連携（セッション/タブ間共有や復元）を検討。

## インライン編集（名前/説明）
- 現状
  - 名前・説明のインライン編集 UI は機能し、保存は `MutationAPI.updateNode` で統一済み。保存後は親ノード直下を再読込。
  - 既定の行クリック動作は Select のため、名前：クリック→編集／説明：ダブルクリック→編集の挙動。単クリックで即編集にするには `rowClickAction="Edit"` 指定が必要。
- 仕上げ提案
  - 編集モード・フォーカス管理を Orchestrator 層へ集約し、ESC/Enter、未変更スキップ、バリデーション（トリム・長さ制限等）を統一。

## DnD（子孫ブロック/パンくずドロップ）
- 現状
  - UI 側ブロックと視覚表示（赤/青破線、`not-allowed` カーソル、`aria-disabled`/`title` 付与）は実装済み。
  - ドラッグプレビュー、フォーカス移動、仮想スクロールとの相互作用の最適化は未対応。
- 仕上げ提案
  - アクセシビリティ向上（キーボード DnD 補助／LiveRegion でのアナウンス）。
  - 大量ノード時のスクロール追従やオートスクロール閾値の調整。

## その他の細部
- PluginDialog の状態永続化：現状はホスト（ExtensibleFolderDialog/TrashDialog）で保存。`persistKey` を PluginDialog に導入して、モード・最終ステップ・スクロール位置などを任意保存できる抽象化も検討可。
- URL 同期：`d_mode=full` は「希望状態」。自動フルスクリーンはブラウザ制約上不可のため、初回にガイダンス（ツールチップ）表示など UX で補助。

## 優先提案（短期で効果の高い順）
1. PluginDialog の制御可能化（props 変更追従）＋表示モード API（`displayMode`）を一本化。
2. Undo/Redo をイベント駆動化（暫定としてコマンド完了時フックで即時再評価）。
3. インライン編集の Orchestrator 集約とバリデーション/未変更スキップの実装。
4. 列幅永続化のキー設計最終化と、Worker イベント経由のクリーンアップ一元化。
5. 表示モード永続化を他ダイアログ（Route/Resolver 等）へ横展開。

## Testing (note for automation)

- Use non-watch commands so the terminal returns promptly.
  - Prefer: `pnpm -C plugins/shape-plugin vitest run`
  - Or: `pnpm -C plugins/shape-plugin test -- --run`
- Avoid starting `pnpm test` if it launches `vitest --watch` / `vitest dev` in this repo。

---
以上。必要に応じてこのメモをタスク化（mrtask）し、順次着手します。

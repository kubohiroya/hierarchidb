# Node-Type Plugins Overview（packages/node-type/*）

作成日: 2025-09-04 / 集計: ユニット/結合テスト（E2E除外）実行結果と実装状況。

注意:
- このファイルはローカル実行結果に基づく。CI は全緑化後に追加予定（TASKS.md の ToDo 参照）。

## @hierarchidb/base-plugin
- 機能概要: プラグイン共通基盤。
- 実装状況: 実装済み。
- 統合/ユニット: なし。
- 成功状況: 未対象。

## @hierarchidb/basemap-plugin
- 機能概要: ベースマップ定義/表示設定（スタイル・ビューポート・表示オプション）。
- 実装状況: 実装済み。互換レイヤー（legacy extension 定義）を補助追加。
- 統合/ユニット: あり（entity handler・extension 検証）。
- 成功状況: 成功（2025-09-04）。Tests 34 passed / 0 failed。
- 対応履歴: `src/extension/definition.ts` 追加、`BaseMapEntityHandler` に既定値調整・WC commit/discard・NodeId 検索一貫化・検索(tags)・文言整合を実装。createEntity は id=NodeId を採用（検索キーの NodeId 収束）。

## @hierarchidb/folder-plugin
- 機能概要: フォルダ型ノード。
- 実装状況: 実装済み。
- 統合/ユニット: あり（UI含む）。
- 成功状況: 未緑化（別途対応予定）。

## @hierarchidb/location-plugin
- 機能概要: 位置情報エンティティ（Shape 連携）。
- 実装状況: 実装済み。
- 統合/ユニット: なし。
- 成功状況: 未対象。

## @hierarchidb/project-plugin
- 機能概要: プロジェクト管理・分析 UI。
- 実装状況: 実装済み。
- 統合/ユニット: なし。
- 成功状況: 未対象。

## @hierarchidb/resolver-plugin
- 機能概要: スキーマ写像（Styler連携）。
- 実装状況: 実装済み。
- 統合/ユニット: あり。
- 成功状況: 成功（2025-09-04）。Tests 39 passed / 0 failed。

## @hierarchidb/route-plugin
- 機能概要: 経路エンティティ。
- 実装状況: 実装済み。
- 統合/ユニット: あり（軽微）。
- 成功状況: 未実行。

## @hierarchidb/shape-plugin
- 機能概要: 形状データ管理。
- 実装状況: 実装済み。
- 統合/ユニット: あり（heavy spec は既定 skip）。
- 成功状況: 失敗（transform エラー）。ENABLE_* ガード部のスケルトン修正が必要。

## @hierarchidb/spreadsheet-plugin
- 機能概要: スプレッドシート取り込み。
- 実装状況: 実装済み（workspace 除外）。
- 統合/ユニット: 一部あり。
- 成功状況: 未実行（除外のため）。

## @hierarchidb/styler-plugin
- 機能概要: 地図スタイリング。
- 実装状況: 実装済み。テストで Spreadsheet 依存をモックへ差し替え。
- 統合/ユニット: あり。
- 成功状況: 失敗（2025-09-04）。mock 導入により解決不能だった期待値（フォーマット名付与・詳細挙動）を次回対応。
- 対応履歴: `vitest.config.ts` で `@hierarchidb/spreadsheet-plugin` を `src/__tests__/mocks/spreadsheet-plugin.ts` にエイリアス。

---

備考:
- すべての数値は本日時点のローカル実行結果。テスト項目の調整やモック拡充により変動する可能性があります。

# プラグイン ビルド・型チェック状況レポート
生成日: 2025-09-09

## 概要
`plugin-test-results.json` と `plugin-test-inventory.json` を基に、各プラグインの型チェック/テスト結果とおおよそのテスト資産規模を集計しました。

## 状況サマリー（最新）

すべてのプラグインで型チェック/テストが成功（ok）しています。

| パッケージ | 型チェック | テスト | 備考（テスト資産/概数） |
|---|---|---|---|
| @hierarchidb/base-plugin | ok | ok | src: 4 / tests: 2 |
| @hierarchidb/basemap-plugin | ok | ok | src: 28 / tests: 3 |
| @hierarchidb/folder-plugin | ok | ok | src: 42 / tests: 7 |
| @hierarchidb/location-plugin | ok | ok | src: 41 / tests: 2 |
| @hierarchidb/project-plugin | ok | ok | src: 20 / tests: 1 |
| @hierarchidb/resolver-plugin | ok | ok | src: 17 / tests: 5 |
| @hierarchidb/route-plugin | ok | ok | src: 40 / tests: 7 |
| @hierarchidb/shape-plugin | ok | ok | src: 125 / tests: 27 |
| @hierarchidb/spreadsheet-plugin | ok | ok | src: 33 / tests: 4 |
| @hierarchidb/styler-plugin | ok | ok | src: 33 / tests: 8 |

補足:
- 出典ファイル: ルート `plugin-test-results.json` / `plugin-test-inventory.json`。
- 以前の暫定レポート（2025-09-06）で指摘していた `folder-plugin` の TS6059 および `route-plugin` の未使用変数は、現状の結果セットでは再現していません。

## 主要な気付き（2025-09-09）

- `shape-plugin` が最も大きなテスト資産（tests: 27, services/worker/ui を横断）。
- `folder-plugin` は階層/DB/ワーキングコピー/ウィザード等の統合テストが整備（tests: 7）。
- `route-plugin` も UI/サービスを跨いだテストが整備（tests: 7）。

## 推奨アクション（短期）

- 継続的実行: ルートで `pnpm -w typecheck && pnpm -w vitest run` を定期ジョブ化（差分検知とレポート更新の自動化）。
- カバレッジ測定: 主要パッケージ（shape/folder/route）から段階導入し、回帰検知を強化。

## ロールバック指針
- 本レポートはドキュメントのみの更新です。ビルドや設定の変更は含みません。

## 実行ログ（抜粋）
- 全プラグイン: typecheck ok / test ok（`plugin-test-results.json` より）
- 規模感（`plugin-test-inventory.json` より）: shape が最大、続いて folder/route/styler。

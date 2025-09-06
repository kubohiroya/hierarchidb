# プラグイン ビルド・型チェック状況レポート
生成日: 2025-09-06

## 概要
ローカル環境で `pnpm --filter @hierarchidb/*-plugin typecheck` を実行し、各プラグインの TypeScript エラー状況を集計しました（数値は型チェック出力に基づく、概数を含む）。

## 状況サマリー（最新）

| プラグイン | TypeScriptエラー数 | 状態 | 主な問題 |
|-----------|-------------------|------|---------|
| base-plugin | 0 | ✅ 良好 | なし |
| basemap-plugin | 0 | ✅ 良好 | なし |
| folder-plugin | 約64 | ❌ 要修正 | tsconfig の `rootDir/include` 不整合。クロスパッケージのソース参照に起因（`TS6059`）。 |
| location-plugin | 0 | ✅ 良好 | なし |
| project-plugin | 0 | ✅ 良好 | なし |
| resolver-plugin | 0 | ✅ 良好 | なし |
| route-plugin | 1 | ⚠️ 軽微 | 未使用変数（`TS6133`、`ThrottledPort.ts`）。 |
| shape-plugin | 0 | ✅ 良好 | なし |
| spreadsheet-plugin | 0 | ✅ 良好 | なし |
| styler-plugin | 0 | ✅ 良好 | なし |

補足:
- 計測コマンドは 2025-09-06 にローカルで実行。`folder-plugin` のエラー数は TypeScript のエラーメッセージ行数からの概算です。
- 以前のレポート（2024-08-31）から大幅に改善し、多くのプラグインがグリーンになっています。

## 主要な気付き（2025-09-06）

- folder-plugin の `TS6059` は「他パッケージのソースファイルが `rootDir` の外にある」ことが原因。`paths`/相対参照を避け、発行物（パッケージ名 import）に統一する必要があります。
- route-plugin は未使用ローカル変数のみ。`noUnusedLocals` 遵守の観点で削除可能。

## 推奨アクション（短期）

1) folder-plugin の tsconfig 是正（最優先）
- `compilerOptions.rootDir` をパッケージ配下に限定し、`include`/`exclude` を適正化。
- 他パッケージの `src` を直接参照している箇所があれば、必ずパッケージ名 import（`@hierarchidb/common-type` 等）へ切替。

2) route-plugin の軽微修正
- `src/services/net/ThrottledPort.ts` の未使用変数を削除。

## ロールバック指針
- いずれの変更も非破壊であり、動作に影響が出た場合は対象パッケージの差分のみリバートで即時復旧可能です。

## 実行ログ（抜粋）
- base/basemap/location/project/resolver/shape/spreadsheet/styler: Found 0 errors
- route: `error TS6133: 'timer' is declared but its value is never read.`
- folder: `error TS6059: File '.../packages/common/types/src/...ts' is not under 'rootDir' '.../packages/node-type/folder-plugin'.`

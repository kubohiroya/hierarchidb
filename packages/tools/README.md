# Tools ワークスペース概要

`packages/tools/` はビルドやコード生成などの補助ツールを束ねる pnpm サブワークスペースです。ルート `package.json` と Turbo の両方から `@hierarchidb/tools` をフィルタ指定して実行すると、ここで定義された各パッケージの `build` タスクが連携して動作します（共通設定はリポジトリ直下の `tsdown.config.ts`）。

## ディレクトリ構成

| ディレクトリ | 種別 | 主な役割 | 備考 |
|--------------|------|----------|------|
| `analyze-licenses` | pnpm パッケージ | OSS ライセンス情報の集計 CLI。`pnpm --filter @hierarchidb/analyze-licenses run build` で `dist/cli.mjs` を生成し、`pnpm analyze:licenses` から呼び出します。 | `tsdown` で Node 向けバンドルを作成。 |
| `codemods` | pnpm パッケージ | 既存コードの一括変換ユーティリティ（例: ESM import 拡張子調整）。`pnpm --filter @hierarchidb/tools-codemods run codemod:esm-ext` で実行。 | 生成物は `dist/` に保存。 |
| `dev-scripts` | pnpm パッケージ | `gen-plugin-loaders` や `sync-peer-dependencies` など、CI／開発時の Node スクリプト群。`pnpm --filter @hierarchidb/tools-dev-scripts run <script>` で呼び出し。 | `@hierarchidb/tools-plugin-manifest-loader` を依存に持つ。 |
| `plugin-manifest-loader` | pnpm パッケージ | プラグインメタ情報（`plugin.manifest.json`）の読み込みラッパー。`@hierarchidb/tools-plugin-manifest-loader` として公開され、他ツールから `loadPluginManifestFromFile` を提供。 | `dist/index.js` に CommonJS/ESM 出力を生成。 |
| `schemas` | pnpm パッケージ | JSON Schema 群（現状はプラグイン manifest 用）。パッケージとして切り出し、各ツールから相対参照しない運用に統一。 | 型生成やバリデーション時に `@hierarchidb/tools-schemas` を参照。 |
| `ticketing/` | Python スクリプト群 | Excel とのタスク連携など、CLI ではなく Python で実装された運用スクリプト。 | pnpm 管理外。必要に応じて仮想環境で実行。 |
| `src/` | 共有ソース | 旧ツールの再配置前ソース。順次上記パッケージへ移動予定。新規実装は各サブパッケージ直下に追加してください。 | 空ディレクトリを残している場合があります。 |

## 実行方法

- まとめてビルドする場合: `pnpm --filter @hierarchidb/tools run build`
- 個別に再生成する場合: 各サブパッケージの `scripts` を `pnpm --filter <name> run <script>` で呼び出します。
- プラグインローダーの再生成: `pnpm tools:gen-plugin-loaders`（ルート `package.json` 経由）。内部では `@hierarchidb/tools-plugin-manifest-loader` → `@hierarchidb/tools-dev-scripts` の順に `build` / `gen-plugin-loaders` を実行します。

## 開発メモ

- すべての TypeScript ビルドは `tsdown` + 共通設定 (`tsdown.config.ts`) に統一しています。新規スクリプトを追加する際は、既存の `build` スクリプトを参考に `tsdown` のエントリーポイントを指定してください。
- `--clean` オプションは生成物ディレクトリのみを削除し、Turbo のキャッシュキーに影響しません。`pnpm turbo run build` 実行時も再計算なく安定動作することを確認済みです。
- 依存パッケージを追加した場合は、`pnpm --filter @hierarchidb/tools run build` を通し、`TASKS.md` の運用ログへ結果を記録する運用とします。

## ロールバック指針

- 個別パッケージの不具合で再利用できない場合は、該当パッケージ配下の `dist/` を削除し、`pnpm --filter ... run build` で再生成してください。
- 旧 `tools/` 配下の直下スクリプトへ戻す必要が生じた場合は、この README と `tsdown` ベースの build スクリプトも合わせて元に戻し、`pnpm tools:build` が従来通り動作することを確認します。

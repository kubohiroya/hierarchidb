# Turbo + tsdown Migration Plan

## 背景と目的
- `tsup` はメンテナンス休止状態となり、公式に `tsdown` への移行が推奨されている。
- 現状のビルド/型検証フローは `tsc + tsup + vite + turbo` が混在し、各パッケージで `tsconfig.json / tsconfig.build.json / tsconfig.typecheck.json` が冗長に存在する。
- Turbo がワークスペース依存を制御しているため、`tsdown` へ移行しつつ `tsc`/`tsup` CLI 依存を排除する構成が可能。
- 目標は **「turbo + tsdown」構成へ統一し、tsc/tsup CLI 依存を撤廃** すること。

## 対象パッケージと関連ファイル
以下は `tsup.config.ts` を保持し、今回の移行対象となるパッケージ群。各パッケージでは `package.json`（scripts）、`tsup.config.ts`、列挙の `tsconfig*.json` を更新対象とする。

| Package | Config Files |
| --- | --- |
| `packages/backend/bff` | tsconfig.json |
| `packages/backend/cors-proxy` | tsconfig.json |
| `packages/batch-runtime-services` | tsconfig.json |
| `packages/batch-types` | tsconfig.json |
| `packages/common/api` | tsconfig.json |
| `packages/common/auth` | tsconfig.json, tsconfig.typecheck.json |
| `packages/common/types` | tsconfig.json |
| `packages/components` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/auth-recovery` | tsconfig.json |
| `packages/features/batch` | tsconfig.json |
| `packages/features/download` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/feature-registry` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/fetch-save-metadata` | tsconfig.json |
| `packages/features/import-export` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/map-adapter` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/map-source` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/route-resolver` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/route-searoute` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/tabular-source` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/tabular-source-xlsx` | tsconfig.json |
| `packages/features/tabular-store` | tsconfig.json, tsconfig.typecheck.json |
| `packages/features/tag` | tsconfig.json, tsconfig.typecheck.json |
| `app/src/plugin-registry` | — |
| `packages/plugin-types` | tsconfig.json |
| `packages/plugin-ui-sdk` | tsconfig.json |
| `packages/runtime/basic-info` | tsconfig.json, tsconfig.typecheck.json |
| `packages/runtime/client` | tsconfig.json, tsconfig.typecheck.json |
| `packages/runtime/plugin-dialog` | tsconfig.json |
| `packages/runtime/worker` | tsconfig.json, tsconfig.typecheck.json |
| `packages/tools/analyze-licenses` | tsconfig.json |
| `packages/vite-plugins/vite-plugin-hierarchidb-plugin-alias` | tsconfig.json |
| `packages/ui/accordion-config` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/auth` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/country-select` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/data-grid` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/datasource` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/dialog` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/file` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/floating-window` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/i18n` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/icon` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/layout` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/license` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/lru-splitview` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/map` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/memory-usage` | tsconfig.json |
| `packages/ui/monitoring` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/navigation` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/routing` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/search-result-window` | tsconfig.json |
| `packages/ui/tabular-extract` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/theme` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/tour` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/base` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/breadcrumb` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/footer` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/speeddial` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/toolbar` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/trashbin` | tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/treetable` | tsconfig.json, tsconfig.test.json, tsconfig.typecheck.json |
| `packages/ui/usermenu` | tsconfig.json, tsconfig.typecheck.json |
| `packages/util` | tsconfig.json |
| `plugins/basemap-plugin` | tsconfig.json |
| `plugins/folder-plugin` | tsconfig.json, tsconfig.test.json |
| `plugins/linker-plugin` | tsconfig.json |
| `plugins/location-plugin` | tsconfig.json |
| `plugins/resolver-plugin` | tsconfig.json |
| `plugins/route-plugin` | tsconfig.json, tsconfig.typecheck.json |
| `plugins/shape-plugin` | tsconfig.json, tsconfig.minimal.json, tsconfig.worker.json |
| `plugins/spreadsheet-plugin` | tsconfig.json, tsconfig.ui.json |
| `plugins/styler-plugin` | tsconfig.json |
| `plugins/timeline-plugin` | tsconfig.json |

**共通で更新すべきルートファイル**
- `package.json`: `build`/`build:types`/`typecheck` スクリプト、依存関係から `tsup` を除去し `tsdown` を追加。
- `pnpm-workspace.yaml` / `turbo.json`: `build`・`typecheck` パイプラインを `tsdown` 基準に再定義。
- `tsup.base.config.ts`（現状）→ `tsdown.base.config.ts` へ置き換え。
- ルート `tsconfig.*`（必要であれば `tsconfig.esm-nodenext.json` 等）: 参照チェーンを `tsdown` と整合させるための最小構成に整理。
- `TASKS.md`: タスク登録および運用ログ更新。

## 作業計画（turbo + tsdown への段階移行）
1. **現状調査と PoC**
   - 代表パッケージ（例: `packages/features/feature-registry`）で既存ビルド・型検証フローを把握。
   - `tsdown` を導入し、`tsup` スクリプトを差し替えた上で Turbo 経由の `build` が成功するか検証。
   - PoC 結果を TASKS 運用ログへ記録。
2. **共通設定の整備**
   - ルートに単一の `tsdown.config.ts` を配置し、各パッケージは CLI の `--config ../../tsdown.config.ts` で参照する。
   - 共通 config では `peerDependencies` と標準 UI 依存を external 扱いにし、`platform: 'node'`, `sourcemap: true`, `clean: false` を既定とする。
   - 複数エントリが必要なパッケージは、`package.json` の `build` スクリプトで `tsdown <entries...>` を列挙しオプションを指定する（例: CLI ツールで `--out-extension .mjs`）。
   - ルート `package.json` の scripts を `tsdown` ベースに更新し、Turbo パイプラインを再定義。
3. **パッケージ単位の移行（バッチ処理）**
   - カテゴリ単位（feature/ui/plugins/runtime/common/tools）で移行順を決定。
   - 各パッケージの `package.json`、`tsup.config.ts`、`tsconfig*.json` を整理。
   - Turbo の依存関係（`package.json#turbo`, `turbo.json`）に `build` タスクを再登録。
   - 各パッケージで `pnpm --filter <pkg> build` を実行して成功ログを取得。
4. **typecheck フロー統合**
   - `pnpm typecheck` を `turbo run build`（または `turbo run build --filter ...`）へ統合し、`tsc` CLI 使用箇所を削除。
   - ルート/パッケージの `tsconfig.typecheck.json` は必要最小限に整理し、IDE 支援用に限定。
   - CI 設定・ドキュメントを更新。
5. **クリーンアップと文書化**
   - 未使用となった `tsconfig.build.json` 等を削除。
   - `tsdown` 導入手順・ロールバック手順を `docs/` と `TASKS.md` に明記。
   - Turbo キャッシュや `.tsbuildinfo` を初期化し、最終確認の `turbo run build` を実行。

## DoD（Definition of Done）
- すべての対象パッケージで `package.json` の `build` スクリプトが `tsdown` を利用し、`tsup` 依存が除去されている（`dev` スクリプトはルートおよび `app/` を除き削除）。
- Turbo パイプラインにおいて `build`/`build:types`/`typecheck` が `tsdown` 基準で成功する（`turbo run build` のワークスペース実行ログ取得済み）。
- ルートおよび各パッケージの `tsconfig.*` が `tsdown` 前提に整理され、不要な `tsconfig.build.json` 等が削除済み。
- `tsdown.base.config.ts`（新規ファイル）により、共通ビルド設定が一本化されている。
- `TASKS.md` の Kanban と運用ログに、移行タスクの進捗／検証結果／ロールバック手順が記録されている。
- CI 設定（`pnpm typecheck` 等）が `tsdown` を前提とした内容に更新され、ベースライン実行結果が共有されている。

## ロールバック指針
- 問題が発生した場合は `tsdown` 導入コミットを revert し、`tsup` + `tsc` スクリプトを復旧する。
- Turbo の `pipeline` 変更を戻し、従来の `build`/`typecheck` タスク構成で再実行してエラー再現を確認する。
- 変更した `tsconfig.*` を差し戻し、`pnpm --filter <pkg> build` が旧構成で成功することを確認する。

## リスクとフォローアップ
- `tsdown` での d.ts 出力挙動がパッケージ固有のビルドに影響する可能性があるため、各パッケージで最低限のビルド検証が必要。
- Turbo 依存グラフが不完全な場合、参照チェーン更新が漏れるリスクがある。必要に応じて `turbo lint` や手動レビューで依存チェックを行う。
- IDE 設定やローカル開発ワークフロー（例: VSCode タスク）が `tsup` を想定している場合は、ドキュメント更新とチーム展開が必要。

以上を踏まえて、`turbo + tsdown` 構成への移行を進める。

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
| `packages/batch-runtime-services` | tsconfig.build.json, tsconfig.json |
| `packages/common/api` | tsconfig.build.json, tsconfig.json |
| `packages/common/auth` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/common/types` | tsconfig.build.json, tsconfig.json |
| `packages/components` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/auth-recovery` | tsconfig.build.json, tsconfig.json |
| `packages/feature/batch` | tsconfig.build.json, tsconfig.json |
| `packages/feature/compute` | tsconfig.build.json, tsconfig.json |
| `packages/feature/download` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/feature-registry` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/fetch-save-metadata` | tsconfig.build.json, tsconfig.json |
| `packages/feature/import-export` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/map-adapter` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/map-source` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/route-resolver` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/route-searoute` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/tabular-source` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/tabular-source-xlsx` | tsconfig.build.json, tsconfig.json |
| `packages/feature/tabular-store` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/feature/tag` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/plugin-registry` | tsconfig.build.json, tsconfig.json |
| `packages/plugin-runtime-services` | tsconfig.build.json, tsconfig.json |
| `packages/plugin-ui-sdk` | tsconfig.build.json, tsconfig.json |
| `packages/runtime/basic-info` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/runtime/client` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/runtime/plugin-dialog` | tsconfig.build.json, tsconfig.json |
| `packages/runtime/worker` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/tools/analyze-licenses` | tsconfig.json |
| `packages/tools/vite-plugin-node-type-registry` | tsconfig.json |
| `packages/ui/accordion-config` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/auth` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/country-select` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/data-grid` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/dialog` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/file` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/floating-window` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/i18n` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/icon` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/layout` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/lru-splitview` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/map` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/memory-usage` | tsconfig.build.json, tsconfig.json |
| `packages/ui/monitoring` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/navigation` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/routing` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/search-result-window` | tsconfig.build.json, tsconfig.json |
| `packages/ui/tabular-extract` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/theme` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/tour` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/base` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/breadcrumb` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/footer` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/speeddial` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/toolbar` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/trashbin` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/ui/treeconsole/treetable` | tsconfig.build.json, tsconfig.json, tsconfig.test.json, tsconfig.typecheck.json |
| `packages/ui/usermenu` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `packages/util` | tsconfig.build.json, tsconfig.json |
| `plugins/basemap-plugin` | tsconfig.build.json, tsconfig.json |
| `plugins/folder-plugin` | tsconfig.build.json, tsconfig.json, tsconfig.test.json |
| `plugins/linker-plugin` | tsconfig.build.json, tsconfig.json |
| `plugins/location-plugin` | tsconfig.build.json, tsconfig.json |
| `plugins/resolver-plugin` | tsconfig.build.json, tsconfig.json |
| `plugins/route-plugin` | tsconfig.build.json, tsconfig.json, tsconfig.typecheck.json |
| `plugins/shape-plugin` | tsconfig.build.json, tsconfig.json, tsconfig.minimal.json, tsconfig.worker.json |
| `plugins/spreadsheet-plugin` | tsconfig.build.json, tsconfig.json, tsconfig.ui.json |
| `plugins/styler-plugin` | tsconfig.build.json, tsconfig.json |
| `plugins/timeline-plugin` | tsconfig.build.json, tsconfig.json |

**共通で更新すべきルートファイル**
- `package.json`: `build`/`build:types`/`typecheck` スクリプト、依存関係から `tsup` を除去し `tsdown` を追加。
- `pnpm-workspace.yaml` / `turbo.json`: `build`・`typecheck` パイプラインを `tsdown` 基準に再定義。
- `tsup.base.config.ts`（現状）→ `tsdown.base.config.ts` へ置き換え。
- ルート `tsconfig.*`（必要であれば `tsconfig.esm-nodenext.json` 等）: 参照チェーンを `tsdown` と整合させるための最小構成に整理。
- `TASKS.md`: タスク登録および運用ログ更新。

## 作業計画（turbo + tsdown への段階移行）
1. **現状調査と PoC**
   - 代表パッケージ（例: `packages/feature/feature-registry`）で既存ビルド・型検証フローを把握。
   - `tsdown` を導入し、`tsup` スクリプトを差し替えた上で Turbo 経由の `build` が成功するか検証。
   - PoC 結果を TASKS 運用ログへ記録。
2. **共通設定の整備**
   - `tsup.base.config.ts` を撤廃し、`tsdown.base.config.ts`（仮称）を新設。
   - `tsdown` 共通設定でエントリ・外部依存・d.ts 出力を一元管理。
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
- すべての対象パッケージで `package.json` の `build` 系スクリプトが `tsdown` を利用し、`tsup` 依存が除去されている。
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

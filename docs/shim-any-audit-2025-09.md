# Shim / `as any` Audit — 2025-09-18

## 概要

- Location / Route / Timeline / Shape / Styler / Spreadsheet / Linker の各プラグインは、`tsup` の d.ts 出力と `package.json` の `exports` / `typesVersions` を整備済み。App 側のシムはこれらに依存する分を削除済み。
- 2025-09-18: App の `@hierarchidb/ui-theme` / `@hierarchidb/ui-auth` / `@hierarchidb/ui-treeconsole-toolbar` / `@hierarchidb/folder-plugin` シムを削除し、正式 d.ts へ移行。`@hierarchidb/common-type` の ambient からも `ui-theme` シムを除去済み。
- 2025-09-18: Styler plugin の typecheck が通るよう import パス／Dexie 型宣言を修正（`dist` 経由の公式 d.ts を参照）。ワークスペース全体の `pnpm -w typecheck` で P0 エラーは解消。
- なお、以下のシム／`as any` はまだ残存している。優先順位を付けて段階的に解消する。

## 未整備の主要シム一覧

| パッケージ | 対象 | 状態 | 対応方針 |
|-------------|------|------|----------|
| `packages/node-type/location-plugin/src/types/batch.d.ts` | `@hierarchidb/batch` | 公式 d.ts 未整備 | `@hierarchidb/batch` に dist d.ts を生成し shim を削除 |
| `packages/node-type/route-plugin/src/types/plugin-dialog-shim.d.ts`<br>`packages/node-type/spreadsheet-plugin/src/types/runtime-ui-plugin-dialog-shim.d.ts` | runtime-ui-plugin-dialog | shim で補完 | runtime-ui-plugin-dialog の export を拡張し shim を撤去 |
| `packages/node-type/timeline-plugin/src/types/rtg-bridge.d.ts` | `react-transition-group` | 型補完の暫定 shim | `@types/react-transition-group` を追加し公式型へ置換 |
| `packages/node-type/location-plugin/src/types/ui-map-augment.d.ts` | `@hierarchidb/ui-map` | UI-map の型不足 | `ui-map` 側で必要 API を dist 型として公開 |
| `packages/feature/auth-recovery/src/shims.d.ts` | `@hierarchidb/util`, `@hierarchidb/common-auth` | 旧 shim が残存 | 既存 dist 型に置換 |
| `packages/feature/map-source/src/types/dexie.d.ts` など | 外部ライブラリ | 公式型未提供 | ライブラリの型確認／導入 or コメント付き維持 |
| `packages/common/types/src/ambient-ui.d.ts` | `@hierarchidb/ui-icon`, `@hierarchidb/ui-core` など | UI 全体共通シム | 各 UI パッケージで dist 型を公開して縮退（`ui-theme` 分は削除済み） |
| `packages/ui/treeconsole/*/ambient-breadcrumb.d.ts` | `@hierarchidb/ui-treeconsole-breadcrumb` | dist 型未検証 | treeconsole-breadcrumb で型を公開し削除 |
| `packages/ui/i18n/src/types/shims.d.ts` | `i18next` 系 | 外部型不足 | 公式型があれば移行、無ければ最小維持 |
| `app/src/types/shims.d.ts` | runtime-worker-bootstrap, common-type, util, virtual:* | 最小化済みだが残存 | UI 系（`ui-theme` / `ui-auth` / `ui-treeconsole-toolbar` / `folder-plugin`）は削除済み。残件は virtual モジュール等 |

## `as any` ホットスポット（概算）

| パッケージ | 件数の目安 | 備考 |
|-------------|------------|------|
| `packages/runtime-worker/worker` | ~465 | Worker API / Dexie ラッパ周辺。最優先でジェネリック化を検討 |
| `packages/node-type/route-plugin` | ~127 | Worker/services 層。新しい d.ts に合わせて型付け可能 |
| `packages/node-type/shape-plugin` | ~114 | MapLibre 周辺。UI-map の型公開とセットで進める |
| `packages/ui/treeconsole` | ~83 | Tree コンポーネントでの構造体 any |
| `packages/ui/auth` | ~66 | BFF 連携コード。API 型の整理が必要 |
| `packages/node-type/location-plugin` | ~59 | Worker / services |
| `packages/node-type/styler-plugin` | ~57 | UI steps・dialog |
| `packages/node-type/spreadsheet-plugin` | ~52 | Steps/UI |
| `packages/node-type/folder-plugin` | ~45 | Worker/UI mix |
| `app/` | ~265 | Worker 初期化・DEV 用ユーティリティ |

（テスト・deprecated ディレクトリは除外済み。`python3` 集計スクリプトで再取得可能。）

### 2025-09-18 自動集計（`pnpm as-any:report`）

```
total occurrences: 1076

top packages:
  app                                        245
  packages/runtime-worker/worker             238
  packages/node-type/route-plugin             95
  packages/node-type/shape-plugin             66
  packages/node-type/location-plugin          48
  packages/ui/treeconsole                     41
  packages/node-type/folder-plugin            40
  packages/node-type/styler-plugin            40
  packages/node-type/spreadsheet-plugin       33
  packages/ui/auth                            32
```

集計は `scripts/report-as-any.mjs`（`pnpm as-any:report`）で再生成できる。`__tests__`/`*.test.*` はカウントから除外している。

## 推奨アクション

1. **App shim の段階削減** — `@hierarchidb/common-type` / `@hierarchidb/util` / `@hierarchidb/runtime-worker-bootstrap` など、すでに dist 型があるものから順に置換。`virtual:plugin-*` は `scripts/generate-virtual-dts.mjs` の強化が必要。
2. **Node-type shim の統合** — 上表の shim をそれぞれ公式 d.ts へ移行。特に plugin-dialog 関連 shim を早期に撤去。
3. **UI ambient の縮退** — `@hierarchidb/ui-icon` 等、軽量な UI パッケージの dist 型公開を確認し `ambient-ui.d.ts` を縮小。
4. **`as any` の削減プラン** — `runtime-worker` → `node-type` → `ui` → `app` の順で重点的に型付け。型公開済みの API から優先して `as any` を排除する。

状態の変化や追加発見があれば本ファイルを更新すること。

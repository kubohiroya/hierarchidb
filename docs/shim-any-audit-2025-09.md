# Shim / `as any` Audit — 2025-09-18

## 概要

- Location / Route / Timeline / Shape / Styler / Spreadsheet / Linker の各プラグインは、`tsup` の d.ts 出力と `package.json` の `exports` / `typesVersions` を整備済み。App 側のシムはこれらに依存する分を削除済み。
- 2025-09-18: App の `@hierarchidb/ui-theme` / `@hierarchidb/ui-auth` / `@hierarchidb/ui-treeconsole-toolbar` / `@hierarchidb/folder-plugin` シムを削除し、正式 d.ts へ移行。`@hierarchidb/common-type` の ambient からも `ui-theme` シムを除去済み。
- 2025-09-18: Styler plugin の typecheck が通るよう import パス／Dexie 型宣言を修正（`dist` 経由の公式 d.ts を参照）。ワークスペース全体の `pnpm -w typecheck` で P0 エラーは解消。
- 2025-09-19 23:05: RouteBatchManager / RouteBatchSession / RouteEntitiesDB の Dexie 操作から `as any` を撤廃し、進捗通知のレガシー互換 I/F を型安全に再実装。`packages/plugins/route-plugin` の `as any` 件数を 93 → 75 まで削減。
- 2025-09-19 23:32: SearouteEngine / OsrmEngine / download registry / config / net ポート周辺を型安全化し、環境変数解決・共有ダウンロードサービス連携を見直し。`packages/plugins/route-plugin` の `as any` は 44 件まで縮減。
- 2025-09-19 23:58: RouteBatchOrchestrationService / SourceOrchestrator / CSV・GeoJSON 戦略を正式型で再構築し、UI LaunchForm まで型付けを連携。`packages/plugins/route-plugin` の `as any` は 18 件まで減少、ワークスペース総数は 747。
- 2025-09-20 00:12: RouteDialog / RoutePanel / UI exports をアダプタ化し、route-plugin 本体の `as any` を 0（tests のみ）まで削減。最新集計ではワークスペース全体が 729 件。
- 2025-09-20 00:45: ShapeEntityHandler / ShapeBatchSession / VectorTileAdapter / RelationStore を型安全化し、shape-plugin の `as any` を 62→52 に削減。ワークスペース総数は 719。
- 2025-09-20 01:20: Shape plugin の UI hooks / ダイアログ / auth 連携から `as any` を撤廃し、MUI props を公式型に合わせて整備。`packages/plugins/shape-plugin` の `as any` は 30 件まで減少し、ワークスペース総数は 697。
- 2025-09-20 01:35: Shape plugin の Dexie GroupStore とバッチ起動 API を型安全化し、`packages/plugins/shape-plugin` は 26 件、ワークスペース総数は 693 に減少。
- 2025-09-20 01:55: Shape plugin の UI パネル／Map preview／Worker API まわりを調整し、`packages/plugins/shape-plugin` は 11 件、ワークスペース総数は 678 に減少（残りはテスト／モックのみ）。
- 2025-09-20 02:10: Shape plugin の extension steps / ハンドラを型安全化し、実装コードの `as any` を 0 件に削減。ワークスペース総数は 667（残差はテスト／モックのみ）。
- 2025-09-20 02:25: Folder plugin の base helpers / dialog steps / in-memory stores を型安全化し、実装コードでの `as any` を削減。ワークスペース総数は 651（残差はテスト・モック中心）。
- 2025-09-20 02:45: Location plugin のダイアログ/パネル/バッチ UI を公式型へ揃え、公開アダプタからの `as any` を撤廃。`pnpm --filter @hierarchidb/location-plugin typecheck` グリーン、ワークスペース総数は 644（location-plugin は 41 件）。
- 2025-09-20 03:05: Location plugin の Dexie ベース stores を型安全化し、peer/group/relation ストアから `as any` を排除。`pnpm --filter @hierarchidb/location-plugin typecheck` / `pnpm as-any:report` で location-plugin 33 件 / ワークスペース 636 件を確認。
- 2025-09-20 03:25: Location plugin のダウンロード戦略とバッチ制御（registry/Overpass/Nominatim/SessionManager）を型整備し、`as any` を実装コードから 10 件まで削減。`pnpm --filter @hierarchidb/location-plugin typecheck` / `pnpm as-any:report` で location-plugin 10 件 / ワークスペース 613 件を確認。
- 2025-09-20 03:35: Location plugin の LocationVectorTileService / SessionController / Custom search ルートを型安全化し、実装コードの `as any` を 0 件へ。`pnpm --filter @hierarchidb/location-plugin typecheck` / `pnpm as-any:report` で location-plugin 0 件 / ワークスペース 603 件を確認。
- 2025-09-20 19:05: TreeConsole breadcrumb / timeline plugin から react-router / react-transition-group シムを撤去し、`packages/common/types/src/@types/react-transition-group` で Node16 対応の公式型を再定義。`pnpm --filter @hierarchidb/ui-treeconsole-breadcrumb typecheck && build` と `pnpm --filter @hierarchidb/timeline-plugin typecheck && build` を実行し問題なし。
- 2025-09-20 03:45: download ヘルパ（localProxy/DownloadService/DexieContentIndexPort）と FetchNetworkPort テストを型整備し、`@hierarchidb/feature-download` の実装 `as any` を撤廃。`pnpm as-any:report` でワークスペース合計 590 件を確認。
- 2025-09-20 03:55: TabularWriter/Indexer/Query を再型付けし、`@hierarchidb/feature-tabular-store` 実装の `as any` を 0 件化。`pnpm as-any:report` でワークスペース 578 件を確認。
- 2025-09-20 04:05: runtime-ui/plugin-dialog の controller/hooks/persistence/route/mocks を型整備し、UI 側実装から `as any` を撤廃。`pnpm as-any:report` でワークスペース 566 件を確認。
- 2025-09-20 04:15: import-export サービスと base-plugin 基盤を型安全化し、ワークスペース全体を 545 件まで削減。`pnpm as-any:report` で feature-import-export/base-plugin の実装 `as any` が 0 件であることを確認。
- 2025-09-20 04:25: runtime-worker NodeLifecycleManager のライフサイクル/参照カウント処理を型安全化し、Worker 側の `as any` を削減。`pnpm as-any:report` でワークスペース 533 件を確認。
- 2025-09-20 07:50: runtime-worker CommandProcessor のバッチ/トラッシュ処理を正式型へ寄せ、superRoot 由来の Trash 解決も型付きでサポート。`pnpm --filter @hierarchidb/runtime-worker typecheck`・`pnpm --filter @hierarchidb/runtime-worker test:run`・`pnpm as-any:report` により runtime-worker 66 件 / ワークスペース 469 件を確認。
- 2025-09-20 07:55: StylerEntityHandler の基底ハンドラ戻り値を型安全にアンラップし、spreadsheetMetadataId の参照漏れを防止。`pnpm --filter @hierarchidb/styler-plugin typecheck` / `pnpm as-any:report` で styler-plugin 18 件 / ワークスペース 421 件を確認。
- 2025-09-20 08:16: WorkingCopyService の手動コミット経路を型付けし、WorkingCopy ホルダー/ノード解決で `as any` を排除。`pnpm --filter @hierarchidb/runtime-worker typecheck`・`pnpm --filter @hierarchidb/runtime-worker test:run`・`pnpm as-any:report` により runtime-worker 33 件 / ワークスペース 388 件を確認。
- 2025-09-20 08:20: WorkingCopyTreeNodeOperations のドラフト/破棄ハンドラを正式型で再構築し、CommandEnvelope 生成から `as any` を排除。`pnpm --filter @hierarchidb/runtime-worker typecheck`・`pnpm as-any:report` で runtime-worker 21 件 / ワークスペース 376 件を確認。
- 2025-09-20 08:30: StageProcessingService のダウンロード/タイル生成パスを型付けし、geojson-vt / vt-pbf の動的 import とストレージ参照から `as any` を除去。`pnpm --filter @hierarchidb/runtime-worker typecheck`・`pnpm --filter @hierarchidb/runtime-worker test:run`・`pnpm as-any:report` により runtime-worker 14 件 / ワークスペース 369 件を確認。
- 2025-09-20 09:45: TreeConsoleIntegration と Subscriptions スタブを型安全化し、テンプレート import・trash サブスクリプション経路から `as any` を撤廃。`pnpm --filter @hierarchidb/app typecheck`・`pnpm as-any:report` で app 97 件 / ワークスペース 343 件を確認。
- 2025-09-20 10:17: AppConfigContext と loadAppConfig の環境変数取得を正式型に揃え、`ImportMetaEnv` を拡張。App 側の env 読み出しから `as any` を 11 件削減し、`pnpm --filter @hierarchidb/app typecheck`・`pnpm as-any:report` で app 86 件 / ワークスペース 332 件を確認。
- 2025-09-20 10:24: InitInspector（dev overlay）の Worker 状態検査を公式 API ベースへ揃え、`window` イベントと `indexedDB.databases()` 周辺の `as any` を撤廃。`pnpm --filter @hierarchidb/app typecheck`・`pnpm as-any:report` で app 78 件 / ワークスペース 324 件を確認。
- 2025-09-20 10:29: Tree route layout (`.../$nodeType/_layout`) の loader/data ハンドリングを型安全化し、未定義パラメータ検証と `useLoaderData` のジェネリック指定で `as any` を除去。`pnpm --filter @hierarchidb/app typecheck`・`pnpm as-any:report` で app 72 件 / ワークスペース 318 件を確認。
- 2025-09-20 10:32: Node target layout (`.../$targetNodeId/_layout`) を `loadTargetNode` の正式型で再配線し、ルートパラメータ検証と移動先ナビゲーションを型安全化。`pnpm --filter @hierarchidb/app typecheck`・`pnpm as-any:report` で app 66 件 / ワークスペース 312 件を確認。
- 2025-09-20 10:44: ui-auth パッケージの OIDC/BFF 環境変数参照を正式型へ統一し、Popup/Recovery サービスからの `as any` を撤廃。`pnpm --filter @hierarchidb/ui-auth typecheck`・`pnpm as-any:report` で app 66 件 / ワークスペース 282 件を確認。
- なお、以下のシム／`as any` はまだ残存している。優先順位を付けて段階的に解消する。

## 未整備の主要シム一覧

| パッケージ | 対象 | 状態 | 対応方針 |
|-------------|------|------|----------|
| `packages/plugins/location-plugin/src/types/batch.d.ts` | `@hierarchidb/batch` | 公式 d.ts 未整備 | `@hierarchidb/batch` に dist d.ts を生成し shim を削除 |
| `packages/plugins/location-plugin/src/types/ui-map-augment.d.ts` | `@hierarchidb/ui-map` | UI-map の型不足 | `ui-map` 側で必要 API を dist 型として公開 |
| ~~`packages/plugins/timeline-plugin/src/types/rtg-bridge.d.ts`~~ | `react-transition-group` | **削除済 (2025-09-20)** | `@types/react-transition-group` を導入済み。tsconfig から typeRoots を撤去し公式型でビルド/型検証が通ることを確認 |
| ~~`packages/ui/treeconsole/breadcrumb/src/types/react-router-dom.d.ts`~~ | `react-router-dom` | **削除済 (2025-09-20)** | `@types/react-router-dom` を devDependencies に追加し、公式型でビルド/型検証が通ることを確認 |
| `packages/plugins/features/map-source/src/types/dexie.d.ts` など | 外部ライブラリ | 公式型未提供 | ライブラリの型確認／導入 or コメント付き維持 |
| `packages/common/types/src/ambient-ui.d.ts` | `@hierarchidb/ui-icon`, `@hierarchidb/ui-core` など | UI 全体共通シム | 各 UI パッケージで dist 型を公開して縮退（`ui-theme` 分は削除済み） |
| `packages/ui/treeconsole/*/ambient-breadcrumb.d.ts` | `@hierarchidb/ui-treeconsole-breadcrumb` | dist 型未検証 | treeconsole-breadcrumb で型を公開し削除 |
| ~~`app/src/types/shims.d.ts`~~ | runtime-client, common-type, util | **削除済 (2025-10-25)**。FeatureFlags ambient 定義を廃止し、UI/Worker の FEATURE_FLAGS 依存を撤去済み |
| （削除済み）`app/src/types/shims-ui-treeconsole-treetable.d.ts` | - | - | `@hierarchidb/ui-treeconsole-treetable` の公式 d.ts 参照へ移行（2025-09-18） |

### 現在残っている shim と理由
- ~~`app/src/types/shims.d.ts`~~: **2025-10-25 削除**。グローバル FeatureFlags 依存を撤去済み。

## `as any` ホットスポット（概算）

| パッケージ | 件数の目安 | 備考 |
|-------------|------------|------|
| `app/` | 58 | ルート/レイアウトが中心。prewarm や worker API 周辺が残課題 |
| `packages/ui/auth` | 0 | 環境変数参照・通知フローは正式型。現状 as any 残なし |
| `packages/plugins/spreadsheet-plugin` | 30 | CSV ドライバ / フィルタユーティリティ |
| `packages/ui/core` | 25 | UI foundation（入力フォーム/ダイアログ） |
| `packages/plugins/styler-plugin` | 18 | UI steps・dialog |
| `packages/backend/bff` | 16 | API ゲートウェイのレスポンス整形レイヤー |
| `packages/runtime/worker` | 14 | Worker API / Dexie ラッパ（テスト含む） |
| `packages/ui/treeconsole` | 12 | Tree コンポーネントでの構造体 any |
| `packages/plugins/basemap-plugin` | 10 | Map preview / Store 旧ロジック |
| `packages/plugins/resolver-plugin` | 10 | ResolverDialog UI |
| `packages/ui/data-grid` | 10 | InMemoryDataProvider など旧モデル依存 |
| `packages/ui/i18n` | 9 | i18n 初期化（lazy load） |
| `packages/plugins/linker-plugin` | 8 | リソース選択ステップ |
| `packages/features/map-adapter` | 6 | MapLibre アダプタ周辺 |
| `packages/features/tabular` | 6 | タブラー書き出しユーティリティ |

（テスト・deprecated ディレクトリは除外済み。`python3` 集計スクリプトで再取得可能。）

### 2025-09-20 00:45 再集計（`pnpm as-any:report`）

```
total occurrences: 719

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/plugins/shape-plugin             52
  packages/plugins/location-plugin          48
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
```

### 2025-09-20 01:55 再集計（`pnpm as-any:report`）

```
total occurrences: 678

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/plugins/location-plugin          48
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/shape-plugin             30
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/folder-plugin            16
```

### 2025-09-20 02:10 再集計（`pnpm as-any:report`）

```
total occurrences: 667

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/plugins/location-plugin          48
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/folder-plugin            16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
```

### 2025-09-20 02:25 再集計（`pnpm as-any:report`）

```
total occurrences: 651

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/plugins/location-plugin          48
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
```




### 2025-09-20 02:45 再集計（`pnpm as-any:report`）

```
total occurrences: 644

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/location-plugin          41
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
```

### 2025-09-20 03:05 再集計（`pnpm as-any:report`）

```
total occurrences: 636

### 2025-09-20 03:25 再集計（`pnpm as-any:report`）

```
total occurrences: 613

### 2025-09-20 03:35 再集計（`pnpm as-any:report`）

```
total occurrences: 603

### 2025-09-20 03:45 再集計（`pnpm as-any:report`）

```
total occurrences: 590

### 2025-09-20 03:55 再集計（`pnpm as-any:report`）

```
total occurrences: 578

### 2025-09-20 04:05 再集計（`pnpm as-any:report`）

```
total occurrences: 566

### 2025-09-20 04:15 再集計（`pnpm as-any:report`）

```
total occurrences: 545

### 2025-09-20 04:25 再集計（`pnpm as-any:report`）

```
total occurrences: 533

top packages:
  app                                        144
  packages/runtime/worker             108
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

### 2025-09-20 08:20 再集計（`pnpm as-any:report`）

```
total occurrences: 376

top packages:
  app                                        123
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/runtime/worker              21
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/ui/treeconsole                     12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

top packages:
  app                                        144
  packages/runtime/worker             120
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/import-export               7
  packages/plugins/base-plugin               7
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/import-export               7
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/location-plugin          10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
```

top packages:
  app                                        144
  packages/runtime/worker             127
  packages/ui/treeconsole                     42
  packages/plugins/styler-plugin            37
  packages/plugins/location-plugin          33
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/features/download                   13
  packages/features/tabular-store              12
  packages/runtime-ui/plugin-dialog           12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
```

### 2025-09-20 07:50 再集計（`pnpm as-any:report`）

```
total occurrences: 469

top packages:
  app                                        123
  packages/runtime/worker              66
  packages/ui/treeconsole                     41
  packages/plugins/styler-plugin            37
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/backend/bff                        16
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

### 2025-09-20 07:55 再集計（`pnpm as-any:report`）

```
total occurrences: 421

top packages:
  app                                        123
  packages/runtime/worker              66
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/ui/treeconsole                     12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

### 2025-09-20 08:16 再集計（`pnpm as-any:report`）

```
total occurrences: 388

top packages:
  app                                        123
  packages/runtime/worker              33
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/ui/treeconsole                     12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

### 2025-09-20 08:30 再集計（`pnpm as-any:report`）

```
total occurrences: 369

top packages:
  app                                        123
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages.runtime-worker/worker              14
  packages/backend/bff                        16
  packages/ui/treeconsole                     12
  packages/plugins/basemap-plugin           10
  packages/plugins/resolver-plugin          10
  packages/ui/data-grid                       10
  packages/ui/i18n                             9
  packages/plugins/linker-plugin             8
  packages/features/map-adapter                 6
  packages/features/tabular                     6
```

### 2025-09-20 09:45 再集計（`pnpm as-any:report`）

```
total occurrences: 343

top packages:
  app                                         97
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages/plugins/basemap-plugin           10
  packages/node-type.resolver-plugin          10
  packages/ui.data-grid                       10
  packages/ui.i18n                             9
  packages/node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
```
### 2025-09-20 10:17 再集計（`pnpm as-any:report`）

```
total occurrences: 332

top packages:
  app                                         86
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
```
### 2025-09-20 10:24 再集計（`pnpm as-any:report`）

```
total occurrences: 324

top packages:
  app                                         78
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
```
### 2025-09-20 10:29 再集計（`pnpm as-any:report`）

```
total occurrences: 318

top packages:
  app                                         72
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
```
### 2025-09-20 10:32 再集計（`pnpm as-any:report`）

```
total occurrences: 312

top packages:
  app                                         66
  packages/ui/auth                            32
  packages/plugins/spreadsheet-plugin       30
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/backend/bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
```
### 2025-09-20 10:44 再集計（`pnpm as-any:report`）

```
total occurrences: 282

top packages:
  app                                         66
  packages/plugins/spreadsheet-plugin       30
  packages/ui.core                            25
  packages/node-type.styler-plugin            18
  packages/backend.bff                        16
  packages/runtime/worker              14
  packages/ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages/ui.data-grid                       10
  packages/ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```
### 2025-09-20 10:48 再集計（`pnpm as-any:report`）

```
total occurrences: 278

top packages:
  app                                         62
  packages/plugins/spreadsheet-plugin       30
  packages/ui.core                            25
  packages/node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```
### 2025-09-20 10:55 再集計（`pnpm as-any:report`）

```
total occurrences: 269

top packages:
  app                                         53
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```
### 2025-09-20 10:58 再集計（`pnpm as-any:report`）

```
total occurrences: 265

top packages:
  app                                         49
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```
### 2025-09-20 11:55 再集計（`pnpm as-any:report`）

```
total occurrences: 254

top packages:
  app                                         38
  packages/plugins/spreadsheet-plugin       30
  packages/ui.core                            25
  packages/node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 11:58 再集計（`pnpm as-any:report`）

```
total occurrences: 251

top packages:
  app                                         35
  packages/plugins/spreadsheet-plugin       30
  packages/ui.core                            25
  packages/node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:06 再集計（`pnpm as-any:report`）

```
total occurrences: 248

top packages:
  app                                         32
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.backend/bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:10 再集計（`pnpm as-any:report`）

```
total occurrences: 244

top packages:
  packages.node-type/spreadsheet-plugin       30
  app                                         28
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.backend/bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:12 再集計（`pnpm as-any:report`）

```
total occurrences: 243

top packages:
  packages.node-type/spreadsheet-plugin       30
  app                                         27
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.backend.bff                        16
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:17 再集計（`pnpm as-any:report`）

```
total occurrences: 233

top packages:
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  app                                         23
  packages.node-type.styler-plugin            18
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.backend/bff                        10
  packages.node-type.babasemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:19 再集計（`pnpm as-any:report`）

```
total occurrences: 230

top packages:
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  app                                         20
  packages.node-type.styler-plugin            18
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.backend/bff                        10
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```

### 2025-09-20 12:28 再集計（`pnpm as-any:report`）

```
total occurrences: 217

top packages:
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  packages.node-type.styler-plugin            18
  packages.runtime-worker/worker              14
  packages/ui.treeconsole                     12
  packages.backend/bff                        10
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  app                                          7
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
```
### 2025-09-20 12:33 再集計（`pnpm as-any:report`）

```
total occurrences: 201

top packages:
  packages.node-type/spreadsheet-plugin       30
  packages.ui.core                            25
  packages.styler-plugin            18
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.backend/bff                        10
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
  packages.ui.monitoring                       4
```
### 2025-09-20 13:31 再集計（`pnpm as-any:report`）

```
total occurrences: 194

top packages:
  packages/ui/core                            25
  packages/plugins/styler-plugin            18
  packages/runtime/worker              14
  packages/plugins/spreadsheet-plugin       12
  packages/ui.treeconsole                     12
  packages/backend/bff                        10
  packages/node-type.basemap-plugin           10
  packages/node-type.resolver-plugin          10
  packages/ui.data-grid                       10
  packages/ui.i18n                             9
  packages/node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
  packages.ui.monitoring                       4
```

### 2025-09-20 14:55 再集計（`pnpm as-any:report`）

```
total occurrences: 182

top packages:
  packages.ui.core                            25
  packages.node-type/styler-plugin            18
  packages.runtime-worker/worker              14
  packages.ui.treeconsole                     12
  packages.backend/bff                        10
  packages.node-type.basemap-plugin           10
  packages.node-type.resolver-plugin          10
  packages.ui.data-grid                       10
  packages.ui.i18n                             9
  packages.node-type.linker-plugin             8
  packages.feature.map-adapter                 6
  packages.feature.tabular                     6
  packages.ui.file                             5
  packages.ui.monitoring                       4
  packages.feature.compute                     3
```

### 2025-09-20 15:05 再集計（`pnpm as-any:report`）

```
total occurrences: 182

追加メモ:
  - spreadsheet-plugin の実装および RED テストから `as any` を除去。テストは `File` モックを正式型に置き換え済み。
  - トップラインの件数は変化なし（他パッケージがボトルネックのまま）。
```

### 2025-09-20 15:12 再集計（`pnpm as-any:report`）

```
total occurrences: 180

追加メモ:
  - ui/core の CrossViewSnackbar / CrossViewStyles の購読解除・スタイル合成から `as any` を除去。
  - ワークスペース全体は 2 件減、ui/core の残件は 23 件まで縮小。
```

### 2025-09-20 15:20 再集計（`pnpm as-any:report`）

```
total occurrences: 175

追加メモ:
  - ui/core の MapLibre 連携フックと Deck 用同期フックで `as any` を整理し、ui/core は 18 件まで減少。
  - 主要ホットスポットは styler-plugin / i18n / data-grid に集約しつつある。
```

### 2025-09-20 15:35 再集計（`pnpm as-any:report`）

```
total occurrences: 160

追加メモ:
  - ui/core の MemoryUsageChart / env util / DataGridPreview / BatchProgress などを型補強し、ui/core の `as any` は 11 件へ減少。
  - 初めて workspace が 160 件台まで到達（styler-plugin 他が次のボトルネック）。
```

### 2025-09-20 15:45 再集計（`pnpm as-any:report`）

```
total occurrences: 157

追加メモ:
  - ui/core の working copy hook / TreeToggleButtonGroup など残存コードから `as any` を除去し、ui/core は 6 件（テストのみ）まで減少。
  - 次のボトルネックは styler-plugin / i18n / data-grid。
```

### 2025-09-20 15:55 再集計（`pnpm as-any:report`）

```
total occurrences: 148

追加メモ:
  - styler-plugin 実装から `as any` を除去し、node-type/styler-plugin の残件はテストのみ 9 件。
  - 次は i18n / data-grid / basemap 等のホットスポットに着手可能。
```

### 2025-09-20 16:05 再集計（`pnpm as-any:report`）

```
total occurrences: 130

追加メモ:
  - ui/i18n 実装から `as any` を撤廃し、ローカライズ基盤を型安全化。
  - ワークスペースは 130 件まで減少（主な残件: runtime-worker / ui-grid / basemap）。
```

### 2025-09-20 16:25 再集計（`pnpm as-any:report`）

```
total occurrences: 100

追加メモ:
  - ui/data-grid の Generic / Abstract グリッド実装と InMemory プロバイダから `as any` を除去（検索・フィルタ・ソートを型安全化）。
  - ワークスペースは 100 件まで減少。現在のホットスポットは runtime-worker / ui/treeconsole / node-type/linker 等。
```

### 2025-09-20 17:06 再集計（`pnpm as-any:report`）

```
total occurrences: 70

追加メモ:
  - runtime-worker の単体テスト・E2E テストから `as any` を全撤廃。Comlink 経由のワーカーテストも型安全化したことで、runtime-worker 配下の実装コード/テスト双方がゼロ件になった。
  - 残り 70 件は backend/bff・feature/tabular・ui/file など周辺パッケージに集中。次はバックエンドのリダイレクト処理 (`redirect-uri.ts`) と MapLibre Adapter を優先候補とする。
```

### 2025-09-20 17:22 再集計（`pnpm as-any:report`）

```
total occurrences: 62

追加メモ:
  - backend/bff の OAuth2 フロー／リダイレクト判定／Turnstile 検証から `as any` を撤廃。`getEnv` ヘルパーで Cloudflare Bindings を型安全に扱うよう変更し、BFF 配下の `as any` を 0 件へ。`pnpm --filter @hierarchidb/bff typecheck` → `pnpm as-any:report` を実行し、ワークスペース合計 62 件（主に map-adapter / tabular / ui-file などが残件）を確認。
```

### 2025-09-20 17:35 再集計（`pnpm as-any:report`）

```
total occurrences: 56

### 2025-09-20 17:45 再集計（`pnpm as-any:report`）

```
total occurrences: 50

追加メモ:
  - tabular パーサ（CSV/JSONL）と RequiredColumnsValidator から `as any` を撤廃し、FileLike メタデータの扱いを共通化。`pnpm --filter @hierarchidb/tabular typecheck` → `pnpm as-any:report` を実行し、ワークスペース合計 50 件を確認（次のフォーカス: ui/file・ui/map・runtime-client など）。
```

### 2025-09-20 21:10 再集計（`pnpm as-any:report`）

```
total occurrences: 0

追加メモ:
  - ui-map・ui-monitoring・ui-lru-splitview・runtime-client など残存ホットスポットの `as any` を段階的に除去。Deck.gl ストーリー向けに最小限の ambient module を追加し、Node16 モジュール解決に合わせて `.js` 拡張子を補完。
  - feature-auth-recovery / tabular-xlsx / runtime-shared-batch-processor / linker-plugin 等も正式型で再構築し、ログ出力や環境判定ロジックでの `process` 依存を `globalThis` ベースへ統一。
  - `pnpm as-any:report` で 0 件を確認。あわせて以下を実行し、対応パッケージの型検証がすべてグリーンであることを確認済み。
    - `pnpm --filter @hierarchidb/util typecheck`
    - `pnpm --filter @hierarchidb/ui-worker-client typecheck`
    - `pnpm --filter @hierarchidb/vite-plugin-hierarchidb-plugin-alias run build`（旧 `@hierarchidb/tools-vite-plugin-package-reader` の typecheck 相当）
    - `pnpm --filter @hierarchidb/auth-recovery typecheck`
    - `pnpm --filter @hierarchidb/tabular-xlsx typecheck`
    - `pnpm --filter @hierarchidb/runtime-shared-batch-processor typecheck`
    - `pnpm --filter @hierarchidb/linker-plugin typecheck`
    - `pnpm --filter @hierarchidb/analyze-licenses typecheck`
    - `pnpm --filter @hierarchidb/ui-icon typecheck`
    - `pnpm --filter @hierarchidb/ui-lru-splitview typecheck`
    - `pnpm --filter @hierarchidb/ui-monitoring typecheck`
    - `pnpm --filter @hierarchidb/ui-map typecheck`
    - `pnpm --filter @hierarchidb/ui-accordion-config typecheck`
    - `pnpm --filter @hierarchidb/ui-import-export typecheck`
    - `pnpm --filter @hierarchidb/ui-treeconsole-base typecheck`
    - `pnpm --filter @hierarchidb/ui-treeconsole-treetable typecheck`
    - `pnpm --filter @hierarchidb/runtime-ui-search-result-window typecheck`
    - `pnpm --filter @hierarchidb/ui-auth typecheck`
    - `pnpm --filter @hierarchidb/ui-file typecheck`
    - `pnpm --filter @hierarchidb/tag typecheck`
```

### 2025-09-20 21:32 Deck.gl ストーリーの型整備

```
追加作業:
  - `packages/ui/map` に deck.gl / GeoJSON 公式型を devDependencies として宣言し、`tsconfig.json` から他パッケージの node_modules 参照を撤廃。
  - `MapWithDeckGLVectorTiles.stories.tsx` を GeoJsonLayer/TileLayer の正式な型シグネチャに合わせて更新し、`story-shims.d.ts` を削除。
検証:
  - `pnpm install`
  - `pnpm --filter @hierarchidb/ui-map typecheck`
  - `node scripts/check-shims.mjs`
  - `pnpm as-any:report`
結果:
  - workspace の shim チェックは許容内（story 用 shim は 0）。`as any` 件数は引き続き 0 件。
```


追加メモ:
  - map-adapter の MapLibreDeckAdapter から `as any` を撤廃し、動的ロード時の環境変数判定と Layer 更新を型安全化。`pnpm --filter @hierarchidb/map-adapter typecheck` → `pnpm as-any:report` を実行し、ワークスペース合計が 56 件に減少（主な残件: feature/tabular・ui/file・ui/map・runtime-client など）。
```


## 推奨アクション

1. **App shim の段階削減** — `@hierarchidb/common-type` / `@hierarchidb/util` / `@hierarchidb/ui-worker-client` など、すでに dist 型があるものから順に置換。`virtual:plugin-*` は `scripts/generate-virtual-dts.mjs` の強化が必要。
2. **Node-type shim の統合** — 上表の shim をそれぞれ公式 d.ts へ移行。特に plugin-dialog 関連 shim を早期に撤去。
3. **UI ambient の縮退** — `@hierarchidb/ui-icon` 等、軽量な UI パッケージの dist 型公開を確認し `ambient-ui.d.ts` を縮小。
4. **`as any` の削減プラン** — runtime-worker（14 件）→ ui/treeconsole（12 件）→ node-type/linker-plugin（8 件）の順で重点的に型付け。型公開済みの API から優先して `as any` を排除する。

状態の変化や追加発見があれば本ファイルを更新すること。

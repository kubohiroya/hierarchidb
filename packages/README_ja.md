# HierarchiDB パッケージ一覧

最終更新: 2026-04-05

## 概要

HierarchiDB モノレポの `packages/` 配下にある全パッケージの目次・索引。カテゴリ別に分類し、各パッケージの README_ja.md へのリンクを提供する。

## カテゴリ別パッケージ一覧

### コア型定義

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| core-types | 共有型定義（Branded Types、エンティティ基底型） | [README_ja.md](./core-types/README_ja.md) |

### プラグイン基盤

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| plugin-base | PluginManifest、PluginStepRegistry、ライフサイクルフック | [README_ja.md](./plugin-base/README_ja.md) |
| plugin-registry | プラグイン登録・解決、モジュールローダー自動生成 | [README_ja.md](./plugin-registry/README_ja.md) |
| plugin-service-api | プラグインサービス API（過渡的 re-export） | [README_ja.md](./plugin-service-api/README_ja.md) |
| plugin-ui-host | プラグインダイアログホスト UI | [README_ja.md](./plugin-ui-host/README_ja.md) |
| plugin-ui-sdk | プラグイン UI 開発 SDK | [README_ja.md](./plugin-ui-sdk/README_ja.md) |
| plugin-presentation | プラグイン表示メタデータ管理 | [README_ja.md](./plugin-presentation/README_ja.md) |

### ビルド・ランタイム

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| build | ビルドシステム基盤（BuildService、AbstractBuildSession） | [README_ja.md](./build/README_ja.md) |
| build-api | ビルドイベント・ステータス型定義 | [README_ja.md](./build-api/README_ja.md) |
| build-runtime-services | ランタイムイベント配信 | [README_ja.md](./build-runtime-services/README_ja.md) |
| build-session-ports | セッション制御ポート（Hexagonal Architecture） | [README_ja.md](./build-session-ports/README_ja.md) |
| runtime-worker | Worker 側データベース・処理基盤 | [README_ja.md](./runtime-worker/README_ja.md) |
| worker-api | WorkerAPI インターフェース定義 | [README_ja.md](./worker-api/README_ja.md) |
| session-coordinator | タブ間セッション調整 | [README_ja.md](./session-coordinator/README_ja.md) |

### データストア

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| chunk-store | チャンクベースデータストア・CAS | [README_ja.md](./chunk-store/README_ja.md) |
| tabular-store | 表形式データ永続化 | [README_ja.md](./tabular-store/README_ja.md) |
| tabular-source | 表形式データパース・取り込み | [README_ja.md](./tabular-source/README_ja.md) |
| tabular-source-xlsx | XLSX パーサー拡張 | [README_ja.md](./tabular-source-xlsx/README_ja.md) |
| shape-store | Shape データストア | [README_ja.md](./shape-store/README_ja.md) |
| location-store | Location データストア | [README_ja.md](./location-store/README_ja.md) |
| route-store | Route データストア | [README_ja.md](./route-store/README_ja.md) |
| spreadsheet-store | Spreadsheet データストア | [README_ja.md](./spreadsheet-store/README_ja.md) |
| styler-store | Styler データストア | [README_ja.md](./styler-store/README_ja.md) |
| resolver-store | Resolver データストア | [README_ja.md](./resolver-store/README_ja.md) |
| yaml-store | YAML データストア | [README_ja.md](./yaml-store/README_ja.md) |
| vectortile-store | ベクトルタイルストア | [README_ja.md](./vectortile-store/README_ja.md) |

### API 定義

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| shape-api | Shape API 型定義 | [README_ja.md](./shape-api/README_ja.md) |
| location-api | Location API 型定義 | [README_ja.md](./location-api/README_ja.md) |
| route-api | Route API 型定義 | [README_ja.md](./route-api/README_ja.md) |
| style-api | Style API 型定義 | [README_ja.md](./style-api/README_ja.md) |
| yaml-api | YAML API 型定義 | [README_ja.md](./yaml-api/README_ja.md) |
| tree-api | ツリー API 型定義 | [README_ja.md](./tree-api/README_ja.md) |
| tag-api | タグ API 型定義 | [README_ja.md](./tag-api/README_ja.md) |

### GIS

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| gis-sdk | GIS SDK（ジオメトリ設定、座標変換） | [README_ja.md](./gis-sdk/README_ja.md) |
| map-adapter | 地図アダプタ | [README_ja.md](./map-adapter/README_ja.md) |
| map-source | 地図ソース管理 | [README_ja.md](./map-source/README_ja.md) |
| vectortile-orchestrator | ベクトルタイルオーケストレータ（UI 側） | [README_ja.md](./vectortile-orchestrator/README_ja.md) |
| vt-orchestrator | ベクトルタイルオーケストレータ（Worker 側） | [README_ja.md](./vt-orchestrator/README_ja.md) |
| route-engine | ルート生成エンジン | [README_ja.md](./route-engine/README_ja.md) |
| route-resolver | ルートリゾルバ | [README_ja.md](./route-resolver/README_ja.md) |
| route-searoute | 海上ルート計算 | [README_ja.md](./route-searoute/README_ja.md) |

### 認証

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| auth | 認証基盤（fetchWithAuth） | [README_ja.md](./auth/README_ja.md) |
| auth-api | 認証 API 型定義 | [README_ja.md](./auth-api/README_ja.md) |

### インポート/エクスポート

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| import-export | データ入出力 | [README_ja.md](./import-export/README_ja.md) |
| import-export-api | インポート/エクスポート API 型定義 | [README_ja.md](./import-export-api/README_ja.md) |

### ユーティリティ

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| util | 汎用ユーティリティ | [README_ja.md](./util/README_ja.md) |
| memory | メモリ管理 | [README_ja.md](./memory/README_ja.md) |
| download | ネットワークダウンロード | [README_ja.md](./download/README_ja.md) |
| tag | タグ管理 | [README_ja.md](./tag/README_ja.md) |
| components | 共有 UI コンポーネント | [README_ja.md](./components/README_ja.md) |
| simulation-workflow | シミュレーションワークフロー | [README_ja.md](./simulation-workflow/README_ja.md) |
| ide-gsm-client | IDE-GSM クライアント | [README_ja.md](./ide-gsm-client/README_ja.md) |

### UI コンポーネント

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| ui/accordion-config | アコーディオン設定 | [README_ja.md](./ui/accordion-config/README_ja.md) |
| ui/auth | 認証 UI | [README_ja.md](./ui/auth/README_ja.md) |
| ui/build-progress | ビルド進捗表示 | [README_ja.md](./ui/build-progress/README_ja.md) |
| ui/build-sessions | ビルドセッション管理 | [README_ja.md](./ui/build-sessions/README_ja.md) |
| ui/country-select | 国選択 | [README_ja.md](./ui/country-select/README_ja.md) |
| ui/data-grid | データグリッド | [README_ja.md](./ui/data-grid/README_ja.md) |
| ui/datasource | データソース選択 | [README_ja.md](./ui/datasource/README_ja.md) |
| ui/dialog | ダイアログ基盤 | [README_ja.md](./ui/dialog/README_ja.md) |
| ui/dynamic-speed-dial | スピードダイアル | [README_ja.md](./ui/dynamic-speed-dial/README_ja.md) |
| ui/file | ファイル操作 | [README_ja.md](./ui/file/README_ja.md) |
| ui/flag-overlay | フラグオーバーレイ | [README_ja.md](./ui/flag-overlay/README_ja.md) |
| ui/floating-window | フローティングウィンドウ | [README_ja.md](./ui/floating-window/README_ja.md) |
| ui/i18n | 国際化 | [README_ja.md](./ui/i18n/README_ja.md) |
| ui/icon | アイコン管理 | [README_ja.md](./ui/icon/README_ja.md) |
| ui/json-treeview | JSON ツリービュー | [README_ja.md](./ui/json-treeview/README_ja.md) |
| ui/layout | レイアウト管理 | [README_ja.md](./ui/layout/README_ja.md) |
| ui/license | ライセンス表示 | [README_ja.md](./ui/license/README_ja.md) |
| ui/lru-splitview | LRU スプリットビュー | [README_ja.md](./ui/lru-splitview/README_ja.md) |
| ui/map | 地図 UI | [README_ja.md](./ui/map/README_ja.md) |
| ui/memory | メモリ管理 UI | [README_ja.md](./ui/memory/README_ja.md) |
| ui/memory-usage | メモリ使用量表示 | [README_ja.md](./ui/memory-usage/README_ja.md) |
| ui/modal-select | モーダル選択 | [README_ja.md](./ui/modal-select/README_ja.md) |
| ui/monitoring | モニタリング | [README_ja.md](./ui/monitoring/README_ja.md) |
| ui/navigation | ナビゲーション | [README_ja.md](./ui/navigation/README_ja.md) |
| ui/plugin-basic-info | プラグイン基本情報ステップ | [README_ja.md](./ui/plugin-basic-info/README_ja.md) |
| ui/plugin-shell | プラグインシェル | [README_ja.md](./ui/plugin-shell/README_ja.md) |
| ui/routing | ルーティング | [README_ja.md](./ui/routing/README_ja.md) |
| ui/search-result-window | 検索結果ウィンドウ | [README_ja.md](./ui/search-result-window/README_ja.md) |
| ui/session-coordinator | セッション調整 UI | [README_ja.md](./ui/session-coordinator/README_ja.md) |
| ui/speeddial-submenu | SpeedDial サブメニュー | [README_ja.md](./ui/speeddial-submenu/README_ja.md) |
| ui/stacked-barchart | 積み上げ棒グラフ | [README_ja.md](./ui/stacked-barchart/README_ja.md) |
| ui/tabular-extract | 表形式データ抽出 | [README_ja.md](./ui/tabular-extract/README_ja.md) |
| ui/theme | テーマ管理 | [README_ja.md](./ui/theme/README_ja.md) |
| ui/tone-curve-editor | トーンカーブエディタ | [README_ja.md](./ui/tone-curve-editor/README_ja.md) |
| ui/tour | ツアー | [README_ja.md](./ui/tour/README_ja.md) |
| ui/usermenu | ユーザーメニュー | [README_ja.md](./ui/usermenu/README_ja.md) |
| ui/worker-client | Worker クライアント | [README_ja.md](./ui/worker-client/README_ja.md) |
| ui/worker-provider | Worker プロバイダ | [README_ja.md](./ui/worker-provider/README_ja.md) |

#### TreeConsole

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| ui/treeconsole/base | TreeConsole ベース | [README_ja.md](./ui/treeconsole/base/README_ja.md) |
| ui/treeconsole/breadcrumb | パンくずリスト | [README_ja.md](./ui/treeconsole/breadcrumb/README_ja.md) |
| ui/treeconsole/footer | フッター | [README_ja.md](./ui/treeconsole/footer/README_ja.md) |
| ui/treeconsole/speeddial | スピードダイアル | [README_ja.md](./ui/treeconsole/speeddial/README_ja.md) |
| ui/treeconsole/toolbar | ツールバー | [README_ja.md](./ui/treeconsole/toolbar/README_ja.md) |
| ui/treeconsole/treetable | ツリーテーブル | [README_ja.md](./ui/treeconsole/treetable/README_ja.md) |

### ツール

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| tools | ツールグループ概要 | [README_ja.md](./tools/README_ja.md) |
| tools/analyze-licenses | ライセンス解析 | [README_ja.md](./tools/analyze-licenses/README_ja.md) |
| tools/build-scripts | ビルドスクリプト | [README_ja.md](./tools/build-scripts/README_ja.md) |
| tools/codemods | コードモッド | [README_ja.md](./tools/codemods/README_ja.md) |
| tools/gen-iso3166-2 | ISO 3166-2 コード生成 | [README_ja.md](./tools/gen-iso3166-2/README_ja.md) |
| tools/load-plugin-manifest | プラグインマニフェスト読込 | [README_ja.md](./tools/load-plugin-manifest/README_ja.md) |
| tools/rel2abs | 相対→絶対パス変換 | [README_ja.md](./tools/rel2abs/README_ja.md) |
| tools/schemas | スキーマ定義 | [README_ja.md](./tools/schemas/README_ja.md) |

### バックエンド

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| backend/bff | BFF サーバー | [README_ja.md](./backend/bff/README_ja.md) |
| backend/cors-proxy | CORS プロキシ | [README_ja.md](./backend/cors-proxy/README_ja.md) |

### テスト

| パッケージ | 説明 | リンク |
| --- | --- | --- |
| testing/plugin-dialog-mocks | プラグインダイアログモック | [README_ja.md](./testing/plugin-dialog-mocks/README_ja.md) |

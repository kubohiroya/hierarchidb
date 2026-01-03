@hierarchidb/shape-plugin
=========================

実装サマリ（2025-09-09）
- nodeType: `shape`
- 定義/ハンドラ: `ShapePluginDefinition` / `ShapeEntityHandler`
- バッチ: download → extract1 → extract2 → vectorTiles（統一バッチ API）
- DB: `shape`（entities）+ エフェメラル `rawBuffers`/`extractedBuffers`/`vectorTiles`/`sessions`/`cache`
- UI: Step5 進捗ビュー、タブラー（`SHAPE_TABULAR=1`）、マップ統合

Shape バッチ機能の新アーキテクチャ概要と利用メモ。

オープンデータ提供元まとめ（概要）
----------------------------------

| データソース名 | 提供データ内容 | データ量（件数・サイズ：概算） | 利用ライセンス |
| - | - | - | - |
| OpenStreetMap (Overpass API) | OSMジオメトリ（行政界/道路/自然 等）GeoJSON化 | クエリ依存（数千〜数十万件） | ODbL 1.0 |
| Natural Earth | 行政界/都市/海岸線/水系（Shapefile→GeoJSON） | レイヤ毎ZIP 5–50MB | Public Domain |
| GADM | 行政界（国別/レベル別、GPKG/Shape） | 国別20–300MB、世界版1–4GB規模 | Academic use only（学術利用） |
| GeoBoundaries | 行政界（国×ADMレベル、GeoJSON） | 国×レベルごと0.5–50MB | 境界ごとに異なる（多くはCC BY 4.0、APIのlicenseDetail参照） |

全体像（段階）
---------------
- download → extract1 → extract2 → vectorTiles の段階実行。
- 構成要素（feature への依存）
  - download: `@hierarchidb/download`（DownloadService, FetchNetworkPort）
  - chunk-store: `@hierarchidb/chunk-store`（DexieChunkStore）
  - auth: `@hierarchidb/auth-recovery`（401復帰, fetchWithAuth, setToken）
  - compute: `@hierarchidb/compute`（タスク実行）
  - batch: `@hierarchidb/batch`（段階並列・進捗）
  - source/view: `@hierarchidb/map-source`, `@hierarchidb/map-adapter`（任意）

ダウンロード
------------
- `DownloadWorker` は DownloadService を優先使用（Dexieへチャンク保存→ `readAll()` で解析）
- HTTP は `auth.fetchWithAuth()` 経由に統一（401時は UI 復帰後に自動再試行）

簡約処理
--------
- extract1: Douglas–Peucker + 最小面積フィルタで `extractedBuffers(stage="extract1")` に永続
- extract2: ズーム別統計・準備（`extractedBuffers(stage="extract2")`）
- vectorTiles: 必要最低限の MVT ダミー生成（テスト通過の最小実装）。本実装は今後段階的に置換可能。

認証連携（UI）
---------------
- UI 起動時に `registerAuthUIHandlers(prompt)` を登録（`@hierarchidb/ui-auth`）。
- サインイン/更新時は `setShapeAuthToken(token, 'Bearer', expiresAt)` を呼び、以後の HTTP に Authorization を付与。

進捗/通知
---------
- 各段階は `BatchSessionManager` から進捗イベントを発行（25/50/75/100%）。
- 401 発生時は `AuthRequired` 通知を UI に送出し、`AuthSuccess`/`AuthCancelled` で処理再開/中断。

今後の改善余地
--------------
- vectorTiles: 本実装（MVT エンコード/圧縮）とキャッシュ（CAS）
- extract2: タイル境界クリップの導入
- map-source: R木/LOD で抽出高速化

ドラフト保存フロー（UI→Worker→Dexie）
--------------------------------------
- 対象: Shape の PluginDialog（Step2 以降のフォーム更新）。
- UI フロー:
  - 各ステップの `onUpdate` は `ShapeDialogHost` の `handleUpdate` を呼ぶ。
  - `handleUpdate` は `useTreeNodeUpdater.updateDraft` にパッチを渡し、`draftData` をマージしつつ `draftMetadata`（name/description/tags）も更新する。
  - BasicInfoStep は `persistBasicInfo` 経由で `draftMetadata` のみを更新。
  - `saveDraft` は最後に `commitDraft` を実行し、必要なら auto-rename で確定。
- plugin-ui-sdk `useTreeNodeUpdater`:
  - `updateDraft` はローカル state を更新し、150ms デバウンスの `persistDraft` を起動。
  - `persistDraft` は Worker クライアント (`wc`) に対し `updateTreeNodeDraftMetadata` → `updateTreeNodeDraftData` を送る。
  - `saveDraft` も同じ 2 API を送った後に `commitDraft` を呼ぶ。
- Worker 側:
  - DraftService（runtime-worker）が DraftAPI を実装。`updateTreeNodeDraftData/Metadata` は `DraftTreeNodeOperations` を呼ぶ。
  - `DraftTreeNodeOperations.updateTreeNodeDraftData` は CoreDB(Dexie) の `nodes` テーブルで `draftData` をマージ更新（`{ ...prev, ...updater }`）。`draftMetadata` も同様にマージ。
  - `commitDraft` は working copy を本番ノードへ反映し、`useTreeNodeUpdater` は返却ノードを `toDraftData` で再正規化して state を更新。
- ポイント: Form 入力 → `updateDraft` → Worker DraftService → Dexie `nodes.draftData` までが即時同期され、`saveDraft` で `commitDraft` まで進む構造。

依存管理とインポート規約（重要）
--------------------------------
共通方針は packages/plugins/CONTRIBUTING.md を参照。要点:
- peerDependencies: react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, dexie, （必要時）maplibre-gl, react-i18next, i18next
- dependencies: @hierarchidb/util、必要に応じて @hierarchidb/features/*（例: @hierarchidb/table-metadata など）
- devDependencies: typescript/tsup/vitest/@testing-library/*/@types/*
- import は公開API、型は `import type`、重い処理は dynamic import。
- tsup external は共通設定で外部化済み。

## Tabular Preview（データテーブル）
- フラグ `SHAPE_TABULAR=1` を有効にすると、Step5 の進捗ビューに「Data Table」タブが追加され、簡略化後のプロパティ表を閲覧できます。
- 機能: 複数条件フィルタ（AND）、列の可視切替、`eq` 条件の索引（初回遅延作成）。
- 目的: プロパティ水準での確認・検索。正式なシリアライズ/デシリアライズは Import/Export を利用してください。


## Batch execution design (2025-12 WIP)
- Entry (UI Step5): call worker API `startBatchSession(nodeId, config)`; UI keeps `sessionId` and subscribes to progress.
- Worker API: expose `startBatchSession`, `pauseSession`, `resumeSession`, `cancelSession`, `subscribe(sessionId, cb)`; bridge ProgressInfo to UI.
- Batch manager: `UnifiedShapeBatchManager` coordinates stages (download → extract1 → extract2 → vectorTiles) and emits stage-scoped progress.
- Ephemeral DB (Dexie, `getDBName('shape-ephemeral')`):
  - `sessions` (state/config), `rawBuffers` (downloaded), `extractedBuffers` (stage1/2), `vectorTiles` (tiles), `cache` (optional).
- Child workers:
  - Downloader worker: parallel download -> write `rawBuffers`.
  - Extract workers: read `rawBuffers`, write `extractedBuffers` (stage1/2) via runtime worker client `extractStage1/2`.
  - Tile worker: read `extractedBuffers`, generate MVT -> write `vectorTiles`.
- Progress: aggregated in UnifiedShapeBatchManager; mapped to `ProgressInfo` and dispatched via worker API subscription.
- UI controls: Start -> `startBatchSession`, Pause/Resume -> `pauseSession`/`resumeSession`, Cancel -> `cancelSession`; BuildStepPanel reflects progress stream.

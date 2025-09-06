# Route Plugin — バッチ処理基盤 実装計画（feat/route/batch-processing-implementation）

状態: Draft（合意後に確定）
対象ブランチ: `feat/route/batch-processing-implementation`
最終更新: 2025-09-06

この計画は、route-plugin にバッチ処理基盤を導入し、shape-plugin から抽出された `feature/batch`・`feature/download`・`feature/compute` を再利用して、
大規模な経路計算/加工を安全に段階導入するためのものです。ドキュメント/会話は日本語、コード内コメントは英語とします。

## 1. 目的 / 非目的

- 目的
  - Route プラグインに、再開可能・観測可能・拡張可能なバッチ処理基盤を導入する。
  - 既存の `feature/*`（batch/download/compute）を再利用し、重複実装を避ける。
  - UI から “大量の経路再計算/マトリクス/属性付加” を非同期ジョブとして実行・監視・エクスポートできるようにする。
  - 直線/大圏/OSRM/searoute の各エンジンを、レーン別スロットリングとリトライで安定運用する。

- 非目的
  - 新しいスケジューラ/ジョブ基盤の自作（既存の `feature/batch` を利用）。
  - 既存のネットワーク層/RateLimiter の再発明（`feature/download` の NetworkPort を拡張/再利用）。
  - ルーティングアルゴリズムの新規開発（必要最小のアダプタ実装に限定）。

## 2. 既存実装へのアライン

- エントリ/配置
  - バッチ制御の入口は `packages/node-type/route-plugin/src/services/RouteBatchManager.ts` を用いる。
  - エンジン呼び出しは `src/services/RouteGenerator.ts` に集約し、`osm_route`/`searoute` は注入アダプタへ委譲（direct/great_circle は既存維持）。
  - Feature Registry から `net.port`（`@hierarchidb/download` 提供）や `route.engine.*` を取得して使用する。

- 重複排除（最重要）
  - スケジューラ/ジョブ: `feature/batch` のストア/実行ループを利用し、Route 固有は薄いアダプタのみ。
  - ネットワーク/スロットリング: `feature/download` の `FetchNetworkPort`（RPS・globalConcurrency・指数バックオフ付き）を再利用。
  - 幾何/TopoJSON/MVT: shape-plugin の既存ユーティリティ/ワーカーを `feature/compute` 経由で再配線。新規実装は行わない。

### 2.A Cross-Plugin Sharing（shape/location との共用最大化）

- Batch セッション管理の共通化
  - 参照元: `packages/node-type/shape-plugin/src/services/BatchSessionManager.ts`、`packages/node-type/location-plugin/src/services/batch/BatchSessionManager.ts`
  - 方針: `BatchSessionCore` を runtime-shared（または `@hierarchidb/batch`）へ抽出し、route/shape/location が継承利用。
  - 最小化案: 当面 route は互換 I/F を持つラッパ（shim）を維持しつつ、内部実装を shape の `BatchSessionManager` と同等のイベント/スナップショット構造へ寄せる。

- 進捗イベント/スナップショット
  - 参照元: location の `LocationBatchSessionManager.onProgress()` と Ephemeral DB への sessions 記録。
  - 方針: `ProgressEmitter`/`ProgressSnapshotStore` を runtime-shared へ昇格し、shape/location/route で共用。Dexie のスキーマはプラグインごとの差分を許容。

- ネットワーク/認証の統一
  - 参照元: shape のダウンロード段階（AuthRecovery/通知）、feature/download の `FetchNetworkPort`。
  - 方針: 認証通知（`AuthNotificationRegistry`）と `net.port` の注入を route へ導入し、429/401 リカバリの規約を統一。

- ベクトルタイル/幾何パイプライン
  - 参照元: shape の `SimplifyWorker1/2`, TopoJSON トポロジ生成、vt-pbf 生成手順。
  - 方針: TopoJSON 簡略化・MVT 生成ステップを `feature/compute` の共有ステップとして切り出し、route は線形ジオメトリをそのまま投入できるようにする。

- UI フック/コンポーネント
  - 参照元: location の `useLocationProgress` / `BatchProgressDialog`。
  - 方針: 進捗フック構造を共通化（`useBatchProgress(capKey: string, id)` など）し、route は薄いラッパを提供。

## 3. ユースケース

- N 本の候補経路を選択して、プロファイル X で再計算し、完了後に TopoJSON/GeoJSON/CSV でエクスポート。
- 多数の起終点ペアから距離/所要時間マトリクスを作成し、CSV で取得。
- 既存経路に対して標高付与・スナップ・平滑化などの属性付加を一括実行、失敗のみ再試行可能。

## 4. アーキテクチャ概観

- ジョブ/タスク（`feature/batch`）
  - エンティティ: BatchJob / BatchTask / BatchResult（`queued → running → succeeded|failed|cancelled`）。
  - 冪等性: `jobKey = hash(spec + pluginVersion + profile)`。同一キーの再実行は既存ジョブを返す。
  - チェックポイント: チャンク完了ごとにカーソルと件数を保存、クラッシュ後に再開。

- 実行（`feature/compute`）
  - 小さな純粋関数の鎖としてパイプライン化（入力復元→分割→計算→永続化→進捗通知）。
  - 並列/レート制御: レーン別セマフォ + NetworkPort（RPS/並列/バックオフ）。
  - リトライ: 指数バックオフ、最大試行、恒久/一時的エラー分類。

- ネットワーク（`feature/download`）
  - `FetchNetworkPort` を利用。既定: `perHostConcurrency`、`globalConcurrency`、`rps`、`retryPolicy` を環境/設定で上書き可能。
  - Feature Registry で `provide('net.port', instance)`。Route 側は `require('net.port')` で取得。

- ジョブ種別（Route）
  - `route/recompute`: ルート再計算（profile 付き）。
  - `route/matrix`: OD マトリクス（距離/時間）。
  - `route/enrich`: 平滑化・標高・スナップなどの属性付加。

## 5. E2E フロー（段階パイプライン）

1) Job Ingest
   - OD ペアとエンジン/モードを永続化（IndexedDB/Dexie; `feature/batch` ストア）。
   - 例: `jobs{ id, startId, endId, type, mode, priority, regionKey, lengthKmApprox, status, attempts }`
   - `regionKey`（geohash/S2/Morton）で地理分割、`lengthKmApprox`（大圏推定）で距離ビン分け。

2) Scheduler（公平 + スロットリング）
   - レーン分割: `LANE_OSRM(rps=1, conc=1)`, `LANE_SEAROUTE(conc=2–4)`, `LANE_LOCAL(direct/great_circle; conc=16–64)`。
   - Weighted-fair queue + レーン別セマフォ。NetworkPort で RPS/バックオフを統合制御。
   - `regionKey × 距離ビン` の小バッチ（200–1000）でローカリティ向上。

3) Routing Workers
   - OSRM: 1RPS/1並列。429/5xx は指数バックオフ。
   - Searoute: CPU 負荷が高く 2–4 並列。Local（直線/大圏）は大並列可。
   - 出力: `RouteFeature{ distance_m, duration_s?, engine, mode, profile }` をストリーム保存。

4) Route Store（Dexie）
   - `routes{ routeId, odId, type, mode, distance_km, duration_min?, bbox, geom }`
   - `geom`: 量子化（1e5）+ Δエンコード or geobuf、必要に応じて pako 圧縮。

5) Tile-Index → Tiler（任意・shape 共通化）
   - bbox→候補タイル集合（minZ,maxZ）→ クリップ/簡略化 → `vt-pbf` でエンコード。
   - `tile_index{ tileKey, routeId }`（append-only）と `tiles{ tileKey, mvtPbf, stats }` を保存。

6) UI 進捗/制御
   - 進捗スナップショットを 10Hz で合流・送出（`ProgressEmitter`）。Dexie に最後のスナップショットを保存して復元。
   - 一覧/詳細ビュー、レーン別メトリクス（RPS/並列/スロットリング時間）、失敗のみ再実行、エクスポート。

## 6. データ/型 追加（破壊的変更なし）

- `RouteBatchSpec`: 入力（route ids / waypoints / OD ペア）、オプション（profile, chunkSize, concurrency）。
- `RouteBatchOutput`: 各タスクの出力（距離、所要時間、ジオメトリ、エラー）。
- 由来メタ: ルートに `lastBatchJobId`, `lastBatchAt`, `profileUsed`（任意）を追加。

## 7. API 表面

- Worker/Command
  - `startRouteBatch(spec: RouteBatchSpec): Promise<BatchJobId>`
  - `getRouteBatch(jobId): Promise<BatchJob>` / `cancelRouteBatch(jobId)` / `resumeRouteBatch(jobId)`
  - `exportRouteBatch(jobId, filter, format): Promise<DownloadHandle>`

- UI Hooks（雛形あり）
  - `useRouteBatchProgress(jobId)`→ 進捗スナップショット（Dexie 復元 + ライブ）。
  - 一覧/詳細は runtime-ui の既存パターンを踏襲。

## 8. 並列・RPS・バックオフ（既定値）

- レーン既定
  - OSRM: `rps=1`, `concurrency=1`, `backoffBaseMs=500`, `factor=2`, `maxMs=10000`
  - Searoute: `rps=5`, `concurrency=2–4`
  - Local: `rps=20`, `concurrency=16–64`
- 上書き: ジョブ Spec/環境変数で可。実装は `FetchNetworkPort` の `globalConcurrency`/`rps` を利用。

## 9. 信頼性 / 冪等

- `jobKey` により重複投入を回避。チャンク単位でチェックポイントを保存し再開。
- 恒久エラー（検証/4xx）と一時エラー（429/5xx/ネットワーク）を分類して再試行。

## 10. 観測性

- 進捗: `jobsDone/routesDone/tilesDone`、フェーズ別%、ETA、平均/95p レイテンシ。
- レーン: `rps, concurrency, throttledMs, errors` を集計。
- ログ: チャンクサマリ、失敗サンプル（上限 N）を保持。

## 11. UI/UX

- 起動: ツールバー「Batch → Recompute / Matrix / Enrich」→ ダイアログ。
- 進捗: 全体バー + フェーズ別バー、レーンメトリクス、失敗のみ再実行、エクスポート（CSV/GeoJSON/TopoJSON）。
- 通知: 開始/完了/失敗を Snackbar/OS 通知（任意）で提示。

## 12. テスト戦略（TDD）

- 単体: 各エンジンアダプタ、距離/時間計算、TopoJSON 生成、スロットリング。
- 統合: Worker 内でキャンセル/再開/失敗のみ再実行、10k 件でチェックポイント確認。
- UI: ダイアログ検証、進捗フックの状態遷移、イベント合流（10Hz）。

## 13. ロールアウト / フラグ / ロールバック

- フラグ
  - `ROUTE_BATCH_ENABLED`（dev 既定 ON、prod 既定 OFF → 検証後に段階的有効化）。
  - 必要に応じて `ROUTE_MATRIX_ENABLED` を個別制御。
- ロールバック
  - フラグ OFF で即切戻し可能。DB スキーマは追加のみで互換維持。

## 14. 受け入れ基準（DoD）

- 3 ジョブ種別（recompute/matrix/enrich）が 1 万件規模で完走し、再開/失敗のみ再実行を確認済み。
- UI で進捗/メトリクスが表示され、CSV/GeoJSON/TopoJSON のエクスポートが可能。
- メインスレッドブロックなし、メモリは閾値内、型/テスト/リンタ/ビルドが全てグリーン。

## 15. 作業分解（WBS / マイルストーン）

M1: スキャフォールディング & 重複排除（1–2日）
- [ ] 既存資産の棚卸し（engine/NetworkPort/batch/geometry）。
- [ ] `RouteBatchManager` にレーンセマフォを導入（OSRM=1, SEA=2–4, LOCAL=16–64）。
- [ ] `RouteGenerator` をアダプタ注入型に整理（osm_route/searoute 委譲）。
 - [ ] ProgressEmitter/Store の共通 I/F を runtime-shared に昇格（または共通 import パスを暫定定義）。

M2: パイプライン実装（3–5日）
- [ ] タスクマッパ（recompute/matrix/enrich）を実装。
- [ ] `feature/compute` で処理鎖を構成、チェックポイント/`jobKey` 実装。
- [ ] NetworkPort をレーンごとに適用（RPS/並列/バックオフ）。
 - [ ] shape の TopoJSON/MVT ステップを `feature/compute` 共有化し、route の最終段に接続。

M3: UI（2–3日）
- [ ] 起動ダイアログ、入力検証、見積表示。
- [ ] 進捗ビュー（10Hz 合流・Dexie 復元）、失敗のみ再実行、エクスポート。
 - [ ] location の BatchProgressDialog パターンを流用し、共通フック `useBatchProgress` 形に寄せる。

M4: 観測性/ハードニング（2–3日）
- [ ] レーン別メトリクス、ETA 安定化、429/5xx リトライ分類強化。
- [ ] 10k soak、メモリ上限/スループット測定、閾値内で合格。
 - [ ] AuthRecovery と 401/403 ハンドリングを shape と同一規約に合わせる。

M5: ドキュメント/サンプル（1日）
- [ ] README/使用例/FAQ を更新。Example スクリプトを追加。

## 16. 依存/リスク/緩和

- 依存: `@hierarchidb/batch`, `@hierarchidb/download`, `@hierarchidb/compute`, Runtime Worker, Feature Registry。
- リスク: 外部 API のレート制限、巨大ジオメトリの書き込み、IndexedDB 容量。
- 緩和: レーン/RPS 制御、チャンク/圧縮、エクスポート・分割処理、キャッシュ。

## 17. オープン事項（要合意）

- モード→エンジンプロフィールの正規マッピング（OSRM/searoute）。
- 出力既定（TopoJSON を既定、GeoJSON/CSV は任意）と圧縮方針。
- タイル z 範囲（minZ/maxZ）の既定値。
- 本番既定の RPS/並列（環境変数で可変）。

## 18. 運用（TASKS.md との連携）

- すべてのタスク/進捗はリポジトリ直下の `TASKS.md` に記録（Single Source of Truth）。
- ブランチ命名: `<type>/<scope>/<slug>`（例: `feat/route/batch-processing-implementation`）。
- 受け入れ基準（DoD）とロールバック手順をタスクごとに明記。小粒差分で PR を積み上げ、既定 OFF のフラグで段階導入。

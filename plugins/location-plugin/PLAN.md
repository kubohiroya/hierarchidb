# Location Plugin リファクタリング計画（batch/download 再利用）

最終更新: 2025-09-06

本ドキュメントは、`location-plugin` を `shape-plugin` から抽出された共通フィーチャ（`@hierarchidb/batch`, `@hierarchidb/download`）を再利用して、ダウンロード→バッチ処理→ベクトルタイル生成を行う流れにリファクタリングするための実行計画です。

---

## 背景と目的

- これまで `location-plugin` は単発処理/直列フローが中心で、長時間処理・再開・可観測性の要件を満たしにくかった。
- `shape-plugin` で整理した共通コンポーネント（batch, download）を横展開し、実装重複を排除するとともに、信頼性/再現性/保守性を高める。
- 計算/タイル化の共通基盤は現状未整備のため、当面は `location-plugin` 側の実装で対応する。
- 目標は「データソースからのダウンロード→バッチ分割→計算（変換/タイル化）→保存→UI で進捗/再開/失敗時再試行」ができる一連のパイプラインを `location-plugin` に組み込むこと。

## 成果物（DoD）

- バッチ実行の API 群（開始/状態/キャンセル/再開）が `location-plugin` 経由で提供される。
- ダウンロード/計算/タイル生成の各ステージが `@hierarchidb/{batch,download}` を経由して実行される（計算/タイル化は当面 plugin 側実装）。
- 途中失敗時のリトライ/再開（resume）がセッション単位で可能（タスクの冪等性を担保）。
- 生成物（ベクトルタイル等）が `LocationDB` に保存され、UI から確認できる（最低限: 可視化 or 検証 API）。
- ユニット/統合/E2E スモークが追加され、CI で `pnpm test` が通る。
- 機能フラグは既定 OFF（`LOCATION_BATCH_VTILES_V1`）。

## スコープ

- IN: ダウンロード→バッチ分割→計算（座標系/属性正規化）→ベクトルタイル生成→保存→UI 進捗表示。
- OUT: 高度なスタイリング/UI 編集機能、地図表示コンポーネントの刷新、外部サービスへの公開/配信。

## 依存関係

- `@hierarchidb/batch`: セッション/タスク/進捗/キャンセル/リトライ。
- `@hierarchidb/download`: ソース定義/HTTP ストリーミング/レート制御/再試行。
- 計算/タイル化: 座標変換/属性正規化/タイル化（当面は `location-plugin` 側実装）。
- 既存: `runtime-worker`（サービス実行）、`common-type`（ID/型）、`location-plugin` の DB/ハンドラ。

## アーキテクチャ方針（高レベル）

- Worker 側に Location 用の軽量オーケストレータ（`LocationBatchOrchestrator`）を追加。
- 3 ステージの明示:
  1) `download`（ソース分割/取得/一時保存）
  2) `compute`（ETL: 座標/属性整形、タイル化）
  3) `finalize`（成果物の格納/インデックス更新）
- すべて `BatchService` でセッション/タスク化。`mapChunks` ベースでチャンク並列、上限は `concurrency` に集約。
- 中間成果は Ephemeral DB/一時ストレージ（`locationCache`）に保存、完成後に `vectorTiles` テーブルへコミット。

## データモデル/DB 変更案（LocationDB）

- 追加テーブル（`Dexie` 定義の例）
  - `sessions`: `&id, nodeId, status, createdAt, updatedAt, stats`
  - `tasks`: `&id, sessionId, kind, status, startedAt, finishedAt, attempt, payloadHash`
  - `cache`: `&id, key, type, size, createdAt, ttl`
  - `vectorTiles`: `&id, z, x, y, bytes, createdAt, etag?`
- マイグレーションは互換オープン（旧 DB 名も開ける）で段階導入。ロールバックは新規テーブル未使用状態へ戻すだけで可。

## 処理フロー（概要）

1) `startLocationBatch` 呼び出し（UI/CLI）
   - 入力: `source`, `area`（任意: bbox/tileset）、`zRange`, `concurrency`, `retryPolicy`。
   - セッション作成 → チャンク生成 → `BatchService` へエンキュー。
2) `download` タスク
   - `DownloadService` でチャンクを取得（再試行/帯域制御）。成果を `cache` に保存。
3) `compute` タスク
   - `location-plugin` の計算サービスで正規化→タイル化。結果を `vectorTiles` または `cache` に保存。
4) `finalize` タスク
   - インデックス更新、不要キャッシュ削除。
5) 進捗・再開
   - `getBatchStatus` でセッション集計、`resumeBatch` で未完/失敗タスクのみ再投入。

## Worker API 仕様（案）

```ts
// location-plugin worker API (型は _obsolate_common-type 参照)
startLocationBatch(nodeId: NodeId, cfg: LocationBatchConfig): Promise<SessionId>;
getLocationBatchStatus(sessionId: SessionId): Promise<LocationBatchStatus>;
resumeLocationBatch(sessionId: SessionId): Promise<boolean>;
cancelLocationBatch(sessionId: SessionId): Promise<boolean>;
getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
```

- `LocationBatchConfig` には `source`, `area`, `zRange`, `concurrency`, `retryPolicy` など。
- 返却の `LocationBatchStatus` はタスク数/成功/失敗/ETA/カレントステージを含む。

## 再利用コンポーネント適用ポイント

- `@hierarchidb/batch`
  - `BatchService.createSession`, `mapChunks`, `retryWithBackoff`, `resume/cancel` をそのまま利用。
- `@hierarchidb/download`
  - `HttpDownloader`/`StreamCollector`/`RateLimiter` をラップして Location 用の `LocationDownloader` ファクトリを用意（設定値差し替えのみ）。
  - `GeometryNormalizer`, `TileBuilder` を利用。座標系/プロパティマッピングが必要なら `location` プロファイルを追加（設定駆動）。

## 実装ステップ（小粒 PR の積み上げ）

1. feat/location/batch-skeleton（基盤）
   - Orchestrator/DB スキーマのスケルトン、型のみ。フラグ `LOCATION_BATCH_VTILES_V1` 追加（既定 OFF）。
   - DoD: typecheck 通過。API 型はエクスポートされるが未実装。
2. feat/location/session-store
   - `sessions`/`tasks`/`cache`/`vectorTiles` の Dexie 定義、アダプタ実装。ユニット追加。
3. feat/location/start-download
   - `startLocationBatch` と `download` タスク実装。`DownloadService` 統合。キャッシュ保存と重複回避（`payloadHash`）対応。
4. feat/location/compute-tiles
   - `compute` タスク実装（正規化→タイル化→保存）。`getVectorTile` 最小実装。スモークテスト追加。
5. feat/location/finalize-and-resume
   - `finalize` 実装、`resume/cancel` 実装、`getLocationBatchStatus` 集計ロジック。
6. ui/location/batch-controls (任意/最小)
   - Plugin Dialog or 既存 UI に「開始/停止/再開/進捗表示」を最小限で追加（flag 連動）。
7. e2e/location/vtiles-smoke
   - 開始→進捗確認→完了→タイル取得のハッピーパス 1 本。

## フィーチャーフラグ

- `LOCATION_BATCH_VTILES_V1`（既定 OFF）
  - UI/Worker のエントリはフラグ条件で公開。
  - ロールバック: フラグ OFF で即無効化。

## ロールバック方針

- 新テーブルは旧コードから未参照のため、差分コミットをリバートすることで即時復旧可。
- 既存 API/DB に破壊的変更を加えない（追加のみ）。

## テスト戦略

- Unit: Orchestrator、Chunk 生成、再試行ポリシー、タイル鍵（z/x/y）整合、DB アダプタ。
- Integration: download→compute→finalize の最小パイプライン。失敗→リトライ/再開。
- E2E: UI 経由の開始/進捗/完了確認（フラグ ON 時のみ実行）。

## 可観測性/メトリクス

- セッション統計: `processed`, `failed`, `throughput`, `avgLatency`、ETA。
- ログ: ステージ遷移/再試行理由/キャンセル理由。

## セキュリティ/性能

- レート制御・同時接続上限を `DownloadService` に依存。トークン等は UI/Worker 経由で安全に注入。
- 並列度は `compute` と `download` で別上限を許可（設定）。

## タイムライン（目安）

- W1: スケルトン/DB/開始 API（PR 1-2）
- W2: download 実装（PR 3）
- W3: compute/tiles 実装（PR 4）
- W4: finalize/resume/UI/E2E（PR 5-7）

## リスクと軽減策

- 大規模データ/長時間処理→ チャンク化と再開設計で緩和、スロットリングとバックオフ。
- 既存 UI 差分→ フラグ既定 OFF、段階導入。

---

### 参考（主なエクスポート予定・英語名のみ記載）

- `LocationBatchOrchestrator` (worker)
- `startLocationBatch`, `getLocationBatchStatus`, `resumeLocationBatch`, `cancelLocationBatch`, `getVectorTile`
- `LocationDB` tables: `sessions`, `tasks`, `cache`, `vectorTiles`

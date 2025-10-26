# Unified Batch Control API — Runtime Worker / UI 連携仕様（2025-09 再整理）

本ドキュメントは Shape / Location / Route を中心に構築中の共通バッチ基盤について、Runtime Worker と UI の結線仕様をまとめたものです。以下の方針は旧 API からの移行前提となります。

## 1. ローディング戦略

| レイヤ | ロード方法 | 備考 |
| --- | --- | --- |
| UI (親ウィンドウ) | 静的 import (`app/src/generated/ui-loader.ts`) | 起動時にすべての UI プラグインを読み込む。旧 `autoLoadPlugins()` は開発補助用途のみ。 |
| Runtime Worker | 動的 import (`app/src/worker.ts`) | `@hierarchidb/runtime-worker` の Inversify コンテナ経由で `pluginWorkerModuleMap` を解決し、nodeType ごとの遅延ロード（deny-list 対応）。 |
| Stage Worker (孫 Worker) | プラグイン実装依存 | Runtime Worker 内で必要に応じて生成。 |

## 2. Runtime Worker 公開 API（予定）

```ts
export type BatchSessionId = string;
export type StageKey = string;              // download / simplify1 / vectortile などに正規化
export type ProgressPhase = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'warning' | 'cancelled';

interface BatchProgressEvent<P = BatchProgressPayload> {
  sessionId: BatchSessionId;
  nodeId: NodeId;
  stage: StageKey;
  phase: ProgressPhase;
  timestamp: number;
  payload?: P;              // プラグイン固有の進捗データ
  message?: string;
  error?: { code?: string; detail?: unknown };
}

interface BatchProgressPayload {
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  currentTask?: string;
  estimatedTimeRemaining?: number;
  meta?: Record<string, unknown>;
}

// WorkerBridge -> WorkerService で公開する API
startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
subscribeBatchProgress(
  nodeType: NodeType,
  sessionId: BatchSessionId,
  cb: (event: BatchProgressEvent) => void,
): Promise<() => void>;
```

- `startBatchSession` は UI から nodeType / nodeId だけを受け取り、Runtime Worker が PeerEntity / WorkingCopy から設定値を読み出す。
- `getBatchSessionStatus` はタブ再オープン時のリカバリ用途。存在しない場合はエラーを返す。
- `subscribeBatchProgress` は解除ハンドラを返す。UI ではダイアログ終了時に明示的に解除。

## 3. 旧イベントとの関係

- 旧来の UI イベント（Shape などで利用していた `BatchProgressEvent`）は **`LegacyBatchProgressEvent`** として残し、Runtime Worker から受けた `BatchProgressEvent` を変換する互換レイヤで対応する。
- UI 側では `payload` から進捗バーに必要な値（件数・割合など）を再計算する。冗長な `percentage` などを通知側に持たせない方針。

## 4. TODO（2025-09-29 着手）

- [ ] WorkerBridge / WorkerService に上記 API を実装する。
  - [ ] runtime-shared に `BatchSessionId` / `BatchProgressEvent` / `BatchProgressPayload` を導入し、`IBatchSessionManager` と `AbstractBatchSession` を更新。
  - [ ] `subscribeBatchProgress` で Comlink 解除ハンドラを返却する実装を追加。
- [ ] Shape / Location / Route の Runtime Worker アダプタを新 API へ対応させる。
  - [ ] `startBatchSession(nodeId)` へ統一し、PeerEntity / WorkingCopy から設定値を解決する。
  - [ ] 各プラグインで `payload` 生成ロジックと `StageKey` / `ProgressPhase` のマッピングを用意する。
  - [ ] 旧 `LegacyBatchProgressEvent` へ変換する互換レイヤ（必要なら一時的）を整備する。
- [ ] UI フック / ダイアログを `BatchProgressEvent` ベースへ差し替える。
  - [ ] `useBatchProgress` アダプタを WorkerBridge 購読へ接続。
  - [ ] Shape / Location / Route ダイアログを新アダプタ出力で更新し、Legacy イベント依存を解消する。
- [ ] 変更後に `pnpm -w typecheck` / `pnpm -C app build` 等で検証し、必要なテストを追加する。

以上の TODO を小さな差分で進め、最終的には各プラグインのバッチ UI が同一のイベント仕様で動作することをゴールとします。

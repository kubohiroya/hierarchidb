# Web Locks API ベースの Build Session 監視設計（Heartbeat 置換案）

## 目的
BroadcastChannel による heartbeat を Web Locks API と共有ストレージ（Dexie/IndexedDB）で置換し、
Build セッションの **実行タブ判定** と **停止/サスペンド判定** の誤検知を減らす。

## 現状の役割整理（BroadcastChannel）
- `broadcast`: owner tab が status/progress を送る（他タブ UI 更新）
- `ack`: 他タブの生存応答（停止検知の補助）
- `poll`: スナップショット更新のトリガ
- `tab-state`: hidden/frozen を共有し、crash/suspend 判定の誤検知を減らす
- `isRunnerTab`: 直近 broadcast 時刻で「今走ってるタブ」を推定

## 置換後の基本方針
- **排他制御** は Web Locks API（`navigator.locks`）で実施
- **Heartbeat** は IndexedDB に記録し、**他タブは pull で参照**
- **unexpected（停止）判定**は「processing なのに lock が free」を基準にする
- **suspend 判定**は「lock は held だが heartbeat が stale or tab が hidden/frozen」

## データスキーマ（Dexie）
DB は既存 `hdb-session-semaphore` に統合（version bump）想定。

```ts
// Dexie schema
db.version(2).stores({
  semaphores: '&key, ownerId, expiresAt',
  heartbeats: '&sessionId, updatedAt, expiresAt, tabId',
});

// Record
type HeartbeatRecord<TStatus = unknown, TProgress = unknown> = {
  sessionId: string;
  tabId: string;
  updatedAt: number;
  expiresAt: number;
  status?: TStatus | null;
  progress?: TProgress | null;
  tabState?: 'active' | 'hidden' | 'frozen';
  lockOwner?: boolean;
};
```

## SessionCoordinator API 変更（設計）

### 既存維持
- `getTabId()`
- `readActiveSessionId() / writeActiveSessionId() / clearActiveSessionId()`
- `tryAcquireSessionLock(key)`（Web Locks）
- `tryAcquireSemaphore(key, ownerId, ttlMs?)`（Dexie）

### BroadcastChannel API は廃止
- `openChannel()`
- `sendPoll()`
- `sendBroadcast()`
- `sendAck()`
- `sendTabState()`

### 追加 API（Heartbeat）
```ts
type HeartbeatPayload<TStatus = unknown, TProgress = unknown> = {
  sessionId: string;
  status?: TStatus | null;
  progress?: TProgress | null;
  tabState?: SessionTabState;
  lockOwner?: boolean;
  timestamp?: number; // default now
};

writeHeartbeat(payload: HeartbeatPayload): Promise<void>;
readHeartbeats(sessionId?: string): Promise<HeartbeatRecord[]>;
readHeartbeat(sessionId: string): Promise<HeartbeatRecord | null>;
pruneHeartbeats(referenceTime?: number): Promise<void>;
```

### 追加 API（Lock probe）
```ts
probeSessionLock(key: string): Promise<'held' | 'free' | 'unsupported'>;
// navigator.locks.request(key, { ifAvailable: true, mode: 'exclusive' })
// lock が取れたら即 release して "free"
```

## Heartbeat 更新ルール
- owner tab が `pollIntervalTimeout` ごとに `writeHeartbeat` する
- `expiresAt = updatedAt + quietThresholdTimeout + pollIntervalTimeout * 2`
- `status/progress/tabState` は UI が必要とする最小限に限定

## isRunnerTab 判定
- **lock owner** なら true
- もしくは自タブ heartbeat が latest かつ stale でないなら true

## useBuildSessionSnapshots の再設計（概要）
- worker から “running session” を購読（現行維持）
- heartbeat を `pollIntervalTimeout` ごとに pull
- `updatedAt = max(worker.updatedAt, heartbeat.updatedAt)`
- `lastSeenAt = heartbeat.updatedAt`
- stale 判定は `expiresAt` を参照

## Build ステップの時間計測仕様（Step5 など）
ビルド UI の「総経過時間」「ステージ経過時間」「残り時間（概算）」は
`@hierarchidb/batch` の `useBuildSessionTiming` を基準に算出する。

### データ源（BuildSessionTimingRecord）
Build session record に以下のフィールドを保持する（shape/route 共通方針）。

```ts
type BuildSessionTimingRecord = {
  startedAt?: number;
  lastHeartbeatAt?: number;
  inactiveMs?: number;
  stageId?: string | null;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageInactiveMs?: number;
};
```

### 更新ルール（owner tab のみ）
- **lock owner** のみが `updateSession()` で timing を更新する
- `buildStatus=running` で `heartbeatIntervalMs` ごとに以下を更新:
  - `lastHeartbeatAt`（心拍）
  - `stageId` が変化したら `stageStartedAt` を更新
  - 非アクティブな間隔が `inactiveGraceMs` を超えた分を `inactiveMs` / `stageInactiveMs` に加算
- `buildStatus` が `running` から離脱したタイミングで `lastHeartbeatAt` を更新

### 表示ルール（全タブ共通）
- **総経過時間**: `totalMs = now - startedAt - inactiveMs`
- **ステージ経過時間**: `stageMs = now - stageStartedAt - stageInactiveMs`  
  - `stageId === resolvedTaskType` のときのみ有効
- `buildStatus !== 'running'` の場合は `lastHeartbeatAt` / `stageHeartbeatAt` を基準に固定値として表示

### 残り時間（概算）
- **ステージ残り時間**は「完了済みタスクの平均処理時間 × 未完了タスク数」で算出する
  - `avgPerTaskMs = stageElapsedMs / done`
  - `remainingMs = avgPerTaskMs * remaining`
- 算出条件:
  - `done > 0` かつ `remaining > 0`
  - `avgPerTaskMs` が有限かつ正の値
- 条件を満たさない場合は `-` を表示

### 期待する UI 更新間隔
- owner tab は `heartbeatIntervalMs` 単位で更新
- 非 owner tab はセッション record の最新値を読んで表示のみ更新（書き込み禁止）

## crash/suspend 判定（設計案）

### unexpected（停止）
- `processingStatus=processing` かつ `buildFinishedAt` 未設定
- **lock が free** になった
- かつ短い猶予（`quietThresholdTimeout`）を超過

### suspend
- lock は held
- heartbeat が stale / `tabState` が `hidden|frozen`

## 挙動差分
- 即時通知（BroadcastChannel）が無くなるため最大 `pollIntervalTimeout` 遅延
- lock free を基準に停止判定できるため誤検知が減る

## リスク・注意点
- Web Locks 非対応環境は **フォールバック禁止**のため機能停止が必要
- lock が保持されたまま frozen する場合は suspend 表示に寄せる

## 追加仕様（運用で詰まらないために明文化すべき項目）

### 1. Lock 競合とリカバリ規約
- **ロック取得失敗時の UI**: Start/Resume を無効化し、「別タブでビルド実行中」メッセージを表示。
- **ロック free + heartbeat stale**: unexpected の判定候補。`quietThresholdTimeout` を過ぎても lock free なら unexpected を表示。
- **ロック free + heartbeat fresh（ghost session）**: unexpected を出さず、表示は「再同期中」扱いにして短時間保持（`ghostGraceMs = quietThresholdTimeout`）。
- **ロック解放の責務**: owner は `completed/failed/paused` のタイミングで release。タブクラッシュは自然解放に依存。
- **復旧猶予**: unexpected 表示前に `quietThresholdTimeout` の猶予を置く。

### 2. Web Locks 非対応環境の扱い（フォールバック禁止）
- **動作禁止**: Web Locks がない場合、Start/Resume を disabled。
- **通知**: 「このブラウザは Build を実行できません（Web Locks API 未対応）」を表示。
- **記録**: 失敗理由をログに残す（console.warn）。

### 3. Heartbeat 書き込み対象と粒度
- **更新頻度**: `heartbeatIntervalMs` ごとに必ず `updatedAt/expiresAt` を更新。
- **status/progress**: 変更時のみ更新（値が同一なら write を省略）。
- **payload サイズ**: `status/progress` はプリミティブ or 小さな JSON を想定。大きな配列や詳細ログは含めない。

### 4. Stage 切り替え時の時刻更新ルール
- **検知ソース**: `resolvedTaskType`（taskType の実効値）を使用。
- **更新タイミング**:
  - `stageId` が変わったら `stageStartedAt` を **必ず上書き**。
  - 同一 stage の再開は `stageStartedAt` を維持し、`stageInactiveMs` で補正。

### 5. Pause/Resume 時の時間計測の扱い
- **paused 中の扱い**: paused 中の経過は `inactiveMs` に積算する。
- **resume 時**: `lastHeartbeatAt` を更新し、`inactiveMs` の加算を止める。
- **UI 表示**: paused 中は固定値で表示（増えない）。

### 6. Session record の寿命（Retention）
- **completed/failed**: `completedAt` 後に `retentionMs = 10 * quietThresholdTimeout` で削除対象。
- **stale cleanup**: 1秒～5秒周期で `expiresAt` を過ぎた heartbeat を削除。
- **ghost session**: `ghostGraceMs` を超えたら削除。

### 7. セキュリティ/整合性（名前空間）
- **lock key**: `hdb:build:<nodeType>:<nodeId>` を必須とし、nodeType を含めて衝突回避。
- **heartbeat sessionId**: `nodeType:nodeId` の文字列に正規化（DB キー衝突防止）。
- **tabId**: `sessionStorage` の tabId を流用し、タブ単位の識別を保証する。

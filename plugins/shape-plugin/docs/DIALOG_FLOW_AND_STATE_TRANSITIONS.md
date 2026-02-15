# Shape Plugin ダイアログフローと状態遷移仕様

## 概要

Shape Pluginでは、バッチ処理の開始、進捗監視、完了/中断処理を通じて、複数のダイアログとUIコンポーネントが連携して動作します。本文書では、これらの画面遷移とダイアログの開閉制御について仕様を定義します。

## ダイアログの種類と役割

### 1. ShapeEditDialog（メインダイアログ）
- **役割**: Shape entityの作成・編集、バッチ処理の設定
- **開く条件**: 
  - 新規作成: TreeConsoleから「Add Shape」アクション
  - 編集: ShapePanelから「Edit」ボタン
- **閉じる条件**:
  - Cancelボタン押下
  - Saveボタン押下後、保存成功時

### 2. Build Progress（進捗ビュー）
- **役割**: バッチ処理の進捗表示と制御
- **表示条件**:
  - ShapeEditDialog の Build Progress に到達
  - ShapePanel からの再開導線で Build Progress を開く
- **終了条件**:
  - 処理完了後にユーザーがダイアログを閉じる
  - エラー発生時にユーザーが確認/再試行する
  - ユーザーによるキャンセル操作

### 3. ConfirmationDialog（確認ダイアログ）
- **役割**: 処理の中断・キャンセルの確認
- **開く条件**:
  - Build Progress で Cancel 操作を実行した時
  - エラー発生時の再試行確認
- **閉じる条件**:
  - Yes/Noボタン押下

## 状態遷移フロー（現行実装準拠）

凡例:
- `✅`: 自動テストで遷移を検証済み
- `❌`: 自動テストが存在し、現在失敗
- `❓`: まだ自動テスト未整備

```mermaid
stateDiagram-v2
    [*] --> Idle: 初期状態
    Idle --> Starting: Start / Resume ✅

    state Starting {
        [*] --> AcquiringLock
        AcquiringLock --> WaitingLock: lock unavailable ❓
        AcquiringLock --> SavingDraft: lock acquired ❓
        WaitingLock --> SavingDraft: lock acquired ❓
        SavingDraft --> InitializingWorker: draft saved ❓
        InitializingWorker --> BuildingPayloads: new start ❓
        InitializingWorker --> StartingSession: resume ❓
        BuildingPayloads --> StartingSession: payload ready ❓
        StartingSession --> AwaitingFirstTask: request accepted ✅
    }

    Starting --> Processing: startup success ✅
    Starting --> Failed: startup error / timeout ❌
    Processing --> Paused: Pause ❓
    Paused --> Starting: Resume ❓
    Processing --> Completed: Success ❓
    Processing --> Failed: Error ❓
    Completed --> Idle: Close Dialog ❓
    Failed --> Idle: Abort / Close ❓
```

### AwaitingFirstTask 以降の詳細分岐（実装準拠）

```mermaid
flowchart TD
    A["AwaitingFirstTask"] --> B{"hasFirstTaskSignal?"}
    A --> T["timeout (45s)"]:::ng

    B -->|"yes + started task"| S1["startup success: task-execution-started"]:::ok
    B -->|"yes + queued/progress only"| S2["startup success: task-queue-observed"]:::ok
    B -->|"no"| C{"buildStatus"}

    C -->|"running"| W1["continue waiting"]:::ok
    C -->|"failed"| E1["startup error: failed-before-task-start"]:::ok
    C -->|"paused"| P{"isPausePending?"}
    C -->|"completed"| D{"isTaskStreamReady?"}

    P -->|"true"| W2["continue waiting"]:::ok
    P -->|"false"| X1["startup cancelled: paused-before-task-start"]:::ok

    D -->|"false"| W3["continue waiting"]:::ok
    D -->|"true"| E{"taskCount is number?"}
    E -->|"no (undefined)"| W4["continue waiting"]:::ok
    E -->|"yes"| F{"taskCount === 0?"}

    F -->|"no"| S3["startup success: completed-before-first-task-update"]:::ok
    F -->|"yes"| G{"expectTaskGeneration?"}
    G -->|"true"| W5["continue waiting"]:::ok
    G -->|"false"| S4["startup success: completed-without-generating-tasks"]:::ok

    classDef ok fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef ng fill:#ffebee,stroke:#c62828,color:#b71c1c
```

```mermaid
stateDiagram-v2
    [*] --> fetch
    fetch --> transform
    transform --> vt
    vt --> [*]
```

- 実行ステージは `fetch -> transform -> vt`。
- 起動フェーズ `awaiting-first-task` は待機監視対象で、10s で wait 通知、20s で long-wait 警告、45s で timeout エラー終了。
- `awaiting-first-task` の task-signal 判定:
  - `running/completed/failed/...` タスク受信
  - `queued` タスク受信
  - progress メタデータ（`progressTaskId` または `total > 0`）受信
- task stream の初回同期完了前は `taskCount` を `undefined` として扱う。
- ただし Worker session の `progress.total > 0` が確認できた場合は、task stream 未同期でも `completed-with-session-progress-evidence` で成功遷移する。
- `buildStatus=failed` で失敗遷移する場合は Worker `stageId` をエラーメッセージへ埋め込み、失敗位置を UI ログから直接追跡できるようにする。

### AwaitingFirstTask 遷移マトリクス（矢印とテスト証跡）

| ID | 遷移 | 条件（要約） | 状態 | 主な証跡 |
| --- | --- | --- | --- | --- |
| AFT-01 | `AwaitingFirstTask -> success(task-execution-started)` | `hasFirstTaskSignal && hasStartedTasks` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-02 | `AwaitingFirstTask -> success(task-queue-observed)` | `hasFirstTaskSignal && !hasStartedTasks` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` / integration: `buildSessionStartup.integration.test.tsx` |
| AFT-03 | `AwaitingFirstTask -> continue(wait)` | `buildStatus=running && no signal` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-04 | `AwaitingFirstTask -> continue(wait)` | `buildStatus=completed && !isTaskStreamReady && sessionProgressTotal<=0` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-05 | `AwaitingFirstTask -> continue(wait)` | `buildStatus=completed && taskCount=undefined && sessionProgressTotal<=0` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-06 | `AwaitingFirstTask -> success(completed-before-first-task-update)` | `buildStatus=completed && taskCount>0` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-07 | `AwaitingFirstTask -> continue(wait)` | `buildStatus=completed && taskCount=0 && expectTaskGeneration=true` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-08 | `AwaitingFirstTask -> success(completed-without-generating-tasks)` | `buildStatus=completed && taskCount=0 && expectTaskGeneration=false` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` / e2e: `shape-build-startup-first-task.spec.ts` |
| AFT-09 | `AwaitingFirstTask -> success(completed-with-session-progress-evidence)` | `buildStatus=completed && sessionProgressTotal>0 && (task stream未同期 or taskCount未確定 or taskCount=0)` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` / e2e: `shape-build-startup-first-task.spec.ts` |
| AFT-10 | `AwaitingFirstTask -> error(failed-before-task-start)` | `buildStatus=failed`（`sessionStageId` があればメッセージへ付与） | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-11 | `AwaitingFirstTask -> cancelled(paused-before-task-start)` | `buildStatus=paused && !isPausePending` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-12 | `AwaitingFirstTask -> continue(wait)` | `buildStatus=paused && isPausePending` | ✅ | unit: `resolveAwaitingFirstTaskDecision.unit.test.ts` |
| AFT-13 | `AwaitingFirstTask -> error(timeout)` | `awaiting-first-task elapsed >= 45s` | ✅ | unit: `resolveStartupTransitionWatchdogEvent.unit.test.ts` |

### 検証ソース一覧

- Unit:
  - `plugins/shape-plugin/src/ui/__tests__/hooks/unit/awaitingFirstTaskSignal.unit.test.ts`
  - `plugins/shape-plugin/src/ui/__tests__/hooks/unit/resolveAwaitingFirstTaskDecision.unit.test.ts`
  - `plugins/shape-plugin/src/ui/__tests__/hooks/unit/resolveStartupTransitionWatchdogEvent.unit.test.ts`
- Integration:
  - `plugins/shape-plugin/src/ui/__tests__/hooks/integration/buildSessionStartup.integration.test.tsx`
- E2E:
  - `e2e/shape/shape-build-startup-first-task.spec.ts`

## 2026-02-15 検証結果（Worker実装/テスト照合）

### 最新性の判定
結論: 本文書は一部 outdated。

### 不一致点（要点）
- 「リアルタイム進捗購読（ポーリングのみ）」は不正確。実装は `subscribeBatchProgress` / `subscribeBatchTasks` の購読に加え、UI 側で 1s 間隔のリコンシル (`getBuildTasks`) を併用している。
  - 参照: `packages/ui/batch/src/hooks/useBatchProgressState.ts`, `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTasks.ts`, `plugins/shape-plugin/src/worker/api.ts`
- 実行ステージは `fetch -> transform -> vt` だけではなく、`metadata-stage` と `cleanup-stage` を含む。
  - 参照: `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- Worker 側は購読者がいない場合に `emitProgressSnapshot` をスキップする。ログ上 `progress snapshot skipped (no subscriber)` が出力されるため、UI 購読が遅れると初期 progress が欠落し得る。
  - 参照: `plugins/shape-plugin/src/worker/api.ts`
- ダイアログ間状態共有は `DialogContextProvider` ではなく、Jotai atoms + `useShapeBuildStep` が中心。
  - 参照: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- 自動クローズ/エラーリカバリー/セッション復旧の仕様は本文書にのみ存在し、実装側の呼び出し箇所が確認できない。
  - 参照: `plugins/shape-plugin/docs/DIALOG_FLOW_AND_STATE_TRANSITIONS.md` 以外に該当コードなし

### Worker 内部状態遷移（詳細・実装準拠）

```mermaid
flowchart TD
  A["Start / Resume"] --> B["lock-acquire"]
  B -->|lock acquired| C["draft-save"]
  B -->|lock unavailable| B1["waiting-lock"]
  B1 --> C
  C --> D["worker-initialize"]
  D --> E["payload-build"]
  E --> F["session-start-request"]
  F --> G["awaiting-first-task"]
  G -->|task signal| P["pipeline-dispatch"]
  G -->|timeout / failed / cancelled| X["startup error/cancel"]
  P --> S1["prepare-pipeline-run"]
  S1 --> S2["fetch-stage"]
  S2 --> S3["transform-stage"]
  S3 --> S4["vt-stage"]
  S4 --> S5["metadata-stage"]
  S5 --> S6["cleanup-stage"]
  S6 --> Z["completed"]
```

### AwaitingFirstTask のガード条件（補足）
- `hasFirstTaskSignal` は `queued` / `running` / `completed` / `progressTaskId` / `progress.total` のいずれかで成立。
- `buildStatus=completed` かつ `sessionProgressTotal>0` の場合は、task stream 未同期でも成功遷移となる。
- 45s 超過で `timeout` エラー遷移となる。
  - 参照: `plugins/shape-plugin/src/ui/__tests__/hooks/unit/resolveAwaitingFirstTaskDecision.unit.test.ts`, `resolveStartupTransitionWatchdogEvent.unit.test.ts`

### Worker↔UI シーケンス（通知の欠落候補）

```mermaid
sequenceDiagram
  participant User
  participant UI as ShapeBuildStep(UI)
  participant Bridge as WorkerBridge
  participant Worker as shapeBatchAPI/ShapePipeline
  participant Queue as VtTaskQueueDb

  UI->>Bridge: subscribeBatchProgress/subscribeBuildTasks (auto on mount)
  User->>UI: Start
  UI->>Bridge: startOrResumeBuildSession(nodeId)
  Bridge->>Worker: startOrResumeBuildSession
  Worker->>Worker: startBatchProcess (load-draft...emit-planned-progress)
  Worker-->>UI: progress snapshot (if subscribed)
  Note over Worker,UI: 購読が遅い場合は<br/>`progress snapshot skipped (no subscriber)`
  Worker->>Queue: enqueue tasks
  Worker-->>UI: task snapshot / updates (if subscribed)
  UI->>Bridge: getBuildTasks (reconcile when empty/in-flight)
  UI->>UI: タスク一覧・サマリー更新
```

### 通知/呼び出しの欠落ポイント（現状の候補）
- `emit-planned-progress` 時点で UI 側購読が未接続だと progress 初期通知が欠落する。
- `subscribeBuildTasks` が `nodeId` 不一致でフィルタされると、タスク更新が UI に届かない。
  - 参照: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTasks.ts`（`node_id_mismatch` で drop）

## ダイアログ制御の詳細仕様

### 1. ShapeEditDialog 内の Build Progress への遷移

```typescript
interface DialogTransition {
  trigger: 'START_PROCESSING';
  source: 'ShapeEditDialog';
  target: 'ShapeBuildStep';
  conditions: {
    validationPassed: boolean;
    draftSaved: boolean;
    batchConfigReady: boolean;
  };
  actions: {
    beforeTransition: [
      'saveDraft',
      'createBatchSession',
      'registerProgressCallback'
    ];
    onTransition: [
      'advanceToBuildProgress',
      'startProgressMonitoring'
    ];
  };
}
```

### 2. バッチ処理完了時の自動クローズ

```typescript
interface CompletionBehavior {
  onSuccess: {
    autoClose: true;
    delay: 2000; // 2秒後に自動クローズ
    showNotification: true;
    notificationDuration: 5000;
    actions: [
      'commitDraft',
      'cleanupBatchSession',
      'refreshParentView'
    ];
  };
  onError: {
    autoClose: false; // エラー時は自動クローズしない
    showErrorDetails: true;
    allowRetry: true;
    actions: [
      'logError',
      'preserveDraft',
      'showRetryOption'
    ];
  };
  onCancel: {
    autoClose: true;
    delay: 0; // 即座にクローズ
    confirmBeforeClose: true;
    actions: [
      'pauseBatchSession',
      'preserveDraft',
      'cleanupPartialData'
    ];
  };
}
```

### 3. 進捗イベントによる画面更新

```typescript
interface ProgressEventHandler {
  eventType: 'PROGRESS_UPDATE' | 'STAGE_CHANGE' | 'TASK_COMPLETE' | 'ERROR';
  
  handlers: {
    PROGRESS_UPDATE: (event: ProgressEvent) => {
      // プログレスバーの更新
      updateProgressBar(event.percentage);
      updateTaskCount(event.completed, event.total);
    };
    
    STAGE_CHANGE: (event: StageChangeEvent) => {
      // ステージインジケーターの更新
      highlightCurrentStage(event.newStage);
      updateStageDescription(event.stageInfo);
    };
    
    TASK_COMPLETE: (event: TaskCompleteEvent) => {
      // タスクリストの更新
      markTaskComplete(event.taskId);
      if (event.isLastTask) {
        triggerCompletionSequence();
      }
    };
    
    ERROR: (event: ErrorEvent) => {
      // エラー表示とリトライオプション
      showErrorDialog(event.error);
      enableRetryButton();
      pauseProcessing();
    };
  };
}
```

## 実装要件

### 1. ダイアログ間の状態共有

```typescript
// DialogContextProvider で状態を管理
interface DialogState {
  shapeEditDialog: {
    isOpen: boolean;
    mode: 'create' | 'edit';
    draftId?: EntityId;
  };
  
  batchProcessingDialog: {
    isOpen: boolean;
    sessionId?: string;
    currentStage?: BatchStage;
    progress?: ProgressInfo;
  };
  
  confirmationDialog: {
    isOpen: boolean;
    type?: 'cancel' | 'retry' | 'delete';
    onConfirm?: () => void;
  };
}
```

### 2. リアルタイム通知の購読管理

```typescript
interface ProgressSubscription {
  // 購読開始
  subscribe(sessionId: string): () => void;
  
  // イベントハンドラー登録
  on(event: 'progress', handler: (data: ProgressInfo) => void): void;
  on(event: 'complete', handler: (data: CompletionInfo) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  
  // クリーンアップ
  unsubscribe(): void;
}
```

### 3. エラーリカバリー

```typescript
interface ErrorRecovery {
  strategies: {
    NETWORK_ERROR: {
      maxRetries: 3;
      retryDelay: [1000, 2000, 5000]; // Exponential backoff
      fallback: 'PAUSE_AND_NOTIFY';
    };
    
    VALIDATION_ERROR: {
      maxRetries: 0; // 検証エラーはリトライしない
      userAction: 'FIX_AND_RESTART';
    };
    
    QUOTA_EXCEEDED: {
      maxRetries: 1;
      cleanupBeforeRetry: true;
      userAction: 'CONFIRM_CLEANUP';
    };
  };
}
```

## UI/UX ガイドライン

### 1. プログレス表示
- 全体進捗: メインプログレスバー（0-100%）
- ステージ進捗: セカンダリプログレスバー
- タスクカウンター: "120/500 completed (24%)"
- 推定残り時間: "約15分" （過去の処理速度から計算）

### 2. 中断と再開
- 中断時: 現在の状態を保存し、いつでも再開可能
- 再開時: 前回の続きから処理を継続
- タイムアウト: 24時間経過したセッションは自動削除

### 3. 通知
- 成功時: トースト通知（緑色、5秒表示）
- エラー時: モーダルダイアログ（詳細表示付き）
- 警告時: インラインアラート（黄色、dismissable）

## テスト要件

### 1. ダイアログ遷移テスト
- [ ] ShapeEditDialog 内で Build Progress を開く導線
- [ ] 処理完了時の自動クローズ
- [ ] エラー時のダイアログ残留
- [ ] キャンセル確認ダイアログの表示

### 2. 進捗更新テスト
- [ ] リアルタイム進捗更新の反映
- [ ] ステージ切り替えの表示
- [ ] エラー発生時の状態保持

### 3. エッジケース
- [ ] ネットワーク切断時の挙動
- [ ] ブラウザリロード時の復旧
- [ ] 複数ダイアログ同時表示の防止

## 現在の実装状況と改善点

### 実装済み ✅
- ShapeEditDialogの基本機能
- Build Progress 進捗ビューの骨組み
- 進捗情報の表示コンポーネント

### 未実装 ❌
- リアルタイム進捗購読（ポーリングのみ）
- 自動クローズ機能
- エラーリカバリー機能
- セッション復旧機能

### 要改善 ⚠️
- ダイアログ間の状態管理が分散している
- Worker APIとの接続が不完全
- 進捗コールバックが機能していない

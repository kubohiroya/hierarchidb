# バッチ処理通知システム

## 概要

Shape Pluginのバッチ処理システムは、Worker層からUI層へリアルタイムで進捗状況、エラー、完了通知を送信する仕組みを提供します。このドキュメントでは、通知システムの詳細な動作を説明します。

## アーキテクチャ

```
┌─────────────┐     Comlink RPC      ┌──────────────┐      Events      ┌──────────────┐
│   UI Layer  │ ◄──────────────────► │ Worker Layer │ ◄──────────────► │ EphemeralDB  │
│   (React)   │                       │   (Service)  │                  │   (Dexie)    │
└─────────────┘                       └──────────────┘                  └──────────────┘
      ▲                                      │
      │                                      │
      └──────── Progress Events ─────────────┘
```

## 通知フロー

### 1. セッション開始時の通知登録

```typescript
// UI層でのコールバック登録
const sessionId = await manager.startBatchSession(
  nodeId,
  config,
  countries,
  adminLevels,
  (event: BatchProgressEvent) => {
    // 進捗イベントを受信
    console.log(`Progress: ${event.stage} - ${event.progress}%`);
    updateUIProgress(event);
  }
);
```

### 2. 進捗イベントの構造

```typescript
interface BatchProgressEvent {
  sessionId: string;
  treeNodeId: NodeId;
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';
  progress: number;        // 0-100のパーセンテージ
  completedTasks: number;  // 完了したタスク数
  totalTasks: number;      // 全タスク数
  currentTask: string;     // 現在処理中のタスクの説明
  timestamp: number;       // イベント発生時刻
  error?: {               // エラー情報（オプション）
    message: string;
    code: string;
    details?: any;
  };
}
```

## 実装詳細

### Worker層（BatchSessionManager）

#### 1. コールバック管理

```typescript
export class BatchSessionManager {
  private progressCallbacks: Map<string, (event: BatchProgressEvent) => void> = new Map();

  async startBatchSession(
    treeNodeId: NodeId,
    config: BatchConfig,
    countries: string[],
    adminLevels: number[],
    progressCallback?: (event: BatchProgressEvent) => void
  ): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // コールバックを登録
    if (progressCallback) {
      this.progressCallbacks.set(sessionId, progressCallback);
    }
    
    return sessionId;
  }
}
```

#### 2. 進捗イベントの発行

```typescript
private emitProgressEvent(sessionId: string, event: BatchProgressEvent): void {
  const callback = this.progressCallbacks.get(sessionId);
  if (callback) {
    callback(event);
  }
}
```

#### 3. 各ステージでの通知

**Download Stage (0-25%)**
```typescript
async executeDownloadStage(sessionId: string): Promise<BatchStageResult> {
  // 各タスク完了時
  for (const task of downloadTasks) {
    // ... ダウンロード処理 ...
    
    const currentProgress = Math.round((processedTasks / downloadTasks.length) * 25);
    
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'download',
      progress: currentProgress,
      completedTasks: processedTasks,
      totalTasks: downloadTasks.length,
      currentTask: `Downloaded ${task.country}_L${task.adminLevel}`,
      timestamp: Date.now(),
    });
  }
  
  // ステージ完了時
  this.emitProgressEvent(sessionId, {
    sessionId,
    treeNodeId: status.nodeId,
    stage: 'download',
    progress: 25,
    completedTasks: processedTasks,
    totalTasks: downloadTasks.length,
    currentTask: `Download completed: ${totalFeatures} features`,
    timestamp: Date.now(),
  });
}
```

**Simplify1 Stage (25-50%)**
```typescript
async executeSimplify1Stage(sessionId: string): Promise<BatchStageResult> {
  const progressOffset = 25;
  const progressRange = 25;
  
  for (const task of simplifyTasks) {
    // ... 簡略化処理 ...
    
    const currentProgress = progressOffset + 
      Math.round((processedTasks / simplifyTasks.length) * progressRange);
    
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: status.nodeId,
      stage: 'simplify1',
      progress: currentProgress,
      completedTasks: processedTasks,
      totalTasks: simplifyTasks.length,
      currentTask: `Simplified features for ${task.country}_L${task.adminLevel}`,
      timestamp: Date.now(),
    });
  }
}
```

**Simplify2 Stage (50-75%)**
```typescript
async executeSimplify2Stage(sessionId: string): Promise<BatchStageResult> {
  const progressOffset = 50;
  const progressRange = 25;
  
  // タイル準備処理と通知...
}
```

**VectorTiles Stage (75-100%)**
```typescript
async executeVectorTilesStage(sessionId: string): Promise<BatchStageResult> {
  const progressOffset = 75;
  const progressRange = 25;
  
  // タイル生成処理...
  
  // 完了通知
  this.emitProgressEvent(sessionId, {
    sessionId,
    treeNodeId: status.nodeId,
    stage: 'vectorTiles',
    progress: 100,
    completedTasks: processedTasks,
    totalTasks: vectorTileTasks.length,
    currentTask: `Vector tile generation completed: ${generatedTiles} tiles`,
    timestamp: Date.now(),
  });
}
```

## エラーハンドリング

### エラー発生時の通知

```typescript
catch (error) {
  console.error(`Download task failed:`, error);
  failedTasks++;
  
  // エラーイベントを発行
  this.emitProgressEvent(sessionId, {
    sessionId,
    treeNodeId: status.nodeId,
    stage: 'download',
    progress: status.progress,
    completedTasks: processedTasks,
    totalTasks: downloadTasks.length,
    currentTask: `Error: ${error.message}`,
    timestamp: Date.now(),
    error: {
      message: error.message,
      code: 'DOWNLOAD_FAILED',
      details: {
        country: task.country,
        adminLevel: task.adminLevel,
        url: downloadConfig.url
      }
    }
  });
}
```

## UI層での実装例

### React Componentでの使用

```typescript
import { useState, useEffect } from 'react';
import { BatchSessionManager } from '@hierarchidb/plugin-loader-shape-plugin';

export function BatchProcessingPanel({ nodeId }: { nodeId: NodeId }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [currentTask, setCurrentTask] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  
  const startBatchProcess = async () => {
    const manager = new BatchSessionManager();
    
    const sessionId = await manager.startBatchProcess(
      nodeId,
      config,
      downloadTaskPayloads,
      (event) => {
        // 進捗状態を更新
        setProgress(event.progress);
        setStage(event.stage);
        setCurrentTask(event.currentTask);
        
        // エラーを記録
        if (event.error) {
          setErrors(prev => [...prev, event.error.message]);
        }
        
        // 完了時の処理
        if (event.progress === 100) {
          handleCompletion();
        }
      }
    );
    
    // バッチ処理を実行
    await manager.executeFullPipeline(sessionId);
  };
  
  return (
    <div>
      <h3>バッチ処理進捗</h3>
      <div>ステージ: {stage}</div>
      <div>進捗: {progress}%</div>
      <ProgressBar value={progress} max={100} />
      <div>現在のタスク: {currentTask}</div>
      {errors.length > 0 && (
        <div className="errors">
          <h4>エラー:</h4>
          {errors.map((error, i) => (
            <div key={i} className="error">{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Material-UIを使用した進捗表示

Note: `useShapeAPI` has been removed. Use `getWorkerBridge()` with `getShapeQueryAPI` / `getShapeMutationAPI` and batch-control APIs instead. The snippet below reflects legacy usage.

```typescript
import { Box, LinearProgress, Typography, Alert } from '@mui/material';
import { useShapeAPI } from '../hooks/useShapeAPI';

export function ShapeProcessingStatus({ nodeId }: { nodeId: NodeId }) {
  const { startBatchProcess, progress, stage, errors } = useShapeAPI(nodeId);
  
  const getStageLabel = (stage: string) => {
    const labels = {
      'download': 'データダウンロード中...',
      'simplify1': '初期簡略化処理中...',
      'simplify2': 'タイル準備中...',
      'vectorTiles': 'ベクタータイル生成中...'
    };
    return labels[stage] || '準備中...';
  };
  
  const getStageColor = (progress: number) => {
    if (progress < 25) return 'primary';
    if (progress < 50) return 'secondary';
    if (progress < 75) return 'info';
    if (progress < 100) return 'warning';
    return 'success';
  };
  
  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Typography variant="h6">
        {getStageLabel(stage)}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            color={getStageColor(progress)}
          />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {`${Math.round(progress)}%`}
          </Typography>
        </Box>
      </Box>
      
      {errors.map((error, index) => (
        <Alert key={index} severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ))}
    </Box>
  );
}
```

## セッション管理

### セッションの一時停止

```typescript
// UI層での一時停止処理
const handlePause = async () => {
  await manager.pauseSession(sessionId);
  
  // 一時停止通知が自動的に発行される
  // コールバックで status === 'paused' をチェック
};
```

### セッション状態の取得

```typescript
// 現在の状態を同期的に取得
const status = manager.getSessionStatus(sessionId);
console.log(`Progress: ${status.progress}%`);
console.log(`Stage: ${status.stage}`);
console.log(`Completed: ${status.isCompleted}`);
```

## パフォーマンス考慮事項

### 1. 通知の頻度調整

大量のタスクを処理する場合、通知頻度を調整してUIの負荷を軽減：

```typescript
// 10タスクごとに通知
if (processedTasks % 10 === 0 || processedTasks === totalTasks) {
  this.emitProgressEvent(sessionId, event);
}
```

### 2. バッチング

複数の小さな更新をバッチ処理：

```typescript
const pendingEvents: BatchProgressEvent[] = [];
const flushInterval = setInterval(() => {
  if (pendingEvents.length > 0) {
    callback(pendingEvents[pendingEvents.length - 1]);
    pendingEvents.length = 0;
  }
}, 100); // 100ms間隔で更新
```

## デバッグとロギング

### イベントログの有効化

```typescript
// 開発環境でのデバッグ用
if (process.env.NODE_ENV === 'development') {
  this.emitProgressEvent = new Proxy(this.emitProgressEvent, {
    apply: (target, thisArg, args) => {
      console.log('Progress Event:', args[1]);
      return target.apply(thisArg, args);
    }
  });
}
```

## まとめ

Shape Pluginのバッチ処理通知システムは以下の特徴を持ちます：

1. **リアルタイム通知**: Worker層からUI層へ即座に進捗を通知
2. **4段階の進捗管理**: Download → Simplify1 → Simplify2 → VectorTiles
3. **エラーハンドリング**: エラー情報を含む詳細な通知
4. **柔軟なコールバック**: UI層で自由にカスタマイズ可能
5. **セッション管理**: 複数の処理を並行して管理可能

この通知システムにより、ユーザーは長時間かかるバッチ処理の進捗を視覚的に確認でき、エラー発生時も適切に対処できます。

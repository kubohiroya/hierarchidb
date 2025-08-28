# Worker初期化通知システム 要件定義書

作成日: 2025-08-27

## 1. 機能概要

### 背景と課題
- Worker初期化に時間がかかる場合、Comlinkラッピングが先行して「通信可能だが使用不可」状態が発生
- 非同期遅延初期化シングルトンとexposeのタイミングにずれが生じる

### 解決策
- MessageChannelを使用したComlinkに依存しない初期化検出
- Worker初期化完了後にComlinkでラップする順序制御

## 2. 機能要件

### 2.1 初期化通知フロー
1. UI側がWorkerインスタンスを作成
2. MessageChannelで初期化状態監視を開始
3. Worker側が初期化処理を実行
4. 初期化進捗・完了をMessageChannel経由で通知
5. UI側が完了通知を受信後、Comlinkでラップ

### 2.2 メッセージ仕様

#### リクエストメッセージ（UI→Worker）
```typescript
interface WorkerInitRequest {
  type: 'REQUEST_INIT' | 'REQUEST_INIT_STATUS';
  timestamp?: number;
}
```

#### レスポンスメッセージ（Worker→UI）
```typescript
interface WorkerInitMessage {
  type: 'INIT_COMPLETE' | 'INIT_ERROR' | 'INIT_PROGRESS';
  payload?: {
    progress?: number;    // 0-100
    message?: string;     // 状態説明
    error?: string;       // エラー詳細
    timestamp: number;    // タイムスタンプ
  };
}
```

## 3. 非機能要件

### 3.1 パフォーマンス
- 初期化タイムアウト: 30秒
- メッセージ遅延: 100ms以下
- 進捗更新頻度: 最大10回/秒

### 3.2 信頼性
- タイムアウト時の自動エラーハンドリング
- 重複初期化リクエストの防止
- Worker終了時のクリーンアップ

### 3.3 互換性
- 既存のComlink通信と共存
- モダンブラウザサポート（Chrome 90+, Firefox 88+, Safari 15+）

## 4. 実装仕様

### 4.1 UI側実装
- `WorkerInitializationChannel`クラス
  - `waitForInitialization(worker, timeout)`: Promise<void>
  - メッセージハンドラー管理
  - タイムアウト処理

### 4.2 Worker側実装
- `WorkerInitializationReporter`クラス
  - `reportProgress(progress, message)`: void
  - `reportComplete()`: void
  - `reportError(error)`: void
  - 初期化ステップトラッキング

### 4.3 統合実装
- `WorkerProviderWithMessageChannel`コンポーネント
  - MessageChannel初期化検出
  - Comlinkラッピング
  - エラー/ローディング状態管理

## 5. テスト要件

### 5.1 単体テスト
- MessageChannel通信の正常動作
- タイムアウト処理
- エラーハンドリング

### 5.2 統合テスト
- Worker初期化からComlink通信開始までのフロー
- 複数Worker同時初期化
- ブラウザ互換性

## 6. 制約事項

- SharedArrayBufferは使用しない（COOP/COEP制約回避）
- BroadcastChannelは使用しない（Safari互換性）
- MessageChannelベースの実装を優先

## 7. 今後の拡張性

- 初期化キャンセル機能
- 複数Workerの並列初期化管理
- 初期化メトリクスの収集
# TreeObservableService 実装要件

## 概要
TreeObservableServiceは、ツリー構造の変更をリアルタイムで監視・通知するサービスです。RxJSのObservableパターンを使用して、ノードの変更、追加、削除、移動を効率的にクライアントに通知します。

## 機能要件

### 1. ノード監視操作

#### 1.1 observeNode
- 🟢 指定されたノードの変更を監視
- 🟡 Dexie live queryまたはポーリングベースで実装
- 🟢 ノードの内容変更を検出（name、description、など）
- 🟢 ノードの削除を検出
- 🟢 Observable<TreeChangeEvent>を返す

#### 1.2 observeChildren
- 🟢 指定された親ノードの子ノード一覧の変更を監視
- 🟢 子ノードの追加・削除・移動を検出
- 🟢 子ノードの順序変更を検出
- 🟢 子ノード自体のプロパティ変更も通知

#### 1.3 observeSubtree
- 🟡 指定されたノード以下のサブツリー全体を監視
- 🟡 任意の階層での変更を検出
- 🟡 パフォーマンス考慮（深い階層での効率的な監視）

#### 1.4 observeDescendants
- 🟢 指定されたノードの全ての子孫ノードを監視
- 🟢 階層制限オプション（maxDepth）
- 🟢 フィルタリング（ノードタイプ別）

### 2. 高度な監視機能

#### 2.1 observeNodesByType
- 🟡 特定のノードタイプのみを監視
- 🟡 複数タイプの同時監視
- 🟡 新しいタイプのノード作成も検出

#### 2.2 observeSearchResults
- 🟡 検索結果の変更を動的に監視
- 🟡 検索条件にマッチするノードの追加・削除を検出
- 🟡 検索結果のリアルタイム更新

#### 2.3 observeWorkingCopies
- 🟢 Working Copyの作成・削除・コミット状況を監視
- 🟢 Draft作業状況の変更通知
- 🟢 競合状態の検出

### 3. イベント型定義

#### 3.1 TreeChangeEvent
```typescript
export interface TreeChangeEvent {
  type: 'node-created' | 'node-updated' | 'node-deleted' | 'node-moved' | 'children-changed';
  nodeId: TreeNodeId;
  parentId?: TreeNodeId;
  previousParentId?: TreeNodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  affectedChildren?: TreeNodeId[];
  timestamp: Timestamp;
  commandId?: CommandId; // 変更を引き起こしたコマンド
}
```

#### 3.2 SubscriptionFilter
```typescript
export interface SubscriptionFilter {
  nodeTypes?: TreeNodeType[];
  includeDescendants?: boolean;
  maxDepth?: number;
  properties?: string[]; // 監視するプロパティ名
}
```

### 4. 購読管理

#### 4.1 Subscription管理
- 🟢 購読の自動解除（クライアント切断時）
- 🟢 購読数の制限（メモリ保護）
- 🟢 重複購読の最適化
- 🟢 購読のアクティブ状況監視

#### 4.2 バックプレッシャー対応
- 🟡 大量変更時のイベント集約
- 🟡 クライアント側処理速度に応じた制御
- 🟡 イベントキューのオーバーフロー防止

## 非機能要件

### パフォーマンス
- 🟢 変更通知の遅延: 50ms以内
- 🟢 1000ノード同時監視での安定動作
- 🟢 メモリ使用量の制限（監視あたり1KB以下）
- 🟡 10万ノード環境での動作

### リソース管理
- 🟢 メモリリークの防止
- 🟢 未使用監視の自動解除
- 🟢 リソース使用量の監視・アラート
- 🟢 ガベージコレクション対応

### 信頼性
- 🟢 ネットワーク断線時の自動復旧
- 🟢 データベース接続エラーからの回復
- 🟢 イベント重複の防止
- 🟢 イベント順序の保証

### エラーハンドリング
- 🟢 存在しないノード監視の適切な処理
- 🟢 アクセス権限のないノードの除外
- 🟢 データベースエラー時のフェイルオーバー

## ペイロード定義

### ObserveNodePayload
```typescript
export interface ObserveNodePayload {
  treeNodeId: TreeNodeId;
  filter?: SubscriptionFilter;
  includeInitialValue?: boolean;
}
```

### ObserveChildrenPayload
```typescript
export interface ObserveChildrenPayload {
  parentTreeNodeId: TreeNodeId;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
```

### ObserveSubtreePayload
```typescript
export interface ObserveSubtreePayload {
  rootNodeId: TreeNodeId;
  maxDepth?: number;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
}
```

### ObserveWorkingCopiesPayload
```typescript
export interface ObserveWorkingCopiesPayload {
  nodeId?: TreeNodeId; // 特定ノードのWorking Copyのみ
  includeAllDrafts?: boolean;
}
```

## 実装方式

### 1. イベントソース
- 🟡 Dexie live queryの活用（リアクティブDB監視）
- 🟢 Command実行時のフック統合
- 🟢 定期ポーリングによるフォールバック

### 2. イベント配信
- 🟢 RxJS Subject/BehaviorSubjectベース
- 🟢 WebWorker内でのObservable処理
- 🟢 クライアント側へのイベントストリーム転送

### 3. 状態管理
- 🟢 購読リストの効率的な管理
- 🟢 ノード状態のキャッシュ
- 🟢 変更差分の効率的な検出

## 依存関係
- CoreDB（Task 1）✅
- TreeNode型システム（Task 2）✅
- RxJS（Observable/Subject）
- Dexie live query（オプション）

## テスト要件
1. 基本監視機能のテスト
2. 大量変更時のパフォーマンステスト
3. メモリリークのテスト
4. エラーハンドリングのテスト
5. 購読解除のテスト
6. 並行処理でのデータ整合性テスト
7. ネットワーク断線・復旧テスト

## 実装優先順位
1. 基本的なノード監視（observeNode）
2. 子ノード監視（observeChildren）
3. Working Copy監視
4. 高度な監視機能（サブツリー、検索結果）
5. パフォーマンス最適化
6. エラーハンドリング強化
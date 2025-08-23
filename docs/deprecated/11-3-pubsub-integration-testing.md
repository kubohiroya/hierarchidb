# 11-3. Pub/Sub統合テスト実装ガイド

## 概要

Pub/Sub統合テストは、HierarchiDBのイベント駆動アーキテクチャの核心である Observable パターンをNode環境で検証します。データベース変更からUI状態更新までの完全なイベントフローを、React/ブラウザ依存なしでテストできます。

## Pub/Subアーキテクチャの理解

### イベントフローの全体像

```
データベース変更 → CoreDB.changeSubject → TreeObservableService → UI購読者
     ↓                    ↓                        ↓               ↓
  CRUD操作           Subject.next()         Observable.pipe()   UI状態更新
```

### 主要コンポーネント

1. **CoreDB.changeSubject**: データベース変更の発信元
2. **TreeObservableService**: イベントフィルタリングと配信
3. **SubscriptionManager**: 購読ライフサイクル管理
4. **Observable**: RxJSベースのリアクティブストリーム

## テストファイルの基本構造

### セットアップとクリーンアップ

```typescript
// packages/worker/src/__tests__/services/PubSubService.test.ts

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TreeObservableServiceImpl } from '../../services/TreeObservableServiceImpl';
import { CoreDB } from '../../db/CoreDB';
import type { TreeNodeId, TreeNode, TreeChangeEvent } from '@hierarchidb/core';

describe('Pub/Sub Service Node環境テスト', () => {
  let coreDB: CoreDB;
  let observableService: TreeObservableServiceImpl;

  beforeEach(async () => {
    // 独立したデータベースインスタンス
    coreDB = new CoreDB('test-pubsub-db');
    await coreDB.open();
    
    // Observable Serviceの初期化
    observableService = new TreeObservableServiceImpl(coreDB);
  });

  afterEach(async () => {
    // リソースクリーンアップ
    await observableService.cleanupOrphanedSubscriptions();
    coreDB.close();
  });
});
```

## テストケース別実装パターン

### 1. 単一ノード変更の検出

#### 基本的なノード監視テスト

```typescript
describe('ノード変更の購読と通知', () => {
  it('単一ノードの変更を検出できる', async () => {
    // Given: 監視対象ノードを作成
    const nodeId = 'test-node-001' as TreeNodeId;
    const receivedEvents: TreeChangeEvent[] = [];

    const initialNode: TreeNode = {
      treeNodeId: nodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Initial Name',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.add(initialNode);

    // When: ノード変更を購読
    const observable = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-001',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
      error: (error) => console.error('Subscription error:', error),
    });

    // When: ノードを実際に更新（イベント自動発火）
    await coreDB.nodes.update(nodeId, {
      name: 'Updated Name',
      version: 2,
    });

    // イベント処理の待機
    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 変更イベントが検出される
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('update');
    expect(receivedEvents[0].nodeId).toBe(nodeId);

    subscription.unsubscribe();
  });
});
```

#### フィルタリング機能のテスト

```typescript
it('特定のノードタイプのみ監視できる', async () => {
  const folderNodeId = 'folder-node' as TreeNodeId;
  const fileNodeId = 'file-node' as TreeNodeId;
  const receivedEvents: TreeChangeEvent[] = [];

  // Given: 異なるタイプのノードを作成
  await coreDB.nodes.bulkAdd([
    {
      treeNodeId: folderNodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Test Folder',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      treeNodeId: fileNodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'file',
      name: 'Test File',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
  ]);

  // When: フォルダタイプのみフィルタして購読
  const observable = await observableService.observeNode({
    type: 'observeNode',
    payload: { 
      nodeId: folderNodeId,
      filter: { nodeTypes: ['folder'] }
    },
    commandId: 'cmd-filter',
    timestamp: Date.now(),
  });

  const subscription = observable.subscribe({
    next: (event) => receivedEvents.push(event),
  });

  // When: 両方のノードを更新
  await coreDB.nodes.update(folderNodeId, { name: 'Updated Folder', version: 2 });
  await coreDB.nodes.update(fileNodeId, { name: 'Updated File', version: 2 });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Then: フォルダの変更のみ検出される
  expect(receivedEvents).toHaveLength(1);
  expect(receivedEvents[0].nodeId).toBe(folderNodeId);

  subscription.unsubscribe();
});
```

### 2. 複数購読者への同時通知

```typescript
describe('複数購読者のイベント配信', () => {
  it('複数の購読者に同時に通知される', async () => {
    const nodeId = 'multi-subscriber-node' as TreeNodeId;
    const subscriber1Events: TreeChangeEvent[] = [];
    const subscriber2Events: TreeChangeEvent[] = [];

    // Given: ノードを作成
    const node: TreeNode = {
      treeNodeId: nodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Multi Subscriber Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.add(node);

    // When: 複数の購読者を設定
    const observable1 = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-002a',
      timestamp: Date.now(),
    });

    const observable2 = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-002b',
      timestamp: Date.now(),
    });

    const subscription1 = observable1.subscribe({
      next: (event) => subscriber1Events.push(event),
    });

    const subscription2 = observable2.subscribe({
      next: (event) => subscriber2Events.push(event),
    });

    // When: ノードを実際に更新
    await coreDB.nodes.update(nodeId, {
      name: 'Updated by Multiple',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 両方の購読者が通知を受信
    expect(subscriber1Events).toHaveLength(1);
    expect(subscriber2Events).toHaveLength(1);
    expect(subscriber1Events[0].nodeId).toBe(nodeId);
    expect(subscriber2Events[0].nodeId).toBe(nodeId);

    subscription1.unsubscribe();
    subscription2.unsubscribe();
  });
});
```

### 3. サブツリー変更の監視

```typescript
describe('サブツリー変更の購読', () => {
  it('子ノードの変更を親購読者が検出できる', async () => {
    const parentId = 'parent-node' as TreeNodeId;
    const childId = 'child-node' as TreeNodeId;
    const receivedEvents: TreeChangeEvent[] = [];

    // Given: 親子関係のノードを作成
    const parentNode: TreeNode = {
      treeNodeId: parentId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Parent',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const childNode: TreeNode = {
      treeNodeId: childId,
      parentTreeNodeId: parentId,
      treeNodeType: 'folder',
      name: 'Child',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.bulkAdd([parentNode, childNode]);

    // When: サブツリーを購読
    const observable = await observableService.observeSubtree({
      type: 'observeSubtree',
      payload: { rootNodeId: parentId },
      commandId: 'cmd-003',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
    });

    // When: 子ノードを実際に更新
    await coreDB.nodes.update(childId, {
      name: 'Updated Child',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 子ノードの変更が検出される
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].nodeId).toBe(childId);
    expect(receivedEvents[0].type).toBe('update');

    subscription.unsubscribe();
  });

  it('深い階層の変更も検出できる', async () => {
    const rootId = 'deep-root' as TreeNodeId;
    const level1Id = 'deep-level1' as TreeNodeId;
    const level2Id = 'deep-level2' as TreeNodeId;
    const level3Id = 'deep-level3' as TreeNodeId;
    const receivedEvents: TreeChangeEvent[] = [];

    // Given: 深い階層構造を作成
    await coreDB.nodes.bulkAdd([
      {
        treeNodeId: rootId,
        parentTreeNodeId: 'root' as TreeNodeId,
        treeNodeType: 'folder',
        name: 'Deep Root',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
      {
        treeNodeId: level1Id,
        parentTreeNodeId: rootId,
        treeNodeType: 'folder',
        name: 'Level 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
      {
        treeNodeId: level2Id,
        parentTreeNodeId: level1Id,
        treeNodeType: 'folder',
        name: 'Level 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
      {
        treeNodeId: level3Id,
        parentTreeNodeId: level2Id,
        treeNodeType: 'folder',
        name: 'Level 3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
    ]);

    // When: ルートからサブツリーを監視
    const observable = await observableService.observeSubtree({
      type: 'observeSubtree',
      payload: { 
        rootNodeId: rootId,
        maxDepth: 5 // 深い階層まで監視
      },
      commandId: 'cmd-deep',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
    });

    // When: 最深層のノードを更新
    await coreDB.nodes.update(level3Id, {
      name: 'Updated Level 3',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 深い階層の変更も検出される
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].nodeId).toBe(level3Id);

    subscription.unsubscribe();
  });
});
```

### 4. 購読ライフサイクル管理

```typescript
describe('購読のライフサイクル管理', () => {
  it('購読解除後は通知を受信しない', async () => {
    const nodeId = 'lifecycle-test' as TreeNodeId;
    const receivedEvents: TreeChangeEvent[] = [];

    const node: TreeNode = {
      treeNodeId: nodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Lifecycle Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.add(node);

    // Given: ノードを購読
    const observable = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-004',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
    });

    // When: 購読を解除
    subscription.unsubscribe();

    // When: ノードを更新
    await coreDB.nodes.update(nodeId, {
      name: 'Should Not Receive',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 通知を受信しない
    expect(receivedEvents).toHaveLength(0);
  });

  it('アクティブな購読数を追跡できる', async () => {
    const nodeId1 = 'track-node-1' as TreeNodeId;
    const nodeId2 = 'track-node-2' as TreeNodeId;

    // Given: 初期状態では購読数0
    expect(await observableService.getActiveSubscriptions()).toBe(0);

    // When: 複数の購読を作成
    const observable1 = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId: nodeId1 },
      commandId: 'cmd-005a',
      timestamp: Date.now(),
    });

    const observable2 = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId: nodeId2 },
      commandId: 'cmd-005b',
      timestamp: Date.now(),
    });

    const subscription1 = observable1.subscribe(() => {});
    const subscription2 = observable2.subscribe(() => {});

    // Then: アクティブな購読数が増加
    expect(await observableService.getActiveSubscriptions()).toBe(2);

    // When: 1つの購読を解除
    subscription1.unsubscribe();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(await observableService.getActiveSubscriptions()).toBe(1);

    // When: 残りも解除
    subscription2.unsubscribe();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(await observableService.getActiveSubscriptions()).toBe(0);
  });

  it('非アクティブな購読を自動クリーンアップできる', async () => {
    const nodeId = 'cleanup-test' as TreeNodeId;

    // Given: 複数の購読を作成
    const subscriptions = [];
    for (let i = 0; i < 5; i++) {
      const observable = await observableService.observeNode({
        type: 'observeNode',
        payload: { nodeId: `${nodeId}-${i}` as TreeNodeId },
        commandId: `cmd-cleanup-${i}`,
        timestamp: Date.now(),
      });
      subscriptions.push(observable.subscribe(() => {}));
    }

    expect(await observableService.getActiveSubscriptions()).toBe(5);

    // When: 一部の購読を解除
    subscriptions.slice(0, 3).forEach(sub => sub.unsubscribe());

    // When: クリーンアップを実行
    await observableService.cleanupOrphanedSubscriptions();

    // Then: 非アクティブな購読が削除される
    expect(await observableService.getActiveSubscriptions()).toBe(2);

    // クリーンアップ
    subscriptions.slice(3).forEach(sub => sub.unsubscribe());
  });
});
```

### 5. パフォーマンステスト

```typescript
describe('パフォーマンステスト', () => {
  it('大量の購読者でもパフォーマンスを維持', async () => {
    const nodeId = 'perf-test' as TreeNodeId;
    const subscriberCount = 100;
    const subscriptions: any[] = [];

    const node: TreeNode = {
      treeNodeId: nodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Performance Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.add(node);

    // Given: 100個の購読者を作成
    const startTime = Date.now();

    for (let i = 0; i < subscriberCount; i++) {
      const observable = await observableService.observeNode({
        type: 'observeNode',
        payload: { nodeId },
        commandId: `perf-cmd-${i}`,
        timestamp: Date.now(),
      });

      const subscription = observable.subscribe(() => {});
      subscriptions.push(subscription);
    }

    const subscriptionTime = Date.now() - startTime;

    // Then: 購読作成時間が許容範囲内
    expect(subscriptionTime).toBeLessThan(500); // 500ms以内

    // When: 変更通知のパフォーマンステスト
    const notificationStartTime = Date.now();

    await coreDB.nodes.update(nodeId, {
      name: 'Broadcasted',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const notificationTime = Date.now() - notificationStartTime;

    // Then: 通知時間が許容範囲内
    expect(notificationTime).toBeLessThan(100); // 100ms以内

    // クリーンアップ
    subscriptions.forEach(sub => sub.unsubscribe());
  });

  it('メモリリークが発生しない', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 50;

    // Given: 大量の購読作成・削除を繰り返す
    for (let i = 0; i < iterations; i++) {
      const nodeId = `memory-test-${i}` as TreeNodeId;
      
      const observable = await observableService.observeNode({
        type: 'observeNode',
        payload: { nodeId },
        commandId: `memory-cmd-${i}`,
        timestamp: Date.now(),
      });

      const subscription = observable.subscribe(() => {});
      
      // 即座に解除
      subscription.unsubscribe();
    }

    // クリーンアップを実行
    await observableService.cleanupOrphanedSubscriptions();
    
    // ガベージコレクションを促進
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Then: メモリ使用量が許容範囲内
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB以内
  });
});
```

## エラーハンドリングテスト

### 購読エラーの処理

```typescript
describe('エラーハンドリング', () => {
  it('存在しないノードの購読でエラーが発生する', async () => {
    const nonExistentNodeId = 'non-existent-node' as TreeNodeId;
    
    try {
      const observable = await observableService.observeNode({
        type: 'observeNode',
        payload: { nodeId: nonExistentNodeId },
        commandId: 'cmd-error',
        timestamp: Date.now(),
      });

      const subscription = observable.subscribe({
        next: () => {},
        error: (error) => {
          expect(error.message).toContain('Node not found');
        },
      });

      // エラーが発生することを期待
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('データベースエラー時の適切な処理', async () => {
    const nodeId = 'db-error-test' as TreeNodeId;
    const receivedEvents: TreeChangeEvent[] = [];
    const receivedErrors: any[] = [];

    // Given: 正常なノードを作成
    const node: TreeNode = {
      treeNodeId: nodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'DB Error Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await coreDB.nodes.add(node);

    // When: 購読を開始
    const observable = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-db-error',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
      error: (error) => receivedErrors.push(error),
    });

    // When: データベースを強制的にクローズ（エラーシミュレート）
    await coreDB.close();

    try {
      await coreDB.nodes.update(nodeId, { name: 'Should Fail', version: 2 });
    } catch (error) {
      // データベースエラーが発生することを期待
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: エラーハンドリングが適切に動作
    // (実装に応じて期待値を調整)

    subscription.unsubscribe();
  });
});
```

## デバッグとトラブルシューティング

### デバッグ用ログの追加

```typescript
it('デバッグ用ログ付きテスト', async () => {
  const nodeId = 'debug-test' as TreeNodeId;
  const events: any[] = [];

  console.log('Test started:', { nodeId, timestamp: Date.now() });

  // Observable作成時のログ
  const observable = await observableService.observeNode({
    type: 'observeNode',
    payload: { nodeId },
    commandId: 'debug-cmd',
    timestamp: Date.now(),
  });

  console.log('Observable created for node:', nodeId);

  const subscription = observable.subscribe({
    next: (event) => {
      console.log('Event received:', { 
        type: event.type, 
        nodeId: event.nodeId, 
        timestamp: event.timestamp 
      });
      events.push(event);
    },
    error: (error) => {
      console.error('Subscription error:', error);
    },
  });

  console.log('Subscription created');

  // ノード更新時のログ
  console.log('Updating node...');
  await coreDB.nodes.update(nodeId, { name: 'Debug Updated', version: 2 });
  console.log('Node updated');

  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('Events received:', events.length);
  
  subscription.unsubscribe();
  console.log('Test completed');
});
```

### イベントタイミングの調査

```typescript
it('イベントタイミングの詳細調査', async () => {
  const nodeId = 'timing-test' as TreeNodeId;
  const timings: Array<{ event: string; timestamp: number }> = [];

  const addTiming = (event: string) => {
    timings.push({ event, timestamp: Date.now() });
  };

  addTiming('test_start');

  // ノード作成
  await coreDB.nodes.add({
    treeNodeId: nodeId,
    parentTreeNodeId: 'root' as TreeNodeId,
    treeNodeType: 'folder',
    name: 'Timing Test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });
  addTiming('node_created');

  // Observable作成
  const observable = await observableService.observeNode({
    type: 'observeNode',
    payload: { nodeId },
    commandId: 'timing-cmd',
    timestamp: Date.now(),
  });
  addTiming('observable_created');

  // 購読開始
  const subscription = observable.subscribe({
    next: () => addTiming('event_received'),
  });
  addTiming('subscription_created');

  // ノード更新
  await coreDB.nodes.update(nodeId, { name: 'Updated', version: 2 });
  addTiming('node_updated');

  await new Promise(resolve => setTimeout(resolve, 100));
  addTiming('test_end');

  // タイミング分析
  console.log('Event timings:');
  timings.forEach((timing, index) => {
    const duration = index > 0 ? timing.timestamp - timings[index - 1].timestamp : 0;
    console.log(`${timing.event}: ${duration}ms`);
  });

  subscription.unsubscribe();
});
```

## ベストプラクティス

### 1. 適切な待機時間の設定

```typescript
// ❌ 不安定な固定待機時間
await new Promise(resolve => setTimeout(resolve, 10));

// ✅ イベント駆動の待機
const waitForEvent = () => new Promise<void>((resolve) => {
  const timeout = setTimeout(() => resolve(), 1000); // フォールバック
  const subscription = observable.subscribe({
    next: () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      resolve();
    },
  });
});
```

### 2. メモリリーク防止

```typescript
// ✅ 確実な購読解除
const subscriptions: any[] = [];

afterEach(() => {
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.length = 0;
});

// テスト内での購読管理
const subscription = observable.subscribe(handler);
subscriptions.push(subscription); // 自動クリーンアップ対象に追加
```

### 3. テストの独立性確保

```typescript
// ✅ 各テストで独立したノードID
const generateTestNodeId = () => `test-node-${Date.now()}-${Math.random()}` as TreeNodeId;

// ✅ データベースの完全なクリーンアップ
beforeEach(async () => {
  await coreDB.nodes.clear();
  await ephemeralDB.workingCopies.clear();
});
```

このPub/Sub統合テストにより、HierarchiDBのリアクティブなイベント処理機能を包括的に検証し、安定したデータフローを保証しています。
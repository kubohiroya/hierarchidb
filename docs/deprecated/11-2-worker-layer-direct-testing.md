# 11-2. Worker層直接テスト実装ガイド

## 概要

Worker層直接テストは、Comlink RPC を介さずにWorker内部のサービスクラスを直接インスタンス化してテストする手法です。これにより、データベース操作、コマンド処理、Observable サービスなどの核心機能を高速かつ確実に検証できます。

## テスト設計原則

### 1. 直接インスタンス化によるテスト分離

```typescript
// ❌ Comlink経由の間接テスト（重い）
const workerProxy = Comlink.wrap<WorkerAPI>(worker);
await workerProxy.createNode(nodeData);

// ✅ 直接インスタンス化（軽量）
const coreDB = new CoreDB('test-db');
const mutationService = new TreeMutationServiceImpl(coreDB, ...);
await mutationService.createNode(nodeData);
```

### 2. 依存性注入による制御性向上

```typescript
// サービス間の依存関係を明示的に制御
const commandProcessor = new CommandProcessor();
const lifecycleManager = new NodeLifecycleManager(registry, coreDB, ephemeralDB);
const mutationService = new TreeMutationServiceImpl(
  coreDB,
  ephemeralDB,
  commandProcessor,
  lifecycleManager
);
```

## テストファイル構造

### 基本テンプレート

```typescript
// packages/worker/src/__tests__/worker-direct.test.ts

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { WorkerAPIImpl } from '../WorkerAPIImpl';
import { CoreDB } from '../db/CoreDB';
import { EphemeralDB } from '../db/EphemeralDB';
import { TreeMutationServiceImpl } from '../services/TreeMutationServiceImpl';
import { TreeObservableServiceImpl } from '../services/TreeObservableServiceImpl';
import { CommandProcessor } from '../command/CommandProcessor';
import type { TreeNodeId, TreeNode } from '@hierarchidb/core';

describe('Worker層直接呼び出しテスト', () => {
  let coreDB: CoreDB;
  let ephemeralDB: EphemeralDB;
  let mutationService: TreeMutationServiceImpl;
  let observableService: TreeObservableServiceImpl;
  let commandProcessor: CommandProcessor;

  beforeEach(async () => {
    // 各テストで独立したデータベースインスタンス
    coreDB = new CoreDB('test-core-db');
    ephemeralDB = new EphemeralDB('test-ephemeral-db');
    
    await coreDB.open();
    await ephemeralDB.open();

    // サービスの依存関係を構築
    commandProcessor = new CommandProcessor();
    mutationService = new TreeMutationServiceImpl(coreDB, ephemeralDB, commandProcessor);
    observableService = new TreeObservableServiceImpl(coreDB, ephemeralDB);
  });

  afterEach(async () => {
    // リソースのクリーンアップ
    coreDB.close();
    ephemeralDB.close();
  });
});
```

## テストカテゴリ別実装

### 1. データベース操作テスト

#### CRUD操作の基本テスト

```typescript
describe('フォルダ作成の内部動作', () => {
  it('Working Copyの作成と管理', async () => {
    // Given: 新しいWorking Copyを準備
    const workingCopyId = 'wc-test-001';
    const parentNodeId = 'root' as TreeNodeId;
    
    // When: EphemeralDBにWorking Copyを保存
    await ephemeralDB.workingCopies.add({
      workingCopyId,
      treeNodeId: null, // 新規作成なのでnull
      parentTreeNodeId: parentNodeId,
      nodeType: 'folder',
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      changes: {
        name: 'Test Folder',
        description: 'Test Description',
      },
    });

    // Then: Working Copyが正しく保存される
    const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
    expect(workingCopy).toBeDefined();
    expect(workingCopy?.changes.name).toBe('Test Folder');
    expect(workingCopy?.status).toBe('draft');
  });

  it('Working CopyからCoreDBへのコミット', async () => {
    // Given: Working Copyを準備
    const workingCopyId = 'wc-test-002';
    const newNodeId = 'node-001' as TreeNodeId;
    
    await ephemeralDB.workingCopies.add({
      workingCopyId,
      treeNodeId: null,
      parentTreeNodeId: 'root' as TreeNodeId,
      nodeType: 'folder',
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      changes: { name: 'Committed Folder' },
    });

    // When: コミット処理をシミュレート
    const now = Date.now();
    const newNode: TreeNode = {
      treeNodeId: newNodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder',
      name: 'Committed Folder',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await coreDB.nodes.add(newNode);
    await ephemeralDB.workingCopies.delete(workingCopyId);

    // Then: ノードが作成され、Working Copyが削除される
    const savedNode = await coreDB.nodes.get(newNodeId);
    expect(savedNode).toBeDefined();
    expect(savedNode?.name).toBe('Committed Folder');

    const deletedWC = await ephemeralDB.workingCopies.get(workingCopyId);
    expect(deletedWC).toBeUndefined();
  });
});
```

#### トランザクション処理テスト

```typescript
describe('トランザクション処理', () => {
  it('複数の操作をトランザクションで実行', async () => {
    // Given: 複数のノードデータ
    const nodes: TreeNode[] = [
      {
        treeNodeId: 'tx-node-001' as TreeNodeId,
        parentTreeNodeId: 'root' as TreeNodeId,
        treeNodeType: 'folder',
        name: 'TX Folder 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
      {
        treeNodeId: 'tx-node-002' as TreeNodeId,
        parentTreeNodeId: 'root' as TreeNodeId,
        treeNodeType: 'folder',
        name: 'TX Folder 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
    ];

    // When: トランザクションで一括作成
    await coreDB.transaction('rw', coreDB.nodes, async () => {
      await coreDB.nodes.bulkAdd(nodes);
    });

    // Then: すべてのノードが作成される
    const node1 = await coreDB.nodes.get('tx-node-001');
    const node2 = await coreDB.nodes.get('tx-node-002');
    
    expect(node1).toBeDefined();
    expect(node2).toBeDefined();
    expect(node1?.name).toBe('TX Folder 1');
    expect(node2?.name).toBe('TX Folder 2');
  });

  it('エラー時のロールバック', async () => {
    let errorThrown = false;

    try {
      await coreDB.transaction('rw', coreDB.nodes, async () => {
        // 最初のノードを追加
        await coreDB.nodes.add({
          treeNodeId: 'rollback-001' as TreeNodeId,
          parentTreeNodeId: 'root' as TreeNodeId,
          treeNodeType: 'folder',
          name: 'Should Rollback',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });

        // エラーを強制的に発生させる
        throw new Error('Simulated error');
      });
    } catch (error) {
      errorThrown = true;
    }

    // Then: エラーが発生し、ロールバックされる
    expect(errorThrown).toBe(true);
    
    const node = await coreDB.nodes.get('rollback-001');
    expect(node).toBeUndefined();
  });
});
```

### 2. コマンドプロセッサテスト

```typescript
describe('CommandProcessorの動作', () => {
  it('コマンドの記録とUndo/Redo', async () => {
    // Given: 実行可能なコマンドを準備
    const command1 = commandProcessor.createEnvelope('createNode', {
      nodeId: 'node-001' as TreeNodeId,
      name: 'Folder 1',
    });

    const command2 = commandProcessor.createEnvelope('createNode', {
      nodeId: 'node-002' as TreeNodeId,
      name: 'Folder 2',
    });

    // When: コマンドを処理
    await commandProcessor.processCommand(command1);
    await commandProcessor.processCommand(command2);

    // Then: Undo/Redoスタックが正しく管理される
    expect(commandProcessor.canUndo()).toBe(true);
    expect(commandProcessor.getUndoStackSize()).toBe(2);
    expect(commandProcessor.canRedo()).toBe(false);

    // When: Undo実行
    const undoResult = await commandProcessor.undo();
    
    // Then: スタック状態が更新される
    expect(undoResult.success).toBe(true);
    expect(commandProcessor.getUndoStackSize()).toBe(1);
    expect(commandProcessor.canRedo()).toBe(true);

    // When: Redo実行
    const redoResult = await commandProcessor.redo();
    
    // Then: 元の状態に戻る
    expect(redoResult.success).toBe(true);
    expect(commandProcessor.getUndoStackSize()).toBe(2);
    expect(commandProcessor.canRedo()).toBe(false);
  });
});
```

### 3. Observable Serviceテスト

```typescript
describe('Observable Serviceの動作', () => {
  it('ノード変更の検出', async () => {
    // Given: 監視対象ノードを作成
    const nodeId = 'node-obs-001' as TreeNodeId;
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
    const receivedEvents: any[] = [];

    // When: ノード変更を購読
    const observable = await observableService.observeNode({
      type: 'observeNode',
      payload: { nodeId },
      commandId: 'cmd-obs-001',
      timestamp: Date.now(),
    });

    const subscription = observable.subscribe({
      next: (event) => receivedEvents.push(event),
      error: (error) => console.error('Subscription error:', error),
    });

    // When: ノードを更新（変更イベントが自動発火）
    await coreDB.nodes.update(nodeId, {
      name: 'Updated Name',
      version: 2,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then: 変更イベントが検出される
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('update');
    expect(receivedEvents[0].nodeId).toBe(nodeId);

    subscription.unsubscribe();
  });
});
```

### 4. パフォーマンステスト

```typescript
describe('パフォーマンステスト', () => {
  it('大量ノードの一括作成性能', async () => {
    const startTime = Date.now();
    const nodeCount = 1000;
    const nodes: TreeNode[] = [];

    // Given: 1000個のノードデータを準備
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        treeNodeId: `perf-node-${i}` as TreeNodeId,
        parentTreeNodeId: 'root' as TreeNodeId,
        treeNodeType: 'folder',
        name: `Performance Test Folder ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
    }

    // When: 一括追加を実行
    await coreDB.nodes.bulkAdd(nodes);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Then: パフォーマンス要件を満たす
    expect(duration).toBeLessThan(1000); // 1秒以内
    
    const count = await coreDB.nodes.count();
    expect(count).toBeGreaterThanOrEqual(nodeCount);
  });

  it('インデックスを使用した高速検索', async () => {
    // Given: 階層構造のテストデータ
    const testNodes: TreeNode[] = [];
    for (let i = 0; i < 100; i++) {
      testNodes.push({
        treeNodeId: `search-node-${i}` as TreeNodeId,
        parentTreeNodeId: i % 10 === 0 ? 'root' as TreeNodeId : `search-node-${i - 1}` as TreeNodeId,
        treeNodeType: 'folder',
        name: `Search Test ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
    }

    await coreDB.nodes.bulkAdd(testNodes);

    // When: インデックスを使用した検索
    const startTime = Date.now();
    
    const children = await coreDB.nodes
      .where('parentTreeNodeId')
      .equals('root')
      .toArray();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Then: 高速検索を実現
    expect(duration).toBeLessThan(100); // 100ms以内
    expect(children.length).toBe(10); // root直下は10個
  });
});
```

## テスト実行とデバッグ

### 実行コマンド

```bash
# 単一テストファイルの実行
pnpm test:run src/__tests__/worker-direct.test.ts

# 詳細出力での実行
pnpm test:run --reporter=verbose src/__tests__/worker-direct.test.ts

# 特定のテストケースのみ実行
pnpm test:run src/__tests__/worker-direct.test.ts -t "Working Copyの作成"

# ウォッチモードでの開発
pnpm test src/__tests__/worker-direct.test.ts --watch
```

### デバッグ手法

#### 1. ログベースデバッグ

```typescript
it('デバッグ用ログ付きテスト', async () => {
  console.log('Test start:', { nodeId, timestamp: Date.now() });
  
  const result = await mutationService.createNode(nodeData);
  console.log('Create result:', result);
  
  const savedNode = await coreDB.nodes.get(nodeId);
  console.log('Saved node:', savedNode);
  
  expect(savedNode).toBeDefined();
});
```

#### 2. 状態スナップショット

```typescript
it('状態スナップショット検証', async () => {
  // Before: 初期状態
  const beforeCount = await coreDB.nodes.count();
  const beforeWCCount = await ephemeralDB.workingCopies.count();
  
  // Operation
  await mutationService.createWorkingCopy(command);
  
  // After: 変更後状態
  const afterCount = await coreDB.nodes.count();
  const afterWCCount = await ephemeralDB.workingCopies.count();
  
  console.log('State change:', {
    nodes: { before: beforeCount, after: afterCount },
    workingCopies: { before: beforeWCCount, after: afterWCCount },
  });
});
```

#### 3. 非同期処理のデバッグ

```typescript
it('非同期イベントの検証', async () => {
  const events: any[] = [];
  
  const subscription = observable.subscribe({
    next: (event) => {
      console.log('Event received:', event);
      events.push(event);
    },
    error: (error) => console.error('Observable error:', error),
  });
  
  await coreDB.nodes.update(nodeId, updateData);
  
  // イベント処理の待機
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('Total events received:', events.length);
  expect(events).toHaveLength(1);
});
```

## ベストプラクティス

### 1. テストデータ管理

```typescript
// 再利用可能なテストデータファクトリ
function createTestNode(override: Partial<TreeNode> = {}): TreeNode {
  return {
    treeNodeId: `test-node-${Date.now()}` as TreeNodeId,
    parentTreeNodeId: 'root' as TreeNodeId,
    treeNodeType: 'folder',
    name: 'Test Node',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...override,
  };
}

// 使用例
const node = createTestNode({ name: 'Custom Name' });
```

### 2. リソース管理

```typescript
// afterEach での確実なクリーンアップ
afterEach(async () => {
  // Observable購読の解除
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.clear();
  
  // データベース接続の切断
  await Promise.all([
    coreDB.close(),
    ephemeralDB.close(),
  ]);
});
```

### 3. エラーハンドリング

```typescript
it('エラーケースの検証', async () => {
  // 存在しないノードの更新を試行
  await expect(
    mutationService.updateNode('non-existent' as TreeNodeId, {})
  ).rejects.toThrow('Node not found');
});
```

### 4. タイムアウト設定

```typescript
it('長時間処理のテスト', async () => {
  // 大量データの処理など
  await performLargeOperation();
}, 10000); // 10秒のタイムアウト
```

## パフォーマンス最適化

### 1. テストの並列化

```typescript
// 独立したテストは並列実行可能
describe.concurrent('並列実行可能なテスト群', () => {
  it.concurrent('テスト1', async () => { /* ... */ });
  it.concurrent('テスト2', async () => { /* ... */ });
  it.concurrent('テスト3', async () => { /* ... */ });
});
```

### 2. セットアップの最適化

```typescript
// 重い初期化は describe レベルで実行
describe('最適化されたテスト群', () => {
  let sharedResource: ExpensiveResource;
  
  beforeAll(async () => {
    sharedResource = await createExpensiveResource();
  });
  
  beforeEach(async () => {
    // 軽量なリセット処理のみ
    await sharedResource.reset();
  });
});
```

### 3. メモリ使用量の監視

```typescript
it('メモリ使用量の確認', async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // 大量データの処理
  await processLargeDataset();
  
  // ガベージコレクションを促進
  if (global.gc) global.gc();
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;
  
  // メモリリークの検出
  expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB以内
});
```

このWorker層直接テストにより、HierarchiDBの核心機能を高速かつ確実に検証し、開発効率と品質の両立を実現しています。
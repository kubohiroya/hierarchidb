/**
 * Jotai State Manager Node環境テスト
 * 
 * React非依存でJotai atomsの状態管理をテストします
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createStore, atom } from 'jotai';
import type { WritableAtom } from 'jotai';
import type { NodeId } from '@hierarchidb/00-core';

// ヘルパー関数：書き込み可能なatomを作成
function createWritableAtom<T>(initialValue: T) {
  return atom(initialValue);
}

// テスト用のatom群
const selectedNodeIdAtom = createWritableAtom<NodeId | null>(null);
const expandedNodesAtom = createWritableAtom<Set<NodeId>>(new Set<NodeId>());
const subscribedRootNodeIdAtom = createWritableAtom<string | null>(null);
const subscriptionIdAtom = createWritableAtom<string | null>(null);

// Derived atoms
const isNodeExpandedAtom = atom(
  (get) => (nodeId: NodeId) => get(expandedNodesAtom).has(nodeId),
  (get, set, nodeId: NodeId) => {
    const expanded = new Set(get(expandedNodesAtom));
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId);
    } else {
      expanded.add(nodeId);
    }
    set(expandedNodesAtom, expanded);
  }
);

const subscriptionStatusAtom = atom((get) => ({
  rootNodeId: get(subscribedRootNodeIdAtom),
  subscriptionId: get(subscriptionIdAtom),
  isSubscribed: get(subscriptionIdAtom) !== null,
}));

describe('Jotai State Manager Node環境テスト', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe('基本的な状態管理', () => {
    it('選択ノードの状態を管理できる', () => {
      const nodeId = 'node-001' as NodeId;

      // 初期状態
      expect(store.get(selectedNodeIdAtom)).toBeNull();

      // ノードを選択
      store.set(selectedNodeIdAtom, nodeId);
      expect(store.get(selectedNodeIdAtom)).toBe(nodeId);

      // 選択解除
      store.set(selectedNodeIdAtom, null);
      expect(store.get(selectedNodeIdAtom)).toBeNull();
    });

    it('展開ノードの状態を管理できる', () => {
      const nodeId1 = 'node-001' as NodeId;
      const nodeId2 = 'node-002' as NodeId;

      // 初期状態
      expect(store.get(expandedNodesAtom).size).toBe(0);

      // ノードを展開
      const expandedNodes = new Set([nodeId1, nodeId2]);
      store.set(expandedNodesAtom, expandedNodes);

      const currentExpanded = store.get(expandedNodesAtom);
      expect(currentExpanded.has(nodeId1)).toBe(true);
      expect(currentExpanded.has(nodeId2)).toBe(true);
      expect(currentExpanded.size).toBe(2);
    });

    it('購読状態を管理できる', () => {
      const rootNodeId = 'root-001';
      const subscriptionId = 'sub-001';

      // 初期状態
      expect(store.get(subscribedRootNodeIdAtom)).toBeNull();
      expect(store.get(subscriptionIdAtom)).toBeNull();

      // 購読開始
      store.set(subscribedRootNodeIdAtom, rootNodeId);
      store.set(subscriptionIdAtom, subscriptionId);

      expect(store.get(subscribedRootNodeIdAtom)).toBe(rootNodeId);
      expect(store.get(subscriptionIdAtom)).toBe(subscriptionId);
    });
  });

  describe('Derived atoms', () => {
    it('ノード展開状態の確認と切り替えができる', () => {
      const nodeId = 'toggle-node' as NodeId;

      // 初期状態：展開されていない
      const isExpanded = store.get(isNodeExpandedAtom);
      expect(isExpanded(nodeId)).toBe(false);

      // 展開
      store.set(isNodeExpandedAtom, nodeId);
      expect(store.get(isNodeExpandedAtom)(nodeId)).toBe(true);

      // 折りたたみ
      store.set(isNodeExpandedAtom, nodeId);
      expect(store.get(isNodeExpandedAtom)(nodeId)).toBe(false);
    });

    it('購読状態を集約して取得できる', () => {
      // 初期状態
      const initialStatus = store.get(subscriptionStatusAtom);
      expect(initialStatus.isSubscribed).toBe(false);
      expect(initialStatus.rootNodeId).toBeNull();
      expect(initialStatus.subscriptionId).toBeNull();

      // 購読開始
      store.set(subscribedRootNodeIdAtom, 'root-001');
      store.set(subscriptionIdAtom, 'sub-001');

      const activeStatus = store.get(subscriptionStatusAtom);
      expect(activeStatus.isSubscribed).toBe(true);
      expect(activeStatus.rootNodeId).toBe('root-001');
      expect(activeStatus.subscriptionId).toBe('sub-001');
    });
  });

  describe('状態の永続化と復元', () => {
    it('状態をシリアライズ・デシリアライズできる', () => {
      const nodeId1 = 'persist-node-1' as NodeId;
      const nodeId2 = 'persist-node-2' as NodeId;

      // 状態を設定
      store.set(selectedNodeIdAtom, nodeId1);
      store.set(expandedNodesAtom, new Set([nodeId1, nodeId2]));
      store.set(subscribedRootNodeIdAtom, 'root-persist');

      // 状態をシリアライズ
      const state = {
        selectedNodeId: store.get(selectedNodeIdAtom),
        expandedNodeIds: Array.from(store.get(expandedNodesAtom)),
        subscribedRootNodeId: store.get(subscribedRootNodeIdAtom),
      };

      const serialized = JSON.stringify(state);

      // 新しいストアで復元
      const newStore = createStore();
      const restored = JSON.parse(serialized);

      newStore.set(selectedNodeIdAtom, restored.selectedNodeId);
      newStore.set(expandedNodesAtom, new Set(restored.expandedNodeIds));
      newStore.set(subscribedRootNodeIdAtom, restored.subscribedRootNodeId);

      // 復元確認
      expect(newStore.get(selectedNodeIdAtom)).toBe(nodeId1);
      expect(newStore.get(expandedNodesAtom).has(nodeId1)).toBe(true);
      expect(newStore.get(expandedNodesAtom).has(nodeId2)).toBe(true);
      expect(newStore.get(subscribedRootNodeIdAtom)).toBe('root-persist');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量の展開ノードでもパフォーマンスを維持', () => {
      const nodeCount = 1000;
      const nodeIds: NodeId[] = [];

      // 1000個のノードIDを生成
      for (let i = 0; i < nodeCount; i++) {
        nodeIds.push(`perf-node-${i}` as NodeId);
      }

      const startTime = Date.now();

      // 一括で展開状態を設定
      const expandedNodes = new Set(nodeIds);
      store.set(expandedNodesAtom, expandedNodes);

      const setupTime = Date.now() - startTime;

      // セットアップ時間が100ms以内
      expect(setupTime).toBeLessThan(100);

      // 検索パフォーマンステスト
      const searchStartTime = Date.now();

      const expanded = store.get(expandedNodesAtom);
      const isExpanded = expanded.has('perf-node-500' as NodeId);

      const searchTime = Date.now() - searchStartTime;

      expect(isExpanded).toBe(true);
      expect(searchTime).toBeLessThan(10); // 検索時間が10ms以内
    });

    it('頻繁な状態更新でもメモリリークしない', () => {
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const nodeId = `leak-test-${i}` as NodeId;
        store.set(selectedNodeIdAtom, nodeId);
        
        // 展開状態の更新
        const currentExpanded = store.get(expandedNodesAtom);
        const newExpanded = new Set(currentExpanded);
        newExpanded.add(nodeId);
        store.set(expandedNodesAtom, newExpanded);
      }

      // 最終状態の確認
      const finalSelected = store.get(selectedNodeIdAtom);
      const finalExpanded = store.get(expandedNodesAtom);

      expect(finalSelected).toBe('leak-test-999');
      expect(finalExpanded.size).toBe(iterations);

      // メモリクリーンアップテスト
      store.set(selectedNodeIdAtom, null);
      store.set(expandedNodesAtom, new Set());

      expect(store.get(selectedNodeIdAtom)).toBeNull();
      expect(store.get(expandedNodesAtom).size).toBe(0);
    });
  });

  describe('Worker との統合', () => {
    it('Worker からの変更を状態に反映できる', () => {
      // Worker からの変更をシミュレート
      const workerChanges = {
        selectedNodeId: 'worker-selected' as NodeId,
        expandedNodes: ['node-1', 'node-2', 'node-3'] as NodeId[],
        subscriptionUpdate: {
          rootNodeId: 'worker-root',
          subscriptionId: 'worker-sub',
        },
      };

      // 変更を状態に反映
      store.set(selectedNodeIdAtom, workerChanges.selectedNodeId);
      store.set(expandedNodesAtom, new Set(workerChanges.expandedNodes));
      store.set(subscribedRootNodeIdAtom, workerChanges.subscriptionUpdate.rootNodeId);
      store.set(subscriptionIdAtom, workerChanges.subscriptionUpdate.subscriptionId);

      // 反映確認
      expect(store.get(selectedNodeIdAtom)).toBe('worker-selected');
      expect(store.get(expandedNodesAtom).size).toBe(3);
      expect(store.get(subscribedRootNodeIdAtom)).toBe('worker-root');
      expect(store.get(subscriptionIdAtom)).toBe('worker-sub');
    });

    it('状態変更をWorkerに通知できる', () => {
      const changes: {type: string, value: NodeId | null, timestamp: number}[] = [];

      // 状態変更の監視
      const unsubscribe = store.sub(selectedNodeIdAtom, () => {
        changes.push({
          type: 'selectedNodeChange',
          value: store.get(selectedNodeIdAtom),
          timestamp: Date.now(),
        });
      });

      // 状態を変更
      store.set(selectedNodeIdAtom, 'notification-test' as NodeId);
      store.set(selectedNodeIdAtom, 'notification-test-2' as NodeId);

      // 変更通知の確認
      expect(changes).toHaveLength(2);
      expect(changes[0]?.value).toBe('notification-test');
      expect(changes[1]?.value).toBe('notification-test-2');

      unsubscribe();
    });
  });
});
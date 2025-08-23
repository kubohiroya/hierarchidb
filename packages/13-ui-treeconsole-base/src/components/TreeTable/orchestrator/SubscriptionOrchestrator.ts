/**
 * SubscriptionOrchestrator
 *
 * SubTree購読に関するユーザーストーリーの管理
 * - Worker購読管理
 * - リアルタイム更新処理
 * - バッチング最適化
 */

import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/00-core';
import type { TreeNode } from '@hierarchidb/00-core';
import type { WorkerAPI } from '@hierarchidb/01-api';
import {
  subscribedRootNodeIdAtom,
  subscriptionIdAtom,
  subscriptionDepthAtom,
  lastUpdateTimestampAtom,
  pendingUpdatesAtom,
  tableDataAtom,
} from '../state';

/**
 * SubTree変更の型定義
 */
export interface SubTreeChanges {
  added?: TreeNode[];
  updated?: Array<{
    nodeId: string;
    changes: Partial<TreeNode>;
  }>;
  removed?: string[];
  moved?: Array<{
    nodeId: string;
    oldParentId: string;
    newParentId: string;
    oldIndex: number;
    newIndex: number;
  }>;
  timestamp: number;
  version?: number;
}

export interface SubscriptionOrchestratorResult {
  // State
  isSubscribed: boolean;
  subscribedRootNodeId: string | null;
  lastUpdateTimestamp: number;
  pendingUpdatesCount: number;

  // Actions
  subscribe: (rootNodeId: string, depth?: number) => Promise<void>;
  unsubscribe: () => Promise<void>;
  processPendingUpdates: () => void;
}

/**
 * SubTree購読のオーケストレーター
 */
export function useSubscriptionOrchestrator(
  workerAPI: WorkerAPI
): SubscriptionOrchestratorResult {
  // State atoms
  const [subscribedRootNodeId, setSubscribedRootNodeId] = useAtom(subscribedRootNodeIdAtom);
  const [subscriptionId, setSubscriptionId] = useAtom(subscriptionIdAtom);
  const [_subscriptionDepth] = useAtom(subscriptionDepthAtom);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useAtom(lastUpdateTimestampAtom);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);
  const [tableData, setTableData] = useAtom(tableDataAtom);

  // Refs for batching
  const updateBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);

  /**
   * 更新のマージ処理
   */
  const mergeUpdates = useCallback(
    (updates: SubTreeChanges[]): TreeNode[] => {
      let mergedData = [...tableData];

      updates.forEach((update) => {
        // 追加
        if (update.added) {
          const existingIds = new Set(mergedData.map((n) => n.id));
          const newNodes = update.added.filter((n) => !existingIds.has(n.id));
          mergedData = [...mergedData, ...newNodes];
        }

        // 更新
        if (update.updated) {
          update.updated.forEach(({ nodeId, changes }) => {
            const index = mergedData.findIndex((node) => node.id === nodeId);
            if (index !== -1) {
              mergedData[index] = { ...mergedData[index], ...changes } as TreeNode;
            }
          });
        }

        // 削除
        if (update.removed) {
          const removedSet = new Set(update.removed);
          mergedData = mergedData.filter((node) => !removedSet.has(node.id!));
        }

        // 移動
        if (update.moved) {
          update.moved.forEach((move) => {
            const node = mergedData.find((n) => n.id === move.nodeId);
            if (node) {
              node.parentNodeId = move.newParentId as NodeId;
              // TODO: 順序の更新も実装
            }
          });
        }
      });

      return mergedData;
    },
    [tableData]
  );

  /**
   * SubTree更新ハンドラー
   */
  const handleSubTreeUpdate = useCallback(
    (changes: SubTreeChanges) => {
      // タイムスタンプ更新
      setLastUpdateTimestamp(changes.timestamp);

      // バッチング: 100ms以内の更新をまとめる
      setPendingUpdates((prev) => [...prev, changes]);

      if (updateBatchTimerRef.current) {
        clearTimeout(updateBatchTimerRef.current);
      }

      updateBatchTimerRef.current = setTimeout(() => {
        processPendingUpdates();
      }, 100);
    },
    [setLastUpdateTimestamp, setPendingUpdates]
  );

  /**
   * 保留中の更新を処理
   */
  const processPendingUpdates = useCallback(() => {
    setPendingUpdates((pending) => {
      if (pending.length === 0) return [];

      // すべての更新をマージして適用
      const mergedData = mergeUpdates(pending);
      setTableData(mergedData);

      return []; // 保留をクリア
    });

    if (updateBatchTimerRef.current) {
      clearTimeout(updateBatchTimerRef.current);
      updateBatchTimerRef.current = null;
    }
  }, [setPendingUpdates, mergeUpdates, setTableData]);

  /**
   * SubTree購読開始
   */
  const subscribe = useCallback(
    async (rootNodeId: string, _depth: number = 2) => {
      // 既存の購読があれば解除
      if (subscriptionRef.current) {
        await unsubscribe();
      }

      try {
        // WorkerAPIを通じて購読
        const subscriptionAPI = await workerAPI.getSubscriptionAPI();
        const subscription = await subscriptionAPI.subscribeSubtree(
          rootNodeId as NodeId,
          (event: any) => {
            // イベントタイプに応じて処理を分岐
            if (event.type === 'expanded') {
              console.log('Expanded changes:', event);
            } else {
              // SubTreeの変更を処理
              handleSubTreeUpdate(event as SubTreeChanges);
            }
          }
        );

        subscriptionRef.current = subscription;
        setSubscriptionId(rootNodeId); // 簡易的にrootNodeIdを使用
        setSubscribedRootNodeId(rootNodeId);
      } catch (error) {
        console.error('Failed to subscribe to subtree:', error);
      }
    },
    [workerAPI, handleSubTreeUpdate, setSubscriptionId, setSubscribedRootNodeId]
  );

  /**
   * SubTree購読解除
   */
  const unsubscribe = useCallback(async () => {
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current();
        subscriptionRef.current = null;
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
      }
    }

    // バッチタイマーをクリア
    if (updateBatchTimerRef.current) {
      clearTimeout(updateBatchTimerRef.current);
      updateBatchTimerRef.current = null;
    }

    // 保留中の更新を処理
    processPendingUpdates();

    // 状態をクリア
    setSubscriptionId(null);
    setSubscribedRootNodeId(null);
  }, [processPendingUpdates, setSubscriptionId, setSubscribedRootNodeId]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
      if (updateBatchTimerRef.current) {
        clearTimeout(updateBatchTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    isSubscribed: subscriptionId !== null,
    subscribedRootNodeId,
    lastUpdateTimestamp,
    pendingUpdatesCount: pendingUpdates.length,

    // Actions
    subscribe,
    unsubscribe,
    processPendingUpdates,
  };
}

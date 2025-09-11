/**
  * SubscriptionOrchestrator
  * SubTree
 * - Worker
 * -
 * -
  */

import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import {
  lastUpdateTimestampAtom,
  pendingUpdatesAtom,
  subscribedRootNodeIdAtom,
  subscriptionDepthAtom,
  subscriptionIdAtom,
  tableDataAtom,
} from '../state';

/**
  * SubTree
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
  * SubTree
  */
export function useSubscriptionOrchestrator(workerAPI: WorkerAPI): SubscriptionOrchestratorResult {
  // State atoms
  const [subscribedRootNodeId, setSubscribedRootNodeId] = useAtom(subscribedRootNodeIdAtom);
  const [subscriptionId, setSubscriptionId] = useAtom(subscriptionIdAtom);
  const [_subscriptionDepth] = useAtom(subscriptionDepthAtom);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useAtom(lastUpdateTimestampAtom);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);
  const [tableData, setTableData] = useAtom(tableDataAtom);

  // Refs for batching
  const updateBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRef = useRef<any>(null);

  /**
            */
  const mergeUpdates = useCallback(
    (updates: SubTreeChanges[]): TreeNode[] => {
      let mergedData = [...tableData];

      updates.forEach((update) => {
        if (update.added) {
          const existingIds = new Set(mergedData.map((n) => n.id));
          const newNodes = update.added.filter((n) => !existingIds.has(n.id));
          mergedData = [...mergedData, ...newNodes];
        }

        if (update.updated) {
          update.updated.forEach(({ nodeId, changes }) => {
            const index = mergedData.findIndex((node) => node.id === nodeId);
            if (index !== -1) {
              mergedData[index] = { ...mergedData[index], ...changes } as TreeNode;
            }
          });
        }

        if (update.removed) {
          const removedSet = new Set(update.removed);
          mergedData = mergedData.filter((node) => !removedSet.has(node.id!));
        }

        if (update.moved) {
          update.moved.forEach((move) => {
            const node = mergedData.find((n) => n.id === move.nodeId);
            if (node) {
              node.parentId = move.newParentId as NodeId;
            }
          });
        }
      });

      return mergedData;
    },
    [tableData],
  );

  /**
      * SubTree
      */
  const handleSubTreeUpdate = useCallback(
    (changes: SubTreeChanges) => {
      setLastUpdateTimestamp(changes.timestamp);

      //  : 100ms
      setPendingUpdates((prev) => [...prev, changes]);

      if (updateBatchTimerRef.current) {
        clearTimeout(updateBatchTimerRef.current);
      }

      updateBatchTimerRef.current = setTimeout(() => {
        processPendingUpdates();
      }, 100);
    },
    [setLastUpdateTimestamp, setPendingUpdates],
  );

  /**
            */
  const processPendingUpdates = useCallback(() => {
    setPendingUpdates((pending) => {
      if (pending.length === 0) return [];

      const mergedData = mergeUpdates(pending);
      setTableData(mergedData);

      return [];
    });

    if (updateBatchTimerRef.current) {
      clearTimeout(updateBatchTimerRef.current);
      updateBatchTimerRef.current = null;
    }
  }, [setPendingUpdates, mergeUpdates, setTableData]);

  /**
      * SubTree
      */
  const subscribe = useCallback(
    async (rootNodeId: string, _depth: number = 2) => {
      if (subscriptionRef.current) {
        await unsubscribe();
      }

      try {
        //  WorkerAPI
        const subscriptionAPI = await workerAPI.getSubscriptionAPI();
        const subscription = await subscriptionAPI.subscribeSubtree(
          rootNodeId as NodeId,
          (event: any) => {
            if (event.type === 'expanded') {
              console.log('Expanded changes:', event);
            } else {
              //  SubTree
              handleSubTreeUpdate(event as SubTreeChanges);
            }
          },
        );

        subscriptionRef.current = subscription;
        setSubscriptionId(rootNodeId); //  rootNodeId
        setSubscribedRootNodeId(rootNodeId);
      } catch (error) {
        console.error('Failed to subscribe to subtree:', error);
      }
    },
    [workerAPI, handleSubTreeUpdate, setSubscriptionId, setSubscribedRootNodeId],
  );

  /**
      * SubTree
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

    if (updateBatchTimerRef.current) {
      clearTimeout(updateBatchTimerRef.current);
      updateBatchTimerRef.current = null;
    }

    processPendingUpdates();

    setSubscriptionId(null);
    setSubscribedRootNodeId(null);
  }, [processPendingUpdates, setSubscriptionId, setSubscribedRootNodeId]);

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

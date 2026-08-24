import { type NodeId, toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeEvent } from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import type { SubTreeChanges } from '~/components/TreeTable/state/features/subscription.atoms';
import { lastUpdateTimestampAtom, pendingUpdatesAtom, subscribedRootNodeIdAtom, subscriptionDepthAtom, subscriptionIdAtom } from '~/components/TreeTable/state/features/subscription.atoms';
import { tableDataAtom } from '~/components/TreeTable/state/core/data.atoms';
import { sanitizeForComlink } from '../../../adapters/subscriptions/comlinkSanitizer.js';
import { coalesceBatches } from './mergeUtils.js';

const BATCH_DELAY_MS = 100;

const ensureArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const toMetadata = (value: unknown): { name: string; description: string; tags: string[] } => {
  if (typeof value === 'object' && value !== null) {
    const metadata = value as { name?: unknown; description?: unknown; tags?: unknown };
    return {
      name: typeof metadata.name === 'string' ? metadata.name : '',
      description: typeof metadata.description === 'string' ? metadata.description : '',
      tags: ensureArray(metadata.tags),
    };
  }
  return { name: '', description: '', tags: [] };
};

const toTreeNodeFromRecord = (
  raw: { [key: string]: unknown; id: string },
  fallback: TreeNode | undefined
): TreeNode => ({
  id: String(raw.id) as NodeId,
  parentId:
    typeof raw.parentId === 'string'
      ? toNodeId(raw.parentId)
      : (fallback?.parentId ?? toNodeId('')),
  nodeType:
    typeof raw.nodeType === 'string'
      ? toNodeType(raw.nodeType)
      : (fallback?.nodeType ?? toNodeType('folder')),
  depth: toNumber(raw.depth, fallback?.depth ?? 1),
  createdAt: toNumber(raw.createdAt, fallback?.createdAt ?? Date.now()),
  updatedAt: toNumber(raw.updatedAt, fallback?.updatedAt ?? Date.now()),
  version: toNumber(raw.version, fallback?.version ?? 0),
  metadata: {
    ...toMetadata(fallback?.metadata),
    ...toMetadata(raw.metadata),
  },
  draftMetadata: fallback?.draftMetadata ?? null,
  data: fallback?.data ?? null,
  visible: typeof raw.visible === 'boolean' ? raw.visible : (fallback?.visible ?? true),
  ...(raw.hasChildren === undefined ? {} : { hasChildren: Boolean(raw.hasChildren) }),
  ...(typeof raw.children === 'object' && Array.isArray(raw.children)
    ? { children: raw.children as NodeId[] }
    : {}),
  ...(raw.originalName === undefined ? {} : { originalName: String(raw.originalName) }),
  ...(raw.originalParentId === undefined
    ? {}
    : { originalParentId: String(raw.originalParentId) as NodeId }),
  ...(raw.removedAt === undefined
    ? {}
    : { removedAt: toNumber(raw.removedAt, fallback?.removedAt ?? Date.now()) }),
  ...(raw.lastTouchedAt === undefined
    ? {}
    : { lastTouchedAt: toNumber(raw.lastTouchedAt, fallback?.lastTouchedAt ?? Date.now()) }),
  ...(typeof raw.map === 'object' && raw.map !== null ? { map: raw.map as TreeNode['map'] } : {}),
  ...(typeof raw.references === 'object' && raw.references !== null
    ? { references: raw.references as NodeId[] }
    : {}),
  ...(raw.descendantCount === undefined
    ? {}
    : { descendantCount: toNumber(raw.descendantCount, fallback?.descendantCount ?? 0) }),
  ...(raw.isEstimated === undefined ? {} : { isEstimated: Boolean(raw.isEstimated) }),
});

/**
 * SubTree
 */
// SubTreeChanges type is provided by atoms/features to avoid duplication

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
export function useSubscriptionOrchestrator<T>(
  workerAPI: WorkerAPI<T>
): SubscriptionOrchestratorResult {
  // State atoms
  const [subscribedRootNodeId, setSubscribedRootNodeId] = useAtom(subscribedRootNodeIdAtom);
  const [subscriptionId, setSubscriptionId] = useAtom(subscriptionIdAtom);
  const [_subscriptionDepth] = useAtom(subscriptionDepthAtom);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useAtom(lastUpdateTimestampAtom);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);
  const [tableData, setTableData] = useAtom(tableDataAtom);

  // Refs for batching
  const updateBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds an unsubscribe function returned by subscription API
  const subscriptionRef = useRef<(() => void) | null>(null);

  /**
   */
  const mergeUpdates = useCallback(
    (updates: SubTreeChanges[]): TreeNode[] => {
      let mergedData = [...tableData];

      updates.forEach((update) => {
        console.log('[TreeConsole][Subscription] merge update', {
          added: update.added?.length ?? 0,
          updated: update.updated?.length ?? 0,
          removed: update.removed?.length ?? 0,
          moved: update.moved?.length ?? 0,
        });
        const idxMap = new Map(mergedData.map((n, i) => [n.id, i] as const));

        if (update.removed?.length) {
          const removed = new Set(update.removed);
          mergedData = mergedData.filter((n) => !removed.has(n.id));
          for (const id of removed) idxMap.delete(id as NodeId);
        }

        if (update.added?.length) {
          for (const n of update.added) {
            const id = n.id as NodeId;
            const i = idxMap.get(id);
            const flat = toTreeNodeFromRecord(n, i != null ? tableData[i] : undefined);
            if (i != null) mergedData[i] = { ...mergedData[i], ...flat } as TreeNode;
            else {
              mergedData.push(flat);
              idxMap.set(id, mergedData.length - 1);
            }
          }
        }

        if (update.updated?.length) {
          for (const { nodeId, changes } of update.updated) {
            const i = idxMap.get(nodeId as NodeId);
            if (i != null)
              mergedData[i] = { ...mergedData[i], ...(changes as Partial<TreeNode>) } as TreeNode;
          }
        }

        if (update.moved?.length) {
          for (const move of update.moved) {
            const i = idxMap.get(move.nodeId as NodeId);
            if (i != null) {
              mergedData[i] = {
                ...mergedData[i],
                parentId: move.newParentId as NodeId,
              } as TreeNode;
            }
          }
        }
      });

      return mergedData;
    },
    [tableData]
  );

  /**
   * SubTree
   */
  const processPendingUpdates = useCallback(() => {
    const t0 = performance.now?.() ?? Date.now();
    setPendingUpdates((pending) => {
      if (pending.length === 0) return [];
      const batch = coalesceBatches(pending);
      const mergedData = mergeUpdates([batch]);
      setTableData(mergedData);
      console.log('[TreeConsole][Subscription] processed build', {
        pendingCount: pending.length,
        mergedLength: mergedData.length,
      });

      const dt = (performance.now?.() ?? Date.now()) - t0;
      if (pending.length > 200 || dt > 200) {
        console.warn('[Subscription] heavy build', { count: pending.length, ms: Math.round(dt) });
      }

      return [];
    });

    if (updateBuildTimerRef.current) {
      clearTimeout(updateBuildTimerRef.current);
      updateBuildTimerRef.current = null;
    }
  }, [setPendingUpdates, mergeUpdates, setTableData]);

  /**
   * SubTree
   */
  // Forward declaration binding with function expression below
  let scheduleProcess: () => void;

  scheduleProcess = useCallback(() => {
    if (updateBuildTimerRef.current) {
      clearTimeout(updateBuildTimerRef.current);
    }
    updateBuildTimerRef.current = setTimeout(() => {
      processPendingUpdates();
    }, BATCH_DELAY_MS);
  }, [processPendingUpdates]);

  const handleSubTreeUpdate = useCallback(
    (changes: SubTreeChanges) => {
      console.log('[TreeConsole][Subscription] enqueue build', {
        added: changes.added?.length ?? 0,
        updated: changes.updated?.length ?? 0,
        removed: changes.removed?.length ?? 0,
        moved: changes.moved?.length ?? 0,
      });
      setLastUpdateTimestamp(Date.now());
      setPendingUpdates((prev) => [...prev, changes]);
      scheduleProcess();
    },
    [setLastUpdateTimestamp, setPendingUpdates, scheduleProcess]
  );

  /**
   */

  /**
   * SubTree
   */
  const subscribe = useCallback(
    async (rootNodeId: string, depth: number = 2) => {
      if (subscriptionRef.current) {
        await unsubscribe();
      }

      try {
        // Reset table data and pending queue before new subscription
        setTableData([]);
        setPendingUpdates([]);
        console.log('[TreeConsole][Subscription] subscribing', { rootNodeId, depth });
        //  WorkerAPI
        const subscriptionAPI = await workerAPI.getSubscriptionAPI();
        const proxied = (await import('comlink')).proxy((event: TreeNodeEvent) => {
          const safeEvent = sanitizeForComlink(event);
          const safeNode = (safeEvent.node as Record<string, unknown> | undefined) ?? undefined;
          console.log('[TreeConsole][Subscription] event received', {
            type: safeEvent.type,
            nodeId: safeEvent.nodeId,
            hasNode: Boolean(safeNode),
            keys: safeNode ? Object.keys(safeNode) : [],
          });
          // Map a single node event to our local SubTreeChanges build form
          const batch: SubTreeChanges = (() => {
            switch (safeEvent.type) {
              case 'created':
                return {
                  added: [Object.assign({ id: safeEvent.nodeId }, safeNode || {})],
                };
              case 'updated': {
                const payload = safeNode || {};
                const base = { nodeId: safeEvent.nodeId as string, changes: payload };
                // Treat prefetch snapshot events (delivered as "updated" with node payload)
                // as additions when we have no existing row.
                const added =
                  Object.keys(payload).length > 0
                    ? [Object.assign({ id: safeEvent.nodeId }, payload)]
                    : undefined;
                return {
                  updated: [base],
                  ...(added ? { added } : {}),
                };
              }
              case 'deleted':
                return { removed: [safeEvent.nodeId as string] };
              case 'moved':
                return {
                  moved: [
                    {
                      nodeId: safeEvent.nodeId as string,
                      oldParentId: safeEvent.previousParentNodeId as string | undefined,
                      newParentId: safeEvent.parentId as string,
                      oldIndex: -1,
                      newIndex: -1,
                    },
                  ],
                };
              default:
                return {};
            }
          })();
          if (
            batch &&
            (batch.added?.length ||
              batch.updated?.length ||
              batch.removed?.length ||
              batch.moved?.length)
          ) {
            handleSubTreeUpdate(batch);
          }
        });
        const subscriptionId = await subscriptionAPI.subscribeSubtree(
          rootNodeId as NodeId,
          proxied,
          depth != null && depth > 0
            ? {
                prefetch: { depth },
              }
            : undefined
        );
        console.log('[TreeConsole][Subscription] subscribed', {
          rootNodeId,
          subscriptionId,
          depth,
        });
        subscriptionRef.current = () => {
          void subscriptionAPI.unsubscribe(subscriptionId);
        };
        setSubscriptionId(rootNodeId); //  rootNodeId
        setSubscribedRootNodeId(rootNodeId);
      } catch (error) {
        console.error('Failed to subscribe to subtree:', error);
      }
    },
    [
      workerAPI,
      handleSubTreeUpdate,
      setSubscriptionId,
      setSubscribedRootNodeId,
      setTableData,
      setPendingUpdates,
    ]
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

    if (updateBuildTimerRef.current) {
      clearTimeout(updateBuildTimerRef.current);
      updateBuildTimerRef.current = null;
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
      if (updateBuildTimerRef.current) {
        clearTimeout(updateBuildTimerRef.current);
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

/**
 * TreeConsole subscription hook.
 *
 * Manages live worker subscriptions and keeps the SSOT snapshots updated
 * when change events stream in from the runtime-worker.
 */

import type { BuildWorkerAPI } from '~/types/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useCallback, useEffect, useRef } from 'react';
import { Subscriptions } from '~/hooks/SubscriptionServices';
import { sanitizeForComlink } from '~/utils/comlinkSanitizer';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms';
import { buildVisibleRows, removeNodeAndDescendants } from '~/state/treeconsole.derive';
import type { LoadChildrenOf } from './types.js';

interface Params {
  client: Remote<BuildWorkerAPI> | undefined;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
  ssot: TreeConsoleSSOTEntry;
  expandedIds: NodeId[];
  loadChildrenOf: LoadChildrenOf;
}

export function useTreeConsoleSubscription({
  client,
  setSSOT,
  ssot,
  expandedIds,
  loadChildrenOf,
}: Params) {
  const refreshTimerRef = useRef<number | null>(null);
  const nodeIndexRef = useRef<DualKeyMap<NodeId, NodeId, TreeNode>>(
    ssot.nodeIndex ? ssot.nodeIndex.clone() : new DualKeyMap<NodeId, NodeId, TreeNode>()
  );
  const expandedIdsRef = useRef(expandedIds);
  const loadChildrenOfRef = useRef(loadChildrenOf);
  const setSSOTRef = useRef(setSSOT);

  useEffect(() => {
    if (ssot.nodeIndex) {
      nodeIndexRef.current = ssot.nodeIndex.clone();
    }
  }, [ssot.nodeIndex]);

  useEffect(() => {
    expandedIdsRef.current = expandedIds;
  }, [expandedIds]);

  useEffect(() => {
    loadChildrenOfRef.current = loadChildrenOf;
  }, [loadChildrenOf]);

  useEffect(() => {
    setSSOTRef.current = setSSOT;
  }, [setSSOT]);

  const teardownSubscription = useCallback(
    async (rootId?: NodeId) => {
      if (!client || !rootId) return;
      await Subscriptions.release('page', client, rootId);
    },
    [client]
  );

  const setupSubscription = useCallback(
    async (rootId: NodeId) => {
      if (!client || !rootId) return;

      const debugEnabled = (() => {
        try {
          const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
            .env;
          return env?.VITE_SUBSCRIPTION_DEBUG === '1';
        } catch {
          return false;
        }
      })();

      if (debugEnabled) {
        console.log('[TreeConsole][Subscription] setup start', {
          rootId: String(rootId),
          expandedIds: expandedIdsRef.current.map((id) => String(id)),
        });
      }

      const requestRefresh = () => {
        if (refreshTimerRef.current !== null) return;
        refreshTimerRef.current = window.setTimeout(() => {
          refreshTimerRef.current = null;
          void loadChildrenOfRef.current(rootId);
        }, 60);
      };

      const cb = comlinkProxy((event: unknown) => {
        try {
          const safeEvent = sanitizeForComlink(event);
          if (
            typeof import.meta !== 'undefined' &&
            (import.meta as unknown as { env?: Record<string, string> }).env
              ?.VITE_SUBSCRIPTION_DEBUG === '1'
          ) {
            console.log('[Subscription][page] event', safeEvent);
          }

          type Ev = {
            type: 'created' | 'updated' | 'deleted' | 'moved';
            nodeId: string;
            node?: TreeNode;
            parentId?: string;
            previousParentNodeId?: string;
          };

          const ev = safeEvent as Ev;
          const index = nodeIndexRef.current.clone();

          if (ev.type === 'created' && ev.node) {
            index.set(
              String(ev.node.id) as NodeId,
              ev.node,
              String(ev.node.parentId ?? '') as NodeId
            );
          } else if (ev.type === 'updated' && ev.node) {
            const nodeKey = String(ev.node.id) as NodeId;
            const prev = index.get(nodeKey);
            const merged: TreeNode = {
              ...(prev || ({} as TreeNode)),
              ...(ev.node as TreeNode),
            };
            const parentKey = String(ev.node.parentId ?? prev?.parentId ?? '') as NodeId;
            index.set(nodeKey, merged, parentKey);
          } else if (ev.type === 'deleted') {
            removeNodeAndDescendants(index, String(ev.nodeId) as NodeId);
          } else if (ev.type === 'moved' && ev.node) {
            const nodeKey = String(ev.node.id) as NodeId;
            const prev = index.get(nodeKey);
            const merged: TreeNode = {
              ...(prev || ({} as TreeNode)),
              ...(ev.node as TreeNode),
            };
            const parentKey = String(
              ev.parentId ?? ev.node.parentId ?? prev?.parentId ?? ''
            ) as NodeId;
            index.set(nodeKey, merged, parentKey);
          } else {
            requestRefresh();
            return;
          }

          buildVisibleRows(rootId as NodeId, index, expandedIdsRef.current);
          setSSOTRef.current({ nodeIndex: index });
          nodeIndexRef.current = index;
        } catch (error) {
          console.warn('[Subscription][page] event handler failed, scheduling refresh', error);
          requestRefresh();
        }
      });

      const existing = Subscriptions.getActive('page', rootId);
      if (existing) return;

      const { subId, created } = await Subscriptions.subscribe('page', client, rootId, cb);
      if (debugEnabled) {
        if (created) {
          console.log('[TreeConsole][Subscription] subscribed', { rootId: String(rootId), subId });
        } else {
          console.log('[TreeConsole][Subscription] reused existing subscription', {
            rootId: String(rootId),
            subId,
          });
        }
      }
    },
    [client]
  );

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  return { setupSubscription, teardownSubscription };
}

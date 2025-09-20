/**
 * TreeConsole subscription hook.
 *
 * Manages live worker subscriptions and keeps the SSOT snapshots updated
 * when change events stream in from the runtime.
 */

import { useCallback, useEffect, useRef } from 'react';
import { proxy as comlinkProxy } from 'comlink';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { Subscriptions } from '~/subscriptions/controller.js';
import { buildVisibleRows, rebuildAdjacency } from '~/state/treeconsole.derive.js';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';

interface Params {
  client: Remote<WorkerAPI> | undefined;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
  ssot: TreeConsoleSSOTEntry;
  expandedIds: NodeId[];
  applySortFilterSearch: (nodes: TreeNodeData[], overrideTerm?: string) => TreeNodeData[];
  loadChildrenOf: (parentId: NodeId) => Promise<void>;
}

export function useTreeConsoleSubscription({
  client,
  setSSOT,
  ssot,
  expandedIds,
  applySortFilterSearch,
  loadChildrenOf,
}: Params) {
  const refreshTimerRef = useRef<number | null>(null);
  const nodesByIdRef = useRef<Map<string, TreeNode>>(ssot.nodesById ?? new Map<string, TreeNode>());
  const childrenByParentRef = useRef<Map<string, Set<string>>>(
    ssot.childrenByParent ?? new Map<string, Set<string>>(),
  );
  const expandedIdsRef = useRef(expandedIds);
  const applySortFilterSearchRef = useRef(applySortFilterSearch);
  const loadChildrenOfRef = useRef(loadChildrenOf);
  const setSSOTRef = useRef(setSSOT);

  useEffect(() => {
    if (ssot.nodesById) {
      nodesByIdRef.current = ssot.nodesById;
    }
    if (ssot.childrenByParent) {
      childrenByParentRef.current = ssot.childrenByParent;
    }
  }, [ssot.childrenByParent, ssot.nodesById]);

  useEffect(() => {
    expandedIdsRef.current = expandedIds;
  }, [expandedIds]);

  useEffect(() => {
    applySortFilterSearchRef.current = applySortFilterSearch;
  }, [applySortFilterSearch]);

  useEffect(() => {
    loadChildrenOfRef.current = loadChildrenOf;
  }, [loadChildrenOf]);

  useEffect(() => {
    setSSOTRef.current = setSSOT;
  }, [setSSOT]);

  const teardownSubscription = useCallback(async (rootId?: NodeId) => {
    if (!client || !rootId) return;
    await Subscriptions.release('page', client, rootId);
  }, [client]);

  const setupSubscription = useCallback(async (rootId: NodeId) => {
    if (!client || !rootId) return;

    const requestRefresh = () => {
      if (refreshTimerRef.current !== null) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadChildrenOfRef.current(rootId);
      }, 60);
    };

    const cb = comlinkProxy((event: unknown) => {
      try {
        if (
          typeof import.meta !== 'undefined' &&
          (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUBSCRIPTION_DEBUG === '1'
        ) {
          console.log('[Subscription][page] event', event);
        }

        type Ev = {
          type: 'created' | 'updated' | 'deleted' | 'moved';
          nodeId: string;
          node?: TreeNode;
          parentId?: string;
          previousParentNodeId?: string;
        };

        const ev = event as Ev;
        const nodesById = new Map<string, TreeNode>(nodesByIdRef.current);
        const childrenByParent = new Map<string, Set<string>>(
          Array.from(childrenByParentRef.current.entries()).map(([key, set]) => [key, new Set(set)]),
        );

          if (ev.type === 'created' && ev.node) {
            nodesById.set(String(ev.node.id), ev.node);
            if (ev.node.parentId) {
              const pid = String(ev.node.parentId);
              const cur = childrenByParent.get(pid) || new Set<string>();
              if (!cur.has(String(ev.node.id))) {
                const next = new Set(cur);
                next.add(String(ev.node.id));
                childrenByParent.set(pid, next);
              }
            }
          } else if (ev.type === 'updated' && ev.node) {
            const prev = nodesById.get(String(ev.node.id));
            nodesById.set(String(ev.node.id), { ...(prev || ({} as TreeNode)), ...(ev.node as TreeNode) });
          } else if (ev.type === 'deleted') {
            const stack: string[] = [String(ev.nodeId)];
            const toRemove = new Set<string>();
            while (stack.length) {
              const id = stack.pop()!;
              if (toRemove.has(id)) continue;
              toRemove.add(id);
              const ch = childrenByParent.get(id);
              if (ch) for (const cid of ch) stack.push(cid);
            }
            for (const id of toRemove) {
              const node = nodesById.get(id);
              if (node?.parentId) {
                const pid = String(node.parentId);
                const cur = childrenByParent.get(pid);
                if (cur && cur.has(id)) {
                  const next = new Set(cur);
                  next.delete(id);
                  childrenByParent.set(pid, next);
                }
              }
              childrenByParent.delete(id);
              nodesById.delete(id);
            }
          } else if (ev.type === 'moved' && ev.node) {
            const prev = nodesById.get(String(ev.node.id));
            nodesById.set(String(ev.node.id), { ...(prev || ({} as TreeNode)), ...(ev.node as TreeNode) });
            if (ev.previousParentNodeId) {
              const oldPid = String(ev.previousParentNodeId);
              const cur = childrenByParent.get(oldPid);
              if (cur && cur.has(String(ev.node.id))) {
                const next = new Set(cur);
                next.delete(String(ev.node.id));
                childrenByParent.set(oldPid, next);
              }
            }
            const newPid = String(ev.parentId || ev.node.parentId || '');
            if (newPid) {
              const cur = childrenByParent.get(newPid) || new Set<string>();
              if (!cur.has(String(ev.node.id))) {
                const next = new Set(cur);
                next.add(String(ev.node.id));
                childrenByParent.set(newPid, next);
              }
            }
          }

        const flat = buildVisibleRows(String(rootId), nodesById, childrenByParent, expandedIdsRef.current);
        setSSOTRef.current({ nodesById, childrenByParent, treeData: applySortFilterSearchRef.current(flat) });
        nodesByIdRef.current = nodesById;
        childrenByParentRef.current = childrenByParent;
      } catch (error) {
        console.warn('[Subscription][page] event handler failed, scheduling refresh', error);
        requestRefresh();
      }
    });

    const existing = Subscriptions.getActive('page', rootId);
    if (existing) return;

    const { subId, created } = await Subscriptions.subscribe('page', client, rootId, cb);
    if (created && subId && import.meta.env && import.meta.env.VITE_SUBSCRIPTION_DEBUG === '1') {
      console.log('[Subscription][page] subscribed', { rootId, subId });
    }
  }, [client]);

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

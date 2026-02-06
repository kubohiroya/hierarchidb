/**
 * TreeConsole breadcrumb hook.
 *
 * Resolves ancestor chains for the current page node and maintains
 * a truncated breadcrumb list suitable for rendering in the console.
 */

import type { WorkerAPI } from '~/types/worker-api.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { SubscriptionId, TreeNode } from '@hierarchidb/tree-api';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Params {
  client: Remote<WorkerAPI> | undefined;
  pageTreeNode?: TreeNode;
  /**
   * Optional override used mainly for tests to force breadcrumb truncation.
   */
  maxBreadcrumbItems?: number;
}

const DEFAULT_MAX_BREADCRUMBS = 20;

function resolveMaxBreadcrumbs(): number {
  try {
    const maybeEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    const raw = maybeEnv?.VITE_MAX_BREADCRUMB;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 3 ? parsed : DEFAULT_MAX_BREADCRUMBS;
  } catch {
    return DEFAULT_MAX_BREADCRUMBS;
  }
}

function normalizeMaxBreadcrumbOverride(value?: number): number | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.floor(value);
  return normalized > 3 ? normalized : undefined;
}

export function useTreeConsoleBreadcrumbs({
  client,
  pageTreeNode,
  maxBreadcrumbItems,
}: Params): BreadcrumbNode[] {
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbNode[]>([]);
  const subscriptionsRef = useRef<SubscriptionId[]>([]);
  const resolvedMaxBreadcrumbItems = useMemo(
    () => normalizeMaxBreadcrumbOverride(maxBreadcrumbItems) ?? resolveMaxBreadcrumbs(),
    [maxBreadcrumbItems]
  );

  useEffect(() => {
    let disposed = false;
    const activeSubs: SubscriptionId[] = [];
    subscriptionsRef.current = activeSubs;

    (async () => {
      try {
        if (!client || !pageTreeNode?.id) {
          setBreadcrumbItems([]);
          return;
        }

        const queryAPI = await client.getQueryAPI();
        const subscriptionAPI =
          typeof client.getSubscriptionAPI === 'function'
            ? await client.getSubscriptionAPI()
            : null;
        const ancestors: TreeNode[] = await queryAPI.listAncestors(pageTreeNode.id as NodeId);
        const parentMap = new Map<string, string | null>();
        for (let i = 0; i < ancestors.length; i += 1) {
          const node = ancestors[i];
          if (!node) {
            continue;
          }
          const parent = i > 0 ? (ancestors[i - 1]?.id ?? null) : null;
          parentMap.set(String(node.id), parent ? String(parent) : null);
        }
        let nodes: BreadcrumbNode[] = ancestors.map((node) => ({
          id: node.id,
          name: node.metadata?.name ?? '',
          nodeType: node.nodeType,
          visible: node.visible,
          parentId: parentMap.get(String(node.id)) ?? null,
        }));

        if (nodes.length + 1 > resolvedMaxBreadcrumbItems) {
          const keepTail = Math.max(1, resolvedMaxBreadcrumbItems - 3);
          const rootNode = nodes[0];
          const tail = nodes.slice(Math.max(1, nodes.length - keepTail));
          nodes = [
            ...(rootNode
              ? [{ id: rootNode.id, name: rootNode.name, nodeType: rootNode.nodeType }]
              : []),
            { id: '__ellipsis__', name: '…', nodeType: 'ellipsis', isClickable: false },
            ...tail,
          ];
        }

        const currentBreadcrumb: BreadcrumbNode = {
          id: pageTreeNode.id,
          name: pageTreeNode.metadata?.name ?? '',
          nodeType: pageTreeNode.nodeType,
          visible: pageTreeNode.visible,
          parentId: pageTreeNode.parentId ? String(pageTreeNode.parentId) : null,
        };

        if (!disposed) {
          setBreadcrumbItems([...nodes, currentBreadcrumb]);
        }

        if (subscriptionAPI) {
          const targetIds = [...ancestors.map((ancestor) => ancestor.id as NodeId), pageTreeNode.id as NodeId];
          const cb = comlinkProxy((event: unknown) => {
            const ev = event as { nodeId?: string; node?: TreeNode };
            const changedId = ev?.nodeId || ev?.node?.id;
            if (!changedId) return;
            setBreadcrumbItems((prev) =>
              prev.map((item) => {
                if (String(item.id) !== String(changedId)) return item;
                const nextName = ev.node?.metadata?.name ?? item.name;
                const nextNodeType = ev.node?.nodeType ?? item.nodeType;
                const nextVisible =
                  typeof ev.node?.visible === 'boolean' ? ev.node?.visible : item.visible;
                return {
                  ...item,
                  name: nextName,
                  nodeType: nextNodeType,
                  visible: nextVisible,
                };
              })
            );
          });

          for (const id of targetIds) {
            try {
              const subId = await subscriptionAPI.subscribeNode(id as NodeId, cb);
              activeSubs.push(subId);
            } catch {
              // best-effort; skip failures
            }
          }
        }
      } catch {
        if (!disposed && pageTreeNode) {
          setBreadcrumbItems([
            {
              id: pageTreeNode.id,
              name: pageTreeNode.metadata?.name ?? '',
              nodeType: pageTreeNode.nodeType,
            },
          ]);
        }
      }
    })();

    return () => {
      disposed = true;
      const cleanup = async () => {
        if (!client) return;
        try {
          if (typeof client.getSubscriptionAPI !== 'function') {
            return;
          }
          const subscriptionAPI = await client.getSubscriptionAPI();
          await Promise.all(
            subscriptionsRef.current.map(async (subId) => {
              try {
                await subscriptionAPI.unsubscribe(subId);
              } catch {
                // ignore
              }
            })
          );
        } catch {
          // ignore
        } finally {
          subscriptionsRef.current = [];
        }
      };
      void cleanup();
    };
  }, [client, pageTreeNode, resolvedMaxBreadcrumbItems]);

  return breadcrumbItems;
}

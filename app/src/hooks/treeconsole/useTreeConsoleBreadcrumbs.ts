/**
 * TreeConsole breadcrumb hook.
 *
 * Resolves ancestor chains for the current page node and maintains
 * a truncated breadcrumb list suitable for rendering in the console.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SubscriptionId } from '@hierarchidb/common-types';

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
        const subscriptionAPI = await client.getSubscriptionAPI();
        const ancestors = await queryAPI.listAncestors(pageTreeNode.id as NodeId);
        let nodes: BreadcrumbNode[] = ancestors.map((n) => ({
          id: n.id,
          name: n.metadata?.name ?? '',
          nodeType: n.nodeType,
          invisible: n.invisible,
          visible: n.visible,
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
          invisible: pageTreeNode.invisible,
          visible: pageTreeNode.visible,
        };

        if (!disposed) {
          setBreadcrumbItems([...nodes, currentBreadcrumb]);
        }

        const targetIds = [...ancestors.map((a) => a.id as NodeId), pageTreeNode.id as NodeId];
        const cb = comlinkProxy((event: unknown) => {
          const ev = event as { nodeId?: string; node?: TreeNode };
          const changedId = ev?.nodeId || ev?.node?.id;
          if (!changedId) return;
          setBreadcrumbItems((prev) =>
            prev.map((item) => {
              if (String(item.id) !== String(changedId)) return item;
              const nextName = ev.node?.metadata?.name ?? item.name;
              const nextNodeType = ev.node?.nodeType ?? item.nodeType;
              const nextInvisible =
                typeof ev.node?.invisible === 'boolean' ? ev.node?.invisible : item.invisible;
              const nextVisible =
                typeof ev.node?.visible === 'boolean' ? ev.node?.visible : item.visible;
              return {
                ...item,
                name: nextName,
                nodeType: nextNodeType,
                invisible: nextInvisible,
                visible: nextVisible,
              };
            }),
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
          const subscriptionAPI = await client.getSubscriptionAPI();
          await Promise.all(
            subscriptionsRef.current.map(async (subId) => {
              try {
                await subscriptionAPI.unsubscribe(subId);
              } catch {
                // ignore
              }
            }),
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

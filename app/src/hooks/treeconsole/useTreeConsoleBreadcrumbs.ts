/**
 * TreeConsole breadcrumb hook.
 *
 * Resolves ancestor chains for the current page node and maintains
 * a truncated breadcrumb list suitable for rendering in the console.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import { useEffect, useMemo, useState } from 'react';

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
  const resolvedMaxBreadcrumbItems = useMemo(
    () => normalizeMaxBreadcrumbOverride(maxBreadcrumbItems) ?? resolveMaxBreadcrumbs(),
    [maxBreadcrumbItems]
  );

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        if (!client || !pageTreeNode?.id) {
          setBreadcrumbItems([]);
          return;
        }

        const queryAPI = await client.getQueryAPI();
        const ancestors = await queryAPI.listAncestors(pageTreeNode.id as NodeId);
        let nodes: BreadcrumbNode[] = ancestors.map((n) => ({
          id: n.id,
          name: n.metadata?.name ?? '',
          nodeType: n.nodeType,
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
        };

        if (!disposed) {
          setBreadcrumbItems([...nodes, currentBreadcrumb]);
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
    };
  }, [client, pageTreeNode, resolvedMaxBreadcrumbItems]);

  return breadcrumbItems;
}

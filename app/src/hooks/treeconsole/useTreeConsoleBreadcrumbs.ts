/**
 * TreeConsole breadcrumb hook.
 *
 * Resolves ancestor chains for the current page node and maintains
 * a truncated breadcrumb list suitable for rendering in the console.
 */

import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/feature-core/common-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import { useEffect, useMemo, useState } from 'react';

interface Params {
  client: Remote<WorkerAPI> | undefined;
  pageTreeNode?: TreeNode;
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

export function useTreeConsoleBreadcrumbs({ client, pageTreeNode }: Params): BreadcrumbNode[] {
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbNode[]>([]);
  const maxBreadcrumbItems = useMemo(() => resolveMaxBreadcrumbs(), []);

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
          name: n.name,
          nodeType: n.nodeType,
        }));

        if (nodes.length + 1 > maxBreadcrumbItems) {
          const keepTail = Math.max(1, maxBreadcrumbItems - 3);
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
          name: pageTreeNode.name,
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
              name: pageTreeNode.name,
              nodeType: pageTreeNode.nodeType,
            },
          ]);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [client, pageTreeNode, maxBreadcrumbItems]);

  return breadcrumbItems;
}

/**
 * TreeConsole breadcrumb hook.
 *
 * Resolves ancestor chains for the current page node and maintains
 * a truncated breadcrumb list suitable for rendering in the console.
 */

import type { BuildWorkerAPI } from '~/types/workerApiTypes';
import type { NodeId } from '@hierarchidb/core-types';
import { getTreeNodeName, type SubscriptionId, type TreeNode } from '@hierarchidb/tree-api';
import { isFolderNodeType, type BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeForComlink } from '~/utils/comlinkSanitizerUtils';

interface Params {
  client: Remote<BuildWorkerAPI> | undefined;
  pageTreeNode?: TreeNode;
  /**
   * Optional override used mainly for tests to force breadcrumb truncation.
   */
  maxBreadcrumbItems?: number;
}

const DEFAULT_MAX_BREADCRUMBS = 20;

function resolveMaxBreadcrumbs(): number {
  try {
    const maybeEnv = (import.meta as { env?: Record<string, string> }).env;
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
        const readBuildRequired = (sourceNode?: TreeNode | null): boolean => {
          return Boolean(
            sourceNode?.draftMetadata?.buildMetadata?.buildRequired ||
              sourceNode?.metadata?.buildMetadata?.buildRequired
          );
        };
        const hasBuildRequiredInDescendants = async (folderNodeId: string): Promise<boolean> => {
          const listDescendants = (queryAPI as { listDescendants?: (nodeId: NodeId) => Promise<TreeNode[]> })
            .listDescendants;
          if (typeof listDescendants !== 'function') {
            return false;
          }
          const descendants = await listDescendants(
            folderNodeId as NodeId
          );
          return descendants.some(
            (descendant) =>
              !isFolderNodeType(String(descendant.nodeType ?? '')) &&
              readBuildRequired(descendant)
          );
        };

        let nodes: BreadcrumbNode[] = ancestors.map((node) => ({
          id: node.id,
          name: getTreeNodeName(node),
          nodeType: node.nodeType,
          visible: node.visible,
          parentId: parentMap.get(String(node.id)) ?? null,
          metadata: node.metadata
            ? {
                name: node.metadata.name,
                description: node.metadata.description,
                tags: node.metadata.tags,
                buildMetadata: node.metadata.buildMetadata,
              }
            : undefined,
          draftMetadata: node.draftMetadata
            ? {
                name: node.draftMetadata.name,
                description: node.draftMetadata.description,
                tags: node.draftMetadata.tags,
                buildMetadata: node.draftMetadata.buildMetadata,
              }
            : null,
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
          name: getTreeNodeName(pageTreeNode),
          nodeType: pageTreeNode.nodeType,
          visible: pageTreeNode.visible,
          parentId: pageTreeNode.parentId ? String(pageTreeNode.parentId) : null,
          metadata: pageTreeNode.metadata
            ? {
                name: pageTreeNode.metadata.name,
                description: pageTreeNode.metadata.description,
                tags: pageTreeNode.metadata.tags,
                buildMetadata: pageTreeNode.metadata.buildMetadata,
              }
            : undefined,
          draftMetadata: pageTreeNode.draftMetadata
            ? {
                name: pageTreeNode.draftMetadata.name,
                description: pageTreeNode.draftMetadata.description,
                tags: pageTreeNode.draftMetadata.tags,
                buildMetadata: pageTreeNode.draftMetadata.buildMetadata,
            }
            : null,
        };
        const nodeType = currentBreadcrumb.nodeType;
        const currentNodeIsFolder = isFolderNodeType(String(nodeType));
        if (currentNodeIsFolder) {
          const hasBuildRequiredDescendant = await hasBuildRequiredInDescendants(
            String(pageTreeNode.id as NodeId)
          );
          const currentBuildMetadata = currentBreadcrumb.metadata?.buildMetadata;
          const currentBuildRequired = readBuildRequired(pageTreeNode) || hasBuildRequiredDescendant;
          currentBreadcrumb.metadata = {
            ...currentBreadcrumb.metadata,
            buildMetadata: {
              ...currentBuildMetadata,
              buildRequired: currentBuildRequired,
            },
          };
        }

        if (!disposed) {
          setBreadcrumbItems([...nodes, currentBreadcrumb]);
        }

        if (subscriptionAPI) {
          const targetIds = [...ancestors.map((ancestor) => ancestor.id as NodeId), pageTreeNode.id as NodeId];
          const cb = comlinkProxy((event: unknown) => {
            const ev = sanitizeForComlink(event) as { nodeId?: string; node?: TreeNode };
            const changedId = ev?.nodeId || ev?.node?.id;
            if (!changedId) return;
            setBreadcrumbItems((prev) =>
              prev.map((item) => {
                if (String(item.id) !== String(changedId)) return item;
                const nextName = ev.node ? getTreeNodeName(ev.node) : item.name;
                const nextNodeType = ev.node?.nodeType ?? item.nodeType;
                const nextVisible =
                  typeof ev.node?.visible === 'boolean' ? ev.node?.visible : item.visible;
                const nextMetadata =
                  ev.node?.metadata
                    ? {
                        name: ev.node.metadata.name,
                        description: ev.node.metadata.description,
                        tags: ev.node.metadata.tags,
                        buildMetadata: ev.node.metadata.buildMetadata,
                      }
                    : item.metadata;
                const nextDraftMetadata =
                  ev.node?.draftMetadata
                    ? {
                        name: ev.node.draftMetadata.name,
                        description: ev.node.draftMetadata.description,
                        tags: ev.node.draftMetadata.tags,
                        buildMetadata: ev.node.draftMetadata.buildMetadata,
                      }
                    : item.draftMetadata;
                return {
                  ...item,
                  name: nextName,
                  nodeType: nextNodeType,
                  visible: nextVisible,
                  metadata: nextMetadata,
                  draftMetadata: nextDraftMetadata,
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
              name: getTreeNodeName(pageTreeNode),
              nodeType: pageTreeNode.nodeType,
              metadata: pageTreeNode.metadata
                ? {
                    name: pageTreeNode.metadata.name,
                    description: pageTreeNode.metadata.description,
                    tags: pageTreeNode.metadata.tags,
                    buildMetadata: pageTreeNode.metadata.buildMetadata,
                  }
                : undefined,
              draftMetadata: pageTreeNode.draftMetadata
                ? {
                    name: pageTreeNode.draftMetadata.name,
                    description: pageTreeNode.draftMetadata.description,
                    tags: pageTreeNode.draftMetadata.tags,
                    buildMetadata: pageTreeNode.draftMetadata.buildMetadata,
                  }
                : null,
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

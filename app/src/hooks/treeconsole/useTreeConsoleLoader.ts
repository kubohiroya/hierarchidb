/**
 * TreeConsole data loader hook.
 *
 * Centralises the logic for fetching, normalising, and sorting console data.
 */

import type { BuildWorkerAPI } from '~/types/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import type { Remote } from 'comlink';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms';
import { buildVisibleRows, syncNodeIndex } from '~/state/treeconsole.derive';
import type { TreeConsoleState } from './types.js';

interface Params {
  client?: Remote<BuildWorkerAPI>;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  state: TreeConsoleState;
  searchTerm: string;
  expandedIds: NodeId[];
  ssot: TreeConsoleSSOTEntry;
  setState: Dispatch<SetStateAction<TreeConsoleState>>;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
}

type LoadChildrenOptions = {
  suppressLoading?: boolean;
};

export function useTreeConsoleLoader({
  client,
  pageNodeId,
  pageTreeNode,
  // atoms,
  // searchTerm,
  expandedIds,
  ssot,
  setState,
  setSSOT,
}: Params) {
  const debugEnabled = (() => {
    try {
      const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
      return env?.VITE_SUBSCRIPTION_DEBUG === '1';
    } catch {
      return false;
    }
  })();
  const nodeIndexRef = useRef<DualKeyMap<NodeId, NodeId, TreeNode>>(
    ssot.nodeIndex ? ssot.nodeIndex.clone() : new DualKeyMap<NodeId, NodeId, TreeNode>()
  );
  const expandedIdsRef = useRef<NodeId[]>(expandedIds);
  const setSSOTRef = useRef(setSSOT);

  useEffect(() => {
    setSSOTRef.current = setSSOT;
  }, [setSSOT]);

  useEffect(() => {
    if (ssot.nodeIndex) {
      nodeIndexRef.current = ssot.nodeIndex.clone();
    }
  }, [ssot.nodeIndex]);

  useEffect(() => {
    expandedIdsRef.current = expandedIds;
  }, [expandedIds]);

  const loadChildrenOf = useCallback(
    async (parentId: NodeId, _optTerm?: string, options?: LoadChildrenOptions) => {
      if (!client) return;
      const shouldSetLoading = !options?.suppressLoading;
      if (shouldSetLoading) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        setSSOTRef.current({ loading: true, error: null });
      }

      let builtIndex: DualKeyMap<NodeId, NodeId, TreeNode> | null = null;
      try {
        const queryAPI = await client.getQueryAPI();
        const children: TreeNode[] = await queryAPI.listChildren(parentId);
        if (debugEnabled) {
          console.log('[TreeConsoleLoader] listChildren result', {
            parentId: String(parentId),
            count: children.length,
            sample: children.slice(0, 10).map((node) => ({
              id: String(node.id),
              parentId: node.parentId ? String(node.parentId) : null,
              name: node.metadata?.name,
              depth: node.depth,
            })),
          });
        }
        const shouldFlattenArchive =
          pageTreeNode?.nodeType === 'archive' && parentId === (pageNodeId as NodeId);
        let displayNodes: TreeNode[] = children;

        if (shouldFlattenArchive) {
          const changes: TreeNode[][] = await Promise.all(
            children.map((child) => queryAPI.listChildren(child.id as NodeId))
          );
          displayNodes = changes.flat();
          if (debugEnabled) {
            console.log('[TreeConsoleLoader] flattened archive nodes', {
              parentId: String(parentId),
              changes: changes.map((batch, index) => ({
                parent: String(children[index]?.id ?? ''),
                count: batch.length,
              })),
              total: displayNodes.length,
            });
          }
        }

        const index = nodeIndexRef.current.clone();
        const parentKey = String(parentId) as NodeId;
        syncNodeIndex(index, parentKey, displayNodes);

        const rootId = (pageNodeId || parentId) as NodeId;
        const visibleSample = buildVisibleRows(rootId, index, expandedIdsRef.current).slice(0, 5);

        if (debugEnabled) {
          console.log('[TreeConsoleLoader] rebuild result', {
            parentId: String(parentId),
            visibleRows: visibleSample.length,
            expanded: expandedIdsRef.current.map((id) => String(id)),
          });
        }

        nodeIndexRef.current = index;
        setSSOTRef.current({ nodeIndex: index });
        builtIndex = index;
      } catch (err) {
        console.error('Failed to load children:', err);
        setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        if (shouldSetLoading) {
          setState((prev) => ({ ...prev, loading: false }));
          setSSOTRef.current({ loading: false });
        }
      }

      return builtIndex ?? undefined;
    },
    [client, debugEnabled, pageNodeId, pageTreeNode?.nodeType, setState]
  );

  return { loadChildrenOf };
}

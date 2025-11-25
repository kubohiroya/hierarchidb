/**
 * TreeConsole data loader hook.
 *
 * Centralises the logic for fetching, normalising, and sorting console data.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { DualKeyMap } from '@hierarchidb/util';
import type { Remote } from 'comlink';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { preconnectForNodeTypes } from './preconnect.ts';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import { buildVisibleRows, syncNodeIndex } from '~/state/treeconsole.derive.js';
import type { TreeConsoleState } from './types.js';

interface Params {
  client: Remote<WorkerAPI> | undefined;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  state: TreeConsoleState;
  searchTerm: string;
  expandedIds: NodeId[];
  ssot: TreeConsoleSSOTEntry;
  setState: Dispatch<SetStateAction<TreeConsoleState>>;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
}

export function useTreeConsoleLoader({
  client,
  pageNodeId,
  pageTreeNode,
  // state,
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
    async (parentId: NodeId, _optTerm?: string) => {
      if (!client) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOTRef.current({ loading: true, error: null });

      try {
        const queryAPI = await client.getQueryAPI();
        const children = await queryAPI.listChildren(parentId);
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
        const shouldFlattenTrash =
          pageTreeNode?.nodeType === 'trash' && parentId === (pageNodeId as NodeId);
        let displayNodes: TreeNode[] = children;

        if (shouldFlattenTrash) {
          const batches = await Promise.all(
            children.map((h) => queryAPI.listChildren(h.id as NodeId))
          );
          displayNodes = batches.flat();
          if (debugEnabled) {
            console.log('[TreeConsoleLoader] flattened trash nodes', {
              parentId: String(parentId),
              batches: batches.map((nodes, index) => ({
                parent: String(children[index]?.id ?? ''),
                count: nodes.length,
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

        const types = displayNodes.map((n) =>
          String((n as unknown as { nodeType?: string }).nodeType || '')
        );
        void preconnectForNodeTypes(types);
      } catch (err) {
        console.error('Failed to load children:', err);
        setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
        setSSOTRef.current({ loading: false });
      }
    },
    [client, debugEnabled, pageNodeId, pageTreeNode?.nodeType, setState]
  );

  return { loadChildrenOf };
}

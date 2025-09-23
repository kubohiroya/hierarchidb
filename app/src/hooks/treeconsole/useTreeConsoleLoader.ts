/**
 * TreeConsole data loader hook.
 *
 * Centralises the logic for fetching, normalising, and sorting tree data.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import { rebuildAdjacency, buildVisibleRows } from '~/state/treeconsole.derive.js';
import { preconnectForNodeTypes } from '~/services/preconnect.js';
import type { TreeConsoleState } from './types.js';
import { applySortFilterSearch, deriveConfigFromState } from './sortFilter.js';

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
  state,
  searchTerm,
  expandedIds,
  ssot,
  setState,
  setSSOT,
}: Params) {
  const sortConfigRef = useRef(deriveConfigFromState(state, searchTerm));
  const nodesByIdRef = useRef<Map<string, TreeNode>>(ssot.nodesById ?? new Map<string, TreeNode>());
  const childrenByParentRef = useRef<Map<string, Set<string>>>(
    ssot.childrenByParent ?? new Map<string, Set<string>>(),
  );
  const expandedIdsRef = useRef<NodeId[]>(expandedIds);
  const setSSOTRef = useRef(setSSOT);

  useEffect(() => {
    setSSOTRef.current = setSSOT;
  }, [setSSOT]);

  useEffect(() => {
    sortConfigRef.current = deriveConfigFromState(state, searchTerm);
  }, [searchTerm, state.filterBy, state.sortBy, state.sortDirection]);

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

  const applySortAndFilter = useCallback(
    (nodes: TreeNodeData[], overrideTerm?: string) =>
      applySortFilterSearch(nodes, sortConfigRef.current, overrideTerm),
    [],
  );

  const loadChildrenOf = useCallback(
    async (parentId: NodeId, optTerm?: string) => {
      if (!client) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOTRef.current({ loading: true, error: null });

      try {
        const queryAPI = await client.getQueryAPI();
        const children = await queryAPI.listChildren(parentId);
        const shouldFlattenTrash = pageTreeNode?.nodeType === 'trash' && parentId === (pageNodeId as NodeId);
        let displayNodes: TreeNode[] = children;

        if (shouldFlattenTrash) {
          const batches = await Promise.all(children.map((h) => queryAPI.listChildren(h.id as NodeId)));
          displayNodes = batches.flat();
        }

        const nodesById = new Map<string, TreeNode>(nodesByIdRef.current);
        const childrenByParent = new Map<string, Set<string>>(
          Array.from(childrenByParentRef.current.entries()).map(([k, set]) => [k, new Set(set)]),
        );
        rebuildAdjacency(nodesById, childrenByParent, String(parentId), displayNodes);

        const rootId = String(pageNodeId || parentId);
        const flat = buildVisibleRows(rootId, nodesById, childrenByParent, expandedIdsRef.current);
        const sorted = applySortAndFilter(flat, optTerm);

        nodesByIdRef.current = nodesById;
        childrenByParentRef.current = childrenByParent;
        setSSOTRef.current({ rawNodes: displayNodes, nodesById, childrenByParent, treeData: sorted });

        const types = displayNodes.map((n) => String((n as unknown as { nodeType?: string }).nodeType || ''));
        void preconnectForNodeTypes(types);
      } catch (err) {
        console.error('Failed to load children:', err);
        setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
        setSSOTRef.current({ loading: false });
      }
    },
    [client, pageNodeId, pageTreeNode?.nodeType, setState, applySortAndFilter],
  );

  return { applySortAndFilter, loadChildrenOf };
}

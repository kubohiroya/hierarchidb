/**
 * Selection and expansion actions for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/core-types';
import { buildVisibleRows } from '~/state/treeconsole.derive';
import type { TreeConsoleActionDeps } from '~/hooks/treeconsole/types';
import { attachChildrenToIndex, getOrCreateIndex } from './helpers.ts';

export const createSelectionActions = (deps: TreeConsoleActionDeps) => {
  const { client, expandedIds, setSSOT, ssot, selectedIds } = deps;

  return {
    handleNodeSelect: (nodeIds: string[], selected: boolean) => {
      const next = new Set<NodeId>((selectedIds || []).map((id) => id as NodeId));
      const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
      ids.forEach((rawId) => {
        const id = rawId as NodeId;
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });

      setSSOT({
        selectedIds: Array.from(next),
      });
    },

    handleNodeExpand: async (nodeId: string, expanded: boolean) => {
      setSSOT({
        expandedIds: (() => {
          const prev = expandedIds;
          if (expanded) return [...new Set([...(prev || []), nodeId as NodeId])];
          return (prev || []).filter((id) => id !== nodeId);
        })(),
      });

      if (expanded && client) {
        try {
          const index = getOrCreateIndex(ssot);
          const parentKey = nodeId as NodeId;
          const existingChildIds = Array.from(index.getPrimaryKeysBySecondary(parentKey));
          if (!existingChildIds.length) {
            const queryAPI = await client.getQueryAPI();
            const result = await queryAPI.listChildren(nodeId as NodeId);
            const nextIndex = attachChildrenToIndex(index, parentKey, result);
            setSSOT({ nodeIndex: nextIndex });
          }
        } catch (err) {
          console.error('Failed to load children for node:', nodeId, err);
        }
      }
    },

    handleExpandAll: () => {
      const index = getOrCreateIndex(ssot);
      const rootId = (deps.pageNodeId || '') as NodeId;
      const flat = buildVisibleRows(rootId, index, expandedIds);
      const allIds = flat.map((node) => node.id as NodeId);
      setSSOT({ nodeIndex: index, expandedIds: allIds });
    },

    handleCollapseAll: () => {
      setSSOT({ expandedIds: [] });
    },
  };
};

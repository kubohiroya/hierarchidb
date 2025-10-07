/**
  * ExpansionOrchestrator
  * /
 * - /
 * - /
 * -
  */

import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { TreeViewController } from '../../../types/index.js';
import { expandedAtom, toggleAllExpandedAtom, toggleExpandedAtom } from '../state/index.js';

export interface ExpansionOrchestratorResult {
  // State
  expanded: Record<string, boolean>;

  // Actions
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleAllNodes: () => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
}

/**
    */
export function useExpansionOrchestrator(
  controller: TreeViewController | null,
): ExpansionOrchestratorResult {
  // State atoms
  const [expanded, setExpanded] = useAtom(expandedAtom);

  // Action atoms
  const toggleExpanded = useSetAtom(toggleExpandedAtom);
  const toggleAllExpanded = useSetAtom(toggleAllExpandedAtom);

  const toggleNode = useCallback(
    (nodeId: string) => {
      toggleExpanded(nodeId);

      //  Controller
      if ((expanded as Record<string, boolean>)[nodeId]) {
        controller?.collapseNode?.(nodeId as NodeId);
      } else {
        controller?.expandNode?.(nodeId as NodeId);
      }
    },
    [expanded, toggleExpanded, controller],
  );

  const expandNode = useCallback(
    (nodeId: string) => {
      if (!(expanded as Record<string, boolean>)[nodeId]) {
        setExpanded((prev) => ({ ...(prev as Record<string, boolean>), [nodeId]: true }));
        controller?.expandNode?.(nodeId as NodeId);
      }
    },
    [expanded, setExpanded, controller],
  );

  const collapseNode = useCallback(
    (nodeId: string) => {
      if ((expanded as Record<string, boolean>)[nodeId]) {
        setExpanded((prev) => ({ ...(prev as Record<string, boolean>), [nodeId]: false }));
        controller?.collapseNode?.(nodeId as NodeId);
      }
    },
    [expanded, setExpanded, controller],
  );

  const toggleAllNodes = useCallback(() => {
    toggleAllExpanded();

    //  Controller
    const hasExpanded = Object.values(expanded).some((v) => v);
    if (hasExpanded) {
      // Collapse all - managed locally
      setExpanded({});
    } else {
      // Expand all - needs to fetch all node IDs
      console.log('Expand all - needs implementation');
    }
  }, [expanded, toggleAllExpanded, controller]);

  const expandAllNodes = useCallback(() => {
    //  TODO: ID
    console.log('Expand all - needs implementation');
  }, []);

  const collapseAllNodes = useCallback(() => {
    setExpanded({});
  }, [setExpanded]);

  return {
    // State
    expanded: (typeof expanded === 'boolean' ? {} : expanded) as Record<string, boolean>,

    // Actions
    toggleNode,
    expandNode,
    collapseNode,
    toggleAllNodes,
    expandAllNodes,
    collapseAllNodes,
  };
}

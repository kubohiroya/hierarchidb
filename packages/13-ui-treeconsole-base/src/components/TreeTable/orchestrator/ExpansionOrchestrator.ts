/**
 * ExpansionOrchestrator
 *
 * ノード展開/折りたたみに関するユーザーストーリーの管理
 * - 個別ノードの展開/折りたたみ
 * - 全展開/全折りたたみ
 * - 展開状態の永続化
 */

import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import type { NodeId } from '@hierarchidb/00-core';
import type { TreeViewController } from '../../../types/index';
import { expandedAtom, toggleExpandedAtom, toggleAllExpandedAtom } from '../state';

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
 * 展開操作のオーケストレーター
 */
export function useExpansionOrchestrator(
  controller: TreeViewController | null
): ExpansionOrchestratorResult {
  // State atoms
  const [expanded, setExpanded] = useAtom(expandedAtom);

  // Action atoms
  const toggleExpanded = useSetAtom(toggleExpandedAtom);
  const toggleAllExpanded = useSetAtom(toggleAllExpandedAtom);

  // 個別ノードのトグル
  const toggleNode = useCallback(
    (nodeId: string) => {
      toggleExpanded(nodeId);

      // Controllerに通知
      if ((expanded as Record<string, boolean>)[nodeId]) {
        controller?.collapseNode?.(nodeId as NodeId);
      } else {
        controller?.expandNode?.(nodeId as NodeId);
      }
    },
    [expanded, toggleExpanded, controller]
  );

  // ノードを展開
  const expandNode = useCallback(
    (nodeId: string) => {
      if (!(expanded as Record<string, boolean>)[nodeId]) {
        setExpanded((prev) => ({ ...(prev as Record<string, boolean>), [nodeId]: true }));
        controller?.expandNode?.(nodeId as NodeId);
      }
    },
    [expanded, setExpanded, controller]
  );

  // ノードを折りたたみ
  const collapseNode = useCallback(
    (nodeId: string) => {
      if ((expanded as Record<string, boolean>)[nodeId]) {
        setExpanded((prev) => ({ ...(prev as Record<string, boolean>), [nodeId]: false }));
        controller?.collapseNode?.(nodeId as NodeId);
      }
    },
    [expanded, setExpanded, controller]
  );

  // 全ノードのトグル
  const toggleAllNodes = useCallback(() => {
    toggleAllExpanded();

    // Controllerに通知
    const hasExpanded = Object.values(expanded).some((v) => v);
    if (hasExpanded) {
      // Collapse all - managed locally
      setExpanded({});
    } else {
      // Expand all - needs to fetch all node IDs
      console.log('Expand all - needs implementation');
    }
  }, [expanded, toggleAllExpanded, controller]);

  // 全ノードを展開
  const expandAllNodes = useCallback(() => {
    // TODO: 全ノードIDを取得して展開状態を設定
    console.log('Expand all - needs implementation');
  }, []);

  // 全ノードを折りたたみ
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

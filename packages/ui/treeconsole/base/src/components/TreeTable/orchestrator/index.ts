/**
 * TreeTableOrchestrator (Facade)
 *
 * 個別のオーケストレーターを統合し、
 * 統一されたインターフェースを提供するファサード
 *
 * 責務:
 * - 各オーケストレーターの初期化と管理
 * - UIコンポーネントへの統一インターフェース提供
 * - オーケストレーター間の調整
 */

import { useMemo } from 'react';
import type { TreeViewController } from '../../../types/index';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { useAtomValue } from 'jotai';
import { tableDataAtom } from '../state';

// Individual Orchestrators
import {
  useSelectionOrchestrator,
  type SelectionOrchestratorResult,
} from './SelectionOrchestrator';
import {
  useExpansionOrchestrator,
  type ExpansionOrchestratorResult,
} from './ExpansionOrchestrator';
import { useEditingOrchestrator, type EditingOrchestratorResult } from './EditingOrchestrator';
import { useDragDropOrchestrator, type DragDropOrchestratorResult } from './DragDropOrchestrator';
import { useSearchOrchestrator, type SearchOrchestratorResult } from './SearchOrchestrator';
import {
  useSubscriptionOrchestrator,
  type SubscriptionOrchestratorResult,
} from './SubscriptionOrchestrator';

/**
 * 統合オーケストレーターの結果型
 */
export interface TreeTableOrchestratorResult {
  // Sub-orchestrators (個別機能へのアクセス)
  selection: SelectionOrchestratorResult;
  expansion: ExpansionOrchestratorResult;
  editing: EditingOrchestratorResult;
  dragDrop: DragDropOrchestratorResult;
  search: SearchOrchestratorResult;
  subscription: SubscriptionOrchestratorResult;

  // Commonly used shortcuts (よく使う機能のショートカット)
  selectedNodeIds: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * TreeTableOrchestrator Hook (Facade)
 *
 * 使用例:
 * ```typescript
 * const orchestrator = useTreeTableOrchestrator(controller, workerAPI);
 *
 * // 個別機能にアクセス
 * orchestrator.selection.selectNode(nodeId);
 * orchestrator.expansion.toggleNode(nodeId);
 * orchestrator.editing.startEdit(nodeId, value);
 *
 * // よく使う機能に直接アクセス
 * const { selectedNodeIds, isLoading } = orchestrator;
 * ```
 */
export function useTreeTableOrchestrator(
  controller: TreeViewController | null,
  workerAPI?: WorkerAPI,
  _options?: {
    enableSubscription?: boolean;
    subscriptionDepth?: number;
  }
): TreeTableOrchestratorResult {
  // Get table data for orchestrators that need it
  const tableData = useAtomValue(tableDataAtom);

  // Initialize individual orchestrators
  const selection = useSelectionOrchestrator(controller);
  const expansion = useExpansionOrchestrator(controller);
  const editing = useEditingOrchestrator(controller);
  const dragDrop = useDragDropOrchestrator(controller, tableData);
  const search = useSearchOrchestrator(controller);
  const subscription = useSubscriptionOrchestrator(workerAPI!);

  // Create facade result
  const result = useMemo<TreeTableOrchestratorResult>(
    () => ({
      // Sub-orchestrators
      selection,
      expansion,
      editing,
      dragDrop,
      search,
      subscription,

      // Common shortcuts
      selectedNodeIds: selection.selectedNodeIds,
      isLoading: false, // TODO: Implement loading state
      error: null, // TODO: Implement error state
    }),
    [selection, expansion, editing, dragDrop, search, subscription]
  );

  return result;
}

// Re-export individual orchestrator types for convenience
export type {
  SelectionOrchestratorResult,
  ExpansionOrchestratorResult,
  EditingOrchestratorResult,
  DragDropOrchestratorResult,
  SearchOrchestratorResult,
  SubscriptionOrchestratorResult,
};

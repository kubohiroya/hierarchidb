import { useEffect, useMemo, useState } from 'react';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import type { TreeConsoleContentProps } from '../types/index.js';
import type { TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';

interface UseTreeConsoleContentResult {
  contentState: 'loading' | 'empty' | 'table';
  emptyMessage: string;
  loadingLabel: string;
  treeTableController: TreeTableController | null;
  handleDragStateChange?: (
    draggingNodeId: NodeId | undefined,
    descendantIdSet: Set<NodeId> | undefined,
    dragPreviewElement: HTMLElement | null
  ) => void;
  shouldRenderDebugInfo: boolean;
}

const buildTranslator = (t: (key: string, fallback: string) => string) => {
  return (key: string, fallback: string) => {
    const safeFallback = fallback?.trim?.() ?? '';
    const translated = t(key, safeFallback);
    if (translated === key) {
      return safeFallback || key;
    }
    return translated;
  };
};

export const useTreeConsoleContent = (
  props: TreeConsoleContentProps
): UseTreeConsoleContentResult => {
  const {
    controller,
    isProjectsPage,
    isResourcesPage,
    onDragStateChange,
    mode,
  } = props;

  const [isWebKit, setIsWebKit] = useState(false);
  const [webKitInitialized, setWebKitInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isWebKitBrowser =
        ua.includes('webkit') && !ua.includes('chrome') && !ua.includes('firefox');
      setIsWebKit(isWebKitBrowser);

      if (isWebKitBrowser) {
        const timer = setTimeout(() => {
          setWebKitInitialized(true);
        }, 500);
        return () => clearTimeout(timer);
      }
      setWebKitInitialized(true);
    } else {
      setWebKitInitialized(true);
    }
  }, []);

  const globalProcess = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  const isTestEnv = globalProcess?.env?.NODE_ENV === 'test';
  const isLoading = !controller || controller.isLoading || (!isTestEnv && isWebKit && !webKitInitialized);

  const dataCount = controller?.data ? controller.data.length : 0;
  const hasMinimumData = controller && Array.isArray(controller.data);
  const isEmpty = controller && !controller.isLoading && dataCount === 0;

  const contentState: 'loading' | 'empty' | 'table' = (() => {
    if (isLoading) return 'loading';
    if (isEmpty) return 'empty';
    if (hasMinimumData) return 'table';
    return 'loading';
  })();

  const { t } = useGlobalI18nTranslator();
  const translateWithFallback = useMemo(() => buildTranslator(t), [t]);

  const emptyMessage = useMemo(() => {
    if (mode === 'restore') {
      return translateWithFallback(
        'treeConsole.content.empty.restore',
        'No items can be restored from the trash.'
      );
    }
    if (mode === 'dispose') {
      return translateWithFallback(
        'treeConsole.content.empty.dispose',
        'No items can be permanently deleted.'
      );
    }
    if (isProjectsPage) {
      return translateWithFallback(
        'treeConsole.content.empty.projects',
        'No projects yet. Create a new project to get started.'
      );
    }
    if (isResourcesPage) {
      return translateWithFallback(
        'treeConsole.content.empty.resources',
        'No resources yet. Create a new resource to get started.'
      );
    }
    return translateWithFallback('treeConsole.content.empty.default', 'No data available.');
  }, [isProjectsPage, isResourcesPage, mode, translateWithFallback]);

  const loadingLabel = useMemo(
    () => translateWithFallback('treeConsole.content.loading', 'Loading...'),
    [translateWithFallback]
  );

  const treeTableController = useMemo<TreeTableController | null>(() => {
    if (!controller) return null;
    return {
      data: controller.data,
      nodeIndex: controller.nodeIndex ?? new DualKeyMap<NodeId, NodeId, TreeNode>(),
      rowSelection: controller.rowSelection,
      expandedRowIds: controller.expandedRowIds,
      rootNodeId: controller.rootNodeId,
      searchText: controller.searchText,
      filteredItemCount: controller.filteredItemCount,
      totalItemCount: controller.totalItemCount,
      handleSearchTextChange: controller.handleSearchTextChange,
      onNodeClick: controller.onNodeClick
        ? (nodeId: string, node?: TreeNodeInUI) =>
            controller.onNodeClick?.(nodeId as NodeId, node as unknown as TreeNode)
        : undefined,
      onNodeExpand: controller.onNodeExpand
        ? (nodeId: string, expanded: boolean) => controller.onNodeExpand?.(nodeId as NodeId, expanded)
        : undefined,
      onNodeSelect: controller.onNodeSelect
        ? (nodeIds: string[], selected: boolean) =>
            controller.onNodeSelect?.(nodeIds as NodeId[], selected)
        : undefined,
      startEdit: controller.startEdit
        ? (nodeId: string) => controller.startEdit?.(nodeId as NodeId)
        : undefined,
      finishEdit: controller.finishEdit
        ? (nodeId: string, newName: string, field?: 'name' | 'description') =>
            controller.finishEdit?.(nodeId as NodeId, newName, field)
        : undefined,
      cancelEdit: controller.cancelEdit,
      onCreate: controller.onCreate
        ? (parentId: string, type: string) => controller.onCreate?.(parentId as NodeId, type)
        : undefined,
      onDuplicate: controller.onDuplicate
        ? (nodeId: string) => controller.onDuplicate?.(nodeId as NodeId)
        : undefined,
      onArchive: controller.onArchive
        ? (nodeIds: string[]) => controller.onArchive?.(nodeIds as NodeId[])
        : undefined,
    };
  }, [controller]);

  const handleDragStateChange = useMemo(() => {
    if (!onDragStateChange) return undefined;
    return (
      draggingNodeId: NodeId | undefined,
      descendantIdSet: Set<NodeId> | undefined,
      _dragPreviewElement: HTMLElement | null
    ) => onDragStateChange(draggingNodeId, descendantIdSet);
  }, [onDragStateChange]);

  const shouldRenderDebugInfo =
    typeof document === 'undefined' || !document.querySelector('[data-testid="treeconsole-debug-info"]');

  return {
    contentState,
    emptyMessage,
    loadingLabel,
    treeTableController,
    handleDragStateChange,
    shouldRenderDebugInfo,
  };
};

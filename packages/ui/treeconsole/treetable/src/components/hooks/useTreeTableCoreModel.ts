import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { BuildSessionIndicator, TreeNodeInUI, TreeTableController } from '~/types';
import { createTreeTableColumns } from '../internal/createTreeTableColumns.js';
import { useTreeTableStructure } from './useTreeTableStructure.js';
import { useTreeTableColumnWidths } from './useTreeTableColumnWidths.js';
import { useTreeTableSelectAll } from './useTreeTableSelectAll.js';
import { useTreeTableSelectionOverlay } from './useTreeTableSelectionOverlay.js';
import { useTreeTableEditing } from './useTreeTableEditing.js';
import { useTreeTableRowInteractions } from './useTreeTableRowInteractions.js';

export interface TreeTableContextMenuState {
  anchorEl: HTMLElement | null;
  anchorPosition: { left: number; top: number } | null;
  node: TreeNodeInUI | TreeNode | null;
}

type NodeTypeIconLikeProps = {
  nodeType: string;
  size?: string;
  clickable?: boolean;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
  htmlColor?: string;
  isDraft?: boolean;
  buildRequired?: boolean;
};

/** Reverse mapping: TanStack Table column ID → SortMode value. */
const COLUMN_ID_TO_SORT_MODE: Record<string, import('@hierarchidb/tree-api').SortMode> = {
  name: 'name',
  createdAt: 'created',
  updatedAt: 'modified',
};

export interface UseTreeTableCoreModelParams {
  controller: TreeTableController | null;
  pageNodeId?: string;
  treeId?: string;
  selectAllPersistence: 'page' | 'session';
  selectionIdPrefix: string;
  depthOffset: number;
  hideDragHandler: boolean;
  disableDragAndDrop: boolean;
  useArchiveColumns: boolean;
  archiveAction: 'restore' | 'empty';
  rowClickAction: 'Select/Navigate' | 'Edit';
  selectionMode: 'single' | 'multiple' | 'none';
  IconComponent: ComponentType<NodeTypeIconLikeProps>;
  onRowClick?: (node: TreeNodeInUI, event: ReactMouseEvent) => void;
  onRowDoubleClick?: (node: TreeNodeInUI, event: ReactMouseEvent) => void;
  buildSessionIndicator?: BuildSessionIndicator;
  sortMode?: import('@hierarchidb/tree-api').SortMode;
  onSortModeChange?: (mode: import('@hierarchidb/tree-api').SortMode) => void;
}

export interface UseTreeTableCoreModelResult {
  table: ReturnType<typeof useReactTable<TreeNode>>;
  structure: ReturnType<typeof useTreeTableStructure>;
  columns: ReturnType<typeof createTreeTableColumns>;
  columnWidths: Record<string, number>;
  columnWidthsReady: boolean;
  resizingColumn: string | null;
  selectAll: boolean;
  selectAllHydrated: boolean;
  visualSelectionSet: Set<NodeId>;
  batchSelect: (ids: string[], checked: boolean) => void;
  handleResizeStart: (leftColumnId: string, rightColumnId: string, event: ReactMouseEvent) => void;
  handleContainerRef: (node: HTMLDivElement | null) => void;
  handleRowClick: (node: TreeNodeInUI, event: ReactMouseEvent) => void;
  handleRowDoubleClick: (node: TreeNodeInUI, event: ReactMouseEvent) => void;
  contextMenuState: TreeTableContextMenuState;
  handleContextMenuClose: () => void;
  hoverDropTargetId: string | null;
  setHoverDropTargetId: Dispatch<SetStateAction<string | null>>;
  forbiddenTargets: Set<NodeId>;
  setForbiddenTargets: Dispatch<SetStateAction<Set<NodeId>>>;
}

export function useTreeTableCoreModel({
  controller,
  pageNodeId,
  treeId,
  selectAllPersistence,
  selectionIdPrefix,
  depthOffset,
  hideDragHandler,
  disableDragAndDrop,
  useArchiveColumns,
  archiveAction,
  rowClickAction,
  selectionMode,
  IconComponent,
  onRowClick,
  onRowDoubleClick,
  buildSessionIndicator,
  sortMode,
  onSortModeChange,
}: UseTreeTableCoreModelParams): UseTreeTableCoreModelResult {
  const [sorting, setSorting] = useState<SortingState>([]);

  // -- SortMode ↔ TanStack Table sorting integration --
  // Map SortMode values to TanStack Table column IDs and vice versa.
  const SORT_MODE_TO_COLUMN: Record<string, { id: string; desc: boolean } | null> = {
    none: null,
    name: { id: 'name', desc: false },
    created: { id: 'createdAt', desc: true },
    modified: { id: 'updatedAt', desc: true },
    // These SortMode values have no corresponding table column:
    type: null,
    lastOpened: null,
    size: null,
    tag: null,
  };

  // Sync external sortMode → internal sorting state
  useEffect(() => {
    if (sortMode === undefined) return;
    const mapped = SORT_MODE_TO_COLUMN[sortMode];
    if (mapped === null || mapped === undefined) {
      setSorting([]);
    } else {
      setSorting([mapped]);
    }
  }, [sortMode]);
  const [contextMenuState, setContextMenuState] = useState<TreeTableContextMenuState>({
    anchorEl: null,
    anchorPosition: null,
    node: null,
  });
  const [hoverDropTargetId, setHoverDropTargetId] = useState<string | null>(null);
  const [forbiddenTargets, setForbiddenTargets] = useState<Set<NodeId>>(new Set());

  const structure = useTreeTableStructure({ controller });
  const {
    columnWidths,
    setContainerElement,
    setObserverTarget,
    handleResizeStart,
    resizingColumn,
    columnWidthsReady,
  } = useTreeTableColumnWidths({ pageNodeId });

  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
    const parent = node?.parentElement ?? null;
    const grandParent = parent?.parentElement ?? null;
    setObserverTarget(grandParent ?? parent ?? null);
  }, [setContainerElement, setObserverTarget]);

  const { selectAll, selectAllHydrated, setSelectAll } = useTreeTableSelectAll({
    pageNodeId,
    persistence: selectAllPersistence,
  });

  const {
    editingNodeId,
    setEditingNodeId,
    editingField,
    setEditingField,
    editingValue,
    editingError,
    setEditingError,
    validateInline,
    handleStartEdit,
  } = useTreeTableEditing({ controller });

  const {
    visualSelectionSet,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    batchSelect,
  } = useTreeTableSelectionOverlay({
    data: structure.data,
    rowSelection: structure.rowSelection,
    selectAll,
    selectAllHydrated,
    setSelectAll,
    controller,
    visibleData: structure.visibleData,
    getDescendants: structure.getDescendants,
  });

  const { handleRowClick, handleRowDoubleClick } = useTreeTableRowInteractions({
    controller,
    rowSelection: structure.rowSelection,
    selectionMode,
    rowClickAction,
    onRowClick,
    onRowDoubleClick,
    selectAll,
    handleStartEdit,
  });

  const { t: selectAllT } = useTranslation('common', { keyPrefix: 'treeTable.selectAll' });
  const { t: commonT, i18n } = useTranslation('common');
  const languageKey = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';

  const formatTimestamp = useCallback(
    (value?: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '-';
      }
      const target = new Date(value);
      if (Number.isNaN(target.getTime())) {
        return '-';
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const diffMs = startOfToday.getTime() - startOfTarget.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const diffDays = Math.floor(diffMs / dayMs);

      const timeFormatOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
      if (languageKey.startsWith('ja')) {
        timeFormatOptions.hour12 = false;
      }
      const timeFormatter = new Intl.DateTimeFormat(languageKey, timeFormatOptions);
      const time = timeFormatter.format(target);

      if (diffDays === 0) {
        return commonT('treeTable.timestamps.today', { time });
      }
      if (diffDays === 1) {
        return commonT('treeTable.timestamps.yesterday', { time });
      }
      if (diffDays === 2) {
        return commonT('treeTable.timestamps.twoDaysAgo', { time });
      }

      const dateFormatter = new Intl.DateTimeFormat(languageKey, {
        year: 'numeric',
        month: languageKey.startsWith('ja') ? 'numeric' : 'long',
        day: 'numeric',
      });
      const date = dateFormatter.format(target);
      return commonT('treeTable.timestamps.dateTime', { date, time });
    },
    [commonT, languageKey],
  );

  const columns = useMemo(() => {
    const draftIds = new Set(
      structure.rawData
        .filter((node) => (node as { version?: number }).version === 0)
        .map((node) => node.id as string as NodeId),
    );

    const removedLabel = (commonT('treeTable.columns.removed', 'Removed') ?? 'Removed') as string;
    const nameLabel = (commonT('treeTable.columns.name', 'Name') ?? 'Name') as string;
    const descriptionLabel = (commonT('treeTable.columns.description', 'Description') ?? 'Description') as string;
    const createdLabel = (commonT('treeTable.columns.created', 'Created') ?? 'Created') as string;
    const updatedLabel = (commonT('treeTable.columns.updated', 'Updated') ?? 'Updated') as string;

    return createTreeTableColumns({
      draftFlags: {
        hasDraft: draftIds,
        hasDescendantDraft: (nodeId: NodeId) => {
          const descendants = structure.collectDescendantIds(nodeId);
          return descendants.some((id) => draftIds.has(id as NodeId));
        },
      },
      draftChipLabels: {
        self: commonT('treeTable.chips.draftSelf', 'Draft'),
        descendant: {
          singular: commonT('treeTable.chips.draftDescendantSingular', 'Draft in Subtree'),
          plural: commonT('treeTable.chips.draftDescendantPlural', 'Drafts in Subtree'),
        },
      },
      buildRequiredChipLabel: commonT('treeTable.chips.buildRequired', 'Build Required'),
      columnWidths,
      selectAll,
      allRowsSelected,
      someSelected,
      handleSelectAll,
      pageNodeId,
      selectAllHydrated,
      selectAllLabels: {
        select: selectAllT('select'),
        clear: selectAllT('clear'),
      },
      hasSelectedAncestor: structure.hasSelectedAncestor,
      rowSelection: structure.rowSelection,
      collectDescendantIds: structure.collectDescendantIds,
      batchSelect,
      depthOffset,
      nodesWithChildren: structure.nodesWithChildren,
      expandedRowIds: structure.expandedRowIds,
      editingNodeId,
      hideDragHandler,
      disableDragAndDrop,
      IconComponent,
      iconInteractive: !useArchiveColumns,
      rowClickAction,
      selectionMode,
      controller,
      validateInline,
      handleStartEdit,
      editingField,
      editingValue,
      editingError,
      setEditingError,
      setEditingNodeId,
      setEditingField,
      treeId,
      setContextMenuState,
      visualSelectionSet,
      useArchiveColumns,
      archiveAction,
      formatTimestamp,
      archiveRemovedHeader: useArchiveColumns ? removedLabel : undefined,
      selectionIdPrefix,
      columnLabels: {
        name: nameLabel,
        description: descriptionLabel,
        created: createdLabel,
        updated: updatedLabel,
        removed: removedLabel,
      },
      validationMessages: {
        invalidName: commonT('treeTable.validation.invalidName', 'Invalid name'),
        invalidDescription: commonT('treeTable.validation.invalidDescription', 'Invalid description'),
      },
      placeholders: {
        nameEdit: commonT('treeTable.placeholders.nameConfirm', 'Press Enter to confirm / Esc to cancel'),
        descriptionEdit: commonT(
          'treeTable.placeholders.descriptionConfirm',
          'Press Ctrl+Enter to confirm / Esc to cancel',
        ),
      },
      emptyValue: commonT('treeTable.emptyCell', '-'),
      buildSessionIndicator,
    });
  }, [
    structure,
    commonT,
    columnWidths,
    selectAll,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    pageNodeId,
    selectAllHydrated,
    selectAllT,
    batchSelect,
    depthOffset,
    editingNodeId,
    hideDragHandler,
    disableDragAndDrop,
    IconComponent,
    useArchiveColumns,
    rowClickAction,
    selectionMode,
    controller,
    validateInline,
    handleStartEdit,
    editingField,
    editingValue,
    editingError,
    setEditingError,
    setEditingNodeId,
    setEditingField,
    treeId,
    visualSelectionSet,
    archiveAction,
    formatTimestamp,
    selectionIdPrefix,
    buildSessionIndicator,
  ]);

  const expandedState = useMemo(() => {
    const record: Record<string, boolean> = {};
    structure.expandedRowIds.forEach((id) => {
      record[String(id)] = true;
    });
    return record;
  }, [structure.expandedRowIds]);

  const table = useReactTable({
    data: structure.tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSubRows: structure.getSubRows,
    getRowId: (row) => String(row.id ?? ''),
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
    state: {
      rowSelection: structure.rowSelection,
      sorting,
      expanded: expandedState,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      // Sync back to external sortMode atom (SSOT)
      if (onSortModeChange) {
        if (next.length === 0) {
          onSortModeChange('none');
        } else {
          const first = next[0];
          if (first) {
            const mapped = COLUMN_ID_TO_SORT_MODE[first.id];
            if (mapped) {
              onSortModeChange(mapped);
            }
          }
        }
      }
    },
    onRowSelectionChange: (updater) => {
      if (selectAll) return;
      if (typeof updater === 'function') {
        const nextSelection = updater(structure.rowSelection);
        const selectedIds = Object.keys(nextSelection).filter((id) => nextSelection[id]);
        controller?.onNodeSelect?.(selectedIds, true);
      }
    },
  });

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({ anchorEl: null, anchorPosition: null, node: null });
  }, []);

  return {
    table,
    structure,
    columns,
    columnWidths,
    columnWidthsReady,
    resizingColumn,
    selectAll,
    selectAllHydrated,
    visualSelectionSet,
    batchSelect,
    handleResizeStart,
    handleContainerRef,
    handleRowClick,
    handleRowDoubleClick,
    contextMenuState,
    handleContextMenuClose,
    hoverDropTargetId,
    setHoverDropTargetId,
    forbiddenTargets,
    setForbiddenTargets,
  };
}

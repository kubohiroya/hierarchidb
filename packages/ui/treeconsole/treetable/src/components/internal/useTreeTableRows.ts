import type { NodeId } from '@hierarchidb/core-types';
import type { SxProps } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { darken } from '@mui/material/styles';
import { useCallback } from 'react';

interface UseTreeTableRowsParams {
  selectAll: boolean;
  selectAllHydrated: boolean;
  hasSelectedAncestor: (nodeId: NodeId) => boolean;
  collectDescendantIds: (nodeId: NodeId) => string[];
  batchSelect: (ids: string[], checked: boolean) => void;
  depthOffset: number;
  pageNodeId?: string;
  hoverDropTargetId: string | null;
  setHoverDropTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  forbiddenTargets: Set<NodeId>;
  setForbiddenTargets: React.Dispatch<React.SetStateAction<Set<NodeId>>>;
  getDescendants: (nodeId: NodeId) => Set<NodeId>;
  controller:
    | { onMoveNodes?: (nodes: string[], target: string) => void | Promise<void> }
    | undefined;
  disableDragAndDrop: boolean;
  visualSelectionSet: Set<NodeId>;
  useArchiveColumns: boolean;
}

export interface FallbackRowState {
  inheritedSelection: boolean;
  visuallyChecked: boolean;
  disableCheckbox: boolean;
  indentDepth: number;
}

export interface RowRenderState {
  isSelected: boolean;
  isBlockedTarget: boolean;
  appliedRowSx: SxProps<Theme>;
  ariaDisabled: true | undefined;
  title: string | undefined;
}

export function getArchiveRowSx(theme: Theme): Record<string, unknown> {
  if (theme.palette.mode !== 'dark') {
    return {};
  }

  const base = darken(theme.palette.background.paper, 0.08);
  const hover = darken(theme.palette.background.paper, 0.14);

  return {
    backgroundColor: base,
    '&:hover': {
      backgroundColor: hover,
    },
  };
}

export function useTreeTableRows({
  selectAll,
  selectAllHydrated,
  hasSelectedAncestor,
  collectDescendantIds,
  batchSelect,
  depthOffset,
  pageNodeId,
  hoverDropTargetId,
  setHoverDropTargetId,
  forbiddenTargets,
  setForbiddenTargets,
  getDescendants,
  controller,
  disableDragAndDrop,
  visualSelectionSet,
  useArchiveColumns,
}: UseTreeTableRowsParams) {
  const getFallbackRowState = useCallback(
    (nodeId: NodeId, nodeDepth?: number): FallbackRowState => {
      const inheritedSelection = hasSelectedAncestor(nodeId);
      const visuallyChecked = selectAll || visualSelectionSet.has(nodeId);
      const disableCheckbox =
        selectAll || inheritedSelection || (!!pageNodeId && !selectAllHydrated);
      const baseDepth = Math.max(0, (nodeDepth ?? 1) + depthOffset - 1);
      const indentDepth = useArchiveColumns ? Math.max(0, baseDepth - 1) : baseDepth;

      return {
        inheritedSelection,
        visuallyChecked,
        disableCheckbox,
        indentDepth,
      };
    },
    [
      depthOffset,
      hasSelectedAncestor,
      pageNodeId,
      selectAll,
      selectAllHydrated,
      useArchiveColumns,
      visualSelectionSet,
    ]
  );

  const handleFallbackCheckboxChange = useCallback(
    (nodeId: NodeId, checked: boolean, disabled: boolean) => {
      if (disabled) return;
      const targets = collectDescendantIds(nodeId);
      if (targets.length === 0) return;
      batchSelect(targets, checked);
    },
    [batchSelect, collectDescendantIds]
  );

  const getRowRenderState = useCallback(
    (nodeId: string): RowRenderState => {
      const isSelected = visualSelectionSet.has(nodeId as NodeId) || selectAll;
      const isBlockedTarget = forbiddenTargets.has(nodeId as NodeId);

      const baseRowSx: SxProps<Theme> = {
        cursor: hoverDropTargetId === nodeId && isBlockedTarget ? 'not-allowed' : 'pointer',
        outline:
          hoverDropTargetId === nodeId
            ? isBlockedTarget
              ? '2px dashed rgba(211,47,47,0.7)'
              : '2px dashed rgba(25,118,210,0.6)'
            : 'none',
        outlineOffset: '-2px',
      };

      const appliedRowSx: SxProps<Theme> = useArchiveColumns
        ? (theme: Theme) => ({
            ...getArchiveRowSx(theme),
            ...baseRowSx,
          })
        : baseRowSx;

      const blockedOnHover = hoverDropTargetId === nodeId && isBlockedTarget;

      return {
        isSelected,
        isBlockedTarget,
        appliedRowSx,
        ariaDisabled: blockedOnHover ? true : undefined,
        title: blockedOnHover ? 'Cannot move to descendants' : undefined,
      };
    },
    [forbiddenTargets, hoverDropTargetId, selectAll, useArchiveColumns, visualSelectionSet]
  );

  const createRowDragHandlers = useCallback(
    (nodeId: string) => {
      return {
        onDragStart: (event: React.DragEvent<HTMLTableRowElement>) => {
          if (disableDragAndDrop) return;

          event.dataTransfer?.setData('text/hdb-node', nodeId);
          const descendants = getDescendants(nodeId as NodeId);
          setForbiddenTargets(descendants);

          try {
            event.dataTransfer?.setData(
              'application/hdb-node-descendants',
              JSON.stringify(Array.from(descendants))
            );
          } catch {
            // Keep drag state even if descendants cannot be serialized.
          }
        },
        onDragOver: (event: React.DragEvent<HTMLTableRowElement>) => {
          if (disableDragAndDrop) return;
          if (event.dataTransfer?.types?.includes('text/hdb-node')) {
            const blocked = forbiddenTargets.has(nodeId as NodeId);
            if (!blocked) {
              event.preventDefault();
            }
            setHoverDropTargetId(nodeId);
          }
        },
        onDrop: (event: React.DragEvent<HTMLTableRowElement>) => {
          if (disableDragAndDrop) return;

          const sourceId = event.dataTransfer?.getData('text/hdb-node');
          const targetId = nodeId;
          if (!sourceId || !targetId || sourceId === targetId) return;
          if (forbiddenTargets.has(targetId as NodeId)) return;

          controller?.onMoveNodes?.([sourceId], targetId);
          setHoverDropTargetId(null);
          setForbiddenTargets(new Set<NodeId>());
        },
        onDragEnd: () => {
          if (disableDragAndDrop) return;
          setHoverDropTargetId(null);
          setForbiddenTargets(new Set<NodeId>());
        },
        onDragLeave: () => {
          if (disableDragAndDrop) return;
          setHoverDropTargetId((id) => (id === nodeId ? null : id));
        },
      };
    },
    [
      controller,
      disableDragAndDrop,
      forbiddenTargets,
      getDescendants,
      setForbiddenTargets,
      setHoverDropTargetId,
    ]
  );

  const formatDateValue = useCallback(
    (value: unknown): { dateLabel: string; timeLabel: string } | null => {
      if (!value) return null;

      const date = new Date(value as string | number | Date);
      return {
        dateLabel: date.toLocaleDateString(),
        timeLabel: date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    },
    []
  );

  return {
    getFallbackRowState,
    handleFallbackCheckboxChange,
    getRowRenderState,
    createRowDragHandlers,
    formatDateValue,
  };
}

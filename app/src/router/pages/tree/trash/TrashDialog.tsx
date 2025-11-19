import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import {
  type DialogDisplayMode,
  FRAME_CONSTANTS,
  getViewportSize,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type HeadlessMultiStepDialogProps,
  initialPosition,
  MultiDialogFrame,
  type MultiDialogPosition,
  type MultiDialogSize,
  normalizeDialogState,
  useMultiStepDialogContext,
} from '@hierarchidb/ui-shell/ui-dialog';
import {
  TreeConsolePanel,
  type TreeConsolePanelBreadcrumbRendererProps,
  type TreeConsolePanelProps,
  type TreeNodeData,
  type TreeTableColumn,
  TreeTableSearchInput,
} from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import { DualKeyMap } from '@hierarchidb/util';
import {
  Close as CloseIcon,
  DeleteForever as EmptyTrashIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  RestoreFromTrash as RestoreIcon,
} from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoadTreeReturn } from '~/loader.js';
import { loadTree } from '~/loader.js';
import { WorkerAPIClient } from '~/worker-runtime/WorkerAPIClient.ts';
import { buildTrashBreadcrumbs } from '../trash/buildTrashBreadcrumbs.js';
import { buildTrashTreeData } from '../trash/buildTrashTreeData.js';
import { getTrashDisplayName } from '../trash/getTrashDisplayName.js';
import { TrashBreadcrumb } from '../trash/TrashBreadcrumb.js';
import { emptyTrashBranch } from './emptyTrashBranch.js';

const TRASH_DIALOG_FOOTER_HEIGHT = 72;

// ----------------------------------------
// Loader & data types
// ----------------------------------------

export type TrashDialogRouteParams = {
  treeId?: string;
  pageNodeId?: string;
  targetNodeId?: string;
  nodeType?: string;
  action?: string;
};

export async function clientLoader({
  params,
}: {
  params: TrashDialogRouteParams;
}): Promise<TrashDialogData> {
  const { treeId, targetNodeId } = params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }

  const treeData = await loadTree({ treeId });
  if (!treeData.tree) {
    return {
      ...treeData,
      activeTrashNodeId: (targetNodeId as NodeId | undefined) ?? null,
      params,
    } satisfies TrashDialogData;
  }

  const client = treeData.client;
  const queryAPI = await client.getQueryAPI();
  const fallbackTrashId = treeData.tree.trashRootId as NodeId | undefined;
  const activeTrashNodeId = (targetNodeId as NodeId | undefined) ?? fallbackTrashId;
  if (!activeTrashNodeId) {
    throw new Response('Trash root not found.', { status: 404 });
  }

  const trashRootNode = fallbackTrashId ? await queryAPI.getNode(fallbackTrashId) : undefined;
  const activeTrashNode = await queryAPI.getNode(activeTrashNodeId);
  const targetDepth = activeTrashNodeId === fallbackTrashId ? 2 : 1;
  const trashItems = (await queryAPI.listChildren(activeTrashNodeId, {
    prefetch: { depth: targetDepth },
  })) as TreeNode[];

  return {
    ...treeData,
    activeTrashNode,
    trashRootNode,
    trashItems,
    activeTrashNodeId,
    params,
  } satisfies TrashDialogData;
}

export type TrashDialogData = LoadTreeReturn & {
  trashRootNode?: TreeNode;
  activeTrashNode?: TreeNode;
  trashItems?: TreeNode[];
  activeTrashNodeId: NodeId | null;
  params: TrashDialogRouteParams;
};

// ----------------------------------------
// Dialog internals
// ----------------------------------------

type TrashStepData = Record<string, never>;

const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };

function createTreeNodeMap(nodes: TreeNode[] | undefined): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  nodes?.forEach((node) => {
    if (node?.id) {
      map.set(String(node.id), node);
    }
  });
  return map;
}

function useTrashFrameState(initialMode: DialogDisplayMode = 'normal') {
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>(initialMode);
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(
    initialPosition(DEFAULT_SIZE, getViewportSize())
  );
  const sizeRef = useRef(dialogSize);
  const positionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback(
    (size: MultiDialogSize, position: MultiDialogPosition) => {
      sizeRef.current = size;
      positionRef.current = position;
      setDialogSize(size);
      setDialogPosition(position);
    },
    []
  );

  const normalizeFromState = useCallback(
    (mode: DialogDisplayMode, nextSize?: MultiDialogSize, nextPosition?: MultiDialogPosition) => {
      const viewport = getViewportSize();
      const baseSize = nextSize ?? sizeRef.current;
      const basePosition = nextPosition ?? positionRef.current;
      const options = {
        enforceTopLeftMargin: mode === 'normal',
        minPosition: mode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      } as const;
      return normalizeDialogState(baseSize, basePosition, viewport, options);
    },
    []
  );

  const ensureFitsViewport = useCallback(
    (mode: DialogDisplayMode) => {
      const normalized = normalizeFromState(mode);
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, normalizeFromState]
  );

  useEffect(() => {
    ensureFitsViewport(displayMode);
  }, [displayMode, ensureFitsViewport]);

  useEffect(() => {
    const handleResize = () => {
      ensureFitsViewport(displayMode);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMode, ensureFitsViewport]);

  const transitionDisplayMode = useCallback(
    (mode: DialogDisplayMode) => {
      const viewport = getViewportSize();
      if (mode === 'full-screen') {
        const size: MultiDialogSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(size, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const normalized = normalizeDialogState(
          {
            width: Math.max(
              viewport.width - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2,
              FRAME_CONSTANTS.MIN_DIALOG_WIDTH
            ),
            height: Math.max(
              viewport.height - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2,
              FRAME_CONSTANTS.MIN_DIALOG_HEIGHT
            ),
          },
          { x: FRAME_CONSTANTS.NON_STANDARD_MARGIN, y: FRAME_CONSTANTS.NON_STANDARD_MARGIN },
          viewport,
          {
            enforceTopLeftMargin: false,
            minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
            clampSizeToViewport: true,
          }
        );
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const preset = normalizeDialogState(
          DEFAULT_SIZE,
          initialPosition(DEFAULT_SIZE, viewport),
          viewport,
          { enforceTopLeftMargin: true }
        );
        applyNormalizedState(preset.size, preset.position);
      }
      setDisplayMode(mode);
    },
    [applyNormalizedState]
  );

  const handleSizeChange = useCallback(
    (size?: MultiDialogSize) => {
      if (!size) return;
      const normalized = normalizeDialogState(size, positionRef.current, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, displayMode]
  );

  const handlePositionChange = useCallback(
    (position?: MultiDialogPosition) => {
      if (!position) return;
      const normalized = normalizeDialogState(dialogSize, position, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, dialogSize, displayMode]
  );

  return {
    displayMode,
    dialogSize,
    dialogPosition,
    sizeRef,
    positionRef,
    setDisplayMode: transitionDisplayMode,
    setSize: handleSizeChange,
    setPosition: handlePositionChange,
  } as const;
}

// ----------------------------------------
// Presentation components
// ----------------------------------------

interface TrashDialogHeaderProps extends HeadlessHeaderRenderProps<TrashStepData> {
  title: string;
}

function TrashDialogHeader({
  title,
  displayMode,
  onDisplayModeChange,
  onRequestClose,
  isDirty,
}: TrashDialogHeaderProps) {
  const ctx = useMultiStepDialogContext<TrashStepData>();

  const handleDragPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      ctx.onDragHandlePointerDown?.(event);
    },
    [ctx]
  );

  const stopPropagation = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <Box
      data-dialog-drag-handle="true"
      onPointerDown={handleDragPointerDown}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: theme.palette.divider,
        gap: 2,
        cursor: ctx.displayMode === 'full-screen' ? 'default' : 'move',
        userSelect: 'none',
        transition: theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shorter,
        }),
        backgroundColor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.04)
            : theme.palette.background.paper,
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.1)
              : theme.palette.action.hover,
        },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box
          component="span"
          sx={{ fontSize: 24, lineHeight: 1, pointerEvents: 'none' }}
          aria-hidden
        >
          🗑️
        </Box>
        <Typography variant="h6" noWrap>
          {title}
        </Typography>
        {isDirty && (
          <Typography variant="caption" color="text.secondary">
            Unsaved changes
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton
          size="small"
          onClick={() => onDisplayModeChange?.(displayMode === 'maximize' ? 'normal' : 'maximize')}
          onPointerDown={stopPropagation}
        >
          {displayMode === 'maximize' ? (
            <RestoreIcon fontSize="small" />
          ) : (
            <OpenInFullIcon fontSize="small" />
          )}
        </IconButton>
        <IconButton
          size="small"
          onClick={() =>
            onDisplayModeChange?.(displayMode === 'full-screen' ? 'normal' : 'full-screen')
          }
          onPointerDown={stopPropagation}
        >
          {displayMode === 'full-screen' ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <FullscreenIcon fontSize="small" />
          )}
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onRequestClose('close')}
          onPointerDown={stopPropagation}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

interface TrashDialogFooterProps extends HeadlessFooterRenderProps<TrashStepData> {
  mode: 'restore' | 'empty';
  totalCount: number;
  selectedCount: number;
  loading: boolean;
  onRestore: () => void;
  onEmptyAll: () => void;
}

function TrashDialogFooter({
  mode,
  totalCount,
  selectedCount,
  loading,
  onRestore,
  onEmptyAll,
  onRequestClose,
}: TrashDialogFooterProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const handleConfirmOpen = () => setConfirmOpen(true);
  const handleConfirmClose = () => setConfirmOpen(false);
  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onEmptyAll();
  };

  const isRestoreMode = mode === 'restore';
  const restoreDisabled = loading || selectedCount === 0;
  const emptyDisabled = loading || totalCount === 0;
  const restoreUnit = t('trash.dialog.units.item', { count: selectedCount });
  const emptyUnit = t('trash.dialog.units.item', { count: totalCount });
  const restoreLabel =
    selectedCount === 0
      ? t('trash.dialog.buttons.restore')
      : t('trash.dialog.buttons.restoreWithCount', { count: selectedCount });
  const emptyLabel =
    totalCount === 0
      ? t('trash.dialog.buttons.empty')
      : t('trash.dialog.buttons.emptyWithCount', { count: totalCount });
  const restoreAria =
    selectedCount === 0
      ? t('trash.dialog.aria.restore')
      : t('trash.dialog.aria.restoreWithCount', { count: selectedCount, unit: restoreUnit });
  const emptyAria =
    totalCount === 0
      ? t('trash.dialog.aria.empty')
      : t('trash.dialog.aria.emptyWithCount', { count: totalCount, unit: emptyUnit });

  const confirmTitleId = useId();
  const confirmContentId = useId();

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1.5,
          minHeight: TRASH_DIALOG_FOOTER_HEIGHT,
        }}
      >
        <Button variant="contained" color="inherit" onClick={() => onRequestClose('close')}>
          {t('trash.dialog.buttons.cancel')}
        </Button>
        {isRestoreMode ? (
          <Button
            variant="contained"
            startIcon={<RestoreIcon />}
            disabled={restoreDisabled}
            onClick={onRestore}
            aria-label={restoreAria}
          >
            {restoreLabel}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={<EmptyTrashIcon />}
            onClick={handleConfirmOpen}
            disabled={emptyDisabled}
            aria-label={emptyAria}
          >
            {emptyLabel}
          </Button>
        )}
      </Box>
      <Dialog
        BackdropProps={{
          sx: {
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 15,
          },
        }}
        sx={{
          zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 20,
          '& .MuiDialog-container': {
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 16,
          },
          '& .MuiPaper-root': {
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 17,
          },
        }}
        open={confirmOpen}
        onClose={handleConfirmClose}
        aria-labelledby={confirmTitleId}
        aria-describedby={confirmContentId}
      >
        <DialogTitle id={confirmTitleId}>{t('trash.dialog.confirm.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id={confirmContentId}>
            {totalCount === 0
              ? t('trash.dialog.confirm.empty')
              : t('trash.dialog.confirm.description', { count: totalCount, unit: emptyUnit })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} color="inherit">
            {t('trash.dialog.buttons.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={emptyDisabled}
          >
            {t('trash.dialog.buttons.confirmDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface TrashDialogContentProps {
  loading: boolean;
  treeData: TreeNodeData[];
  columns: TreeTableColumn[];
  breadcrumbItems: BreadcrumbNode[];
  selectedIds: NodeId[];
  setSelectedIds: (updater: (prev: NodeId[]) => NodeId[]) => void;
  treeId?: string;
  pageNodeId?: NodeId | null;
  trashViewRootId?: NodeId | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  mode: 'restore' | 'empty';
  onRestore: () => void;
  expandedIds: string[];
  onToggleExpand: (nodeId: string, expanded: boolean) => void;
  nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
}

function TrashDialogContent({
  loading,
  treeData,
  columns,
  breadcrumbItems,
  selectedIds,
  setSelectedIds,
  treeId,
  pageNodeId,
  trashViewRootId,
  searchTerm,
  onSearchTermChange,
  mode,
  expandedIds,
  onToggleExpand,
  nodeIndex,
}: TrashDialogContentProps) {
  const { t } = useTranslation();
  const filteredTreeData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return treeData;
    return treeData.filter((node) => {
      const name = getTrashDisplayName(node).toLowerCase();
      const type = (node.nodeType ?? '').toLowerCase();
      return name.includes(term) || type.includes(term);
    });
  }, [treeData, searchTerm]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        marginTop: '8px',
        marginBottom: `${TRASH_DIALOG_FOOTER_HEIGHT}px`,
      }}
    >
      <Box sx={{ px: 2, pt: 0, pb: 1 }}>
        <TreeTableSearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          onClear={() => onSearchTermChange('')}
          placeholder={t('trash.dialog.searchPlaceholder') ?? ''}
          sx={{ width: 260 }}
        />
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          '& > *': {
            height: '100%',
          },
        }}
      >
        <TreeConsolePanel
          title={t('trash.dialog.panelTitle') ?? ''}
        treeId={treeId}
        pageNodeId={pageNodeId ? String(pageNodeId) : undefined}
        subtreeRootId={trashViewRootId ? String(trashViewRootId) : undefined}
        data={filteredTreeData}
        nodeIndex={nodeIndex}
          columns={columns}
          breadcrumbItems={breadcrumbItems}
          loading={false}
          selectedIds={selectedIds.map(String)}
          expandedIds={expandedIds}
        viewMode="list"
        canCreate={false}
        canEdit={false}
        canTrash={mode === 'empty'}
        useTrashColumns
        selectAllPersistence="session"
        trashAction={mode}
        hideDragHandler
          breadcrumbRenderer={({
            defaultRendererProps,
          }: TreeConsolePanelBreadcrumbRendererProps) => (
            <TrashBreadcrumb {...defaultRendererProps} />
          )}
          onNodeClick={(_node: TreeNodeData) => undefined}
          onNodeSelect={(nodeIds: string[], selected: boolean) => {
            const branded = nodeIds.map((id) => id as NodeId);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              branded.forEach((id) => {
                if (selected) {
                  next.add(id);
                } else {
                  next.delete(id);
                }
              });
              return Array.from(next);
            });
          }}
          onNodeExpand={(nodeId: string, expanded: boolean) =>
            onToggleExpand(String(nodeId), expanded)
          }
          availableFilters={[]}
          searchTerm={searchTerm}
          onSearchChange={onSearchTermChange}
          onSearchClear={() => onSearchTermChange('')}
          onCreate={() => undefined}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onRefresh={() => undefined}
          onExpandAll={() => undefined}
          onCollapseAll={() => undefined}
          onSort={(_columnId: string) => undefined}
          onFilterChange={(_filter: string) => undefined}
          onViewModeChange={(_mode: 'list' | 'grid') => undefined}
          onBreadcrumbNavigate={(
            _nodeId: string,
            _node?: TreeConsolePanelProps['breadcrumbItems'][number]
          ) => undefined}
          onContextMenuAction={(
            _action: string,
            _node: TreeNodeData,
            _options?: { navigateToParent?: boolean }
          ) => undefined}
          onStartTour={undefined}
          onMoveNodes={(_ids: string[], _target: string) => undefined}
        />
      </Box>
    </Box>
  );
}

// ----------------------------------------
// Main component
// ----------------------------------------

export interface TrashDialogProps {
  data: TrashDialogData;
  params: TrashDialogRouteParams;
}

export function TrashDialog({ data, params }: TrashDialogProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const treeId = data.tree?.id;
  const pageNodeIdParam = params.pageNodeId as NodeId | undefined;
  const targetNodeId = params.targetNodeId as NodeId | undefined;
  const action = params.action;
  const mode: 'restore' | 'empty' = action === 'empty' ? 'empty' : 'restore';
  const pageNodeId = (pageNodeIdParam ??
    (data.tree?.rootId as NodeId | undefined) ??
    null) as NodeId | null;
  const trashViewRootId = (data.activeTrashNodeId ??
    targetNodeId ??
    data.trashRootNode?.id ??
    null) as NodeId | null;
  const trashContainerRootId = (data.trashRootNode?.id ?? null) as NodeId | null;

  /*
  const isTrashContainerRoot =
    Boolean(trashViewRootId) && Boolean(trashContainerRootId)
      ? trashViewRootId === trashContainerRootId
      : false;
   */

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const stepComponents = useMemo(
    () =>
      [
        {
          id: 'trash-root',
          label: t('trash.dialog.stepLabel'),
          component: () => null,
        },
      ] as const,
    [t]
  );

  const nodeMap = useMemo(() => {
    const map = createTreeNodeMap(data.trashItems);
    if (data.trashRootNode?.id) {
      map.set(String(data.trashRootNode.id), data.trashRootNode);
    }
    if (data.activeTrashNode?.id) {
      map.set(String(data.activeTrashNode.id), data.activeTrashNode);
    }
    return map;
  }, [data.activeTrashNode, data.trashItems, data.trashRootNode]);

  const treeData = useMemo(() => {
    const viewRoot = data.activeTrashNode ?? data.trashRootNode;
    if (!viewRoot) return [] as TreeNodeData[];

    const { nodes } = buildTrashTreeData({ treeId: treeId ?? '', rootNode: viewRoot, nodeMap });
    if (trashViewRootId && !nodes.some((node) => node.id === trashViewRootId)) {
      const source = nodeMap.get(String(trashViewRootId));
      if (source) {
        nodes.unshift({
          id: source.id as NodeId,
          parentId: (source.parentId ?? trashViewRootId) as NodeId,
          nodeType: source.nodeType,
          name: getTrashDisplayName(source),
          depth: typeof source.depth === 'number' ? source.depth : 0,
          originalName: (source as { originalName?: string }).originalName,
          originalParentId: (source as { originalParentId?: NodeId }).originalParentId,
          removedAt: (source as { removedAt?: number }).removedAt,
          holderType: 'trash',
          holderTargetId: source.id as NodeId,
          holderMetaParentId: (source as { originalParentId?: NodeId }).originalParentId,
          hasChildren: Boolean(source.hasChildren),
          description: source.description,
          createdAt: source.createdAt,
          updatedAt: source.updatedAt,
          version: source.version,
        });
      }
    }
    return nodes;
  }, [data.activeTrashNode, data.trashRootNode, nodeMap, trashViewRootId, treeId]);

  /*
  const removableCount = useMemo(() => {
    return treeData.filter((node) => node.id !== trashViewRootId).length;
  }, [treeData, trashViewRootId]);
   */

  const removalNodeIds = useMemo(() => {
    if (mode !== 'empty') {
      return selectedIds;
    }
    return selectedIds;
  }, [mode, selectedIds]);
  const removalTargetCount = removalNodeIds.length;
  //const hasRemovalTargets = removalTargetCount > 0;

  useEffect(() => {
    if (mode !== 'empty') {
      return;
    }
    setSelectedIds((prev) => {
      const next = treeData.map((node) => node.id as NodeId);
      const nextSet = new Set(next);
      const filtered = prev.filter((id) => nextSet.has(id));
      if (filtered.length > 0) {
        return filtered;
      }
      return next;
    });
  }, [mode, treeData]);

  const nodeIndex = useMemo(() => {
    const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
    const fallbackParent = (trashViewRootId ??
      (data.trashRootNode?.id as NodeId | undefined) ??
      'trash-root') as NodeId;

    if (trashViewRootId) {
      const branchNode = nodeMap.get(String(trashViewRootId)) ?? data.trashRootNode;
      if (branchNode) {
        const parentForRoot = (branchNode.parentId ?? trashViewRootId) as NodeId;
        index.set(trashViewRootId, branchNode, parentForRoot);
      }
    }

    treeData.forEach((node) => {
      const primary = node.id as NodeId;
      const sourceNode = nodeMap.get(String(node.id)) ?? (node as unknown as TreeNode);
      const parent = (node.parentId ?? fallbackParent) as NodeId;
      index.set(primary, sourceNode, parent);
    });
    return index;
  }, [data.trashRootNode, nodeMap, trashViewRootId, treeData]);

  const breadcrumbItems = useMemo(() => {
    const breadcrumbRoot = data.trashRootNode ?? data.activeTrashNode;
    if (!breadcrumbRoot || !treeId) return [];
    return buildTrashBreadcrumbs({
      treeId,
      rootNode: breadcrumbRoot,
      targetNodeId: trashViewRootId,
      nodeMap,
    });
  }, [data.activeTrashNode, data.trashRootNode, nodeMap, trashViewRootId, treeId]);

  const locale = useMemo(
    () => i18n.resolvedLanguage ?? i18n.language ?? 'en',
    [i18n.language, i18n.resolvedLanguage]
  );

  const formatTrashTimestamp = useCallback(
    (input?: unknown): string => {
      const numeric =
        typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : undefined;
      if (!numeric || Number.isNaN(numeric)) {
        return '-';
      }

      const target = new Date(numeric);
      if (Number.isNaN(target.getTime())) {
        return '-';
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const diffMs = startOfToday.getTime() - startOfTarget.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const diffDays = Math.floor(diffMs / dayMs);

      const timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: locale.startsWith('ja') ? false : undefined,
      });
      const time = timeFormatter.format(target);

      if (diffDays === 0) {
        return t('trash.timestamps.today', { time });
      }
      if (diffDays === 1) {
        return t('trash.timestamps.yesterday', { time });
      }
      if (diffDays === 2) {
        return t('trash.timestamps.twoDaysAgo', { time });
      }

      const dateFormatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: locale.startsWith('ja') ? 'numeric' : 'long',
        day: 'numeric',
      });
      const date = dateFormatter.format(target);
      return t('trash.timestamps.dateTime', { date, time });
    },
    [locale, t]
  );

  const columns: TreeTableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('trash.columns.name'),
        sortable: true,
        width: 300,
        render: (_value: unknown, node: TreeNodeData) => getTrashDisplayName(node),
      },
      {
        id: 'nodeType',
        label: t('trash.columns.type'),
        sortable: true,
        width: 160,
        render: (_value: unknown, node: TreeNodeData) => node.nodeType,
      },
      {
        id: 'removedAt',
        label: t('trash.columns.removedAt'),
        sortable: true,
        width: 200,
        render: (_value: unknown, node: TreeNodeData) => {
          const typed = node as TreeNodeData & {
            removedAt?: number | string;
            deletedAt?: number | string;
          };
          return formatTrashTimestamp(typed.removedAt ?? typed.deletedAt);
        },
      },
    ],
    [formatTrashTimestamp, t]
  );

  const closeDialog = useCallback(
    (options?: { reload?: boolean }) => {
      const shouldReload = Boolean(options?.reload);
      const rootNodeId = treeId ? (`${treeId}:root` as NodeId) : null;
      const normalizedPageId =
        treeId && pageNodeId && rootNodeId && pageNodeId !== rootNodeId ? pageNodeId : null;
      if (treeId) {
        const destination = normalizedPageId ? `/t/${treeId}/${normalizedPageId}` : `/t/${treeId}`;
        navigate({ to: destination, replace: true });
        if (shouldReload) {
          window.setTimeout(() => window.location.reload(), 0);
        }
        return;
      }
      window.history.back();
      if (shouldReload) {
        window.setTimeout(() => window.location.reload(), 0);
      }
    },
    [navigate, pageNodeId, treeId]
  );

  const handleClose = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const frameState = useTrashFrameState('normal');

  const handleRestore = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const client = WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const result = await mutationAPI.restoreNodesFromTrash({ nodeIds: selectedIds });
      if (!result.success) {
        console.error('Restore failed:', result.error);
        return;
      }
      closeDialog({ reload: true });
    } catch (error) {
      console.error('Error restoring trash nodes:', error);
    } finally {
      setLoading(false);
    }
  }, [closeDialog, selectedIds]);

  const handleEmptyAll = useCallback(async () => {
    if (removalNodeIds.length === 0) {
      return;
    }
    setLoading(true);
    try {
      const result = await emptyTrashBranch({
        nodeIds: removalNodeIds,
        getMutationAPI: async () => {
          const client = WorkerAPIClient.getSingleton();
          return client.getMutationAPI();
        },
      });
      if (result.success) {
        closeDialog({ reload: true });
      }
    } finally {
      setLoading(false);
    }
  }, [closeDialog, removalNodeIds]);

  const onToggleExpand = useCallback((nodeId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const set = new Set(prev);
      if (expanded) {
        set.add(nodeId);
      } else {
        set.delete(nodeId);
      }
      return Array.from(set);
    });
  }, []);

  const headlessProps: HeadlessMultiStepDialogProps<TrashStepData> = useMemo(
    () => ({
      open: true,
      stepComponents,
      stepData: {},
      onStepDataChange: () => undefined,
      activeStepIndex: 0,
      onStepNavigate: () => undefined,
      onRequestClose: () => handleClose(),
      isDirty: selectedIds.length > 0,
      position: frameState.dialogPosition,
      size: frameState.dialogSize,
      displayMode: frameState.displayMode,
      onPositionChange: (next) => frameState.setPosition(next),
      onSizeChange: (next) => frameState.setSize(next),
      onDisplayModeChange: (mode) => frameState.setDisplayMode(mode),
      renderHeader: (props) => (
        <TrashDialogHeader
          {...props}
          title={
            mode === 'restore' ? t('trash.dialog.title.restore') : t('trash.dialog.title.empty')
          }
        />
      ),
      renderContent: (_props: HeadlessContentRenderProps<TrashStepData>) => (
        <TrashDialogContent
          loading={loading}
          treeData={treeData}
          columns={columns}
          breadcrumbItems={breadcrumbItems}
          selectedIds={selectedIds}
          setSelectedIds={(updater) => setSelectedIds(updater)}
          treeId={treeId}
          pageNodeId={pageNodeId}
          trashViewRootId={trashViewRootId}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          mode={mode}
          onRestore={handleRestore}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          nodeIndex={nodeIndex}
        />
      ),
      renderFooter: (props: HeadlessFooterRenderProps<TrashStepData>) => (
        <TrashDialogFooter
          {...props}
          mode={mode}
          totalCount={removalTargetCount}
          selectedCount={selectedIds.length}
          loading={loading}
          onRestore={handleRestore}
          onEmptyAll={handleEmptyAll}
        />
      ),
    }),
    [breadcrumbItems, columns, expandedIds, frameState, handleClose, handleEmptyAll, handleRestore, loading, mode, nodeIndex, onToggleExpand, pageNodeId, removalTargetCount, searchTerm, selectedIds, stepComponents, t, trashViewRootId, treeData, treeId]
  );

  const frameSx = useMemo(
    () => ({
      borderRadius: frameState.displayMode === 'full-screen' ? 0 : 4,
      boxShadow:
        frameState.displayMode === 'full-screen' ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
      maxWidth:
        frameState.displayMode === 'full-screen' ? '100%' : 'min(calc(100vw - 48px), 1280px)',
    }),
    [frameState.displayMode]
  );

  return <MultiDialogFrame headlessProps={headlessProps} frameSx={frameSx} />;
}

export default TrashDialog;

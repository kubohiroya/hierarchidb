import type { NodeId, TreeNode, DialogDisplayMode, DialogPosition, DialogSize } from '@hierarchidb/common-types';
import {
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type HeadlessDialogProps as HeadlessMultiStepDialogProps,
  MultiStepDialogFrame,
  useDialogContext,
} from '@hierarchidb/ui-dialog';
import {
  TreeConsolePanel,
  type TreeConsolePanelBreadcrumbRendererProps,
  type TreeConsolePanelProps,
  type HierarchicalTreeNode,
  type TreeTableColumn,
  TreeTableSearchInput,
} from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import {
  Close as CloseIcon,
  DeleteForever as EmptyTrashIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  RestoreFromTrash as RestoreIcon,
} from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import {
  Alert,
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
import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoadTreeReturn } from '~/loader.js';
import { loadTree } from '~/loader.js';
import { getTrashDisplayName } from '../trash/getTrashDisplayName.js';
import { TrashBreadcrumb } from '../trash/TrashBreadcrumb.js';
import { useTrashDialog } from './useTrashDialog.js';
import { DualKeyMap } from '@hierarchidb/util';

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
  const ctx = useDialogContext<TrashStepData>();

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
  hasDraftsInView: boolean;
}

function TrashDialogFooter({
  mode,
  totalCount,
  selectedCount,
  loading,
  onRestore,
  onEmptyAll,
  onRequestClose,
  hasDraftsInView,
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
  const restoreUnit = t('dialogs.trash.units.item', { count: selectedCount });
  const emptyUnit = t('dialogs.trash.units.item', { count: totalCount });
  const restoreLabel =
    selectedCount === 0
      ? t('dialogs.trash.buttons.restore')
      : t('dialogs.trash.buttons.restoreWithCount', { count: selectedCount });
  const emptyLabel =
    totalCount === 0
      ? t('dialogs.trash.buttons.empty')
      : t('dialogs.trash.buttons.emptyWithCount', { count: totalCount });
  const restoreAria =
    selectedCount === 0
      ? t('dialogs.trash.aria.restore')
      : t('dialogs.trash.aria.restoreWithCount', { count: selectedCount, unit: restoreUnit });
  const emptyAria =
    totalCount === 0
      ? t('dialogs.trash.aria.empty')
      : t('dialogs.trash.aria.emptyWithCount', { count: totalCount, unit: emptyUnit });

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
          {t('dialogs.trash.buttons.cancel')}
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
        <DialogTitle id={confirmTitleId}>{t('dialogs.trash.confirm.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id={confirmContentId}>
            {totalCount === 0
              ? t('dialogs.trash.confirm.empty')
              : t('dialogs.trash.confirm.description', { count: totalCount, unit: emptyUnit })}
          </DialogContentText>
          {hasDraftsInView ? (
            <DialogContentText sx={{ mt: 1 }} color="warning.main">
              {t('dialogs.trash.confirm.draftWarning') ??
                'Drafts are present. Emptying the trash will force-delete in-progress edits.'}
            </DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} color="inherit">
            {t('dialogs.trash.buttons.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={emptyDisabled}
          >
            {t('dialogs.trash.buttons.confirmDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface TrashDialogContentProps {
  loading: boolean;
  treeData: HierarchicalTreeNode[];
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
  hasDraftsInView: boolean;
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
  hasDraftsInView,
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
      {hasDraftsInView ? (
        <Box sx={{ px: 2, pt: 1 }}>
          <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
            {t('dialogs.trash.draftWarning') ??
              'Drafts are included in this view. Deleting will force-remove in-progress edits.'}
          </Alert>
        </Box>
      ) : null}
      <Box sx={{ px: 2, pt: 0, pb: 1 }}>
        <TreeTableSearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          onClear={() => onSearchTermChange('')}
          placeholder={t('dialogs.trash.searchPlaceholder') ?? ''}
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
          title={t('dialogs.trash.panelTitle') ?? ''}
        treeId={treeId}
        pageNodeId={pageNodeId ? String(pageNodeId) : undefined}
        subtreeRootId={trashViewRootId ? String(trashViewRootId) : undefined}
        data={filteredTreeData}
        nodeIndex={nodeIndex}
          columnsDeprecated={columns}
          breadcrumbItems={breadcrumbItems}
          loading={false}
          selectedIds={selectedIds.map(String)}
          expandedIds={expandedIds}
        viewMode="list"
        canCreate={false}
        canEdit={false}
        canTrash={mode === 'empty'}
        useTrashColumns
        selectAllIdPrefix="trash-row-selection"
        selectAllPersistence="session"
        trashAction={mode}
        hideDragHandler
          breadcrumbRenderer={({
            defaultRendererProps,
          }: TreeConsolePanelBreadcrumbRendererProps) => (
            <TrashBreadcrumb {...defaultRendererProps} />
          )}
          onNodeClick={(_node: HierarchicalTreeNode) => undefined}
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
            _node: HierarchicalTreeNode,
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
  const {
    t,
    treeId,
    pageNodeId,
    trashViewRootId,
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm,
    expandedIds,
    onToggleExpand,
    loading,
    hasDraftsInView,
    treeData,
    columns,
    breadcrumbItems,
    nodeIndex,
    mode,
    removalTargetCount,
    handleRestore,
    handleEmptyAll,
    closeDialog,
    frameState,
    frameSx,
  } = useTrashDialog(data, params);

  const handleClose = useCallback(() => {
    closeDialog();
  }, [closeDialog]);
  const stepComponents = useMemo(
    () =>
      [
        {
          id: 'trash-root',
          label: t('dialogs.trash.stepLabel'),
          component: () => (
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
              hasDraftsInView={hasDraftsInView}
            />
          ),
        },
      ] as const,
    [breadcrumbItems, columns, expandedIds, handleRestore, hasDraftsInView, loading, mode, nodeIndex, onToggleExpand, pageNodeId, searchTerm, selectedIds, setSearchTerm, setSelectedIds, t, trashViewRootId, treeData, treeId]
  );

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
      onPositionChange: (next: DialogPosition) => frameState.setPosition(next),
      onSizeChange: (next: DialogSize) => frameState.setSize(next),
      onDisplayModeChange: (mode: DialogDisplayMode) => frameState.setDisplayMode(mode),
      renderHeader: (props) => (
        <TrashDialogHeader
          {...props}
          title={
            mode === 'restore'
              ? t('dialogs.trash.title.restore')
              : t('dialogs.trash.title.empty')
          }
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
          hasDraftsInView={hasDraftsInView}
        />
      ),
    }),
    [frameState, handleClose, handleEmptyAll, handleRestore, loading, mode, removalTargetCount, selectedIds, stepComponents, t, hasDraftsInView]
  );

  return <MultiStepDialogFrame headlessProps={headlessProps} frameSx={frameSx} />;
}

export default TrashDialog;

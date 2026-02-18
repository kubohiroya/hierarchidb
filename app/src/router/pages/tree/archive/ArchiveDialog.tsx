import type { NodeId } from '@hierarchidb/core-types';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogSize,
  TreeNode,
} from '@hierarchidb/tree-api';
import {
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type HeadlessDialogProps as HeadlessPluginDialogProps,
  PluginDialogFrame,
  useDialogContext,
} from '@hierarchidb/ui-dialog';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import {
  type HierarchicalTreeNode,
  TreeConsolePanel,
  type TreeConsoleBreadcrumbRendererProps,
  type TreeConsolePanelProps,
  type TreeTableColumn,
} from '@hierarchidb/ui-treeconsole-base';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';
import type { DualKeyMap } from '@hierarchidb/util';
import {
  ArrowBack as ArrowBackIcon,
  DeleteForever as EmptyArchiveIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  Restore as RestoreIcon,
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
import { getArchiveDisplayName } from './getArchiveDisplayName.js';
import { ArchiveBreadcrumb } from './ArchiveBreadcrumb.js';
import { useArchiveDialog } from './useArchiveDialog.js';

const ARCHIVE_DIALOG_FOOTER_HEIGHT = 72;

// ----------------------------------------
// Loader & data types
// ----------------------------------------

export type ArchiveDialogRouteParams = {
  treeId?: string;
  pageNodeId?: string;
  targetNodeId?: string;
  nodeType?: string;
  action?: string;
  mode?: string;
  step?: string;
};

export async function clientLoader({
  params,
}: {
  params: ArchiveDialogRouteParams;
}): Promise<ArchiveDialogData> {
  const { treeId, targetNodeId } = params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }

  const treeData = await loadTree({ treeId });
  if (!treeData.tree) {
    return {
      ...treeData,
      activeArchiveNodeId: (targetNodeId as NodeId | undefined) ?? null,
      params,
    } satisfies ArchiveDialogData;
  }

  const client = treeData.client;
  const queryAPI = await client.getQueryAPI();
  const fallbackArchiveId = treeData.tree.archiveRootId as NodeId | undefined;
  const activeArchiveNodeId = (targetNodeId as NodeId | undefined) ?? fallbackArchiveId;
  if (!activeArchiveNodeId) {
    throw new Response('Archive root not found.', { status: 404 });
  }

  const archiveRootNode = fallbackArchiveId ? await queryAPI.getNode(fallbackArchiveId) : undefined;
  const activeArchiveNode = await queryAPI.getNode(activeArchiveNodeId);
  const targetDepth = activeArchiveNodeId === fallbackArchiveId ? 2 : 1;
  const archiveItems = (await queryAPI.listChildren(activeArchiveNodeId, {
    prefetch: { depth: targetDepth },
  })) as TreeNode[];

  return {
    ...treeData,
    activeArchiveNode,
    archiveRootNode,
    archiveItems,
    activeArchiveNodeId,
    params,
  } satisfies ArchiveDialogData;
}

export type ArchiveDialogData = LoadTreeReturn & {
  archiveRootNode?: TreeNode;
  activeArchiveNode?: TreeNode;
  archiveItems?: TreeNode[];
  activeArchiveNodeId: NodeId | null;
  params: ArchiveDialogRouteParams;
};

// ----------------------------------------
// Dialog internals
// ----------------------------------------

type ArchiveStepData = Record<string, never>;

// ----------------------------------------
// Presentation components
// ----------------------------------------

interface ArchiveDialogHeaderProps extends HeadlessHeaderRenderProps<ArchiveStepData> {
  title: string;
}

function ArchiveDialogHeader({
  title,
  displayMode,
  onDisplayModeChange,
  onRequestClose,
  isDirty,
}: ArchiveDialogHeaderProps) {
  const ctx = useDialogContext<ArchiveStepData>();
  const { t } = useTranslation();
  const closeLabel = t('dialogs.pluginDialog.tooltips.close', 'Close dialog');

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
        <IconButton
          size="large"
          onClick={() => onRequestClose('close')}
          onPointerDown={stopPropagation}
          aria-label={closeLabel}
        >
          <ArrowBackIcon fontSize="large" />
        </IconButton>
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
      </Box>
    </Box>
  );
}

interface ArchiveDialogFooterProps extends HeadlessFooterRenderProps<ArchiveStepData> {
  mode: 'restore' | 'empty';
  totalCount: number;
  selectedCount: number;
  loading: boolean;
  onRestore: () => void;
  onEmptyAll: () => void;
  hasDraftsInView: boolean;
}

function ArchiveDialogFooter({
  mode,
  totalCount,
  selectedCount,
  loading,
  onRestore,
  onEmptyAll,
  onRequestClose,
  hasDraftsInView,
}: ArchiveDialogFooterProps) {
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
  const restoreUnit = t('dialogs.archive.units.item', { count: selectedCount });
  const emptyUnit = t('dialogs.archive.units.item', { count: totalCount });
  const restoreLabel =
    selectedCount === 0
      ? t('dialogs.archive.buttons.restore')
      : t('dialogs.archive.buttons.restoreWithCount', { count: selectedCount });
  const emptyLabel =
    totalCount === 0
      ? t('dialogs.archive.buttons.empty')
      : t('dialogs.archive.buttons.emptyWithCount', { count: totalCount });
  const restoreAria =
    selectedCount === 0
      ? t('dialogs.archive.aria.restore')
      : t('dialogs.archive.aria.restoreWithCount', { count: selectedCount, unit: restoreUnit });
  const emptyAria =
    totalCount === 0
      ? t('dialogs.archive.aria.empty')
      : t('dialogs.archive.aria.emptyWithCount', { count: totalCount, unit: emptyUnit });

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
          minHeight: ARCHIVE_DIALOG_FOOTER_HEIGHT,
        }}
      >
        <Button variant="contained" color="inherit" onClick={() => onRequestClose('close')}>
          {t('dialogs.archive.buttons.cancel')}
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
            startIcon={<EmptyArchiveIcon />}
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
        <DialogTitle id={confirmTitleId}>{t('dialogs.archive.confirm.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id={confirmContentId}>
            {totalCount === 0
              ? t('dialogs.archive.confirm.empty')
              : t('dialogs.archive.confirm.description', { count: totalCount, unit: emptyUnit })}
          </DialogContentText>
          {hasDraftsInView ? (
            <DialogContentText sx={{ mt: 1 }} color="warning.main">
              {t('dialogs.archive.confirm.draftWarning') ??
                'Drafts are present. Emptying the archive will force-delete in-progress edits.'}
            </DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} color="inherit">
            {t('dialogs.archive.buttons.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={emptyDisabled}
          >
            {t('dialogs.archive.buttons.confirmDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface ArchiveDialogContentProps {
  loading: boolean;
  treeData: HierarchicalTreeNode[];
  columns: TreeTableColumn[];
  breadcrumbItems: BreadcrumbNode[];
  selectedIds: NodeId[];
  setSelectedIds: (updater: (prev: NodeId[]) => NodeId[]) => void;
  treeId?: string;
  pageNodeId?: NodeId | null;
  archiveViewRootId?: NodeId | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  mode: 'restore' | 'empty';
  onRestore: () => void;
  expandedIds: string[];
  onToggleExpand: (nodeId: string, expanded: boolean) => void;
  nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
  hasDraftsInView: boolean;
}

function ArchiveDialogContent({
  loading,
  treeData,
  columns,
  breadcrumbItems,
  selectedIds,
  setSelectedIds,
  treeId,
  pageNodeId,
  archiveViewRootId,
  searchTerm,
  onSearchTermChange,
  mode,
  expandedIds,
  onToggleExpand,
  nodeIndex,
  hasDraftsInView,
}: ArchiveDialogContentProps) {
  const { t } = useTranslation();
  const filteredTreeData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return treeData;
    return treeData.filter((node) => {
      const name = getArchiveDisplayName(node).toLowerCase();
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
        marginBottom: `${ARCHIVE_DIALOG_FOOTER_HEIGHT}px`,
      }}
    >
      {hasDraftsInView ? (
        <Box sx={{ px: 2, pt: 1 }}>
          <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
            {t('dialogs.archive.draftWarning') ??
              'Drafts are included in this view. Deleting will force-remove in-progress edits.'}
          </Alert>
        </Box>
      ) : null}
      <Box sx={{ px: 2, pt: 0, pb: 1 }}>
        <TreeTableSearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          onClear={() => onSearchTermChange('')}
          placeholder={t('dialogs.archive.searchPlaceholder') ?? ''}
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
          title={t('dialogs.archive.panelTitle') ?? ''}
          treeId={treeId}
          pageNodeId={pageNodeId ? String(pageNodeId) : undefined}
          subtreeRootId={archiveViewRootId ? String(archiveViewRootId) : undefined}
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
          canArchive={mode === 'empty'}
          useArchiveColumns
          selectAllIdPrefix="archive-row-selection"
          selectAllPersistence="session"
          archiveAction={mode}
          hideDragHandler
          breadcrumbRenderer={({
            defaultRendererProps,
          }: TreeConsoleBreadcrumbRendererProps) => (
            <ArchiveBreadcrumb {...defaultRendererProps} />
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

export interface ArchiveDialogProps {
  data: ArchiveDialogData;
  params: ArchiveDialogRouteParams;
}

export function ArchiveDialog({ data, params }: ArchiveDialogProps) {
  const {
    t,
    treeId,
    pageNodeId,
    archiveViewRootId,
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
  } = useArchiveDialog(data, params);

  const handleClose = useCallback(() => {
    closeDialog();
  }, [closeDialog]);
  const stepComponents = useMemo(
    () =>
      [
        {
          id: 'archive-root',
          label: t('dialogs.archive.stepLabel'),
          component: () => (
            <ArchiveDialogContent
              loading={loading}
              treeData={treeData}
              columns={columns}
              breadcrumbItems={breadcrumbItems}
              selectedIds={selectedIds}
              setSelectedIds={(updater) => setSelectedIds(updater)}
              treeId={treeId}
              pageNodeId={pageNodeId}
              archiveViewRootId={archiveViewRootId}
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
    [
      breadcrumbItems,
      columns,
      expandedIds,
      handleRestore,
      hasDraftsInView,
      loading,
      mode,
      nodeIndex,
      onToggleExpand,
      pageNodeId,
      searchTerm,
      selectedIds,
      setSearchTerm,
      setSelectedIds,
      t,
      archiveViewRootId,
      treeData,
      treeId,
    ]
  );

  const headlessProps: HeadlessPluginDialogProps<ArchiveStepData> = useMemo(
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
        <ArchiveDialogHeader
          {...props}
          title={
            mode === 'restore' ? t('dialogs.archive.title.restore') : t('dialogs.archive.title.empty')
          }
        />
      ),
      renderFooter: (props: HeadlessFooterRenderProps<ArchiveStepData>) => (
        <ArchiveDialogFooter
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
    [
      frameState,
      handleClose,
      handleEmptyAll,
      handleRestore,
      loading,
      mode,
      removalTargetCount,
      selectedIds,
      stepComponents,
      t,
      hasDraftsInView,
    ]
  );

  return <PluginDialogFrame headlessProps={headlessProps} frameSx={frameSx} />;
}

export default ArchiveDialog;

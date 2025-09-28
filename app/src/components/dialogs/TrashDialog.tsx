import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  RestoreFromTrash as RestoreIcon,
  DeleteForever as EmptyTrashIcon,
} from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import {
  DialogOverlayFrame,
  FRAME_CONSTANTS,
  getViewportSize,
  normalizeDialogState,
  initialPosition,
  useMultiStepDialogContext,
  type DialogDisplayMode,
  type HeadlessMultiStepDialogProps,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type MultiDialogPosition,
  type MultiDialogSize,
} from '@hierarchidb/ui-dialog';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData, TreeTableColumn } from '@hierarchidb/ui-treeconsole-base';
import { TreeConsolePanel } from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeTableSearchInput } from '@hierarchidb/ui-treeconsole-base';
import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs } from 'react-router';
import type { LoadTreeReturn } from '~/loader.js';
import { loadTree } from '~/loader.js';
import { buildTrashBreadcrumbs } from '../trash/buildTrashBreadcrumbs.js';
import { buildTrashTreeData } from '../trash/buildTrashTreeData.js';
import { TrashBreadcrumb } from '../trash/TrashBreadcrumb.js';
import { getTrashDisplayName } from '../trash/getTrashDisplayName.js';

// ----------------------------------------
// Loader & data types
// ----------------------------------------

export async function clientLoader(args: LoaderFunctionArgs) {
  const { treeId, targetNodeId } = args.params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }

  const treeData = await loadTree({ treeId });
  if (!treeData.tree) {
    return {
      ...treeData,
      activeTrashNodeId: (targetNodeId as NodeId | undefined) ?? null,
    } satisfies TrashDialogData;
  }

  const client = treeData.client;
  const queryAPI = await client.getQueryAPI();
  const fallbackTrashId = treeData.tree.trashRootId as NodeId | undefined;
  const activeTrashNodeId = (targetNodeId as NodeId | undefined) ?? fallbackTrashId;
  if (!activeTrashNodeId) {
    throw new Response('Trash root not found.', { status: 404 });
  }

  const trashRootNode = await queryAPI.getNode(activeTrashNodeId);
  const targetDepth = fallbackTrashId && activeTrashNodeId === fallbackTrashId ? 2 : 1;
  const trashItems = (await queryAPI.listChildren(activeTrashNodeId, { prefetch: { depth: targetDepth } })) as TreeNode[];

  return {
    ...treeData,
    trashRootNode,
    trashItems,
    activeTrashNodeId,
  } satisfies TrashDialogData;
}

type TrashDialogData = LoadTreeReturn & {
  trashRootNode?: TreeNode;
  trashItems?: TreeNode[];
  activeTrashNodeId: NodeId | null;
};

// ----------------------------------------
// Dialog internals
// ----------------------------------------

type TrashStepData = Record<string, never>;

const STEP_DESCRIPTOR = {
  id: 'trash-root',
  label: 'Trash',
  component: () => null,
};

async function loadWorkerAPIClient() {
  const module = await import('../../WorkerAPIClient.js');
  return module.WorkerAPIClient;
}

const STEP_ARRAY = [STEP_DESCRIPTOR] as const;

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
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialPosition(DEFAULT_SIZE, getViewportSize()));
  const sizeRef = useRef(dialogSize);
  const positionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback((size: MultiDialogSize, position: MultiDialogPosition) => {
    sizeRef.current = size;
    positionRef.current = position;
    setDialogSize(size);
    setDialogPosition(position);
  }, []);

  const normalizeFromState = useCallback((mode: DialogDisplayMode, nextSize?: MultiDialogSize, nextPosition?: MultiDialogPosition) => {
    const viewport = getViewportSize();
    const baseSize = nextSize ?? sizeRef.current;
    const basePosition = nextPosition ?? positionRef.current;
    const options = {
      enforceTopLeftMargin: mode === 'normal',
      minPosition: mode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    } as const;
    return normalizeDialogState(baseSize, basePosition, viewport, options);
  }, []);

  const ensureFitsViewport = useCallback((mode: DialogDisplayMode) => {
    const normalized = normalizeFromState(mode);
    applyNormalizedState(normalized.size, normalized.position);
  }, [applyNormalizedState, normalizeFromState]);

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

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
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
          width: Math.max(viewport.width - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        },
        { x: FRAME_CONSTANTS.NON_STANDARD_MARGIN, y: FRAME_CONSTANTS.NON_STANDARD_MARGIN },
        viewport,
        {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        },
      );
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const preset = normalizeDialogState(
        DEFAULT_SIZE,
        initialPosition(DEFAULT_SIZE, viewport),
        viewport,
        { enforceTopLeftMargin: true },
      );
      applyNormalizedState(preset.size, preset.position);
    }
    setDisplayMode(mode);
  }, [applyNormalizedState]);

  const handleSizeChange = useCallback((size?: MultiDialogSize) => {
    if (!size) return;
    const normalized = normalizeDialogState(size, positionRef.current, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    applyNormalizedState(normalized.size, normalized.position);
  }, [applyNormalizedState, displayMode]);

  const handlePositionChange = useCallback((position?: MultiDialogPosition) => {
    if (!position) return;
    const normalized = normalizeDialogState(dialogSize, position, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    applyNormalizedState(normalized.size, normalized.position);
  }, [applyNormalizedState, dialogSize, displayMode]);

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
  const handlePointerDown = ctx.onDragHandlePointerDown;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        gap: 2,
        cursor: displayMode === 'full-screen' ? 'default' : 'move',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      data-dialog-drag-handle="true"
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" noWrap>{title}</Typography>
        {isDirty && (
          <Typography variant="caption" color="text.secondary">
            Unsaved changes
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton size="small" onClick={() => onDisplayModeChange?.(displayMode === 'maximize' ? 'normal' : 'maximize')}>
          {displayMode === 'maximize' ? <RestoreIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={() => onDisplayModeChange?.(displayMode === 'full-screen' ? 'normal' : 'full-screen')}>
          {displayMode === 'full-screen' ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={() => onRequestClose('close')}>
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);

  const allDisabled = loading || (mode === 'restore' ? selectedCount === 0 : totalCount === 0);

  return (
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
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" color="inherit" onClick={() => onRequestClose('close')}>
          Close
        </Button>
        {mode === 'restore' ? (
          <Button
            variant="contained"
            startIcon={<RestoreIcon />}
            disabled={allDisabled}
            onClick={onRestore}
          >
            Restore ({selectedCount})
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<EmptyTrashIcon />}
              onClick={handleMenuOpen}
              disabled={allDisabled}
            >
              Empty Trash ({totalCount})
            </Button>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  onEmptyAll();
                }}
              >
                Permanently delete all items
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {mode === 'restore'
          ? `${selectedCount} selected`
          : `${totalCount} items in trash`}
      </Typography>
    </Box>
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
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  mode: 'restore' | 'empty';
  onRestore: () => void;
  expandedIds: string[];
  onToggleExpand: (nodeId: string, expanded: boolean) => void;
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
  searchTerm,
  onSearchTermChange,
  mode,
  expandedIds,
  onToggleExpand,
}: TrashDialogContentProps) {
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
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 0, pb: 1 }}>
        <TreeTableSearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          onClear={() => onSearchTermChange('')}
          placeholder="Search trash items"
          sx={{ width: 260 }}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TreeConsolePanel
          title="Trash"
          treeId={treeId}
          pageNodeId={pageNodeId ? String(pageNodeId) : undefined}
          data={filteredTreeData}
          columns={columns}
          breadcrumbItems={breadcrumbItems}
          loading={false}
          selectedIds={selectedIds.map(String)}
          expandedIds={expandedIds}
          viewMode="list"
          canCreate={false}
          canEdit={false}
          canDelete={mode === 'empty'}
          useTrashColumns
          trashAction={mode}
          hideDragHandler
          breadcrumbRenderer={({ defaultRendererProps }) => (
            <TrashBreadcrumb {...defaultRendererProps} />
          )}
          onNodeClick={() => undefined}
          onNodeSelect={(nodeIds, selected) => {
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
          onNodeExpand={(nodeId, expanded) => onToggleExpand(String(nodeId), expanded)}
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
          onSort={(_columnId) => undefined}
          onFilterChange={(_filter) => undefined}
          onViewModeChange={(_mode) => undefined}
          onBreadcrumbNavigate={(_nodeId, _node) => undefined}
          onContextMenuAction={(_action, _node) => undefined}
          onStartTour={undefined}
          onMoveNodes={(_ids, _target) => undefined}
        />
      </Box>
    </Box>
  );
}

// ----------------------------------------
// Main component
// ----------------------------------------

export default function TrashDialog() {
  const data = useLoaderData<TrashDialogData>();
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();

  const treeId = data.tree?.id;
  const pageNodeId = params.pageNodeId as NodeId | undefined;
  const action = params.action;
  const mode: 'restore' | 'empty' = action === 'empty' ? 'empty' : 'restore';
  const effectiveTrashNodeId = data.activeTrashNodeId ?? (data.tree?.trashRootId as NodeId | undefined) ?? null;

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const nodeMap = useMemo(() => createTreeNodeMap(data.trashItems), [data.trashItems]);
  const treeData = useMemo(() => {
    if (!data.trashRootNode) return [] as TreeNodeData[];
    return buildTrashTreeData({ treeId: treeId ?? '', rootNode: data.trashRootNode, nodeMap }).nodes;
  }, [data.trashRootNode, nodeMap, treeId]);

  const breadcrumbItems = useMemo(() => {
    if (!data.trashRootNode || !treeId) return [];
    return buildTrashBreadcrumbs({ treeId, rootNode: data.trashRootNode, targetNodeId: effectiveTrashNodeId, nodeMap });
  }, [data.trashRootNode, effectiveTrashNodeId, nodeMap, treeId]);

  const columns: TreeTableColumn[] = useMemo(() => [
    {
      id: 'name',
      label: t('trash.columns.name', 'Name'),
      sortable: true,
      width: 300,
      render: (_value: unknown, node: TreeNodeData) => getTrashDisplayName(node),
    },
    {
      id: 'nodeType',
      label: t('trash.columns.type', 'Type'),
      sortable: true,
      width: 120,
      render: (_value: unknown, node: TreeNodeData) => node.nodeType,
    },
  ], [t]);

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const frameState = useTrashFrameState('normal');
  const {
    dialogPosition,
    dialogSize,
    displayMode,
    setDisplayMode,
    setSize,
    setPosition,
  } = frameState;
  const handleRestore = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const WorkerAPIClient = await loadWorkerAPIClient();
      const client = WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const result = await mutationAPI.restoreNodesFromTrash({ nodeIds: selectedIds });
      if (!result.success) {
        console.error('Restore failed:', result.error);
        return;
      }
      navigate(-1);
      window.location.reload();
    } catch (error) {
      console.error('Error restoring trash nodes:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedIds]);

  const handleEmptyAll = useCallback(async () => {
    const confirmed = window.confirm('Permanently delete all items in the trash? This cannot be undone.');
    if (!confirmed) return;
    setLoading(true);
    try {
      const WorkerAPIClient = await loadWorkerAPIClient();
      const client = WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const nodes = treeData.map((node) => node.id as NodeId);
      const res = await mutationAPI.removeNodes(nodes);
      if (res.success) {
        navigate(-1);
        window.location.reload();
      } else {
        console.error('Empty trash failed:', res.error);
      }
    } catch (error) {
      console.error('Error emptying trash:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate, treeData]);

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

  const headlessProps: HeadlessMultiStepDialogProps<TrashStepData> = useMemo(() => ({
    open: true,
    stepComponents: STEP_ARRAY,
    stepData: {},
    onStepDataChange: () => undefined,
    activeStepIndex: 0,
    onStepNavigate: () => undefined,
    onRequestClose: () => handleClose(),
    isDirty: selectedIds.length > 0,
    position: dialogPosition,
    size: dialogSize,
    displayMode,
    onPositionChange: (next) => setPosition(next),
    onSizeChange: (next) => setSize(next),
    onDisplayModeChange: (mode) => setDisplayMode(mode),
    renderHeader: (props) => (
      <TrashDialogHeader
        {...props}
        title={mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'}
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
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        mode={mode}
        onRestore={handleRestore}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
      />
    ),
    renderFooter: (props: HeadlessFooterRenderProps<TrashStepData>) => (
      <TrashDialogFooter
        {...props}
        mode={mode}
        totalCount={treeData.length}
        selectedCount={selectedIds.length}
        loading={loading}
        onRestore={handleRestore}
        onEmptyAll={handleEmptyAll}
      />
    ),
  }), [
    breadcrumbItems,
    columns,
    dialogPosition,
    dialogSize,
    displayMode,
    expandedIds,
    handleClose,
    handleEmptyAll,
    handleRestore,
    loading,
    mode,
    onToggleExpand,
    pageNodeId,
    searchTerm,
    selectedIds,
    setDisplayMode,
    setPosition,
    setSize,
    treeData,
    treeId,
  ]);

  return <DialogOverlayFrame headlessProps={headlessProps} backdropZIndex={1600} />;
}

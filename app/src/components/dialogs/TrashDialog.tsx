import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  cloneElement,
} from 'react';
import { proxy as comlinkProxy } from 'comlink';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  DeleteForever as EmptyTrashIcon,
  RestoreFromTrash as RestoreIcon,
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import Draggable from 'react-draggable';
import { createPortal } from 'react-dom';
import {
  MultiStepDialogProvider,
  MultiStepDialogHeader,
  MultiStepDialogFooter,
  MultiDialogContent,
  useMultiStepDialogContext,
  useDialogInteractionGuards,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type DialogDisplayMode,
  type MultiDialogPosition,
  type MultiDialogSize,
  type StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import { getProperties, saveProperties } from '@hierarchidb/ui-treeconsole-treetable';
import type { LoadTreeReturn } from '~/loader.js';
import { loadTree } from '~/loader.js';
import { WorkerAPIClient } from '../../WorkerAPIClient.js';
import {
  TreeConsolePanel,
  TreeTableSearchInput,
  type TreeNodeData,
  type TreeTableColumn,
} from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { NodeId, TreeId, TreeNode, SubscriptionId } from '@hierarchidb/common-type';
import type { TreeSubscriptionAPI } from '@hierarchidb/common-api';
import { buildTrashBreadcrumbs } from '../trash/buildTrashBreadcrumbs.js';
import { buildTrashTreeData } from '../trash/buildTrashTreeData.js';
import { TrashBreadcrumb } from '../trash/TrashBreadcrumb.js';

// ----------------------------------------
// Data loader
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
    };
  }

  const queryAPI = await treeData.client.getQueryAPI();
  const fallbackTrashId = treeData.tree.trashRootId as NodeId | undefined;
  const activeTrashNodeId = (targetNodeId as NodeId | undefined) ?? fallbackTrashId;
  if (!activeTrashNodeId) {
    throw new Response('Trash root not found.', { status: 404 });
  }

  const trashRootNode = await queryAPI.getNode(activeTrashNodeId);
  const targetDepth = fallbackTrashId && activeTrashNodeId === fallbackTrashId ? 2 : 1;
  const trashItems = (await queryAPI.listChildren(activeTrashNodeId, { prefetch: { depth: targetDepth } })) as TreeNode[];
  console.log('[TrashDialog loader] listChildren', {
    parentId: String(activeTrashNodeId),
    depth: targetDepth,
    total: trashItems.length,
    sample: trashItems.slice(0, 5),
  });

  const isRootTrash = Boolean(fallbackTrashId && activeTrashNodeId === fallbackTrashId);
  const holderLookup: Record<string, { holderId: NodeId; holderName?: string }> = {};

  let trashDisplayItems = trashItems;
  if (isRootTrash) {
    const placeholderMap = new Map<string, TreeNode>();
    const rootIdStr = String(activeTrashNodeId);
    trashItems.forEach((node) => {
      if (node.parentId && String(node.parentId) === rootIdStr) {
        placeholderMap.set(String(node.id), node);
      }
    });

    const placeholderIds = Array.from(placeholderMap.keys());
    if (placeholderIds.length > 0) {
      const nestedResults = await Promise.all(
        placeholderIds.map(async (placeholderId) => {
          const nested = await queryAPI.listChildren(placeholderId as NodeId, { prefetch: { depth: targetDepth } });
          console.log('[TrashDialog loader] placeholder children', {
            placeholderId,
            total: nested.length,
            sample: nested.slice(0, 5),
          });
          return nested;
        }),
      );
      const placeholderChildren = nestedResults.flat();
      const unique = new Map<string, TreeNode>();
      trashItems.forEach((node) => unique.set(String(node.id), node));
      placeholderChildren.forEach((node) => unique.set(String(node.id), node));
      trashDisplayItems = Array.from(unique.values()).filter((node) => {
        const parentIdValue = node.parentId ? String(node.parentId) : undefined;
        return Boolean(parentIdValue && placeholderMap.has(parentIdValue));
      });
    } else {
      trashDisplayItems = [];
    }

    trashDisplayItems.forEach((node) => {
      const parentId = node.parentId ? String(node.parentId) : undefined;
      const holderNode = parentId ? placeholderMap.get(parentId) : undefined;
      const holderId = holderNode?.id ?? (parentId ? (parentId as unknown as NodeId) : undefined);
      if (holderId) {
        holderLookup[String(node.id)] = {
          holderId,
          holderName: holderNode?.name,
        };
      }
    });
    console.log('[TrashDialog loader] normalized trash root data', {
      placeholders: Array.from(placeholderMap.values()).map((node) => ({ id: node.id, name: node.name })),
      items: trashDisplayItems.map((node) => ({ id: node.id, name: node.name, depth: node.depth, parentId: node.parentId })),
      holderLookup,
    });
  } else {
    trashItems.forEach((node) => {
      const holderId = (node as { holderTargetId?: NodeId }).holderTargetId;
      if (holderId) {
        holderLookup[String(node.id)] = {
          holderId,
          holderName: node.name,
        };
      }
    });
    console.log('[TrashDialog loader] normalized trash branch data', {
      items: trashItems.map((node) => ({ id: node.id, name: node.name, depth: node.depth, parentId: node.parentId })),
      holderLookup,
    });
  }

  return {
    ...treeData,
    trashRootNode,
    trashItems,
    trashDisplayItems,
    holderLookup,
    activeTrashNodeId,
  } satisfies TrashDialogData;
}

// ----------------------------------------
// Types
// ----------------------------------------
type TrashDialogData = LoadTreeReturn & {
  trashRootNode?: TreeNode;
  trashItems?: TreeNode[];
  trashDisplayItems?: TreeNode[];
  holderLookup?: Record<string, { holderId: NodeId; holderName?: string }>;
  activeTrashNodeId: NodeId | null;
};

type ResizeDirection =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

// ----------------------------------------
// Dialog layout helpers
// ----------------------------------------
const EMOJI_TITLE = '🗑️';
const STEP_DESCRIPTOR: StepComponentDescriptor<Record<string, never>> = {
  id: 'trash-dialog',
  label: 'Trash',
  component: () => null,
};
const STEP_ARRAY = [STEP_DESCRIPTOR] as const;

const STANDARD_SIZE_RATIO = { width: 0.72, height: 0.66 } as const;
const NON_STANDARD_MARGIN = 24;
const FOOTER_HEIGHT = 72;
const MIN_DIALOG_WIDTH = 560;
const MIN_DIALOG_HEIGHT = 360;
const TOP_LEFT_VISIBLE_MARGIN = 32;

function getPresetSize(
  mode: DialogDisplayMode,
  viewport: { width: number; height: number },
): MultiDialogSize {
  switch (mode) {
    case 'maximize':
      return {
        width: Math.max(viewport.width - NON_STANDARD_MARGIN * 2, MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height - NON_STANDARD_MARGIN * 2, MIN_DIALOG_HEIGHT),
      };
    case 'full-screen':
      return {
        width: Math.max(viewport.width, MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, MIN_DIALOG_HEIGHT),
      };
    case 'normal':
    default: {
      const targetWidth = viewport.width * STANDARD_SIZE_RATIO.width;
      const targetHeight = viewport.height * STANDARD_SIZE_RATIO.height;
      return {
        width: Math.min(Math.max(targetWidth, MIN_DIALOG_WIDTH), viewport.width),
        height: Math.min(Math.max(targetHeight, MIN_DIALOG_HEIGHT), viewport.height),
      };
    }
  }
}

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

async function waitForNextAnimationFrames(count = 2) {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

type VendorFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type VendorFullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(doc: VendorFullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isFullscreenActive() {
  if (typeof document === 'undefined') {
    return false;
  }
  return Boolean(getFullscreenElement(document as VendorFullscreenDocument));
}

async function waitForFullscreenState(expectedActive: boolean, timeoutMs = 1500) {
  if (typeof document === 'undefined') {
    return;
  }
  if (isFullscreenActive() === expectedActive) {
    return;
  }

  const doc = document as VendorFullscreenDocument;

  await new Promise<void>((resolve) => {
    let settled = false;
    const handleChange = () => {
      if (settled) return;
      if (isFullscreenActive() === expectedActive) {
        settled = true;
        cleanup();
        resolve();
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      doc.removeEventListener('fullscreenchange', handleChange);
      doc.removeEventListener('webkitfullscreenchange', handleChange);
      window.clearTimeout(timeoutId);
    };

    doc.addEventListener('fullscreenchange', handleChange);
    doc.addEventListener('webkitfullscreenchange', handleChange);
  });
}

async function ensureFullscreenEntered() {
  if (typeof document === 'undefined') {
    return;
  }

  const doc = document as VendorFullscreenDocument;

  if (!isFullscreenActive()) {
    const element = (doc.documentElement as VendorFullscreenElement) ?? undefined;
    const request = element?.requestFullscreen?.bind(element) ?? element?.webkitRequestFullscreen?.bind(element);
    if (request) {
      try {
        await request();
      } catch (error) {
        console.warn('[TrashDialog] requestFullscreen failed', error);
      }
    }
  }

  await waitForFullscreenState(true);
  await waitForNextAnimationFrames();
}

async function ensureFullscreenExited() {
  if (typeof document === 'undefined') {
    return;
  }

  const doc = document as VendorFullscreenDocument;

  if (isFullscreenActive()) {
    const exit = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
    if (exit) {
      try {
        await exit();
      } catch (error) {
        console.warn('[TrashDialog] exitFullscreen failed', error);
      }
    }
  }

  await waitForFullscreenState(false);
  await waitForNextAnimationFrames();
}

interface NormalizeOptions {
  enforceTopLeftMargin?: boolean;
  minPosition?: number;
  clampSizeToViewport?: boolean;
}

function normalizeDialogState(
  size: MultiDialogSize,
  position: MultiDialogPosition,
  viewport: { width: number; height: number },
  options: NormalizeOptions = {},
): { size: MultiDialogSize; position: MultiDialogPosition } {
  const {
    enforceTopLeftMargin = true,
    minPosition = 0,
    clampSizeToViewport = true,
  } = options;

  const minWidth = Math.min(MIN_DIALOG_WIDTH, viewport.width);
  const minHeight = Math.min(MIN_DIALOG_HEIGHT, viewport.height);

  let normalizedWidth = Math.max(size.width, minWidth);
  let normalizedHeight = Math.max(size.height, minHeight);

  if (clampSizeToViewport) {
    normalizedWidth = Math.min(normalizedWidth, viewport.width);
    normalizedHeight = Math.min(normalizedHeight, viewport.height);
  }

  const minX = enforceTopLeftMargin ? 0 : minPosition;
  const minY = enforceTopLeftMargin ? 0 : minPosition;

  let maxX: number;
  let maxY: number;

  if (!clampSizeToViewport) {
    maxX = Number.POSITIVE_INFINITY;
    maxY = Number.POSITIVE_INFINITY;
  } else if (enforceTopLeftMargin) {
    maxX = Math.max(viewport.width - TOP_LEFT_VISIBLE_MARGIN, minX);
    maxY = Math.max(viewport.height - TOP_LEFT_VISIBLE_MARGIN, minY);
  } else {
    maxX = Math.max(viewport.width - normalizedWidth - minPosition, minX);
    maxY = Math.max(viewport.height - normalizedHeight - minPosition, minY);
  }

  const constrainedX = Math.min(Math.max(position.x, minX), maxX);
  const constrainedY = Math.min(Math.max(position.y, minY), maxY);

  return {
    size: { width: normalizedWidth, height: normalizedHeight },
    position: { x: constrainedX, y: constrainedY },
  };
}

function sizesEqual(a: MultiDialogSize, b: MultiDialogSize): boolean {
  return a.width === b.width && a.height === b.height;
}

function positionsEqual(a: MultiDialogPosition, b: MultiDialogPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function initialPosition(size: MultiDialogSize): MultiDialogPosition {
  if (typeof window === 'undefined') {
    return { x: 120, y: 80 };
  }
  return {
    x: Math.max((window.innerWidth - size.width) / 2, 0),
    y: Math.max((window.innerHeight - size.height) / 3, 0),
  };
}

interface ResizeHandleProps {
  position: ResizeDirection;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

const RESIZE_HANDLE_STYLE: Record<ResizeDirection, Record<string, unknown>> = {
  'top-left': {
    top: 0,
    left: 0,
    cursor: 'nwse-resize',
    transform: 'translate(-50%, -50%)',
  },
  top: {
    top: 0,
    left: '50%',
    cursor: 'ns-resize',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100% - 32px)',
    height: 12,
  },
  'top-right': {
    top: 0,
    right: 0,
    cursor: 'nesw-resize',
    transform: 'translate(50%, -50%)',
  },
  right: {
    top: '50%',
    right: 0,
    cursor: 'ew-resize',
    transform: 'translate(50%, -50%)',
    width: 12,
    height: 'calc(100% - 32px)',
  },
  'bottom-left': {
    bottom: 0,
    left: 0,
    cursor: 'nesw-resize',
    transform: 'translate(-50%, 50%)',
  },
  bottom: {
    bottom: 0,
    left: '50%',
    cursor: 'ns-resize',
    transform: 'translate(-50%, 50%)',
    width: 'calc(100% - 32px)',
    height: 12,
  },
  'bottom-right': {
    bottom: 0,
    right: 0,
    cursor: 'nwse-resize',
    transform: 'translate(50%, 50%)',
  },
  left: {
    top: '50%',
    left: 0,
    cursor: 'ew-resize',
    transform: 'translate(-50%, -50%)',
    width: 12,
    height: 'calc(100% - 32px)',
  },
};

function ResizeHandle({ position, onPointerDown }: ResizeHandleProps) {
  return (
    <Box
      component="div"
      data-dialog-cancel-drag="true"
      onPointerDown={onPointerDown}
      sx={{
        position: 'absolute',
        width: 16,
        height: 16,
        zIndex: 20,
        pointerEvents: 'auto',
        touchAction: 'none',
        backgroundColor: 'transparent',
        ...RESIZE_HANDLE_STYLE[position],
      }}
    />
  );
}

// ----------------------------------------
// Header / Footer renderers
// ----------------------------------------
interface TrashDialogHeaderProps<TData = unknown> extends HeadlessHeaderRenderProps<TData> {
  title: string;
  subtitle?: string;
  onRequestClose?: (reason?: 'close' | 'discard') => void;
  onResetToNormal?: () => void;
}

function TrashDialogHeader<TData = unknown>({
  title,
  subtitle,
  displayMode,
  onDisplayModeChange,
  onRequestClose,
  onResetToNormal,
}: TrashDialogHeaderProps<TData>) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const openMenu = (event: React.MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const closeMenu = () => setAnchor(null);
  const { t } = useTranslation('common', { keyPrefix: 'dialogs.trash' });

  const mode = displayMode;
  const isFullscreen = mode === 'full-screen';

  useEffect(() => {
    if (isFullscreen) {
      setAnchor(null);
    }
  }, [isFullscreen]);

  const selectDisplayMode = (nextMode: DialogDisplayMode) => {
    onDisplayModeChange?.(nextMode);
    closeMenu();
  };

  const handleExitFullscreen = () => {
    selectDisplayMode('maximize');
  };

  const modeMenuLabel = t('modeMenu.ariaLabel') as string;
  const normalLabel = t('modeMenu.normal') as string;
  const maximizeLabel = t('modeMenu.maximize') as string;
  const fullScreenLabel = t('modeMenu.fullScreen') as string;
  const closeLabel = t('actions.close') as string;
  const exitFullscreenLabel = t('actions.exitFullscreen') as string;

  const modeControl = (
    <>
      <IconButton size="small" aria-label={modeMenuLabel} onClick={openMenu}>
        {mode === 'normal' ? (
          <FullscreenExitIcon fontSize="small" />
        ) : mode === 'maximize' ? (
          <OpenInFullIcon fontSize="small" />
        ) : (
          <FullscreenIcon fontSize="small" />
        )}
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu} keepMounted>
        <MenuItem selected={mode === 'normal'} onClick={() => selectDisplayMode('normal')}>
          <ListItemIcon>
            <FullscreenExitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={normalLabel} />
        </MenuItem>
        <MenuItem selected={mode === 'maximize'} onClick={() => selectDisplayMode('maximize')}>
          <ListItemIcon>
            <OpenInFullIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={maximizeLabel} />
        </MenuItem>
        <MenuItem selected={mode === 'full-screen'} onClick={() => selectDisplayMode('full-screen')}>
          <ListItemIcon>
            <FullscreenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={fullScreenLabel} />
        </MenuItem>
      </Menu>
    </>
  );

  return (
    <Box
      id="trash-dialog-title"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.25,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        cursor: 'move',
        userSelect: 'none',
        backgroundColor: (theme) => theme.palette.background.paper,
        transition: (theme) => theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': {
          backgroundColor: (theme) => theme.palette.action.hover,
        },
      }}
      onDoubleClick={() => onResetToNormal?.()}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        {!isFullscreen && modeControl}
        <IconButton
          size="small"
          aria-label={isFullscreen ? exitFullscreenLabel : closeLabel}
          onClick={isFullscreen ? handleExitFullscreen : () => onRequestClose?.('close')}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
interface TrashDialogFooterProps<TData = unknown> extends HeadlessFooterRenderProps<TData> {
  mode: 'restore' | 'empty';
  selectedCount: number;
  totalCount: number;
  loading: boolean;
  onRestore: () => void;
  onEmpty: () => void;
}

function TrashDialogFooter<TData = unknown>({
  mode,
  selectedCount,
  totalCount,
  loading,
  onRestore,
  onEmpty,
  onRequestClose,
}: TrashDialogFooterProps<TData>) {
  return (
    <Box
      data-dialog-cancel-drag="true"
      sx={{
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        px: 2,
        py: 1.5,
        display: 'flex',
        justifyContent: 'flex-end',
        minHeight: FOOTER_HEIGHT,
        backgroundColor: (theme) => theme.palette.background.paper,
        pointerEvents: 'none',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ pointerEvents: 'auto' }}>
        {mode === 'restore' ? (
          <Button
            variant="contained"
            color="primary"
            onClick={onRestore}
            startIcon={<RestoreIcon />}
            disabled={selectedCount === 0 || loading}
          >
            Restore Selected ({selectedCount})
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            onClick={onEmpty}
            startIcon={<EmptyTrashIcon />}
            disabled={totalCount === 0 || loading}
          >
            Empty All Trash ({totalCount})
          </Button>
        )}
        <Button onClick={() => onRequestClose?.('close')} color="inherit">
          Close
        </Button>
      </Stack>
    </Box>
  );
}

interface TrashDialogContentProps {
  loading: boolean;
  titleSuffix: string;
  treeData: TreeNodeData[];
  columns: TreeTableColumn[];
  breadcrumbItems: BreadcrumbNode[];
  selectedIds: NodeId[];
  setSelectedIds: (updater: (prev: NodeId[]) => NodeId[]) => void;
  treeId?: string;
  pageNodeId?: NodeId | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchClear: () => void;
  mode: 'restore' | 'empty';
  onRestore: () => Promise<void> | void;
  onEmptyItem: (node: TreeNodeData) => Promise<void> | void;
  displayMode: DialogDisplayMode;
  footerVisible: boolean;
  expandedIds: string[];
  onToggleExpand: (nodeId: string, expanded: boolean) => void;
  holderLookup: Record<string, { holderId: NodeId; holderName?: string }>;
}

type TrashDialogContentRenderProps = HeadlessContentRenderProps<Record<string, never>> & {
  displayMode: DialogDisplayMode;
  footerVisible: boolean;
};

function TrashDialogContent({
  loading,
  titleSuffix,
  treeData,
  columns,
  breadcrumbItems,
  selectedIds,
  setSelectedIds,
  treeId,
  pageNodeId,
  mode,
  searchTerm,
  onSearchTermChange,
  onSearchClear,
  onRestore,
  onEmptyItem,
  displayMode,
  footerVisible,
  expandedIds,
  onToggleExpand,
  holderLookup,
}: TrashDialogContentProps) {

  const filteredTreeData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return treeData;
    return treeData.filter((node) => {
      const nameMatch = (node.name ?? '').toLowerCase().includes(term);
      const typeMatch = (node.nodeType ?? '').toLowerCase().includes(term);
      const holderMatch = holderLookup[String(node.id)]?.holderName?.toLowerCase().includes(term);
      return nameMatch || typeMatch || Boolean(holderMatch);
    });
  }, [treeData, searchTerm, holderLookup]);

  if (loading) {
    return (
      <Box
        data-dialog-cancel-drag="true"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      data-dialog-cancel-drag="true"
      sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, mt: 1 }}
    >
      <Box
        data-dialog-cancel-drag="true"
        sx={{
          px: 2,
          pt: 0,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          minWidth: 0,
        }}
      >
        <TreeTableSearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          onClear={onSearchClear}
          placeholder="Search trash items"
          sx={{ width: 260 }}
        />
      </Box>
      <Box
        data-dialog-cancel-drag="true"
        sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}
      >
        <TreeConsolePanel
          title={`Trash – ${titleSuffix}`}
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
        onNodeExpand={(nodeId, expanded) => {
          onToggleExpand(String(nodeId), expanded);
        }}
          availableFilters={[]}
          searchTerm={searchTerm}
          onSearchChange={onSearchTermChange}
          onSearchClear={onSearchClear}
          onCreate={() => undefined}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onRefresh={() => window.location.reload()}
          onExpandAll={() => undefined}
          onCollapseAll={() => undefined}
          onSort={() => undefined}
          onFilterChange={() => undefined}
          onViewModeChange={() => undefined}
          onBreadcrumbNavigate={() => undefined}
          onContextMenuAction={async (action: string, node: TreeNodeData) => {
            if (action === 'restore' && mode === 'restore') {
              setSelectedIds(() => [node.id as NodeId]);
              await onRestore();
            } else if (action === 'remove' && mode === 'empty') {
              await onEmptyItem(node);
            }
          }}
        />
      </Box>
    </Box>
  );
}

// ----------------------------------------
// Dialog frame (draggable + resizable)
// ----------------------------------------
interface TrashDialogFrameProps {
  title: string;
  subtitle?: string;
  mode: 'restore' | 'empty';
  selectedCount: number;
  totalCount: number;
  loading: boolean;
  onRestore: () => void;
  onEmpty: () => void;
  renderContent: (props: TrashDialogContentRenderProps) => React.ReactNode;
  onResetToNormal: () => void;
  chromeHoverEnabled: boolean;
  onChromeHoverEnabledChange: (enabled: boolean) => void;
}

function TrashDialogFrame({
  title,
  subtitle,
  mode,
  selectedCount,
  totalCount,
  loading,
  onRestore,
  onEmpty,
  renderContent,
  onResetToNormal,
  chromeHoverEnabled,
  onChromeHoverEnabledChange,
}: TrashDialogFrameProps) {
  const ctx = useMultiStepDialogContext<Record<string, never>>();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const activeResizeMoveListenerRef = useRef<((event: PointerEvent) => void) | null>(null);
  const hideChromeTimeoutRef = useRef<number | null>(null);
  const {
    registerDragStart,
    registerDragEnd,
    handleBackdropClick,
    handleWheelCapture,
    frameStyle,
  } = useDialogInteractionGuards({
    onBackdropClick: () => ctx.onRequestClose?.('close'),
  });
  const frameDisplayMode: DialogDisplayMode = ctx.displayMode ?? 'normal';
  const [chromeVisible, setChromeVisible] = useState(true);
  const footerVisible = frameDisplayMode === 'full-screen' ? chromeVisible : true;
  const headerVisible = frameDisplayMode === 'full-screen' ? chromeVisible : true;

  const syncFullscreenLayout = useCallback(() => {
    requestAnimationFrame(() => {
      const viewport = getViewportSize();
      const fullscreenSize = {
        width: Math.max(viewport.width, MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, MIN_DIALOG_HEIGHT),
      };
      const normalized = normalizeDialogState(
        fullscreenSize,
        { x: 0, y: 0 },
        viewport,
        { enforceTopLeftMargin: false, minPosition: 0, clampSizeToViewport: false },
      );
      ctx.onSizeChange?.(normalized.size);
      ctx.onPositionChange?.(normalized.position);
    });
  }, [ctx]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!panelRef.current || !ctx.onSizeChange) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (panelRef.current) {
        ctx.onSizeChange?.({ width: panelRef.current.offsetWidth, height: panelRef.current.offsetHeight });
      }
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [ctx]);

  useEffect(() => {
    if (frameDisplayMode === 'full-screen') {
      setChromeVisible(false);
      onChromeHoverEnabledChange(false);
    } else {
      setChromeVisible(true);
      onChromeHoverEnabledChange(true);
      if (hideChromeTimeoutRef.current) {
        window.clearTimeout(hideChromeTimeoutRef.current);
        hideChromeTimeoutRef.current = null;
      }
    }
    return () => {
      if (hideChromeTimeoutRef.current) {
        window.clearTimeout(hideChromeTimeoutRef.current);
        hideChromeTimeoutRef.current = null;
      }
    };
  }, [frameDisplayMode, onChromeHoverEnabledChange]);

  const handleResizePointerDown = (direction: ResizeDirection) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!panelRef.current) return;

    registerDragStart();
    const rect = panelRef.current.getBoundingClientRect();
    resizeStateRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
    };

    if (activeResizeMoveListenerRef.current) {
      window.removeEventListener('pointermove', activeResizeMoveListenerRef.current);
      activeResizeMoveListenerRef.current = null;
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const current = resizeStateRef.current;
      if (!current) return;

      const deltaX = moveEvent.clientX - current.startX;
      const deltaY = moveEvent.clientY - current.startY;

      let width = current.startWidth;
      let height = current.startHeight;
      let left = current.startLeft;
      let top = current.startTop;

      switch (current.direction) {
        case 'bottom-right':
          width = current.startWidth + deltaX;
          height = current.startHeight + deltaY;
          break;
        case 'bottom':
          height = current.startHeight + deltaY;
          break;
        case 'bottom-left':
          width = current.startWidth - deltaX;
          height = current.startHeight + deltaY;
          left = current.startLeft + deltaX;
          break;
        case 'right':
          width = current.startWidth + deltaX;
          break;
        case 'top-right':
          width = current.startWidth + deltaX;
          height = current.startHeight - deltaY;
          top = current.startTop + deltaY;
          break;
        case 'top':
          height = current.startHeight - deltaY;
          top = current.startTop + deltaY;
          break;
        case 'top-left':
          width = current.startWidth - deltaX;
          height = current.startHeight - deltaY;
          left = current.startLeft + deltaX;
          top = current.startTop + deltaY;
          break;
        case 'left':
          width = current.startWidth - deltaX;
          left = current.startLeft + deltaX;
          break;
        default:
          break;
      }

      const displayMode: DialogDisplayMode = ctx.displayMode ?? 'normal';
      const normalized = normalizeDialogState(
        { width, height },
        { x: left, y: top },
        getViewportSize(),
        {
          enforceTopLeftMargin: displayMode === 'normal',
          minPosition: displayMode === 'full-screen' ? 0 : displayMode === 'normal' ? 0 : NON_STANDARD_MARGIN,
          clampSizeToViewport: displayMode !== 'full-screen',
        },
      );
      ctx.onSizeChange?.(normalized.size);
      ctx.onPositionChange?.(normalized.position);
    };

    activeResizeMoveListenerRef.current = handlePointerMove;

    const handlePointerUp = () => {
      if (activeResizeMoveListenerRef.current) {
        window.removeEventListener('pointermove', activeResizeMoveListenerRef.current);
        activeResizeMoveListenerRef.current = null;
      }
      window.removeEventListener('pointercancel', handlePointerUp);
      resizeStateRef.current = null;
      registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  };

  useEffect(() => () => {
    if (activeResizeMoveListenerRef.current) {
      window.removeEventListener('pointermove', activeResizeMoveListenerRef.current);
      activeResizeMoveListenerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleFrameMouseMove = useCallback(() => {
    if (frameDisplayMode !== 'full-screen' || !chromeHoverEnabled) {
      return;
    }
    setChromeVisible(true);
    if (hideChromeTimeoutRef.current) {
      window.clearTimeout(hideChromeTimeoutRef.current);
    }
    hideChromeTimeoutRef.current = window.setTimeout(() => {
      setChromeVisible(false);
      hideChromeTimeoutRef.current = null;
    }, 2000);
  }, [chromeHoverEnabled, frameDisplayMode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleFullscreenChange = () => {
      if (document.fullscreenElement && frameDisplayMode === 'full-screen') {
        syncFullscreenLayout();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [frameDisplayMode, syncFullscreenLayout]);

  useEffect(() => {
    if (frameDisplayMode !== 'full-screen') {
      return;
    }
    const handleResize = () => syncFullscreenLayout();
    window.addEventListener('resize', handleResize, { passive: true });
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [frameDisplayMode, syncFullscreenLayout]);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const viewport = getViewportSize();
  const fallbackSize = ctx.size ?? getPresetSize(frameDisplayMode, viewport);
  const defaultNonWindowedPosition: MultiDialogPosition = frameDisplayMode === 'normal'
    ? initialPosition(fallbackSize)
    : frameDisplayMode === 'maximize'
      ? { x: NON_STANDARD_MARGIN, y: NON_STANDARD_MARGIN }
      : { x: 0, y: 0 };
  const fallbackPosition = ctx.position ?? defaultNonWindowedPosition;

  const handlePaperClick: React.MouseEventHandler = (event) => event.stopPropagation();

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        overscrollBehavior: frameStyle.overscrollBehavior,
      }}
      onClick={handleBackdropClick}
      onMouseMove={chromeHoverEnabled ? handleFrameMouseMove : undefined}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: 'rgba(0,0,0,0.32)',
        }}
      />
      <Draggable
        nodeRef={panelRef}
        handle="#trash-dialog-title"
        cancel='[data-dialog-cancel-drag="true"]'
        position={fallbackPosition}
        onStart={registerDragStart}
        onStop={(_, data) => {
          ctx.onPositionChange?.({ x: data.x, y: data.y });
          registerDragEnd();
        }}
      >
        <Paper
          ref={panelRef}
          onClick={handlePaperClick}
          elevation={16}
          onWheelCapture={handleWheelCapture}
          sx={{
            width: fallbackSize.width,
            height: fallbackSize.height,
            maxWidth: frameDisplayMode === 'full-screen' ? '100vw' : 'calc(100vw - 48px)',
            maxHeight: frameDisplayMode === 'full-screen' ? '100vh' : 'calc(100vh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: frameDisplayMode === 'full-screen' ? 0 : 2,
            overflow: 'hidden',
            resize: 'none',
            backgroundColor: 'background.paper',
            position: 'relative',
            overscrollBehavior: frameStyle.overscrollBehavior,
          }}
        >
          <ResizeHandle
            position="top-left"
            onPointerDown={handleResizePointerDown('top-left')}
          />
          <ResizeHandle
            position="top"
            onPointerDown={handleResizePointerDown('top')}
          />
          <ResizeHandle
            position="top-right"
            onPointerDown={handleResizePointerDown('top-right')}
          />
          <ResizeHandle
            position="right"
            onPointerDown={handleResizePointerDown('right')}
          />
          <ResizeHandle
            position="bottom-left"
            onPointerDown={handleResizePointerDown('bottom-left')}
          />
          <ResizeHandle
            position="bottom"
            onPointerDown={handleResizePointerDown('bottom')}
          />
          <ResizeHandle
            position="bottom-right"
            onPointerDown={handleResizePointerDown('bottom-right')}
          />
          <ResizeHandle
            position="left"
            onPointerDown={handleResizePointerDown('left')}
          />
          <Box
            sx={{
              transition: 'opacity 150ms',
              opacity: headerVisible ? 1 : 0,
              pointerEvents: headerVisible ? 'auto' : 'none',
              height: headerVisible ? 'auto' : 0,
              overflow: 'hidden',
            }}
          >
            <MultiStepDialogHeader>
              {(headerProps: HeadlessHeaderRenderProps<Record<string, never>>) => (
                <TrashDialogHeader
                  {...headerProps}
                  title={title}
                  subtitle={subtitle}
                  onRequestClose={ctx.onRequestClose}
                  onResetToNormal={onResetToNormal}
                />
              )}
            </MultiStepDialogHeader>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <MultiDialogContent>
              {(contentProps) =>
                renderContent({
                  ...(contentProps as HeadlessContentRenderProps<Record<string, never>>),
                  displayMode: frameDisplayMode,
                  footerVisible,
                })
              }
            </MultiDialogContent>
          </Box>
          <Box
            sx={{
              transition: 'opacity 150ms',
              opacity: footerVisible ? 1 : 0,
              pointerEvents: footerVisible ? 'auto' : 'none',
              height: footerVisible ? 'auto' : 0,
              overflow: 'hidden',
            }}
          >
            <MultiStepDialogFooter>
              {(footerProps: HeadlessFooterRenderProps<Record<string, never>>) => (
                <TrashDialogFooter
                  {...footerProps}
                  mode={mode}
                  selectedCount={selectedCount}
                  totalCount={totalCount}
                  loading={loading}
                  onRestore={onRestore}
                  onEmpty={onEmpty}
                />
              )}
            </MultiStepDialogFooter>
          </Box>
        </Paper>
      </Draggable>
    </Box>,
    document.body,
  );
}

// ----------------------------------------
// Main component
// ----------------------------------------
export default function TrashDialog() {
  const data = useLoaderData<TrashDialogData>();
  const navigate = useNavigate();
  const params = useParams();
  const routeTreeId = params.treeId;
  const trashNodeIdParam = params.targetNodeId;
  const action = params.action;
  const treeId = (data.tree?.id as string | undefined) ?? routeTreeId;

  const mode: 'restore' | 'empty' = action === 'empty' ? 'empty' : 'restore';
  const activeTrashNodeId = data.activeTrashNodeId ?? (trashNodeIdParam as NodeId | null) ?? null;
  const effectiveTrashNodeId = activeTrashNodeId ?? (data.tree?.trashRootId as NodeId | undefined) ?? null;

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const viewportOnMount = { width: 1280, height: 720 };
  const defaultNormalSize = getPresetSize('normal', viewportOnMount);
  const initialNormalizedState = normalizeDialogState(
    defaultNormalSize,
    initialPosition(defaultNormalSize),
    viewportOnMount,
    { enforceTopLeftMargin: true },
  );

  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>('normal');
  const [chromeHoverEnabled, setChromeHoverEnabled] = useState(true);
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialNormalizedState.size);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialNormalizedState.position);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);
  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  const lastNormalStateRef = useRef<{ size: MultiDialogSize; position: MultiDialogPosition }>(initialNormalizedState);
  const hydrationRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const { body } = document;
    if (!body) {
      return;
    }
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleRestore = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const client = WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const result = await mutationAPI.restoreNodesFromTrash({ nodeIds: selectedIds });
      if (result.success) {
        navigate(-1);
        window.location.reload();
      } else {
        console.error('Failed to restore:', result.error);
      }
    } catch (error) {
      console.error('Error restoring items:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedIds, navigate]);

  const handleEmptyTrash = useCallback(async () => {
    if (!confirm('Are you sure you want to permanently delete all items in the trash? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      const client = await WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const allTrashIds = (data.trashItems ?? []).map((item) => item.id);
      if (allTrashIds.length > 0) {
        const result = await mutationAPI.removeNodes(allTrashIds);
        if (result.success) {
          const targetIds = (data.trashItems ?? []).map((item) => item.holderTargetId ?? item.id);
          window.dispatchEvent(new CustomEvent('hdb-remove', { detail: { treeId, nodeIds: targetIds.map(String) } }));
          navigate(-1);
          window.location.reload();
        } else {
          console.error('Failed to empty trash:', result.error);
        }
      }
    } catch (error) {
      console.error('Error emptying trash:', error);
    } finally {
      setLoading(false);
    }
  }, [data.trashItems, navigate, treeId]);

  const displayNodes = data.trashDisplayItems ?? data.trashItems ?? [];
  const trashRootNodeId = data.trashRootNode?.id as NodeId | undefined;

  const initialNodeMap = useMemo(() => {
    const map = new Map<string, TreeNode>();
    if (data.trashRootNode) {
      map.set(String(data.trashRootNode.id), data.trashRootNode);
    }
    (data.trashItems ?? []).forEach((node) => {
      map.set(String(node.id), node);
    });
    displayNodes.forEach((node) => {
      map.set(String(node.id), node);
    });
    return map;
  }, [data.trashRootNode, data.trashItems, displayNodes]);

  const [holderLookupState, setHolderLookupState] = useState<Record<string, { holderId: NodeId; holderName?: string }>>(
    () => data.holderLookup ?? {},
  );

  useEffect(() => {
    setHolderLookupState(data.holderLookup ?? {});
  }, [data.holderLookup]);

  const [nodeMap, setNodeMap] = useState<Map<string, TreeNode>>(initialNodeMap);

  const refreshTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    setNodeMap(initialNodeMap);
  }, [initialNodeMap]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refreshTrashTree = useCallback(async () => {
    if (!trashRootNodeId || !treeId || !data.trashRootNode) return;
    const trashRootIdValue = trashRootNodeId;
    try {
      const client = await WorkerAPIClient.getSingleton();
      const queryAPI = await client.getQueryAPI();
      const PREFETCH_DEPTH = 8;
      const [rootNode, descendants] = await Promise.all([
        queryAPI.getNode(trashRootIdValue),
        queryAPI.listChildren(trashRootIdValue, { prefetch: { depth: PREFETCH_DEPTH } }),
      ]);
      console.log('[TrashDialog refresh] listChildren', {
        parentId: String(trashRootIdValue),
        depth: PREFETCH_DEPTH,
        total: descendants.length,
        sample: descendants.slice(0, 5),
      });

      if (!mountedRef.current) {
        return;
      }

      const rootIdStr = String(trashRootIdValue);
      const placeholderMap = new Map<string, TreeNode>();
      descendants.forEach((node) => {
        if (node.parentId && String(node.parentId) === rootIdStr) {
          placeholderMap.set(String(node.id), node);
        }
      });

      let augmentedDescendants = descendants;
      if (placeholderMap.size > 0) {
        const placeholderIds = Array.from(placeholderMap.keys());
        const nestedResults = await Promise.all(
          placeholderIds.map(async (placeholderId) => {
            const nested = await queryAPI.listChildren(placeholderId as NodeId, { prefetch: { depth: PREFETCH_DEPTH } });
            console.log('[TrashDialog refresh] placeholder children', {
              placeholderId,
              total: nested.length,
              sample: nested.slice(0, 5),
            });
            return nested;
          }),
        );
        const placeholderChildren = nestedResults.flat();
        const unique = new Map<string, TreeNode>();
        descendants.forEach((node) => unique.set(String(node.id), node));
        placeholderChildren.forEach((node) => unique.set(String(node.id), node));
        augmentedDescendants = Array.from(unique.values());
      }

      const nextMap = new Map<string, TreeNode>();
      if (rootNode) {
        nextMap.set(String(rootNode.id), rootNode);
      } else {
        nextMap.set(String(data.trashRootNode.id), data.trashRootNode);
      }
      augmentedDescendants.forEach((node) => {
        nextMap.set(String(node.id), node);
      });

      const nextLookup: Record<string, { holderId: NodeId; holderName?: string }> = {};
      augmentedDescendants.forEach((node) => {
        const parentId = node.parentId ? String(node.parentId) : undefined;
        if (!parentId) return;
        const holderNode = placeholderMap.get(parentId);
        if (holderNode) {
          nextLookup[String(node.id)] = {
            holderId: holderNode.id as NodeId,
            holderName: holderNode.name,
          };
          return;
        }
        const holderId = (node as { holderTargetId?: NodeId }).holderTargetId;
        if (holderId) {
          nextLookup[String(node.id)] = {
            holderId,
            holderName: node.name,
          };
        }
      });

      if (!mountedRef.current) {
        return;
      }

      setNodeMap(nextMap);
      setHolderLookupState(nextLookup);
      console.log('[TrashDialog refresh] normalized state', {
        nodeCount: nextMap.size,
        holderLookup: nextLookup,
      });
    } catch (error) {
      console.warn('[TrashDialog] failed to refresh trash data', error);
    }
  }, [data.trashRootNode, trashRootNodeId, treeId]);

  const scheduleTrashRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshTrashTree();
    }, 120);
  }, [refreshTrashTree]);

  const [treeData, setTreeData] = useState<TreeNodeData[]>(() => {
    if (!data.trashRootNode || !treeId) return [];
    const initial = buildTrashTreeData({
      treeId,
      rootNode: data.trashRootNode,
      targetNodeIds: Array.from(initialNodeMap.keys()) as NodeId[],
      holderLookup: holderLookupState,
      nodeMap: initialNodeMap,
      activeNodeId: effectiveTrashNodeId ?? null,
    }).nodes;
    console.log('[TrashDialog] treeData initial', {
      treeId,
      activeNodeId: effectiveTrashNodeId,
      total: initial.length,
      sample: initial.slice(0, 10),
    });
    return initial;
  });

  useEffect(() => {
    if (!data.trashRootNode || !treeId) {
      setTreeData([]);
      console.log('[TrashDialog] treeData cleared');
      return;
    }
    const { nodes } = buildTrashTreeData({
      treeId,
      rootNode: data.trashRootNode,
      targetNodeIds: Array.from(nodeMap.keys()) as NodeId[],
      holderLookup: holderLookupState,
      nodeMap,
      activeNodeId: effectiveTrashNodeId ?? null,
    });
    setTreeData(nodes);
    console.log('[TrashDialog] treeData recomputed', {
      treeId,
      activeNodeId: effectiveTrashNodeId,
      total: nodes.length,
      sample: nodes.slice(0, 10),
    });
  }, [nodeMap, holderLookupState, data.trashRootNode, treeId, effectiveTrashNodeId]);

  const trashRootId = data.trashRootNode ? String(data.trashRootNode.id) : '';

  const [expandedIds, setExpandedIds] = useState<string[]>(() => (trashRootId ? [trashRootId] : []));

  useEffect(() => {
    if (!trashRootId) return;
    setExpandedIds((prev) => (prev.includes(trashRootId) ? prev : [trashRootId, ...prev]));
  }, [trashRootId]);

  const handleToggleExpand = useCallback((nodeId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const id = String(nodeId);
      if (expanded) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((value) => value !== id);
    });

    if (!expanded) {
      return;
    }

    const hasChildrenAlready = treeData.some((node) => String(node.parentId ?? '') === nodeId);
    if (hasChildrenAlready) {
      return;
    }

    void (async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        const queryAPI = await client.getQueryAPI();
        const fetched = await queryAPI.listChildren(nodeId as NodeId, { prefetch: { depth: 2 } });
        console.log('[TrashDialog expand] listChildren', {
          parentId: nodeId,
          depth: 2,
          total: fetched?.length ?? 0,
          sample: fetched?.slice?.(0, 5),
        });
        if (!fetched || fetched.length === 0) {
          return;
        }

        setNodeMap((prev) => {
          const next = new Map(prev);
          fetched.forEach((node) => {
            next.set(String(node.id), node);
          });
          return next;
        });

        setHolderLookupState((prev) => {
          const next = { ...prev };
          fetched.forEach((node) => {
            const holderId = (node as { holderTargetId?: NodeId }).holderTargetId;
            if (holderId) {
              next[String(holderId)] = {
                holderId: node.id as NodeId,
                holderName: node.name,
              };
            }
          });
          return next;
        });
      } catch (error) {
        console.warn('[TrashDialog] failed to prefetch descendants', error);
      }
    })();
  }, [treeData]);

  useEffect(() => {
    const rootNode = data.trashRootNode;
    if (!treeId || !rootNode) {
      return;
    }

    let cancelled = false;
    let currentSubId: SubscriptionId | null = null;
    let subscriptionAPI: TreeSubscriptionAPI | null = null;

    const setup = async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        subscriptionAPI = await client.getSubscriptionAPI();
        const callback = comlinkProxy((_event: unknown) => {
          if (cancelled) return;
          scheduleTrashRefresh();
        });
        currentSubId = await subscriptionAPI.subscribeSubtree(
          rootNode.id as NodeId,
          callback as (event: any) => void,
          { prefetch: { depth: 8 } },
        );
        if (!cancelled) {
          await refreshTrashTree();
        }
      } catch (error) {
        console.warn('[TrashDialog] failed to subscribe trash subtree', error);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (currentSubId) {
        void (async () => {
          try {
            const client = await WorkerAPIClient.getSingleton();
            const api = subscriptionAPI ?? (await client.getSubscriptionAPI());
            await api.unsubscribe(currentSubId);
          } catch (error) {
            console.warn('[TrashDialog] failed to unsubscribe trash subtree', error);
          }
        })();
      }
    };
  }, [data.trashRootNode, refreshTrashTree, scheduleTrashRefresh, trashRootNodeId, treeId]);

  const dialogContextName = data.trashRootNode?.name ?? (effectiveTrashNodeId ? String(effectiveTrashNodeId) : data.tree?.name ?? '');
  const breadcrumbItems = useMemo<BreadcrumbNode[]>(() => {
    if (!data.trashRootNode || !treeId) return [];
    return buildTrashBreadcrumbs({
      treeId,
      rootNode: data.trashRootNode,
      targetNodeId: effectiveTrashNodeId,
      holderLookup: holderLookupState,
      nodeMap,
    });
  }, [data.trashRootNode, holderLookupState, effectiveTrashNodeId, treeId, nodeMap]);

  const columns: TreeTableColumn[] = useMemo(() => [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      width: 300,
      render: (_value: unknown, node: TreeNodeData) => node.name,
    },
    {
      id: 'nodeType',
      label: 'Type',
      sortable: true,
      width: 120,
      render: (_value: unknown, node: TreeNodeData) => node.nodeType,
    },
  ], []);

  const handleEmptySingle = useCallback(
    async (node: TreeNodeData) => {
      const ok = confirm('Permanently delete this item? This cannot be undone.');
      if (!ok) return;
      try {
        const client = WorkerAPIClient.getSingleton();
        const mutationAPI = await client.getMutationAPI();
        const holderId = data.holderLookup?.[String(node.id)]?.holderId ?? (node.id as NodeId);
        const res = await mutationAPI.removeNodes([holderId]);
        if (res.success) {
          try {
            const raw = (data.trashItems ?? []).find((t) => String(t.id) === String(holderId));
            const targetId = raw?.holderTargetId ?? node.id;
            window.dispatchEvent(new CustomEvent('hdb-remove', { detail: { treeId, nodeIds: [String(targetId)] } }));
          } catch (error) {
            console.warn('[TrashDialog] Failed to dispatch hdb-remove event', error);
          }
          window.location.reload();
        } else {
          console.error('Permanent delete failed:', res.error);
        }
      } catch (error) {
        console.error('Error removing item:', error);
      }
    },
    [data.holderLookup, data.trashItems, treeId],
  );

  const renderContent = useCallback(
    ({ displayMode: frameMode, footerVisible }: TrashDialogContentRenderProps) => (
      <TrashDialogContent
        loading={loading}
        titleSuffix={dialogContextName || 'Trash'}
        treeData={treeData}
        columns={columns}
        breadcrumbItems={breadcrumbItems}
        selectedIds={selectedIds}
        setSelectedIds={(updater) => setSelectedIds((prev) => updater(Array.from(prev)))}
        treeId={treeId}
        pageNodeId={effectiveTrashNodeId}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => setSearchTerm(value)}
        onSearchClear={() => setSearchTerm('')}
        mode={mode}
        onRestore={handleRestore}
        onEmptyItem={handleEmptySingle}
        displayMode={frameMode}
        footerVisible={footerVisible}
        expandedIds={expandedIds}
        onToggleExpand={handleToggleExpand}
        holderLookup={holderLookupState}
      />
    ),
    [
      loading,
      dialogContextName,
      treeData,
      columns,
      breadcrumbItems,
      selectedIds,
      searchTerm,
      treeId,
      effectiveTrashNodeId,
      expandedIds,
      handleToggleExpand,
      mode,
      handleRestore,
      handleEmptySingle,
    ],
  );

  useEffect(() => {
    hydrationRef.current = false;
    if (!effectiveTrashNodeId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const props = await getProperties(effectiveTrashNodeId);
        if (cancelled) return;
        const viewport = getViewportSize();
        const persistedSize = props?.dialogSize ?? dialogSizeRef.current;
        const persistedPosition = props?.dialogPosition ?? dialogPositionRef.current;
        const rawMode = props?.dialogDisplayMode;
        const persistedMode: DialogDisplayMode =
          rawMode === 'full-screen' || rawMode === 'maximize' || rawMode === 'normal'
            ? rawMode
            : 'normal';
        const normalized = normalizeDialogState(
          persistedSize,
          persistedPosition,
          viewport,
          {
            enforceTopLeftMargin: persistedMode === 'normal',
            minPosition: persistedMode === 'full-screen' ? 0 : persistedMode === 'normal' ? 0 : NON_STANDARD_MARGIN,
            clampSizeToViewport: persistedMode !== 'full-screen',
          },
        );
        setDialogSize(normalized.size);
        setDialogPosition(normalized.position);
        dialogSizeRef.current = normalized.size;
        dialogPositionRef.current = normalized.position;
        lastNormalStateRef.current = normalized;
        if (persistedMode !== 'normal') {
          const viewport = getViewportSize();
          const preset = getPresetSize(persistedMode, viewport);
          const fullNormalized = normalizeDialogState(
            preset,
            { x: persistedMode === 'full-screen' ? 0 : NON_STANDARD_MARGIN, y: persistedMode === 'full-screen' ? 0 : NON_STANDARD_MARGIN },
            viewport,
            {
              enforceTopLeftMargin: false,
              minPosition: persistedMode === 'full-screen' ? 0 : NON_STANDARD_MARGIN,
              clampSizeToViewport: persistedMode !== 'full-screen',
            },
          );
          setDialogSize(fullNormalized.size);
          setDialogPosition(fullNormalized.position);
          dialogSizeRef.current = fullNormalized.size;
          dialogPositionRef.current = fullNormalized.position;
        }
        setDisplayMode(persistedMode);
      } catch (error: unknown) {
        console.warn('[TrashDialog] failed to load dialog properties', error);
      } finally {
        hydrationRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveTrashNodeId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;

    const scheduleNormalization = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const viewport = getViewportSize();
        let desiredSize: MultiDialogSize = dialogSizeRef.current;
        let desiredPosition: MultiDialogPosition = dialogPositionRef.current;
        let options: NormalizeOptions = {
          enforceTopLeftMargin: displayMode === 'normal',
          minPosition: displayMode === 'normal' ? 0 : NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };

        if (displayMode === 'full-screen') {
          desiredSize = {
            width: Math.max(viewport.width, MIN_DIALOG_WIDTH),
            height: Math.max(viewport.height, MIN_DIALOG_HEIGHT),
          };
          desiredPosition = { x: 0, y: 0 };
          options = {
            enforceTopLeftMargin: false,
            minPosition: 0,
            clampSizeToViewport: true,
          };
        } else if (displayMode === 'maximize') {
          desiredSize = getPresetSize('maximize', viewport);
          desiredPosition = { x: NON_STANDARD_MARGIN, y: NON_STANDARD_MARGIN };
          options = {
            enforceTopLeftMargin: false,
            minPosition: NON_STANDARD_MARGIN,
            clampSizeToViewport: true,
          };
        }

        const normalized = normalizeDialogState(
          desiredSize,
          desiredPosition,
          viewport,
          options,
        );
        if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
          dialogSizeRef.current = normalized.size;
          setDialogSize(normalized.size);
        }
        if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
          dialogPositionRef.current = normalized.position;
          setDialogPosition(normalized.position);
        }
      });
    };

    window.addEventListener('resize', scheduleNormalization, { passive: true });
    scheduleNormalization();

    return () => {
      window.removeEventListener('resize', scheduleNormalization);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [displayMode]);

  useEffect(() => {
    if (!effectiveTrashNodeId || !hydrationRef.current) return;
    const handle = setTimeout(() => {
      const normalState = lastNormalStateRef.current;
      const sizeToPersist = displayMode === 'normal' ? dialogSizeRef.current : normalState.size;
      const positionToPersist = displayMode === 'normal' ? dialogPositionRef.current : normalState.position;
      saveProperties(effectiveTrashNodeId, {
        dialogSize: sizeToPersist,
        dialogPosition: positionToPersist,
        dialogDisplayMode: displayMode,
      }).catch((error: unknown) => console.warn('[TrashDialog] failed to persist dialog properties', error));
    }, 200);
    return () => clearTimeout(handle);
  }, [effectiveTrashNodeId, dialogSize, dialogPosition, displayMode]);

  useEffect(() => {
    if (displayMode === 'normal') {
      lastNormalStateRef.current = {
        size: dialogSizeRef.current,
        position: dialogPositionRef.current,
      };
    }
  }, [displayMode, dialogSize, dialogPosition]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const mode = displayMode;
    if (mode === 'full-screen') return;
    const viewport = getViewportSize();
    const normalized = normalizeDialogState(
      dialogSizeRef.current,
      next,
      viewport,
      {
        enforceTopLeftMargin: mode === 'normal',
        minPosition: mode === 'normal' ? 0 : NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
      dialogSizeRef.current = normalized.size;
      setDialogSize(normalized.size);
    }
    if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
      dialogPositionRef.current = normalized.position;
      setDialogPosition(normalized.position);
    }
  }, [displayMode]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const mode = displayMode;
    if (mode === 'full-screen') return;
    const viewport = getViewportSize();
    const normalized = normalizeDialogState(
      next,
      dialogPositionRef.current,
      viewport,
      {
        enforceTopLeftMargin: mode === 'normal',
        minPosition: mode === 'normal' ? 0 : NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
      dialogSizeRef.current = normalized.size;
      setDialogSize(normalized.size);
    }
    if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
      dialogPositionRef.current = normalized.position;
      setDialogPosition(normalized.position);
    }
  }, [displayMode]);

  const applyDisplayModeTransition = useCallback((prevMode: DialogDisplayMode, nextMode: DialogDisplayMode) => {
    const applyNormalizedState = (normalized: { size: MultiDialogSize; position: MultiDialogPosition }) => {
      dialogSizeRef.current = normalized.size;
      dialogPositionRef.current = normalized.position;
      setDialogSize(normalized.size);
      setDialogPosition(normalized.position);
    };

    const run = async () => {
      try {
        if (nextMode === 'full-screen') {
          await ensureFullscreenEntered();
          setChromeHoverEnabled(true);
          const viewport = getViewportSize();
          const preset: MultiDialogSize = {
            width: Math.max(viewport.width, MIN_DIALOG_WIDTH),
            height: Math.max(viewport.height, MIN_DIALOG_HEIGHT),
          };
          const normalized = normalizeDialogState(
            preset,
            { x: 0, y: 0 },
            viewport,
            { enforceTopLeftMargin: false, minPosition: 0 },
          );
          applyNormalizedState(normalized);
          return;
        }

        if (prevMode === 'full-screen') {
          await ensureFullscreenExited();
        }

        const viewport = getViewportSize();

        if (nextMode === 'normal') {
          const normalized = normalizeDialogState(
            lastNormalStateRef.current.size,
            lastNormalStateRef.current.position,
            viewport,
            { enforceTopLeftMargin: true },
          );
          applyNormalizedState(normalized);
          setChromeHoverEnabled(true);
          return;
        }

        const preset = getPresetSize(nextMode, viewport);
        const normalized = normalizeDialogState(
          preset,
          { x: NON_STANDARD_MARGIN, y: NON_STANDARD_MARGIN },
          viewport,
          { enforceTopLeftMargin: false, minPosition: NON_STANDARD_MARGIN },
        );
        applyNormalizedState(normalized);
        setChromeHoverEnabled(true);
      } catch (error) {
        console.warn('[TrashDialog] failed to apply display mode transition', error);
      }
    };

    void run();
  }, [setChromeHoverEnabled, setDialogPosition, setDialogSize]);

  const handleDisplayModeChange = useCallback((mode: DialogDisplayMode) => {
    setDisplayMode((prevMode) => {
      if (prevMode === mode) {
        return prevMode;
      }

      if (prevMode === 'normal') {
        lastNormalStateRef.current = {
          size: dialogSizeRef.current,
          position: dialogPositionRef.current,
        };
      }

      if (mode === 'full-screen') {
        setChromeHoverEnabled(false);
      }

      applyDisplayModeTransition(prevMode, mode);
      return mode;
    });
  }, [applyDisplayModeTransition, setChromeHoverEnabled]);

  const handleResetToNormal = useCallback(() => {
    const viewport = getViewportSize();
    const baseSize = getPresetSize('normal', viewport);
    const centeredPosition = initialPosition(baseSize);
    const normalized = normalizeDialogState(baseSize, centeredPosition, viewport, { enforceTopLeftMargin: true });
    lastNormalStateRef.current = normalized;
    setDialogSize(normalized.size);
    setDialogPosition(normalized.position);
    dialogSizeRef.current = normalized.size;
    dialogPositionRef.current = normalized.position;
    setDisplayMode('normal');
  }, []);

  const providerValue = useMemo(() => ({
    open: true,
    stepComponents: STEP_ARRAY,
    stepData: {} as Record<string, never>,
    onStepDataChange: () => undefined,
    activeStepIndex: 0,
    enabledStepIndices: [0],
    validatedStepIndices: [0],
    committableStepIndices: [0],
    invalidMessageMap: {},
    isDirty: mode === 'restore' ? selectedIds.length > 0 : (data.trashItems?.length ?? 0) > 0,
    onStepNavigate: () => undefined,
    onRequestClose: () => handleClose(),
    onRequestCommit: mode === 'restore' ? () => handleRestore() : () => handleEmptyTrash(),
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: handleDisplayModeChange,
  }), [mode, selectedIds.length, data.trashItems, handleClose, handleRestore, handleEmptyTrash, dialogPosition, dialogSize, displayMode, handlePositionChange, handleSizeChange, handleDisplayModeChange]);

  const dialogTitle = `${EMOJI_TITLE} ${mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'}${dialogContextName ? ` – ${dialogContextName}` : ''}`;

  return (
    <MultiStepDialogProvider value={providerValue}>
      <TrashDialogFrame
        title={dialogTitle}
        subtitle={mode === 'restore' ? 'Select items to restore back into the tree.' : 'Permanently remove everything in trash.'}
        mode={mode}
        selectedCount={selectedIds.length}
        totalCount={data.trashItems?.length ?? 0}
        loading={loading}
        onRestore={() => void handleRestore()}
        onEmpty={() => void handleEmptyTrash()}
        chromeHoverEnabled={chromeHoverEnabled}
        onChromeHoverEnabledChange={setChromeHoverEnabled}
        renderContent={renderContent}
        onResetToNormal={handleResetToNormal}
      />
    </MultiStepDialogProvider>
  );
}

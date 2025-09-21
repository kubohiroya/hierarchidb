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
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-type';

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
  const trashItems = (await queryAPI.listChildren(activeTrashNodeId)) as TreeNode[];

  const isRootTrash = Boolean(fallbackTrashId && activeTrashNodeId === fallbackTrashId);
  let trashDisplayItems = trashItems;
  const holderLookup: Record<string, { holderId: NodeId; holderName?: string }> = {};

  if (isRootTrash && trashItems.length > 0) {
    const batches = await Promise.all(
      trashItems.map(async (holder: TreeNode) => {
        const childNodes = (await queryAPI.listChildren(holder.id as NodeId)) as TreeNode[];
        return childNodes.map((child: TreeNode) => {
          holderLookup[String(child.id)] = { holderId: holder.id as NodeId, holderName: holder.name };
          return {
            ...child,
            parentId: activeTrashNodeId,
            depth: 1,
          } as TreeNode;
        });
      }),
    );
    trashDisplayItems = batches.flat();
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

type ResizeDirection = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

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
  'top-right': {
    top: 0,
    right: 0,
    cursor: 'nesw-resize',
    transform: 'translate(50%, -50%)',
  },
  'bottom-left': {
    bottom: 0,
    left: 0,
    cursor: 'nesw-resize',
    transform: 'translate(-50%, 50%)',
  },
  'bottom-right': {
    bottom: 0,
    right: 0,
    cursor: 'nwse-resize',
    transform: 'translate(50%, 50%)',
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
  breadcrumbItems: { id: NodeId; name: string; nodeType: string }[];
  selectedIds: NodeId[];
  setSelectedIds: (updater: (prev: NodeId[]) => NodeId[]) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchClear: () => void;
  mode: 'restore' | 'empty';
  onRestore: () => Promise<void> | void;
  onEmptyItem: (node: TreeNodeData) => Promise<void> | void;
  displayMode: DialogDisplayMode;
  footerVisible: boolean;
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
  mode,
  searchTerm,
  onSearchTermChange,
  onSearchClear,
  onRestore,
  onEmptyItem,
  displayMode,
  footerVisible,
}: TrashDialogContentProps) {
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

  const footerOffset = footerVisible ? FOOTER_HEIGHT : 0;
  const panelHeight = `calc(100% - ${footerOffset}px)`;

  return (
    <Box
      data-dialog-cancel-drag="true"
      sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, mt: 1 }}
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
        sx={{ flex: 1, minHeight: 0, height: panelHeight, display: 'flex' }}
      >
        <TreeConsolePanel
          title={`Trash – ${titleSuffix}`}
          pageNodeId={undefined}
          data={treeData}
          columns={columns}
          breadcrumbItems={breadcrumbItems}
          loading={false}
          selectedIds={selectedIds.map(String)}
          expandedIds={[]}
          viewMode="list"
          canCreate={false}
          canEdit={false}
          canDelete={mode === 'empty'}
          hideDragHandler
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
          onNodeExpand={() => undefined}
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
      <Box data-dialog-cancel-drag="true" sx={{ height: footerOffset, flexShrink: 0 }} />
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
  const draggingRef = useRef(false);
  const ignoreBackdropClickRef = useRef(false);
  const ignoreBackdropTimeoutRef = useRef<number | null>(null);
  const frameDisplayMode: DialogDisplayMode = ctx.displayMode ?? 'normal';
  const [chromeVisible, setChromeVisible] = useState(true);
  const footerVisible = frameDisplayMode === 'full-screen' ? chromeVisible : true;
  const headerVisible = frameDisplayMode === 'full-screen' ? chromeVisible : true;

  const scheduleBackdropClickIgnore = useCallback(() => {
    ignoreBackdropClickRef.current = true;
    if (ignoreBackdropTimeoutRef.current !== null) {
      window.clearTimeout(ignoreBackdropTimeoutRef.current);
    }
    ignoreBackdropTimeoutRef.current = window.setTimeout(() => {
      ignoreBackdropClickRef.current = false;
      ignoreBackdropTimeoutRef.current = null;
    }, 0);
  }, []);

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

    draggingRef.current = true;
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
        case 'bottom-left':
          width = current.startWidth - deltaX;
          height = current.startHeight + deltaY;
          left = current.startLeft + deltaX;
          break;
        case 'top-right':
          width = current.startWidth + deltaX;
          height = current.startHeight - deltaY;
          top = current.startTop + deltaY;
          break;
        case 'top-left':
          width = current.startWidth - deltaX;
          height = current.startHeight - deltaY;
          left = current.startLeft + deltaX;
          top = current.startTop + deltaY;
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
      draggingRef.current = false;
      scheduleBackdropClickIgnore();
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
    if (ignoreBackdropTimeoutRef.current !== null) {
      window.clearTimeout(ignoreBackdropTimeoutRef.current);
      ignoreBackdropTimeoutRef.current = null;
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

  const handleBackdropClick = () => {
    if (draggingRef.current || ignoreBackdropClickRef.current) {
      return;
    }
    ctx.onRequestClose?.('close');
  };
  const handleWheelCapture = useCallback((event: React.WheelEvent) => {
    if (draggingRef.current) return;
    event.stopPropagation();
  }, []);
  const handlePaperClick: React.MouseEventHandler = (event) => event.stopPropagation();

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
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
        onStart={() => {
          draggingRef.current = true;
        }}
        onStop={(_, data) => {
          ctx.onPositionChange?.({ x: data.x, y: data.y });
          draggingRef.current = false;
          scheduleBackdropClickIgnore();
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
          }}
        >
          <ResizeHandle
            position="top-left"
            onPointerDown={handleResizePointerDown('top-left')}
          />
          <ResizeHandle
            position="top-right"
            onPointerDown={handleResizePointerDown('top-right')}
          />
          <ResizeHandle
            position="bottom-left"
            onPointerDown={handleResizePointerDown('bottom-left')}
          />
          <ResizeHandle
            position="bottom-right"
            onPointerDown={handleResizePointerDown('bottom-right')}
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
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
  const { treeId, targetNodeId: trashNodeIdParam, action } = useParams();

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
  const treeData: TreeNodeData[] = useMemo(
    () =>
      displayNodes.map((node) => ({
        ...node,
        id: node.id,
        nodeType: node.nodeType,
        depth: 1,
        children: undefined,
      })),
    [displayNodes],
  );

  const filteredTreeData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return treeData;
    return treeData.filter((node) => {
      const nameMatch = (node.name ?? '').toLowerCase().includes(term);
      const typeMatch = (node.nodeType ?? '').toLowerCase().includes(term);
      const holderMatch = data.holderLookup?.[String(node.id)]?.holderName?.toLowerCase().includes(term);
      return nameMatch || typeMatch || Boolean(holderMatch);
    });
  }, [treeData, searchTerm, data.holderLookup]);

  const dialogContextName = data.trashRootNode?.name ?? (effectiveTrashNodeId ? String(effectiveTrashNodeId) : data.tree?.name ?? '');
  const breadcrumbItems = data.trashRootNode
    ? [{ id: data.trashRootNode.id, name: data.trashRootNode.name ?? 'Trash', nodeType: data.trashRootNode.nodeType ?? 'trash' }]
    : [];

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
        treeData={filteredTreeData}
        columns={columns}
        breadcrumbItems={breadcrumbItems}
        selectedIds={selectedIds}
        setSelectedIds={(updater) => setSelectedIds((prev) => updater(Array.from(prev)))}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => setSearchTerm(value)}
        onSearchClear={() => setSearchTerm('')}
        mode={mode}
        onRestore={handleRestore}
        onEmptyItem={handleEmptySingle}
        displayMode={frameMode}
        footerVisible={footerVisible}
      />
    ),
    [loading, dialogContextName, filteredTreeData, columns, breadcrumbItems, selectedIds, searchTerm, mode, handleRestore, handleEmptySingle],
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

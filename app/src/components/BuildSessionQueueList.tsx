import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  ClickAwayListener,
  Badge,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ConstructionIcon from '@mui/icons-material/Construction';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LayersIcon from '@mui/icons-material/Layers';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import TuneIcon from '@mui/icons-material/Tune';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { useWorkerQueryAPI } from '@hierarchidb/ui-build-sessions';
import type { TreeNode } from '@hierarchidb/tree-api';

type BuildSessionStatusMode = 'running' | 'waiting';

type BuildSessionStatusView = {
  mode: BuildSessionStatusMode;
  elapsedText: string;
  percentageText?: string;
};

export type BuildSessionQueueEntry = {
  session: BuildSessionRuntimeRecord;
  node: TreeNode | null;
  nodePath: string;
};

type BuildSessionQueueCompactMode = 'summary' | 'icon-badge';

type BuildSessionQueueListProps = {
  nodeType?: NodeType;
  onNavigateToBuild?: (entry: BuildSessionQueueEntry) => void;
  compact?: boolean;
  compactMode?: BuildSessionQueueCompactMode;
};

type QueueRow = {
  session: BuildSessionRuntimeRecord;
  node: TreeNode | null;
  nodePath: string;
};

const RUNNING_STATUSES = new Set<BuildSessionRuntimeRecord['status']>([
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
]);

const QUEUE_STATUSES: BuildSessionRuntimeRecord['status'][] = [
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
  'paused',
  'failed',
];

const getNow = (): number => Date.now();

const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const toNodePathLabel = (nodes: TreeNode[]): string =>
  nodes
    .map((node) => String(node.metadata?.name ?? node.id ?? ''))
    .filter(Boolean)
    .join(' > ');

const resolveStageIcon = (stage: string | undefined) => {
  const sizeProps = { fontSize: 'small' as const };
  if (stage === 'fetch') {
    return <CloudDownloadIcon {...sizeProps} />;
  }

  if (stage === 'transform') {
    return <TuneIcon {...sizeProps} />;
  }

  if (stage === 'vt') {
    return <LayersIcon {...sizeProps} />;
  }

  return null;
};

const isRunningSession = (session: BuildSessionRuntimeRecord): boolean =>
  session.isActive || RUNNING_STATUSES.has(session.status);

const normalizeWaitingFirst = (rows: QueueRow[]): QueueRow[] => {
  const running: QueueRow[] = [];
  const waiting: QueueRow[] = [];
  for (const row of rows) {
    if (isRunningSession(row.session)) {
      running.push(row);
    } else {
      waiting.push(row);
    }
  }
  return [...running, ...waiting];
};

const mergeSessionOrder = (previous: QueueRow[], incoming: BuildSessionRuntimeRecord[]): QueueRow[] => {
  if (incoming.length === 0) {
    return [];
  }

  const incomingByNodeId = new Map<string, BuildSessionRuntimeRecord>(
    incoming.map((session) => [String(session.nodeId), session])
  );

  const merged = previous
    .filter((row) => incomingByNodeId.has(String(row.session.nodeId)))
    .map((row) => {
      const nextSession = incomingByNodeId.get(String(row.session.nodeId));
      if (!nextSession) {
        return row;
      }
      return {
        ...row,
        session: nextSession,
      };
    });

  const existingIds = new Set<string>(merged.map((row) => String(row.session.nodeId)));
  const added = incoming.filter((session) => !existingIds.has(String(session.nodeId)));

  return [
    ...merged,
    ...added.map((session) => ({
      session,
      node: null,
      nodePath: String(session.nodeId),
    })),
  ];
};

export function BuildSessionQueueList({
  nodeType = toNodeType('shape'),
  onNavigateToBuild,
  compact = false,
  compactMode = 'summary',
}: BuildSessionQueueListProps) {
  const { resolveIcon } = useIconRegistry();
  const { t } = useGlobalI18nTranslator();
  const { getQueryAPIOrNull } = useWorkerQueryAPI();
  const bridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [now, setNow] = useState<number>(getNow);
  const [draggingNodeId, setDraggingNodeId] = useState<NodeId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QueueRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const queueStoppedRef = useRef<boolean>(false);
  const autoStartingNodeRef = useRef<NodeId | null>(null);

  const nodeCacheRef = useRef<Map<string, { node: TreeNode | null; nodePath: string }>>(new Map());

  const loadSessions = useCallback(async () => {
    try {
      const bridge = bridgeRef.current;
      await bridge.initialize();
      const sessions = await bridge.listBuildSessionRuntimes(nodeType, {
        statuses: [...QUEUE_STATUSES],
      });
      setRows((current) => normalizeWaitingFirst(mergeSessionOrder(current, sessions)));
    } catch (error) {
      console.warn('[BuildSessionQueueList] listBuildSessionRuntimes failed', error);
    }
  }, [nodeType]);

  useEffect(() => {
    void loadSessions();

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    const subscribe = async () => {
      try {
        const bridge = bridgeRef.current;
        await bridge.initialize();
        unsubscribe = await bridge.subscribeBuildSessionRuntimes(
          nodeType,
          { statuses: [...QUEUE_STATUSES] },
          (nextSessions) => {
            if (disposed) {
              return;
            }
            const filtered = nextSessions.filter((session) => QUEUE_STATUSES.includes(session.status));
            setRows((current) => normalizeWaitingFirst(mergeSessionOrder(current, filtered)));
          }
        );
      } catch (error) {
        console.warn('[BuildSessionQueueList] subscribeBuildSessionRuntimes failed', error);
      }
    };

    void subscribe();

    return () => {
      disposed = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadSessions, nodeType]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getNow());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const loadNodeInfo = async () => {
      const queryAPI = await getQueryAPIOrNull();
      if (!queryAPI) {
        return;
      }

      const cache = new Map(nodeCacheRef.current);
      const missingNodeIds = new Set<string>();

      for (const row of rows) {
        const nodeId = String(row.session.nodeId);
        if (!cache.has(nodeId)) {
          missingNodeIds.add(nodeId);
        }
      }

      if (missingNodeIds.size === 0) {
        return;
      }

      await Promise.all(Array.from(missingNodeIds).map(async (nodeId) => {
        const pathNodes = await queryAPI.getNodePath(nodeId as NodeId).catch(() => []);
        const node = pathNodes[pathNodes.length - 1] ?? null;
        const nodePath = pathNodes.length > 0 ? toNodePathLabel(pathNodes) : nodeId;
        cache.set(nodeId, { node, nodePath });
      }));

      nodeCacheRef.current = cache;

      let changed = false;
      const nextRows = rows.map((row) => {
        const nodeId = String(row.session.nodeId);
        const cached = cache.get(nodeId);
        if (!cached) {
          return row;
        }

        const nextRow: QueueRow = {
          ...row,
          node: cached.node,
          nodePath: cached.nodePath,
        };

        if (
          nextRow.node === row.node &&
          nextRow.nodePath === row.nodePath &&
          nextRow.session.status === row.session.status &&
          nextRow.session.updatedAt === row.session.updatedAt
        ) {
          return row;
        }

        changed = true;
        return nextRow;
      });

      if (changed) {
        setRows(nextRows);
      }
    };

    void loadNodeInfo();
  }, [getQueryAPIOrNull, rows]);

  const toLabel = useCallback((session: BuildSessionRuntimeRecord): BuildSessionStatusView => {
    const isRunning = isRunningSession(session);
    const elapsedBase = isRunning
      ? session.startedAt ?? session.updatedAt ?? now
      : session.updatedAt ?? now;
    const elapsed = now - elapsedBase;

    if (isRunning) {
      const percentageText = `${Math.round(session.progress?.percentage ?? 0)}%`;
      return {
        mode: 'running',
        elapsedText: formatElapsed(elapsed),
        percentageText,
      };
    }

    return {
      mode: 'waiting',
      elapsedText: formatElapsed(elapsed),
    };
  }, [now]);

  const statusText = useCallback((session: BuildSessionRuntimeRecord, status: BuildSessionStatusView): string => {
    if (status.mode === 'running') {
      return `${t('buildSessionQueue.statusRunning', '実行中')} (${status.percentageText ?? '0%'}) / ${status.elapsedText}経過`;
    }

    if (session.status === 'failed') {
      return `${t('buildSessionQueue.statusFailed', '失敗')} ${status.elapsedText}経過`;
    }

    return `${t('buildSessionQueue.statusWaiting', '待機中')} ${status.elapsedText}経過`;
  }, [t]);

  const startTopSession = useCallback(async (nodeId: NodeId) => {
    if (autoStartingNodeRef.current === nodeId) {
      return;
    }

    autoStartingNodeRef.current = nodeId;
    try {
      const bridge = bridgeRef.current;
      await bridge.startBuildSession(nodeType, nodeId);
    } catch (error) {
      console.warn('[BuildSessionQueueList] failed to auto-start queued session', error);
    } finally {
      autoStartingNodeRef.current = null;
    }
  }, [nodeType]);

  useEffect(() => {
    const headSession = rows[0];
    if (!headSession) {
      queueStoppedRef.current = false;
      autoStartingNodeRef.current = null;
      return;
    }

    if (headSession.session.status === 'paused' || headSession.session.status === 'pausing' || headSession.session.status === 'failed') {
      queueStoppedRef.current = true;
      return;
    }

    if (isRunningSession(headSession.session)) {
      queueStoppedRef.current = false;
      return;
    }

    if (queueStoppedRef.current) {
      return;
    }

    void startTopSession(headSession.session.nodeId);
  }, [rows, startTopSession]);

  const handleNavigate = useCallback((row: QueueRow) => {
    if (!onNavigateToBuild) {
      return;
    }

    onNavigateToBuild({
      session: row.session,
      node: row.node,
      nodePath: row.nodePath,
    });
  }, [onNavigateToBuild]);

  const handleDeleteRequest = useCallback((row: QueueRow) => {
    setDeleteTarget(row);
    setIsDialogOpen(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setIsDialogOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      const bridge = bridgeRef.current;
      await bridge.deleteBuildSession(nodeType, deleteTarget.session.nodeId);
    } catch (error) {
      console.error('[BuildSessionQueueList] deleteBuildSession failed', error);
    } finally {
      setDeleteTarget(null);
      setIsDialogOpen(false);
      setIsDeleting(false);
    }
  }, [deleteTarget, nodeType]);

  const handleStartStoppedSession = useCallback((row: QueueRow, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nodeId = String(row.session.nodeId);

    setRows((current) => {
      const sourceIndex = current.findIndex((item) => String(item.session.nodeId) === nodeId);
      if (sourceIndex <= 0) {
        return current;
      }

      const next = [...current];
      const [moving] = next.splice(sourceIndex, 1);
      if (!moving) {
        return current;
      }
      next.unshift(moving);
      return normalizeWaitingFirst(next);
    });

    void startTopSession(row.session.nodeId);
  }, [startTopSession]);

  const handleDragEnd = useCallback(() => {
    setDraggingNodeId(null);
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLElement>, nodeId: NodeId) => {
    const row = rows.find((item) => String(item.session.nodeId) === String(nodeId));
    if (!row) {
      return;
    }
    const rowIndex = rows.findIndex((item) => String(item.session.nodeId) === String(nodeId));
    const isRunning = isRunningSession(row.session);
    if (isRunning || rowIndex === 0) {
      event.preventDefault();
      return;
    }
    setDraggingNodeId(nodeId);
    event.dataTransfer.effectAllowed = 'move';
  }, [rows]);

  const handleDragOver = useCallback((event: DragEvent, nodeId: NodeId) => {
    event.preventDefault();
    if (!draggingNodeId || draggingNodeId === nodeId) {
      return;
    }

    setRows((current) => {
      const sourceIndex = current.findIndex((row) => String(row.session.nodeId) === String(draggingNodeId));
      const targetIndex = current.findIndex((row) => String(row.session.nodeId) === String(nodeId));

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === 0 || targetIndex === 0) {
        return current;
      }
      const sourceRow = current[sourceIndex];
      const targetRow = current[targetIndex];
      if (!sourceRow || !targetRow) {
        return current;
      }
      if (isRunningSession(sourceRow.session) || isRunningSession(targetRow.session)) {
        return current;
      }

      const next = [...current];
      const [moving] = next.splice(sourceIndex, 1);
      if (!moving) {
        return current;
      }
      const safeTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(safeTargetIndex, 0, moving);
      return normalizeWaitingFirst(next);
    });
  }, [draggingNodeId]);

  const handleOpenAll = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleCloseAll = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const renderQueueRow = useCallback((row: QueueRow, index: number, options?: { compactSummary?: boolean }) => {
    const session = row.session;
    const label = toLabel(session);
    const stageIcon = resolveStageIcon(session.progress?.stage);
    const isRunning = label.mode === 'running';
    const isPaused = session.status === 'paused';
    const isStopped = isPaused || session.status === 'failed';
    const isActiveOrPaused = isRunning || isStopped;
    const statusLine = isPaused
      ? `${t('buildSessionQueue.statusPaused', '一時停止')} ${label.elapsedText}経過`
      : statusText(session, label);
    const nodeId = String(session.nodeId);
    const nodeName = row.node?.metadata?.name ?? nodeId;
    const nodePath = row.nodePath || nodeName;
    const isCompactSummary = options?.compactSummary ?? false;
    const canDrag = !isCompactSummary && index > 0 && !isRunning;

    return (
      <Tooltip key={nodeId} title={nodePath} arrow placement="right">
        <ListItem
          disablePadding
          onDragOver={isCompactSummary ? undefined : (event) => {
            handleDragOver(event, session.nodeId);
          }}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            width: '100%',
            minWidth: isCompactSummary ? 'auto' : 0,
            mb: 1,
            '&:hover .queue-action-icon': {
              opacity: isCompactSummary ? 0 : 1,
            },
          }}
        >
          <ListItemButton
            onClick={isCompactSummary ? undefined : () => handleNavigate(row)}
            sx={{
              py: 1,
              px: 1.5,
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
              <ListItemIcon>
                {!isCompactSummary ? (
                  <IconButton
                    size="small"
                    draggable={canDrag}
                    onDragStart={(event) => {
                      if (!canDrag) {
                        event.preventDefault();
                        return;
                      }
                      handleDragStart(event, session.nodeId);
                    }}
                    onDragEnd={handleDragEnd}
                    onMouseDown={(event) => event.stopPropagation()}
                    sx={{ cursor: canDrag ? 'grab' : 'default', color: canDrag ? 'text.secondary' : 'text.disabled' }}
                    aria-label={t('buildSessionQueue.dragHandle', 'Drag queue row')}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </ListItemIcon>
              <ListItemIcon>{resolveIcon({ nodeType: row.node?.nodeType ?? 'folder' })}</ListItemIcon>
              <ListItemText
                primary={nodeName}
                secondary={statusLine}
                sx={{ minWidth: 0 }}
              />
            </Stack>

              <Stack
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{
                  minWidth: isCompactSummary ? 220 : 280,
                  justifyContent: 'flex-end',
                  color: isActiveOrPaused ? 'text.primary' : 'text.secondary',
                }}
              >
                {isActiveOrPaused ? (
                  index === 0 ? (
                    isPaused ? (
                      <PauseCircleIcon fontSize="small" color="action" />
                    ) : (
                      <CircularProgress
                        size={16}
                        thickness={5}
                        sx={{ color: 'primary.main' }}
                      />
                    )
                  ) : (
                    <CircularProgress
                      size={16}
                      thickness={5}
                      sx={{ color: 'text.disabled' }}
                    />
                  )
                ) : null}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {isActiveOrPaused ? stageIcon : null}
                  {isActiveOrPaused && <Typography variant="body2">{label.percentageText ?? ''}</Typography>}
                </Stack>
                <Typography variant="body2" sx={{ minWidth: isCompactSummary ? 84 : 100, textAlign: 'right' }}>
                  {`${label.elapsedText}経過`}
                </Typography>
                {isCompactSummary ? <MoreVertIcon fontSize="small" /> : null}
              </Stack>
            </ListItemButton>
            {(!isCompactSummary && index === 0 && isRunning) ? (
              <Box sx={{ px: 1.5, pb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, Number(label.percentageText?.replace('%', '') ?? 0)))}
                />
              </Box>
            ) : null}
            {!isCompactSummary ? (
              <IconButton
                className="queue-action-icon queue-delete-icon"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteRequest(row);
                }}
                sx={{
                  opacity: 0,
                  transition: 'opacity 120ms ease',
                  color: 'error.main',
                  mr: 1,
                }}
                aria-label={t('buildSessionQueue.delete', 'Delete session')}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null}
            {!isCompactSummary && isStopped ? (
              <IconButton
                className="queue-action-icon queue-start-icon"
                size="small"
                onClick={(event) => handleStartStoppedSession(row, event)}
                sx={{
                  opacity: 0,
                  transition: 'opacity 120ms ease',
                  color: 'primary.main',
                  mr: 1,
                }}
                aria-label={t('buildSessionQueue.start', 'Start session')}
              >
                <span style={{ lineHeight: 1 }}>▶︎</span>
              </IconButton>
            ) : null}
          </ListItem>
        </Tooltip>
      );
    }, [handleDeleteRequest, handleDragEnd, handleDragStart, handleDragOver, handleNavigate, handleStartStoppedSession, statusText, t, toLabel]);

  const renderedRows = useMemo(() => rows.map((row, index) => renderQueueRow(row, index)), [rows, renderQueueRow]);
  const headRow = rows[0];

  const compactSummaryRow = useMemo(
    () => (headRow ? renderQueueRow(headRow, 0, { compactSummary: true }) : null),
    [headRow, renderQueueRow]
  );

  const queueList = rows.length === 0 ? (
    <Box sx={{ px: 1, py: 1, color: 'text.secondary' }}>
      {t('buildSessionQueue.empty', 'No running or queued build sessions found')}
    </Box>
  ) : (
    <List dense>
      {renderedRows}
    </List>
  );

  const queueDialog = (
    <Dialog
      open={isDialogOpen}
      onClose={handleCancelDelete}
      aria-labelledby="build-session-delete-dialog-title"
    >
      <DialogTitle id="build-session-delete-dialog-title">
        {t('buildSessionQueue.deleteTitle', 'Delete session from queue')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {deleteTarget
            ? t(
              'buildSessionQueue.deleteDescription',
              `Delete "${deleteTarget.node?.metadata?.name ?? String(deleteTarget.session.nodeId)}" from queue?`
            )
            : ''}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelDelete} disabled={isDeleting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleConfirmDelete}
          color="error"
          variant="contained"
          disabled={isDeleting}
        >
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (!compact) {
    return (
      <>
        {queueList}
        {queueDialog}
      </>
    );
  }

  if (compactMode === 'summary' && rows.length === 0) {
    return (
      <>
        {queueList}
        {queueDialog}
      </>
    );
  }

  const compactBody = compactMode === 'icon-badge' ? (
    <IconButton
      aria-label={t('buildSessionQueue.openQueueList', 'Open build session queue')}
      onClick={handleOpenAll}
      size="small"
      sx={{
        color: 'primary.main',
        p: '8px',
      }}
    >
      {rows.length === 0 ? (
        <ConstructionIcon fontSize="small" />
      ) : (
        <Badge badgeContent={rows.length} color="warning">
          <ConstructionIcon fontSize="small" />
        </Badge>
      )}
    </IconButton>
  ) : (
    <Box
      sx={{ minWidth: 320, display: 'inline-flex', cursor: 'pointer' }}
      onClick={handleOpenAll}
    >
      {compactSummaryRow}
    </Box>
  );

  return (
    <>
      <Tooltip
        title={compactMode === 'icon-badge'
          ? t('buildSessionQueue.openQueueList', 'Open build session queue')
          : t('buildSessionQueue.openQueueList', 'Open build session queue')}
        arrow
      >
        {compactBody}
      </Tooltip>
      <Popper open={Boolean(anchorEl)} anchorEl={anchorEl} placement="bottom-end" disablePortal={false}>
        <ClickAwayListener onClickAway={handleCloseAll}>
          <Paper
            sx={{
              mt: 1,
              minWidth: 520,
              p: 1,
              border: 1,
              borderColor: 'primary.main',
              boxShadow: 6,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('buildSessionQueue.popperTitle', 'Build session queue')}
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            {queueList}
          </Paper>
        </ClickAwayListener>
      </Popper>
      {queueDialog}
    </>
  );
}

export function CompactBuildSessionQueueList(
  props: Omit<BuildSessionQueueListProps, 'compact'>
) {
  return <BuildSessionQueueList {...props} compact />;
}

export function BuildSessionQueueBadgeButton(
  props: Omit<BuildSessionQueueListProps, 'compact' | 'compactMode'>
) {
  return <BuildSessionQueueList {...props} compact compactMode="icon-badge" />;
}

import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import { useIconRegistry } from '@hierarchidb/components';
import type { NodeType, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import ConstructionIcon from '@mui/icons-material/Construction';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  Badge,
  Box,
  Button,
  ClickAwayListener,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BuildJobQueue, BuildJobQueueEntry } from '~/router/pages/tree/console/buildJobQueue';
import {
  BUILD_JOB_QUEUE_OPEN_EVENT,
  deleteBuildJobQueueSessions,
  subscribeBuildJobQueues,
} from '~/router/pages/tree/console/buildJobQueue';
import { BuildSessionQueueSessionRow } from './BuildSessionQueueSessionRow';
import {
  type BuildSessionQueueEntry,
  useBuildSessionListQueue,
} from './hooks/useBuildSessionListQueue';

export type { BuildSessionQueueEntry } from './hooks/useBuildSessionListQueue';

type BuildSessionQueueCompactMode = 'summary' | 'icon-badge';

type BuildSessionQueuePanelProps = {
  treeId?: TreeId;
  nodeType?: NodeType;
  onNavigateToBuild?: (entry: BuildSessionQueueEntry) => void;
  onNavigateToBuildJobEntry?: (entry: BuildJobQueueEntry, queue: BuildJobQueue) => void;
  onEntriesChange?: (entries: BuildSessionQueueEntry[]) => void;
  compact?: boolean;
  compactMode?: BuildSessionQueueCompactMode;
  autoStartTopSession?: boolean;
};

const SESSION_TIMER_ACTIVE_STATUSES = new Set<BuildSessionRuntimeRecord['status']>([
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
]);

const isSessionTimerActive = (session: BuildSessionRuntimeRecord): boolean =>
  session.isActive && SESSION_TIMER_ACTIVE_STATUSES.has(session.status);

const formatTemplate = (text: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((next, [key, value]) => next.replaceAll(`{{${key}}}`, value), text);

const JOB_QUEUE_VISIBLE_STATUSES = new Set<BuildJobQueue['status']>([
  'pending',
  'running',
  'pausing',
  'paused',
  'failed',
]);

const getJobQueueEntryLabel = (entry: BuildJobQueueEntry): string =>
  `${entry.nodeType}: ${String(entry.targetNodeId)}`;

type BuildJobQueueSurfaceRowProps = {
  queue: BuildJobQueue;
  entry: BuildJobQueueEntry;
  onNavigate?: (entry: BuildJobQueueEntry, queue: BuildJobQueue) => void;
};

function BuildJobQueueSurfaceRow({ queue, entry, onNavigate }: BuildJobQueueSurfaceRowProps) {
  const { t } = useGlobalI18nTranslator();
  const canNavigate = Boolean(entry.displayUrl && onNavigate);
  const secondaryText = t('buildSessionQueue.jobEntryStatus', 'Job {{queueId}} · {{status}}', {
    queueId: queue.queueId,
    status: entry.status,
  });

  return (
    <ListItem
      disablePadding
      sx={{
        border: 1,
        borderColor: entry.status === 'failed' ? 'error.main' : 'divider',
        borderRadius: 1,
        width: '100%',
        mb: 1,
      }}
    >
      <ListItemButton
        onClick={canNavigate ? () => onNavigate?.(entry, queue) : undefined}
        disabled={!canNavigate}
        sx={{ py: 1, px: 1.5, width: '100%' }}
      >
        <ListItemIcon>
          <ConstructionIcon
            fontSize="small"
            color={entry.status === 'failed' ? 'error' : 'inherit'}
          />
        </ListItemIcon>
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {getJobQueueEntryLabel(entry)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                #{entry.order + 1}
              </Typography>
            </Stack>
          }
          secondary={secondaryText}
          slotProps={{
            primary: { component: 'div' },
            secondary: { component: 'span' },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export function BuildSessionQueuePanel({
  treeId,
  nodeType = toNodeType('shape'),
  onNavigateToBuild,
  onNavigateToBuildJobEntry,
  compact = false,
  compactMode = 'summary',
  onEntriesChange,
  autoStartTopSession = true,
}: BuildSessionQueuePanelProps) {
  const { resolveIcon } = useIconRegistry();
  const { t } = useGlobalI18nTranslator();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [jobQueues, setJobQueues] = useState<BuildJobQueue[]>([]);
  const [isDeletingJobQueues, setIsDeletingJobQueues] = useState(false);

  const {
    rows,
    isDeleting,
    isDialogOpen,
    anchorEl,
    deleteTarget,
    handleNavigate,
    handleDeleteRequest,
    handleCancelDelete,
    handleConfirmDelete,
    handleStartStoppedSession,
    handleDragEnd,
    handleDragStart,
    handleDragOver,
    handleOpenAll,
    handleCloseAll,
    handleDeleteAll,
    handleResumeFirstSession,
  } = useBuildSessionListQueue({
    nodeType,
    onNavigateToBuild,
    onEntriesChange,
    autoStartTopSession,
  });

  useEffect(() => subscribeBuildJobQueues(setJobQueues), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOpenBuildJobQueue = (event: Event) => {
      const detail = (event as CustomEvent<{ treeId?: TreeId }>).detail;
      if (treeId && detail?.treeId !== treeId) return;
      if (!buttonRef.current) return;
      handleOpenAll(buttonRef.current);
    };

    window.addEventListener(BUILD_JOB_QUEUE_OPEN_EVENT, handleOpenBuildJobQueue);
    return () => {
      window.removeEventListener(BUILD_JOB_QUEUE_OPEN_EVENT, handleOpenBuildJobQueue);
    };
  }, [handleOpenAll, treeId]);

  const visibleJobQueues = useMemo(
    () =>
      jobQueues.filter((queue) => {
        if (treeId && queue.treeId !== treeId) return false;
        return JOB_QUEUE_VISIBLE_STATUSES.has(queue.status);
      }),
    [jobQueues, treeId]
  );
  const jobQueueEntries = useMemo(
    () =>
      visibleJobQueues.flatMap((queue) =>
        [...queue.entries]
          .sort((left, right) => left.order - right.order)
          .map((entry) => ({ queue, entry }))
      ),
    [visibleJobQueues]
  );
  const totalQueueItems = rows.length + jobQueueEntries.length;

  const popperTitle = t('buildSessionQueue.popperTitle', 'Session queue');
  const popperCountText =
    totalQueueItems === 1
      ? t('buildSessionQueue.popperCountOne', '{{count}} item', { count: totalQueueItems })
      : t('buildSessionQueue.popperCountOther', '{{count}} items', { count: totalQueueItems });
  const isDeleteQueueActionDisabled = isDeleting || isDeletingJobQueues || totalQueueItems === 0;
  const isResumeQueueActionDisabled = isDeleting || isDeletingJobQueues || rows.length === 0;

  const handleConfirmDeleteAutoClose = useCallback(async () => {
    const shouldCloseQueuePanel = totalQueueItems <= 1;
    await handleConfirmDelete();
    if (shouldCloseQueuePanel) {
      handleCloseAll();
    }
  }, [handleConfirmDelete, handleCloseAll, totalQueueItems]);

  const handleDeleteAllQueues = useCallback(async () => {
    setIsDeletingJobQueues(true);
    try {
      await handleDeleteAll();
      if (visibleJobQueues.length > 0) {
        const bridge = getBuildWorkerBridge();
        await deleteBuildJobQueueSessions(
          visibleJobQueues.map((queue) => queue.queueId),
          {
            initialize: () => bridge.initialize(),
            deleteBuildSession: (entryNodeType, nodeId) =>
              bridge.deleteBuildSession(toNodeType(entryNodeType), nodeId),
          }
        );
      }
      handleCloseAll();
    } catch (error) {
      console.error('[BuildSessionQueuePanel] delete build job queues failed', error);
    } finally {
      setIsDeletingJobQueues(false);
    }
  }, [handleCloseAll, handleDeleteAll, visibleJobQueues]);

  useEffect(() => {
    if (totalQueueItems === 0 && anchorEl) {
      handleCloseAll();
    }
  }, [anchorEl, handleCloseAll, totalQueueItems]);

  const renderedRows = useMemo(
    () =>
      rows.map((row, index) => {
        const isRunning = isSessionTimerActive(row.session);

        return (
          <BuildSessionQueueSessionRow
            key={String(row.session.nodeId)}
            row={row}
            index={index}
            isRunning={isRunning}
            compactSummary={false}
            resolveIcon={resolveIcon}
            onNavigate={handleNavigate}
            onDeleteRequest={handleDeleteRequest}
            onStartStoppedSession={handleStartStoppedSession}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          />
        );
      }),
    [
      handleDeleteRequest,
      handleDragEnd,
      handleDragOver,
      handleDragStart,
      handleNavigate,
      handleStartStoppedSession,
      resolveIcon,
      rows,
    ]
  );

  const headRow = rows[0];
  const compactSummaryRow = useMemo(() => {
    if (!headRow) {
      return null;
    }

    const isRunning = isSessionTimerActive(headRow.session);

    return (
      <BuildSessionQueueSessionRow
        key={String(headRow.session.nodeId)}
        row={headRow}
        index={0}
        isRunning={isRunning}
        compactSummary
        resolveIcon={resolveIcon}
        onNavigate={handleNavigate}
        onDeleteRequest={handleDeleteRequest}
        onStartStoppedSession={handleStartStoppedSession}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      />
    );
  }, [
    handleDeleteRequest,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleNavigate,
    handleStartStoppedSession,
    headRow,
    resolveIcon,
  ]);

  const renderedJobRows = useMemo(
    () =>
      jobQueueEntries.map(({ queue, entry }) => (
        <BuildJobQueueSurfaceRow
          key={`${queue.queueId}:${entry.entryId}`}
          queue={queue}
          entry={entry}
          onNavigate={onNavigateToBuildJobEntry}
        />
      )),
    [jobQueueEntries, onNavigateToBuildJobEntry]
  );

  const queueList =
    totalQueueItems === 0 ? (
      <Box sx={{ px: 1, py: 1, color: 'text.secondary' }}>
        {t('buildSessionQueue.empty', 'No running or queued build sessions found')}
      </Box>
    ) : (
      <List dense>
        {renderedJobRows}
        {renderedRows}
      </List>
    );

  const queueDialog = (
    <Dialog
      open={isDialogOpen}
      onClose={handleCancelDelete}
      aria-labelledby="build-session-delete-dialog-title"
    >
      <DialogTitle id={'build-session-delete-dialog-title'}>
        {t('buildSessionQueue.deleteTitle', 'Delete session from queue')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {deleteTarget
            ? formatTemplate(
                t('buildSessionQueue.deleteDescription', 'Delete "{{nodeName}}" from queue?'),
                {
                  nodeName:
                    deleteTarget.node?.metadata?.name ?? String(deleteTarget.session.nodeId),
                }
              )
            : ''}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelDelete} disabled={isDeleting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleConfirmDeleteAutoClose}
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

  if (compactMode === 'summary' && totalQueueItems === 0) {
    return (
      <>
        {queueList}
        {queueDialog}
      </>
    );
  }

  const compactBody =
    compactMode === 'icon-badge' ? (
      <span>
        <IconButton
          ref={buttonRef}
          aria-label={t('buildSessionQueue.openQueueList', 'Open build session queue')}
          onClick={handleOpenAll}
          size="small"
          disabled={totalQueueItems === 0}
          sx={{
            color: 'primary.main',
            p: '8px',
            '&:disabled': {
              color: 'action.disabled',
            },
          }}
        >
          {totalQueueItems === 0 ? (
            <ConstructionIcon fontSize="small" />
          ) : (
            <Badge badgeContent={totalQueueItems} color="warning">
              <ConstructionIcon fontSize="small" />
            </Badge>
          )}
        </IconButton>
      </span>
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
        title={
          compactMode === 'icon-badge'
            ? t('buildSessionQueue.openQueueList', 'Open build session queue')
            : t('buildSessionQueue.openQueueList', 'Open build session queue')
        }
        arrow
      >
        {compactBody}
      </Tooltip>
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom-end"
        disablePortal={false}
        sx={(theme) => ({
          zIndex:
            (theme as { zIndex?: { modal?: number } }).zIndex?.modal !== undefined
              ? theme.zIndex.modal + 10
              : 1399,
        })}
      >
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
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {`${popperTitle}: ${popperCountText}`}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  onClick={handleDeleteAllQueues}
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  disabled={isDeleteQueueActionDisabled}
                >
                  {t('buildSessionQueue.deleteQueue', '削除')}
                </Button>
                <Button
                  onClick={handleResumeFirstSession}
                  size="small"
                  variant="contained"
                  startIcon={<ReplayIcon />}
                  disabled={isResumeQueueActionDisabled}
                >
                  {t('buildSessionQueue.resumeQueue', '再開')}
                </Button>
              </Box>
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

export function CompactBuildSessionQueuePanel(props: Omit<BuildSessionQueuePanelProps, 'compact'>) {
  return <BuildSessionQueuePanel {...props} compact />;
}

export function BuildSessionQueuePanelBadgeButton(
  props: Omit<BuildSessionQueuePanelProps, 'compact' | 'compactMode'>
) {
  return <BuildSessionQueuePanel {...props} compact compactMode="icon-badge" />;
}

import { useCallback, useMemo } from 'react';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
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
import type { NodeType } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { useBuildSessionListQueue, type BuildSessionQueueEntry } from './hooks/useBuildSessionListQueue';

export type { BuildSessionQueueEntry } from './hooks/useBuildSessionListQueue';

type BuildSessionStatusMode = 'running' | 'waiting';

type BuildSessionStatusView = {
  mode: BuildSessionStatusMode;
  elapsedText: string;
  percentageText?: string;
};

type BuildSessionQueueCompactMode = 'summary' | 'icon-badge';

type BuildSessionQueueListProps = {
  nodeType?: NodeType;
  onNavigateToBuild?: (entry: BuildSessionQueueEntry) => void;
  onEntriesChange?: (entries: BuildSessionQueueEntry[]) => void;
  compact?: boolean;
  compactMode?: BuildSessionQueueCompactMode;
  autoStartTopSession?: boolean;
};

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

export function BuildSessionQueueList({
  nodeType = toNodeType('shape'),
  onNavigateToBuild,
  compact = false,
  compactMode = 'summary',
  onEntriesChange,
  autoStartTopSession = true,
}: BuildSessionQueueListProps) {
  const { resolveIcon } = useIconRegistry();
  const { t } = useGlobalI18nTranslator();

  const {
    rows,
    now,
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
    isRunningSession,
  } = useBuildSessionListQueue({
    nodeType,
    onNavigateToBuild,
    onEntriesChange,
    autoStartTopSession,
  });

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
  }, [now, isRunningSession]);

  const statusText = useCallback((session: BuildSessionRuntimeRecord, status: BuildSessionStatusView): string => {
    if (status.mode === 'running') {
      return `${t('buildSessionQueue.statusRunning', '実行中')} (${status.percentageText ?? '0%'}) / ${status.elapsedText}経過`;
    }

    if (session.status === 'failed') {
      return `${t('buildSessionQueue.statusFailed', '失敗')} ${status.elapsedText}経過`;
    }

    return `${t('buildSessionQueue.statusWaiting', '待機中')} ${status.elapsedText}経過`;
  }, [t]);

  const renderQueueRow = useCallback((row: BuildSessionQueueEntry, index: number, options?: { compactSummary?: boolean }) => {
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
  }, [toLabel, t, statusText, handleDragEnd, resolveIcon, handleDragOver, handleNavigate, handleDragStart, handleDeleteRequest, handleStartStoppedSession]);

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
      <DialogTitle id={'build-session-delete-dialog-title'}>
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

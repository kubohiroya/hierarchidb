import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import { useIconRegistry } from '@hierarchidb/components';
import type { NodeType } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
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
  Paper,
  Popper,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo } from 'react';
import { BuildSessionQueueSessionRow } from './BuildSessionQueueSessionRow';
import {
  type BuildSessionQueueEntry,
  useBuildSessionListQueue,
} from './hooks/useBuildSessionListQueue';

export type { BuildSessionQueueEntry } from './hooks/useBuildSessionListQueue';

type BuildSessionQueueCompactMode = 'summary' | 'icon-badge';

type BuildSessionQueuePanelProps = {
  nodeType?: NodeType;
  onNavigateToBuild?: (entry: BuildSessionQueueEntry) => void;
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

export function BuildSessionQueuePanel({
  nodeType = toNodeType('shape'),
  onNavigateToBuild,
  compact = false,
  compactMode = 'summary',
  onEntriesChange,
  autoStartTopSession = true,
}: BuildSessionQueuePanelProps) {
  const { resolveIcon } = useIconRegistry();
  const { t } = useGlobalI18nTranslator();

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

  const popperTitle = t('buildSessionQueue.popperTitle', 'Session queue');
  const popperCountText =
    rows.length === 1
      ? t('buildSessionQueue.popperCountOne', '{{count}} item', { count: rows.length })
      : t('buildSessionQueue.popperCountOther', '{{count}} items', { count: rows.length });
  const isDialogQueueActionDisabled = isDeleting || rows.length === 0;

  const handleConfirmDeleteAutoClose = useCallback(async () => {
    const shouldCloseQueuePanel = rows.length <= 1;
    await handleConfirmDelete();
    if (shouldCloseQueuePanel) {
      handleCloseAll();
    }
  }, [handleConfirmDelete, handleCloseAll, rows.length]);

  useEffect(() => {
    if (rows.length === 0 && anchorEl) {
      handleCloseAll();
    }
  }, [anchorEl, handleCloseAll, rows.length]);

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

  const queueList =
    rows.length === 0 ? (
      <Box sx={{ px: 1, py: 1, color: 'text.secondary' }}>
        {t('buildSessionQueue.empty', 'No running or queued build sessions found')}
      </Box>
    ) : (
      <List dense>{renderedRows}</List>
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

  if (compactMode === 'summary' && rows.length === 0) {
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
          aria-label={t('buildSessionQueue.openQueueList', 'Open build session queue')}
          onClick={handleOpenAll}
          size="small"
          disabled={rows.length === 0}
          sx={{
            color: 'primary.main',
            p: '8px',
            '&:disabled': {
              color: 'action.disabled',
            },
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
                  onClick={handleDeleteAll}
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  disabled={isDialogQueueActionDisabled}
                >
                  {t('buildSessionQueue.deleteQueue', '削除')}
                </Button>
                <Button
                  onClick={handleResumeFirstSession}
                  size="small"
                  variant="contained"
                  startIcon={<ReplayIcon />}
                  disabled={isDialogQueueActionDisabled}
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

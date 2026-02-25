import { memo, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LayersIcon from '@mui/icons-material/Layers';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import TuneIcon from '@mui/icons-material/Tune';
import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import type { NodeId } from '@hierarchidb/core-types';
import type { DragEvent, MouseEvent } from 'react';
import type { BuildSessionQueueEntry } from './hooks/useBuildSessionListQueue';
import type { IconRegistryValue } from '@hierarchidb/ui-icon';

type BuildSessionQueueSessionRowProps = {
  row: BuildSessionQueueEntry;
  index: number;
  compactSummary?: boolean;
  resolveIcon: IconRegistryValue['resolveIcon'];
  isRunning: boolean;
  onNavigate: (row: BuildSessionQueueEntry) => void;
  onDeleteRequest: (row: BuildSessionQueueEntry) => void;
  onStartStoppedSession: (row: BuildSessionQueueEntry, event: MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>, nodeId: NodeId) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent, nodeId: NodeId) => void;
};

type BuildSessionStatusMode = 'running' | 'waiting';

type BuildSessionStatusView = {
  mode: BuildSessionStatusMode;
  elapsedText: string;
  percentageText?: string;
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

const formatTemplate = (text: string, values: Record<string, string>): string => (
  Object.entries(values).reduce((next, [key, value]) => next.replaceAll(`{{${key}}}`, value), text)
);

const getTotalElapsedText = (
  t: (key: string, fallback: string) => string,
  elapsedText: string,
): string => {
  return formatTemplate(t('buildSessionQueue.totalElapsed', '(総経過時間 {{elapsed}})'), {
    elapsed: elapsedText,
  });
};

const resolveStatusText = (
  t: (key: string, fallback: string) => string,
  session: BuildSessionRuntimeRecord,
  status: BuildSessionStatusView,
): string => {
  if (status.mode === 'running') {
    return t('buildSessionQueue.statusRunning', '実行中');
  }

  if (session.status === 'failed') {
    return t('buildSessionQueue.statusFailed', '失敗');
  }

  if (session.status === 'completed') {
    return t('buildSessionQueue.statusCompleted', '完了');
  }

  return t('buildSessionQueue.statusWaiting', '待機中');
};

const resolveStatusCaptionText = (
  t: (key: string, fallback: string) => string,
  session: BuildSessionRuntimeRecord,
  isRunning: boolean,
): string => {
  if (isRunning) {
    return t('buildSessionQueue.statusRunning', 'Running');
  }

  if (session.status === 'failed') {
    return t('buildSessionQueue.statusFailedCaption', 'Failed');
  }

  if (session.status === 'completed') {
    return t('buildSessionQueue.statusCompletedCaption', 'Completed');
  }

  if (session.status === 'paused') {
    return t('buildSessionQueue.statusPaused', 'Paused');
  }

  if (session.status === 'running') {
    return t('buildSessionQueue.statusRunning', 'Running');
  }

  return t('buildSessionQueue.statusWaitingCaption', 'Waiting');
};

const BuildSessionQueueSessionRowInner = ({
  row,
  index,
  compactSummary = false,
  resolveIcon,
  isRunning,
  onNavigate,
  onDeleteRequest,
  onStartStoppedSession,
  onDragStart,
  onDragEnd,
  onDragOver,
}: BuildSessionQueueSessionRowProps) => {
  const { t } = useGlobalI18nTranslator();
  const [runningNow, setRunningNow] = useState<number>(() => Date.now());
  const { session, node } = row;
  const isTerminalStatus = session.status === 'completed' || session.status === 'failed';
  const isActiveRuntimeStatus = session.status === 'starting' || session.status === 'running'
    || session.status === 'resuming' || session.status === 'finalizing';
  const inactiveMs = session.inactiveMs ?? 0;
  const startedAt = session.startedAt ?? session.updatedAt ?? runningNow;
  const baseEndAt = isActiveRuntimeStatus
    ? runningNow
    : session.status === 'paused'
      ? session.lastHeartbeatAt ?? session.updatedAt ?? runningNow
      : isTerminalStatus
        ? session.completedAt ?? session.updatedAt ?? runningNow
        : session.updatedAt ?? startedAt;
  const elapsed = formatElapsed(Math.max(0, baseEndAt - startedAt - inactiveMs));
  const isPaused = session.status === 'paused';
  const isFailed = session.status === 'failed';
  const isCompleted = session.status === 'completed';
  const canRestart = isPaused || isFailed || isCompleted;
  const stageIcon = resolveStageIcon(session.progress?.stage);
  const percentageText = isRunning ? `${Math.round(session.progress?.percentage ?? 0)}%` : undefined;
  const statusLine = isRunning
    ? resolveStatusText(t, session, {
      mode: 'running',
      elapsedText: elapsed,
      percentageText,
    })
    : '';
  const statusCaption = resolveStatusCaptionText(t, session, isRunning);
  const status: BuildSessionStatusView = {
    mode: isRunning ? 'running' : 'waiting',
    elapsedText: elapsed,
    percentageText,
  };
  const canDrag = !compactSummary && index > 0 && !isRunning;
  const nodeId = String(session.nodeId);
  const nodeName = node?.metadata?.name ?? nodeId;
  const nodePath = row.nodePath || nodeName;

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    setRunningNow(Date.now());
    const timer = setInterval(() => {
      setRunningNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isRunning, session.nodeId]);

  return (
    <Tooltip title={nodePath} arrow placement="right">
      <ListItem
        disablePadding
        onDragOver={compactSummary ? undefined : (event) => {
          onDragOver(event, session.nodeId);
        }}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          width: '100%',
          minWidth: compactSummary ? 'auto' : 0,
          mb: 1,
          '&:hover .queue-action-icon': {
            opacity: compactSummary ? 0 : 1,
          },
        }}
      >
        <ListItemButton
          onClick={compactSummary ? undefined : () => onNavigate(row)}
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
              {!compactSummary ? (
                <IconButton
                  size="small"
                  draggable={canDrag}
                  onDragStart={(event) => {
                    if (!canDrag) {
                      event.preventDefault();
                      return;
                    }
                    onDragStart(event, session.nodeId);
                  }}
                  onDragEnd={onDragEnd}
                  onMouseDown={(event) => event.stopPropagation()}
                  sx={{ cursor: canDrag ? 'grab' : 'default', color: canDrag ? 'text.secondary' : 'text.disabled' }}
                  aria-label={t('buildSessionQueue.dragHandle', 'Drag queue row')}
                >
                  <DragIndicatorIcon fontSize="small" />
                </IconButton>
              ) : null}
            </ListItemIcon>
            <ListItemIcon>{resolveIcon({ nodeType: node?.nodeType ?? 'folder' })}</ListItemIcon>
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
              minWidth: compactSummary ? 220 : 280,
              justifyContent: 'flex-end',
              color: isRunning ? 'text.primary' : canRestart ? 'text.secondary' : 'text.secondary',
            }}
          >
            {isRunning ? (
              <CircularProgress size={16} thickness={5} sx={{ color: 'primary.main' }} />
            ) : isPaused ? (
              <PauseCircleIcon fontSize="small" color="action" />
            ) : isFailed ? (
              <ErrorOutlineIcon fontSize="small" color="error" />
            ) : isCompleted ? (
              <CheckCircleOutlineIcon fontSize="small" color="success" />
            ) : null}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {isRunning ? stageIcon : null}
              <Typography variant="body2">{statusCaption}</Typography>
              {isRunning ? <Typography variant="body2">{status.percentageText ?? ''}</Typography> : null}
            </Stack>
            <Typography variant="body2" sx={{ minWidth: compactSummary ? 84 : 100, textAlign: 'right' }}>
              {getTotalElapsedText(t, status.elapsedText)}
            </Typography>
            {compactSummary ? <MoreVertIcon fontSize="small" /> : null}
          </Stack>
        </ListItemButton>
        {(!compactSummary && isRunning) ? (
          <Box sx={{ px: 1.5, pb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, Number.parseFloat(status.percentageText ?? '0')))}
            />
          </Box>
        ) : null}
        {!compactSummary ? (
          <Tooltip title={t('buildSessionQueue.removeFromQueue', 'このセッションをキューから削除')}>
            <IconButton
              className="queue-action-icon queue-delete-icon"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteRequest(row);
              }}
              sx={{
                opacity: 0,
                transition: 'opacity 120ms ease',
                color: 'error.main',
                mr: 1,
              }}
              aria-label={t('buildSessionQueue.removeFromQueue', 'このセッションをキューから削除')}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        {!compactSummary && canRestart ? (
          <Tooltip
            title={index === 0
              ? t('buildSessionQueue.resumeSession', 'このセッションの実行を再開')
              : t('buildSessionQueue.prioritizeSession', 'このセッションを優先して実行')}
          >
            <IconButton
              className="queue-action-icon queue-start-icon"
              size="small"
              onClick={(event) => onStartStoppedSession(row, event)}
              sx={{
                opacity: 0,
                transition: 'opacity 120ms ease',
                color: 'primary.main',
                mr: 1,
              }}
              aria-label={index === 0
                ? t('buildSessionQueue.resumeSession', 'このセッションの実行を再開')
                : t('buildSessionQueue.prioritizeSession', 'このセッションを優先して実行')}
            >
              {index === 0 ? <ReplayIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
      </ListItem>
    </Tooltip>
  );
};

export const BuildSessionQueueSessionRow = memo(BuildSessionQueueSessionRowInner);

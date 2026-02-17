import { useMemo } from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { toNodeId } from '@hierarchidb/core-types';
import { useRouteBuildProgress } from '../hooks/useRouteBatchProgress.js';
import { useTranslation } from '../../common/i18n/index.js';

export function RouteBatchLiveProgress({ jobId }: { jobId: string }) {
  const {
    progress,
    status,
    isPaused,
    isMutating,
    mutationError,
    pause,
    resume,
  } = useRouteBuildProgress(toNodeId(jobId));
  const { translations } = useTranslation();

  const pct = useMemo(() => {
    const value = progress?.percentage ?? 0;
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [progress?.percentage]);

  const phaseKey = progress?.phase ?? status?.status ?? (isPaused ? 'paused' : 'running');
  const stageKey = progress?.stage ?? '';
  const stages = translations.batch?.stages as Record<string, string> | undefined;
  const phases = translations.batch?.phases as Record<string, string> | undefined;
  const phaseLabel = phaseKey ? phases?.[phaseKey] ?? phaseKey : 'running';
  const stageLabel = stageKey && stages?.[stageKey]
    ? stages[stageKey]
    : stageKey || phaseLabel || 'running';
  const buttonLabel = isPaused
    ? translations.batch?.resume ?? 'Resume'
    : translations.batch?.pause ?? 'Pause';
  const tooltipLabel = isPaused
    ? translations.batch?.resumeTooltip ?? buttonLabel
    : translations.batch?.pauseTooltip ?? buttonLabel;
  const Icon = isPaused ? PlayArrowIcon : PauseIcon;
  const handleClick = isPaused ? resume : pause;
  const barColor = isPaused ? '#757575' : '#1976d2';

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: barColor,
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{pct}%</span>
        <span style={{ fontSize: 12, color: '#555' }}>{stageLabel}</span>
        <Tooltip title={tooltipLabel} placement="top">
          <span>
            <Button
              size="small"
              variant="outlined"
              onClick={handleClick}
              disabled={isMutating || (!progress && !status)}
              startIcon={isMutating ? <CircularProgress size={16} /> : <Icon fontSize="small" />}
            >
              {buttonLabel}
            </Button>
          </span>
        </Tooltip>
      </div>
      {mutationError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d32f2f', fontSize: 12 }}>
          <ErrorOutlineIcon fontSize="small" />
          <span>{mutationError}</span>
        </div>
      )}
    </div>
  );
}

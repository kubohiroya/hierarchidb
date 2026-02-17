import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { LoadingButton } from './LoadingButton.js';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import type { BuildControlDetail } from './BuildStepPanel.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

type BuildControlCardProps = {
  status: BuildStatus;
  onPause?: () => void;
  onResume?: () => void;
  controlLabel?: string;
  pauseLabel?: string;
  pauseLoading?: boolean;
  pausePending?: boolean;
  pauseActsAsCancel?: boolean;
  startPending?: boolean;
  startLabel?: string;
  resumeLabel?: string;
  showResumeLabel?: boolean;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
  details?: BuildControlDetail[];
  rightContent?: ReactNode;
};

export const BuildControlCard: React.FC<BuildControlCardProps> = ({
  status,
  onPause,
  onResume,
  controlLabel,
  pauseLabel,
  pauseLoading,
  pausePending,
  pauseActsAsCancel,
  startPending,
  startLabel,
  resumeLabel,
  showResumeLabel,
  startIcon,
  resumeIcon,
  details,
  rightContent,
}) => {
  const pauseSpinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const computedPauseIcon = pauseLoading ? pauseSpinner : <PauseIcon fontSize="small" />;
  const shouldShowResume = Boolean(showResumeLabel) || status === 'paused';
  const computedLabel = shouldShowResume
    ? (resumeLabel ?? 'Resume Build')
    : (startLabel ?? 'Start Build');
  const computedIcon = shouldShowResume
    ? (resumeIcon ?? <PlayArrowIcon fontSize="small" />)
    : (startIcon ?? <PlayArrowIcon fontSize="small" />);
  const cancelMode = Boolean(pauseActsAsCancel);
  const disablePause = cancelMode
    ? (!onPause || pauseLoading || pausePending)
    : (status !== 'running' || !onPause || pauseLoading || pausePending || startPending);
  const disableStart = !onResume || status === 'running' || pausePending || startPending;
  const isLoading = (status === 'running' || Boolean(startPending)) && !pausePending;

  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        width: 'auto',
        p: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'nowrap',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {controlLabel ?? 'Build Controls'}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
        <Button
          variant="outlined"
          size="small"
          endIcon={computedPauseIcon}
          disabled={disablePause}
          onClick={onPause}
          data-testid="build-control-pause-button"
          aria-label={pauseLabel ?? 'Pause'}
        >
          {pauseLabel ?? 'Pause'}
        </Button>
        <LoadingButton
          color="secondary"
          variant="contained"
          size="small"
          endIcon={computedIcon}
          disabled={disableStart}
          onClick={onResume}
          loading={isLoading}
          data-testid="build-control-start-resume-button"
          aria-label={computedLabel}
        >
          {computedLabel}
        </LoadingButton>
      </Stack>
      {details && details.length > 0 ? (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
          {details.map((detail, index) => (
            <Box key={`detail-${index.toString()}`} display="flex" alignItems="center" gap={0.5}>
              <Box display="flex" alignItems="center" gap={0.25}>
                {detail.icon === 'timelapse' ? (
                  <TimelapseIcon
                    sx={{ fontSize: 14, color: 'text.secondary' }}
                    titleAccess={typeof detail.label === 'string' ? detail.label : undefined}
                  />
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {detail.label}
                </Typography>
              </Box>
              <Typography variant="caption">
                {detail.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
      {rightContent ? (
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          {rightContent}
        </Box>
      ) : null}
    </Box>
  );
};

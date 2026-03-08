import { Box, Button, ButtonGroup, CircularProgress, Stack, Typography, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { type ReactNode, useState, useEffect } from 'react';
import { LoadingButton } from './LoadingButton.js';
import ClearIcon from '@mui/icons-material/Clear';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { BuildControlDetail } from './BuildStepPanel.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

type BuildControlCardProps = {
  status: BuildStatus;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  pauseLabel?: string;
  cancelLabel?: string;
  stopRequested?: boolean;
  startPending?: boolean;
  startLabel?: string;
  resumeLabel?: string;
  showResumeLabel?: boolean;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
  details?: BuildControlDetail[];
  startLoading?: boolean;
  resetDeleteMenuItems?: Array<{ 
    id: string; 
    label: string; 
    onClick: () => void; 
    disabled?: boolean; 
    icon?: ReactNode 
  }>;
  resetDeleteMenuAriaLabel?: string;
  resetDeleteMenuDisabled?: boolean;
};

export const BuildControlCard: React.FC<BuildControlCardProps> = ({
  status,
  onPause,
  onResume,
  onCancel,
  pauseLabel,
  cancelLabel,
  stopRequested,
  startPending,
  startLabel,
  resumeLabel,
  showResumeLabel,
  startIcon,
  resumeIcon,
  details,
  startLoading,
  resetDeleteMenuItems,
  resetDeleteMenuAriaLabel,
  resetDeleteMenuDisabled,
}) => {
  const [resetDeleteMenuAnchorEl, setResetDeleteMenuAnchorEl] = useState<HTMLElement | null>(null);

  const pauseSpinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const computedPauseIcon = stopRequested ? pauseSpinner : <PauseIcon fontSize="small" />;
  const computedCancelIcon = <ClearIcon fontSize="small" />;
  const shouldShowResume = Boolean(showResumeLabel) || status === 'paused';
  const computedLabel = shouldShowResume
    ? (resumeLabel ?? 'Resume Build')
    : (startLabel ?? 'Start Build');
  const computedIcon = shouldShowResume
    ? (resumeIcon ?? <PlayArrowIcon fontSize="small" />)
    : (startIcon ?? <PlayArrowIcon fontSize="small" />);
  const isRunning = status === 'running';
  const isQueued = Boolean(startPending) && !isRunning;
  const hasLoading = startLoading ?? (isRunning || isQueued);
  const disableStart = !onResume || hasLoading || stopRequested;
  const disablePause = !onPause || !isRunning || stopRequested;
  const disableCancel = !onCancel || !isQueued || stopRequested;
  const isLoading = hasLoading && !stopRequested;

  // Reset/Delete menu handlers
  const hasResetDeleteMenuItems = (resetDeleteMenuItems?.length ?? 0) > 0;
  const resetDeleteMenuOpen = Boolean(resetDeleteMenuAnchorEl);
  const resetDeleteMenuDisabledState = Boolean(resetDeleteMenuDisabled)
    || Boolean(startPending)
    || Boolean(startLoading)
    || !hasResetDeleteMenuItems;

  const handleResetDeleteMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setResetDeleteMenuAnchorEl(event.currentTarget);
  };

  const handleResetDeleteMenuClose = () => {
    setResetDeleteMenuAnchorEl(null);
  };

  useEffect(() => {
    if (resetDeleteMenuDisabledState && resetDeleteMenuAnchorEl) {
      setResetDeleteMenuAnchorEl(null);
    }
  }, [resetDeleteMenuAnchorEl, resetDeleteMenuDisabledState]);

  const handleResetDeleteMenuItemClick = (item: { id: string; label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }) => {
    item.onClick();
    handleResetDeleteMenuClose();
  };

  // Show Cancel button when session is running, Reset/Delete menu when stopped
  const showCancelButton = isRunning || isQueued;
  const showResetDeleteMenu = !showCancelButton && hasResetDeleteMenuItems;

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
        outline: '1px solid',
        outlineColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'nowrap',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
        <ButtonGroup variant="contained" size="small" aria-label="Build control buttons">
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
            id="build-control-start-button"
            role="button"
          >
            {computedLabel}
          </LoadingButton>
          <Button
            color="secondary"
            variant="contained"
            size="small"
            endIcon={computedPauseIcon}
            disabled={disablePause}
            onClick={onPause}
            data-testid="build-control-pause-button"
            aria-label={pauseLabel ?? 'Pause'}
            id="build-control-pause-button"
            role="button"
          >
            {pauseLabel ?? 'Pause'}
          </Button>
        </ButtonGroup>
        
        {showCancelButton && (
          <Button
            variant="outlined"
            size="small"
            endIcon={computedCancelIcon}
            disabled={disableCancel}
            onClick={onCancel}
            data-testid="build-control-cancel-button"
            aria-label={cancelLabel ?? 'Cancel'}
            id="build-control-cancel-button"
            role="button"
          >
            {cancelLabel ?? 'Cancel'}
          </Button>
        )}

        {showResetDeleteMenu && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RestartAltIcon fontSize="small" />}
              endIcon={<ExpandMoreIcon fontSize="small" />}
              disabled={resetDeleteMenuDisabledState}
              onClick={handleResetDeleteMenuOpen}
              data-testid="build-control-reset-delete-button"
              aria-label={resetDeleteMenuAriaLabel ?? 'Reset/Delete menu'}
              aria-expanded={resetDeleteMenuOpen}
              aria-haspopup="true"
            >
              Reset ▼
            </Button>
            <Menu
              anchorEl={resetDeleteMenuAnchorEl}
              open={resetDeleteMenuOpen}
              onClose={handleResetDeleteMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              MenuListProps={{
                'aria-labelledby': 'build-control-reset-delete-button',
              }}
            >
              {resetDeleteMenuItems?.map((item) => 
                item.label === '---' ? (
                  <Divider key={item.id} />
                ) : (
                  <MenuItem
                    key={item.id}
                    onClick={() => handleResetDeleteMenuItemClick(item)}
                    disabled={item.disabled}
                  >
                    {item.icon && (
                      <ListItemIcon>
                        {item.icon}
                      </ListItemIcon>
                    )}
                    <ListItemText>{item.label}</ListItemText>
                  </MenuItem>
                )
              )}
            </Menu>
          </>
        )}
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
    </Box>
  );
};
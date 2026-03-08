import { Box, Button, CircularProgress, Stack, Typography, IconButton, MenuItem } from '@mui/material';
import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { DialogSafeMenu } from '@hierarchidb/ui-dialog';
import { LoadingButton } from './LoadingButton.js';
import ClearIcon from '@mui/icons-material/Clear';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { BuildControlDetail } from './BuildStepPanel.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

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

  // Reset/Delete menu state management
  const hasResetDeleteMenuItems = (resetDeleteMenuItems?.length ?? 0) > 0;
  const resetDeleteMenuOpen = Boolean(resetDeleteMenuAnchorEl);
  const resetDeleteMenuDisabledState = Boolean(resetDeleteMenuDisabled) || Boolean(startPending) || Boolean(startLoading) || !hasResetDeleteMenuItems;

  const handleResetDeleteMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setResetDeleteMenuAnchorEl(event.currentTarget);
  }, []);

  const handleResetDeleteMenuClose = useCallback(() => {
    setResetDeleteMenuAnchorEl(null);
  }, []);

  const handleResetDeleteMenuItemClick = useCallback((item: { id: string; label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }) => {
    if (!item.disabled && item.id !== 'divider-1' && item.id !== 'divider-2' && item.id !== 'divider-3' && item.id !== 'divider-4') {
      item.onClick();
    }
    handleResetDeleteMenuClose();
  }, [handleResetDeleteMenuClose]);

  useEffect(() => {
    if (resetDeleteMenuDisabledState && resetDeleteMenuAnchorEl) {
      setResetDeleteMenuAnchorEl(null);
    }
  }, [resetDeleteMenuAnchorEl, resetDeleteMenuDisabledState]);

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
          variant="outlined"
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
        {isRunning ? (
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
        ) : hasResetDeleteMenuItems ? (
          <>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowDropDownIcon fontSize="small" />}
              disabled={resetDeleteMenuDisabledState}
              onClick={handleResetDeleteMenuOpen}
              data-testid="build-control-reset-delete-button"
              aria-label={resetDeleteMenuAriaLabel ?? 'Reset/Delete menu'}
              id="build-control-reset-delete-button"
              role="button"
            >
              Reset/Delete
            </Button>
            <DialogSafeMenu
              anchorEl={resetDeleteMenuAnchorEl}
              open={resetDeleteMenuOpen}
              onClose={handleResetDeleteMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {resetDeleteMenuItems?.map((item) => {
                if (item.label === '---') {
                  return <MenuItem key={item.id} disabled sx={{ height: 1, minHeight: 1, p: 0 }} />;
                }
                return (
                  <MenuItem
                    key={item.id}
                    onClick={() => handleResetDeleteMenuItemClick(item)}
                    disabled={item.disabled}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    {item.icon}
                    {item.label}
                  </MenuItem>
                );
              })}
            </DialogSafeMenu>
          </>
        ) : null}
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

}

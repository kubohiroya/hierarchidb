import { Box, Button, CircularProgress, Stack, Typography, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { DialogSafeMenu } from '@hierarchidb/ui-dialog';
import { LoadingButton, PillButton, PillButtonGroup } from '@hierarchidb/components';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { BuildControlDetail } from './BuildStepPanel.js';
import type { BuildStatus } from '../types/BuildStatus.js';

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
  onCancel: _onCancel,
  pauseLabel,
  cancelLabel: _cancelLabel,
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
  const { t } = useTranslation('common');
  const [resetDeleteMenuAnchorEl, setResetDeleteMenuAnchorEl] = useState<HTMLElement | null>(null);

  const pauseSpinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const computedPauseIcon = stopRequested ? pauseSpinner : <PauseIcon fontSize="small" />;
  const shouldShowResume = Boolean(showResumeLabel) || status === 'paused';
  const computedLabel = shouldShowResume
    ? (resumeLabel ?? t('buildControl.buttons.resumeBuild') as string)
    : (startLabel ?? t('buildControl.buttons.startBuild') as string);
  const computedIcon = shouldShowResume
    ? (resumeIcon ?? <PlayArrowIcon fontSize="small" />)
    : (startIcon ?? <PlayArrowIcon fontSize="small" />);
  const isRunning = status === 'running';
  const isQueued = Boolean(startPending) && !isRunning;
  const hasLoading = startLoading ?? (isRunning || isQueued);
  const disableStart = !onResume || hasLoading || stopRequested;
  const disablePause = !onPause || !isRunning || stopRequested;
  const isLoading = hasLoading && !stopRequested;

  // Reset/Delete menu handlers
  const hasResetDeleteMenuItems = (resetDeleteMenuItems?.length ?? 0) > 0;
  const resetDeleteMenuOpen = Boolean(resetDeleteMenuAnchorEl);
  const resetDeleteMenuDisabledState = Boolean(resetDeleteMenuDisabled)
    || Boolean(startPending)
    || Boolean(startLoading)
    || isRunning
    || !hasResetDeleteMenuItems;

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

  // Always show Reset/Delete menu when items are available
  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        width: 'auto',
        p: 1,
        borderRadius: '9999px',
        border: '1px solid',
        borderColor: 'divider',
        outline: 'none',
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'nowrap',
        pl: '8px',
        pr: '8px',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
        <PillButtonGroup
          variant="contained"
          size="large"
          disableElevation
          aria-label="Build control buttons"
        >
          <LoadingButton
            color="secondary"
            variant="contained"
            size="large"
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
            size="large"
            endIcon={computedPauseIcon}
            disabled={disablePause}
            onClick={onPause}
            data-testid="build-control-pause-button"
            aria-label={pauseLabel ?? t('buildControl.buttons.pause') as string}
            id="build-control-pause-button"
            role="button"
          >
            {pauseLabel ?? t('buildControl.buttons.pause') as string}
          </Button>
        </PillButtonGroup>
        
        {hasResetDeleteMenuItems && (
          <>
            <PillButton
              variant="outlined"
              size="small"
              startIcon={<RestartAltIcon fontSize="small" />}
              endIcon={<ExpandMoreIcon fontSize="small" />}
              disabled={resetDeleteMenuDisabledState}
              onClick={handleResetDeleteMenuOpen}
              data-testid="build-control-reset-delete-button"
              aria-label={resetDeleteMenuAriaLabel ?? t('buildControl.buttons.resetDeleteMenu') as string}
              aria-expanded={resetDeleteMenuOpen}
              aria-haspopup="true"
            >
              {t('buildControl.buttons.resetDelete') as string}
            </PillButton>
            <DialogSafeMenu
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
            </DialogSafeMenu>
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
              <Typography variant="caption" sx={{ minWidth: '10ch', display: 'inline-block' }}>
                {detail.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
};

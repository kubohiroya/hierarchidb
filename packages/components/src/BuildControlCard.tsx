import { Box, Button, CircularProgress, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material';
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { LoadingButton } from './LoadingButton.js';
import ClearIcon from '@mui/icons-material/Clear';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import type { BuildControlDetail } from './BuildStepPanel.tsx';
import type { BuildControlMenuItem } from './BuildStepPanel.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

export type { BuildControlMenuItem };
type BuildControlCardProps = {
  status: BuildStatus;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  controlLabel?: string;
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
  rightContent?: ReactNode;
  controlMenuItems?: BuildControlMenuItem[];
  controlMenuAriaLabel?: string;
  controlMenuDisabled?: boolean;
  startLoading?: boolean;
};

export const BuildControlCard: React.FC<BuildControlCardProps> = ({
  status,
  onPause,
  onResume,
  onCancel,
  controlLabel,
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
  rightContent,
  controlMenuItems,
  controlMenuAriaLabel,
  controlMenuDisabled,
  startLoading,
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
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
  const hasControlMenuItems = (controlMenuItems?.length ?? 0) > 0;
  const isMenuOpen = Boolean(menuAnchorEl);
  const menuDisabled = stopRequested || hasControlMenuItems === false || Boolean(controlMenuDisabled);
  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  const blurActiveElement = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }, []);
  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
    blurActiveElement();
  }, [blurActiveElement]);

  useEffect(() => {
    if (menuDisabled && menuAnchorEl) {
      handleMenuClose();
    }
  }, [menuAnchorEl, menuDisabled, handleMenuClose]);
  const handleMenuItemClick = (item: BuildControlMenuItem) => {
    item.onClick();
    handleMenuClose();
  };

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
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {controlLabel ?? 'Build Controls'}
      </Typography>
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
        >
          {pauseLabel ?? 'Pause'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          endIcon={computedCancelIcon}
          disabled={disableCancel}
          onClick={onCancel}
          data-testid="build-control-cancel-button"
          aria-label={cancelLabel ?? 'Cancel'}
        >
          {cancelLabel ?? 'Cancel'}
        </Button>
        {hasControlMenuItems ? (
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            disabled={menuDisabled}
            aria-label={controlMenuAriaLabel ?? 'Build control menu'}
            data-testid="build-control-menu-button"
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              bgcolor: 'transparent',
              '&:hover': { borderColor: 'text.secondary' },
            }}
          >
            <ArrowDropDownIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Menu
          anchorEl={menuAnchorEl}
          open={isMenuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {controlMenuItems?.map((item) => (
            <MenuItem
              key={item.id}
              onClick={() => handleMenuItemClick(item)}
              disabled={item.disabled}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
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

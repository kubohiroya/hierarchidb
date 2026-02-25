import { type FC, memo, type ReactNode, useState, type MouseEvent } from 'react';
import { Box, Chip, CircularProgress, IconButton, LinearProgress, Menu, MenuItem, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export type BuildStepStageMenuItem = {
  id: string;
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export type BuildStepStageTaskCount = {
  Completed: number;
  Failed: number;
  Skip: number;
  Total?: number;
};

export type BuildStepStageSummaryPanelProps = {
  title: string;
  icon: ReactNode;
  description?: string;
  progress: number;
  progressContent?: ReactNode;
  headerMeta?: ReactNode;
  chipPlacement?: 'header' | 'belowProgress';
  taskCount?: BuildStepStageTaskCount;
  concurrencyIndicator?: {
    count: number;
    isRunning: boolean;
  };
  onConcurrencyIndicatorClick?: (event: MouseEvent<HTMLElement>) => void;
  concurrencyIndicatorAriaLabel?: string;
  leadingControl?: ReactNode;
  menuItems?: BuildStepStageMenuItem[];
  menuDisabled?: boolean;
  menuAriaLabel?: string;
  failedMode: boolean;
  onFailedModeUpdate: (newMode: boolean) => void;
  completedMode: boolean;
  onCompletedModeUpdate: (newMode: boolean) => void;
  skippedMode: boolean;
  onSkippedModeUpdate: (newMode: boolean) => void;
  loading?: boolean;
  children?: ReactNode;
};

const BuildStepStagePanelCore: FC<BuildStepStageSummaryPanelProps> = ({
  title,
  icon,
  description,
  progress,
  progressContent,
  headerMeta,
  chipPlacement = 'header',
  taskCount,
  concurrencyIndicator,
  onConcurrencyIndicatorClick,
  concurrencyIndicatorAriaLabel,
  leadingControl,
  menuItems,
  menuDisabled,
  menuAriaLabel,
  failedMode,
  onFailedModeUpdate,
  completedMode,
  onCompletedModeUpdate,
  skippedMode,
  onSkippedModeUpdate,
  loading = false,
  children,
}) => {
  const theme = useTheme();
  const completed = taskCount?.Completed ?? 0;
  const failed = taskCount?.Failed ?? 0;
  const skipped = taskCount?.Skip ?? 0;
  const total = taskCount?.Total ?? (completed + failed + skipped);
  const doneTotal = completed + failed + skipped;
  const progressPercent = total > 0 ? Math.round((doneTotal / total) * 100) : 0;
  const completedLabel = `${Math.min(total, completed)}/${total}`;
  const completedVisibleCount = Math.min(total, completed + skipped);
  const isFailedDisabled = failed === 0;
  const isFailedVisible = failed > 0;
  const isCompletedDisabled = completedVisibleCount === 0;
  const isSkippedVisible = skipped > 0;
  const failedVariant = isFailedDisabled ? 'outlined' : (failedMode ? 'filled' : 'outlined');
  const completedVariant = isCompletedDisabled ? 'outlined' : (completedMode ? 'filled' : 'outlined');
  const isSkippedDisabled = skipped === 0;
  const skippedVariant = isSkippedDisabled ? 'outlined' : (skippedMode ? 'filled' : 'outlined');
  const indicatorCount = Math.max(0, Math.floor(concurrencyIndicator?.count ?? 0));
  const isIndicatorRunning = concurrencyIndicator?.isRunning ?? false;
  const indicatorVariant = isIndicatorRunning ? 'indeterminate' : 'determinate';
  const indicatorIdleColor = theme.palette.mode === 'dark'
    ? theme.palette.grey[800]
    : theme.palette.grey[400];
  const indicatorSx = isIndicatorRunning ? undefined : { color: indicatorIdleColor };
  const indicatorNode = indicatorCount > 0 ? (
    <Stack
      component={onConcurrencyIndicatorClick ? 'button' : 'div'}
      type={onConcurrencyIndicatorClick ? 'button' : undefined}
      aria-label={onConcurrencyIndicatorClick ? (concurrencyIndicatorAriaLabel ?? 'Edit stage concurrency') : undefined}
      direction="row"
      spacing={0.5}
      alignItems="center"
      onClick={onConcurrencyIndicatorClick}
      sx={onConcurrencyIndicatorClick ? {
        p: 0,
        m: 0,
        border: 0,
        background: 'none',
        cursor: 'pointer',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
          borderRadius: 1,
        },
      } : undefined}
    >
      {Array.from({ length: indicatorCount }).map((_, index) => (
        <CircularProgress
          key={`stage-slot-${index}`}
          size={14}
          variant={indicatorVariant}
          value={indicatorVariant === 'determinate' ? 100 : undefined}
          sx={indicatorSx}
        />
      ))}
    </Stack>
  ) : null;
  const hasMenuItems = (menuItems?.length ?? 0) > 0;
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchorEl);
  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  const handleMenuItemClick = (item: BuildStepStageMenuItem) => {
    item.onClick();
    handleMenuClose();
  };
  const chips = (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
      {isFailedVisible ? (
        <Chip
          aria-label={`Failed ${failed}`}
          label={`${failed}`}
          size="small"
          color={isFailedDisabled ? 'default' : 'error'}
          icon={<ErrorOutlineIcon fontSize="small" />}
          variant={failedVariant}
          disabled={isFailedDisabled}
          onClick={isFailedDisabled ? undefined : () => onFailedModeUpdate(!failedMode)}
          sx={isFailedDisabled ? { borderColor: 'divider', color: 'text.disabled' } : undefined}
        />
      ) : null}
      {isSkippedVisible ? (
        <Chip
          aria-label={`Skipped ${skipped}`}
          label={`${skipped}`}
          size="small"
          color="warning"
          icon={<SkipNextIcon fontSize="small" />}
          variant={skippedVariant}
          disabled={isSkippedDisabled}
          onClick={isSkippedDisabled ? undefined : () => onSkippedModeUpdate(!skippedMode)}
          sx={isSkippedDisabled ? { borderColor: 'divider', color: 'text.disabled' } : undefined}
        />
      ) : null}
      <Chip
        aria-label={`Completed ${completedLabel}`}
        label={`${completedLabel}`}
        size="small"
        color={isCompletedDisabled ? 'default' : 'success'}
        icon={<TaskAltIcon fontSize="small" />}
        variant={completedVariant}
        disabled={isCompletedDisabled}
        onClick={isCompletedDisabled ? undefined : () => onCompletedModeUpdate(!completedMode)}
        sx={isCompletedDisabled ? { borderColor: 'divider', color: 'text.disabled' } : undefined}
      />
    </Stack>
  );
  const headerChips = chipPlacement === 'header' ? chips : null;
  const progressPercentNode = (
    <Typography
      variant="subtitle2"
      sx={{ fontWeight: 600, fontSize: '1rem' }}
    >
      {progressPercent}%
    </Typography>
  );
  const footerChips = chipPlacement === 'belowProgress' ? (
    <Box display="flex" alignItems="center" sx={{ mt: '2px', mb: '2px' }}>
      {(leadingControl || indicatorNode) ? (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {leadingControl}
          {indicatorNode}
        </Stack>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
        {chips}
        {progressPercentNode}
      </Stack>
    </Box>
  ) : null;
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
        <Stack spacing={1} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              {icon ? <Box>{icon}</Box> : null}
              <Typography variant="subtitle2" sx={{ fontSize: 'calc(1rem + 2px)' }}>
                {title}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Skeleton variant="rounded" width={96} height={20} />
              <Skeleton variant="rounded" width={88} height={24} />
            </Stack>
          </Stack>
          <Skeleton variant="rounded" height={14} />
          <Skeleton variant="rounded" height={18} />
          <Skeleton variant="rounded" height={18} />
        </Stack>
        {children ? (
          <Box flex={1} minHeight={0}>
            {children}
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={88} />
          </Box>
        )}
      </Box>
    );
  }
  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            {icon ? <Box>{icon}</Box> : null}
            <Typography variant="subtitle2" sx={{ fontSize: 'calc(1rem + 2px)' }}>
              {title}
            </Typography>
            {hasMenuItems ? (
              <>
                <IconButton
                  aria-label={menuAriaLabel ?? 'Stage menu'}
                  size="small"
                  onClick={handleMenuOpen}
                  disabled={menuDisabled}
                  sx={{
                    ml: 2,
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
                <Menu
                  anchorEl={menuAnchorEl}
                  open={isMenuOpen}
                  onClose={handleMenuClose}
                >
                  {menuItems?.map((item) => (
                    <MenuItem
                      key={item.id}
                      onClick={() => handleMenuItemClick(item)}
                      disabled={item.disabled}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {headerMeta ? (
              <Box display="flex" flexDirection="column" alignItems="flex-end">
                {headerMeta}
              </Box>
            ) : null}
            {headerChips ? (
              <Stack direction="row" spacing={1} alignItems="center">
                {leadingControl}
                {indicatorNode}
                {headerChips}
                {progressPercentNode}
              </Stack>
            ) : null}
          </Stack>
        </Stack>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
        {footerChips}
        {progressContent ?? (
          <LinearProgress
            variant="determinate"
            value={progress}
          />
        )}
      </Stack>
      {children ? (
        <Box flex={1} minHeight={0}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
};

export const BuildStepStagePanel = memo(BuildStepStagePanelCore);

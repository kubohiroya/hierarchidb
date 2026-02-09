import { type FC, memo, type ReactNode, useState, type MouseEvent } from 'react';
import { Box, Chip, CircularProgress, IconButton, LinearProgress, Menu, MenuItem, Stack, Typography, useTheme } from '@mui/material';
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
  menuItems?: BuildStepStageMenuItem[];
  menuDisabled?: boolean;
  menuAriaLabel?: string;
  failedMode: boolean;
  onFailedModeUpdate: (newMode: boolean) => void;
  completedMode: boolean;
  onCompletedModeUpdate: (newMode: boolean) => void;
  skippedMode: boolean;
  onSkippedModeUpdate: (newMode: boolean) => void;
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
  menuItems,
  menuDisabled,
  menuAriaLabel,
  failedMode,
  onFailedModeUpdate,
  completedMode,
  onCompletedModeUpdate,
  skippedMode,
  onSkippedModeUpdate,
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
          label={`Failed ${failed}`}
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
          label={`Skipped ${skipped}`}
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
        label={`Completed ${completedLabel}`}
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
  const footerChips = chipPlacement === 'belowProgress' ? (
    <Box display="flex" justifyContent="flex-end" sx={{ mt: '2px', mb: '2px' }}>
      {chips}
    </Box>
  ) : null;
  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            {icon ? <Box>{icon}</Box> : null}
            <Typography variant="subtitle2">{title}</Typography>
            <Typography
              variant="subtitle2"
              sx={{ ml: 2, fontWeight: 600, fontSize: '1rem' }}
            >
              {progressPercent}%
            </Typography>
            {headerMeta ? (
              <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1 }}>
                {headerMeta}
              </Typography>
            ) : null}
            {hasMenuItems ? (
              <>
                <IconButton
                  aria-label={menuAriaLabel ?? 'Stage menu'}
                  size="small"
                  onClick={handleMenuOpen}
                  disabled={menuDisabled}
                  sx={{ ml: 2 }}
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
            {indicatorCount > 0 ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
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
            ) : null}
            {headerChips}
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

/**
 * @fileoverview PaneHeader - Header component for split view panes
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, IconButton, Stack, Typography, useTheme } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  PauseCircle as PauseCircleIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  PlayCircle as PlayCircleIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import AutorenewIcon from '@mui/icons-material/Autorenew';

import type { PaneHeaderProps } from '../types/LRUSplitView.js';
import { PaneProgressSummary } from './PaneProgressSummary.js';

export interface PaneHeaderComponentProps extends PaneHeaderProps {
  /** Whether to use vertical orientation icon */
  vertical?: boolean;
  /** Whether to show progress information */
  showProgress?: boolean;
  /** Custom click handler (overrides default toggle) */
  onClick?: () => void;
}

/**
 * PaneHeader - Default header component for split view panes
 *
 * Features:
 * - Clickable header to toggle pane expansion
 * - Progress display with task counts
 * - Customizable icon and colors
 * - Hover effects and transitions
 * - Support for header actions
 */
export const PaneHeader: React.FC<PaneHeaderComponentProps> = ({
                                                                 pane,
                                                                 state,
                                                                 progress,
                                                                 onToggle,
                                                                 clickable = true,
                                                                 vertical = false,
                                                                 showProgress = true,
                                                                 onClick,
                                                               }) => {
  const theme = useTheme();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const compactBreakpoint = 220;
  const countBreakpoint = 260;
  const isCompact = headerWidth > 0 && headerWidth < compactBreakpoint;
  const showCounts = headerWidth >= countBreakpoint;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (clickable) {
      onToggle(pane.id);
    }
  };

  useEffect(() => {
    if (!headerRef.current || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setHeaderWidth(entry.contentRect.width);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // Choose appropriate expand/collapse icon
  const getToggleIcon = () => {
    if (vertical) {
      return state.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />;
    } else {
      return state.isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />;
    }
  };

  const statusIcon = useMemo(() => {
    if (!progress) return null;
    const summaryTotal = progress.summary?.total ?? 0;
    const isZeroTasks = summaryTotal === 0
      || ((progress.taskCount ?? 0) === 0 && (progress.completedCount ?? 0) === 0);
    const status = progress.status;
    if (status === 'failed') return <ErrorOutlineIcon fontSize="small" />;
    if (isZeroTasks) return <PauseCircleOutlineIcon fontSize="small" />;
    if (status === 'running') return <PlayCircleIcon fontSize="small" />;
    if (status === 'paused') return <PauseCircleIcon fontSize="small" />;
    if (status === 'completed' || progress.progress >= 100) return <CheckCircleIcon fontSize="small" />;
    if (status === 'idle') return <PauseCircleOutlineIcon fontSize="small" />;
    if (progress.progress > 0) return <AutorenewIcon fontSize="small" />;
    return <PauseCircleOutlineIcon fontSize="small" />;
  }, [progress]);

  const statusColor = useMemo(() => {
    if (!progress) return theme.palette.text.secondary;
    const summaryTotal = progress.summary?.total ?? 0;
    const isZeroTasks = summaryTotal === 0
      || ((progress.taskCount ?? 0) === 0 && (progress.completedCount ?? 0) === 0);
    if (progress.status === 'failed') return theme.palette.error.main;
    if (isZeroTasks) return theme.palette.text.secondary;
    switch (progress.status) {
      case 'running':
        return theme.palette.primary.main;
      case 'paused':
        return theme.palette.warning.main;
      case 'completed':
        return theme.palette.success.main;
      default:
        return theme.palette.text.secondary;
    }
  }, [progress, theme.palette]);

  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        //backgroundColor: state.color,
        color: 'primary',
        backgroundColor: theme.palette.background.paper,
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: state.collapsedSize || 60,
        transition: 'background-color 0.2s ease-in-out',
        '&:hover': clickable
          ? {
            backgroundColor: theme.palette.action.hover,
          }
          : {},
      }}
      ref={headerRef}
      onClick={handleClick}
    >
      {/* Left side: Toggle button, icon, and title */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <IconButton size="small" sx={{ p: 0.5 }}>
          {getToggleIcon()}
        </IconButton>

        {!isCompact && pane.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{pane.icon}</Box>}

        {!isCompact && (
          <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
            {pane.title}
          </Typography>
        )}
      </Stack>

      {/* Right side: Progress info and header actions */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* Progress information */}
        {showProgress && progress && (
          <>
            {/* Task count chip */}
            {showCounts && progress.summary ? (
              <PaneProgressSummary summary={progress.summary} />
            ) : showCounts && (progress.taskCount !== undefined || progress.completedCount !== undefined) && (
              <Chip
                label={
                  progress.taskCount !== undefined && progress.completedCount !== undefined
                    ? `${progress.completedCount}/${progress.taskCount}`
                    : progress.taskCount !== undefined
                      ? `${progress.taskCount} tasks`
                      : `${progress.completedCount} done`
                }
                size="small"
                color={
                  (progress.taskCount ?? 0) === 0 && (progress.completedCount ?? 0) === 0
                    ? 'default'
                    : progress.status === 'failed'
                    ? 'error'
                    : progress.status === 'completed'
                      ? 'success'
                      : progress.progress > 0
                        ? 'primary'
                        : 'default'
                }
                variant={progress.progress > 0 ? 'filled' : 'outlined'}
              />
            )}

            {/* Progress percentage */}
            {!isCompact && progress.progress >= 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 'auto' }}>
                {progress.progress.toFixed(0)}%
              </Typography>
            )}

            {/* Status icon */}
            {statusIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', color: statusColor }}>
                {statusIcon}
              </Box>
            )}
          </>
        )}
        {/* Header actions */}
        {!isCompact && pane.headerActions && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>{pane.headerActions}</Box>
        )}
      </Stack>
    </Box>
  );
};

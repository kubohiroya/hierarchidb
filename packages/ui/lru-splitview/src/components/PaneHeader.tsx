/**
 * @fileoverview PaneHeader - Header component for split view panes
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material';

import type { PaneHeaderProps } from '~/types/LRUSplitView';
import { PaneProgressSummary } from './PaneProgressSummary.js';
import { usePaneHeaderView } from './usePaneHeaderView.js';

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
  const view = usePaneHeaderView({
    pane,
    state,
    progress,
    onToggle,
    clickable,
    vertical,
    onClick,
  });

  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        //backgroundColor: atoms.color,
        color: 'primary',
        backgroundColor: view.theme.palette.background.paper,
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: state.collapsedSize || 60,
        transition: 'background-color 0.2s ease-in-out',
        '&:hover': clickable
          ? {
            backgroundColor: view.theme.palette.action.hover,
          }
          : {},
      }}
      ref={view.headerRef}
      onClick={view.handleClick}
    >
      {/* Left side: Toggle button, icon, and title */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <IconButton size="small" sx={{ p: 0.5 }}>
          {view.toggleIcon}
        </IconButton>

        {!view.isCompact && pane.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{pane.icon}</Box>}

        {!view.isCompact && (
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
            {view.showCounts && progress.summary ? (
              <PaneProgressSummary summary={progress.summary} />
            ) : view.showCounts && (progress.taskCount !== undefined || progress.completedCount !== undefined) && (
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
            {!view.isCompact && progress.progress >= 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 'auto' }}>
                {progress.progress.toFixed(0)}%
              </Typography>
            )}

            {/* Status icon */}
            {view.statusIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', color: view.statusColor }}>
                {view.statusIcon}
              </Box>
            )}
          </>
        )}
        {/* Header actions */}
        {!view.isCompact && pane.headerActions && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>{pane.headerActions}</Box>
        )}
      </Stack>
    </Box>
  );
};

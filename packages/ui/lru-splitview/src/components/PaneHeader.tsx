/**
 * @fileoverview PaneHeader - Header component for split view panes
 * @module @hierarchidb/ui-lru-splitview/components
 */

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

import type { PaneHeaderProps } from '../types/LRUSplitView';

export interface PaneHeaderComponentProps extends PaneHeaderProps {
  /** Whether to use vertical orientation icons */
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
 * - Customizable icons and colors
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

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (clickable) {
      onToggle(pane.id);
    }
  };

  // Choose appropriate expand/collapse icon
  const getToggleIcon = () => {
    if (vertical) {
      return state.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />;
    } else {
      return state.isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />;
    }
  };

  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: state.color,
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: state.collapsedSize || 60,
        transition: 'background-color 0.2s ease-in-out',
        '&:hover': clickable ? {
          backgroundColor: theme.palette.action.hover,
        } : {},
      }}
      onClick={handleClick}
    >
      {/* Left side: Toggle button, icon, and title */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <IconButton size="small" sx={{ p: 0.5 }}>
          {getToggleIcon()}
        </IconButton>
        
        {pane.icon && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {pane.icon}
          </Box>
        )}
        
        <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
          {pane.title}
        </Typography>
      </Stack>

      {/* Right side: Progress info and header actions */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* Progress information */}
        {showProgress && progress && (
          <>
            {/* Task count chip */}
            {(progress.taskCount !== undefined || progress.completedCount !== undefined) && (
              <Chip
                label={
                  progress.taskCount !== undefined && progress.completedCount !== undefined
                    ? `${progress.completedCount}/${progress.taskCount}`
                    : progress.taskCount !== undefined
                      ? `${progress.taskCount} tasks`
                      : `${progress.completedCount} done`
                }
                size="small"
                color={progress.progress === 100 ? 'success' : progress.progress > 0 ? 'primary' : 'default'}
                variant={progress.progress > 0 ? 'filled' : 'outlined'}
              />
            )}
            
            {/* Progress percentage */}
            {progress.progress > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 'auto' }}>
                {progress.progress.toFixed(0)}%
              </Typography>
            )}
            
            {/* Custom status */}
            {progress.status && (
              <Chip
                label={progress.status}
                size="small"
                variant="outlined"
              />
            )}
          </>
        )}

        {/* Header actions */}
        {pane.headerActions && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {pane.headerActions}
          </Box>
        )}
      </Stack>
    </Box>
  );
};
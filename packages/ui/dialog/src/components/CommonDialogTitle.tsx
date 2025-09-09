/**
 * @fileoverview CommonDialogTitle - Standardized base-dialog title component
 */

import React from 'react';
import { Box, Chip, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';

export interface CommonDialogTitleProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  mode?: 'create' | 'edit';
  nodeId?: string;
  isDraft?: boolean;
  onClose: () => void;
  additionalActions?: React.ReactNode;
  toggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const CommonDialogTitle: React.FC<CommonDialogTitleProps> = ({
                                                                      title,
                                                                      subtitle,
                                                                      icon,
                                                                      mode,
                                                                      nodeId,
                                                                      isDraft = false,
                                                                      onClose,
                                                                      toggleFullscreen,
                                                                      isFullscreen = false,
                                                                    }) => {
  return (
    <DialogTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {icon}
          <Typography variant="h6">{title}</Typography>
          {mode === 'edit' && nodeId && (
            <Typography variant="caption" color="text.secondary">
              ({nodeId})
            </Typography>
          )}
          {isDraft && <Chip label="Draft" size="small" variant="outlined" color="warning" />}
        </Stack>

        <Stack direction="row" spacing={1}>
          <IconButton
            onClick={toggleFullscreen}
            color="inherit"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
          <IconButton onClick={onClose} color="inherit" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </DialogTitle>
  );
};

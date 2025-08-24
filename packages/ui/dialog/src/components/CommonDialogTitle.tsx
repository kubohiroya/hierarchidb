/**
 * @fileoverview CommonDialogTitle - Standardized dialog title component
 */

import React from 'react';
import { DialogTitle, Typography, IconButton, Stack, Box, Chip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface CommonDialogTitleProps {
  title: string;
  icon?: React.ReactNode;
  mode?: 'create' | 'edit';
  nodeId?: string;
  isDraft?: boolean;
  onClose: () => void;
  additionalActions?: React.ReactNode;
}

export const CommonDialogTitle: React.FC<CommonDialogTitleProps> = ({
  title,
  icon,
  mode,
  nodeId,
  isDraft = false,
  onClose,
  additionalActions,
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
          {isDraft && (
            <Chip
              label="Draft"
              size="small"
              variant="outlined"
              color="warning"
            />
          )}
        </Stack>
        
        <Stack direction="row" spacing={1}>
          {additionalActions}
          <IconButton
            onClick={onClose}
            color="inherit"
            aria-label="Close dialog"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>
    </DialogTitle>
  );
};
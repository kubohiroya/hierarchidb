import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface FullScreenDialogProps {
  /**
   * Dialog title
   */
  title: string;
  /**
   * Whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when the dialog should be closed
   */
  onClose: () => void;
  /**
   * Content to display in the dialog
   */
  children: React.ReactNode;
  /**
   * Optional subtitle or description
   */
  subtitle?: string;
  /**
   * Optional icon to display before the title
   */
  icon?: React.ReactNode;
  /**
   * Additional actions to display in the title bar
   */
  actions?: React.ReactNode;
}

/**
 * Full-screen dialog component with rounded corners and close button
 * Used for info pages, plugin registry, and other full-screen content
 */
export function FullScreenDialog({
  title,
  open,
  onClose,
  children,
  subtitle,
  icon,
  actions,
}: FullScreenDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          borderRadius: 2,
          m: 2,
          height: 'calc(100% - 32px)',
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100% - 32px)',
          maxWidth: 'calc(100% - 32px)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actions}
          <IconButton
            onClick={onClose}
            edge="end"
            aria-label="close"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent
        sx={{
          p: 3,
          overflow: 'auto',
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default FullScreenDialog;
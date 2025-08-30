import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface AutoHideFullScreenDialogProps {
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
  titleActions?: React.ReactNode;
  /**
   * Footer actions (buttons, etc.)
   */
  footerActions?: React.ReactNode;
  /**
   * Whether to enable auto-hide behavior
   */
  autoHide?: boolean;
  /**
   * Delay before hiding header/footer (ms)
   */
  hideDelay?: number;
}

/**
 * Full-screen dialog with auto-hiding header and footer
 */
export function AutoHideFullScreenDialog({
  title,
  open,
  onClose,
  children,
  subtitle,
  icon,
  titleActions,
  footerActions,
  autoHide = true,
  hideDelay = 300,
}: AutoHideFullScreenDialogProps) {
  const [headerVisible, setHeaderVisible] = useState(!autoHide);
  const [footerVisible, setFooterVisible] = useState(!autoHide);
  const headerTimeoutRef = useRef<NodeJS.Timeout>();
  const footerTimeoutRef = useRef<NodeJS.Timeout>();

  const handleHeaderMouseEnter = useCallback(() => {
    if (autoHide) {
      clearTimeout(headerTimeoutRef.current);
      setHeaderVisible(true);
    }
  }, [autoHide]);

  const handleHeaderMouseLeave = useCallback(() => {
    if (autoHide) {
      clearTimeout(headerTimeoutRef.current);
      headerTimeoutRef.current = setTimeout(() => {
        setHeaderVisible(false);
      }, hideDelay);
    }
  }, [autoHide, hideDelay]);

  const handleFooterMouseEnter = useCallback(() => {
    if (autoHide) {
      clearTimeout(footerTimeoutRef.current);
      setFooterVisible(true);
    }
  }, [autoHide]);

  const handleFooterMouseLeave = useCallback(() => {
    if (autoHide) {
      clearTimeout(footerTimeoutRef.current);
      footerTimeoutRef.current = setTimeout(() => {
        setFooterVisible(false);
      }, hideDelay);
    }
  }, [autoHide, hideDelay]);

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
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header hover trigger zone */}
      {autoHide && (
        <Box
          onMouseEnter={handleHeaderMouseEnter}
          onMouseLeave={handleHeaderMouseLeave}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 20,
            zIndex: 1301,
          }}
        />
      )}

      {/* Header */}
      <DialogTitle
        onMouseEnter={handleHeaderMouseEnter}
        onMouseLeave={handleHeaderMouseLeave}
        sx={{
          position: autoHide ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
          backgroundColor: 'background.paper',
          zIndex: 1300,
          transform: autoHide
            ? headerVisible
              ? 'translateY(0)'
              : 'translateY(-100%)'
            : 'none',
          transition: 'transform 0.3s ease-in-out',
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
          {titleActions}
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
      
      {/* Content */}
      <DialogContent
        sx={{
          p: 3,
          overflow: 'auto',
          pt: autoHide ? 8 : 3,
          pb: autoHide && footerActions ? 8 : 3,
        }}
      >
        {children}
      </DialogContent>

      {/* Footer hover trigger zone */}
      {autoHide && footerActions && (
        <Box
          onMouseEnter={handleFooterMouseEnter}
          onMouseLeave={handleFooterMouseLeave}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 20,
            zIndex: 1301,
          }}
        />
      )}

      {/* Footer */}
      {footerActions && (
        <DialogActions
          onMouseEnter={handleFooterMouseEnter}
          onMouseLeave={handleFooterMouseLeave}
          sx={{
            position: autoHide ? 'absolute' : 'relative',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            zIndex: 1300,
            transform: autoHide
              ? footerVisible
                ? 'translateY(0)'
                : 'translateY(100%)'
              : 'none',
            transition: 'transform 0.3s ease-in-out',
            p: 2,
          }}
        >
          {footerActions}
        </DialogActions>
      )}
    </Dialog>
  );
}

export default AutoHideFullScreenDialog;
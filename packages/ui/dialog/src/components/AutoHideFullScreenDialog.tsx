import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

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
  autoHideDelay?: number;
  /**
   * Height of the hover detection zone (px)
   */
  hoverZoneHeight?: number;
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
                                           autoHideDelay = 300,
                                           hoverZoneHeight = 40,
                                         }: AutoHideFullScreenDialogProps): React.ReactElement {
  const [headerVisible, setHeaderVisible] = useState(!autoHide);
  const [footerVisible, setFooterVisible] = useState(!autoHide);
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const footerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      }, autoHideDelay);
    }
  }, [autoHide, autoHideDelay]);

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
      }, autoHideDelay);
    }
  }, [autoHide, autoHideDelay]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          borderRadius: 0,
          m: 0,
          height: '100%',
          width: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header hover trigger zone - transparent area at the very top */}
      {autoHide && (
        <Box
          onMouseEnter={handleHeaderMouseEnter}
          onMouseLeave={handleHeaderMouseLeave}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: `${hoverZoneHeight}px`,
            zIndex: 1302,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Header */}
      <DialogTitle
        onMouseEnter={handleHeaderMouseEnter}
        onMouseLeave={handleHeaderMouseLeave}
        sx={{
          position: autoHide ? 'fixed' : 'relative',
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
          zIndex: 1301,
          transform: autoHide ? (headerVisible ? 'translateY(0)' : 'translateY(-100%)') : 'none',
          transition: 'transform 0.3s ease-in-out',
          boxShadow: headerVisible && autoHide ? 2 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>}
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

      {/* Footer hover trigger zone - transparent area at the very bottom */}
      {autoHide && footerActions && (
        <Box
          onMouseEnter={handleFooterMouseEnter}
          onMouseLeave={handleFooterMouseLeave}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${hoverZoneHeight}px`,
            zIndex: 1302,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Footer */}
      {footerActions && (
        <DialogActions
          onMouseEnter={handleFooterMouseEnter}
          onMouseLeave={handleFooterMouseLeave}
          sx={{
            position: autoHide ? 'fixed' : 'relative',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            zIndex: 1301,
            transform: autoHide ? (footerVisible ? 'translateY(0)' : 'translateY(100%)') : 'none',
            transition: 'transform 0.3s ease-in-out',
            boxShadow: footerVisible && autoHide ? 2 : 0,
            p: 2,
          }}
        >
          {footerActions}
        </DialogActions>
      )}
    </Dialog>
  );
}

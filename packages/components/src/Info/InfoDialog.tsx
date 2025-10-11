import { type ReactNode, useCallback } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

export interface InfoDialogProps {
  /**
   * Whether the base-dialog is open
   */
  open: boolean;
  /**
   * Callback when the base-dialog should close
   */
  onClose: () => void;
  /**
   * Title of the base-dialog
   */
  title?: ReactNode;
  /**
   * Icon to show before the title
   */
  titleIcon?: ReactNode;
  /**
   * Content to display in the base-dialog
   */
  children: ReactNode;
  /**
   * Whether to show the base-dialog in fullscreen mode
   */
  fullScreen?: boolean;
  /**
   * Maximum width of the base-dialog content
   */
  maxWidth?: string | number;
  /**
   * Custom close button text
   */
  closeButtonText?: string;
  /**
   * Additional action buttons to show
   */
  actions?: ReactNode;
  /**
   * Whether to disable the transition animation
   */
  disableTransition?: boolean;
}

/**
 * A generic information base-dialog component that can display any content
 * in a modal base-dialog with consistent styling and behavior.
 */
export const InfoDialog = ({
                             open,
                             onClose,
                             title = 'Information',
                             titleIcon = (
                               <InfoIcon
                                 fontSize={'large'}
                                 style={{ color: 'primary.main', width: 30, height: 30, verticalAlign: 'middle' }}
                               />
                             ),
                             children,
                             fullScreen = false,
                             maxWidth = '1200px',
                             //closeButtonText = 'Close',
                             actions,
                             disableTransition = false,
                           }: InfoDialogProps): React.ReactElement => {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog
      fullScreen={fullScreen}
      open={open}
      onClose={handleClose}
      maxWidth={false}
      transitionDuration={disableTransition ? 0 : undefined}
      sx={{
        '& .MuiDialog-paper': {
          ...(fullScreen && { m: 4 }),
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {titleIcon}
            {title}
          </Box>
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: 4,
            py: 2,
            maxWidth: maxWidth,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {children}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>{actions}</DialogActions>
    </Dialog>
  );
};

/*

 */

import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { Clear as ClearIcon, Close as CloseIcon } from '@mui/icons-material';
import type { ErrorLogEntry } from '../../hooks/useErrorConsole';

interface ErrorConsoleDialogProps {
  open: boolean;
  onClose: () => void;
  errors: ErrorLogEntry[];
  onClearErrors: () => void;
}

export const ErrorConsoleDialog: React.FC<ErrorConsoleDialogProps> = ({
                                                                        open,
                                                                        onClose,
                                                                        errors,
                                                                        onClearErrors,
                                                                      }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Error Console</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {errors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No errors to display
          </Typography>
        ) : (
          <List dense>
            {errors.map((error, index) => (
              <ListItem key={error.id || index}>
                <ListItemText
                  primary={error.message}
                  primaryTypographyProps={{ variant: 'body2', color: 'error' }}
                  secondary={`${new Date(error.timestamp).toLocaleTimeString()} - ${error.phase} (${error.level.toUpperCase()})`}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClearErrors} startIcon={<ClearIcon />} disabled={errors.length === 0}>
          Clear All
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
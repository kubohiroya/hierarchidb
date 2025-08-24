import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Clear as ClearIcon } from '@mui/icons-material';

interface ErrorConsoleDialogProps {
  open: boolean;
  onClose: () => void;
  errors: string[];
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
              <ListItem key={index}>
                <ListItemText
                  primary={error}
                  primaryTypographyProps={{ variant: 'body2', color: 'error' }}
                  secondary={new Date().toLocaleTimeString()}
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
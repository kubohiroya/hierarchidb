import React from 'react';
import type { AuthProviderType } from '../types/AuthProviderType';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { AuthProviderOptions } from './AuthProviderOptions';

interface AuthProviderDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectProvider: (provider: AuthProviderType) => void;
}

/**
 * Dialog version of auth provider selection
 */
export const AuthProviderDialog: React.FC<AuthProviderDialogProps> = ({
  open,
  onClose,
  onSelectProvider,
}) => {
  const handleProviderSelect = (provider: AuthProviderType) => {
    onSelectProvider(provider);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="auth-provider-dialog-title"
      disableRestoreFocus
    >
      <DialogTitle id="auth-provider-dialog-title" sx={{ textAlign: 'center' }}>
        Choose Authentication Provider
      </DialogTitle>
      <DialogContent>
        <List>
          {AuthProviderOptions.map((provider) => (
            <ListItem key={provider.type} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => handleProviderSelect(provider.type)}
                disabled={!provider.available}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:hover': {
                    borderColor: provider.color,
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      color: provider.available ? provider.color : 'text.disabled',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {provider.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={provider.name}
                  secondary={provider.available ? null : 'Coming soon'}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

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
import type React from 'react';
import type { AuthProviderType } from '~/types/AuthProviderType';
import { AuthProviderOptions } from './AuthProviderOptions.js';
import { useAuthProviderDialogView } from './useAuthProviderDialogView.js';

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
  const { titleId, handleProviderSelect } = useAuthProviderDialogView({ onSelectProvider, onClose });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      disableRestoreFocus
    >
      <DialogTitle id={titleId} sx={{ textAlign: 'center' }}>
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

import React from 'react';
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { Login as LoginIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { AuthProviderType } from '../types/AuthProviderType';
import { UserAvatar } from './UserAvatar';
import { AuthProviderDialog } from './AuthProviderDialog';
import { useBFFAuth } from '../hooks/useBFFAuth';

export const UserLoginButton: React.FC = () => {
  const { user, signIn, signOut, auth } = useBFFAuth();
  const isLoading = auth.isLoading;
  const isAuthenticated = auth.isAuthenticated;
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [authProviderDialogOpen, setAuthProviderDialogOpen] = React.useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    signOut();
    handleMenuClose();
  };

  const handleSelectProvider = (_provider: AuthProviderType) => {
    signIn({ isUserInitiated: true });
  };

  // Show loading state during authentication
  if (isLoading) {
    return (
      <IconButton
        disabled
        sx={{
          bgcolor: 'grey.300',
          color: 'grey.600',
          borderRadius: '50%',
        }}
        aria-label="Loading authentication..."
      >
        <LoginIcon />
      </IconButton>
    );
  }

  // Show login button when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <IconButton
          onClick={() => setAuthProviderDialogOpen(true)}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            borderRadius: '50%',
          }}
          aria-label="Login"
        >
          <LoginIcon />
        </IconButton>
        <AuthProviderDialog
          open={authProviderDialogOpen}
          onClose={() => setAuthProviderDialogOpen(false)}
          onSelectProvider={handleSelectProvider}
        />
      </>
    );
  }

  // Show user menu when authenticated
  const userEmail = user?.profile?.email || '';
  const userName = user?.profile?.name || user?.profile?.preferred_username || 'User';
  const userPicture = user?.profile?.picture;

  return (
    <>
      <IconButton onClick={handleMenuOpen} sx={{ p: 0 }} aria-label="User menu">
        <UserAvatar pictureUrl={userPicture} email={userEmail} name={userName} size={40} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <strong>{userName}</strong>
          {userEmail && (
            <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{userEmail}</Box>
          )}
        </Box>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

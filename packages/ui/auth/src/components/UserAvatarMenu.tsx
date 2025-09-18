import { ReactNode, useState } from 'react';
import { AuthContextProps, withAuth } from 'react-oidc-context';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { UserAvatar } from './UserAvatar.js';
// import { KeyboardArrowDownIcon, LoginIcon, LogoutIcon } from "@/icon";
import {
  DeleteForever,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

import { DropdownMenu } from '@hierarchidb/ui-core';
// Working copy cleanup removed - functionality was deprecated

export const UserProfile = (props: { auth: AuthContextProps }) => {
  //  :
  //  : provider-oidc-contextAuthContextProps
  //  : UserAvatarMenu.test.tsx
  //  :
  const auth = props.auth;
  const signIn = () => auth.signinRedirect();
  const signOut = () => auth.signoutRedirect();
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  // Working copy cleanup removed - functionality was deprecated

  const handleClearCache = async () => {
    try {
      // Clear Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      // Clear IndexedDB
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map((db) => {
            if (db.name) {
              return new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name || '');
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
              });
            }
            return Promise.resolve();
          }),
        );
      }

      // Clear localStorage
      localStorage.clear();

      // Close base-dialog and reload page to apply changes
      setClearCacheDialogOpen(false);
      window.location.reload();
    } catch (error) {
      if ((import.meta as any)?.env?.DEV) {
        console.error('Failed to clear cache:', error);
      }
      alert('Failed to clear some cache data. Please try again.');
    }
  };

  // Working copy cleanup removed - functionality was deprecated
  if (!auth.user) {
    return (
      <Button
        variant={'contained'}
        onClick={() => void signIn()}
        style={{ borderRadius: '15px', margin: '3px' }}
        size="large"
        startIcon={<LoginIcon />}
      >
        LOGIN
      </Button>
    );
  }

  //  : DropdownMenuItemType
  //  : nameDropdownMenulabel
  //  : DropdownMenuItemType
  const userMenu = [
    {
      id: 'logout',
      label: 'Logout', //  : namelabel
      name: 'Logout', //  : name
      icon: <LogoutIcon />,
      onClick: () => signOut(),
    } as any,
    {
      id: 'separator',
      divider: true, //  : nulldivider
    } as any,
    {
      id: 'clear-cache',
      label: 'Clear All Cache', //  : namelabel
      name: 'Clear All Cache', //  : name
      icon: <DeleteForever />,
      onClick: () => setClearCacheDialogOpen(true),
      color: 'error',
    } as any,
  ];
  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        marginTop: '6px',
        width: '100%',
      }}
    >
      <DropdownMenu id={`avatarMenu`} items={userMenu}>
        <Button
          title={`${auth.user?.profile.name} ${auth.user?.profile.email}`}
          style={{ borderRadius: '5px', width: '100%', margin: '3px' }}
          disableElevation
          endIcon={<KeyboardArrowDownIcon />}
          variant="outlined"
        >
          <Box sx={{ mr: 1 }}>
            <UserAvatar
              pictureUrl={auth.user?.profile.picture}
              email={auth.user?.profile.email}
              name={auth.user?.profile.name}
              size={32}
            />
          </Box>
          <Typography>{auth.user?.profile.name}</Typography>
        </Button>
      </DropdownMenu>
      <Dialog
        open={clearCacheDialogOpen}
        onClose={() => setClearCacheDialogOpen(false)}
        aria-labelledby="clear-cache-dialog-title"
        aria-describedby="clear-cache-dialog-description"
      >
        <DialogTitle id="clear-cache-dialog-title">Clear All Cache Data?</DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-cache-dialog-description" component="div">
            This will clear all cached data including:
            <ul style={{ marginTop: 8, marginBottom: 8 }}>
              <li>Cache API data</li>
              <li>All IndexedDB databases (projects, maps, shapes, etc.)</li>
              <li>localStorage data</li>
            </ul>
            <strong>Warning:</strong> This action cannot be undone and will delete all your local
            data. The page will reload after clearing the cache.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearCacheDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearCache} color="error" variant="contained" autoFocus>
            Clear Cache
          </Button>
        </DialogActions>
      </Dialog>

      {/* Working copy cleanup removed - functionality was deprecated */}
      {/* <Dialog
        open={clearWorkingCopyDialogOpen}
        onClose={() => setClearWorkingCopyDialogOpen(false)}
        aria-labelledby="clear-workingcopy-base-dialog-title"
        aria-describedby="clear-workingcopy-base-dialog-description"
      >
        <DialogTitle id="clear-workingcopy-base-dialog-title">
          Clear WorkingCopyTypes Garbage?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-workingcopy-base-dialog-description" component="div">
            {workingCopyStats ? (
              <>
                <Typography variant="body2" gutterBottom>
                  Found {workingCopyStats.total} WorkingCopyTypes entities:
                </Typography>
                <ul style={{ marginTop: 8, marginBottom: 8 }}>
                  <li>Orphaned (original deleted): {workingCopyStats.orphaned}</li>
                  <li>Stale (older than 24 hours): {workingCopyStats.stale}</li>
                </ul>
                {Object.keys(workingCopyStats.byType).length > 0 && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      By type:
                    </Typography>
                    <ul style={{ marginTop: 8, marginBottom: 8 }}>
                      {Object.entries(workingCopyStats.byType).map(([type, count]) => (
                        <li key={type}>{type}: {count as number}</li>
                      ))}
                    </ul>
                  </>
                )}
                <Typography variant="body2" color="warning.main">
                  <strong>Note:</strong> This will delete orphaned and stale WorkingCopies.
                  Active WorkingCopies (less than 24 hours old with existing originals) will be preserved.
                </Typography>
              </>
            ) : (
              <Typography>Loading WorkingCopyTypes statistics...</Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearWorkingCopyDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleClearWorkingCopies} 
            color="warning" 
            variant="contained" 
            autoFocus
            disabled={!workingCopyStats}
          >
            Clear Garbage
          </Button>
        </DialogActions>
      </Dialog> */}
    </Box>
  );
};

export const UserAvatarMenu = withAuth(UserProfile) as () => ReactNode;

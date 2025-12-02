import {
  DeleteForever,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { type ReactNode, useCallback, useId, useMemo, useState } from 'react';
import { type AuthContextProps, withAuth } from 'react-oidc-context';
import { UserAvatar } from './UserAvatar.js';

type MenuEntry =
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }
  | {
      kind: 'divider';
      id: string;
    };

// Working copy cleanup removed - functionality was deprecated

export const UserProfile = (props: { auth: AuthContextProps }) => {
  //  :
  //  : provider-oidc-contextAuthContextProps
  //  : UserAvatarMenu.test.tsx
  //  :
  const auth = props.auth;
  const signIn = useCallback(() => {
    void auth.signinRedirect();
  }, [auth]);
  const signOut = useCallback(() => {
    void auth.signoutRedirect();
  }, [auth]);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  // Working copy cleanup removed - functionality was deprecated
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);
  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

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
          })
        );
      }

      // Clear localStorage
      localStorage.clear();

      // Close base-dialog and reload page to apply changes
      setClearCacheDialogOpen(false);
      window.location.reload();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to clear cache:', error);
      }
      alert('Failed to clear some cache data. Please try again.');
    }
  };

  const menuId = useId();
  const clearCacheTitleId = useId();
  const clearCacheDescriptionId = useId();

  const userMenu: MenuEntry[] = useMemo(
    () => [
      {
        kind: 'item',
        id: 'logout',
        label: 'Logout', //  : namelabel
        icon: <LogoutIcon />,
        onClick: () => signOut(),
      },
      { kind: 'divider', id: 'divider-cache' },
      {
        kind: 'item',
        id: 'clear-cache',
        label: 'Clear All Cache', //  : namelabel
        icon: <DeleteForever />,
        onClick: () => setClearCacheDialogOpen(true),
      },
    ],
    [signOut]
  );

  // Working copy cleanup removed - functionality was deprecated
  if (!auth.user) {
    return (
      <Button
        variant={'contained'}
        onClick={signIn}
        style={{ borderRadius: '15px', margin: '3px' }}
        size="large"
        startIcon={<LoginIcon />}
      >
        LOGIN
      </Button>
    );
  }
  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        marginTop: '6px',
        width: '100%',
      }}
    >
      <Button
        title={`${auth.user?.profile.name} ${auth.user?.profile.email}`}
        style={{ borderRadius: '5px', width: '100%', margin: '3px' }}
        disableElevation
        endIcon={<KeyboardArrowDownIcon />}
        variant="outlined"
        onClick={handleClick}
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
      <Menu id={menuId} anchorEl={anchorEl} open={open} onClose={handleClose}>
        {userMenu.map((entry) =>
          entry.kind === 'item' ? (
            <MenuItem key={entry.id} onClick={entry.onClick} disabled={entry.disabled}>
              {entry.icon}
              {entry.label}
            </MenuItem>
          ) : (
            <Divider key={entry.id} />
          )
        )}
      </Menu>
      <Dialog
        open={clearCacheDialogOpen}
        onClose={() => setClearCacheDialogOpen(false)}
        aria-labelledby={clearCacheTitleId}
        aria-describedby={clearCacheDescriptionId}
      >
        <DialogTitle id={clearCacheTitleId}>Clear All Cache Data?</DialogTitle>
        <DialogContent>
          <DialogContentText id={clearCacheDescriptionId} component="div">
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

      {/* Draft cleanup removed - functionality was deprecated */}
      {/* <Dialog
        open={clearDraftDialogOpen}
        onClose={() => setClearDraftDialogOpen(false)}
        aria-labelledby="clear-draft-base-dialog-title"
        aria-describedby="clear-draft-base-dialog-description"
      >
        <DialogTitle id="clear-draft-base-dialog-title">
          Clear DraftTypes Garbage?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-draft-base-dialog-description" component="div">
            {draftStats ? (
              <>
                <Typography variant="body2" gutterBottom>
                  Found {draftStats.total} DraftTypes entities:
                </Typography>
                <ul style={{ marginTop: 8, marginBottom: 8 }}>
                  <li>Orphaned (original deleted): {draftStats.orphaned}</li>
                  <li>Stale (older than 24 hours): {draftStats.stale}</li>
                </ul>
                {Object.keys(draftStats.byType).length > 0 && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      By type:
                    </Typography>
                    <ul style={{ marginTop: 8, marginBottom: 8 }}>
                      {Object.entries(draftStats.byType).map(([type, count]) => (
                        <li key={type}>{type}: {count as number}</li>
                      ))}
                    </ul>
                  </>
                )}
                <Typography variant="body2" color="warning.main">
                  <strong>Note:</strong> This will delete orphaned and stale Drafts.
                  Active Drafts (less than 24 hours old with existing originals) will be preserved.
                </Typography>
              </>
            ) : (
              <Typography>Loading DraftTypes statistics...</Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDraftDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleClearDrafts} 
            color="warning" 
            variant="contained" 
            autoFocus
            disabled={!draftStats}
          >
            Clear Garbage
          </Button>
        </DialogActions>
      </Dialog> */}
    </Box>
  );
};

export const UserAvatarMenu = withAuth(UserProfile) as () => ReactNode;

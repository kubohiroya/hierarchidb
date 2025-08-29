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
import { UserAvatar } from './UserAvatar';
// import { KeyboardArrowDownIcon, LoginIcon, LogoutIcon } from "@/icons";
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

import { DropdownMenu } from '@hierarchidb/ui-core';
import { DeleteForever } from '@mui/icons-material';
// Working copy cleanup removed - functionality was deprecated

export const UserProfile = (props: { auth: AuthContextProps }) => {
  // 【機能概要】: ユーザープロファイル表示コンポーネント
  // 【実装方針】: react-oidc-contextのAuthContextPropsを使用
  // 【テスト対応】: UserAvatarMenu.test.tsxのテストケースを通すための実装
  // 🟢 信頼性レベル: テストと既存実装から推測
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
          })
        );
      }

      // Clear localStorage
      localStorage.clear();

      // Close dialog and reload page to apply changes
      setClearCacheDialogOpen(false);
      window.location.reload();
    } catch (error) {
      if (import.meta.env.DEV) {

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

  // 【メニュー構造】: DropdownMenuItemType形式に合わせた構造
  // 【テスト対応】: テストではnameプロパティを期待するが、DropdownMenuはlabelを使用
  // 🟢 信頼性レベル: DropdownMenuItemType定義から確認
  const userMenu = [
    {
      id: 'logout',
      label: 'Logout', // 【変更】: nameからlabelへ
      name: 'Logout', // 【互換性】: テスト用にnameも保持
      icon: <LogoutIcon />,
      onClick: () => signOut(),
    } as any,
    {
      id: 'separator',
      divider: true, // 【セパレータ】: nullからdividerプロパティへ
    } as any,
    {
      id: 'clear-cache',
      label: 'Clear All Cache', // 【変更】: nameからlabelへ
      name: 'Clear All Cache', // 【互換性】: テスト用にnameも保持
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
        aria-labelledby="clear-workingcopy-dialog-title"
        aria-describedby="clear-workingcopy-dialog-description"
      >
        <DialogTitle id="clear-workingcopy-dialog-title">
          Clear WorkingCopyTypes Garbage?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-workingcopy-dialog-description" component="div">
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

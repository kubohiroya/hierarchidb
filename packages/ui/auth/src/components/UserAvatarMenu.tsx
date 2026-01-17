import {
  DeleteForever,
  DarkMode as DarkModeIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  LightMode as LightModeIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  SettingsBrightness as SystemThemeIcon,
  Transform as TransformIcon,
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
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from 'react';
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
  const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);
  const handleCloseAll = useCallback(() => {
    setAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
  }, []);

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('app.theme');
    return (stored as 'system' | 'light' | 'dark') ?? 'system';
  });
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem('app.lang') ?? 'system';
  });

  useEffect(() => {
    // Sync with external changes (e.g., TreeConsole dispatch)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode?: string; lang?: string };
      if (detail?.mode && (detail.mode === 'system' || detail.mode === 'light' || detail.mode === 'dark')) {
        setThemeMode(detail.mode);
      }
      if (detail?.lang) {
        setLanguage(detail.lang);
      }
    };
    window.addEventListener('hierarchidb-theme-change', handler);
    window.addEventListener('hierarchidb-language-change', handler);
    return () => {
      window.removeEventListener('hierarchidb-theme-change', handler);
      window.removeEventListener('hierarchidb-language-change', handler);
    };
  }, []);

  const selectTheme = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.theme', mode);
      window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
    }
    setThemeAnchorEl(null);
    setAnchorEl(null);
  };

  const selectLanguage = (lang: string) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.lang', lang);
      window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } }));
    }
    setLanguageAnchorEl(null);
    setAnchorEl(null);
  };

  const deleteIndexedDbDatabases = async (): Promise<{ blocked: string[]; failed: string[] }> => {
    if (!('indexedDB' in window) || typeof indexedDB.databases !== 'function') {
      return { blocked: [], failed: [] };
    }
    const databases = await indexedDB.databases();
    const names = databases
      .map((db) => db.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    const results = await Promise.all(
      names.map((name) =>
        new Promise<{ name: string; status: 'deleted' | 'blocked' | 'failed' }>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          let settled = false;
          const finish = (status: 'deleted' | 'blocked' | 'failed') => {
            if (settled) return;
            settled = true;
            resolve({ name, status });
          };
          req.onsuccess = () => finish('deleted');
          req.onerror = () => finish('failed');
          req.onblocked = () => finish('blocked');
        })
      )
    );
    return {
      blocked: results.filter((r) => r.status === 'blocked').map((r) => r.name),
      failed: results.filter((r) => r.status === 'failed').map((r) => r.name),
    };
  };

  const handleClearCache = async () => {
    try {
      // Clear Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      // Clear IndexedDB
      const indexedDbResult = await deleteIndexedDbDatabases();

      // Clear localStorage
      localStorage.clear();

      if (indexedDbResult.blocked.length > 0 || indexedDbResult.failed.length > 0) {
        if (import.meta.env.DEV) {
          console.warn('IndexedDB delete blocked/failed:', indexedDbResult);
        }
        alert('Some IndexedDB data could not be cleared. Close other tabs and try again.');
      }

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
      { kind: 'item', id: 'logout', label: 'Logout', icon: <LogoutIcon />, onClick: () => signOut() },
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
      <Menu id={menuId} anchorEl={anchorEl} open={open} onClose={handleCloseAll}>
        <MenuItem onClick={(e) => setThemeAnchorEl(e.currentTarget)}>
          <SystemThemeIcon fontSize="small" sx={{ mr: 1 }} />
          Theme
        </MenuItem>
        <MenuItem onClick={(e) => setLanguageAnchorEl(e.currentTarget)}>
          <TransformIcon fontSize="small" sx={{ mr: 1 }} />
          Language
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setClearCacheDialogOpen(true)}>
          <DeleteForever sx={{ mr: 1 }} />
          Clear All Cache
        </MenuItem>
        <Divider />
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

      <Menu anchorEl={themeAnchorEl} open={Boolean(themeAnchorEl)} onClose={() => setThemeAnchorEl(null)}>
        <MenuItem selected={themeMode === 'system'} onClick={() => selectTheme('system')}>
          <SystemThemeIcon fontSize="small" sx={{ mr: 1 }} />
          System
        </MenuItem>
        <MenuItem selected={themeMode === 'light'} onClick={() => selectTheme('light')}>
          <LightModeIcon fontSize="small" sx={{ mr: 1 }} />
          Light
        </MenuItem>
        <MenuItem selected={themeMode === 'dark'} onClick={() => selectTheme('dark')}>
          <DarkModeIcon fontSize="small" sx={{ mr: 1 }} />
          Dark
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={languageAnchorEl}
        open={Boolean(languageAnchorEl)}
        onClose={() => setLanguageAnchorEl(null)}
      >
        <MenuItem selected={language === 'system'} onClick={() => selectLanguage('system')}>
          System
        </MenuItem>
        <MenuItem selected={language === 'en'} onClick={() => selectLanguage('en')}>
          English
        </MenuItem>
        <MenuItem selected={language === 'ja'} onClick={() => selectLanguage('ja')}>
          日本語
        </MenuItem>
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

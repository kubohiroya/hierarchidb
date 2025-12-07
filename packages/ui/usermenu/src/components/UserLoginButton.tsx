import {
  AuthProviderDialog,
  type AuthProviderType,
  UserAvatar,
  useAuth,
} from '@hierarchidb/ui-auth';
import { ThemeContext, type ThemeContextType } from '@hierarchidb/ui-theme';
import {
  DarkMode as DarkModeIcon,
  DeleteForever as DeleteForeverIcon,
  Language as LanguageIcon,
  LightMode as LightModeIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  SettingsBrightness as SystemThemeIcon,
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
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import React, { useContext, useEffect, useId, useState } from 'react';

const createSafeFileName = (key: string) =>
  btoa(unescape(encodeURIComponent(key))).replace(/=+/g, '');

type ThemeMode = 'system' | 'light' | 'dark';
type LanguageCode = 'system' | 'en' | 'ja';

export const UserLoginButton: React.FC = () => {
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined' && !!document.body;
  const { user, signIn, signOut, auth } = useAuth();
  const themeContext = useContext<ThemeContextType | null>(ThemeContext);

  // Hooks (single declaration block for stable order)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authProviderDialogOpen, setAuthProviderDialogOpen] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [themeMenuAnchorEl, setThemeMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = useState<null | HTMLElement>(null);
  const clearDialogTitleId = useId();
  const clearDialogDescriptionId = useId();
  const userEmail = user?.profile?.email || '';
  const userName = user?.profile?.name || userEmail || 'User';
  const userPicture = user?.profile?.picture;
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(userPicture || undefined);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('app.theme');
    return (stored as ThemeMode) || 'system';
  });
  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('app.lang') as LanguageCode | null;
    return stored || 'system';
  });

  // Avatar OPFS cache
  useEffect(() => {
    let revokedUrl: string | undefined;
    let aborted = false;
    const run = async () => {
      const pictureUrl = userPicture;
      if (!pictureUrl || !hasDom) {
        setAvatarUrl(pictureUrl || undefined);
        return;
      }
      const storageAny = (navigator as unknown as { storage?: { getDirectory?: () => Promise<unknown> } }).storage;
      if (!storageAny?.getDirectory) {
        setAvatarUrl(pictureUrl);
        return;
      }
      try {
        const root = (await storageAny.getDirectory()) as FileSystemDirectoryHandle;
        const dir = await root.getDirectoryHandle('avatars', { create: true });
        const fileName = `${createSafeFileName(userEmail || userName || 'user')}.bin`;
        try {
          const fileHandle = await dir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          if (!aborted) {
            revokedUrl = url;
            setAvatarUrl(url);
            return;
          }
        } catch {
          // cache miss
        }
        const res = await fetch(pictureUrl, { mode: 'cors' });
        if (!res.ok) {
          setAvatarUrl(pictureUrl);
          return;
        }
        const blob = await res.blob();
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        const url = URL.createObjectURL(blob);
        if (!aborted) {
          revokedUrl = url;
          setAvatarUrl(url);
        }
      } catch {
        setAvatarUrl(pictureUrl);
      }
    };
    void run();
    return () => {
      aborted = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [hasDom, userEmail, userName, userPicture]);

  const isLoading = auth.isLoading;
  const isAuthenticated = auth.isAuthenticated;

  // Theme/Language apply and sync
  const applyTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.theme', mode);
      window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
    }
    setThemeMenuAnchorEl(null);
    setAnchorEl(null);
  };

  const applyLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.lang', lang);
      window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } }));
    }
    setLanguageMenuAnchorEl(null);
    setAnchorEl(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    signOut();
    // Explicitly clear stored tokens
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token_id');
      sessionStorage.removeItem('access_token');
    } catch {
      // ignore storage errors
    }
    handleMenuClose();
  };

  const handleSelectProvider = (_provider: AuthProviderType) => {
    signIn({ isUserInitiated: true });
  };

  const handleClearCache = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map((db) => {
            if (db.name) {
              return new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase(db.name || '');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
            }
            return Promise.resolve();
          })
        );
      }
      localStorage.clear();
      setClearCacheDialogOpen(false);
      window.location.reload();
    } catch {
      alert('Failed to clear some cache data. Please try again.');
    }
  };

  if (!themeContext || !hasDom) return null;

  if (isLoading) {
    return (
      <IconButton
        disabled
        sx={{ bgcolor: 'grey.300', color: 'grey.600', borderRadius: '50%' }}
        aria-label="Loading authentication..."
      >
        <LoginIcon />
      </IconButton>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <IconButton
          onClick={(e) => {
            e.currentTarget.blur();
            setTimeout(() => setAuthProviderDialogOpen(true), 0);
          }}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' },
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

  return (
    <>
      <IconButton onClick={handleMenuOpen} sx={{ p: 0 }} aria-label="User menu">
        <UserAvatar pictureUrl={avatarUrl} email={userEmail} name={userName} size={40} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <strong>{userName}</strong>
          {userEmail && <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{userEmail}</Box>}
        </Box>
        <Divider />

        <MenuItem onClick={(e) => setThemeMenuAnchorEl(e.currentTarget)} aria-label="Theme Selection">
          <ListItemIcon>
            {themeMode === 'dark' ? <DarkModeIcon fontSize="small" /> : themeMode === 'light' ? <LightModeIcon fontSize="small" /> : <SystemThemeIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary="Theme" secondary={themeMode} />
        </MenuItem>

        <MenuItem onClick={(e) => setLanguageMenuAnchorEl(e.currentTarget)} aria-label="Language Selection">
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Language" secondary={language} />
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => setClearCacheDialogOpen(true)} aria-label="Clear All Data">
          <ListItemIcon>
            <DeleteForeverIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Clear All Data</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleLogout} aria-label="Logout">
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={themeMenuAnchorEl}
        open={Boolean(themeMenuAnchorEl)}
        onClose={() => setThemeMenuAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem selected={themeMode === 'system'} onClick={() => applyTheme('system')}>
          <ListItemIcon>
            <SystemThemeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>System</ListItemText>
        </MenuItem>
        <MenuItem selected={themeMode === 'light'} onClick={() => applyTheme('light')}>
          <ListItemIcon>
            <LightModeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Light</ListItemText>
        </MenuItem>
        <MenuItem selected={themeMode === 'dark'} onClick={() => applyTheme('dark')}>
          <ListItemIcon>
            <DarkModeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Dark</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={languageMenuAnchorEl}
        open={Boolean(languageMenuAnchorEl)}
        onClose={() => setLanguageMenuAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem selected={language === 'system'} onClick={() => applyLanguage('system')}>
          <ListItemText>System</ListItemText>
        </MenuItem>
        <MenuItem selected={language === 'en'} onClick={() => applyLanguage('en')}>
          <ListItemText>English</ListItemText>
        </MenuItem>
        <MenuItem selected={language === 'ja'} onClick={() => applyLanguage('ja')}>
          <ListItemText>日本語</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={clearCacheDialogOpen}
        onClose={() => setClearCacheDialogOpen(false)}
        aria-labelledby={clearDialogTitleId}
        aria-describedby={clearDialogDescriptionId}
      >
        <DialogTitle id={clearDialogTitleId}>Clear All Data?</DialogTitle>
        <DialogContent>
          <DialogContentText id={clearDialogDescriptionId} component="div">
            This will clear all data including:
            <ul style={{ marginTop: 8, marginBottom: 8 }}>
              <li>Cache API data</li>
              <li>All IndexedDB databases (projects, maps, shapes, etc.)</li>
              <li>localStorage data</li>
            </ul>
            <strong>Warning:</strong> This action cannot be undone and will delete all your local data. The page
            will reload after clearing the cache.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearCacheDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearCache} color="error" variant="contained" autoFocus>
            Clear All Data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

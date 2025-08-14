import React from 'react';
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
import {
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  DeleteForever as DeleteForeverIcon,
  Language as LanguageIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Memory as MemoryIcon,
  MemoryOutlined as MemoryOutlinedIcon,
} from '@mui/icons-material';
import { useAuthLib } from '@/shared/auth/hooks/useAuthLib';
import { useAuthMethod } from '@/shared/auth/hooks/useAuthMethod';
import { AuthProviderType } from '@/shared/auth/types/AuthProviderType.ts';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { AuthProviderDialog } from '@/shared/auth/components/AuthProviderDialog';
// import { devLog } from "@/shared/utils/logger";
import { useThemeMode } from '@/shared/themes/hooks/useThemeMode';
import { getThemeDisplayName, getThemeIcon } from '../../theme/components/ThemeContext';
import { ThemeMode } from '../../theme/ThemeMode';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

export const UserLoginButton: React.FC = () => {
  // All hooks must be called at the top level, before any conditional returns
  const { user, signIn, signOut, auth } = useAuthLib();
  const isAuthenticated = auth.isAuthenticated;
  const isLoading = auth.isLoading;
  const { authMethod, setAuthMethod } = useAuthMethod();
  const { themeMode, setThemeMode } = useThemeMode();
  const { currentLanguage, supportedLanguages, changeLanguage } = useLanguage();
  const { t } = useTranslation('common');
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [themeMenuAnchorEl, setThemeMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [clearCacheDialogOpen, setClearAllDataDialogOpen] = React.useState(false);
  const [memoryMonitorVisible, setMemoryMonitorVisible] = React.useState(false);
  const [authProviderDialogOpen, setAuthProviderDialogOpen] = React.useState(false);

  // Load memory monitor visibility state on mount
  React.useEffect(() => {
    const savedVisibility = localStorage.getItem('memoryMonitorVisible');
    if (savedVisibility === 'true') {
      setMemoryMonitorVisible(true);
    }
  }, []);

  const handleToggleMemoryMonitor = React.useCallback(() => {
    const newVisibility = !memoryMonitorVisible;
    setMemoryMonitorVisible(newVisibility);
    localStorage.setItem('memoryMonitorVisible', newVisibility.toString());
    // Dispatch custom event to notify MemoryUsageMonitor component
    window.dispatchEvent(
      new CustomEvent('memoryMonitorToggle', {
        detail: { visible: newVisibility },
      })
    );
  }, [memoryMonitorVisible]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setThemeMenuAnchorEl(null);
    setLanguageMenuAnchorEl(null);
  };

  const handleThemeMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setThemeMenuAnchorEl(event.currentTarget);
  };

  const handleThemeMenuClose = () => {
    setThemeMenuAnchorEl(null);
  };

  const handleLanguageMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageMenuAnchorEl(event.currentTarget);
  };

  const handleLanguageMenuClose = () => {
    setLanguageMenuAnchorEl(null);
  };

  const handleLanguageChange = async (languageCode: string) => {
    await changeLanguage(languageCode);
    handleLanguageMenuClose();
    handleMenuClose();
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    // devLog("🔧 Theme change requested:", newTheme);
    setThemeMode(newTheme);
    handleThemeMenuClose();
    handleMenuClose();
  };

  const handleLogout = async () => {
    signOut();
    handleMenuClose();
  };

  const handleAuthMethodChange = (method: 'popup' | 'redirect') => {
    setAuthMethod(method);
    handleMenuClose();
  };

  const handleSelectProvider = (provider: AuthProviderType) => {
    // For now, just sign in without provider parameter
    // TODO: Add provider support to useAuthLib if needed
    signIn({ isUserInitiated: true });
  };

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
      setClearAllDataDialogOpen(false);
      window.location.reload();
    } catch (error) {
      alert('Failed to clear some cache data. Please try again.');
    }
  };

  // Show loading state only during initial authentication loading
  if (isLoading) {
    return (
      <IconButton
        disabled
        sx={{
          bgcolor: 'grey.300',
          color: 'grey.600',
          borderRadius: '50%',
        }}
        aria-label="Loading authentication"
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
          onClick={(e) => {
            // Ensure focus is properly managed before opening dialog
            e.currentTarget.blur();
            // Use setTimeout to ensure focus is released before dialog opens
            setTimeout(() => setAuthProviderDialogOpen(true), 0);
          }}
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
        <MenuItem onClick={handleThemeMenuOpen} aria-label="Theme Selection">
          <ListItemIcon>{getThemeIcon(themeMode)}</ListItemIcon>
          <ListItemText>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <span> Theme</span>
              <ChevronRightIcon fontSize="small" />
            </Box>
          </ListItemText>
        </MenuItem>
        {supportedLanguages.length > 0 && (
          <MenuItem onClick={handleLanguageMenuOpen} aria-label="Language Selection">
            <ListItemIcon>
              <LanguageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <span>
                  {currentLanguage.flag} {t('navigation.language')}
                </span>
                <ChevronRightIcon fontSize="small" />
              </Box>
            </ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => handleAuthMethodChange(authMethod === 'popup' ? 'redirect' : 'popup')}
          aria-label={`Auth Method: ${authMethod === 'popup' ? 'Popup' : 'Redirect'}`}
        >
          <ListItemText>Auth Method: {authMethod === 'popup' ? 'Popup' : 'Redirect'}</ListItemText>
        </MenuItem>
        {/* Memory Monitor Toggle - Only shown in development mode */}
        {import.meta.env.DEV && <Divider />}
        {import.meta.env.DEV && (
          <MenuItem
            onClick={handleToggleMemoryMonitor}
            aria-label={memoryMonitorVisible ? 'Hide Memory Monitor' : 'Show Memory Monitor'}
          >
            <ListItemIcon>
              {memoryMonitorVisible ? (
                <MemoryIcon fontSize="small" />
              ) : (
                <MemoryOutlinedIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <span>{memoryMonitorVisible ? 'Hide Memory Monitor' : 'Show Memory Monitor'}</span>
                {memoryMonitorVisible && (
                  <CheckIcon
                    fontSize="small"
                    sx={{
                      color: 'success.main',
                      ml: 1,
                    }}
                  />
                )}
              </Box>
            </ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => setClearAllDataDialogOpen(true)} aria-label="Clear All Data">
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

      {/* Theme Selection Submenu */}
      <Menu
        anchorEl={themeMenuAnchorEl}
        open={Boolean(themeMenuAnchorEl)}
        onClose={handleThemeMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
          <MenuItem
            key={mode}
            onClick={() => handleThemeChange(mode)}
            aria-label={`Select ${getThemeDisplayName(mode)} theme`}
          >
            <ListItemText>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <span>
                  {getThemeIcon(mode)} {getThemeDisplayName(mode)}
                </span>
                {themeMode === mode && (
                  <CheckIcon
                    fontSize="small"
                    sx={{
                      color: 'success.main',
                      ml: 1,
                    }}
                  />
                )}
              </Box>
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Language Selection Submenu */}
      {supportedLanguages.length > 0 && (
        <Menu
          anchorEl={languageMenuAnchorEl}
          open={Boolean(languageMenuAnchorEl)}
          onClose={handleLanguageMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {supportedLanguages.map((language) => (
            <MenuItem
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              aria-label={`Select ${language.nativeName} language`}
            >
              <ListItemText>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    minWidth: 150,
                  }}
                >
                  <span>
                    {language.flag} {language.nativeName}
                  </span>
                  {currentLanguage.code === language.code && (
                    <CheckIcon
                      fontSize="small"
                      sx={{
                        color: 'success.main',
                        ml: 1,
                      }}
                    />
                  )}
                </Box>
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>
      )}

      {/* Clear Cache Confirmation Dialog */}
      <Dialog
        open={clearCacheDialogOpen}
        onClose={() => setClearAllDataDialogOpen(false)}
        aria-labelledby="clear-all-data-dialog-title"
        aria-describedby="clear-all-data-dialog-description"
      >
        <DialogTitle id="clear-all-data-dialog-title">Clear All Data?</DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-cache-dialog-description" component="div">
            This will clear all data including:
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
          <Button onClick={() => setClearAllDataDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearCache} color="error" variant="contained" autoFocus>
            Clear All Data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

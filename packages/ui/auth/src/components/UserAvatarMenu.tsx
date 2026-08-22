import {
  DarkMode as DarkModeIcon,
  DeleteForever,
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
import type { ReactNode } from 'react';
import { type AuthContextProps, withAuth } from 'react-oidc-context';
import { UserAvatar } from './UserAvatar.js';
import { useUserAvatarMenuView } from './useUserAvatarMenuView.js';
import { useUserProfileView } from './useUserProfileView.js';

export const UserProfile = (props: { auth: AuthContextProps }) => {
  const auth = props.auth;
  const {
    signIn,
    signOut,
    clearCacheDialogOpen,
    setClearCacheDialogOpen,
    anchorEl,
    themeAnchorEl,
    languageAnchorEl,
    open,
    isAuthenticated,
    themeMode,
    language,
    handleClick,
    handleCloseAll,
    openThemeMenu,
    closeThemeMenu,
    openLanguageMenu,
    closeLanguageMenu,
    selectTheme,
    selectLanguage,
    handleClearCache,
    menuButtonTitle,
  } = useUserAvatarMenuView(auth);

  const {
    menuId,
    clearCacheTitleId,
    clearCacheDescriptionId,
    userMenu,
    displayName,
    pictureUrl,
    email,
    name,
  } = useUserProfileView(auth, isAuthenticated);

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
        title={menuButtonTitle}
        style={{ borderRadius: '5px', width: '100%', margin: '3px' }}
        disableElevation
        endIcon={<KeyboardArrowDownIcon />}
        variant="outlined"
        onClick={handleClick}
      >
        <Box sx={{ mr: 1 }}>
          <UserAvatar pictureUrl={pictureUrl} email={email} name={name} size={32} />
        </Box>
        <Typography>{displayName}</Typography>
      </Button>
      <Menu id={menuId} anchorEl={anchorEl} open={open} onClose={handleCloseAll}>
        {!isAuthenticated && (
          <>
            <MenuItem
              onClick={() => {
                handleCloseAll();
                signIn();
              }}
            >
              <LoginIcon fontSize="small" sx={{ mr: 1 }} />
              Login
            </MenuItem>
            <Divider />
          </>
        )}
        <MenuItem onClick={openThemeMenu}>
          <SystemThemeIcon fontSize="small" sx={{ mr: 1 }} />
          Theme
        </MenuItem>
        <MenuItem onClick={openLanguageMenu}>
          <TransformIcon fontSize="small" sx={{ mr: 1 }} />
          Language
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setClearCacheDialogOpen(true)}>
          <DeleteForever sx={{ mr: 1 }} />
          Clear All Cache
        </MenuItem>
        <Divider />
        {userMenu.map((entry) => (
          <MenuItem key={entry.id} onClick={() => signOut()} disabled={entry.disabled}>
            <LogoutIcon sx={{ mr: 1 }} />
            {entry.label}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={themeAnchorEl} open={Boolean(themeAnchorEl)} onClose={closeThemeMenu}>
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
        onClose={closeLanguageMenu}
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
    </Box>
  );
};

export const UserAvatarMenu = withAuth(UserProfile) as () => ReactNode;

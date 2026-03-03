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
import { type ReactNode, useId, useMemo } from 'react';
import { type AuthContextProps, withAuth } from 'react-oidc-context';
import { UserAvatar } from './UserAvatar.js';
import { useUserAvatarMenuView } from './useUserAvatarMenuView.js';

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

  const menuId = useId();
  const clearCacheTitleId = useId();
  const clearCacheDescriptionId = useId();

  const userMenu: MenuEntry[] = useMemo(
    () => [
      {
        kind: 'item',
        id: 'logout',
        label: 'Logout',
        icon: <LogoutIcon sx={{ mr: 1 }} />,
        onClick: () => signOut(),
        disabled: !isAuthenticated,
      },
    ],
    [isAuthenticated, signOut]
  );

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
          <UserAvatar
            pictureUrl={auth.user?.profile.picture}
            email={auth.user?.profile.email}
            name={auth.user?.profile.name}
            size={32}
          />
        </Box>
        <Typography>{auth.user?.profile.name ?? 'Login'}</Typography>
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

      <Menu
        anchorEl={themeAnchorEl}
        open={Boolean(themeAnchorEl)}
        onClose={closeThemeMenu}
      >
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

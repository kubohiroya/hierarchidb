import type { ThemeMode } from '@hierarchidb/ui-theme';
import {
  DarkMode as DarkModeIcon,
  DeleteForever as DeleteForeverIcon,
  Engineering as EngineeringIcon,
  Language as LanguageIcon,
  LightMode as LightModeIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  SettingsBrightness as SystemThemeIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useUserMenuView } from './useUserMenuView.js';

interface UserMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenThemeMenu: (anchor: HTMLElement) => void;
  onOpenLanguageMenu: (anchor: HTMLElement) => void;
  onOpenClearDialog: () => void;
  onOpenMaintenance?: () => void;
  onLogin: () => void;
  onMenuExited?: () => void;
  onLogout: () => void;
  isAuthenticated: boolean;
  userName: string;
  userEmail: string;
  themeMode: ThemeMode;
  languageLabel: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  anchorEl,
  onClose,
  onOpenThemeMenu,
  onOpenLanguageMenu,
  onOpenClearDialog,
  onOpenMaintenance,
  onLogin,
  onMenuExited,
  onLogout,
  isAuthenticated,
  userName,
  userEmail,
  themeMode,
  languageLabel,
}) => {
  const view = useUserMenuView({ themeMode, onOpenThemeMenu, onOpenLanguageMenu });

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      TransitionProps={onMenuExited ? { onExited: onMenuExited } : undefined}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Box sx={{ px: 2, py: 1 }}>
        {isAuthenticated ? (
          <>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {userName}
            </Typography>
            {userEmail ? (
              <Typography variant="body2" color="text.secondary" noWrap>
                {userEmail}
              </Typography>
            ) : null}
          </>
        ) : (
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<LoginIcon fontSize="small" />}
            onClick={onLogin}
          >
            {view.t('auth.login', 'Login')}
          </Button>
        )}
      </Box>
      <Divider />

      <MenuItem
        onClick={view.handleThemeMenu}
        aria-label={String(view.t('auth.themeSelection', 'Theme Selection'))}
      >
        <ListItemIcon>
          {themeMode === 'dark' ? (
            <DarkModeIcon fontSize="small" />
          ) : themeMode === 'light' ? (
            <LightModeIcon fontSize="small" />
          ) : (
            <SystemThemeIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={view.t('userMenu.theme.label', 'Theme')}
          secondary={view.themeLabel}
        />
      </MenuItem>

      <MenuItem
        onClick={view.handleLanguageMenu}
        aria-label={String(view.t('auth.languageSelection', 'Language Selection'))}
      >
        <ListItemIcon>
          <LanguageIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={view.t('userMenu.language.label', 'Language')}
          secondary={languageLabel}
        />
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={onOpenClearDialog}
        aria-label={String(view.t('auth.clearAllData', 'Clear All Data'))}
      >
        <ListItemIcon>
          <DeleteForeverIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{view.t('userMenu.clear.label', 'Clear All Data')}</ListItemText>
      </MenuItem>

      {onOpenMaintenance && isAuthenticated ? (
        <MenuItem
          onClick={onOpenMaintenance}
          aria-label={String(view.t('userMenu.maintenance.label', 'IndexedDB Maintenance'))}
        >
          <ListItemIcon>
            <EngineeringIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {view.t('userMenu.maintenance.label', 'IndexedDB Maintenance')}
          </ListItemText>
        </MenuItem>
      ) : null}

      <Divider />

      <MenuItem
        onClick={onLogout}
        aria-label={String(view.t('auth.logout', 'Logout'))}
        disabled={!isAuthenticated}
      >
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{view.t('userMenu.logout', 'Logout')}</ListItemText>
      </MenuItem>
    </Menu>
  );
};

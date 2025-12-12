import {
  DarkMode as DarkModeIcon,
  DeleteForever as DeleteForeverIcon,
  Language as LanguageIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  SettingsBrightness as SystemThemeIcon,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ThemeMode } from '@hierarchidb/ui-theme';
import type React from 'react';

interface UserMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenThemeMenu: (anchor: HTMLElement) => void;
  onOpenLanguageMenu: (anchor: HTMLElement) => void;
  onOpenClearDialog: () => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  themeMode: ThemeMode;
  languageLabel: string;
}

const getThemeLabel = (mode: ThemeMode, t: (key: string, defaultValue?: string) => string) => {
  switch (mode) {
    case 'dark':
      return t('userMenu.theme.dark', 'Dark');
    case 'light':
      return t('userMenu.theme.light', 'Light');
    default:
      return t('userMenu.theme.system', 'System');
  }
};

export const UserMenu: React.FC<UserMenuProps> = ({
  anchorEl,
  onClose,
  onOpenThemeMenu,
  onOpenLanguageMenu,
  onOpenClearDialog,
  onLogout,
  userName,
  userEmail,
  themeMode,
  languageLabel,
}) => {
  const { t } = useTranslation('common');
  const themeLabel = getThemeLabel(themeMode, t);
  const handleThemeMenu = (event: React.MouseEvent<HTMLLIElement>) =>
    onOpenThemeMenu(event.currentTarget as HTMLElement);
  const handleLanguageMenu = (event: React.MouseEvent<HTMLLIElement>) =>
    onOpenLanguageMenu(event.currentTarget as HTMLElement);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {userName}
        </Typography>
        {userEmail ? (
          <Typography variant="body2" color="text.secondary" noWrap>
            {userEmail}
          </Typography>
        ) : null}
      </Box>
      <Divider />

      <MenuItem
        onClick={handleThemeMenu}
        aria-label={String(t('auth.themeSelection', 'Theme Selection'))}
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
        <ListItemText primary={t('userMenu.theme.label', 'Theme')} secondary={themeLabel} />
      </MenuItem>

      <MenuItem
        onClick={handleLanguageMenu}
        aria-label={String(t('auth.languageSelection', 'Language Selection'))}
      >
        <ListItemIcon>
          <LanguageIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('userMenu.language.label', 'Language')} secondary={languageLabel} />
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={onOpenClearDialog}
        aria-label={String(t('auth.clearAllData', 'Clear All Data'))}
      >
        <ListItemIcon>
          <DeleteForeverIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('userMenu.clear.label', 'Clear All Data')}</ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem onClick={onLogout} aria-label={String(t('auth.logout', 'Logout'))}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('userMenu.logout', 'Logout')}</ListItemText>
      </MenuItem>
    </Menu>
  );
};

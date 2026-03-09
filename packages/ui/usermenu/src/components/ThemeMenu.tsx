import type { ThemeMode } from '@hierarchidb/ui-theme';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SystemThemeIcon,
} from '@mui/icons-material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';

interface ThemeMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  themeMode: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
}

export const ThemeMenu: React.FC<ThemeMenuProps> = ({ anchorEl, onClose, themeMode, onSelect }) => {
  const { t } = useTranslation('common');

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem selected={themeMode === 'system'} onClick={() => onSelect('system')}>
        <ListItemIcon>
          <SystemThemeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('userMenu.theme.system', 'System')}</ListItemText>
      </MenuItem>
      <MenuItem selected={themeMode === 'light'} onClick={() => onSelect('light')}>
        <ListItemIcon>
          <LightModeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('userMenu.theme.light', 'Light')}</ListItemText>
      </MenuItem>
      <MenuItem selected={themeMode === 'dark'} onClick={() => onSelect('dark')}>
        <ListItemIcon>
          <DarkModeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('userMenu.theme.dark', 'Dark')}</ListItemText>
      </MenuItem>
    </Menu>
  );
};

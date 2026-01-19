import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { LanguageSelection } from './useUserMenu.js';

export interface LanguageOption {
  code: string;
  name?: string;
  nativeName?: string;
  flag?: string;
  isSystem?: boolean;
}

interface LanguageMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  languageSelection: LanguageSelection;
  languages: LanguageOption[];
  onSelect: (code: LanguageSelection) => void;
}

export const LanguageMenu: React.FC<LanguageMenuProps> = ({
  anchorEl,
  onClose,
  languageSelection,
  languages,
  onSelect,
}) => {
  const { t } = useTranslation('common');

  const renderLabel = (lang: LanguageOption) => {
    if (lang.isSystem) {
      return t('userMenu.language.system', 'System default');
    }
    return lang.nativeName || lang.name || lang.code;
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {languages.map((lang) => (
        <MenuItem
          key={lang.code}
          selected={languageSelection === lang.code}
          onClick={() => onSelect(lang.code as LanguageSelection)}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {lang.flag ? <span>{lang.flag}</span> : null}
          </ListItemIcon>
          <ListItemText
            primary={renderLabel(lang)}
            secondary={!lang.isSystem && lang.name !== lang.nativeName ? lang.name : undefined}
          />
        </MenuItem>
      ))}
    </Menu>
  );
};

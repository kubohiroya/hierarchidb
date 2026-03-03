import type { ThemeMode } from '@hierarchidb/ui-theme';
import type React from 'react';
import { useTranslation } from 'react-i18next';

interface UseUserMenuViewArgs {
  themeMode: ThemeMode;
  onOpenThemeMenu: (anchor: HTMLElement) => void;
  onOpenLanguageMenu: (anchor: HTMLElement) => void;
}

const getThemeLabel = (
  mode: ThemeMode,
  t: (key: string, defaultValue?: string) => string
) => {
  switch (mode) {
    case 'dark':
      return t('userMenu.theme.dark', 'Dark');
    case 'light':
      return t('userMenu.theme.light', 'Light');
    default:
      return t('userMenu.theme.system', 'System');
  }
};

export const useUserMenuView = ({
  themeMode,
  onOpenThemeMenu,
  onOpenLanguageMenu,
}: UseUserMenuViewArgs) => {
  const { t } = useTranslation('common');
  const themeLabel = getThemeLabel(themeMode, t);

  const handleThemeMenu = (event: React.MouseEvent<HTMLLIElement>) =>
    onOpenThemeMenu(event.currentTarget as HTMLElement);
  const handleLanguageMenu = (event: React.MouseEvent<HTMLLIElement>) =>
    onOpenLanguageMenu(event.currentTarget as HTMLElement);

  return {
    t,
    themeLabel,
    handleThemeMenu,
    handleLanguageMenu,
  };
};

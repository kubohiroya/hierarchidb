import type { TFunction } from '@hierarchidb/ui-i18n';
import { useMemo, useState } from 'react';
import type React from 'react';
import type { OpenMaintenanceContext } from './UserLoginButton.js';
import type { LanguageOption } from './LanguageMenu.js';
import type { useUserMenu } from './useUserMenu.js';

const buildLanguageOptions = (
  supportedLanguages: Array<{ code: string; name?: string; nativeName?: string; flag?: string }>,
  t: TFunction<'common'>
): LanguageOption[] => {
  const systemOption: LanguageOption = {
    code: 'system',
    name: String(t('userMenu.language.system', 'System default')),
    nativeName: String(t('userMenu.language.system', 'System default')),
    flag: '🖥️',
    isSystem: true,
  };
  const mapped = supportedLanguages.map<LanguageOption>((lang) => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    flag: lang.flag,
  }));
  return [systemOption, ...mapped];
};

interface UseUserLoginButtonViewArgs {
  menu: ReturnType<typeof useUserMenu>;
  t: TFunction<'common'>;
  onOpenMaintenance?: (context: OpenMaintenanceContext) => void;
}

export const useUserLoginButtonView = ({
  menu,
  t,
  onOpenMaintenance,
}: UseUserLoginButtonViewArgs) => {
  const [pendingAuthDialogOpen, setPendingAuthDialogOpen] = useState(false);

  const languageOptions = useMemo(
    () => buildLanguageOptions(menu.supportedLanguages, t),
    [menu.supportedLanguages, t]
  );

  const languageLabel = useMemo(() => {
    if (menu.languageSelection === 'system') {
      return t('userMenu.language.system', 'System default');
    }
    const matched = languageOptions.find((lang) => lang.code === menu.languageSelection);
    return matched?.nativeName || matched?.name || menu.languageSelection;
  }, [languageOptions, menu.languageSelection, t]);

  const handleClearDatabase = async () => {
    try {
      await menu.handleClearDatabase();
    } catch {
      alert(t('userMenu.clear.error', 'Failed to clear some cache data. Please try again.'));
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    menu.openUserMenu(event.currentTarget as HTMLElement);
  };

  const handleMenuClose = () => {
    if (menu.userMenuAnchorEl) {
      menu.userMenuAnchorEl.blur();
    }
    menu.closeUserMenu();
  };

  const handleLogin = () => {
    setPendingAuthDialogOpen(true);
    handleMenuClose();
  };

  const handleMenuExited = () => {
    if (!pendingAuthDialogOpen) return;
    setPendingAuthDialogOpen(false);
    menu.openAuthDialog();
  };

  const handleOpenMaintenance = () => {
    onOpenMaintenance?.({
      userEmail: menu.userEmail || null,
      isAuthenticated: menu.isAuthenticated,
    });
    handleMenuClose();
  };

  return {
    languageOptions,
    languageLabel,
    handleClearDatabase,
    handleOpenMenu,
    handleMenuClose,
    handleLogin,
    handleMenuExited,
    handleOpenMaintenance,
  };
};

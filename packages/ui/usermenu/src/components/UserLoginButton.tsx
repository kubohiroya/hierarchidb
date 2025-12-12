import { AuthProviderDialog, UserAvatar } from '@hierarchidb/ui-auth';
import LoginIcon from '@mui/icons-material/Login';
import { IconButton } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearDatabaseDialog } from './ClearDatabaseDialog.js';
import { LanguageMenu, type LanguageOption } from './LanguageMenu.js';
import { ThemeMenu } from './ThemeMenu.js';
import { UserMenu } from './UserMenu.js';
import { useUserMenu } from './useUserMenu.js';

const buildLanguageOptions = (
  supportedLanguages: Array<{ code: string; name?: string; nativeName?: string; flag?: string }>,
  t: (key: string, defaultValue?: string) => string
): LanguageOption[] => {
  const systemOption: LanguageOption = {
    code: 'system',
    name: t('userMenu.language.system', 'System default'),
    nativeName: t('userMenu.language.system', 'System default'),
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

export const UserLoginButton: React.FC = () => {
  const { t } = useTranslation('common');
  const menu = useUserMenu();

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

  if (!menu.themeContextAvailable || !menu.hasDom) return null;

  if (menu.isLoading) {
    return (
      <IconButton
        disabled
        sx={{ bgcolor: 'grey.300', color: 'grey.600', borderRadius: '50%' }}
        aria-label={String(t('userMenu.loading', 'Loading authentication...'))}
      >
        <LoginIcon />
      </IconButton>
    );
  }

  if (!menu.isAuthenticated) {
    return (
      <>
        <IconButton
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.blur();
            setTimeout(() => menu.openAuthDialog(), 0);
          }}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' },
            borderRadius: '50%',
          }}
          aria-label={String(t('auth.login', 'Login'))}
        >
          <LoginIcon />
        </IconButton>
        <AuthProviderDialog
          open={menu.authProviderDialogOpen}
          onClose={menu.closeAuthDialog}
          onSelectProvider={menu.signInWithProvider}
        />
      </>
    );
  }

  const handleClearDatabase = async () => {
    try {
      await menu.handleClearDatabase();
    } catch {
      alert(t('userMenu.clear.error', 'Failed to clear some cache data. Please try again.'));
    }
  };

  return (
    <>
      <IconButton
        onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
          menu.openUserMenu(e.currentTarget as HTMLElement)
        }
        sx={{ p: 0 }}
        aria-label={String(t('userMenu.aria.userMenu', 'User menu'))}
      >
        <UserAvatar pictureUrl={menu.avatarUrl} email={menu.userEmail} name={menu.userName} size={40} />
      </IconButton>

      <UserMenu
        anchorEl={menu.userMenuAnchorEl}
        onClose={menu.closeUserMenu}
        onOpenThemeMenu={menu.openThemeMenu}
        onOpenLanguageMenu={menu.openLanguageMenu}
        onOpenClearDialog={menu.openClearDatabaseDialog}
        onLogout={menu.handleLogout}
        userName={menu.userName}
        userEmail={menu.userEmail}
        themeMode={menu.themeMode}
        languageLabel={languageLabel}
      />

      <ThemeMenu
        anchorEl={menu.themeMenuAnchorEl}
        onClose={menu.closeThemeMenu}
        themeMode={menu.themeMode}
        onSelect={menu.applyTheme}
      />

      <LanguageMenu
        anchorEl={menu.languageMenuAnchorEl}
        onClose={menu.closeLanguageMenu}
        languageSelection={menu.languageSelection}
        languages={languageOptions}
        onSelect={menu.applyLanguage}
      />

      <ClearDatabaseDialog
        open={menu.clearDatabaseDialogOpen}
        titleId={menu.clearDatabaseDialogTitleId}
        descriptionId={menu.clearDatabaseDialogDescriptionId}
        onClose={menu.closeClearDatabaseDialog}
        onConfirm={handleClearDatabase}
      />
    </>
  );
};

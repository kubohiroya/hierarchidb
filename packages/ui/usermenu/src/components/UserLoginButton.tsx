import { AuthProviderDialog, UserAvatar } from '@hierarchidb/ui-auth';
import LoginIcon from '@mui/icons-material/Login';
import { IconButton } from '@mui/material';
import type React from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { ClearDatabaseDialog } from './ClearDatabaseDialog.js';
import { LanguageMenu } from './LanguageMenu.js';
import { ThemeMenu } from './ThemeMenu.js';
import { UserMenu } from './UserMenu.js';
import { useUserLoginButtonView } from './useUserLoginButtonView.js';
import { useUserMenu } from './useUserMenu.js';

export interface OpenMaintenanceContext {
  userEmail: string | null;
  isAuthenticated: boolean;
}

interface UserLoginButtonProps {
  onOpenMaintenance?: (context: OpenMaintenanceContext) => void;
}

export const UserLoginButton: React.FC<UserLoginButtonProps> = ({ onOpenMaintenance }) => {
  const { t } = useTranslation('common');
  const menu = useUserMenu();
  const view = useUserLoginButtonView({ menu, t, onOpenMaintenance });

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

  return (
    <>
      <IconButton
        onClick={view.handleOpenMenu}
        sx={
          menu.isAuthenticated
            ? { p: 0 }
            : {
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
                borderRadius: '50%',
              }
        }
        aria-label={
          menu.isAuthenticated
            ? String(t('userMenu.aria.userMenu', 'User menu'))
            : String(t('auth.login', 'Login'))
        }
      >
        {menu.isAuthenticated ? (
          <UserAvatar
            pictureUrl={menu.avatarUrl}
            email={menu.userEmail}
            name={menu.userName}
            size={40}
          />
        ) : (
          <LoginIcon />
        )}
      </IconButton>

      <UserMenu
        anchorEl={menu.userMenuAnchorEl}
        onClose={view.handleMenuClose}
        onOpenThemeMenu={menu.openThemeMenu}
        onOpenLanguageMenu={menu.openLanguageMenu}
        onOpenClearDialog={menu.openClearDatabaseDialog}
        onOpenMaintenance={onOpenMaintenance ? view.handleOpenMaintenance : undefined}
        onLogin={view.handleLogin}
        onMenuExited={view.handleMenuExited}
        onLogout={menu.handleLogout}
        isAuthenticated={menu.isAuthenticated}
        userName={menu.userName}
        userEmail={menu.userEmail}
        themeMode={menu.themeMode}
        languageLabel={view.languageLabel}
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
        languages={view.languageOptions}
        onSelect={menu.applyLanguage}
      />

      <ClearDatabaseDialog
        open={menu.clearDatabaseDialogOpen}
        titleId={menu.clearDatabaseDialogTitleId}
        descriptionId={menu.clearDatabaseDialogDescriptionId}
        onClose={menu.closeClearDatabaseDialog}
        onConfirm={view.handleClearDatabase}
      />

      <AuthProviderDialog
        open={menu.authProviderDialogOpen}
        onClose={menu.closeAuthDialog}
        onSelectProvider={menu.signInWithProvider}
      />
    </>
  );
};

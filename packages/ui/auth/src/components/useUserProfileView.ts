import { useId, useMemo } from 'react';
import type { AuthContextProps } from 'react-oidc-context';

export interface UserProfileMenuEntry {
  id: string;
  label: string;
  disabled: boolean;
}

export interface UseUserProfileViewResult {
  menuId: string;
  clearCacheTitleId: string;
  clearCacheDescriptionId: string;
  userMenu: UserProfileMenuEntry[];
  displayName: string;
  pictureUrl: string | undefined;
  email: string | undefined;
  name: string | undefined;
}

export function useUserProfileView(
  auth: AuthContextProps,
  isAuthenticated: boolean
): UseUserProfileViewResult {
  const menuId = useId();
  const clearCacheTitleId = useId();
  const clearCacheDescriptionId = useId();

  const userMenu = useMemo<UserProfileMenuEntry[]>(
    () => [
      {
        id: 'logout',
        label: 'Logout',
        disabled: !isAuthenticated,
      },
    ],
    [isAuthenticated]
  );

  return {
    menuId,
    clearCacheTitleId,
    clearCacheDescriptionId,
    userMenu,
    displayName: auth.user?.profile.name ?? 'Login',
    pictureUrl: auth.user?.profile.picture,
    email: auth.user?.profile.email,
    name: auth.user?.profile.name,
  };
}

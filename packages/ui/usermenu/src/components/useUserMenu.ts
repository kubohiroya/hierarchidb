import { type AuthProviderType, useAuth } from '@hierarchidb/ui-auth';
import { detectUserLanguage, useLanguage } from '@hierarchidb/ui-i18n';
import type { ThemeMode } from '@hierarchidb/ui-theme';
import { ThemeContext } from '@hierarchidb/ui-theme';
import { isRetainedLegacyYamlDatabaseName } from '@hierarchidb/util';
import { useCallback, useContext, useEffect, useId, useState } from 'react';
import { createProviderSignInHandler } from './createProviderSignInHandler.js';

export type LanguageSelection = 'system' | string;

type LanguageConfig = ReturnType<typeof useLanguage>['supportedLanguages'][number];

const createSafeFileName = (key: string) =>
  btoa(unescape(encodeURIComponent(key))).replace(/=+/g, '');

export interface UserMenuState {
  hasDom: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  themeMode: ThemeMode;
  languageSelection: LanguageSelection;
  supportedLanguages: LanguageConfig[];
  currentLanguageCode: string;
  authProviderDialogOpen: boolean;
  clearDatabaseDialogOpen: boolean;
  userMenuAnchorEl: HTMLElement | null;
  themeMenuAnchorEl: HTMLElement | null;
  languageMenuAnchorEl: HTMLElement | null;
  clearDatabaseDialogTitleId: string;
  clearDatabaseDialogDescriptionId: string;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  openUserMenu: (anchor: HTMLElement) => void;
  closeUserMenu: () => void;
  openClearDatabaseDialog: () => void;
  closeClearDatabaseDialog: () => void;
  openThemeMenu: (anchor: HTMLElement) => void;
  closeThemeMenu: () => void;
  openLanguageMenu: (anchor: HTMLElement) => void;
  closeLanguageMenu: () => void;
  applyTheme: (mode: ThemeMode) => void;
  applyLanguage: (code: LanguageSelection) => Promise<void>;
  handleLogout: () => Promise<void> | void;
  handleClearDatabase: () => Promise<void>;
  themeContextAvailable: boolean;
  signInWithProvider: (provider: AuthProviderType) => void;
  userPicture?: string;
}

export const useUserMenu = (): UserMenuState => {
  const hasDom =
    typeof document !== 'undefined' && typeof window !== 'undefined' && !!document.body;
  const { user, signIn, signOut, auth } = useAuth();
  const themeContext = useContext(ThemeContext);
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [authProviderDialogOpen, setAuthProviderDialogOpen] = useState(false);
  const [clearDatabaseDialogOpen, setClearDatabaseDialogOpen] = useState(false);
  const [themeMenuAnchorEl, setThemeMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = useState<HTMLElement | null>(null);
  const clearDatabaseDialogTitleId = useId();
  const clearDatabaseDialogDescriptionId = useId();

  const userEmail = user?.profile?.email || '';
  const userName = user?.profile?.name || userEmail || 'User';
  const userPicture = user?.profile?.picture;

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(userPicture || undefined);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return themeContext?.mode ?? 'system';
    const stored = localStorage.getItem('app.theme');
    return (stored as ThemeMode) || themeContext?.mode || 'system';
  });
  const [languageSelection, setLanguageSelection] = useState<LanguageSelection>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = (localStorage.getItem('app.lang') ||
      localStorage.getItem('preferred-language')) as LanguageSelection | null;
    return stored || currentLanguage.code || 'system';
  });

  // Avatar OPFS cache
  useEffect(() => {
    if (!hasDom) return undefined;
    let revokedUrl: string | undefined;
    let aborted = false;
    const run = async () => {
      const pictureUrl = userPicture;
      if (!pictureUrl) {
        setAvatarUrl(undefined);
        return;
      }
      const storageAny = (navigator as { storage?: { getDirectory?: () => Promise<unknown> } })
        .storage;
      if (!storageAny?.getDirectory) {
        setAvatarUrl(pictureUrl);
        return;
      }
      try {
        const root = (await storageAny.getDirectory()) as FileSystemDirectoryHandle;
        const dir = await root.getDirectoryHandle('avatars', { create: true });
        const fileName = `${createSafeFileName(userEmail || userName || 'user')}.bin`;
        try {
          const fileHandle = await dir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          if (!aborted) {
            revokedUrl = url;
            setAvatarUrl(url);
            return;
          }
        } catch {
          // cache miss
        }
        const res = await fetch(pictureUrl, { mode: 'cors' });
        if (!res.ok) {
          setAvatarUrl(pictureUrl);
          return;
        }
        const blob = await res.blob();
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        const url = URL.createObjectURL(blob);
        if (!aborted) {
          revokedUrl = url;
          setAvatarUrl(url);
        }
      } catch {
        setAvatarUrl(pictureUrl);
      }
    };
    void run();
    return () => {
      aborted = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [hasDom, userEmail, userName, userPicture]);

  const applyTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      themeContext?.setMode(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem('app.theme', mode);
        window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
      }
      setThemeMenuAnchorEl(null);
      setUserMenuAnchorEl(null);
    },
    [themeContext]
  );

  const applyLanguage = useCallback(
    async (code: LanguageSelection) => {
      setLanguageSelection(code);
      const targetCode = code === 'system' ? detectUserLanguage() : code;
      try {
        await changeLanguage(targetCode);
      } catch {
        // no-op; changeLanguage handles its own logging
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('app.lang', code);
        localStorage.setItem('preferred-language', targetCode);
        window.dispatchEvent(
          new CustomEvent('hierarchidb-language-change', { detail: { lang: code } })
        );
      }
      setLanguageMenuAnchorEl(null);
      setUserMenuAnchorEl(null);
    },
    [changeLanguage]
  );

  const handleLogout = async () => {
    signOut();
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token_id');
    } catch {
      // ignore storage errors
    }
    setUserMenuAnchorEl(null);
  };

  const handleClearDatabase = async () => {
    if (typeof window === 'undefined') return;
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
      if ('indexedDB' in window && indexedDB.databases) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map((db) => {
            const databaseName = db.name;
            if (databaseName && !isRetainedLegacyYamlDatabaseName(databaseName)) {
              return new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase(databaseName);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
            }
            return Promise.resolve();
          })
        );
      }
      localStorage.clear();
      setClearDatabaseDialogOpen(false);
      window.location.reload();
    } catch {
      throw new Error('clear-database-failed');
    }
  };

  // Keep theme mode in sync with context
  useEffect(() => {
    if (themeContext?.mode && themeContext.mode !== themeMode) {
      setThemeMode(themeContext.mode);
    }
  }, [themeContext?.mode, themeMode]);

  // Keep language selection in sync with currentLanguage
  useEffect(() => {
    const currentCode = currentLanguage.code;
    if (languageSelection !== 'system' && currentCode && currentCode !== languageSelection) {
      setLanguageSelection(currentCode);
    }
  }, [currentLanguage.code, languageSelection]);

  const openAuthDialog = () => setAuthProviderDialogOpen(true);
  const closeAuthDialog = () => setAuthProviderDialogOpen(false);
  const openUserMenu = (anchor: HTMLElement) => setUserMenuAnchorEl(anchor);
  const closeUserMenu = () => {
    setUserMenuAnchorEl(null);
    setThemeMenuAnchorEl(null);
    setLanguageMenuAnchorEl(null);
  };
  const openClearDatabaseDialog = () => {
    setClearDatabaseDialogOpen(true);
    setUserMenuAnchorEl(null);
  };
  const closeClearDatabaseDialog = () => setClearDatabaseDialogOpen(false);
  const openThemeMenu = (anchor: HTMLElement) => setThemeMenuAnchorEl(anchor);
  const closeThemeMenu = () => setThemeMenuAnchorEl(null);
  const openLanguageMenu = (anchor: HTMLElement) => setLanguageMenuAnchorEl(anchor);
  const closeLanguageMenu = () => setLanguageMenuAnchorEl(null);

  const signInWithProvider = createProviderSignInHandler(signIn);

  const themeContextAvailable = Boolean(themeContext);

  const state: UserMenuState = {
    hasDom,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    userName,
    userEmail,
    avatarUrl,
    themeMode,
    languageSelection,
    supportedLanguages,
    currentLanguageCode: currentLanguage.code,
    authProviderDialogOpen,
    clearDatabaseDialogOpen,
    userMenuAnchorEl,
    themeMenuAnchorEl,
    languageMenuAnchorEl,
    clearDatabaseDialogTitleId,
    clearDatabaseDialogDescriptionId,
    openAuthDialog,
    closeAuthDialog,
    openUserMenu,
    closeUserMenu,
    openClearDatabaseDialog,
    closeClearDatabaseDialog,
    openThemeMenu,
    closeThemeMenu,
    openLanguageMenu,
    closeLanguageMenu,
    applyTheme,
    applyLanguage,
    handleLogout,
    handleClearDatabase,
    themeContextAvailable,
    signInWithProvider,
    userPicture,
  };

  return state;
};

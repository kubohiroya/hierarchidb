import { type MouseEvent, useCallback, useEffect, useState } from 'react';
import type { AuthContextProps } from 'react-oidc-context';

type ThemeMode = 'system' | 'light' | 'dark';

interface UseUserAvatarMenuView {
  signIn: () => void;
  signOut: () => void;
  clearCacheDialogOpen: boolean;
  setClearCacheDialogOpen: (open: boolean) => void;
  anchorEl: HTMLElement | null;
  themeAnchorEl: HTMLElement | null;
  languageAnchorEl: HTMLElement | null;
  open: boolean;
  isAuthenticated: boolean;
  themeMode: ThemeMode;
  language: string;
  handleClick: (event: MouseEvent<HTMLElement>) => void;
  handleCloseAll: () => void;
  openThemeMenu: (event: MouseEvent<HTMLElement>) => void;
  closeThemeMenu: () => void;
  openLanguageMenu: (event: MouseEvent<HTMLElement>) => void;
  closeLanguageMenu: () => void;
  selectTheme: (mode: ThemeMode) => void;
  selectLanguage: (lang: string) => void;
  handleClearCache: () => Promise<void>;
  menuButtonTitle: string;
}

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('app.theme');
  if (stored === 'system' || stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'system';
};

const getInitialLanguage = (): string => {
  if (typeof window === 'undefined') return 'system';
  return localStorage.getItem('app.lang') ?? 'system';
};

const deleteIndexedDbDatabases = async (): Promise<{ blocked: string[]; failed: string[] }> => {
  if (!('indexedDB' in window) || typeof indexedDB.databases !== 'function') {
    return { blocked: [], failed: [] };
  }

  const databases = await indexedDB.databases();
  const names = databases
    .map((db) => db.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);

  const results = await Promise.all(
    names.map(
      (name) =>
        new Promise<{ name: string; status: 'deleted' | 'blocked' | 'failed' }>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          let settled = false;

          const finish = (status: 'deleted' | 'blocked' | 'failed') => {
            if (settled) return;
            settled = true;
            resolve({ name, status });
          };

          req.onsuccess = () => finish('deleted');
          req.onerror = () => finish('failed');
          req.onblocked = () => finish('blocked');
        }),
    ),
  );

  return {
    blocked: results.filter((result) => result.status === 'blocked').map((result) => result.name),
    failed: results.filter((result) => result.status === 'failed').map((result) => result.name),
  };
};

export const useUserAvatarMenuView = (auth: AuthContextProps): UseUserAvatarMenuView => {
  const signIn = useCallback(() => {
    void auth.signinRedirect();
  }, [auth]);

  const signOut = useCallback(() => {
    void auth.signoutRedirect();
  }, [auth]);

  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<HTMLElement | null>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<HTMLElement | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [language, setLanguage] = useState<string>(getInitialLanguage);

  const open = Boolean(anchorEl);
  const isAuthenticated = Boolean(auth.user);
  const menuButtonTitle = isAuthenticated
    ? `${auth.user?.profile.name ?? ''} ${auth.user?.profile.email ?? ''}`.trim()
    : 'Login';

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleCloseAll = useCallback(() => {
    setAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
  }, []);

  const openThemeMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setThemeAnchorEl(event.currentTarget);
  }, []);

  const closeThemeMenu = useCallback(() => {
    setThemeAnchorEl(null);
  }, []);

  const openLanguageMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setLanguageAnchorEl(event.currentTarget);
  }, []);

  const closeLanguageMenu = useCallback(() => {
    setLanguageAnchorEl(null);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { mode?: string; lang?: string };
      if (
        detail?.mode &&
        (detail.mode === 'system' || detail.mode === 'light' || detail.mode === 'dark')
      ) {
        setThemeMode(detail.mode);
      }
      if (detail?.lang) {
        setLanguage(detail.lang);
      }
    };

    window.addEventListener('hierarchidb-theme-change', handler);
    window.addEventListener('hierarchidb-language-change', handler);
    return () => {
      window.removeEventListener('hierarchidb-theme-change', handler);
      window.removeEventListener('hierarchidb-language-change', handler);
    };
  }, []);

  const selectTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.theme', mode);
      window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
    }
    setThemeAnchorEl(null);
    setAnchorEl(null);
  }, []);

  const selectLanguage = useCallback((lang: string) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.lang', lang);
      window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } }));
    }
    setLanguageAnchorEl(null);
    setAnchorEl(null);
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      const indexedDbResult = await deleteIndexedDbDatabases();
      localStorage.clear();

      if (indexedDbResult.blocked.length > 0 || indexedDbResult.failed.length > 0) {
        if (import.meta.env.DEV) {
          console.warn('IndexedDB delete blocked/failed:', indexedDbResult);
        }
        alert('Some IndexedDB data could not be cleared. Close other tabs and try again.');
      }

      setClearCacheDialogOpen(false);
      window.location.reload();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to clear cache:', error);
      }
      alert('Failed to clear some cache data. Please try again.');
    }
  }, []);

  return {
    signIn,
    signOut,
    clearCacheDialogOpen,
    setClearCacheDialogOpen,
    anchorEl,
    themeAnchorEl,
    languageAnchorEl,
    open,
    isAuthenticated,
    themeMode,
    language,
    handleClick,
    handleCloseAll,
    openThemeMenu,
    closeThemeMenu,
    openLanguageMenu,
    closeLanguageMenu,
    selectTheme,
    selectLanguage,
    handleClearCache,
    menuButtonTitle,
  };
};

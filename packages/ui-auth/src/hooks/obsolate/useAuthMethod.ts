import { useState, useCallback, useEffect } from 'react';

export type AuthMethod = 'redirect' | 'popup';

const AUTH_METHOD_KEY = 'eria-Auth-method';

export function useAuthMethod() {
  const [authMethod, setAuthMethodState] = useState<AuthMethod>(() => {
    // Load from localStorage
    const stored = localStorage.getItem(AUTH_METHOD_KEY);

    // Default to redirect mode if not set or if popup was causing issues
    if (!stored || stored === 'popup') {
      // Due to COOP issues, default to redirect mode
      localStorage.setItem(AUTH_METHOD_KEY, 'redirect');
      return 'redirect';
    }

    return stored as AuthMethod;
  });

  const setAuthMethod = useCallback((method: AuthMethod) => {
    setAuthMethodState(method);
    localStorage.setItem(AUTH_METHOD_KEY, method);
  }, []);

  useEffect(() => {
    // Sync with storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_METHOD_KEY && e.newValue) {
        if (e.newValue === 'popup' || e.newValue === 'redirect') {
          setAuthMethodState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { authMethod, setAuthMethod };
}

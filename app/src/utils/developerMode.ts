const DEV_MODE_STORAGE_KEY = 'HDB_DEVELOPER_MODE';
const DEV_MODE_QUERY_KEYS = ['developerMode', 'devmode', 'dev'];

const parseBooleanFlag = (value?: string | null): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return undefined;
};

const readStoredFlag = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage?.getItem(DEV_MODE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
};

const setStoredFlag = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage?.setItem(DEV_MODE_STORAGE_KEY, '1');
    } else {
      window.localStorage?.removeItem(DEV_MODE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write errors (private mode, etc.)
  }
};

/**
 * Determine whether developer mode should be enabled.
 * In development builds (`import.meta.env.DEV`) the mode is always enabled.
 * The flag can also be toggled via query parameters (?developerMode=1) or persisted in localStorage.
 */
export function resolveDeveloperMode(search?: string): boolean {
  if (import.meta.env?.DEV) {
    return true;
  }

  const stored = readStoredFlag();
  if (stored === '1') {
    return true;
  }

  if (typeof search === 'string' && search.length > 0) {
    try {
      const params = new URLSearchParams(search);
      for (const key of DEV_MODE_QUERY_KEYS) {
        if (!params.has(key)) continue;
        const parsed = parseBooleanFlag(params.get(key));
        if (parsed === true) {
          setStoredFlag(true);
          return true;
        }
        if (parsed === false) {
          setStoredFlag(false);
          return false;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return false;
}

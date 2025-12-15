export const TREE_CONSOLE_SETTINGS_STORAGE_KEY = 'hdb.treeConsole.settings';

export type TreeConsoleSettings = {
  rowClickAction?: 'Select/Navigate' | 'Edit';
  autosaveEnabled?: boolean;
};

const defaultSettings: Required<Pick<TreeConsoleSettings, 'autosaveEnabled'>> = {
  autosaveEnabled: true,
};

const safeGlobal = (): typeof window | null => {
  if (typeof window === 'undefined') return null;
  return window;
};

export function loadTreeConsoleSettings(): TreeConsoleSettings {
  const global = safeGlobal();
  if (!global?.localStorage) return { ...defaultSettings };

  try {
    const raw = global.localStorage.getItem(TREE_CONSOLE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<TreeConsoleSettings> | null;
    const rowClickAction =
      parsed?.rowClickAction === 'Edit' || parsed?.rowClickAction === 'Select/Navigate'
        ? parsed.rowClickAction
        : undefined;
    const autosaveEnabled =
      typeof parsed?.autosaveEnabled === 'boolean'
        ? parsed.autosaveEnabled
        : defaultSettings.autosaveEnabled;
    return { rowClickAction, autosaveEnabled };
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[treeConsoleSettings] failed to parse settings; using defaults', err);
    }
    return { ...defaultSettings };
  }
}

export function saveTreeConsoleSettings(patch: Partial<TreeConsoleSettings>): TreeConsoleSettings {
  const global = safeGlobal();
  const current = loadTreeConsoleSettings();
  const next: TreeConsoleSettings = {
    rowClickAction: patch.rowClickAction ?? current.rowClickAction,
    autosaveEnabled:
      patch.autosaveEnabled !== undefined ? patch.autosaveEnabled : current.autosaveEnabled,
  };

  if (!global?.localStorage) return next;

  try {
    global.localStorage.setItem(TREE_CONSOLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[treeConsoleSettings] failed to save settings; continuing with memory copy', err);
    }
  }
  return next;
}

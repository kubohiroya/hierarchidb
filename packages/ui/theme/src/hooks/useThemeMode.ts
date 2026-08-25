import { useContext } from 'react';

import { ThemeContext } from '~/components/ThemeContext';
import type { ThemeContextType } from '~/types';

const isProductionRuntime = (): boolean => {
  try {
    const meta = import.meta as ImportMeta & {
      env?: { MODE?: unknown; NODE_ENV?: unknown; PROD?: unknown };
    };
    if (meta.env?.PROD === true || meta.env?.PROD === 'true') {
      return true;
    }
    const importMode = meta.env?.MODE ?? meta.env?.NODE_ENV;
    if (typeof importMode === 'string') {
      return importMode === 'production';
    }
  } catch {
    // Non-ESM test harnesses can evaluate without import.meta support.
  }

  const globalScope = typeof globalThis === 'undefined' ? undefined : globalThis;
  const maybeProcess = globalScope as
    | { process?: { env?: { NODE_ENV?: unknown } }; __HDB_ENV__?: { MODE?: unknown } }
    | undefined;
  const nodeEnv = maybeProcess?.process?.env?.NODE_ENV;
  if (typeof nodeEnv === 'string') {
    return nodeEnv === 'production';
  }
  const mode = maybeProcess?.__HDB_ENV__?.MODE;
  return typeof mode === 'string' && mode === 'production';
};

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    const systemPrefersDark =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;

    if (!isProductionRuntime()) {
      console.warn(
        '[ui-theme] useThemeMode invoked outside ThemeProvider; using system preference fallback.'
      );
    }

    return {
      mode: 'system',
      actualTheme: systemPrefersDark ? 'dark' : 'light',
      setMode: () => {
        if (!isProductionRuntime()) {
          console.warn('[ui-theme] setMode called without ThemeProvider; request ignored.');
        }
      },
    };
  }
  return context;
};

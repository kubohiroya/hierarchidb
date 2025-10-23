import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction, TOptions, i18n as I18nInstance } from 'i18next';
import { i18n as configuredI18n } from '../i18n/index.js';

interface TranslatorOptions {
  namespaces?: string[];
  tOptions?: TOptions;
}

const DEFAULT_NAMESPACES = ['common', 'translation'] as const;
const FALLBACK_LANGUAGE = 'default';

function resolveI18n(): I18nInstance {
  return configuredI18n;
}

export function useGlobalI18nTranslator(options: TranslatorOptions = {}) {
  const namespaces = options.namespaces ?? DEFAULT_NAMESPACES;
  const baseOptions = options.tOptions ?? { ns: namespaces };
  const i18n = resolveI18n();

  const [language, setLanguage] = useState(() => {
    const code = i18n.language ?? i18n.resolvedLanguage;
    return code || FALLBACK_LANGUAGE;
  });

  useEffect(() => {
    const handler = (lng: string) => {
      setLanguage(lng || FALLBACK_LANGUAGE);
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n]);

  const translator = useCallback(
    (key: string, fallback: string): string => {
      if (typeof i18n.t !== 'function') {
        return fallback;
      }

      const t = i18n.t as TFunction;
      const value = t(key, { defaultValue: fallback, ...baseOptions });

      if (typeof value === 'string') {
        if (value === key && fallback) {
          return fallback;
        }
        return value;
      }

      return fallback;
    },
    [i18n, baseOptions, language],
  );

  return useMemo(() => ({ t: translator, language }), [translator, language]);
}

export type GlobalI18nTranslator = ReturnType<typeof useGlobalI18nTranslator>;

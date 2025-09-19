import { useEffect } from 'react';

type LanguageBridgeWindow = Window & {
  i18next?: {
    changeLanguage?: (lang: string) => unknown;
  };
};

export function LanguageEventsBridge() {
  useEffect(() => {
    // Initialize from stored value
    const stored = localStorage.getItem('app.lang') || localStorage.getItem('i18nextLng');
    if (stored) {
      if (typeof document !== 'undefined') document.documentElement.lang = stored;
      const bridgeWindow = window as LanguageBridgeWindow;
      bridgeWindow.i18next?.changeLanguage?.(stored);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lang?: string } | undefined;
      const lang = detail?.lang;
      if (!lang) return;
      localStorage.setItem('preferred-language', lang);
      localStorage.setItem('i18nextLng', lang);
      if (typeof document !== 'undefined') document.documentElement.lang = lang;
      const bridgeWindow = window as LanguageBridgeWindow;
      bridgeWindow.i18next?.changeLanguage?.(lang);
    };
    window.addEventListener('hierarchidb-language-change', handler as EventListener);
    return () => window.removeEventListener('hierarchidb-language-change', handler as EventListener);
  }, []);

  return null;
}

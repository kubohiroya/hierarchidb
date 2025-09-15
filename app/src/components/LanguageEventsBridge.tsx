import { useEffect } from 'react';

export function LanguageEventsBridge() {
  useEffect(() => {
    // Initialize from stored value
    const stored = localStorage.getItem('app.lang') || localStorage.getItem('i18nextLng');
    if (stored) {
      if (typeof document !== 'undefined') document.documentElement.lang = stored;
      const anyWindow = window as any;
      if (anyWindow?.i18next?.changeLanguage) {
        anyWindow.i18next.changeLanguage(stored);
      }
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lang?: string } | undefined;
      const lang = detail?.lang;
      if (!lang) return;
      localStorage.setItem('preferred-language', lang);
      localStorage.setItem('i18nextLng', lang);
      if (typeof document !== 'undefined') document.documentElement.lang = lang;
      const anyWindow = window as any;
      if (anyWindow?.i18next?.changeLanguage) {
        anyWindow.i18next.changeLanguage(lang);
      }
    };
    window.addEventListener('hierarchidb-language-change', handler as EventListener);
    return () => window.removeEventListener('hierarchidb-language-change', handler as EventListener);
  }, []);

  return null;
}

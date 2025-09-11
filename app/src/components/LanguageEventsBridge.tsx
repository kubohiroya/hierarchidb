import { useEffect } from 'react';

export function LanguageEventsBridge() {
  useEffect(() => {
    // Initialize from stored value
    try {
      const stored = localStorage.getItem('app.lang') || localStorage.getItem('i18nextLng');
      if (stored) {
        if (typeof document !== 'undefined') document.documentElement.lang = stored;
        const anyWindow = window as any;
        if (anyWindow?.i18next?.changeLanguage) {
          anyWindow.i18next.changeLanguage(stored);
        }
      }
    } catch {}

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lang?: string } | undefined;
      const lang = detail?.lang;
      if (!lang) return;
      try {
        localStorage.setItem('preferred-language', lang);
        localStorage.setItem('i18nextLng', lang);
      } catch {}
      try {
        if (typeof document !== 'undefined') document.documentElement.lang = lang;
      } catch {}
      try {
        const anyWindow = window as any;
        if (anyWindow?.i18next?.changeLanguage) {
          anyWindow.i18next.changeLanguage(lang);
        }
      } catch {}
    };
    window.addEventListener('hierarchidb-language-change', handler as EventListener);
    return () => window.removeEventListener('hierarchidb-language-change', handler as EventListener);
  }, []);

  return null;
}

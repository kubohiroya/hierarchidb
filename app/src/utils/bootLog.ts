export function bootLog(...args: any[]) {
  try {
    const isDev = !!(import.meta as any)?.env?.DEV;
    const want = (() => {
      try {
        const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        return qs?.get('debug') === 'init';
      } catch {
        return false;
      }
    })();
    if (want || isDev === true && false) {
      // In development we keep this disabled by default; enable only via ?debug=init
      // eslint-disable-next-line no-console
      console.log('[HDB-BOOT]', ...args);
    }
  } catch {}
}


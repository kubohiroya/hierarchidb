export function bootLog(..._args: unknown[]): void {
  const isDev = Boolean(import.meta.env?.DEV);
  const want = shouldLog();
  if (!want && !isDev) return;
  // In development we keep this disabled by default; enable only via ?debug=init
}

function shouldLog(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const qs = new URLSearchParams(window.location.search);
    return qs.get('debug') === 'init';
  } catch {
    return false;
  }
}

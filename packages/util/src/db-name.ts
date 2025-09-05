export function resolveDbPrefix(): string {
  const fromNode = typeof process !== 'undefined' ? (process.env.WORKER_DB_PREFIX || process.env.VITE_APP_PREFIX) : '';
  let fromVite = '';
  try {
    // Access Vite env if available (in ESM builds). This will be tree-shaken where not supported.
    // eslint-disable-next-line no-undef
    // @ts-ignore
    fromVite = (import.meta as any)?.env?.VITE_APP_PREFIX || '';
  } catch {
    // ignore if import.meta is not supported in this environment
  }
  return (fromNode || fromVite || 'hidb').trim();
}

export function getDBName(suffix: string, prefix?: string): string {
  const p = (prefix ?? resolveDbPrefix()).replace(/\s+/g, '-');
  return `${p}-${suffix}`;
}

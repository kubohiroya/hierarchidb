export function resolveDbPrefix(): string {
  let fromVite = '';
  try {
    // Access Vite env if available (in ESM builds). This will be tree-shaken where not supported.
    // eslint-disable-next-line no-undef
    // @ts-ignore
    fromVite = (import.meta as any)?.env?.VITE_APP_PREFIX || '';
  } catch {
    // ignore if import.meta is not supported in this environment
  }
  // Global override for tests or bootstrap
  const fromGlobal = (globalThis as any)?.FEATURE_FLAGS?.WORKER_DB_PREFIX || (globalThis as any)?.APP_PREFIX || '';
  return (fromGlobal || fromVite || 'hidb').trim();
}

export function getDBName(suffix: string, prefix?: string): string {
  const p = (prefix ?? resolveDbPrefix()).replace(/\s+/g, '-');
  return `${p}-${suffix}`;
}

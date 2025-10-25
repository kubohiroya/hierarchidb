interface EnvRecord {
  [key: string]: unknown;
}

interface HierarchidbGlobal {
  APP_PREFIX?: unknown;
}

const readVitePrefix = (): string => {
  try {
    const meta = import.meta as ImportMeta & { env?: EnvRecord };
    const prefix = meta.env?.VITE_APP_PREFIX;
    return typeof prefix === 'string' ? prefix : '';
  } catch {
    // ignore if import.meta is not supported in this environment
    return '';
  }
};

const readGlobalPrefix = (): string => {
  const candidate = globalThis as HierarchidbGlobal;
  const fromAppPrefix = candidate.APP_PREFIX;
  return typeof fromAppPrefix === 'string' ? fromAppPrefix : '';
};

export function resolveDbPrefix(): string {
  const fromGlobal = readGlobalPrefix();
  const fromVite = readVitePrefix();
  return (fromGlobal || fromVite || 'hidb').trim();
}

export function getDBName(suffix: string, prefix?: string): string {
  const p = (prefix ?? resolveDbPrefix()).replace(/\s+/g, '-');
  return `${p}-${suffix}`;
}

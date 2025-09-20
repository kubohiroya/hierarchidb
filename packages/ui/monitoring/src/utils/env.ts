/**
 * Utility helpers to safely inspect Vite-style import.meta.env flags in browser contexts.
 */

export type EnvRecord = Record<string, unknown>;

const readEnv = (): EnvRecord | undefined => {
  try {
    const meta = import.meta as ImportMeta & { env?: EnvRecord };
    if (meta && typeof meta.env === 'object') {
      return meta.env;
    }
  } catch {
    // Ignore environments without import.meta.
  }
  return undefined;
};

const readEnvBoolean = (key: string): boolean => {
  const env = readEnv();
  const value = env?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
};

export const isDevEnv = (): boolean => readEnvBoolean('DEV');

export const isProdEnv = (): boolean => readEnvBoolean('PROD');

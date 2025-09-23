type EnvRecord = Record<string, unknown>;

const readEnv = (): EnvRecord | undefined => {
  try {
    const meta = import.meta as ImportMeta & { env?: EnvRecord };
    if (meta?.env && typeof meta.env === 'object') {
      return meta.env;
    }
  } catch {
    // ignore
  }

  const globalCandidate = globalThis as { __HIERARCHI_ENV__?: EnvRecord };
  if (globalCandidate.__HIERARCHI_ENV__ && typeof globalCandidate.__HIERARCHI_ENV__ === 'object') {
    return globalCandidate.__HIERARCHI_ENV__;
  }
  return undefined;
};

export const isDev = (): boolean => Boolean(readEnv()?.DEV);

export const isProd = (): boolean => Boolean(readEnv()?.PROD);

export const mode = (): string | undefined => {
  const value = readEnv()?.MODE;
  return typeof value === 'string' ? value : undefined;
};

export const getEnv = <T = string>(key: string): T | undefined => {
  const env = readEnv();
  if (!env) return undefined;
  return env[key] as T | undefined;
};

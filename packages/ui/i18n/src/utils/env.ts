export type EnvRecord = Record<string, unknown>;

interface AppWindow extends Window {
  __HDB_ENV__?: EnvRecord;
}

const readEnvRecord = (): EnvRecord | undefined => {
  try {
    const meta = import.meta as ImportMeta & { env?: EnvRecord };
    if (meta?.env && typeof meta.env === 'object') {
      return meta.env;
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    const candidate = (window as AppWindow).__HDB_ENV__;
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }

  return undefined;
};

export const getEnvString = (key: string): string | undefined => {
  const env = readEnvRecord();
  const value = env?.[key];
  return typeof value === 'string' ? value : undefined;
};

export const isDevEnv = (): boolean => {
  const mode = getEnvString('MODE');
  if (mode) {
    return mode.toLowerCase() === 'development';
  }
  const devFlag = getEnvString('DEV');
  return devFlag === 'true' || devFlag === '1';
};

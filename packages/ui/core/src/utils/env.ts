export const isDev = (): boolean => {
  try {
    return Boolean((globalThis as any)?.import?.meta?.env?.DEV);
  } catch {
    return false;
  }
};

export const isProd = (): boolean => {
  try {
    return Boolean((globalThis as any)?.import?.meta?.env?.PROD);
  } catch {
    return false;
  }
};

export const mode = (): string | undefined => {
  try {
    return (globalThis as any)?.import?.meta?.env?.MODE;
  } catch {
    return undefined;
  }
};

export const getEnv = <T = string>(key: string): T | undefined => {
  try {
    return (globalThis as any)?.import?.meta?.env?.[key];
  } catch {
    return undefined;
  }
};


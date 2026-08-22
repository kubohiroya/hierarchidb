const DEFAULT_E2E_PORT = '4200';
const DEFAULT_E2E_APP_NAME = 'hierarchidb';

export type E2ERouterMode = 'hash' | 'browser';

export type E2EUrlContract = {
  readonly appName: string;
  readonly baseURL: string;
  readonly baseURLWithSlash: string;
  readonly routerMode: E2ERouterMode;
  readonly isHashRouter: boolean;
};

export const normalizeAppBasePath = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^\/+|\/+$/g, '');
};

const resolveAppName = (): string =>
  normalizeAppBasePath(
    process.env.VITE_APP_NAME ?? process.env.PLAYWRIGHT_APP_NAME ?? DEFAULT_E2E_APP_NAME
  );

const resolveDefaultBaseURL = (appName: string): string => {
  const port = process.env.PLAYWRIGHT_PREVIEW_PORT ?? DEFAULT_E2E_PORT;
  const host = process.env.PLAYWRIGHT_PREVIEW_HOST ?? 'localhost';
  const basePath = appName ? `/${appName}` : '';
  return `http://${host}:${port}${basePath}`;
};

const normalizeBaseURL = (value: string): string => value.replace(/\/*$/, '');

const resolveRouterMode = (): E2ERouterMode => {
  const rawRouterMode =
    process.env.PLAYWRIGHT_ROUTER_MODE ??
    process.env.VITE_ROUTER_MODE ??
    (process.env.VITE_USE_HASH_ROUTING === 'false' ? 'browser' : 'hash');
  return typeof rawRouterMode === 'string' && rawRouterMode.toLowerCase() === 'browser'
    ? 'browser'
    : 'hash';
};

export const resolveE2EUrlContract = (): E2EUrlContract => {
  const appName = resolveAppName();
  const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? resolveDefaultBaseURL(appName);
  const baseURL = normalizeBaseURL(rawBaseURL);
  const routerMode = resolveRouterMode();

  return {
    appName,
    baseURL,
    baseURLWithSlash: `${baseURL}/`,
    routerMode,
    isHashRouter: routerMode === 'hash',
  };
};

const toHashPath = (input: string): string => {
  if (!input) return '#/';
  if (input.startsWith('#')) {
    const trimmed = input.replace(/^#+/, '');
    if (!trimmed) return '#/';
    return `#/${trimmed.replace(/^\/+/, '')}`;
  }
  return `#/${input.replace(/^\/+/, '')}`;
};

export const buildAppUrl = (path = '', contract = resolveE2EUrlContract()): string => {
  if (contract.isHashRouter) {
    const hashPath = toHashPath(path);
    return `${contract.baseURLWithSlash}${hashPath}`;
  }

  if (!path) return contract.baseURLWithSlash;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('#')) return `${contract.baseURLWithSlash}${path}`;
  if (path.startsWith('/')) return `${contract.baseURL}${path}`;
  return `${contract.baseURLWithSlash}${path}`;
};

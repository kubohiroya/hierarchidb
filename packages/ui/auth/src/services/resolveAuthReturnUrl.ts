export type AuthRouterMode = 'browser' | 'hash';

export interface ResolveAuthReturnUrlOptions {
  appBasePath: string;
  currentOrigin: string;
  routerMode: AuthRouterMode;
}

export type ResolvedAuthReturnUrl =
  | { isExternal: true; url: string }
  | { isExternal: false; url: string };

const normalizeAppBasePath = (appBasePath: string): string => {
  if (!appBasePath.startsWith('/')) {
    throw new TypeError(`appBasePath must start with "/": ${appBasePath}`);
  }
  if (appBasePath.includes('?') || appBasePath.includes('#')) {
    throw new TypeError(`appBasePath must not include query or hash components: ${appBasePath}`);
  }
  if (appBasePath === '/') return appBasePath;
  return appBasePath.endsWith('/') ? appBasePath.slice(0, -1) : appBasePath;
};

const normalizeInternalPath = (
  pathname: string,
  appBasePath: string,
  allowAppRelativePath: boolean
): string => {
  if (appBasePath === '/') return pathname;
  if (pathname === appBasePath || pathname === `${appBasePath}/`) return '/';
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length);
  }
  if (allowAppRelativePath) return pathname;
  throw new RangeError(
    `Same-origin return URL path is outside appBasePath: ${pathname} (base: ${appBasePath})`
  );
};

const hasExplicitOrigin = (rawUrl: string): boolean =>
  /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawUrl) || rawUrl.startsWith('//');

const parseCurrentOrigin = (currentOrigin: string): string => {
  const parsedOrigin = new URL(currentOrigin);
  if (parsedOrigin.origin === 'null' || parsedOrigin.origin !== currentOrigin) {
    throw new TypeError(
      `currentOrigin must be an absolute origin without a path: ${currentOrigin}`
    );
  }
  return parsedOrigin.origin;
};

export const resolveAuthReturnUrl = (
  rawUrl: string,
  options: ResolveAuthReturnUrlOptions
): ResolvedAuthReturnUrl => {
  if (rawUrl.trim().length === 0) {
    throw new TypeError('Auth return URL must not be empty');
  }

  const currentOrigin = parseCurrentOrigin(options.currentOrigin);
  const appBasePath = normalizeAppBasePath(options.appBasePath);
  const resolved = new URL(rawUrl, currentOrigin);

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new TypeError(`Auth return URL must use HTTP(S): ${resolved.protocol}`);
  }

  if (resolved.origin !== currentOrigin) {
    return { isExternal: true, url: resolved.toString() };
  }

  if (options.routerMode === 'hash' && resolved.hash.length > 0) {
    if (!resolved.hash.startsWith('#/')) {
      throw new TypeError(`Hash-router return URL must use a "#/" route: ${resolved.hash}`);
    }
    return { isExternal: false, url: resolved.hash };
  }

  const normalizedPath = normalizeInternalPath(
    resolved.pathname,
    appBasePath,
    !hasExplicitOrigin(rawUrl)
  );
  const routeUrl = `${normalizedPath}${resolved.search}${resolved.hash}`;
  return {
    isExternal: false,
    url: options.routerMode === 'hash' ? `#${routeUrl}` : routeUrl,
  };
};

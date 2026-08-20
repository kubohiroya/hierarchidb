import type { ResolvedAuthReturnUrl } from './resolveAuthReturnUrl.js';

export const AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS = 3_000;

export interface AuthCallbackNavigationLocation {
  readonly origin: string;
  readonly pathname: string;
  hash: string;
  assign(url: string): void;
  replace(url: string): void;
}

export interface StartAuthCallbackNavigationOptions {
  target: ResolvedAuthReturnUrl;
  location: AuthCallbackNavigationLocation;
  navigate(url: string): Promise<void> | void;
  timeoutMs: number;
  onError(error: Error): void;
}

export interface AuthCallbackNavigationHandle {
  dispose(): void;
}

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(`Auth callback navigation failed: ${String(value)}`);

const validateTimeout = (timeoutMs: number): void => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`Auth callback navigation timeout must be positive: ${timeoutMs}`);
  }
};

const validateExternalTarget = (
  target: Extract<ResolvedAuthReturnUrl, { isExternal: true }>,
  currentOrigin: string
): void => {
  const parsed = new URL(target.url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`External auth callback target must use HTTP(S): ${parsed.protocol}`);
  }
  if (parsed.origin === currentOrigin) {
    throw new TypeError(`External auth callback target must use a different origin: ${target.url}`);
  }
};

const resolveInternalTargetKind = (url: string): 'hash' | 'browser' => {
  if (url.startsWith('#/')) return 'hash';
  if (url.startsWith('/')) return 'browser';
  throw new TypeError(`Internal auth callback target must start with "/" or "#/": ${url}`);
};

const buildHashDocumentUrl = (location: AuthCallbackNavigationLocation, hash: string): string => {
  const documentUrl = new URL(location.pathname, location.origin);
  return `${documentUrl.toString()}${hash}`;
};

export const startAuthCallbackNavigation = (
  options: StartAuthCallbackNavigationOptions
): AuthCallbackNavigationHandle => {
  validateTimeout(options.timeoutMs);

  let active = true;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const clearNavigationTimeout = (): void => {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
  };

  const finish = (): void => {
    if (!active) return;
    active = false;
    clearNavigationTimeout();
  };

  const fail = (error: unknown): void => {
    finish();
    options.onError(toError(error));
  };

  if (options.target.isExternal) {
    validateExternalTarget(options.target, options.location.origin);
    try {
      options.location.assign(options.target.url);
      finish();
    } catch (error) {
      fail(error);
    }
    return { dispose: finish };
  }

  const targetKind = resolveInternalTargetKind(options.target.url);
  const hardRedirectUrl =
    targetKind === 'hash'
      ? buildHashDocumentUrl(options.location, options.target.url)
      : options.target.url;

  const hardRedirect = (): void => {
    if (!active) return;
    active = false;
    clearNavigationTimeout();
    try {
      options.location.replace(hardRedirectUrl);
    } catch (error) {
      options.onError(toError(error));
    }
  };

  timeoutHandle = setTimeout(hardRedirect, options.timeoutMs);

  if (targetKind === 'hash') {
    try {
      options.location.hash = options.target.url;
    } catch {
      hardRedirect();
    }
    return { dispose: finish };
  }

  try {
    void Promise.resolve(options.navigate(options.target.url)).then(finish, hardRedirect);
  } catch {
    hardRedirect();
  }

  return { dispose: finish };
};

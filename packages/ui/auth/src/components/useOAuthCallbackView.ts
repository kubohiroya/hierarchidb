import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { BFFAuthService } from '~/services/BFFAuthService';

interface OAuthCallbackView {
  error: string | null;
  isProcessing: boolean;
}

const getAppBasePrefix = (): string => {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = String(base).startsWith('/') ? String(base) : `/${String(base)}`;
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
};

const normalizeHashReturnPath = (pathname: string): string => {
  const basePrefix = getAppBasePrefix();
  if (!basePrefix || basePrefix === '/') return pathname;
  if (pathname === basePrefix) return '/';
  if (pathname.startsWith(`${basePrefix}/`)) {
    const stripped = pathname.slice(basePrefix.length);
    return stripped.length > 0 ? stripped : '/';
  }
  return pathname;
};

const resolveReturnUrl = (rawUrl: string): { isExternal: boolean; url: string } => {
  try {
    const resolved = new URL(rawUrl, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return { isExternal: true, url: resolved.toString() };
    }
    const usesHashRouting = window.location.hash.startsWith('#/');
    const normalizedPath = usesHashRouting
      ? normalizeHashReturnPath(resolved.pathname)
      : resolved.pathname;
    return { isExternal: false, url: `${normalizedPath}${resolved.search}${resolved.hash}` };
  } catch {
    return { isExternal: false, url: '/' };
  }
};

export const useOAuthCallbackView = (): OAuthCallbackView => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const handleCallback = useCallback(async () => {
    try {
      const authService = BFFAuthService.getInstance();
      const params = new URLSearchParams(window.location.search);

      await authService.handleCallback(params);

      const returnUrl = localStorage.getItem('auth_return_url') || '/';
      const resolved = resolveReturnUrl(returnUrl);

      if (resolved.isExternal) {
        window.location.assign(resolved.url);
        return;
      }

      void navigate({ to: resolved.url, replace: true });
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsProcessing(false);
    }
  }, [navigate]);

  useEffect(() => {
    void handleCallback();
  }, [handleCallback]);

  return { error, isProcessing };
};

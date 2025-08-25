/**
 * Dynamic redirect URI utilities
 */

import { Context } from 'hono';
import { parseAllowedOrigins } from './cors';

/**
 * Gets dynamic redirect URI based on request origin
 */
export function getDynamicRedirectUri(c: Context, provider: string = 'google'): string {
  const env = c.env as any;

  // Check for provider-specific redirect URI
  if (provider === 'github' && env.GITHUB_REDIRECT_URI) {
    return env.GITHUB_REDIRECT_URI;
  }
  if (provider === 'microsoft' && env.MICROSOFT_REDIRECT_URI) {
    return env.MICROSOFT_REDIRECT_URI;
  }

  // Use default redirect URI
  if (env.REDIRECT_URI) {
    return env.REDIRECT_URI;
  }

  // Fallback to constructing from request
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}/auth/callback`;
}

/**
 * Gets src callback URL from state parameter
 */
export function getAppCallbackUrlFromState(c: Context, state: string | null): string {
  const env = c.env as any;

  // Try to extract origin from state if it's encoded
  let stateOrigin: string | undefined;
  if (state) {
    try {
      // State might contain origin info
      const stateData = JSON.parse(atob(state));
      if (stateData.origin) {
        stateOrigin = stateData.origin;
      }
    } catch {
      // State is not JSON encoded, ignore
    }
  }

  // 優先度1: 環境変数で明示的に設定されている場合
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  // プロダクション環境: ALLOWED_ORIGINSと厳密に一致チェック
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
    
    // stateのoriginをチェック
    if (stateOrigin && allowedOrigins.includes(stateOrigin)) {
      return stateOrigin;
    }
    
    // Originヘッダーをチェック
    const origin = c.req.header('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }
    
    // プロダクションではデフォルト値を返さず、設定値を要求
    return env.APP_BASE_URL || env.ALLOWED_ORIGINS?.split(',')[0] || '';
  }

  // 開発環境: localhostのみ許可
  // stateのoriginをチェック
  if (stateOrigin) {
    if (stateOrigin.startsWith('http://localhost:') || stateOrigin.startsWith('http://127.0.0.1:')) {
      return stateOrigin;
    }
    console.warn(`Rejected non-localhost origin from state in development: ${stateOrigin}`);
  }
  
  // Originヘッダーをチェック
  const origin = c.req.header('Origin');
  if (origin) {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    console.warn(`Rejected non-localhost origin in development: ${origin}`);
  }

  return 'http://localhost:4200';
}

/**
 * Gets src callback URL
 */
export function getAppCallbackUrl(c: Context): string {
  const env = c.env as any;

  // 優先度1: 環境変数で明示的に設定されている場合
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  const origin = c.req.header('Origin');
  
  // プロダクション環境: ALLOWED_ORIGINSと厳密に一致チェック
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    if (origin) {
      const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      console.warn(`Rejected origin in production: ${origin}`);
    }
    // プロダクションではデフォルト値を返さず、設定値を要求
    return env.APP_BASE_URL || env.ALLOWED_ORIGINS?.split(',')[0] || '';
  }
  
  // 開発環境: localhostのみ許可
  if (origin) {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    console.warn(`Rejected non-localhost origin in development: ${origin}`);
  }

  return 'http://localhost:4200';
}

/**
 * Validates redirect_uri parameter
 * 開発環境: localhostのみ許可
 * 本番環境: ALLOWED_ORIGINSまたはREDIRECT_URIに一致するもののみ許可
 */
export function validateRedirectUri(redirectUri: string, c: Context): boolean {
  const env = c.env as any;
  
  try {
    const url = new URL(redirectUri);
    const origin = `${url.protocol}//${url.host}`;
    
    // プロダクション環境
    if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
      // 環境変数で設定されたredirect_uriと完全一致チェック
      if (env.REDIRECT_URI && redirectUri === env.REDIRECT_URI) {
        return true;
      }
      if (env.GITHUB_REDIRECT_URI && redirectUri === env.GITHUB_REDIRECT_URI) {
        return true;
      }
      if (env.MICROSOFT_REDIRECT_URI && redirectUri === env.MICROSOFT_REDIRECT_URI) {
        return true;
      }
      
      // ALLOWED_ORIGINSに含まれるオリジンからのredirect_uriを許可
      const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
      if (allowedOrigins.includes(origin)) {
        return true;
      }
      
      console.warn(`Invalid redirect_uri in production: ${redirectUri}`);
      return false;
    }
    
    // 開発環境: localhostのみ許可
    if (origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://localhost:') ||
        origin.startsWith('https://127.0.0.1:')) {
      return true;
    }
    
    console.warn(`Invalid redirect_uri in development (not localhost): ${redirectUri}`);
    return false;
  } catch (error) {
    console.error(`Invalid redirect_uri format: ${redirectUri}`, error);
    return false;
  }
}

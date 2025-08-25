/**
 * Origin validation middleware
 */

import { Context, Next } from 'hono';
import { parseAllowedOrigins } from '../utils/cors';

/**
 * Originを検証するミドルウェア
 * 開発環境：localhostのみ許可
 * 本番環境：ALLOWED_ORIGINSのみ許可
 */
export async function validateOrigin(c: Context, next: Next) {
  const origin = c.req.header('Origin');
  const env = c.env as any;
  
  // Originヘッダーがない場合（同一オリジンリクエストなど）は通す
  if (!origin) {
    return next();
  }
  
  // プロダクション環境
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
    
    if (!allowedOrigins.includes(origin)) {
      console.warn(`Blocked request from unauthorized origin in production: ${origin}`);
      return c.json(
        { 
          error: 'Forbidden',
          message: 'Origin not allowed' 
        }, 
        403
      );
    }
  } 
  // 開発環境
  else {
    const isLocalhost = origin.startsWith('http://localhost:') || 
                       origin.startsWith('http://127.0.0.1:') ||
                       origin.startsWith('https://localhost:') ||
                       origin.startsWith('https://127.0.0.1:');
    
    if (!isLocalhost) {
      console.warn(`Blocked request from non-localhost origin in development: ${origin}`);
      return c.json(
        { 
          error: 'Forbidden',
          message: 'Only localhost origins are allowed in development mode' 
        }, 
        403
      );
    }
  }
  
  // 検証をパスした場合は次の処理へ
  return next();
}

/**
 * 特定のパスにOrigin検証を適用するヘルパー関数
 */
export function requireValidOrigin(paths: string[]) {
  return async (c: Context, next: Next) => {
    const path = new URL(c.req.url).pathname;
    
    // 指定されたパスの場合のみ検証
    if (paths.some(p => path.startsWith(p))) {
      return validateOrigin(c, next);
    }
    
    return next();
  };
}
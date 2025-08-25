import { Context } from 'hono';
import { Env } from '../types';
import { extractBearerToken, createSessionToken } from '../utils/jwt';
import { KVStorageManager } from '../utils/kv-storage';

/**
 * Refresh token endpoint handler
 */
export async function refreshToken(c: Context<{ Bindings: Env & { AUTH_KV?: KVNamespace } }>) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);
    
    // リフレッシュトークンIDをボディから取得（オプション）
    const body = await c.req.json().catch(() => ({}));
    const { refresh_token_id } = body;

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    if (!c.env.AUTH_KV) {
      console.error('KV namespace AUTH_KV is not configured');
      return c.json({ error: 'Token refresh is not available' }, 503);
    }

    const env = c.env as any;
    const kvManager = new KVStorageManager(c.env.AUTH_KV, env.JWT_SECRET);
    const sessionDuration = parseInt(env.SESSION_DURATION_HOURS || '24');

    // Create new session token first
    const userData = await kvManager.getUserAuthBySession(token);
    if (!userData) {
      return c.json({ error: 'Session not found' }, 401);
    }

    const newSessionToken = await createSessionToken(
      {
        sub: userData.userId,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        provider: userData.provider,
      },
      env.JWT_SECRET,
      sessionDuration,
      env.JWT_ISSUER
    );

    // Refresh with new token and rotation
    const result = await kvManager.refreshUserToken(
      token, 
      newSessionToken, 
      sessionDuration,
      refresh_token_id
    );

    if (!result.success) {
      // セキュリティ違反の場合は詳細なエラーを返す
      if (result.error === 'Token reuse detected - all sessions revoked') {
        return c.json({ 
          error: 'security_violation',
          error_description: result.error 
        }, 403);
      }
      return c.json({ 
        error: 'invalid_grant',
        error_description: result.error || 'Invalid or expired refresh token' 
      }, 401);
    }

    return c.json({
      access_token: newSessionToken,
      token_type: 'Bearer',
      expires_in: sessionDuration * 3600,
      id_token: newSessionToken,
      refresh_token_id: result.newRefreshTokenId, // 新しいリフレッシュトークンID
      scope: 'openid profile email',
      userinfo: {
        sub: userData.userId,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json(
      {
        error: 'server_error',
        error_description: 'Failed to refresh token',
      },
      500
    );
  }
}

/**
 * Revoke token endpoint
 */
export async function revokeToken(c: Context<{ Bindings: Env & { AUTH_KV?: KVNamespace } }>) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    if (!c.env.AUTH_KV) {
      console.error('KV namespace AUTH_KV is not configured');
      return c.json({ error: 'Token revocation is not available' }, 503);
    }

    const env = c.env as any;
    const kvManager = new KVStorageManager(c.env.AUTH_KV, env.JWT_SECRET);
    const userData = await kvManager.getUserAuthBySession(token);

    if (!userData) {
      return c.json({ error: 'Session not found' }, 404);
    }

    await kvManager.revokeUser(userData.userId);
    return c.json({ message: 'Tokens revoked successfully' });
  } catch (error) {
    console.error('Token revocation error:', error);
    return c.json(
      {
        error: 'server_error',
        error_description: 'Failed to revoke token',
      },
      500
    );
  }
}

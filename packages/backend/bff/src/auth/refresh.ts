import { type BffContext, getEnv } from '~/utils/env';
import { createSessionToken, extractBearerToken } from '~/utils/jwt';
import { KVStorageManager } from '~/utils/kv-storage';
import { buildKvWarning } from '~/utils/kv-warning';
import { parseAuthSessionConfig } from '~/utils/parseAuthSessionConfig';

/**
 * Refresh token endpoint handler
 */
export async function refreshToken(c: BffContext) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    //  ID
    const body = await c.req.json().catch(() => ({}));
    const { refresh_token_id } = body;

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    const env = getEnv(c);
    const authSessionConfig = parseAuthSessionConfig(env);

    if (authSessionConfig.mode === 'stateless') {
      return c.json(
        {
          error: 'reauthentication_required',
          error_description: 'Stateless sessions cannot be refreshed; sign in again',
        },
        401
      );
    }

    if (!env.AUTH_KV) {
      console.error('KV namespace AUTH_KV is not configured');
      return c.json(
        {
          error: 'kv_unavailable',
          error_description: 'Token refresh is not available',
          warning: buildKvWarning('refresh', 'missing_kv', 'relogin'),
        },
        503
      );
    }

    const kvManager = new KVStorageManager(env.AUTH_KV, env.JWT_SECRET);
    const sessionDuration = authSessionConfig.durationHours;

    // Create new session token first
    let userData: Awaited<ReturnType<typeof kvManager.getUserAuthBySession>>;
    try {
      userData = await kvManager.getUserAuthBySession(token);
    } catch (error) {
      console.error('Failed to read session from KV:', error);
      return c.json(
        {
          error: 'kv_unavailable',
          error_description: 'Token refresh is not available',
          warning: buildKvWarning('refresh', 'kv_error', 'relogin'),
        },
        503
      );
    }
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
    let result: Awaited<ReturnType<typeof kvManager.refreshUserToken>>;
    try {
      result = await kvManager.refreshUserToken(
        token,
        newSessionToken,
        sessionDuration,
        refresh_token_id
      );
    } catch (error) {
      console.error('Failed to refresh token in KV:', error);
      return c.json(
        {
          error: 'kv_unavailable',
          error_description: 'Token refresh is not available',
          warning: buildKvWarning('refresh', 'kv_error', 'relogin'),
        },
        503
      );
    }

    if (!result.success) {
      if (result.error === 'Token reuse detected - all sessions revoked') {
        return c.json(
          {
            error: 'security_violation',
            error_description: result.error,
          },
          403
        );
      }
      return c.json(
        {
          error: 'invalid_grant',
          error_description: result.error || 'Invalid or expired refresh token',
        },
        401
      );
    }
    if (!result.newRefreshTokenId) {
      throw new Error('Persistent token refresh did not return a refresh token ID');
    }

    return c.json({
      access_token: newSessionToken,
      token_type: 'Bearer',
      expires_in: sessionDuration * 3600,
      session_mode: 'persistent',
      id_token: newSessionToken,
      refresh_token_id: result.newRefreshTokenId,
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
export async function revokeToken(c: BffContext) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    const env = getEnv(c);
    const authSessionConfig = parseAuthSessionConfig(env);

    if (authSessionConfig.mode === 'stateless') {
      return c.json({ message: 'Token revocation completed locally' });
    }

    if (!env.AUTH_KV) {
      console.error('KV namespace AUTH_KV is not configured');
      return c.json({
        message: 'Token revocation completed locally',
        warning: buildKvWarning('revoke', 'missing_kv', 'none'),
      });
    }

    const kvManager = new KVStorageManager(env.AUTH_KV, env.JWT_SECRET);
    let userData: Awaited<ReturnType<typeof kvManager.getUserAuthBySession>>;
    try {
      userData = await kvManager.getUserAuthBySession(token);
    } catch (error) {
      console.error('Failed to read session from KV:', error);
      return c.json({
        message: 'Token revocation completed locally',
        warning: buildKvWarning('revoke', 'kv_error', 'none'),
      });
    }

    if (!userData) {
      return c.json({ error: 'Session not found' }, 404);
    }

    try {
      await kvManager.revokeUser(userData.userId);
    } catch (error) {
      console.error('Failed to revoke session in KV:', error);
      return c.json({
        message: 'Token revocation completed locally',
        warning: buildKvWarning('revoke', 'kv_error', 'none'),
      });
    }
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

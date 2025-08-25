/**
 * KV Storage utilities with optimized transaction support
 */

import { deriveKey, encrypt, decrypt, generateSecureToken } from './encryption';

/**
 * Combined data structure to reduce KV operations
 */
export interface UserAuthData {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
  refreshToken: {
    id: string;
    googleRefreshToken?: string;
    githubAccessToken?: string;
    microsoftRefreshToken?: string;
    createdAt: number;
    lastUsedAt: number;
    expiresAt: number;
    previousTokenId?: string; // For grace period handling
    rotationCount: number; // Track rotation count
  };
  sessions: {
    [sessionToken: string]: {
      createdAt: number;
      expiresAt: number;
      deviceInfo?: string;
    };
  };
}

/**
 * Optimized KV Storage manager
 */
export class KVStorageManager {
  private static readonly USER_AUTH_PREFIX = 'user_auth:';
  private static readonly SESSION_INDEX_PREFIX = 'session_index:';
  private static readonly REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static readonly MAX_SESSIONS_PER_USER = 10;

  constructor(
    private kv: KVNamespace,
    private encryptionSecret: string
  ) {}

  /**
   * Stores user authentication data with a single KV operation
   */
  async storeUserAuth(
    userId: string,
    data: {
      email: string;
      name: string;
      picture?: string;
      provider: string;
      googleRefreshToken?: string;
      githubAccessToken?: string;
      microsoftRefreshToken?: string;
      sessionToken: string;
      sessionDuration: number; // in hours
      deviceInfo?: string;
    }
  ): Promise<string> {
    const refreshTokenId = generateSecureToken(32);
    const key = await deriveKey(this.encryptionSecret);
    const now = Date.now();

    const userAuthData: UserAuthData = {
      userId,
      email: data.email,
      name: data.name,
      picture: data.picture,
      provider: data.provider,
      refreshToken: {
        id: refreshTokenId,
        googleRefreshToken: data.googleRefreshToken,
        githubAccessToken: data.githubAccessToken,
        microsoftRefreshToken: data.microsoftRefreshToken,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: now + KVStorageManager.REFRESH_TOKEN_EXPIRY,
        rotationCount: 0,
      },
      sessions: {
        [data.sessionToken]: {
          createdAt: now,
          expiresAt: now + data.sessionDuration * 60 * 60 * 1000,
          deviceInfo: data.deviceInfo,
        },
      },
    };

    const encrypted = await encrypt(JSON.stringify(userAuthData), key);

    // Store with transaction-like approach
    await Promise.all([
      this.kv.put(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`, encrypted, {
        expirationTtl: Math.floor(KVStorageManager.REFRESH_TOKEN_EXPIRY / 1000),
      }),
      this.kv.put(`${KVStorageManager.SESSION_INDEX_PREFIX}${data.sessionToken}`, userId, {
        expirationTtl: data.sessionDuration * 3600,
      }),
    ]);

    return refreshTokenId;
  }

  /**
   * Refreshes user token with rotation
   */
  async refreshUserToken(
    oldSessionToken: string,
    newSessionToken: string,
    sessionDuration: number,
    refreshTokenId?: string
  ): Promise<{ success: boolean; newRefreshTokenId?: string; error?: string }> {
    const userId = await this.kv.get(`${KVStorageManager.SESSION_INDEX_PREFIX}${oldSessionToken}`);
    if (!userId) {
      return { success: false, error: 'Invalid session' };
    }

    const key = await deriveKey(this.encryptionSecret);
    const encrypted = await this.kv.get(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`);
    if (!encrypted) {
      return { success: false, error: 'User not found' };
    }

    const decrypted = await decrypt(encrypted, key);
    const userAuthData: UserAuthData = JSON.parse(decrypted);

    const now = Date.now();

    // Check if refresh token is still valid
    if (userAuthData.refreshToken.expiresAt < now) {
      return { success: false, error: 'Refresh token expired' };
    }

    // リフレッシュトークンIDの検証（提供された場合）
    if (refreshTokenId) {
      // トークン再利用の検出
      if (userAuthData.usedTokens?.includes(refreshTokenId)) {
        console.error(`Refresh token reuse detected for user ${userId}`);
        // セキュリティ違反: 全セッションを無効化
        await this.revokeUser(userId);
        return { success: false, error: 'Token reuse detected - all sessions revoked' };
      }

      // 現在のトークンまたは前のトークン（グレースピリオド）でない場合は拒否
      if (refreshTokenId !== userAuthData.refreshToken.id && 
          refreshTokenId !== userAuthData.refreshToken.previousTokenId) {
        return { success: false, error: 'Invalid refresh token' };
      }
    }

    // 新しいリフレッシュトークンIDを生成（ローテーション）
    const newRefreshTokenId = generateSecureToken(32);

    // 使用済みトークンリストを更新（最大100件保持）
    const usedTokens = userAuthData.usedTokens || [];
    if (userAuthData.refreshToken.id) {
      usedTokens.push(userAuthData.refreshToken.id);
    }
    userAuthData.usedTokens = usedTokens.slice(-100);

    // リフレッシュトークンをローテーション
    userAuthData.refreshToken = {
      ...userAuthData.refreshToken,
      id: newRefreshTokenId,
      previousTokenId: userAuthData.refreshToken.id, // グレースピリオド用
      lastUsedAt: now,
      rotationCount: (userAuthData.refreshToken.rotationCount || 0) + 1,
    };

    // Update session
    delete userAuthData.sessions[oldSessionToken];
    userAuthData.sessions[newSessionToken] = {
      createdAt: now,
      expiresAt: now + sessionDuration * 60 * 60 * 1000,
      deviceInfo: userAuthData.sessions[oldSessionToken]?.deviceInfo,
    };

    // Clean up old sessions
    const sessions = Object.entries(userAuthData.sessions)
      .filter(([_, session]) => session.expiresAt > now)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .slice(0, KVStorageManager.MAX_SESSIONS_PER_USER);

    userAuthData.sessions = Object.fromEntries(sessions);

    const updatedEncrypted = await encrypt(JSON.stringify(userAuthData), key);

    await Promise.all([
      this.kv.put(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`, updatedEncrypted, {
        expirationTtl: Math.floor((userAuthData.refreshToken.expiresAt - now) / 1000),
      }),
      this.kv.delete(`${KVStorageManager.SESSION_INDEX_PREFIX}${oldSessionToken}`),
      this.kv.put(`${KVStorageManager.SESSION_INDEX_PREFIX}${newSessionToken}`, userId, {
        expirationTtl: sessionDuration * 3600,
      }),
    ]);

    return { success: true, newRefreshTokenId };
  }

  /**
   * Gets user auth data by session token
   */
  async getUserAuthBySession(sessionToken: string): Promise<UserAuthData | null> {
    const userId = await this.kv.get(`${KVStorageManager.SESSION_INDEX_PREFIX}${sessionToken}`);
    if (!userId) {
      return null;
    }

    const key = await deriveKey(this.encryptionSecret);
    const encrypted = await this.kv.get(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`);
    if (!encrypted) {
      return null;
    }

    const decrypted = await decrypt(encrypted, key);
    return JSON.parse(decrypted);
  }

  /**
   * Revokes all user tokens
   */
  async revokeUser(userId: string): Promise<void> {
    const key = await deriveKey(this.encryptionSecret);
    const encrypted = await this.kv.get(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`);
    if (!encrypted) {
      return;
    }

    const decrypted = await decrypt(encrypted, key);
    const userAuthData: UserAuthData = JSON.parse(decrypted);

    // Delete all session indices
    await Promise.all([
      ...Object.keys(userAuthData.sessions).map((sessionToken) =>
        this.kv.delete(`${KVStorageManager.SESSION_INDEX_PREFIX}${sessionToken}`)
      ),
      this.kv.delete(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`),
    ]);
  }
}

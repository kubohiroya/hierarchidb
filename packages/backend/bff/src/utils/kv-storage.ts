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
   * Refreshes user token
   */
  async refreshUserToken(
    oldSessionToken: string,
    newSessionToken: string,
    sessionDuration: number
  ): Promise<{ success: boolean }> {
    const userId = await this.kv.get(`${KVStorageManager.SESSION_INDEX_PREFIX}${oldSessionToken}`);
    if (!userId) {
      return { success: false };
    }

    const key = await deriveKey(this.encryptionSecret);
    const encrypted = await this.kv.get(`${KVStorageManager.USER_AUTH_PREFIX}${userId}`);
    if (!encrypted) {
      return { success: false };
    }

    const decrypted = await decrypt(encrypted, key);
    const userAuthData: UserAuthData = JSON.parse(decrypted);

    const now = Date.now();

    // Check if refresh token is still valid
    if (userAuthData.refreshToken.expiresAt < now) {
      return { success: false };
    }

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
    userAuthData.refreshToken.lastUsedAt = now;

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

    return { success: true };
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

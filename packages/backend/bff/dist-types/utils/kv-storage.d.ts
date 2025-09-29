/**
 * KV Storage utilities with optimized transaction support
 */
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
        previousTokenId?: string;
        rotationCount: number;
    };
    sessions: {
        [sessionToken: string]: {
            createdAt: number;
            expiresAt: number;
            deviceInfo?: string;
        };
    };
    usedTokens?: string[];
}
/**
 * Optimized KV Storage manager
 */
export declare class KVStorageManager {
    private kv;
    private encryptionSecret;
    private static readonly USER_AUTH_PREFIX;
    private static readonly SESSION_INDEX_PREFIX;
    private static readonly REFRESH_TOKEN_EXPIRY;
    private static readonly MAX_SESSIONS_PER_USER;
    constructor(kv: KVNamespace, encryptionSecret: string);
    /**
     * Stores user authentication data with a single KV operation
     */
    storeUserAuth(userId: string, data: {
        email: string;
        name: string;
        picture?: string;
        provider: string;
        googleRefreshToken?: string;
        githubAccessToken?: string;
        microsoftRefreshToken?: string;
        sessionToken: string;
        sessionDuration: number;
        deviceInfo?: string;
    }): Promise<string>;
    /**
     * Refreshes user token with rotation
     */
    refreshUserToken(oldSessionToken: string, newSessionToken: string, sessionDuration: number, refreshTokenId?: string): Promise<{
        success: boolean;
        newRefreshTokenId?: string;
        error?: string;
    }>;
    /**
     * Gets user auth data by session token
     */
    getUserAuthBySession(sessionToken: string): Promise<UserAuthData | null>;
    /**
     * Revokes all user tokens
     */
    revokeUser(userId: string): Promise<void>;
}
//# sourceMappingURL=kv-storage.d.ts.map
import type { AuthProviderType } from '~/types/AuthProviderType';

export const AUTH_SESSION_CHANGED_EVENT = 'hierarchidb:auth-session-changed';

export interface BFFUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  provider: AuthProviderType;
}

interface ParsedTokenResponse {
  user: BFFUser;
  refreshTokenId?: string;
}

type JsonRecord = Record<string, unknown>;

class AuthSessionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthSessionContractError';
  }
}

const STORAGE_KEYS = {
  accessToken: 'access_token',
  refreshTokenId: 'refresh_token_id',
  userinfo: 'userinfo',
} as const;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, fieldName: string): JsonRecord => {
  if (!isJsonRecord(value)) {
    throw new AuthSessionContractError(
      `Invalid auth session contract: ${fieldName} must be an object`
    );
  }
  return value;
};

const requireString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuthSessionContractError(
      `Invalid auth session contract: ${fieldName} must be a non-empty string`
    );
  }
  return value;
};

const readOptionalString = (value: unknown, fieldName: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return requireString(value, fieldName);
};

const requirePositiveNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new AuthSessionContractError(
      `Invalid auth session contract: ${fieldName} must be a positive finite number`
    );
  }
  return value;
};

const removePersistedSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshTokenId);
  localStorage.removeItem(STORAGE_KEYS.userinfo);
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('id_token');
};

const emitChanged = (): void => {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
};

/**
 * Owns the canonical UI authentication session contract and its local persistence.
 */
export const AuthSessionStorage = {
  isContractError(value: unknown): boolean {
    return value instanceof AuthSessionContractError;
  },

  parseProvider(value: unknown, fieldName = 'provider'): AuthProviderType {
    if (value === 'google' || value === 'microsoft' || value === 'github') {
      return value;
    }
    throw new AuthSessionContractError(
      `Invalid auth session contract: ${fieldName} must be google, microsoft, or github`
    );
  },

  parseTokenResponse(
    payload: unknown,
    provider: AuthProviderType,
    now = Date.now()
  ): ParsedTokenResponse {
    const response = requireRecord(payload, 'token response');
    const userinfo = requireRecord(response.userinfo, 'userinfo');
    const accessToken = requireString(response.access_token, 'access_token');
    const expiresIn = requirePositiveNumber(response.expires_in, 'expires_in');
    const expiresAt = now + expiresIn * 1000;
    const refreshTokenId = readOptionalString(response.refresh_token_id, 'refresh_token_id');

    if (!Number.isFinite(expiresAt)) {
      throw new AuthSessionContractError(
        'Invalid auth session contract: calculated expires_at must be finite'
      );
    }

    return {
      user: {
        id: requireString(userinfo.sub, 'userinfo.sub'),
        email: requireString(userinfo.email, 'userinfo.email'),
        name: requireString(userinfo.name, 'userinfo.name'),
        picture: readOptionalString(userinfo.picture, 'userinfo.picture'),
        access_token: accessToken,
        refresh_token: refreshTokenId,
        expires_at: expiresAt,
        provider,
      },
      refreshTokenId,
    };
  },

  persistTokenResponse(payload: unknown, provider: AuthProviderType, now = Date.now()): BFFUser {
    const parsed = AuthSessionStorage.parseTokenResponse(payload, provider, now);
    AuthSessionStorage.persist(parsed.user, parsed.refreshTokenId);
    return parsed.user;
  },

  persist(user: BFFUser, refreshTokenId?: string): void {
    const persistedUser = {
      id: requireString(user.id, 'user.id'),
      email: requireString(user.email, 'user.email'),
      name: requireString(user.name, 'user.name'),
      picture: readOptionalString(user.picture, 'user.picture'),
      provider: AuthSessionStorage.parseProvider(user.provider, 'user.provider'),
      expires_at: requirePositiveNumber(user.expires_at, 'user.expires_at'),
    };
    const accessToken = requireString(user.access_token, 'user.access_token');

    try {
      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
      localStorage.setItem(STORAGE_KEYS.userinfo, JSON.stringify(persistedUser));
      if (refreshTokenId === undefined) {
        localStorage.removeItem(STORAGE_KEYS.refreshTokenId);
      } else {
        localStorage.setItem(
          STORAGE_KEYS.refreshTokenId,
          requireString(refreshTokenId, 'refresh_token_id')
        );
      }
    } catch {
      removePersistedSession();
      throw new AuthSessionContractError('Failed to persist the authenticated UI session');
    }

    emitChanged();
  },

  load(): BFFUser | null {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const serializedUser = localStorage.getItem(STORAGE_KEYS.userinfo);

    if (accessToken === null && serializedUser === null) {
      return null;
    }
    if (accessToken === null || serializedUser === null) {
      throw new AuthSessionContractError(
        'Invalid persisted auth session: access_token and userinfo must both be present'
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(serializedUser);
    } catch {
      throw new AuthSessionContractError(
        'Invalid persisted auth session: userinfo must be valid JSON'
      );
    }

    const userinfo = requireRecord(payload, 'persisted userinfo');
    const refreshTokenId = localStorage.getItem(STORAGE_KEYS.refreshTokenId) ?? undefined;

    return {
      id: requireString(userinfo.id, 'persisted userinfo.id'),
      email: requireString(userinfo.email, 'persisted userinfo.email'),
      name: requireString(userinfo.name, 'persisted userinfo.name'),
      picture: readOptionalString(userinfo.picture, 'persisted userinfo.picture'),
      access_token: requireString(accessToken, 'persisted access_token'),
      refresh_token: readOptionalString(refreshTokenId, 'persisted refresh_token_id'),
      expires_at: requirePositiveNumber(userinfo.expires_at, 'persisted userinfo.expires_at'),
      provider: AuthSessionStorage.parseProvider(userinfo.provider, 'persisted userinfo.provider'),
    };
  },

  clear(): void {
    removePersistedSession();
    emitChanged();
  },
};

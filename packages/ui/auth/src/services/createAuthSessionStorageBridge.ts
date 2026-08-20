import type { BFFUser } from './AuthSessionStorage.js';
import { AuthSessionStorage } from './AuthSessionStorage.js';

export type AuthSessionStorageBridge = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

const ACCESS_TOKEN_KEY = 'access_token';
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';
const REFRESH_TOKEN_ID_KEY = 'refresh_token_id';

const requireSupportedReadKey = (key: string): void => {
  if (key !== ACCESS_TOKEN_KEY && key !== TOKEN_EXPIRES_AT_KEY) {
    throw new Error(`Unsupported auth session bridge read key: ${key}`);
  }
};

const requireSupportedRemoveKey = (key: string): void => {
  if (key !== ACCESS_TOKEN_KEY && key !== TOKEN_EXPIRES_AT_KEY && key !== REFRESH_TOKEN_ID_KEY) {
    throw new Error(`Unsupported auth session bridge remove key: ${key}`);
  }
};

const readSessionValue = (session: BFFUser | null, key: string): string | null => {
  if (session === null) return null;
  if (key === ACCESS_TOKEN_KEY) return session.access_token;
  return String(Math.floor(session.expires_at / 1000));
};

/**
 * Creates the read-through bridge used by workers to access the canonical UI auth session.
 */
export const createAuthSessionStorageBridge = (): AuthSessionStorageBridge => ({
  async getItem(key: string): Promise<string | null> {
    requireSupportedReadKey(key);
    return readSessionValue(AuthSessionStorage.load(), key);
  },
  async removeItem(key: string): Promise<void> {
    requireSupportedRemoveKey(key);
    AuthSessionStorage.clear();
  },
});

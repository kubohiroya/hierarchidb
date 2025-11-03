/**
 * @file AuthContextType.ts
 * @description Type definitions for authentication context
 */

import type { AuthProviderType } from './AuthProviderType.js';
import type { AuthUser } from './AuthUser.js';

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (options?: { returnUrl?: string; provider?: AuthProviderType }) => void;
  signOut: () => void;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
  currentProvider: AuthProviderType | null;
}

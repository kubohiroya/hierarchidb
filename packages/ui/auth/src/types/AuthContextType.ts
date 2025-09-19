/**
 * @file AuthContextType.ts
 * @description Type definitions for authentication context
 */

import type { AuthUser } from './AuthUser.js';
import type { AuthProviderType } from './AuthProviderType.js';

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
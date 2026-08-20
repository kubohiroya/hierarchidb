/**
 * @file AuthUser.ts
 * @description Type definitions for authenticated user data
 */

import type { AuthSessionMode } from '../services/AuthSessionStorage.js';
import type { AuthProviderType } from './AuthProviderType.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: AuthProviderType;
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_at: number;
  session_mode?: AuthSessionMode;
}

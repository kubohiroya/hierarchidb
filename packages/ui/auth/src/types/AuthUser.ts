/**
 * @file AuthUser.ts
 * @description Type definitions for authenticated user data
 */

import type { AuthProviderType } from './AuthProviderType';

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
}
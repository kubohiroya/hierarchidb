import { AuthProviderType } from './AuthProviderType';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  id_token?: string;
  expires_at: number;
  provider: AuthProviderType;
}

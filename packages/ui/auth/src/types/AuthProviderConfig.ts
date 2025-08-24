import { AuthProviderType } from './AuthProviderType';

export interface AuthProviderConfig {
  type: AuthProviderType;
  clientId: string;
  clientSecret?: string;
  scope: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
}

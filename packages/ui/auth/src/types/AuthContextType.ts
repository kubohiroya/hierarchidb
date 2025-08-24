import { AuthProviderType } from './AuthProviderType';
import { AuthUser } from './AuthUser';

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (options?: {
    returnUrl?: string;
    isUserInitiated?: boolean;
    provider?: AuthProviderType;
    method?: 'redirect' | 'popup';
  }) => void;
  signOut: () => void;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
  currentProvider: AuthProviderType | null;
}

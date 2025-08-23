import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
// import { APP_PREFIX } from "@/config/appDescription"; // Removed to avoid hard-coded dependency
import { AuthProviderType } from '../types/AuthProviderType';
// import { getSecureConfig } from "@/config/secureConfig"; // TODO: Fix config import
// import { notify } from "@/shared/containers/NotificationSystem/NotificationSystem"; // TODO: Fix notification import

// Temporary implementations
const getSecureConfig = () => ({
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  githubClientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
});

const notify = {
  error: (message: string) => console.error(message),
  success: (message: string) => console.log(message),
};
import { AuthContextType } from '../types/AuthContextType';
import { AuthProviderConfig } from '../types/AuthProviderConfig';
import { AuthUser } from '../types/AuthUser';

const MultiAuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'multi-auth-user';
const REDIRECT_URL_KEY = 'multi-auth-redirect';
const PROVIDER_KEY = 'multi-auth-provider';

export function useMultiAuth() {
  const context = useContext(MultiAuthContext);
  if (!context) {
    throw new Error('useMultiAuth must be used within MultiAuthProvider');
  }
  return context;
}

interface MultiAuthProviderProps {
  children: React.ReactNode;
  homeUrl?: string;
}

const getProviderConfig = (provider: AuthProviderType, homeUrl = '/'): AuthProviderConfig => {
  const secureConfig = getSecureConfig();
  const redirectUri = `${window.location.origin}${homeUrl}redirect`;

  switch (provider) {
    case 'google':
      return {
        type: 'google',
        clientId: secureConfig.oidcClientId || '',
        scope: 'openid profile email',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        redirectUri,
      };
    case 'microsoft':
      return {
        type: 'microsoft',
        clientId: secureConfig.microsoftClientId || '',
        scope: 'openid profile email User.Read',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        redirectUri,
      };
    case 'github':
      return {
        type: 'github',
        clientId: secureConfig.githubClientId || '',
        clientSecret: secureConfig.githubClientSecret || '',
        scope: 'read:user user:email',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        redirectUri,
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

export function MultiAuthProvider({ children, homeUrl = '/' }: MultiAuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<AuthProviderType | null>(null);

  // Google Login hook for implicit flow
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Fetch user info using the access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userInfoResponse.json();

        const authUser: AuthUser = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          provider: 'google',
          access_token: tokenResponse.access_token,
          expires_at: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
        };

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        localStorage.setItem(PROVIDER_KEY, 'google');
        setUser(authUser);
        setCurrentProvider('google');

        // Handle redirect after login
        const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
        if (redirectUrl) {
          localStorage.removeItem(REDIRECT_URL_KEY);
          window.location.href = redirectUrl;
        }
      } catch (error) {
        notify.error('Failed to process Google login. Please try again.');
      }
    },
    onError: () => {
      notify.error('Google login failed. Please try again.');
    },
    flow: 'implicit', // Use implicit flow for SPAs
  });

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    const storedProvider = localStorage.getItem(PROVIDER_KEY) as AuthProviderType | null;

    if (storedUser && storedProvider) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        // Check if token is still valid
        if (parsedUser.expires_at > Date.now()) {
          setUser(parsedUser);
          setCurrentProvider(storedProvider);
        } else {
          // Token expired, remove from storage
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(PROVIDER_KEY);
        }
      } catch (error) {
        notify.error('Authentication data corrupted. Please sign in again.');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PROVIDER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(
    (options?: { returnUrl?: string; provider?: AuthProviderType }) => {
      const provider = options?.provider || 'google';

      // Store return URL if provided
      const currentUrl = window.location.pathname + window.location.search;
      localStorage.setItem(REDIRECT_URL_KEY, options?.returnUrl || currentUrl);
      localStorage.setItem(PROVIDER_KEY, provider);

      // Handle Google authentication with implicit flow
      if (provider === 'google') {
        googleLogin();
        return;
      }

      // Handle other providers with authorization code flow
      const config = getProviderConfig(provider, homeUrl);

      if (!config.clientId) {
        const providerName =
          provider === 'microsoft' ? 'Microsoft' : provider === 'github' ? 'GitHub' : provider;
        notify.error(
          `${providerName} Client ID is not configured. Please check your environment variables.`
        );
        return;
      }

      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state: crypto.randomUUID(),
      });

      if (provider === 'microsoft') {
        params.append('response_mode', 'query');
        params.append('prompt', 'select_account');
      } else if (provider === 'github') {
        // GitHub specific parameters can be added here if needed
      }

      window.location.href = `${config.authUrl}?${params.toString()}`;
    },
    [googleLogin, homeUrl]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REDIRECT_URL_KEY);
    localStorage.removeItem(PROVIDER_KEY);
    setUser(null);
    setCurrentProvider(null);

    // Redirect to home page after logout
    window.location.href = homeUrl;
  }, [homeUrl]);

  const getAccessToken = useCallback(() => {
    if (!user) return null;

    // Check if token is expired
    if (user.expires_at <= Date.now()) {
      // Token expired, clear user and return null
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROVIDER_KEY);
      setUser(null);
      setCurrentProvider(null);
      return null;
    }

    return user.access_token;
  }, [user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    getAccessToken,
    getIdToken,
    currentProvider,
  };

  return <MultiAuthContext.Provider value={contextValue}>{children}</MultiAuthContext.Provider>;
}

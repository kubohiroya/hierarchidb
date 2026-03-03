import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  id_token?: string;
  expires_at: number;
}

export interface GoogleAuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (options?: { returnUrl?: string }) => void;
  signOut: () => void;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
}

const STORAGE_KEY = 'google-auth-user';
const REDIRECT_URL_KEY = 'google-auth-redirect';

export interface UseGoogleAuthProviderContextParams {
  homeUrl: string;
}

export interface UseGoogleAuthProviderContextResult {
  contextValue: GoogleAuthContextType;
}

export function useGoogleAuthProviderContext({
  homeUrl,
}: UseGoogleAuthProviderContextParams): UseGoogleAuthProviderContextResult {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as GoogleUser;
        if (parsedUser.expires_at > Date.now()) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.info('Google login success:', tokenResponse);

      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userInfoResponse.json();

        const googleUser: GoogleUser = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          access_token: tokenResponse.access_token,
          expires_at: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(googleUser));
        setUser(googleUser);

        const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
        if (redirectUrl) {
          localStorage.removeItem(REDIRECT_URL_KEY);
          window.location.href = redirectUrl;
        }
      } catch (error) {
        console.error('Failed to process login:', error);
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
    },
    flow: 'implicit',
  });

  const signIn = useCallback(
    (options?: { returnUrl?: string }) => {
      if (options?.returnUrl) {
        localStorage.setItem(REDIRECT_URL_KEY, options.returnUrl);
      } else {
        const currentUrl = window.location.pathname + window.location.search;
        localStorage.setItem(REDIRECT_URL_KEY, currentUrl);
      }

      googleLogin();
    },
    [googleLogin]
  );

  const signOut = useCallback(() => {
    googleLogout();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REDIRECT_URL_KEY);
    setUser(null);

    window.location.href = homeUrl;
  }, [homeUrl]);

  const getAccessToken = useCallback(() => {
    if (!user) return null;

    if (user.expires_at <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      return null;
    }

    return user.access_token;
  }, [user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  const contextValue = useMemo<GoogleAuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      signIn,
      signOut,
      getAccessToken,
      getIdToken,
    }),
    [user, isLoading, signIn, signOut, getAccessToken, getIdToken]
  );

  return { contextValue };
}

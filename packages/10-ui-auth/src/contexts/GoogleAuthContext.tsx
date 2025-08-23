import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
// import { APP_PREFIX } from "@/config/appDescription"; // Removed to avoid hard-coded dependency

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  id_token?: string;
  expires_at: number;
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (options?: { returnUrl?: string }) => void;
  signOut: () => void;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null);

const STORAGE_KEY = 'google-auth-user';
const REDIRECT_URL_KEY = 'google-auth-redirect';

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
  }
  return context;
}

interface GoogleAuthProviderInnerProps {
  children: React.ReactNode;
  homeUrl: string;
}

function GoogleAuthProviderInner({ children, homeUrl }: GoogleAuthProviderInnerProps) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as GoogleUser;
        // Check if token is still valid
        if (parsedUser.expires_at > Date.now()) {
          setUser(parsedUser);
        } else {
          // Token expired, remove from storage
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

        const googleUser: GoogleUser = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          access_token: tokenResponse.access_token,
          expires_at: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
        };

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(googleUser));
        setUser(googleUser);

        // Handle redirect after login
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
    flow: 'implicit', // Use implicit flow for SPAs
  });

  const signIn = useCallback(
    (options?: { returnUrl?: string }) => {
      // Store return URL if provided
      if (options?.returnUrl) {
        localStorage.setItem(REDIRECT_URL_KEY, options.returnUrl);
      } else {
        // Store current location
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

    // Redirect to home page after logout
    window.location.href = homeUrl;
  }, [homeUrl]);

  const getAccessToken = useCallback(() => {
    if (!user) return null;

    // Check if token is expired
    if (user.expires_at <= Date.now()) {
      // Token expired, clear user and return null
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      return null;
    }

    return user.access_token;
  }, [user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  const contextValue: GoogleAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    getAccessToken,
    getIdToken,
  };

  return <GoogleAuthContext.Provider value={contextValue}>{children}</GoogleAuthContext.Provider>;
}

interface GoogleAuthProviderProps {
  children: React.ReactNode;
  clientId: string;
  homeUrl?: string;
}

export function GoogleAuthProvider({ children, clientId, homeUrl = '/' }: GoogleAuthProviderProps) {
  if (!clientId) {
    console.error('Google OAuth Client ID is required');
    // Return a placeholder theme when clientId is missing
    return (
      <GoogleAuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          signIn: () => console.error('Cannot sign in: Client ID is missing'),
          signOut: () => {
            /* no-op */
          },
          getAccessToken: () => null,
          getIdToken: () => null,
        }}
      >
        {children}
      </GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleAuthProviderInner homeUrl={homeUrl}>{children}</GoogleAuthProviderInner>
    </GoogleOAuthProvider>
  );
}

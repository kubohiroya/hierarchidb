/**
 * @file MultiAuthContext.test.tsx
 * @description Test suite for MultiAuthContext with multiple OAuth providers
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '~/types/AuthUser';
import { MultiAuthProvider, useMultiAuth } from '~/contexts/MultiAuthContext';

// Mock @provider-oauth/google
const mockGoogleLogin = vi.fn();
const mockUseGoogleLogin = vi.fn().mockReturnValue(mockGoogleLogin);
const fetchMock = vi.fn();

vi.mock('@provider-oauth/google', () => ({
  useGoogleLogin: (config: unknown) => {
    mockUseGoogleLogin(config);
    return mockGoogleLogin;
  },
}));

// Mock environment variables
vi.mock('~/config/env', () => ({
  VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
  VITE_OIDC_CLIENT_ID: 'test-oidc-client-id',
  VITE_MICROSOFT_CLIENT_ID: 'test-microsoft-client-id',
  VITE_GITHUB_CLIENT_ID: 'test-github-client-id',
  VITE_GITHUB_CLIENT_SECRET: 'test-github-secret',
}));

// Test component that uses the auth context
const TestComponent = () => {
  const auth = useMultiAuth();

  return (
    <div>
      <div data-testid="loading">{auth.isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user-name">{auth.user?.name || 'none'}</div>
      <div data-testid="provider">{auth.currentProvider || 'none'}</div>

      <button
        type="button"
        data-testid="sign-in-google"
        onClick={() => auth.signIn({ provider: 'google' })}
      >
        Sign in with Google
      </button>

      <button
        type="button"
        data-testid="sign-in-microsoft"
        onClick={() => auth.signIn({ provider: 'microsoft' })}
      >
        Sign in with Microsoft
      </button>

      <button
        type="button"
        data-testid="sign-in-github"
        onClick={() => auth.signIn({ provider: 'github' })}
      >
        Sign in with GitHub
      </button>

      <button type="button" data-testid="sign-out" onClick={() => auth.signOut()}>
        Sign out
      </button>

      <div data-testid="access-token">{auth.getAccessToken() || 'none'}</div>
      <div data-testid="id-token">{auth.getIdToken() || 'none'}</div>
    </div>
  );
};

describe('MultiAuthProvider', () => {
  let originalWindow: typeof window;
  let originalCrypto: typeof crypto;
  let originalLocalStorage: Storage;

  const mockUser: AuthUser = {
    id: '123456',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    provider: 'google',
    access_token: 'test-access-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
  };

  const mockExpiredUser: AuthUser = {
    ...mockUser,
    expires_at: Date.now() - 1000, // Expired 1 second ago
  };

  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  const mockCrypto = {
    randomUUID: vi.fn().mockReturnValue('test-uuid-123'),
  };

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalCrypto = globalThis.crypto;
    originalLocalStorage = globalThis.localStorage;

    Object.assign(globalThis.window, {
      ...originalWindow,
      location: {
        origin: 'https://app.example.com',
        pathname: '/test',
        search: '?param=value',
        href: 'https://app.example.com/test?param=value',
        ancestorOrigins: {} as DOMStringList,
        hash: '',
        host: 'app.example.com',
        hostname: 'app.example.com',
        port: '',
        protocol: 'https:',
        assign: vi.fn(),
        reload: vi.fn(),
        replace: vi.fn(),
        toString: () => 'https://app.example.com/test?param=value',
      },
      localStorage: mockLocalStorage as unknown as Storage,
    });

    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto as unknown as Crypto,
        configurable: true,
      });
    } catch {
      // Fallback for environments where property is writable
      Reflect.set(globalThis, 'crypto', mockCrypto as unknown as Crypto);
    }
    globalThis.localStorage = mockLocalStorage as unknown as Storage;

    // Mock fetch for Google userinfo
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    } catch {
      Reflect.set(globalThis, 'crypto', originalCrypto);
    }
    globalThis.localStorage = originalLocalStorage;
  });

  describe('Context Provider', () => {
    it('should throw error when useMultiAuth is used outside provider', () => {
      const TestComponentOutside = () => {
        useMultiAuth();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponentOutside />)).toThrow(
        'useMultiAuth must be used within MultiAuthProvider'
      );
    });

    it('should provide context to children', () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      expect(screen.getByTestId('loaded')).toHaveTextContent('loaded');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('user-name')).toHaveTextContent('none');
    });

    it('should initialize with loading atoms and then complete', async () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
    });
  });

  describe('LocalStorage Integration', () => {
    it('should load stored user on initialization', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(mockUser);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
        expect(screen.getByTestId('provider')).toHaveTextContent('google');
      });
    });

    it('should clear expired user on initialization', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(mockExpiredUser);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-user');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-provider');
      });
    });

    it('should handle corrupted storage data', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return 'invalid-json';
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Authentication data corrupted. Please sign in again.'
        );
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-user');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-provider');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Google Authentication', () => {
    it('should setup Google login with correct configuration', () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      expect(mockUseGoogleLogin).toHaveBeenCalledWith({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
        flow: 'implicit',
      });
    });

    it('should trigger Google login when signIn is called', () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      fireEvent.click(screen.getByTestId('sign-in-google'));

      expect(mockGoogleLogin).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'multi-auth-redirect',
        '/test?param=value'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('multi-auth-provider', 'google');
    });

    it('should handle successful Google authentication', async () => {
      const mockUserInfo = {
        id: '123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserInfo),
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      // Get the onSuccess callback
      const googleConfig = mockUseGoogleLogin.mock.calls[0]?.[0];
      if (!googleConfig) {
        throw new Error('mockUseGoogleLogin not called');
      }

      await act(async () => {
        await googleConfig.onSuccess({
          access_token: 'test-access-token',
          expires_in: 3600,
        });
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: 'Bearer test-access-token',
          },
        }
      );

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'multi-auth-user',
        expect.stringContaining('"provider":"google"')
      );
    });

    it('should handle Google authentication error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      const googleConfig = mockUseGoogleLogin.mock.calls[0]?.[0];
      if (!googleConfig) {
        throw new Error('mockUseGoogleLogin not called');
      }
      googleConfig.onError();

      expect(consoleSpy).toHaveBeenCalledWith('Google login failed. Please try again.');

      consoleSpy.mockRestore();
    });

    it('should handle user info fetch failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      const googleConfig = mockUseGoogleLogin.mock.calls[0]?.[0];
      if (!googleConfig) {
        throw new Error('mockUseGoogleLogin not called');
      }

      await act(async () => {
        await googleConfig.onSuccess({
          access_token: 'test-access-token',
          expires_in: 3600,
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to process Google login. Please try again.');

      consoleSpy.mockRestore();
    });
  });

  describe('Other Provider Authentication', () => {
    it('should redirect for Microsoft authentication', () => {
      Object.defineProperty(globalThis.window, 'location', {
        value: { ...globalThis.window.location, href: '' },
        configurable: true,
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      fireEvent.click(screen.getByTestId('sign-in-microsoft'));

      expect(globalThis.window.location.href).toContain('https://login.microsoftonline.com');
      expect(globalThis.window.location.href).toContain('client_id=test-microsoft-client-id');
      expect(globalThis.window.location.href).toContain('response_mode=query');
      expect(globalThis.window.location.href).toContain('prompt=select_account');
    });

    it('should redirect for GitHub authentication', () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      fireEvent.click(screen.getByTestId('sign-in-github'));

      expect(globalThis.window.location.href).toContain('https://github.com/login/oauth/authorize');
      expect(globalThis.window.location.href).toContain('client_id=test-github-client-id');
      expect(globalThis.window.location.href).toContain('scope=read%3Auser%20user%3Aemail');
    });

    it('should handle missing client ID', () => {
      // Mock environment to return empty client ID
      vi.doMock('~/config/env', () => ({
        VITE_MICROSOFT_CLIENT_ID: '',
      }));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      fireEvent.click(screen.getByTestId('sign-in-microsoft'));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Microsoft Client ID is not configured. Please check your environment variables.'
      );

      consoleSpy.mockRestore();
    });

    it('should use custom homeUrl for redirect URI', () => {
      render(
        <MultiAuthProvider homeUrl="/custom/">
          <TestComponent />
        </MultiAuthProvider>
      );

      fireEvent.click(screen.getByTestId('sign-in-microsoft'));

      expect(globalThis.window.location.href).toContain(
        encodeURIComponent('https://app.example.com/custom/redirect')
      );
    });
  });

  describe('Sign Out', () => {
    beforeEach(async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(mockUser);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });
    });

    it('should clear user data and redirect on sign out', async () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });

      fireEvent.click(screen.getByTestId('sign-out'));

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-redirect');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-provider');
      expect(globalThis.window.location.href).toBe('/');
    });

    it('should use custom homeUrl for sign out redirect', async () => {
      render(
        <MultiAuthProvider homeUrl="/custom/">
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });

      fireEvent.click(screen.getByTestId('sign-out'));

      expect(globalThis.window.location.href).toBe('/custom/');
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(mockUser);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });
    });

    it('should return access token when user is authenticated and token is valid', async () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('test-access-token');
      });
    });

    it('should clear user when access token is expired', async () => {
      // Start with expired user
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(mockExpiredUser);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('none');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
    });

    it('should return null for ID token when not available', async () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('id-token')).toHaveTextContent('none');
      });
    });

    it('should return ID token when available', async () => {
      const userWithIdToken = { ...mockUser, id_token: 'test-id-token' };
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-user') return JSON.stringify(userWithIdToken);
        if (key === 'multi-auth-provider') return 'google';
        return null;
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('id-token')).toHaveTextContent('test-id-token');
      });
    });
  });

  describe('Redirect Handling', () => {
    it('should store and use custom return URL', () => {
      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      // Simulate sign in with custom return URL
      const customReturnUrl = '/custom/path?param=1';

      const CustomButton = () => {
        const auth = useMultiAuth();
        return (
          <button
            type="button"
            onClick={() => auth.signIn({ provider: 'google', returnUrl: customReturnUrl })}
          >
            Custom Sign In
          </button>
        );
      };

      render(
        <MultiAuthProvider>
          <CustomButton />
        </MultiAuthProvider>
      );

      const customButton = screen.getByText('Custom Sign In');
      fireEvent.click(customButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('multi-auth-redirect', customReturnUrl);
    });

    it('should redirect to stored URL after successful Google authentication', async () => {
      const customReturnUrl = '/custom/return/path';
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'multi-auth-redirect') return customReturnUrl;
        return null;
      });

      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: '123456',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
          }),
      });

      render(
        <MultiAuthProvider>
          <TestComponent />
        </MultiAuthProvider>
      );

      const googleConfig = mockUseGoogleLogin.mock.calls[0]?.[0];
      if (!googleConfig) {
        throw new Error('mockUseGoogleLogin not called');
      }

      await act(async () => {
        await googleConfig.onSuccess({
          access_token: 'test-access-token',
          expires_in: 3600,
        });
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('multi-auth-redirect');
      expect(globalThis.window.location.href).toBe(customReturnUrl);
    });
  });
});

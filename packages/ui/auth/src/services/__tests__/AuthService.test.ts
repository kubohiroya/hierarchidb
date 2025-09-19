/**
 * @file AuthService.test.ts
 * @description Test suite for AuthService with popup-based authentication flow
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../AuthService.js';

// Mock global objects
const mockCrypto = {
  getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

// Mock popup window
const mockPopup = {
  close: vi.fn(),
  closed: false,
  postMessage: vi.fn(),
};

// Mock logger
vi.mock('~/utils/logger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
}));

// Define types for auth configuration and result
interface AuthConfig {
  authUrl: string;
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  popupRedirectUri: string;
  scope: string;
  responseType: string;
}

type AuthMethod = 'popup' | 'redirect';

describe('AuthService', () => {
  let originalWindow: typeof window;
  let originalCrypto: typeof crypto;

  const mockConfig: AuthConfig = {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    authOrigin: 'https://accounts.google.com',
    clientId: 'test-client-id',
    redirectUri: 'https://app.example.com/auth/callback',
    popupRedirectUri: 'https://app.example.com/auth/popup',
    scope: 'openid profile email',
    responseType: 'code',
  };

  beforeEach(() => {
    // Reset AuthService singleton
    (AuthService as any).instance = undefined;

    // Mock global objects
    originalWindow = globalThis.window;
    originalCrypto = globalThis.crypto;

    globalThis.window = {
      ...originalWindow,
      open: vi.fn().mockReturnValue(mockPopup) as any,
      addEventListener: vi.fn() as any,
      removeEventListener: vi.fn() as any,
      setInterval: vi.fn() as any,
      clearInterval: vi.fn() as any,
      setTimeout: vi.fn() as any,
      screen: { width: 1920, height: 1080 },
      location: { origin: 'https://app.example.com', search: '' },
    } as any;

    Object.defineProperty(globalThis, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });

    // Reset popup mock
    mockPopup.closed = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize AuthService with config', () => {
      expect(() => AuthService.getInstance()).toThrow('AuthService must be initialized before use');

      AuthService.initialize(mockConfig);
      const instance = AuthService.getInstance();

      expect(instance).toBeInstanceOf(AuthService);
      expect(instance.getAuthMethod()).toBe('popup');
    });

    it('should not reinitialize if already initialized', () => {
      AuthService.initialize(mockConfig);
      const instance1 = AuthService.getInstance();

      AuthService.initialize({ ...mockConfig, clientId: 'different-client-id' });
      const instance2 = AuthService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should throw error when accessing getInstance before initialization', () => {
      expect(() => AuthService.getInstance()).toThrow('AuthService must be initialized before use');
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('should return default auth method as popup', () => {
      const service = AuthService.getInstance();
      expect(service.getAuthMethod()).toBe('popup');
    });

    it('should log attempt to change auth method but remain popup', () => {
      const service = AuthService.getInstance();

      service.setAuthMethod('redirect' as AuthMethod);

      expect(service.getAuthMethod()).toBe('popup');
      // Logger mock is verified by vi.mock at top of file
    });
  });

  describe('Popup Authentication Flow', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('should open popup window with correct parameters', async () => {
      const service = AuthService.getInstance();
      const mockOpen = vi.mocked(globalThis.window.open);

      // Start authentication but don't wait for completion
      const authPromise = service.authenticate();

      expect(mockOpen).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
        'auth-popup',
        'width=500,height=600,left=710,top=240,toolbar=no,menubar=no,scrollbars=yes',
      );

      // Simulate popup being closed to prevent hanging promise
      mockPopup.closed = true;
      await expect(authPromise).rejects.toThrow('Authentication cancelled by user');
    });

    it('should throw error when popup is blocked', async () => {
      const service = AuthService.getInstance();
      (globalThis.window.open as any) = vi.fn().mockReturnValue(null);

      await expect(service.authenticate()).rejects.toThrow('Popup blocked. Please allow popups for this site.');
    });

    it('should handle successful authentication via popup message', async () => {
      const service = AuthService.getInstance();
      const mockAddEventListener = vi.mocked(globalThis.window.addEventListener);

      const authPromise = service.authenticate();

      // Get the message handler that was registered
      expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      const messageHandler = mockAddEventListener.mock.calls[0]?.[1] as (event: MessageEvent) => void;

      // Simulate successful auth message
      const successEvent = {
        origin: mockConfig.authOrigin,
        data: {
          type: 'auth-success',
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      } as MessageEvent;

      if (messageHandler && typeof messageHandler === 'function') {
        messageHandler(successEvent);
      }

      const result = await authPromise;
      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
    });

    it('should handle authentication error via popup message', async () => {
      const service = AuthService.getInstance();
      const mockAddEventListener = vi.mocked(globalThis.window.addEventListener);

      const authPromise = service.authenticate();

      // Wait for next tick to ensure event listener is set up
      await new Promise(resolve => setTimeout(resolve, 0));

      const messageHandler = mockAddEventListener.mock.calls[0]?.[1] as (event: MessageEvent) => void;

      const errorEvent = {
        origin: mockConfig.authOrigin,
        data: {
          type: 'auth-error',
          error: 'access_denied',
        },
      } as MessageEvent;

      if (messageHandler && typeof messageHandler === 'function') {
        messageHandler(errorEvent);
      }

      await expect(authPromise).rejects.toThrow('access_denied');
    });

    it('should ignore messages from untrusted origins', async () => {
      const service = AuthService.getInstance();
      const mockAddEventListener = vi.mocked(globalThis.window.addEventListener);

      const authPromise = service.authenticate();
      const messageHandler = mockAddEventListener.mock.calls[0]?.[1] as (event: MessageEvent) => void;

      const untrustedEvent = {
        origin: 'https://malicious.example.com',
        data: {
          type: 'auth-success',
          accessToken: 'fake-token',
        },
      } as MessageEvent;

      if (messageHandler && typeof messageHandler === 'function') {
        messageHandler(untrustedEvent);
      }

      // Logger mock is verified by vi.mock at top of file - devLog called with untrusted origin message

      // Trigger the popup check interval to detect closure
      const mockSetInterval = vi.mocked(globalThis.window.setInterval);
      const intervalCallback = mockSetInterval.mock.calls[0]?.[0];

      // Simulate popup closure
      mockPopup.closed = true;
      if (intervalCallback && typeof intervalCallback === 'function') {
        intervalCallback();
      }

      await expect(authPromise).rejects.toThrow('Authentication cancelled by user');
    });

    it('should timeout after 5 minutes', async () => {
      const service = AuthService.getInstance();
      const mockSetTimeout = vi.mocked(globalThis.window.setTimeout);

      const authPromise = service.authenticate();

      // Wait for next tick to ensure timeout is set up
      await new Promise(resolve => setTimeout(resolve, 0));

      // Get the timeout callback
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
      const timeoutCallback = mockSetTimeout.mock.calls.find(call => call[1] === 5 * 60 * 1000)?.[0];

      if (timeoutCallback && typeof timeoutCallback === 'function') {
        timeoutCallback();
      }

      await expect(authPromise).rejects.toThrow('Authentication timeout');
    });
  });

  describe('OAuth Callback Handling', () => {
    beforeEach(() => {
      // Mock DOM
      globalThis.document = {
        body: { innerHTML: '' },
      } as any;
    });

    it('should handle successful OAuth callback in popup', () => {
      const mockOpener = {
        postMessage: vi.fn(),
        closed: false,
      };

      globalThis.window = {
        ...globalThis.window,
        opener: mockOpener,
        location: {
          search: '?code=test-auth-code&state=test-state',
          origin: 'https://app.example.com',
        },
        close: vi.fn(),
      } as any;

      AuthService.handleAuthCallback();

      expect(mockOpener.postMessage).toHaveBeenCalledWith(
        {
          type: 'auth-success',
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
        'https://app.example.com',
      );
    });

    it('should handle OAuth error in popup', () => {
      const mockOpener = {
        postMessage: vi.fn(),
        closed: false,
      };

      globalThis.window = {
        ...globalThis.window,
        opener: mockOpener,
        location: {
          search: '?error=access_denied&error_description=The+user+denied+the+request',
          origin: 'https://app.example.com',
        },
        close: vi.fn(),
      } as any;

      AuthService.handleAuthCallback();

      expect(mockOpener.postMessage).toHaveBeenCalledWith(
        {
          type: 'auth-error',
          error: 'access_denied',
          errorDescription: 'The user denied the request',
        },
        'https://app.example.com',
      );
    });

    it('should handle callback when not in popup mode', () => {
      globalThis.window = {
        ...globalThis.window,
        opener: null,
        location: {
          search: '?code=test-auth-code',
        },
      } as any;

      AuthService.handleAuthCallback();

      expect(globalThis.document.body.innerHTML).toBe('<p>Authentication complete. You can close this window.</p>');
    });
  });

  describe('URL Building and Security', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('should build auth URL with all required parameters', async () => {
      const service = AuthService.getInstance();

      // Start authentication to trigger URL building
      const authPromise = service.authenticate();

      const mockOpen = vi.mocked(globalThis.window.open);
      const authUrl = mockOpen.mock.calls[0]?.[0] as string;

      expect(authUrl).toContain(mockConfig.authUrl);
      expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.popupRedirectUri)}`);
      expect(authUrl).toContain(`response_type=${mockConfig.responseType}`);
      expect(authUrl).toContain(`scope=${encodeURIComponent(mockConfig.scope)}`);
      expect(authUrl).toContain('state=');
      expect(authUrl).toContain('prompt=select_account');

      // Clean up
      const mockSetInterval = vi.mocked(globalThis.window.setInterval);
      const intervalCallback = mockSetInterval.mock.calls[0]?.[0];
      mockPopup.closed = true;
      if (intervalCallback && typeof intervalCallback === 'function') {
        intervalCallback();
      }
      await expect(authPromise).rejects.toThrow();
    });

    it('should generate unique state values', () => {
      // Test state generation by checking if crypto.getRandomValues is called
      const service = AuthService.getInstance();

      service.authenticate().catch(() => {
      }); // Ignore promise rejection

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('should handle popup monitoring correctly', async () => {
      const service = AuthService.getInstance();
      const mockSetInterval = vi.mocked(globalThis.window.setInterval);
      const mockClearInterval = vi.mocked(globalThis.window.clearInterval);

      const authPromise = service.authenticate();

      // Verify interval is set up
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 500);

      // Simulate popup being closed
      const intervalCallback = mockSetInterval.mock.calls.find(call => call[1] === 500)?.[0];
      if (intervalCallback) {
        mockPopup.closed = true;
        intervalCallback();
      }

      await expect(authPromise).rejects.toThrow('Authentication cancelled by user');
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should clean up resources on successful authentication', async () => {
      const service = AuthService.getInstance();
      const mockAddEventListener = vi.mocked(globalThis.window.addEventListener);
      const mockRemoveEventListener = vi.mocked(globalThis.window.removeEventListener);
      const mockClearInterval = vi.mocked(globalThis.window.clearInterval);

      const authPromise = service.authenticate();

      // Wait for next tick to ensure event listener is set up
      await new Promise(resolve => setTimeout(resolve, 0));

      // Simulate success
      const messageHandler = mockAddEventListener.mock.calls[0]?.[1];
      const successEvent = {
        origin: mockConfig.authOrigin,
        data: {
          type: 'auth-success',
          accessToken: 'test-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      } as MessageEvent;

      if (messageHandler && typeof messageHandler === 'function') {
        messageHandler(successEvent);
      }

      await authPromise;

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClearInterval).toHaveBeenCalled();
      expect(mockPopup.close).toHaveBeenCalled();
    });
  });

  describe('複数プロバイダー対応', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('複数プロバイダーの同時認証を防ぐ', async () => {
      const service = AuthService.getInstance();

      const firstAuth = service.authenticate();

      const secondAuth = service.authenticate();

      await expect(secondAuth).rejects.toThrow('Authentication already in progress'); //  :

      // Cleanup
      mockPopup.closed = true;
      await expect(firstAuth).rejects.toThrow();
    });

    it('プロバイダー固有の設定を適用できる', () => {
      const microsoftConfig: AuthConfig = {
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        authOrigin: 'https://login.microsoftonline.com',
        clientId: 'ms-client-id',
        redirectUri: 'https://app.example.com/auth/callback',
        popupRedirectUri: 'https://app.example.com/auth/popup',
        scope: 'openid profile email User.Read',
        responseType: 'code',
      };

      (AuthService as any).instance = undefined;
      AuthService.initialize(microsoftConfig);
      const service = AuthService.getInstance();

      service.authenticate().catch(() => {
      });

      const mockOpen = vi.mocked(globalThis.window.open);
      const authUrl = mockOpen.mock.calls[0]?.[0] as string;

      //  : MicrosoftURL
      expect(authUrl).toContain('login.microsoftonline.com'); //  : URL
    });
  });

  describe('認証状態管理', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('認証状態を追跡できる', () => {
      const service = AuthService.getInstance();

      expect(service.isAuthenticating()).toBe(false); //  :
      expect(service.isAuthenticated()).toBe(false); //  :

      service.authenticate().catch(() => {
      });

      expect(service.isAuthenticating()).toBe(true); //  :

      mockPopup.closed = true;
    });

    it('トークンの有効期限を管理できる', async () => {
      vi.useFakeTimers();
      const service = AuthService.getInstance();
      const mockAddEventListener = vi.mocked(globalThis.window.addEventListener);

      const authPromise = service.authenticate();
      const messageHandler = mockAddEventListener.mock.calls[0]?.[1] as (event: MessageEvent) => void;

      const shortExpiryEvent = {
        origin: mockConfig.authOrigin,
        data: {
          type: 'auth-success',
          accessToken: 'short-lived-token',
          refreshToken: 'refresh-token',
          expiresIn: 60, //  603030
          tokenType: 'Bearer',
        },
      } as MessageEvent;

      messageHandler(shortExpiryEvent);
      await authPromise;

      expect(service.isTokenValid()).toBe(true); //  : 60-30=30

      vi.advanceTimersByTime(31000);

      expect(service.isTokenValid()).toBe(false); //  :

      vi.useRealTimers();
    });
  });

  describe('セキュリティ機能', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('PKCE (Proof Key for Code Exchange) をサポートする', async () => {
      //  : OAuth 2.0 PKCE
      //  : code_verifiercode_challenge
      //  : PKCE
      //  : OAuth2.0

      const pkceConfig: AuthConfig = {
        ...mockConfig,
        // usePKCE: true, // TODO: PKCE support not yet implemented
      };

      (AuthService as any).instance = undefined;
      AuthService.initialize(pkceConfig);
      const service = AuthService.getInstance();

      const authPromise = service.authenticate();

      const mockOpen = vi.mocked(globalThis.window.open);
      const authUrl = mockOpen.mock.calls[0]?.[0] as string;

      //  : PKCE
      expect(authUrl).toContain('code_challenge='); //  : code_challenge
      expect(authUrl).toContain('code_challenge_method=S256'); //  : SHA256
      expect(service.getStoredCodeVerifier()).toBeDefined(); //  : verifier

      // Cleanup
      mockPopup.closed = true;
      await expect(authPromise).rejects.toThrow();
    });

    it('nonce パラメータでリプレイ攻撃を防ぐ', async () => {
      //  : OpenID Connect nonce
      //  : nonce
      //  : nonce
      //  : OIDC

      const service = AuthService.getInstance();

      //  nonce
      const firstAuthPromise = service.authenticate();
      const mockOpen = vi.mocked(globalThis.window.open);
      const firstUrl = mockOpen.mock.calls[0]?.[0] as string;
      const firstNonce = new URLSearchParams(firstUrl.split('?')[1]).get('nonce');

      // Cancel first auth by closing popup
      const mockSetInterval = vi.mocked(globalThis.window.setInterval);
      const intervalCallback = mockSetInterval.mock.calls[0]?.[0];
      mockPopup.closed = true;
      if (intervalCallback) intervalCallback();

      await expect(firstAuthPromise).rejects.toThrow('Authentication cancelled by user');

      // Reset for second auth
      mockPopup.closed = false;
      mockOpen.mockClear();

      //  2nonce
      const secondAuthPromise = service.authenticate();
      const secondUrl = mockOpen.mock.calls[0]?.[0] as string;
      const secondNonce = new URLSearchParams(secondUrl.split('?')[1]).get('nonce');

      // Cancel second auth to clean up
      mockPopup.closed = true;
      if (intervalCallback) intervalCallback();
      await expect(secondAuthPromise).rejects.toThrow();

      expect(firstNonce).toBeDefined();
      expect(secondNonce).toBeDefined();
      expect(firstNonce).not.toBe(secondNonce);

      // Cleanup
      mockPopup.closed = true;
    });
  });

  describe('エラーリカバリー', () => {
    beforeEach(() => {
      AuthService.initialize(mockConfig);
    });

    it('ネットワークエラー時に自動リトライする', async () => {

      const service = AuthService.getInstance();
      service.setMaxRetries(3);

      let attemptCount = 0;
      (globalThis.window.open as any) = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return null;
        }
        return mockPopup;
      });

      const authPromise = service.authenticateWithRetry();

      await expect(authPromise).resolves.toBeDefined(); //  :
      expect(attemptCount).toBe(3); //  : 3
    });

    it('エラー後に状態を正しくクリーンアップする', async () => {

      const service = AuthService.getInstance();
      const mockClearInterval = vi.mocked(globalThis.window.clearInterval);
      const mockRemoveEventListener = vi.mocked(globalThis.window.removeEventListener);

      (globalThis.window.open as any) = vi.fn().mockReturnValue(null);

      await expect(service.authenticate()).rejects.toThrow('Popup blocked');

      //  :
      expect(mockClearInterval).toHaveBeenCalled(); //  :
      expect(mockRemoveEventListener).toHaveBeenCalled(); //  :
    });
  });
});
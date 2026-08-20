import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackRoute from '../auth.callback';

const createMemoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => items.delete(key),
    setItem: (key, value) => items.set(key, value),
  };
};

const mocks = vi.hoisted(() => ({
  disposeNavigation: vi.fn(),
  handleCallback: vi.fn(),
  navigate: vi.fn(),
  resolveAuthReturnUrl: vi.fn(),
  startAuthCallbackNavigation: vi.fn(),
}));

vi.mock('@hierarchidb/ui-plugin-shell/ui-auth', () => ({
  AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS: 3_000,
  BFFAuthService: {
    getInstance: () => ({ handleCallback: mocks.handleCallback }),
  },
  resolveAuthReturnUrl: mocks.resolveAuthReturnUrl,
  startAuthCallbackNavigation: mocks.startAuthCallbackNavigation,
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ searchStr: '?code=authorization-code' }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('~/router/config', () => ({
  getRouterMode: () => 'hash',
}));

describe('AuthCallbackRoute', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.clearAllMocks();
    mocks.handleCallback.mockResolvedValue(undefined);
    mocks.resolveAuthReturnUrl.mockReturnValue({
      isExternal: false,
      url: '#/t/r/90d6c659-58f2-4912-b6d5-96bc5dd7d4f2/shape/edit/normal/5',
    });
    mocks.startAuthCallbackNavigation.mockReturnValue({
      dispose: mocks.disposeNavigation,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts the shared navigator for a complex hash target and disposes it on route exit', async () => {
    const returnUrl =
      'https://kubohiroya.github.io/hierarchidb/#/t/r/90d6c659-58f2-4912-b6d5-96bc5dd7d4f2/shape/edit/normal/5';
    localStorage.setItem('auth_return_url', returnUrl);

    const rendered = render(<AuthCallbackRoute />);

    await waitFor(() => {
      expect(mocks.startAuthCallbackNavigation).toHaveBeenCalledTimes(1);
    });

    expect(mocks.handleCallback).toHaveBeenCalledTimes(1);
    expect(mocks.resolveAuthReturnUrl).toHaveBeenCalledWith(returnUrl, {
      appBasePath: '/',
      currentOrigin: window.location.origin,
      routerMode: 'hash',
    });
    expect(localStorage.getItem('auth_return_url')).toBeNull();

    const options = mocks.startAuthCallbackNavigation.mock.calls[0]?.[0];
    if (options === undefined) {
      throw new Error('Expected auth callback navigation options');
    }
    expect(options.target).toEqual({
      isExternal: false,
      url: '#/t/r/90d6c659-58f2-4912-b6d5-96bc5dd7d4f2/shape/edit/normal/5',
    });
    expect(options.timeoutMs).toBe(3_000);

    rendered.unmount();
    expect(mocks.disposeNavigation).toHaveBeenCalledTimes(1);
  });

  it('passes browser-router navigation through as a replace operation', async () => {
    localStorage.setItem('auth_return_url', 'https://kubohiroya.github.io/hierarchidb/tree');
    mocks.resolveAuthReturnUrl.mockReturnValue({ isExternal: false, url: '/tree' });

    render(<AuthCallbackRoute />);

    await waitFor(() => {
      expect(mocks.startAuthCallbackNavigation).toHaveBeenCalledTimes(1);
    });
    const options = mocks.startAuthCallbackNavigation.mock.calls[0]?.[0];
    if (options === undefined) {
      throw new Error('Expected auth callback navigation options');
    }

    await options.navigate('/tree');

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/tree', replace: true });
  });

  it('shows a missing return URL instead of navigating to a default target', async () => {
    render(<AuthCallbackRoute />);

    expect(
      await screen.findByText('Auth return URL is missing from localStorage')
    ).toBeInTheDocument();
    expect(mocks.resolveAuthReturnUrl).not.toHaveBeenCalled();
    expect(mocks.startAuthCallbackNavigation).not.toHaveBeenCalled();
  });

  it('shows an invalid return URL instead of navigating to a default target', async () => {
    localStorage.setItem('auth_return_url', 'invalid-return-url');
    mocks.resolveAuthReturnUrl.mockImplementation(() => {
      throw new Error('Invalid auth return URL');
    });

    render(<AuthCallbackRoute />);

    expect(await screen.findByText('Invalid auth return URL')).toBeInTheDocument();
    expect(mocks.startAuthCallbackNavigation).not.toHaveBeenCalled();
  });

  it('shows callback processing failures instead of navigating to a default target', async () => {
    localStorage.setItem('auth_return_url', 'https://kubohiroya.github.io/hierarchidb/#/tree');
    mocks.handleCallback.mockRejectedValue(new Error('Token exchange failed'));

    render(<AuthCallbackRoute />);

    expect(await screen.findByText('Token exchange failed')).toBeInTheDocument();
    expect(mocks.startAuthCallbackNavigation).not.toHaveBeenCalled();
  });

  it('shows hard redirect failures reported by the shared navigator', async () => {
    localStorage.setItem('auth_return_url', 'https://kubohiroya.github.io/hierarchidb/#/tree');

    render(<AuthCallbackRoute />);

    await waitFor(() => {
      expect(mocks.startAuthCallbackNavigation).toHaveBeenCalledTimes(1);
    });
    const options = mocks.startAuthCallbackNavigation.mock.calls[0]?.[0];
    if (options === undefined) {
      throw new Error('Expected auth callback navigation options');
    }

    act(() => {
      options.onError(new Error('Hard redirect failed'));
    });

    expect(await screen.findByText('Hard redirect failed')).toBeInTheDocument();
  });
});

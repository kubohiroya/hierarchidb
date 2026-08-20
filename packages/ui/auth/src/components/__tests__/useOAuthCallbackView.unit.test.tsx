import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOAuthCallbackView } from '../useOAuthCallbackView';

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

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('~/services/BFFAuthService', () => ({
  BFFAuthService: {
    getInstance: () => ({ handleCallback: mocks.handleCallback }),
  },
}));

vi.mock('~/services/resolveAuthReturnUrl', () => ({
  resolveAuthReturnUrl: mocks.resolveAuthReturnUrl,
}));

vi.mock('~/services/startAuthCallbackNavigation', () => ({
  AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS: 3_000,
  startAuthCallbackNavigation: mocks.startAuthCallbackNavigation,
}));

describe('useOAuthCallbackView', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.clearAllMocks();
    mocks.handleCallback.mockResolvedValue(undefined);
    mocks.resolveAuthReturnUrl.mockReturnValue({ isExternal: false, url: '#/tree' });
    mocks.startAuthCallbackNavigation.mockReturnValue({
      dispose: mocks.disposeNavigation,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the shared navigator and disposes it when the public callback unmounts', async () => {
    localStorage.setItem('auth_return_url', 'https://kubohiroya.github.io/hierarchidb/#/tree');

    const rendered = renderHook(() => useOAuthCallbackView());

    await waitFor(() => {
      expect(mocks.startAuthCallbackNavigation).toHaveBeenCalledTimes(1);
    });

    expect(rendered.result.current).toEqual({ error: null, isProcessing: true });
    const options = mocks.startAuthCallbackNavigation.mock.calls[0]?.[0];
    if (options === undefined) {
      throw new Error('Expected auth callback navigation options');
    }
    expect(options.target).toEqual({ isExternal: false, url: '#/tree' });
    expect(options.timeoutMs).toBe(3_000);

    rendered.unmount();
    expect(mocks.disposeNavigation).toHaveBeenCalledTimes(1);
  });
});

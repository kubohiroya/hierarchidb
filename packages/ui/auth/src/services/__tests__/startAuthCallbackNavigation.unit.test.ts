import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AuthCallbackNavigationLocation,
  startAuthCallbackNavigation,
} from '../startAuthCallbackNavigation.js';

const createLocation = (): AuthCallbackNavigationLocation => ({
  origin: 'https://kubohiroya.github.io',
  pathname: '/hierarchidb/',
  hash: '',
  assign: vi.fn(),
  replace: vi.fn(),
});

describe('startAuthCallbackNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the hash timeout active until the callback route is disposed', () => {
    const location = createLocation();
    const navigate = vi.fn();
    const onError = vi.fn();
    const target = '#/t/r/node-id/shape/edit/normal/5';

    const handle = startAuthCallbackNavigation({
      target: { isExternal: false, url: target },
      location,
      navigate,
      timeoutMs: 3_000,
      onError,
    });

    expect(location.hash).toBe(target);
    expect(navigate).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();

    handle.dispose();
    vi.advanceTimersByTime(3_000);

    expect(location.replace).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('hard redirects when a hash change does not unmount the callback route', () => {
    const location = createLocation();

    startAuthCallbackNavigation({
      target: { isExternal: false, url: '#/t/r/node-id/shape/edit/normal/5' },
      location,
      navigate: vi.fn(),
      timeoutMs: 3_000,
      onError: vi.fn(),
    });

    vi.advanceTimersByTime(3_000);
    vi.advanceTimersByTime(3_000);

    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith(
      'https://kubohiroya.github.io/hierarchidb/#/t/r/node-id/shape/edit/normal/5'
    );
  });

  it('clears the timeout when browser-router navigation resolves', async () => {
    const location = createLocation();
    const navigate = vi.fn().mockResolvedValue(undefined);

    startAuthCallbackNavigation({
      target: { isExternal: false, url: '/t/r/node-id/shape/edit/normal/5' },
      location,
      navigate,
      timeoutMs: 3_000,
      onError: vi.fn(),
    });

    await Promise.resolve();
    vi.advanceTimersByTime(3_000);

    expect(navigate).toHaveBeenCalledWith('/t/r/node-id/shape/edit/normal/5');
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('hard redirects once when browser-router navigation rejects', async () => {
    const location = createLocation();

    startAuthCallbackNavigation({
      target: { isExternal: false, url: '/t/r/node-id/shape/edit/normal/5' },
      location,
      navigate: vi.fn().mockRejectedValue(new Error('router rejected target')),
      timeoutMs: 3_000,
      onError: vi.fn(),
    });

    await Promise.resolve();
    vi.advanceTimersByTime(3_000);

    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith('/t/r/node-id/shape/edit/normal/5');
  });

  it('hard redirects once when browser-router navigation remains pending', () => {
    const location = createLocation();

    startAuthCallbackNavigation({
      target: { isExternal: false, url: '/t/r/node-id/shape/edit/normal/5' },
      location,
      navigate: vi.fn().mockReturnValue(new Promise<void>(() => undefined)),
      timeoutMs: 3_000,
      onError: vi.fn(),
    });

    vi.advanceTimersByTime(3_000);
    vi.advanceTimersByTime(3_000);

    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith('/t/r/node-id/shape/edit/normal/5');
  });

  it('uses assign for an external target without scheduling an internal redirect', () => {
    const location = createLocation();

    startAuthCallbackNavigation({
      target: { isExternal: true, url: 'https://example.com/result' },
      location,
      navigate: vi.fn(),
      timeoutMs: 3_000,
      onError: vi.fn(),
    });

    vi.advanceTimersByTime(3_000);

    expect(location.assign).toHaveBeenCalledTimes(1);
    expect(location.assign).toHaveBeenCalledWith('https://example.com/result');
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('reports a hard redirect failure without retrying another target', () => {
    const location = createLocation();
    const error = new Error('replace rejected target');
    const onError = vi.fn();
    vi.mocked(location.replace).mockImplementation(() => {
      throw error;
    });

    startAuthCallbackNavigation({
      target: { isExternal: false, url: '#/t/r/node-id/shape/edit/normal/5' },
      location,
      navigate: vi.fn(),
      timeoutMs: 3_000,
      onError,
    });

    vi.advanceTimersByTime(3_000);
    vi.advanceTimersByTime(3_000);

    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('rejects an invalid timeout instead of inventing a default', () => {
    expect(() =>
      startAuthCallbackNavigation({
        target: { isExternal: false, url: '#/tree' },
        location: createLocation(),
        navigate: vi.fn(),
        timeoutMs: 0,
        onError: vi.fn(),
      })
    ).toThrow('Auth callback navigation timeout must be positive');
  });
});

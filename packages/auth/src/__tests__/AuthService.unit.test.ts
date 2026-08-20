import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../AuthService.js';

type StorageBridge = Parameters<AuthService['setUiStorageBridge']>[0];

const futureExpiration = String(Math.floor(Date.now() / 1000) + 3_600);

const createBridge = (values: Record<string, string | null>): StorageBridge => ({
  getItem: vi.fn(async (key: string) => values[key] ?? null),
  removeItem: vi.fn(async () => undefined),
});

describe('AuthService UI storage bridge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates the bridge before exposing its token', async () => {
    const service = new AuthService();
    const bridge = createBridge({
      access_token: 'session-token',
      token_expires_at: futureExpiration,
    });

    await service.setUiStorageBridge(bridge);

    await expect(service.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer session-token',
    });
    expect(bridge.getItem).toHaveBeenCalledWith('access_token');
    expect(bridge.getItem).toHaveBeenCalledWith('token_expires_at');
  });

  it('accepts an explicitly absent session', async () => {
    const service = new AuthService();
    const bridge = createBridge({});

    await expect(service.setUiStorageBridge(bridge)).resolves.toBeUndefined();
    await expect(service.getAuthHeaders()).resolves.toEqual({});
  });

  it('rejects bridge storage failures during registration', async () => {
    const service = new AuthService();
    const bridge = createBridge({});
    vi.mocked(bridge.getItem).mockRejectedValue(new Error('storage unavailable'));

    await expect(service.setUiStorageBridge(bridge)).rejects.toThrow('storage unavailable');
  });

  it('rejects a token without the canonical expiration', async () => {
    const service = new AuthService();
    const bridge = createBridge({ access_token: 'session-token' });

    await expect(service.setUiStorageBridge(bridge)).rejects.toThrow(
      'token_expires_at is required'
    );
  });
});

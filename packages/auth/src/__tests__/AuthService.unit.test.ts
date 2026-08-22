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

  it('preserves a newer validated bridge when an older registration fails late', async () => {
    const service = new AuthService();
    let rejectOlderRead: ((error: Error) => void) | undefined;
    const olderBridge: StorageBridge = {
      getItem: vi.fn(
        async () =>
          await new Promise<string | null>((_resolve, reject) => {
            rejectOlderRead = reject;
          })
      ),
      removeItem: vi.fn(async () => undefined),
    };
    const olderRegistration = service.setUiStorageBridge(olderBridge);
    const olderRegistrationFailure = expect(olderRegistration).rejects.toThrow(
      'superseded bridge unavailable'
    );
    await vi.waitFor(() => {
      expect(rejectOlderRead).toBeTypeOf('function');
    });

    const currentBridge = createBridge({
      access_token: 'current-session-token',
      token_expires_at: futureExpiration,
    });
    await service.setUiStorageBridge(currentBridge);
    if (rejectOlderRead === undefined) {
      throw new Error('Older bridge read was not started');
    }
    rejectOlderRead(new Error('superseded bridge unavailable'));
    await olderRegistrationFailure;

    await expect(service.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer current-session-token',
    });
  });

  it('does not let an older validation overwrite a newer registered bridge', async () => {
    const service = new AuthService();
    let resolveOlderToken: ((token: string) => void) | undefined;
    const olderBridge: StorageBridge = {
      getItem: vi.fn(async (key: string) => {
        if (key === 'token_expires_at') return futureExpiration;
        return await new Promise<string>((resolve) => {
          resolveOlderToken = resolve;
        });
      }),
      removeItem: vi.fn(async () => undefined),
    };
    const olderRegistration = service.setUiStorageBridge(olderBridge);
    await vi.waitFor(() => {
      expect(resolveOlderToken).toBeTypeOf('function');
    });

    const currentBridge = createBridge({
      access_token: 'current-session-token',
      token_expires_at: futureExpiration,
    });
    await service.setUiStorageBridge(currentBridge);
    if (resolveOlderToken === undefined) {
      throw new Error('Older bridge token read was not started');
    }
    resolveOlderToken('older-session-token');
    await olderRegistration;

    await expect(service.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer current-session-token',
    });
  });

  it('preserves the current bridge when overlapping replacements both fail', async () => {
    const service = new AuthService();
    const currentBridge = createBridge({
      access_token: 'current-session-token',
      token_expires_at: futureExpiration,
    });
    await service.setUiStorageBridge(currentBridge);
    let rejectFirstReplacement: ((error: Error) => void) | undefined;
    let rejectSecondReplacement: ((error: Error) => void) | undefined;
    const createFailingReplacement = (
      assignReject: (reject: (error: Error) => void) => void
    ): StorageBridge => ({
      getItem: vi.fn(
        async () =>
          await new Promise<string | null>((_resolve, reject) => {
            assignReject(reject);
          })
      ),
      removeItem: vi.fn(async () => undefined),
    });
    const firstRegistration = service.setUiStorageBridge(
      createFailingReplacement((reject) => {
        rejectFirstReplacement = reject;
      })
    );
    const secondRegistration = service.setUiStorageBridge(
      createFailingReplacement((reject) => {
        rejectSecondReplacement = reject;
      })
    );
    const firstFailure = expect(firstRegistration).rejects.toThrow('first replacement unavailable');
    const secondFailure = expect(secondRegistration).rejects.toThrow(
      'second replacement unavailable'
    );
    await vi.waitFor(() => {
      expect(rejectFirstReplacement).toBeTypeOf('function');
      expect(rejectSecondReplacement).toBeTypeOf('function');
    });
    if (rejectFirstReplacement === undefined || rejectSecondReplacement === undefined) {
      throw new Error('Replacement bridge reads were not started');
    }
    rejectFirstReplacement(new Error('first replacement unavailable'));
    rejectSecondReplacement(new Error('second replacement unavailable'));
    await Promise.all([firstFailure, secondFailure]);

    await expect(service.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer current-session-token',
    });
  });

  it('preserves the validated bridge when a later registration fails', async () => {
    const service = new AuthService();
    const currentBridge = createBridge({
      access_token: 'current-session-token',
      token_expires_at: futureExpiration,
    });
    await service.setUiStorageBridge(currentBridge);
    const failingBridge = createBridge({});
    vi.mocked(failingBridge.getItem).mockRejectedValue(new Error('replacement unavailable'));

    await expect(service.setUiStorageBridge(failingBridge)).rejects.toThrow(
      'replacement unavailable'
    );

    await expect(service.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer current-session-token',
    });
  });

  it('rejects a token without the canonical expiration', async () => {
    const service = new AuthService();
    const bridge = createBridge({ access_token: 'session-token' });

    await expect(service.setUiStorageBridge(bridge)).rejects.toThrow(
      'token_expires_at is required'
    );
  });
});

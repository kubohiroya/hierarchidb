import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('origin coordinator owned client registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('closes every registered handle and monotonically rejects new creation', async () => {
    const registry = await import('../originCoordinatorOwnedClientRegistryUtils.js');
    const closeFirst = vi.fn();
    const closeSecond = vi.fn(async () => undefined);
    registry.registerOriginCoordinatorOwnedClientHandle({ close: closeFirst });
    registry.registerOriginCoordinatorOwnedClientHandle({ close: closeSecond });

    await registry.revokeOriginCoordinatorOwnedClientHandles();

    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).toHaveBeenCalledOnce();
    expect(() => registry.assertOriginCoordinatorOwnedClientCreationAllowed()).toThrow(
      'origin-coordinator-owned-client-creation-revoked'
    );
    expect(() =>
      registry.registerOriginCoordinatorOwnedClientHandle({ close: () => undefined })
    ).toThrow('origin-coordinator-owned-client-creation-revoked');
  });

  it('attempts every close and exposes only a stable aggregate failure', async () => {
    const registry = await import('../originCoordinatorOwnedClientRegistryUtils.js');
    const closeAfterFailure = vi.fn();
    registry.registerOriginCoordinatorOwnedClientHandle({
      close: () => {
        throw new Error('private-native-close-detail');
      },
    });
    registry.registerOriginCoordinatorOwnedClientHandle({ close: closeAfterFailure });

    await expect(registry.revokeOriginCoordinatorOwnedClientHandles()).rejects.toThrow(
      'origin-coordinator-owned-client-close-failed'
    );
    expect(closeAfterFailure).toHaveBeenCalledOnce();
  });
});

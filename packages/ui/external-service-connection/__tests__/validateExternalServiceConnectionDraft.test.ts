import { describe, expect, it, vi } from 'vitest';
import type { ExternalServiceConnectionRuntimeProvider } from '../src/externalServiceConnectionTypes.js';
import {
  createEmptyExternalServiceConnectionDraft,
  validateExternalServiceConnectionDraft,
} from '../src/index.js';

const createProvider = (): ExternalServiceConnectionRuntimeProvider => ({
  listConnections: vi.fn().mockResolvedValue([
    {
      name: 'local',
      label: 'Local',
      hostLabel: 'localhost',
      portLabel: '8080',
    },
  ]),
  checkHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
});

describe('validateExternalServiceConnectionDraft', () => {
  it('returns connectionName-only persisted values for named connections', async () => {
    const provider = createProvider();

    const result = await validateExternalServiceConnectionDraft(
      { ...createEmptyExternalServiceConnectionDraft(), connectionName: 'local' },
      provider
    );

    expect(result).toEqual({ ok: true, value: { connectionName: 'local' } });
  });

  it('rejects unknown connection names without preserving endpoint details', async () => {
    const provider = createProvider();

    const result = await validateExternalServiceConnectionDraft(
      { ...createEmptyExternalServiceConnectionDraft(), connectionName: 'missing' },
      provider
    );

    expect(result).toEqual({ ok: false, code: 'CONNECTION_UNAVAILABLE' });
  });

  it('resolves manual targets through the provider and still persists only connectionName', async () => {
    const provider = {
      ...createProvider(),
      resolveManualTarget: vi.fn().mockResolvedValue({ connectionName: 'runtime-manual' }),
    };

    const result = await validateExternalServiceConnectionDraft(
      {
        ...createEmptyExternalServiceConnectionDraft(),
        manualTargetEnabled: true,
        useCorsProxy: true,
        manualHost: '127.0.0.1',
        manualPort: '8080',
      },
      provider
    );

    expect(result).toEqual({ ok: true, value: { connectionName: 'runtime-manual' } });
    expect(provider.resolveManualTarget).toHaveBeenCalledWith({
      manualHost: '127.0.0.1',
      manualPort: '8080',
      useCorsProxy: true,
    });
  });
});

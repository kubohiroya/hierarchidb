import { describe, expect, it, vi } from 'vitest';
import type { IdeGsmConnectionRuntimeProvider } from '../src/ideGsmConnectionTypes';
import { createEmptyIdeGsmConnectionDraft, validateIdeGsmConnectionDraft } from '../src/index';

const createProvider = (): IdeGsmConnectionRuntimeProvider => ({
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

describe('validateIdeGsmConnectionDraft', () => {
  it('returns connectionName-only persisted values for named connections', async () => {
    const provider = createProvider();

    const result = await validateIdeGsmConnectionDraft(
      { ...createEmptyIdeGsmConnectionDraft(), connectionName: 'local' },
      provider
    );

    expect(result).toEqual({ ok: true, value: { connectionName: 'local' } });
  });

  it('rejects unknown connection names without preserving endpoint details', async () => {
    const provider = createProvider();

    const result = await validateIdeGsmConnectionDraft(
      { ...createEmptyIdeGsmConnectionDraft(), connectionName: 'missing' },
      provider
    );

    expect(result).toEqual({ ok: false, code: 'CONNECTION_UNAVAILABLE' });
  });

  it('resolves manual targets through the provider and still persists only connectionName', async () => {
    const provider = {
      ...createProvider(),
      resolveManualTarget: vi.fn().mockResolvedValue({ connectionName: 'runtime-manual' }),
    };

    const result = await validateIdeGsmConnectionDraft(
      {
        ...createEmptyIdeGsmConnectionDraft(),
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

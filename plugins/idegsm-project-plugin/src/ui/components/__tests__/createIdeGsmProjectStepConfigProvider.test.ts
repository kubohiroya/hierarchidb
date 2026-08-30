import type { PluginStepConfig } from '@hierarchidb/plugin-base';
import type { IdeGsmConnectionRuntimeProvider } from '@hierarchidb/ui-ide-gsm-connection';
import { describe, expect, it, vi } from 'vitest';
import { createIdeGsmProjectStepConfigProvider } from '../createIdeGsmProjectStepConfigProvider.js';
import type { IdeGsmProjectDialogData } from '../steps-provider-types.js';

const connectionRuntime: IdeGsmConnectionRuntimeProvider = {
  listConnections: vi.fn().mockResolvedValue([
    {
      name: 'local',
      label: 'Local',
      hostLabel: 'localhost',
      portLabel: '5173',
    },
  ]),
  checkHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
};

const getStep = (
  steps: ReadonlyArray<PluginStepConfig<IdeGsmProjectDialogData>>,
  id: string
): PluginStepConfig<IdeGsmProjectDialogData> => {
  const step = steps.find((entry) => entry.id === id);
  if (!step) {
    throw new Error(`missing step ${id}`);
  }
  return step;
};

describe('createIdeGsmProjectStepConfigProvider', () => {
  it('keeps the step provider disabled by default', () => {
    const provider = createIdeGsmProjectStepConfigProvider({ enabled: false });

    expect(provider.getCreateStepConfigs()).toEqual([]);
  });

  it('registers shared connection then project path steps when enabled', () => {
    const provider = createIdeGsmProjectStepConfigProvider({
      enabled: true,
      connectionRuntime,
    });

    expect(provider.getCreateStepConfigs().map((step) => step.id)).toEqual([
      'connection',
      'project-path',
    ]);
  });

  it('rejects unknown connections without persisting endpoint data', async () => {
    const provider = createIdeGsmProjectStepConfigProvider({
      enabled: true,
      connectionRuntime,
    });
    const step = getStep(provider.getCreateStepConfigs(), 'connection');
    const guard = step.capabilities?.beforeNavigateNext;
    if (!guard) {
      throw new Error('missing connection guard');
    }

    const result = await guard(
      {
        connectionName: 'missing',
      },
      {
        mode: 'create',
        currentStepId: 'connection',
        targetStepId: 'project-path',
        currentStepIndex: 1,
        targetStepIndex: 2,
        dialogData: { connectionName: 'missing' },
        draftData: { connectionName: 'missing' },
        signal: new AbortController().signal,
        setPhase: vi.fn(),
        setCancellable: vi.fn(),
      }
    );

    expect(result).toEqual({ type: 'stay', reason: 'CONNECTION_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('localhost');
  });

  it('promotes project identity to version 1 canonical data', async () => {
    const resolveProjectPath = vi.fn().mockResolvedValue({ projectRelativePath: 'project/a' });
    const provider = createIdeGsmProjectStepConfigProvider({
      enabled: true,
      connectionRuntime,
      resolveProjectPath,
    });
    const step = getStep(provider.getCreateStepConfigs(), 'project-path');
    const guard = step.capabilities?.beforeNavigateNext;
    if (!guard) {
      throw new Error('missing project path guard');
    }

    const result = await guard(
      {
        connectionName: 'local',
        projectRelativePath: 'project/a',
      },
      {
        mode: 'create',
        currentStepId: 'project-path',
        targetStepId: 'complete',
        currentStepIndex: 2,
        targetStepIndex: 3,
        dialogData: { connectionName: 'local', projectRelativePath: 'project/a' },
        draftData: { connectionName: 'local', projectRelativePath: 'project/a' },
        signal: new AbortController().signal,
        setPhase: vi.fn(),
        setCancellable: vi.fn(),
      }
    );

    expect(result).toEqual({
      type: 'advance',
      canonicalData: {
        version: 1,
        connectionName: 'local',
        projectRelativePath: 'project/a',
        activeSyncGenerationId: null,
        syncState: 'not-synced',
        syncedAt: null,
      },
    });
    expect(resolveProjectPath).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionName: 'local',
        projectRelativePath: 'project/a',
      })
    );
  });

  it('does not allow project path validation to accept legacy scalar projectId', async () => {
    const provider = createIdeGsmProjectStepConfigProvider({
      enabled: true,
      connectionRuntime,
    });
    const step = getStep(provider.getCreateStepConfigs(), 'project-path');

    expect(await step.validate?.({ connectionName: 'local', projectId: 'legacy' })).toBe(false);
  });
});

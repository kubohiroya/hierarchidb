import type { PluginStepConfig } from '@hierarchidb/plugin-base';
import type { IdeGsmConnectionRuntimeProvider } from '@hierarchidb/ui-ide-gsm-connection';
import { describe, expect, it, vi } from 'vitest';
import { FdmPluginManifest } from '../../../index.js';
import { createFdmStepConfigProvider } from '../createFdmStepConfigProvider.js';
import type { FdmPluginDialogData } from '../fdmStepProviderTypes.js';

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
  steps: ReadonlyArray<PluginStepConfig<FdmPluginDialogData>>,
  id: string
): PluginStepConfig<FdmPluginDialogData> => {
  const step = steps.find((entry) => entry.id === id);
  if (!step) {
    throw new Error(`missing step ${id}`);
  }
  return step;
};

describe('createFdmStepConfigProvider', () => {
  it('keeps the step provider disabled by default', () => {
    const provider = createFdmStepConfigProvider({ enabled: false });

    expect(provider.getCreateStepConfigs()).toEqual([]);
  });

  it('registers a shared connection step with FDM space selection when enabled', () => {
    const provider = createFdmStepConfigProvider({
      enabled: true,
      connectionRuntime,
      fdmRuntime: {
        listSpaces: vi.fn().mockResolvedValue({ defaultSpaceId: 'space-a', spaces: [] }),
        promoteNode: vi.fn(),
      },
    });

    expect(provider.getCreateStepConfigs().map((step) => step.id)).toEqual(['connection']);
  });

  it('uses the canonical ViewInArOutlined icon manifest for create menus', () => {
    expect(FdmPluginManifest).toMatchObject({
      nodeType: 'fdm',
      visibility: {
        showInCreateMenu: true,
        showInPluginList: true,
      },
      icon: {
        mui: 'ViewInArOutlined',
        component: {
          specifier: '@hierarchidb/fdm-plugin/icon',
          exportName: 'FdmPluginIcon',
        },
      },
    });
  });

  it('promotes connection and space to complete version 1 canonical data', async () => {
    const promoteNode = vi.fn().mockImplementation(async (input) => ({
      nodeId: input.nodeId,
      nodeVersion: 3,
      data: {
        version: 1,
        connectionName: input.draft.connectionName,
        spaceId: input.draft.spaceId,
        viewMode: 'lattice-3d',
        filters: {
          profiles: [],
          datasets: [],
          computes: [],
          checkpoints: [],
        },
        axisMap: {
          xOuter: 'profile',
          xInner: 'dataset',
          y: 'checkpoint',
          z: 'compute',
        },
        tabularSnapshotRefs: [],
      },
    }));
    const provider = createFdmStepConfigProvider({
      enabled: true,
      connectionRuntime,
      fdmRuntime: {
        listSpaces: vi.fn(),
        promoteNode,
      },
    });
    const step = getStep(provider.getCreateStepConfigs(), 'connection');
    const guard = step.capabilities?.beforeNavigateNext;
    if (!guard) {
      throw new Error('missing FDM connection guard');
    }

    const result = await guard(
      {
        connectionName: 'local',
        spaceId: 'space-a',
      },
      {
        mode: 'create',
        nodeId: 'node-a',
        currentStepId: 'connection',
        targetStepId: 'dashboard',
        currentStepIndex: 1,
        targetStepIndex: 2,
        dialogData: { connectionName: 'local', spaceId: 'space-a' },
        draftData: { connectionName: 'local', spaceId: 'space-a' },
        signal: new AbortController().signal,
        setPhase: vi.fn(),
        setCancellable: vi.fn(),
      }
    );

    expect(result).toEqual({
      type: 'advance',
      nodeId: 'node-a',
      nodeVersion: 3,
      canonicalData: {
        version: 1,
        connectionName: 'local',
        spaceId: 'space-a',
        viewMode: 'lattice-3d',
        filters: {
          profiles: [],
          datasets: [],
          computes: [],
          checkpoints: [],
        },
        axisMap: {
          xOuter: 'profile',
          xInner: 'dataset',
          y: 'checkpoint',
          z: 'compute',
        },
        tabularSnapshotRefs: [],
      },
    });
    expect(promoteNode).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNodeVersion: undefined,
        draft: {
          connectionName: 'local',
          spaceId: 'space-a',
        },
      })
    );
  });

  it('rejects missing space without creating fallback node data', async () => {
    const provider = createFdmStepConfigProvider({
      enabled: true,
      connectionRuntime,
      fdmRuntime: {
        listSpaces: vi.fn(),
        promoteNode: vi.fn(),
      },
    });
    const step = getStep(provider.getCreateStepConfigs(), 'connection');

    expect(await step.validate?.({ connectionName: 'local' })).toBe(false);
  });
});

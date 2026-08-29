import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it, vi } from 'vitest';
import {
  buildMountedIdeGsmSimCommand,
  createMountedIdeGsmCommandExecutor,
  MOUNTED_IDE_GSM_SIM_ACTION,
  resolveMountedIdeGsmCommandActions,
} from '../mountedIdeGsmCommandUi.js';

const createNode = (data: TreeNode['data']): TreeNode => {
  const now = Date.now() as Timestamp;
  return {
    id: 'mounted-node' as NodeId,
    parentId: 'r:root' as NodeId,
    nodeType: 'folder' as NodeType,
    metadata: { name: 'mounted-node', tags: [] },
    draftMetadata: null,
    data,
    draftData: undefined,
    depth: 1,
    visible: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
};

describe('mounted IDE-GSM command UI', () => {
  it('shows the local sim action only for mounted project nodes', () => {
    const node = createNode({
      mountKind: 'ide-gsm',
      sourceKind: 'project-root',
      mountId: 'mount-1',
      projectId: 'projects/demo',
      relativePath: '',
    });

    expect(
      resolveMountedIdeGsmCommandActions(node, { mountedIdeGsmCommandUiEnabled: true })
    ).toEqual([
      {
        id: MOUNTED_IDE_GSM_SIM_ACTION,
        label: 'Run local sim',
        disabled: false,
        tooltip: undefined,
      },
    ]);
    expect(
      resolveMountedIdeGsmCommandActions(createNode({}), { mountedIdeGsmCommandUiEnabled: true })
    ).toEqual([]);
  });

  it('keeps the action disabled when the startup-fixed flag is off', () => {
    const node = createNode({
      mountKind: 'ide-gsm',
      sourceKind: 'project-root',
      mountId: 'mount-1',
      projectId: 'projects/demo',
      relativePath: '',
    });

    expect(
      resolveMountedIdeGsmCommandActions(node, { mountedIdeGsmCommandUiEnabled: false })
    ).toEqual([
      {
        id: MOUNTED_IDE_GSM_SIM_ACTION,
        label: 'Run local sim',
        disabled: true,
        tooltip: 'Mounted IDE-GSM command UI is disabled',
      },
    ]);
  });

  it('builds the canonical executeCommand payload for local sim', () => {
    const node = createNode({
      mountKind: 'ide-gsm',
      sourceKind: 'project-root',
      mountId: 'mount-1',
      projectId: 'projects/demo',
      relativePath: 'scenario.yml',
    });

    expect(buildMountedIdeGsmSimCommand(node)).toEqual({
      id: 'sim',
      input: { projectRelativePath: 'projects/demo' },
    });
  });

  it('rejects unsupported nodes and public credential fields before network', async () => {
    const executeCommand = vi.fn();
    const getIdeGsmCredentials = vi.fn();
    const executor = createMountedIdeGsmCommandExecutor({
      config: { mountedIdeGsmCommandUiEnabled: true },
      credentialProvider: { getIdeGsmCredentials },
      createClient: () => ({ executeCommand }),
    });

    await expect(executor.executeSim(createNode({ nodeType: 'folder' }))).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_TARGET',
    });
    await expect(
      executor.executeSim(
        createNode({
          mountKind: 'ide-gsm',
          sourceKind: 'project-root',
          mountId: 'mount-1',
          projectId: 'projects/demo',
          authToken: 'secret',
        })
      )
    ).resolves.toEqual({ ok: false, code: 'UNSUPPORTED_TARGET' });
    expect(getIdeGsmCredentials).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('does not touch credentials or network while the flag is disabled', async () => {
    const executeCommand = vi.fn();
    const getIdeGsmCredentials = vi.fn();
    const executor = createMountedIdeGsmCommandExecutor({
      config: { mountedIdeGsmCommandUiEnabled: false },
      credentialProvider: { getIdeGsmCredentials },
      createClient: () => ({ executeCommand }),
    });

    await expect(
      executor.executeSim(
        createNode({
          mountKind: 'ide-gsm',
          sourceKind: 'project-root',
          mountId: 'mount-1',
          projectId: 'projects/demo',
        })
      )
    ).resolves.toEqual({ ok: false, code: 'FEATURE_DISABLED' });
    expect(getIdeGsmCredentials).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('returns credential unavailable without leaking credential details', async () => {
    const executeCommand = vi.fn();
    const executor = createMountedIdeGsmCommandExecutor({
      config: { mountedIdeGsmCommandUiEnabled: true },
      credentialProvider: {
        getIdeGsmCredentials: vi.fn().mockRejectedValue(new Error('secret-jwt')),
      },
      createClient: () => ({ executeCommand }),
    });

    await expect(
      executor.executeSim(
        createNode({
          mountKind: 'ide-gsm',
          sourceKind: 'project-root',
          mountId: 'mount-1',
          projectId: 'projects/demo',
        })
      )
    ).resolves.toEqual({ ok: false, code: 'CREDENTIALS_UNAVAILABLE' });
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('dispatches local sim through executeCommand', async () => {
    const executeCommand = vi.fn().mockResolvedValue('task-sim');
    const executor = createMountedIdeGsmCommandExecutor({
      config: { mountedIdeGsmCommandUiEnabled: true },
      credentialProvider: {
        getIdeGsmCredentials: vi.fn().mockResolvedValue({
          endpointUrl: 'https://ide-gsm.example.test',
          authToken: 'jwt',
        }),
      },
      createClient: () => ({ executeCommand }),
    });

    await expect(
      executor.executeSim(
        createNode({
          mountKind: 'ide-gsm',
          sourceKind: 'project-root',
          mountId: 'mount-1',
          projectId: 'projects/demo',
        })
      )
    ).resolves.toEqual({ ok: true, commandTaskId: 'task-sim' });
    expect(executeCommand).toHaveBeenCalledWith({
      id: 'sim',
      input: { projectRelativePath: 'projects/demo' },
    });
  });
});

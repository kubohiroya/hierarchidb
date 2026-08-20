import { decodeCanonicalYamlZip } from '@hierarchidb/folder-plugin/canonical-yaml-zip-codec';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalYamlSnapshotWorkflow } from '../../src/canonical-yaml-snapshot/CanonicalYamlSnapshotWorkflow.js';
import { CanonicalYamlSnapshotWorkflowError } from '../../src/canonical-yaml-snapshot/CanonicalYamlSnapshotWorkflowError.js';
import type {
  CanonicalYamlSnapshotClientPort,
  CanonicalYamlSnapshotOnStepChange,
  CanonicalYamlSnapshotStep,
  CanonicalYamlSnapshotWorkflowErrorCode,
} from '../../src/canonical-yaml-snapshot/canonicalYamlSnapshotTypes.js';

const scenario = {
  fileName: 'scenario.yml',
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
} as const;

function canonicalNode(content = 'name: demo\n') {
  return {
    id: 'scenario-node',
    parentId: 'project-folder',
    nodeType: 'yaml-file',
    depth: 2,
    createdAt: 1,
    updatedAt: 2,
    version: 3,
    metadata: { name: scenario.fileName, description: '', tags: [] },
    draftMetadata: null,
    data: {
      subtype: scenario.subtype,
      schemaId: scenario.schemaId,
      content,
    },
    visible: true,
  };
}

function makeClient(): CanonicalYamlSnapshotClientPort {
  return {
    importProject: vi.fn().mockResolvedValue('task-import'),
    awaitTask: vi.fn().mockResolvedValue(undefined),
    calibrate: vi.fn().mockResolvedValue('task-calibrate'),
    simulate: vi.fn().mockResolvedValue('task-simulate'),
    exportProject: vi.fn().mockResolvedValue('task-export'),
  };
}

function rejectClientMethod(
  client: CanonicalYamlSnapshotClientPort,
  method: 'importProject' | 'calibrate' | 'simulate' | 'exportProject',
  error: Error
): void {
  switch (method) {
    case 'importProject':
      client.importProject = vi.fn().mockRejectedValue(error);
      return;
    case 'calibrate':
      client.calibrate = vi.fn().mockRejectedValue(error);
      return;
    case 'simulate':
      client.simulate = vi.fn().mockRejectedValue(error);
      return;
    case 'exportProject':
      client.exportProject = vi.fn().mockRejectedValue(error);
  }
}

describe('CanonicalYamlSnapshotWorkflow', () => {
  it('plans the committed canonical archive before running the fixed task sequence', async () => {
    const client = makeClient();
    const workflow = new CanonicalYamlSnapshotWorkflow(client);
    const events: Array<[CanonicalYamlSnapshotStep, 'running' | 'done' | 'failed']> = [];
    const onStepChange: CanonicalYamlSnapshotOnStepChange = (step, status) => {
      events.push([step, status]);
    };

    await expect(
      workflow.runSimulation([canonicalNode()], 'project/path', undefined, onStepChange)
    ).resolves.toBeUndefined();

    expect(events).toEqual([
      ['import', 'running'],
      ['import', 'done'],
      ['calibrate', 'running'],
      ['calibrate', 'done'],
      ['simulate', 'running'],
      ['simulate', 'done'],
      ['export', 'running'],
      ['export', 'done'],
    ]);
    expect(client.awaitTask).toHaveBeenNthCalledWith(1, 'task-import');
    expect(client.awaitTask).toHaveBeenNthCalledWith(2, 'task-calibrate');
    expect(client.awaitTask).toHaveBeenNthCalledWith(3, 'task-simulate');
    expect(client.awaitTask).toHaveBeenNthCalledWith(4, 'task-export');

    const importCall = vi.mocked(client.importProject).mock.calls[0];
    if (importCall === undefined) throw new Error('missing importProject call');
    expect(importCall[1]).toBe('project/path');
    const decoded = decodeCanonicalYamlZip(importCall[0]);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.entries).toEqual([
      {
        occurrenceIndex: 0,
        filename: scenario.fileName,
        payload: {
          subtype: scenario.subtype,
          schemaId: scenario.schemaId,
          content: 'name: demo\n',
        },
      },
    ]);
  });

  it('does not fall back to draft data when committed data is invalid', async () => {
    const client = makeClient();
    const node = canonicalNode('invalid: [\n');
    node.draftMetadata = { name: scenario.fileName, description: '', tags: [] };
    Object.assign(node, {
      draftData: {
        subtype: scenario.subtype,
        schemaId: scenario.schemaId,
        content: 'name: valid-draft\n',
      },
    });
    const events = vi.fn();

    await expect(
      new CanonicalYamlSnapshotWorkflow(client).runSimulation(
        [node],
        'project/path',
        undefined,
        events
      )
    ).rejects.toMatchObject({
      code: 'SNAPSHOT_PLANNING_FAILED',
      context: {
        planningErrors: [
          { code: 'CANONICAL_VALIDATION_FAILED', sourceIndex: 0, slot: 'committed' },
        ],
      },
    });
    expect(client.importProject).not.toHaveBeenCalled();
    expect(client.awaitTask).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
  });

  it('sanitizes planning failures without exposing YAML content', async () => {
    const client = makeClient();
    const secretContent = 'credential-secret: [\n';

    try {
      await new CanonicalYamlSnapshotWorkflow(client).runSimulation(
        [canonicalNode(secretContent)],
        'project/path'
      );
      throw new Error('expected planning failure');
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalYamlSnapshotWorkflowError);
      expect(JSON.stringify(error)).not.toContain(secretContent);
      expect(String(error)).not.toContain(secretContent);
    }
  });

  it('passes export filters only when the caller provides them', async () => {
    const withoutFilter = makeClient();
    await new CanonicalYamlSnapshotWorkflow(withoutFilter).runSimulation(
      [canonicalNode()],
      'project/path'
    );
    expect(withoutFilter.exportProject).toHaveBeenCalledWith('project/path');

    const withFilter = makeClient();
    const filter = { include: ['output/**'], exclude: ['cache/**'] };
    await new CanonicalYamlSnapshotWorkflow(withFilter).runSimulation(
      [canonicalNode()],
      'project/path',
      filter
    );
    expect(withFilter.exportProject).toHaveBeenCalledWith('project/path', filter);
  });

  it('stops after every failed task without retrying or exposing the client error', async () => {
    const cases: ReadonlyArray<
      readonly [
        'importProject' | 'calibrate' | 'simulate' | 'exportProject',
        CanonicalYamlSnapshotStep,
        CanonicalYamlSnapshotWorkflowErrorCode,
        number,
      ]
    > = [
      ['importProject', 'import', 'IMPORT_FAILED', 0],
      ['calibrate', 'calibrate', 'CALIBRATE_FAILED', 1],
      ['simulate', 'simulate', 'SIMULATE_FAILED', 2],
      ['exportProject', 'export', 'EXPORT_FAILED', 3],
    ];

    for (const [method, step, code, completedSteps] of cases) {
      const client = makeClient();
      rejectClientMethod(client, method, new Error('endpoint-token-secret'));
      const events: Array<[CanonicalYamlSnapshotStep, 'running' | 'done' | 'failed']> = [];

      try {
        await new CanonicalYamlSnapshotWorkflow(client).runSimulation(
          [canonicalNode()],
          'project/path',
          undefined,
          (changedStep, status) => events.push([changedStep, status])
        );
        throw new Error('expected task failure');
      } catch (error) {
        expect(error).toMatchObject({ code, context: { step } });
        expect(String(error)).not.toContain('endpoint-token-secret');
        expect(JSON.stringify(error)).not.toContain('endpoint-token-secret');
      }

      expect(events.at(-1)).toEqual([step, 'failed']);
      expect(events).toHaveLength(completedSteps * 2 + 2);
      expect(vi.mocked(client[method])).toHaveBeenCalledTimes(1);
      const methodOrder = ['importProject', 'calibrate', 'simulate', 'exportProject'] as const;
      for (const laterMethod of methodOrder.slice(completedSteps + 1)) {
        expect(client[laterMethod]).not.toHaveBeenCalled();
      }
    }
  });

  it('rejects an invalid task ID before awaiting it', async () => {
    const client = makeClient();
    client.importProject = vi.fn().mockResolvedValue('');

    await expect(
      new CanonicalYamlSnapshotWorkflow(client).runSimulation([canonicalNode()], 'project/path')
    ).rejects.toMatchObject({ code: 'IMPORT_FAILED', context: { step: 'import' } });
    expect(client.awaitTask).not.toHaveBeenCalled();
    expect(client.calibrate).not.toHaveBeenCalled();
  });

  it('converts callback failures to a sanitized terminal error before network access', async () => {
    const client = makeClient();

    await expect(
      new CanonicalYamlSnapshotWorkflow(client).runSimulation(
        [canonicalNode()],
        'project/path',
        undefined,
        () => {
          throw new Error('callback-secret');
        }
      )
    ).rejects.toMatchObject({ code: 'STEP_CALLBACK_FAILED', context: { step: 'import' } });
    expect(client.importProject).not.toHaveBeenCalled();
  });
});

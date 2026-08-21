import 'fake-indexeddb/auto';
import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import {
  TreeNodeUpdaterService,
  type YamlCanonicalDialogWriter,
} from '../../TreeNodeUpdaterService.js';

const nodeId = toNodeId('p:yaml-dialog');
const parentId = toNodeId('p:root');
const canonicalPayload = Object.freeze({
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
  content: 'name: demo\n',
});

function yamlNode(): TreeNode {
  return {
    id: nodeId,
    parentId,
    nodeType: toNodeType('yaml-file'),
    depth: 1,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    visible: true,
    metadata: { name: 'scenario.yml', description: '', tags: [] },
    draftMetadata: { name: 'scenario.yml', description: '', tags: [] },
    data: canonicalPayload,
    draftData: canonicalPayload,
  } as TreeNode;
}

describe('TreeNodeUpdaterService canonical YAML dialog connector', () => {
  let coreDB: CoreDB;

  beforeEach(async () => {
    coreDB = CoreDB.createForTest(`yaml-dialog-${crypto.randomUUID()}`);
    await coreDB.open();
    await coreDB.nodes.add(yamlNode());
  });

  afterEach(async () => {
    (globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean }).__HDB_SILENCE_WORKER_LOGS__ = true;
    coreDB.close();
    await coreDB.delete();
  });

  it('routes one complete save-draft request through one canonical writer port', async () => {
    const writer = vi.fn<YamlCanonicalDialogWriter>(async (input, writePort) => {
      expect(input).toEqual({
        nodeId,
        mode: 'save-draft',
        filename: 'scenario.yml',
        description: 'Scenario',
        tags: ['demo'],
        payload: canonicalPayload,
      });
      await writePort({
        nodeId,
        mode: 'save-draft',
        draftMetadata: {
          name: 'scenario.yml',
          description: 'Scenario',
          tags: ['demo'],
        },
        draftData: canonicalPayload,
        onNameConflict: 'error',
      });
      return { ok: true };
    });
    const updater = new TreeNodeUpdaterService(coreDB, undefined, undefined, writer);

    const result = await updater.updateTreeNode(nodeId, {
      dialogUIState: { dialogProgress: { activeStepIndex: 2 } },
      draftMetadata: {
        name: 'scenario.yml',
        description: 'Scenario',
        tags: ['demo'],
      },
      draftData: canonicalPayload,
      mode: 'save-draft',
    });

    expect(result.status).toBe('ok');
    expect(writer).toHaveBeenCalledOnce();
    await expect(coreDB.nodes.get(nodeId)).resolves.toMatchObject({
      draftMetadata: {
        name: 'scenario.yml',
        description: 'Scenario',
        tags: ['demo'],
      },
      draftData: canonicalPayload,
      dialogUIState: { dialogProgress: { activeStepIndex: 2 } },
      isTemporary: false,
    });
  });

  it('rejects partial or extra YAML requests before the writer and storage', async () => {
    const writer = vi.fn<YamlCanonicalDialogWriter>();
    const updater = new TreeNodeUpdaterService(coreDB, undefined, undefined, writer);
    const before = await coreDB.nodes.get(nodeId);

    await expect(
      updater.updateTreeNode(nodeId, {
        dialogUIState: { dialogProgress: { activeStepIndex: 2 } },
        draftMetadata: { name: 'scenario.yml' },
        draftData: canonicalPayload,
        mode: 'save-draft',
      })
    ).rejects.toThrow('yaml-canonical-dialog-write-rejected:INVALID_INPUT');

    expect(writer).not.toHaveBeenCalled();
    expect(await coreDB.nodes.get(nodeId)).toEqual(before);
  });

  it('does not log canonical YAML content while saving', async () => {
    const secretPayload = Object.freeze({
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      content: 'name: sanitized-debug-secret\n',
    });
    const writer = vi.fn<YamlCanonicalDialogWriter>(async (_input, writePort) => {
      await writePort({
        nodeId,
        mode: 'save',
        draftMetadata: {
          name: 'scenario.yml',
          description: 'Scenario',
          tags: ['demo'],
        },
        draftData: secretPayload,
        onNameConflict: 'error',
      });
      return { ok: true };
    });
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    (globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean }).__HDB_SILENCE_WORKER_LOGS__ = false;
    const updater = new TreeNodeUpdaterService(coreDB, undefined, undefined, writer);

    await updater.updateTreeNode(nodeId, {
      dialogUIState: { dialogProgress: { activeStepIndex: 2 } },
      draftMetadata: {
        name: 'scenario.yml',
        description: 'Scenario',
        tags: ['demo'],
      },
      draftData: secretPayload,
      mode: 'save',
    });

    expect(JSON.stringify(debug.mock.calls)).not.toContain('sanitized-debug-secret');
  });

  it('rejects split YAML draft mutation methods without writing', async () => {
    const writer = vi.fn<YamlCanonicalDialogWriter>();
    const updater = new TreeNodeUpdaterService(coreDB, undefined, undefined, writer);
    const before = await coreDB.nodes.get(nodeId);

    await expect(
      updater.updateTreeNodeDraftMetadata(nodeId, { description: 'partial' })
    ).rejects.toThrow('yaml-canonical-dialog-update-required');
    await expect(
      updater.updateTreeNodeDraftData(nodeId, { content: 'name: changed\n' })
    ).rejects.toThrow('yaml-canonical-dialog-update-required');

    expect(writer).not.toHaveBeenCalled();
    expect(await coreDB.nodes.get(nodeId)).toEqual(before);
  });
});

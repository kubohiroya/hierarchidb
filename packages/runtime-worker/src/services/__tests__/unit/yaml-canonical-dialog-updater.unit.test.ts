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
      draftMetadata: {
        name: 'scenario.yml',
        description: 'Scenario',
        tags: ['demo'],
      },
      draftData: canonicalPayload,
      mode: 'save-draft',
      onNameConflict: 'error',
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
      isTemporary: false,
    });
  });

  it('rejects partial or extra YAML requests before the writer and storage', async () => {
    const writer = vi.fn<YamlCanonicalDialogWriter>();
    const updater = new TreeNodeUpdaterService(coreDB, undefined, undefined, writer);
    const before = await coreDB.nodes.get(nodeId);

    await expect(
      updater.updateTreeNode(nodeId, {
        draftMetadata: { name: 'scenario.yml' },
        draftData: canonicalPayload,
        mode: 'save-draft',
        onNameConflict: 'error',
      })
    ).rejects.toThrow('yaml-canonical-dialog-write-rejected:INVALID_INPUT');

    expect(writer).not.toHaveBeenCalled();
    expect(await coreDB.nodes.get(nodeId)).toEqual(before);
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

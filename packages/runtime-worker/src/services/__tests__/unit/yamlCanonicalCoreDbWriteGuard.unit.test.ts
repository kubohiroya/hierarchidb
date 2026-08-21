import 'fake-indexeddb/auto';
import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../CoreDB.js';

const canonicalPayload = Object.freeze({
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
  content: 'name: demo\n',
});

function canonicalNode(id: string): TreeNode {
  return {
    id: toNodeId(id),
    parentId: toNodeId('p:root'),
    nodeType: toNodeType('yaml-file'),
    depth: 1,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    visible: true,
    metadata: { name: 'scenario.yml', description: '', tags: [] },
    draftMetadata: null,
    data: canonicalPayload,
  } as unknown as TreeNode;
}

function placeholderNode(id: string): TreeNode {
  return {
    id: toNodeId(id),
    parentId: toNodeId('p:root'),
    nodeType: toNodeType('yaml-file'),
    depth: 1,
    createdAt: 1,
    updatedAt: 1,
    version: 0,
    visible: true,
    metadata: { name: 'New YAML', description: '', tags: [] },
    draftMetadata: { name: 'New YAML', description: '', tags: [] },
    data: null,
    draftData: {},
    isTemporary: true,
  } as unknown as TreeNode;
}

describe('CoreDB canonical YAML write guard', () => {
  let coreDB: CoreDB;

  beforeEach(async () => {
    coreDB = CoreDB.createForCanonicalRuntime(`yaml-write-guard-${crypto.randomUUID()}`);
    await coreDB.open();
  });

  afterEach(async () => {
    coreDB.close();
    await coreDB.delete();
  });

  it('accepts complete canonical nodes and the exact temporary placeholder', async () => {
    await expect(coreDB.nodes.add(canonicalNode('canonical'))).resolves.toBe('canonical');
    await expect(coreDB.nodes.add(placeholderNode('placeholder'))).resolves.toBe('placeholder');
  });

  it('rejects legacy and incomplete YAML postimages without persisting them', async () => {
    const legacy = canonicalNode('legacy') as TreeNode & { data: unknown };
    legacy.data = {
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: legacy\n',
    };
    await expect(coreDB.nodes.add(legacy)).rejects.toThrow(
      'yaml-canonical-tree-node-postimage-required'
    );
    await expect(coreDB.nodes.get(toNodeId('legacy'))).resolves.toBeUndefined();
  });

  it('rejects an invalid generic update and retains the canonical preimage', async () => {
    const node = canonicalNode('updated');
    await coreDB.nodes.add(node);
    await expect(
      coreDB.nodes.update(node.id, {
        draftMetadata: { name: 'scenario.yml', description: '', tags: [] },
        draftData: { schemaId: 'ide-gsm/scenario' },
      })
    ).rejects.toThrow('yaml-canonical-tree-node-postimage-required');
    await expect(coreDB.nodes.get(node.id)).resolves.toMatchObject({
      draftMetadata: null,
      data: canonicalPayload,
    });
  });

  it('does not invoke accessors while rejecting unsafe YAML input', async () => {
    const getter = vi.fn(() => canonicalPayload);
    const node = canonicalNode('accessor');
    Object.defineProperty(node, 'data', { enumerable: true, get: getter });
    await expect(coreDB.nodes.add(node)).rejects.toThrow(
      'yaml-canonical-tree-node-postimage-required'
    );
    expect(getter).not.toHaveBeenCalled();
  });
});

import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '~/services/CoreDB';
import { discardTreeNodeDraft } from '~/services/draft/cleanupOperations';
import { initTreeNode } from '~/services/draft/initOperations';

describe('discardTreeNodeDraft', () => {
  const treeId = 'tree' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  const parentId = `${treeId}:parent` as NodeId;
  let core: CoreDB;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-wc-cleanup`);
    const now = Date.now();
    await core.nodes.bulkPut([
      {
        id: rootId,
        parentId: null,
        nodeType: 'root' as NodeType,
        metadata: { name: 'Root', description: undefined, tags: [] },
        draftMetadata: null,
        data: null,
        draftData: undefined,
        depth: 0,
        visible: true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      },
      {
        id: parentId,
        parentId: rootId,
        nodeType: 'folder' as NodeType,
        metadata: { name: 'Parent', description: undefined, tags: [] },
        draftMetadata: null,
        data: {},
        draftData: undefined,
        depth: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      },
    ]);
  });

  afterEach(() => {
    CoreDB.resetInstance();
  });

  it('deletes create-only drafts without committed atoms when forced', async () => {
    const draftId = await initTreeNode(core, treeId, parentId, 'folder' as NodeType, 'New Folder');
    const before = await core.nodes.get(draftId);
    expect(before).toBeDefined();

    await discardTreeNodeDraft(core, draftId, { forceDelete: true });

    const after = await core.nodes.get(draftId);
    expect(after).toBeUndefined();
  });

  it('keeps create drafts with committed-like payload when forceDelete is set but committed signals exist', async () => {
    const now = Date.now();
    const nodeId = `${parentId}:with-data` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId,
      nodeType: 'shape' as NodeType,
      metadata: { name: 'Draft with data', description: undefined, tags: [] },
      draftMetadata: { name: 'Draft with data', description: undefined, tags: [] },
      data: { foo: 'bar' },
      draftData: { foo: 'bar' },
      depth: 2,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    await discardTreeNodeDraft(core, nodeId, { forceDelete: true });

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { data?: unknown }).data).toEqual({ foo: 'bar' });
  });

  it('preserves committed metadata-only nodes and clears draft fields', async () => {
    const now = Date.now();
    const nodeId = `${parentId}:child` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Child', description: undefined, tags: [] },
      draftMetadata: { name: 'Child draft', description: 'draft', tags: [] },
      data: null,
      draftData: { foo: 'bar' },
      depth: 2,
      visible: true,
      createdAt: now - 1_000,
      updatedAt: now,
      version: 2,
      lastTouchedAt: now,
    });

    await discardTreeNodeDraft(core, nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftMetadata?: unknown }).draftMetadata).toBeNull();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { data?: unknown }).data).toBeNull();
    expect((stored as { metadata?: { name?: string } }).metadata?.name).toBe('Child');
  });

  it('preserves draftData-only nodes (import template) and clears drafts', async () => {
    const now = Date.now();
    const nodeId = `${parentId}:template` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Template Node', description: undefined, tags: [] },
      draftMetadata: { name: 'Template Node', description: undefined, tags: [] },
      data: null,
      draftData: { foo: 'bar' },
      depth: 2,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    await discardTreeNodeDraft(core, nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftMetadata?: unknown }).draftMetadata).toBeNull();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { data?: unknown }).data).toBeNull();
    expect((stored as { metadata?: { name?: string } }).metadata?.name).toBe('Template Node');
  });
});

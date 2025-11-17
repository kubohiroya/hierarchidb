import 'fake-indexeddb/auto';
import type {
  NodeId,
  NodeType,
  TreeChangeEvent,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import { Dexie, type Table } from 'dexie';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CoreDB } from '../../CoreDB.js';
import { FulltextIndexService } from '../../FulltextIndexService.js';
import type { FulltextIndexRecord, FulltextNodeRecord } from '../../fulltext-types.js';

class TestCoreDB {
  public readonly changeSubject = new Subject<TreeChangeEvent>();
  public readonly db: Dexie;
  public readonly nodes: Table<TreeNode, NodeId>;
  public readonly fulltextNodes: Table<FulltextNodeRecord, [TreeId, NodeId]>;
  public readonly fulltextIndexes: Table<FulltextIndexRecord, [TreeId, string]>;

  constructor(name: string) {
    this.db = new Dexie(name);
    this.db.version(1).stores({
      nodes: '&id,parentId',
      fulltextNodes: '&[treeId+nodeId], treeId, nodeId, updatedAt',
      fulltextIndexes: '&[treeId+locale], treeId, locale, dirty',
    });
    this.nodes = this.db.table('nodes');
    this.fulltextNodes = this.db.table('fulltextNodes');
    this.fulltextIndexes = this.db.table('fulltextIndexes');
  }

  async listDescendants(nodeId: NodeId): Promise<TreeNode[]> {
    const out: TreeNode[] = [];
    const stack: NodeId[] = [nodeId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      const children = await this.nodes.where('parentId').equals(current).toArray();
      for (const child of children) {
        out.push(child);
        stack.push(child.id);
      }
    }
    return out;
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return await this.nodes.get(nodeId);
  }
}

describe('FulltextIndexService', () => {
  const treeId = 'r' as TreeId;
  const rootId = 'r:root' as NodeId;
  const childId = 'r:child' as NodeId;

  let core: TestCoreDB;
  let service: FulltextIndexService;

  const baseNode = (overrides: Partial<TreeNode>): TreeNode => ({
    id: overrides.id ?? rootId,
    parentId: overrides.parentId,
    nodeType: overrides.nodeType ?? ('folder' as NodeType),
    name: overrides.name ?? 'Root',
    depth: overrides.depth ?? 0,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    version: overrides.version ?? 1,
  });

  let dbName: string;

  beforeEach(async () => {
    dbName = `fulltext-${Date.now()}-${Math.random()}`;
    core = new TestCoreDB(dbName);
    await core.nodes.bulkPut([
      baseNode({ id: rootId, name: 'Root', depth: 0 }),
      baseNode({ id: childId, parentId: rootId, name: 'Alpha node', depth: 1 }),
    ]);

    service = await FulltextIndexService.createForTesting(core as unknown as CoreDB);
  });

  afterEach(async () => {
    service.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await core.db.delete();
  });

  it('builds and serializes index per locale', async () => {
    const results = await service.search({ rootNodeId: rootId, query: 'Alpha', locale: 'en' });
    expect(results.map((node) => node.id)).toEqual([childId]);

    const state = await core.fulltextIndexes.get([treeId, 'en']);
    expect(state?.dirty).toBe(false);
    expect(state?.serializedIndex).toBeTruthy();
  });

  it('marks indexes dirty on CRUD events and reflects updates after rebuild', async () => {
    await service.search({ rootNodeId: rootId, query: 'Alpha', locale: 'en' });

    core.changeSubject.next({
      type: 'node-updated',
      nodeId: childId,
      node: baseNode({ id: childId, parentId: rootId, name: 'Beta node', depth: 1 }),
      timestamp: Date.now(),
    });

    // wait for async dirty mark
    await new Promise((resolve) => setTimeout(resolve, 20));
    const dirtyState = await core.fulltextIndexes.get([treeId, 'en']);
    expect(dirtyState).toBeTruthy();
    const storedRecord = await core.fulltextNodes.get([treeId, childId]);
    expect(storedRecord?.name).toBe('Beta node');

    const results = await service.search({ rootNodeId: rootId, query: 'Beta', locale: 'en' });
    expect(results.map((node) => node.id)).toEqual([childId]);

    const cleanState = await core.fulltextIndexes.get([treeId, 'en']);
    expect(cleanState?.dirty).toBe(false);
  });

  it('creates per-locale indexes when UI requests new locale', async () => {
    await service.search({ rootNodeId: rootId, query: 'Alpha', locale: 'ja' });
    const jaState = await core.fulltextIndexes.get([treeId, 'ja']);
    expect(jaState).toBeTruthy();
    expect(jaState?.locale).toBe('ja');
  });
});

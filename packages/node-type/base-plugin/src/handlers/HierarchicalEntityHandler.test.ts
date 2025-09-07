import Dexie, { type Table } from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { HierarchicalEntityHandler, type HierarchicalEntity } from './HierarchicalEntityHandler';

interface HEntity extends HierarchicalEntity {
  name?: string;
}

class HDb extends Dexie {
  public entities!: Table<HEntity, EntityId>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      entities: '&id, nodeId, parentId, name, createdAt, updatedAt',
    });
  }
}

class HHandler extends HierarchicalEntityHandler<HEntity> {
  protected table: Table<HEntity, EntityId>;
  constructor(table: Table<HEntity, EntityId>) {
    super();
    this.table = table as unknown as Table<HEntity, EntityId, HEntity>;
  }
  protected buildEntity(nodeId: NodeId, entityId: EntityId, data: Partial<HEntity>): HEntity {
    const now = Date.now();
    return {
      id: entityId,
      nodeId,
      parentId: data.parentId,
      name: data.name ?? String(nodeId),
      depth: data.parentId ? 1 : 0,
      path: data.parentId ? `/${String(data.parentId)}/${String(nodeId)}` : `/${String(nodeId)}`,
      childCount: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }
}

describe('HierarchicalEntityHandler (minimal)', () => {
  let db: HDb;
  let handler: HHandler;

  beforeEach(async () => {
    db = new HDb(`hier-base-plugin-test-${crypto.randomUUID()}`);
    await db.open();
    handler = new HHandler(db.entities);
  });

  it('happy path: getPath returns [root, parent, node]', async () => {
    const a = (crypto.randomUUID() as NodeId);
    const b = (crypto.randomUUID() as NodeId);
    const c = (crypto.randomUUID() as NodeId);

    await handler.createEntity(a, { name: 'A' });
    await handler.createEntity(b, { parentId: a, name: 'B' } as Partial<HEntity>);
    await handler.createEntity(c, { parentId: b, name: 'C' } as Partial<HEntity>);

    const path = await handler.getPath(c);
    expect(path.map((e) => e.name)).toEqual(['A', 'B', 'C']);
  });

  it('error path: move node under its descendant should throw', async () => {
    const a = (crypto.randomUUID() as NodeId);
    const b = (crypto.randomUUID() as NodeId);
    const c = (crypto.randomUUID() as NodeId);

    await handler.createEntity(a, { name: 'A' });
    await handler.createEntity(b, { parentId: a, name: 'B' } as Partial<HEntity>);
    await handler.createEntity(c, { parentId: b, name: 'C' } as Partial<HEntity>);

    await expect(handler.moveNode(a, c)).rejects.toThrow('Cannot move node to its descendant');
  });
});


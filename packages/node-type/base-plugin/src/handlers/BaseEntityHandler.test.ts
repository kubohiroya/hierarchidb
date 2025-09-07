import Dexie, { type Table } from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import type { NodeId, EntityId, BaseEntity } from '@hierarchidb/common-type';
import { BaseEntityHandler } from './BaseEntityHandler';

interface TestEntity extends BaseEntity {
  nodeId: NodeId;
  name?: string;
}

class TestDb extends Dexie {
  public testEntities!: Table<TestEntity, EntityId>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      testEntities: '&id, nodeId, name, createdAt, updatedAt',
    });
  }
}

class TestEntityHandler extends BaseEntityHandler<TestEntity> {
  protected table: Table<TestEntity, EntityId>;
  constructor(table: Table<TestEntity, EntityId>) {
    super();
    this.table = table as unknown as Table<TestEntity, EntityId, TestEntity>;
  }
  protected buildEntity(nodeId: NodeId, entityId: EntityId, data: Partial<TestEntity>): TestEntity {
    const now = Date.now();
    return {
      id: entityId,
      nodeId,
      name: data.name ?? 'test',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }
}

describe('BaseEntityHandler (minimal)', () => {
  let db: TestDb;
  let handler: TestEntityHandler;

  beforeEach(async () => {
    db = new TestDb(`base-plugin-test-${crypto.randomUUID()}`);
    await db.open();
    handler = new TestEntityHandler(db.testEntities);
  });

  it('happy path: create and get entity', async () => {
    const nodeId = 'node-1' as NodeId;
    const entity = await handler.createEntity(nodeId, { name: 'hello' });

    const fetched = await handler.getEntity(entity.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(entity.id);
    expect(fetched!.nodeId).toBe(nodeId);
    expect(fetched!.version).toBe(1);
  });

  it('error path: update non-existing entity should throw', async () => {
    const missingId = 'missing-entity' as EntityId;
    await expect(handler.updateEntity(missingId, { name: 'x' } as Partial<TestEntity>)).rejects.toThrow(
      `Entity not found: ${missingId}`,
    );
  });
});


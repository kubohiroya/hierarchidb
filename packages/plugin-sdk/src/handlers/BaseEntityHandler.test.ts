import Dexie, { type Table } from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BaseEntity, NodeId } from '@hierarchidb/common-types';
import { BaseEntityHandler } from './BaseEntityHandler.js';

interface TestEntity extends BaseEntity {
  nodeId: NodeId;
  name?: string;
}

class TestDb extends Dexie {
  public testEntities!: Table<TestEntity, NodeId>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      testEntities: '&id, nodeId, name, createdAt, updatedAt',
    });
  }
}

class TestEntityHandler extends BaseEntityHandler<TestEntity> {
  protected table: Table<TestEntity, NodeId>;

  constructor(table: Table<TestEntity, NodeId>) {
    super();
    this.table = table as unknown as Table<TestEntity, NodeId, TestEntity>;
  }

  protected buildEntity(nodeId: NodeId, entityId: NodeId, data: Partial<TestEntity>): TestEntity {
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
    const missingId = 'missing-entity' as unknown as NodeId;
    await expect(handler.updateEntity(missingId, { name: 'x' } as Partial<TestEntity>)).rejects.toThrow(
      `Entity not found: ${missingId}`,
    );
  });
});

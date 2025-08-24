/**
 * @file BaseEntityHandler.test.ts
 * @description Unit tests for BaseEntityHandler abstract class
 */

import type {
  PeerEntity,
  GroupEntity,
  WorkingCopyProperties,
  NodeId,
  EntityId,
} from '@hierarchidb/common-core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseEntityHandler } from './BaseEntityHandler';

// Mock entity types
interface TestEntity extends PeerEntity {
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface TestSubEntity extends GroupEntity {
  id: EntityId;
  nodeId: NodeId;
  parentId: NodeId;
  subEntityType: string;
  type: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface TestWorkingCopy extends TestEntity, WorkingCopyProperties {
  workingCopyId: string;
  workingCopyOf: NodeId;
  isDirty: boolean;
  nodeType: string;
  parentId: NodeId;
}

// Concrete implementation for testing
class TestEntityHandler extends BaseEntityHandler<TestEntity, TestSubEntity, TestWorkingCopy> {
  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    subEntityTableName?: string
  ) {
    super(db, tableName, workingCopyTableName, subEntityTableName);
  }
  async createEntity(nodeId: NodeId, data?: Partial<TestEntity>): Promise<TestEntity> {
    const now = Date.now();
    const entity: TestEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId: nodeId,
      name: data?.name || 'Test Entity',
      description: data?.description,
      createdAt: data?.createdAt || now,
      updatedAt: data?.updatedAt || now,
      version: data?.version || 1,
    };

    await this.db.table(this.tableName).add(entity);
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<TestEntity | undefined> {
    return await this.db.table(this.tableName).where('nodeId').equals(nodeId).first();
  }

  async updateEntity(nodeId: NodeId, data: Partial<TestEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    await this.db
      .table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      .modify({
        ...data,
        updatedAt: this.now(),
        version: (existing.version || 0) + 1,
      });
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    await this.db.table(this.tableName).where('nodeId').equals(nodeId).delete();
  }
}

describe('BaseEntityHandler', () => {
  let db: Dexie;
  let handler: TestEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;

  beforeEach(async () => {
    // Create in-memory database
    db = new Dexie('TestDB');
    db.version(1).stores({
      entities: '&nodeId, name, createdAt, updatedAt',
      workingCopies: '&workingCopyId, workingCopyOf, nodeId',
      subEntities: '[parentNodeId+subEntityType], id',
    });

    await db.open();

    handler = new TestEntityHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Entity CRUD Operations', () => {
    it('should create an entity', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Test Entity',
        description: 'Test Description',
      });

      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('Test Entity');
      expect(entity.description).toBe('Test Description');
      expect(entity.version).toBe(1);
    });

    it('should get an entity', async () => {
      await handler.createEntity(testNodeId, { name: 'Test' });

      const entity = await handler.getEntity(testNodeId);
      expect(entity).toBeDefined();
      expect(entity?.nodeId).toBe(testNodeId);
    });

    it('should update an entity', async () => {
      await handler.createEntity(testNodeId, { name: 'Original' });

      await handler.updateEntity(testNodeId, { name: 'Updated' });

      const entity = await handler.getEntity(testNodeId);
      expect(entity?.name).toBe('Updated');
      expect(entity?.version).toBe(2);
    });

    it('should delete an entity', async () => {
      await handler.createEntity(testNodeId, { name: 'Test' });

      await handler.deleteEntity(testNodeId);

      const entity = await handler.getEntity(testNodeId);
      expect(entity).toBeUndefined();
    });
  });

  describe('Working Copy Operations', () => {
    beforeEach(async () => {
      await handler.createEntity(testNodeId, {
        name: 'Original Entity',
        description: 'Original Description',
      });
    });

    it('should create a working copy', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId);

      expect(workingCopy.workingCopyOf).toBe(testNodeId);
      expect(workingCopy.workingCopyId).toBeDefined();
      expect(workingCopy.isDirty).toBe(false);
      expect(workingCopy.name).toBe('Original Entity');
    });

    it('should commit a working copy', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId);
      workingCopy.name = 'Modified Name';
      workingCopy.isDirty = true;

      await handler.commitWorkingCopy(testNodeId, workingCopy);

      const entity = await handler.getEntity(testNodeId);
      expect(entity?.name).toBe('Modified Name');

      // Working copy should be deleted
      const remainingCopy = await db.table('workingCopies').get(workingCopy.workingCopyId);
      expect(remainingCopy).toBeUndefined();
    });

    it('should discard a working copy', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId);

      await handler.discardWorkingCopy(testNodeId);

      const remainingCopy = await db.table('workingCopies').get(workingCopy.workingCopyId);
      expect(remainingCopy).toBeUndefined();

      // Original entity should remain unchanged
      const entity = await handler.getEntity(testNodeId);
      expect(entity?.name).toBe('Original Entity');
    });
  });

  describe('Sub-Entity Operations', () => {
    it('should create a sub-entity', async () => {
      await handler.createEntity(testNodeId);

      const subEntity: TestSubEntity = {
        id: 'sub-1' as EntityId,
        nodeId: testNodeId,
        parentId: testNodeId,
        subEntityType: 'test-type',
        type: 'test-type',
        value: 'test-value',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await handler.createGroupEntity?.(testNodeId, 'test-type', subEntity);

      const subEntities = await handler.getGroupEntities?.(testNodeId, 'test-type');
      expect(subEntities).toHaveLength(1);
      expect(subEntities?.[0]?.value).toBe('test-value');
    });

    it('should get sub-entities by type', async () => {
      await handler.createEntity(testNodeId);

      // Create sub-entities of different types
      await handler.createGroupEntity?.(testNodeId, 'type1', { value: 'value1' } as any);
      await handler.createGroupEntity?.(testNodeId, 'type1', { value: 'value2' } as any);
      await handler.createGroupEntity?.(testNodeId, 'type2', { value: 'value3' } as any);

      const type1Entities = await handler.getGroupEntities?.(testNodeId, 'type1');
      expect(type1Entities).toHaveLength(2);

      const type2Entities = await handler.getGroupEntities?.(testNodeId, 'type2');
      expect(type2Entities).toHaveLength(1);
    });

    it('should delete sub-entities by type', async () => {
      await handler.createEntity(testNodeId);

      await handler.createGroupEntity?.(testNodeId, 'type1', { value: 'value1' } as any);
      await handler.createGroupEntity?.(testNodeId, 'type2', { value: 'value2' } as any);

      await handler.deleteGroupEntities?.(testNodeId, 'type1');

      const type1Entities = await handler.getGroupEntities?.(testNodeId, 'type1');
      expect(type1Entities).toHaveLength(0);

      const type2Entities = await handler.getGroupEntities?.(testNodeId, 'type2');
      expect(type2Entities).toHaveLength(1);
    });
  });

  describe('Special Operations', () => {
    beforeEach(async () => {
      await handler.createEntity(testNodeId, {
        name: 'Original Entity',
        description: 'To be duplicated',
      });
    });

    it('should duplicate an entity', async () => {
      const newNodeId = 'new-node-456' as NodeId;

      await handler.duplicate?.(testNodeId, newNodeId);

      const duplicated = await handler.getEntity(newNodeId);
      expect(duplicated).toBeDefined();
      expect(duplicated?.name).toBe('Original Entity');
      expect(duplicated?.nodeId).toBe(newNodeId);
      expect(duplicated?.version).toBe(1);
    });

    it('should create a backup', async () => {
      // Add sub-entities
      await handler.createGroupEntity?.(testNodeId, 'type1', { value: 'sub1' } as any);
      await handler.createGroupEntity?.(testNodeId, 'type2', { value: 'sub2' } as any);

      const backup = await handler.backup?.(testNodeId);

      expect(backup?.entity.nodeId).toBe(testNodeId);
      expect(backup?.subEntities?.['type1']).toHaveLength(1);
      expect(backup?.subEntities?.['type2']).toHaveLength(1);
      expect(backup?.metadata.backupDate).toBeDefined();
    });

    it('should restore from backup', async () => {
      const backup = await handler.backup?.(testNodeId);

      // Modify entity
      await handler.updateEntity(testNodeId, { name: 'Modified' });

      // Restore
      await handler.restore?.(testNodeId, backup!);

      const restored = await handler.getEntity(testNodeId);
      expect(restored?.name).toBe('Original Entity');
    });

    it('should cleanup entity resources', async () => {
      // Create working copy and sub-entities
      const workingCopy = await handler.createWorkingCopy(testNodeId);
      await handler.createGroupEntity?.(testNodeId, 'type1', { value: 'sub1' } as any);

      await handler.cleanup?.(testNodeId);

      // Check working copy is deleted
      const remainingCopy = await db.table('workingCopies').get(workingCopy.workingCopyId);
      expect(remainingCopy).toBeUndefined();

      // Check sub-entities are deleted
      const subEntities = await handler.getGroupEntities?.(testNodeId, 'type1');
      expect(subEntities).toHaveLength(0);
    });
  });
});

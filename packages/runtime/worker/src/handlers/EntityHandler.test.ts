import type { NodeId, EntityId } from '@hierarchidb/common-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupEntity, WorkingCopy } from './types';
import { BaseEntityHandler } from './EntityHandler';
import { WorkingCopyHandler } from './WorkingCopyHandler';

// Test entity types
interface TestEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  value: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface TestGroupEntity extends GroupEntity {
  // GroupEntity already includes: id, nodeId, type, createdAt, updatedAt, version
  // No additional properties needed for testing
}

// TestWorkingCopy is TestEntity + WorkingCopyProperties
type TestWorkingCopy = TestEntity & {
  originalNodeId?: NodeId;
  copiedAt: number;
  hasEntityCopy: boolean;
  updatedAt: number;
}

// Mock database classes for testing
class MockCoreDB {
  tables = [{}];
  async transaction(mode: string, table: any, fn: Function) {
    return fn();
  }
}

class MockEphemeralDB {
  tables = [{}];
  async transaction(mode: string, table: any, fn: Function) {
    return fn();
  }
}

describe.skip('EntityHandler (needs update to new API)', () => {
  let handler: WorkingCopyHandler;
  let coreDB: any;
  let ephemeralDB: any;

  beforeEach(() => {
    coreDB = new MockCoreDB();
    ephemeralDB = new MockEphemeralDB();

    // Create handler instance
    handler = new WorkingCopyHandler(coreDB as any, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(() => {
    // Clean up mock data
    coreDB._entities = undefined;
    coreDB._subEntities = undefined;
    ephemeralDB._workingCopies = undefined;
  });

  describe('createEntity', () => {
    it('should create a new entity with default values', async () => {
      const nodeId = 'node-1' as NodeId;
      const entity = await handler.createEntity(nodeId);

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(nodeId);
      expect(entity.createdAt).toBeGreaterThan(0);
      expect(entity.updatedAt).toBeGreaterThan(0);
      expect(entity.version).toBe(1);
    });

    it('should create entity with provided data', async () => {
      const nodeId = 'node-2' as NodeId;
      const data = {
        type: 'test-entity',
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity.type).toBe(data.type);
      expect(entity.nodeId).toBe(nodeId);
    });

    it('should throw error if entity already exists', async () => {
      const nodeId = 'node-3' as NodeId;
      await handler.createEntity(nodeId);

      await expect(handler.createEntity(nodeId)).rejects.toThrow('Entity already exists');
    });
  });

  describe('getEntity', () => {
    it('should retrieve an existing entity', async () => {
      const nodeId = 'node-4' as NodeId;
      const created = await handler.createEntity(nodeId, {
        type: 'test-retrieved',
      });

      const retrieved = await handler.getEntity(nodeId);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent entity', async () => {
      const result = await handler.getEntity('non-existent' as NodeId);
      expect(result).toBeUndefined();
    });
  });

  describe('updateEntity', () => {
    it('should update existing entity fields', async () => {
      const nodeId = 'node-5' as NodeId;
      await handler.createEntity(nodeId, {
        type: 'test-entity',
      });

      // Add a small delay to ensure updatedAt is different
      await new Promise((resolve) => setTimeout(resolve, 10));

      await handler.updateEntity(nodeId, {
        type: 'updated-entity',
      });

      const updated = await handler.getEntity(nodeId);
      expect(updated?.type).toBe('updated-entity');
      expect(updated?.version).toBe(2);
      expect(updated?.updatedAt).toBeGreaterThan(updated?.createdAt || 0);
    });

    it('should increment version on update', async () => {
      const nodeId = 'node-6' as NodeId;
      await handler.createEntity(nodeId);

      await handler.updateEntity(nodeId, { type: 'updated-type-1' });
      let entity = await handler.getEntity(nodeId);
      expect(entity?.version).toBe(2);

      await handler.updateEntity(nodeId, { type: 'updated-type-2' });
      entity = await handler.getEntity(nodeId);
      expect(entity?.version).toBe(3);
    });

    it('should throw error if entity does not exist', async () => {
      await expect(
        handler.updateEntity('non-existent' as NodeId, { type: 'non-existent' })
      ).rejects.toThrow('Entity not found');
    });
  });

  describe('deleteEntity', () => {
    it('should delete an existing entity', async () => {
      const nodeId = 'node-7' as NodeId;
      await handler.createEntity(nodeId);

      await handler.deleteEntity(nodeId);

      const result = await handler.getEntity(nodeId);
      expect(result).toBeUndefined();
    });

    it('should not throw error when deleting non-existent entity', async () => {
      await expect(handler.deleteEntity('non-existent' as NodeId)).resolves.not.toThrow();
    });
  });

  describe('Working Copy operations', () => {
    describe('createWorkingCopy', () => {
      it('should create working copy from existing entity', async () => {
        const nodeId = 'node-8' as NodeId;
        await handler.createEntity(nodeId, {
          type: 'original-entity',
        });

        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy).toBeDefined();
        expect(workingCopy.nodeId).toBe(nodeId);
        expect(workingCopy.workingCopyOf).toBe(nodeId);
        expect(workingCopy.type).toBe('original-entity');
        expect(workingCopy.copiedAt).toBeGreaterThan(0);
      });

      it('should create draft working copy without source entity', async () => {
        const nodeId = 'node-9' as NodeId;

        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy).toBeDefined();
        expect(workingCopy.nodeId).toBe(nodeId);
        expect(workingCopy.isDraft).toBe(true);
        expect(workingCopy.workingCopyOf).toBeUndefined();
      });

      it('should throw error if working copy already exists', async () => {
        const nodeId = 'node-10' as NodeId;
        await handler.createEntity(nodeId);
        await handler.createWorkingCopy(nodeId);

        await expect(handler.createWorkingCopy(nodeId)).rejects.toThrow(
          'Working copy already exists'
        );
      });
    });

    describe('getWorkingCopy', () => {
      it('should retrieve existing working copy', async () => {
        const nodeId = 'node-11' as NodeId;
        await handler.createEntity(nodeId, { type: 'test-entity' });
        const created = await handler.createWorkingCopy(nodeId);

        const retrieved = await handler.getWorkingCopy(nodeId);

        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent working copy', async () => {
        const result = await handler.getWorkingCopy('non-existent' as NodeId);
        expect(result).toBeUndefined();
      });
    });

    describe('commitWorkingCopy', () => {
      it('should commit working copy changes to entity', async () => {
        const nodeId = 'node-12' as NodeId;
        await handler.createEntity(nodeId, { type: 'original-entity' });

        const workingCopy = await handler.createWorkingCopy(nodeId);
        workingCopy.type = 'modified-entity';

        await handler.commitWorkingCopy(nodeId, workingCopy);

        const entity = await handler.getEntity(nodeId);
        expect(entity?.type).toBe('modified-entity');
        expect(entity?.version).toBe(2);

        // Working copy should be deleted after commit
        const wcAfterCommit = await handler.getWorkingCopy(nodeId);
        expect(wcAfterCommit).toBeUndefined();
      });

      it('should create new entity from draft working copy', async () => {
        const nodeId = 'node-13' as NodeId;
        const workingCopy = await handler.createWorkingCopy(nodeId);
        workingCopy.type = 'new-entity';

        await handler.commitWorkingCopy(nodeId, workingCopy);

        const entity = await handler.getEntity(nodeId);
        expect(entity).toBeDefined();
        expect(entity?.type).toBe('new-entity');
        expect(entity?.version).toBe(1);
      });

      it('should throw error if working copy does not exist', async () => {
        const nodeId = 'node-14' as NodeId;
        
        // Try to commit a non-existent working copy
        await expect(handler.commitWorkingCopy(nodeId, {} as any)).rejects.toThrow();
      });
    });

    describe('discardWorkingCopy', () => {
      it('should discard working copy without affecting entity', async () => {
        const nodeId = 'node-15' as NodeId;
        await handler.createEntity(nodeId, { type: 'original-entity' });
        await handler.createWorkingCopy(nodeId);

        await handler.discardWorkingCopy(nodeId);

        const entity = await handler.getEntity(nodeId);
        expect(entity?.type).toBe('original-entity');

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });

      it('should not throw error when discarding non-existent working copy', async () => {
        await expect(
          handler.discardWorkingCopy('non-existent' as NodeId)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('GroupEntity operations', () => {
    let subEntityHandler: BaseEntityHandler<TestEntity, TestGroupEntity, any>;

    beforeEach(() => {
      // Create handler with sub-entity support
      subEntityHandler = new BaseEntityHandler<TestEntity, TestGroupEntity, any>(
        coreDB as any,
        ephemeralDB as any,
        'testEntities',
        'testSubEntities' // Enable sub-entity support
      );
    });

    it('should create sub-entities', async () => {
      const parentId = 'node-16' as NodeId;
      await subEntityHandler.createEntity(parentId);

      await subEntityHandler.createGroupEntity?.(parentId, 'test-type', {
        id: 'sub-test-1' as EntityId,
        nodeId: parentId,
        type: 'test-type',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TestGroupEntity);

      const subEntities = await subEntityHandler.getGroupEntities?.(parentId);
      expect(subEntities).toBeDefined();
      expect(subEntities).toHaveLength(1);
      expect(subEntities?.[0]?.nodeId).toBe(parentId);
      expect(subEntities?.[0]?.type).toBe('test-type');
    });

    it('should get sub-entities by parent', async () => {
      const parentId = 'node-17' as NodeId;
      await subEntityHandler.createEntity(parentId);

      await subEntityHandler.createGroupEntity?.(parentId, 'test-type', {
        id: 'sub-1' as EntityId,
        nodeId: parentId,
        type: 'test-type',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TestGroupEntity);
      await subEntityHandler.createGroupEntity?.(parentId, 'test-type', {
        id: 'sub-2' as EntityId,
        nodeId: parentId,
        type: 'test-type',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TestGroupEntity);

      const subEntities = await subEntityHandler.getGroupEntities?.(parentId);
      expect(subEntities).toHaveLength(2);
    });

    it('should delete sub-entities when parent is deleted', async () => {
      const parentId = 'node-18' as NodeId;
      await subEntityHandler.createEntity(parentId);
      await subEntityHandler.createGroupEntity?.(parentId, 'test-type', {
        id: 'sub-del-1' as EntityId,
        nodeId: parentId,
        type: 'test-type',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TestGroupEntity);

      await subEntityHandler.deleteEntity(parentId);

      const subEntities = await subEntityHandler.getGroupEntities?.(parentId);
      expect(subEntities).toHaveLength(0);
    });
  });
});

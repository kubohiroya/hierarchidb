import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { EntityHandler, BaseSubEntity, BaseWorkingCopy } from './types';
import { WorkingCopyHandler } from './WorkingCopyHandler';
import type { TreeNodeId, UUID } from '@hierarchidb/core';

// Test entity types
interface TestEntity {
  nodeId: TreeNodeId;
  name: string;
  value: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface TestSubEntity extends BaseSubEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  subEntityType: string;
  type: string;
  data: string;
  createdAt: number;
  updatedAt: number;
}

interface TestWorkingCopy extends BaseWorkingCopy {
  workingCopyId: UUID;
  nodeId: TreeNodeId;
  name: string;
  value: number;
  isDraft?: boolean;
  workingCopyOf: TreeNodeId; // Required by BaseWorkingCopy
  copiedAt: number;
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

describe('EntityHandler', () => {
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
      const nodeId = 'node-1' as TreeNodeId;
      const entity = await handler.createEntity(nodeId);

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(nodeId);
      expect(entity.createdAt).toBeGreaterThan(0);
      expect(entity.updatedAt).toBeGreaterThan(0);
      expect(entity.version).toBe(1);
    });

    it('should create entity with provided data', async () => {
      const nodeId = 'node-2' as TreeNodeId;
      const data = {
        name: 'Test Entity',
        value: 42,
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity.name).toBe(data.name);
      expect(entity.value).toBe(data.value);
      expect(entity.nodeId).toBe(nodeId);
    });

    it('should throw error if entity already exists', async () => {
      const nodeId = 'node-3' as TreeNodeId;
      await handler.createEntity(nodeId);

      await expect(handler.createEntity(nodeId)).rejects.toThrow('Entity already exists');
    });
  });

  describe('getEntity', () => {
    it('should retrieve an existing entity', async () => {
      const nodeId = 'node-4' as TreeNodeId;
      const created = await handler.createEntity(nodeId, {
        name: 'Test',
        value: 100,
      });

      const retrieved = await handler.getEntity(nodeId);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent entity', async () => {
      const result = await handler.getEntity('non-existent' as TreeNodeId);
      expect(result).toBeUndefined();
    });
  });

  describe('updateEntity', () => {
    it('should update existing entity fields', async () => {
      const nodeId = 'node-5' as TreeNodeId;
      await handler.createEntity(nodeId, {
        name: 'Original',
        value: 1,
      });

      // Add a small delay to ensure updatedAt is different
      await new Promise((resolve) => setTimeout(resolve, 10));

      await handler.updateEntity(nodeId, {
        name: 'Updated',
        value: 2,
      });

      const updated = await handler.getEntity(nodeId);
      expect(updated?.name).toBe('Updated');
      expect(updated?.value).toBe(2);
      expect(updated?.version).toBe(2);
      expect(updated?.updatedAt).toBeGreaterThan(updated?.createdAt || 0);
    });

    it('should increment version on update', async () => {
      const nodeId = 'node-6' as TreeNodeId;
      await handler.createEntity(nodeId);

      await handler.updateEntity(nodeId, { value: 10 });
      let entity = await handler.getEntity(nodeId);
      expect(entity?.version).toBe(2);

      await handler.updateEntity(nodeId, { value: 20 });
      entity = await handler.getEntity(nodeId);
      expect(entity?.version).toBe(3);
    });

    it('should throw error if entity does not exist', async () => {
      await expect(
        handler.updateEntity('non-existent' as TreeNodeId, { value: 1 })
      ).rejects.toThrow('Entity not found');
    });
  });

  describe('deleteEntity', () => {
    it('should delete an existing entity', async () => {
      const nodeId = 'node-7' as TreeNodeId;
      await handler.createEntity(nodeId);

      await handler.deleteEntity(nodeId);

      const result = await handler.getEntity(nodeId);
      expect(result).toBeUndefined();
    });

    it('should not throw error when deleting non-existent entity', async () => {
      await expect(handler.deleteEntity('non-existent' as TreeNodeId)).resolves.not.toThrow();
    });
  });

  describe('Working Copy operations', () => {
    describe('createWorkingCopy', () => {
      it('should create working copy from existing entity', async () => {
        const nodeId = 'node-8' as TreeNodeId;
        await handler.createEntity(nodeId, {
          name: 'Original',
          value: 100,
        });

        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy).toBeDefined();
        expect(workingCopy.nodeId).toBe(nodeId);
        expect(workingCopy.workingCopyOf).toBe(nodeId);
        expect(workingCopy.name).toBe('Original');
        expect(workingCopy.value).toBe(100);
        expect(workingCopy.copiedAt).toBeGreaterThan(0);
      });

      it('should create draft working copy without source entity', async () => {
        const nodeId = 'node-9' as TreeNodeId;

        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy).toBeDefined();
        expect(workingCopy.nodeId).toBe(nodeId);
        expect(workingCopy.isDraft).toBe(true);
        expect(workingCopy.workingCopyOf).toBeUndefined();
      });

      it('should throw error if working copy already exists', async () => {
        const nodeId = 'node-10' as TreeNodeId;
        await handler.createEntity(nodeId);
        await handler.createWorkingCopy(nodeId);

        await expect(handler.createWorkingCopy(nodeId)).rejects.toThrow(
          'Working copy already exists'
        );
      });
    });

    describe('getWorkingCopy', () => {
      it('should retrieve existing working copy', async () => {
        const nodeId = 'node-11' as TreeNodeId;
        await handler.createEntity(nodeId, { name: 'Test', value: 50 });
        const created = await handler.createWorkingCopy(nodeId);

        const retrieved = await handler.getWorkingCopy(nodeId);

        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent working copy', async () => {
        const result = await handler.getWorkingCopy('non-existent' as TreeNodeId);
        expect(result).toBeUndefined();
      });
    });

    describe('commitWorkingCopy', () => {
      it('should commit working copy changes to entity', async () => {
        const nodeId = 'node-12' as TreeNodeId;
        await handler.createEntity(nodeId, { name: 'Original', value: 1 });

        const workingCopy = await handler.createWorkingCopy(nodeId);
        workingCopy.name = 'Modified';
        workingCopy.value = 999;

        await handler.commitWorkingCopy(nodeId, workingCopy);

        const entity = await handler.getEntity(nodeId);
        expect(entity?.name).toBe('Modified');
        expect(entity?.value).toBe(999);
        expect(entity?.version).toBe(2);

        // Working copy should be deleted after commit
        const wcAfterCommit = await handler.getWorkingCopy(nodeId);
        expect(wcAfterCommit).toBeUndefined();
      });

      it('should create new entity from draft working copy', async () => {
        const nodeId = 'node-13' as TreeNodeId;
        const workingCopy = await handler.createWorkingCopy(nodeId);
        workingCopy.name = 'New Entity';
        workingCopy.value = 42;

        await handler.commitWorkingCopy(nodeId, workingCopy);

        const entity = await handler.getEntity(nodeId);
        expect(entity).toBeDefined();
        expect(entity?.name).toBe('New Entity');
        expect(entity?.value).toBe(42);
        expect(entity?.version).toBe(1);
      });

      it('should throw error if working copy does not exist', async () => {
        const nodeId = 'node-14' as TreeNodeId;
        const fakeWorkingCopy = {
          workingCopyId: 'fake-id' as UUID,
          nodeId,
          name: 'Fake',
          value: 0,
          copiedAt: Date.now(),
          updatedAt: Date.now(),
        };

        await expect(handler.commitWorkingCopy(nodeId, fakeWorkingCopy)).rejects.toThrow(
          'Working copy not found'
        );
      });
    });

    describe('discardWorkingCopy', () => {
      it('should discard working copy without affecting entity', async () => {
        const nodeId = 'node-15' as TreeNodeId;
        await handler.createEntity(nodeId, { name: 'Original', value: 100 });
        await handler.createWorkingCopy(nodeId);

        await handler.discardWorkingCopy(nodeId);

        const entity = await handler.getEntity(nodeId);
        expect(entity?.name).toBe('Original');
        expect(entity?.value).toBe(100);

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });

      it('should not throw error when discarding non-existent working copy', async () => {
        await expect(
          handler.discardWorkingCopy('non-existent' as TreeNodeId)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('SubEntity operations', () => {
    let subEntityHandler: EntityHandler<TestEntity, TestSubEntity, TestWorkingCopy>;

    beforeEach(() => {
      // Create handler with sub-entity support
      subEntityHandler = new BaseEntityHandler<TestEntity, TestSubEntity, TestWorkingCopy>(
        coreDB as any,
        ephemeralDB as any,
        'testEntities',
        'testSubEntities' // Enable sub-entity support
      );
    });

    it('should create sub-entities', async () => {
      const parentId = 'node-16' as TreeNodeId;
      await subEntityHandler.createEntity(parentId);

      const subEntity = await subEntityHandler.createSubEntity?.(parentId, 'test-type', {
        data: 'Sub entity data',
      });

      expect(subEntity).toBeDefined();
      expect(subEntity?.parentId).toBe(parentId);
      expect(subEntity?.data).toBe('Sub entity data');
    });

    it('should get sub-entities by parent', async () => {
      const parentId = 'node-17' as TreeNodeId;
      await subEntityHandler.createEntity(parentId);

      await subEntityHandler.createSubEntity?.(parentId, 'test-type', { data: 'Sub 1' });
      await subEntityHandler.createSubEntity?.(parentId, 'test-type', { data: 'Sub 2' });

      const subEntities = await subEntityHandler.getSubEntities?.(parentId);
      expect(subEntities).toHaveLength(2);
    });

    it('should delete sub-entities when parent is deleted', async () => {
      const parentId = 'node-18' as TreeNodeId;
      await subEntityHandler.createEntity(parentId);
      await subEntityHandler.createSubEntity?.(parentId, { data: 'Sub entity' });

      await subEntityHandler.deleteEntity(parentId);

      const subEntities = await subEntityHandler.getSubEntities?.(parentId);
      expect(subEntities).toHaveLength(0);
    });
  });
});

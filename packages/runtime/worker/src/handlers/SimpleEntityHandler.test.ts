/**
 * @file PeerEntityHandler.test.ts
 * @description Unit tests for PeerEntityHandler concrete implementation
 */

import type { NodeId, EntityId } from '@hierarchidb/common-core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeerEntityImpl, GroupEntityImpl, PeerWorkingCopy } from './SimpleEntityHandler';
import { PeerEntityHandler } from './SimpleEntityHandler';

describe('PeerEntityHandler', () => {
  let db: Dexie;
  let handler: PeerEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;
  const testNodeId2 = 'test-node-456' as NodeId;

  beforeEach(async () => {
    // Create in-memory database
    db = new Dexie('TestDB');
    db.version(1).stores({
      entities: 'nodeId, name, createdAt, updatedAt',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId',
      subEntities: '[parentId+subEntityType], id',
    });

    await db.open();

    handler = new PeerEntityHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Entity CRUD Operations', () => {
    describe('createEntity', () => {
      it('should create an entity with default values', async () => {
        const entity = await handler.createEntity(testNodeId);

        expect(entity.nodeId).toBe(testNodeId);
        expect(entity.name).toBe('New Entity');
        expect(entity.description).toBeUndefined();
        expect(entity.data).toEqual({});
        expect(entity.version).toBe(1);
        expect(entity.createdAt).toBeGreaterThan(0);
        expect(entity.updatedAt).toBeGreaterThan(0);
      });

      it('should create an entity with provided data', async () => {
        const entity = await handler.createEntity(testNodeId, {
          name: 'Custom Entity',
          description: 'Custom Description',
          data: { key: 'value' },
        });

        expect(entity.name).toBe('Custom Entity');
        expect(entity.description).toBe('Custom Description');
        expect(entity.data).toEqual({ key: 'value' });
      });

      it('should store entity in database', async () => {
        await handler.createEntity(testNodeId, { name: 'Stored Entity' });

        const stored = await db.table('entities').get(testNodeId);
        expect(stored).toBeDefined();
        expect(stored.name).toBe('Stored Entity');
      });

      it('should validate entity data', async () => {
        await expect(handler.createEntity(testNodeId, { name: '' })).rejects.toThrow(
          'Entity name cannot be empty'
        );
      });
    });

    describe('getEntity', () => {
      beforeEach(async () => {
        await handler.createEntity(testNodeId, {
          name: 'Test Entity',
          description: 'Test Description',
        });
      });

      it('should retrieve an existing entity', async () => {
        const entity = await handler.getEntity(testNodeId);

        expect(entity).toBeDefined();
        expect(entity?.nodeId).toBe(testNodeId);
        expect(entity?.name).toBe('Test Entity');
        expect(entity?.description).toBe('Test Description');
      });

      it('should return undefined for non-existent entity', async () => {
        const entity = await handler.getEntity('non-existent' as NodeId);
        expect(entity).toBeUndefined();
      });

      it('should throw error for invalid nodeId', async () => {
        await expect(handler.getEntity('' as NodeId)).rejects.toThrow('nodeId is required');
      });
    });

    describe('updateEntity', () => {
      beforeEach(async () => {
        await handler.createEntity(testNodeId, {
          name: 'Original Name',
          description: 'Original Description',
          data: { original: true },
        });
      });

      it('should update entity fields', async () => {
        await handler.updateEntity(testNodeId, {
          name: 'Updated Name',
          description: 'Updated Description',
        });

        const entity = await handler.getEntity(testNodeId);
        expect(entity?.name).toBe('Updated Name');
        expect(entity?.description).toBe('Updated Description');
        expect(entity?.data).toEqual({ original: true }); // Unchanged
      });

      it('should increment version on update', async () => {
        const originalEntity = await handler.getEntity(testNodeId);
        const originalVersion = originalEntity?.version || 0;

        await handler.updateEntity(testNodeId, { name: 'Updated' });

        const updatedEntity = await handler.getEntity(testNodeId);
        expect(updatedEntity?.version).toBe(originalVersion + 1);
      });

      it('should update timestamp', async () => {
        const originalEntity = await handler.getEntity(testNodeId);
        const originalTimestamp = originalEntity?.updatedAt || 0;

        // Wait a bit to ensure timestamp changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        await handler.updateEntity(testNodeId, { name: 'Updated' });

        const updatedEntity = await handler.getEntity(testNodeId);
        expect(updatedEntity?.updatedAt).toBeGreaterThan(originalTimestamp);
      });

      it('should throw error for non-existent entity', async () => {
        await expect(
          handler.updateEntity('non-existent' as NodeId, { name: 'Test' })
        ).rejects.toThrow('Entity not found');
      });

      it('should not update system fields directly', async () => {
        const originalEntity = await handler.getEntity(testNodeId);

        await handler.updateEntity(testNodeId, {
          nodeId: 'different-id' as NodeId,
          createdAt: 12345,
          version: 999,
        } as any);

        const entity = await handler.getEntity(testNodeId);
        expect(entity?.nodeId).toBe(testNodeId); // Unchanged
        expect(entity?.createdAt).toBe(originalEntity?.createdAt); // Unchanged
        expect(entity?.version).toBe(2); // Auto-incremented, not 999
      });
    });

    describe('deleteEntity', () => {
      beforeEach(async () => {
        await handler.createEntity(testNodeId, { name: 'To Delete' });
      });

      it('should delete an existing entity', async () => {
        await handler.deleteEntity(testNodeId);

        const entity = await handler.getEntity(testNodeId);
        expect(entity).toBeUndefined();
      });

      it('should not throw for non-existent entity', async () => {
        await expect(handler.deleteEntity('non-existent' as NodeId)).resolves.not.toThrow();
      });

      it('should clean up resources on delete', async () => {
        // Create a working copy
        await handler.createWorkingCopy(testNodeId);

        // Delete the entity
        await handler.deleteEntity(testNodeId);

        // Check that working copy is also cleaned up
        const workingCopies = await db
          .table('workingCopies')
          .where('workingCopyOf')
          .equals(testNodeId)
          .toArray();
        expect(workingCopies).toHaveLength(0);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('batchCreateEntities', () => {
      it('should create multiple entities', async () => {
        const entities = await handler.batchCreateEntities([
          { nodeId: testNodeId, data: { name: 'Entity 1' } },
          { nodeId: testNodeId2, data: { name: 'Entity 2' } },
        ]);

        expect(entities).toHaveLength(2);
        expect(entities[0]?.name).toBe('Entity 1');
        expect(entities[1]?.name).toBe('Entity 2');

        // Verify in database
        const entity1 = await handler.getEntity(testNodeId);
        const entity2 = await handler.getEntity(testNodeId2);
        expect(entity1?.name).toBe('Entity 1');
        expect(entity2?.name).toBe('Entity 2');
      });

      it('should use transaction for batch create', async () => {
        const spy = vi.spyOn(db, 'transaction');

        await handler.batchCreateEntities([{ nodeId: testNodeId }, { nodeId: testNodeId2 }]);

        expect(spy).toHaveBeenCalled();
      });
    });

    describe('batchUpdateEntities', () => {
      beforeEach(async () => {
        await handler.batchCreateEntities([
          { nodeId: testNodeId, data: { name: 'Entity 1' } },
          { nodeId: testNodeId2, data: { name: 'Entity 2' } },
        ]);
      });

      it('should update multiple entities', async () => {
        await handler.batchUpdateEntities([
          { nodeId: testNodeId, data: { name: 'Updated 1' } },
          { nodeId: testNodeId2, data: { name: 'Updated 2' } },
        ]);

        const entity1 = await handler.getEntity(testNodeId);
        const entity2 = await handler.getEntity(testNodeId2);
        expect(entity1?.name).toBe('Updated 1');
        expect(entity2?.name).toBe('Updated 2');
      });

      it('should handle missing entities gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'warn');

        await handler.batchUpdateEntities([
          { nodeId: testNodeId, data: { name: 'Updated' } },
          { nodeId: 'non-existent' as NodeId, data: { name: 'Test' } },
        ]);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Entity not found for batch update')
        );

        // First entity should still be updated
        const entity = await handler.getEntity(testNodeId);
        expect(entity?.name).toBe('Updated');
      });
    });

    describe('batchDeleteEntities', () => {
      beforeEach(async () => {
        await handler.batchCreateEntities([{ nodeId: testNodeId }, { nodeId: testNodeId2 }]);
      });

      it('should delete multiple entities', async () => {
        await handler.batchDeleteEntities([testNodeId, testNodeId2]);

        const entity1 = await handler.getEntity(testNodeId);
        const entity2 = await handler.getEntity(testNodeId2);
        expect(entity1).toBeUndefined();
        expect(entity2).toBeUndefined();
      });
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await handler.batchCreateEntities([
        {
          nodeId: 'node-1' as NodeId,
          data: {
            name: 'Apple',
            description: 'Red fruit',
            createdAt: 1000,
            updatedAt: 2000,
          },
        },
        {
          nodeId: 'node-2' as NodeId,
          data: {
            name: 'Banana',
            description: 'Yellow fruit',
            createdAt: 3000,
            updatedAt: 4000,
          },
        },
        {
          nodeId: 'node-3' as NodeId,
          data: {
            name: 'Cherry',
            description: 'Small red fruit',
            createdAt: 5000,
            updatedAt: 6000,
          },
        },
      ]);
    });

    it('should query by name', async () => {
      const results = await handler.queryEntities({ name: 'an' });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Banana');
    });

    it('should query by description', async () => {
      const results = await handler.queryEntities({ description: 'red' });
      expect(results).toHaveLength(2);
      expect(results.map((e) => e.name)).toContain('Apple');
      expect(results.map((e) => e.name)).toContain('Cherry');
    });

    it('should query by creation time', async () => {
      const results = await handler.queryEntities({ createdAfter: 2500 });
      expect(results).toHaveLength(2);
      expect(results.map((e) => e.name)).toContain('Banana');
      expect(results.map((e) => e.name)).toContain('Cherry');
    });

    it('should query by update time', async () => {
      const results = await handler.queryEntities({ updatedAfter: 4500 });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Cherry');
    });

    it('should combine multiple criteria', async () => {
      const results = await handler.queryEntities({
        description: 'fruit',
        createdAfter: 2500,
      });
      expect(results).toHaveLength(2);
    });
  });

  describe('Utility Methods', () => {
    it('should get entity count', async () => {
      expect(await handler.getEntityCount()).toBe(0);

      await handler.batchCreateEntities([{ nodeId: testNodeId }, { nodeId: testNodeId2 }]);

      expect(await handler.getEntityCount()).toBe(2);
    });

    it('should check entity existence', async () => {
      expect(await handler.entityExists(testNodeId)).toBe(false);

      await handler.createEntity(testNodeId);

      expect(await handler.entityExists(testNodeId)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should reject empty name', async () => {
      await expect(handler.createEntity(testNodeId, { name: '   ' })).rejects.toThrow(
        'Entity name cannot be empty'
      );
    });

    it('should reject non-string name', async () => {
      await expect(handler.createEntity(testNodeId, { name: 123 as any })).rejects.toThrow(
        'Entity name must be a string'
      );
    });

    it('should reject non-string description', async () => {
      await expect(handler.createEntity(testNodeId, { description: true as any })).rejects.toThrow(
        'Entity description must be a string'
      );
    });

    it('should reject invalid version', async () => {
      await expect(handler.createEntity(testNodeId, { version: 0 })).rejects.toThrow(
        'Entity version must be positive'
      );
    });
  });

  describe('Integration with BaseEntityHandler', () => {
    it('should inherit working copy functionality', async () => {
      await handler.createEntity(testNodeId, { name: 'Original' });

      const workingCopy = await handler.createWorkingCopy(testNodeId);
      expect(workingCopy.nodeId).toBe(testNodeId);
      expect(workingCopy.name).toBe('Original');
      expect((workingCopy as any).isDirty).toBe(false);
    });

    it('should inherit sub-entity functionality', async () => {
      await handler.createEntity(testNodeId);

      await handler.createGroupEntity?.(testNodeId, 'test-type', {
        id: 'sub-1' as EntityId,
        nodeId: testNodeId,
        parentId: testNodeId,
        type: 'test-type',
        groupEntityType: 'test-type',
        data: 'test-data',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });

      const subEntities = await handler.getGroupEntities?.(testNodeId, 'test-type');
      expect(subEntities).toHaveLength(1);
    });

    it('should inherit duplicate functionality', async () => {
      await handler.createEntity(testNodeId, {
        name: 'Original',
        description: 'To be duplicated',
      });

      await handler.duplicate?.(testNodeId, testNodeId2);

      const duplicate = await handler.getEntity(testNodeId2);
      expect(duplicate).toBeDefined();
      expect(duplicate?.name).toBe('Original');
      expect(duplicate?.nodeId).toBe(testNodeId2);
    });
  });
});

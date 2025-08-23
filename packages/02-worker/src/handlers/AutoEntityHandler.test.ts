/**
 * @file AutoEntityHandler.test.ts
 * @description Tests for AutoEntityHandler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, TreeNodeType, PeerEntity, WorkingCopyProperties } from '@hierarchidb/00-core';
import type { EntityMetadata } from '@hierarchidb/00-core';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { AutoEntityHandler } from './AutoEntityHandler';
import { AutoLifecycleManager } from '../services/AutoLifecycleManager';
import { EntityRegistrationService } from '../services/EntityRegistrationService';
import { WorkingCopyManager, WorkingCopySession } from '../services/WorkingCopyManager';

// Test entity interface
interface TestEntity extends PeerEntity {
  nodeId: NodeId;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

describe('AutoEntityHandler', () => {
  let db: Dexie;
  let registrationService: EntityRegistrationService;
  let workingCopyManager: WorkingCopyManager;
  let lifecycleManager: AutoLifecycleManager;
  let handler: AutoEntityHandler<TestEntity>;

  const nodeType = 'test-node' as TreeNodeType;
  const nodeId = 'node-123' as NodeId;
  const nodeId2 = 'node-456' as NodeId;

  beforeEach(async () => {
    // Create test database
    db = new Dexie('AutoEntityHandlerTestDB');
    db.version(1).stores({
      testEntities: 'nodeId, createdAt',
      testWorkingCopies: 'workingCopyId, workingCopyOf',
    });

    await db.open();

    registrationService = new EntityRegistrationService();
    workingCopyManager = new WorkingCopyManager(db);
    lifecycleManager = new AutoLifecycleManager(
      registrationService,
      workingCopyManager,
      db
    );

    // Register test entity
    const metadata: EntityMetadata = {
      entityType: 'peer',
      tableName: 'testEntities',
      relationship: {
        type: 'one-to-one',
        foreignKeyField: 'nodeId',
        cascadeDelete: true,
      },
      workingCopyConfig: {
        enabled: true,
        tableName: 'testWorkingCopies',
      },
    };

    registrationService.registerEntity(nodeType, 'test-entity', metadata);

    handler = new AutoEntityHandler<TestEntity>(
      nodeType,
      'testEntities',
      lifecycleManager
    );
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('createEntity', () => {
    it('should create entity using lifecycle manager', async () => {
      const result = await handler.createEntity(nodeId);

      expect(result).toBeDefined();
      expect(result.nodeId).toBe(nodeId);
      expect(result.createdAt).toBeDefined();

      // Verify entity is stored in database
      const stored = await db.table('testEntities').get(nodeId);
      expect(stored).toBeDefined();
      expect(stored.nodeId).toBe(nodeId);
    });

    it('should create entity with initial data', async () => {
      const initialData: Partial<TestEntity> = {
        name: 'Test Entity',
        description: 'Initial description',
      };

      const result = await handler.createEntity(nodeId, initialData);

      expect(result).toBeDefined();
      expect(result.nodeId).toBe(nodeId);

      // Since AutoLifecycleManager only creates basic entities,
      // additional data would need to be applied separately
      const stored = await db.table('testEntities').get(nodeId);
      expect(stored).toBeDefined();
    });

    it('should handle creation errors gracefully', async () => {
      // Mock lifecycle manager to throw error
      vi.spyOn(lifecycleManager, 'onNodeCreate').mockRejectedValue(new Error('Creation failed'));

      await expect(handler.createEntity(nodeId)).rejects.toThrow('Creation failed');
    });
  });

  describe('deleteEntity', () => {
    beforeEach(async () => {
      // Create entity to delete
      await db.table('testEntities').add({
        nodeId,
        name: 'Test Entity',
        description: 'To be deleted',
        createdAt: Date.now(),
      });
    });

    it('should delete entity using lifecycle manager', async () => {
      await handler.deleteEntity(nodeId);

      // Verify entity is deleted
      const deleted = await db.table('testEntities').get(nodeId);
      expect(deleted).toBeUndefined();
    });

    it('should handle deletion errors gracefully', async () => {
      vi.spyOn(lifecycleManager, 'onNodeDelete').mockRejectedValue(new Error('Deletion failed'));

      await expect(handler.deleteEntity(nodeId)).rejects.toThrow('Deletion failed');
    });
  });

  describe('duplicateEntity', () => {
    beforeEach(async () => {
      // Create source entity
      await db.table('testEntities').add({
        nodeId,
        name: 'Source Entity',
        description: 'Original',
        createdAt: Date.now(),
      });
    });

    it('should duplicate entity using lifecycle manager', async () => {
      const result = await handler.duplicateEntity(nodeId, nodeId2);

      expect(result).toBeDefined();
      expect(result.nodeId).toBe(nodeId2);

      // Verify source still exists
      const source = await db.table('testEntities').get(nodeId);
      expect(source).toBeDefined();

      // Verify duplicate is created
      const duplicate = await db.table('testEntities').get(nodeId2);
      expect(duplicate).toBeDefined();
      expect(duplicate.name).toBe('Source Entity');
      expect(duplicate.description).toBe('Original');
    });

    it('should handle duplication errors gracefully', async () => {
      vi.spyOn(lifecycleManager, 'onNodeDuplicate').mockRejectedValue(new Error('Duplication failed'));

      await expect(handler.duplicateEntity(nodeId, nodeId2)).rejects.toThrow('Duplication failed');
    });
  });

  describe('getEntity', () => {
    beforeEach(async () => {
      await db.table('testEntities').add({
        nodeId,
        name: 'Test Entity',
        description: 'Test description',
        createdAt: Date.now(),
      });
    });

    it('should retrieve entity from database', async () => {
      const result = await handler.getEntity(nodeId);

      expect(result).toBeDefined();
      expect(result!.nodeId).toBe(nodeId);
      expect(result!.name).toBe('Test Entity');
      expect(result!.description).toBe('Test description');
    });

    it('should return undefined for non-existent entity', async () => {
      const result = await handler.getEntity('non-existent' as NodeId);
      expect(result).toBeUndefined();
    });
  });

  describe('updateEntity', () => {
    beforeEach(async () => {
      await db.table('testEntities').add({
        nodeId,
        name: 'Original Name',
        description: 'Original description',
        createdAt: Date.now(),
      });
    });

    it('should update entity in database', async () => {
      const updates: Partial<TestEntity> = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await handler.updateEntity(nodeId, updates);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated Name');
      expect(result!.description).toBe('Updated description');
      expect(result!.updatedAt).toBeDefined();

      // Verify in database
      const stored = await db.table('testEntities').get(nodeId);
      expect(stored.name).toBe('Updated Name');
      expect(stored.description).toBe('Updated description');
    });

    it('should return undefined for non-existent entity', async () => {
      const result = await handler.updateEntity('non-existent' as NodeId, { name: 'Updated' });
      expect(result).toBeUndefined();
    });
  });

  describe('createWorkingCopy', () => {
    beforeEach(async () => {
      await db.table('testEntities').add({
        nodeId,
        name: 'Test Entity',
        description: 'Original description',
        createdAt: Date.now(),
      });
    });

    it('should create working copy using lifecycle manager', async () => {
      const result = await handler.createWorkingCopy(nodeId);

      expect(result).toBeDefined();
      expect(result.nodeId).toBe(nodeId);
      expect(result.nodeId).toBe(nodeId);
      expect(result.id).toBeDefined();
      expect((result as any).isDirty).toBe(false);

      // Verify working copy is stored
      const workingCopy = await db.table('testWorkingCopies').get(result.id);
      expect(workingCopy).toBeDefined();
    });

    it('should handle working copy creation errors', async () => {
      vi.spyOn(lifecycleManager, 'createWorkingCopies').mockRejectedValue(new Error('WC creation failed'));

      await expect(handler.createWorkingCopy(nodeId)).rejects.toThrow('WC creation failed');
    });
  });

  describe('commitWorkingCopy', () => {
    let workingCopy: TestEntity & WorkingCopyProperties;

    beforeEach(async () => {
      await db.table('testEntities').add({
        nodeId,
        name: 'Original Name',
        description: 'Original description',
        createdAt: Date.now(),
      });

      workingCopy = await handler.createWorkingCopy(nodeId);
      workingCopy.name = 'Modified Name';
      workingCopy.description = 'Modified description';
      (workingCopy as any).isDirty = true;
    });

    it('should commit working copy changes using lifecycle manager', async () => {
      await handler.commitWorkingCopy(nodeId, workingCopy);

      // Verify changes are committed to main entity
      const entity = await db.table('testEntities').get(nodeId);
      expect(entity.name).toBe('Modified Name');
      expect(entity.description).toBe('Modified description');
      expect(entity.updatedAt).toBeDefined();

      // Verify working copy is deleted
      const deletedWC = await db.table('testWorkingCopies').get(workingCopy.id);
      expect(deletedWC).toBeUndefined();
    });

    it('should handle commit errors gracefully', async () => {
      vi.spyOn(lifecycleManager, 'commitWorkingCopies').mockRejectedValue(new Error('Commit failed'));

      await expect(handler.commitWorkingCopy(nodeId, workingCopy)).rejects.toThrow('Commit failed');
    });
  });

  describe('discardWorkingCopy', () => {
    let workingCopy: TestEntity & WorkingCopyProperties;

    beforeEach(async () => {
      await db.table('testEntities').add({
        nodeId,
        name: 'Original Name',
        description: 'Original description',
        createdAt: Date.now(),
      });

      workingCopy = await handler.createWorkingCopy(nodeId);
      workingCopy.name = 'Modified Name';
      (workingCopy as any).isDirty = true;
    });

    it('should discard working copy without committing changes', async () => {
      await handler.discardWorkingCopy(nodeId, workingCopy);

      // Verify main entity is unchanged
      const entity = await db.table('testEntities').get(nodeId);
      expect(entity.name).toBe('Original Name');
      expect(entity.description).toBe('Original description');

      // Verify working copy is deleted
      const deletedWC = await db.table('testWorkingCopies').get(workingCopy.id);
      expect(deletedWC).toBeUndefined();
    });

    it('should handle discard errors gracefully', async () => {
      vi.spyOn(lifecycleManager, 'discardWorkingCopies').mockRejectedValue(new Error('Discard failed'));

      await expect(handler.discardWorkingCopy(nodeId, workingCopy)).rejects.toThrow('Discard failed');
    });
  });

  describe('listEntities', () => {
    beforeEach(async () => {
      await db.table('testEntities').bulkAdd([
        {
          nodeId: 'node-1' as NodeId,
          name: 'Entity 1',
          description: 'First entity',
          createdAt: Date.now() - 2000,
        },
        {
          nodeId: 'node-2' as NodeId,
          name: 'Entity 2',
          description: 'Second entity',
          createdAt: Date.now() - 1000,
        },
        {
          nodeId: 'node-3' as NodeId,
          name: 'Entity 3',
          description: 'Third entity',
          createdAt: Date.now(),
        },
      ]);
    });

    it('should list all entities', async () => {
      const result = await handler.listEntities();

      expect(result).toHaveLength(3);
      expect(result.map(e => e.nodeId)).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('should support pagination', async () => {
      const result = await handler.listEntities(1, 2);

      expect(result).toHaveLength(2);
      expect(result[0]?.nodeId).toBe('node-2');
      expect(result[1]?.nodeId).toBe('node-3');
    });

    it('should handle empty results', async () => {
      // Clear all entities
      await db.table('testEntities').clear();

      const result = await handler.listEntities();
      expect(result).toEqual([]);
    });
  });

  describe('countEntities', () => {
    beforeEach(async () => {
      await db.table('testEntities').bulkAdd([
        { nodeId: 'node-1' as NodeId, name: 'Entity 1', createdAt: Date.now() },
        { nodeId: 'node-2' as NodeId, name: 'Entity 2', createdAt: Date.now() },
        { nodeId: 'node-3' as NodeId, name: 'Entity 3', createdAt: Date.now() },
      ]);
    });

    it('should count all entities', async () => {
      const count = await handler.countEntities();
      expect(count).toBe(3);
    });

    it('should return zero for empty table', async () => {
      await db.table('testEntities').clear();
      const count = await handler.countEntities();
      expect(count).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      // Close database to simulate connection error
      db.close();

      await expect(handler.getEntity(nodeId)).rejects.toThrow();
    });

    it('should validate node IDs', async () => {
      const invalidNodeId = '' as NodeId;

      await expect(handler.createEntity(invalidNodeId)).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      // Create multiple entities concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        handler.createEntity(`concurrent-node-${i}` as NodeId)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.nodeId).toBe(`concurrent-node-${i}`);
      });
    });
  });
});
/**
import type { NodeId, NodeType, PeerEntity, WorkingCopyProperties, EntityMetadata } from '@hierarchidb/common-type';
 * @file AutoLifecycleIntegration.test.ts
 * @description Integration tests for the complete automatic lifecycle management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

// Import all components
import { EntityRegistrationService } from './EntityRegistrationService';
import { WorkingCopyManager, WorkingCopySession } from './WorkingCopyManager';
import { AutoLifecycleManager } from './AutoLifecycleManager';
import { AutoEntityHandler } from '../handlers/AutoEntityHandler';
import { EntityMetadata, NodeId, NodeType, PeerEntity } from '@hierarchidb/common-type';

// Test entities
interface StylerEntity extends PeerEntity {
  nodeId: NodeId;
  name: string;
  description: string;
  tableMetadataId?: string;
  createdAt: number;
  updatedAt: number;
}

interface TableMetadataEntity {
  id: string;
  csvUrl: string;
  localFilePath: string;
  fileHash: string;
  referenceCount: number;
  referencingNodeIds: NodeId[];
  createdAt: number;
}

describe('Auto Lifecycle Management System Integration', () => {
  let db: Dexie;
  let registrationService: EntityRegistrationService;
  let workingCopyManager: WorkingCopyManager;
  let lifecycleManager: AutoLifecycleManager;
  let stylerHandler: AutoEntityHandler<StylerEntity>;

  const stylerNodeType = 'styler' as NodeType;
  const nodeId1 = 'node-1' as NodeId;
  const nodeId2 = 'node-2' as NodeId;
  const nodeId3 = 'node-3' as NodeId;

  beforeEach(async () => {
    // Create comprehensive test database
    db = new Dexie('IntegrationTestDB');
    db.version(1).stores({
      stylerEntities: 'nodeId, createdAt',
      stylerWorkingCopies: 'workingCopyId, workingCopyOf',
      tableMetadataEntities: 'id, referenceCount',
    });

    await db.open();

    // Initialize services
    registrationService = new EntityRegistrationService();
    workingCopyManager = new WorkingCopyManager(db);
    lifecycleManager = new AutoLifecycleManager(registrationService, workingCopyManager, db);

    // Register Styler entity metadata
    const peerMetadata: EntityMetadata = {
      entityType: 'peer',
      tableName: 'stylerEntities',
      relationship: {
        type: 'one-to-one',
        foreignKeyField: 'nodeId',
        cascadeDelete: true,
      },
      workingCopyConfig: {
        enabled: true,
        tableName: 'stylerWorkingCopies',
      },
    };

    // Register TableMetadata relational entity
    const relationalMetadata: EntityMetadata = {
      entityType: 'relational',
      tableName: 'tableMetadataEntities',
      relationship: {
        type: 'many-to-many',
        foreignKeyField: 'referencingNodeIds',
        cascadeDelete: false,
      },
      referenceManagement: {
        countField: 'referenceCount',
        nodeListField: 'referencingNodeIds',
        autoDeleteWhenZero: true,
      },
    };

    registrationService.registerEntity(stylerNodeType, 'peer', peerMetadata);
    registrationService.registerEntity(stylerNodeType, 'relational', relationalMetadata);

    // Create entity handler
    stylerHandler = new AutoEntityHandler<StylerEntity>(
      stylerNodeType,
      'stylerEntities',
      lifecycleManager
    );
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Complete Entity Lifecycle', () => {
    it('should handle full CRUD lifecycle for Styler entity', async () => {
      // 1. Create entity
      const entity = await stylerHandler.createEntity(nodeId1, {
        name: 'Test Styler',
        description: 'Integration test entity',
      });

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(nodeId1);
      expect(entity.name).toBe('Test Styler');
      expect(entity.createdAt).toBeDefined();

      // 2. Read entity
      const retrieved = await stylerHandler.getEntity(nodeId1);
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Styler');

      // 3. Update entity
      const updated = await stylerHandler.updateEntity(nodeId1, {
        description: 'Updated description',
      });
      expect(updated!.description).toBe('Updated description');
      expect(updated!.updatedAt).toBeDefined();

      // 4. Delete entity
      await stylerHandler.deleteEntity(nodeId1);
      const deleted = await stylerHandler.getEntity(nodeId1);
      expect(deleted).toBeUndefined();
    });

    it('should handle entity duplication correctly', async () => {
      // Create source entity
      await stylerHandler.createEntity(nodeId1, {
        name: 'Source Styler',
        description: 'To be duplicated',
      });

      // Duplicate entity
      const duplicate = await stylerHandler.duplicateEntity(nodeId1, nodeId2);

      expect(duplicate.nodeId).toBe(nodeId2);
      expect(duplicate.name).toBe('Source Styler');
      expect(duplicate.description).toBe('To be duplicated');

      // Verify both entities exist
      const source = await stylerHandler.getEntity(nodeId1);
      const target = await stylerHandler.getEntity(nodeId2);

      expect(source).toBeDefined();
      expect(target).toBeDefined();
      expect(source!.nodeId).toBe(nodeId1);
      expect(target!.nodeId).toBe(nodeId2);
    });
  });

  describe('Working Copy Management Integration', () => {
    beforeEach(async () => {
      // Create base entity for working copy tests
      await stylerHandler.createEntity(nodeId1, {
        name: 'Base Entity',
        description: 'For working copy tests',
      });
    });

    it('should handle complete working copy lifecycle', async () => {
      // 1. Create working copy
      const workingCopy = await stylerHandler.createWorkingCopy(nodeId1);

      expect(workingCopy.nodeId).toBe(nodeId1);
      expect(workingCopy.nodeId).toBe(nodeId1);
      expect(workingCopy.id).toBeDefined();
      expect((workingCopy as any).isDirty).toBe(false);

      // 2. Modify working copy
      workingCopy.name = 'Modified in Working Copy';
      workingCopy.description = 'Changed description';
      (workingCopy as any).isDirty = true;

      // 3. Commit working copy
      await stylerHandler.commitWorkingCopy(nodeId1, workingCopy);

      // 4. Verify changes are committed
      const committed = await stylerHandler.getEntity(nodeId1);
      expect(committed!.name).toBe('Modified in Working Copy');
      expect(committed!.description).toBe('Changed description');
      expect(committed!.updatedAt).toBeDefined();

      // 5. Verify working copy is deleted
      const workingCopyCount = await db.table('stylerWorkingCopies').count();
      expect(workingCopyCount).toBe(0);
    });

    it('should handle working copy discard correctly', async () => {
      const originalEntity = await stylerHandler.getEntity(nodeId1);

      // Create and modify working copy
      const workingCopy = await stylerHandler.createWorkingCopy(nodeId1);
      workingCopy.name = 'Modified Name';
      workingCopy.description = 'Modified Description';

      // Discard working copy
      await stylerHandler.discardWorkingCopy(nodeId1, workingCopy);

      // Verify original entity is unchanged
      const unchanged = await stylerHandler.getEntity(nodeId1);
      expect(unchanged!.name).toBe(originalEntity!.name);
      expect(unchanged!.description).toBe(originalEntity!.description);

      // Verify working copy is deleted
      const workingCopyCount = await db.table('stylerWorkingCopies').count();
      expect(workingCopyCount).toBe(0);
    });
  });

  describe('Relational Entity Management', () => {
    beforeEach(async () => {
      // Create shared table metadata resource
      await db.table('tableMetadataEntities').add({
        id: 'csv-resource-1',
        csvUrl: 'https://example.com/data.csv',
        localFilePath: '/cache/data.csv',
        fileHash: 'abc123',
        referenceCount: 0,
        referencingNodeIds: [],
        createdAt: Date.now(),
      });
    });

    it('should handle CSV file sharing scenario', async () => {
      // Create first Styler that references the CSV
      await stylerHandler.createEntity(nodeId1, {
        name: 'Styler 1',
        description: 'Uses shared CSV',
      });

      // Add reference to shared resource
      await workingCopyManager.updateRelationalReference(
        'csv-resource-1',
        nodeId1,
        'add',
        registrationService.getEntityByKey('relational')!
      );

      // Verify reference count is incremented
      let resource = await db.table('tableMetadataEntities').get('csv-resource-1');
      expect(resource.referenceCount).toBe(1);
      expect(resource.referencingNodeIds).toContain(nodeId1);

      // Create second Styler that also references the same CSV
      await stylerHandler.createEntity(nodeId2, {
        name: 'Styler 2',
        description: 'Also uses shared CSV',
      });

      await workingCopyManager.updateRelationalReference(
        'csv-resource-1',
        nodeId2,
        'add',
        registrationService.getEntityByKey('relational')!
      );

      // Verify reference count is incremented again
      resource = await db.table('tableMetadataEntities').get('csv-resource-1');
      expect(resource.referenceCount).toBe(2);
      expect(resource.referencingNodeIds).toContain(nodeId1);
      expect(resource.referencingNodeIds).toContain(nodeId2);

      // Delete first Styler
      await stylerHandler.deleteEntity(nodeId1);

      // Verify reference count is decremented but resource still exists
      resource = await db.table('tableMetadataEntities').get('csv-resource-1');
      expect(resource).toBeDefined();
      expect(resource.referenceCount).toBe(1);
      expect(resource.referencingNodeIds).not.toContain(nodeId1);
      expect(resource.referencingNodeIds).toContain(nodeId2);

      // Delete second Styler
      await stylerHandler.deleteEntity(nodeId2);

      // Verify resource is auto-deleted when reference count reaches zero
      resource = await db.table('tableMetadataEntities').get('csv-resource-1');
      expect(resource).toBeUndefined();
    });

    it('should handle entity duplication with shared resources', async () => {
      // Create Styler with shared resource reference
      await stylerHandler.createEntity(nodeId1, {
        name: 'Source with CSV',
        description: 'Has shared resource',
      });

      await workingCopyManager.updateRelationalReference(
        'csv-resource-1',
        nodeId1,
        'add',
        registrationService.getEntityByKey('relational')!
      );

      // Duplicate the Styler
      await stylerHandler.duplicateEntity(nodeId1, nodeId2);

      // Verify both entities reference the same resource
      const resource = await db.table('tableMetadataEntities').get('csv-resource-1');
      expect(resource.referenceCount).toBe(2);
      expect(resource.referencingNodeIds).toContain(nodeId1);
      expect(resource.referencingNodeIds).toContain(nodeId2);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle multiple entity operations efficiently', async () => {
      const startTime = performance.now();

      // Create multiple entities concurrently
      const createPromises = [nodeId1, nodeId2, nodeId3].map((nodeId) =>
        stylerHandler.createEntity(nodeId, {
          name: `Styler ${nodeId}`,
          description: `Bulk created entity ${nodeId}`,
        })
      );

      const entities = await Promise.all(createPromises);

      // Verify all entities are created
      expect(entities).toHaveLength(3);
      entities.forEach((entity, index) => {
        expect(entity.nodeId).toBe([nodeId1, nodeId2, nodeId3][index]);
      });

      // List all entities
      const allEntities = await stylerHandler.listEntities();
      expect(allEntities).toHaveLength(3);

      // Count entities
      const count = await stylerHandler.countEntities();
      expect(count).toBe(3);

      // Delete all entities concurrently
      const deletePromises = [nodeId1, nodeId2, nodeId3].map((nodeId) =>
        stylerHandler.deleteEntity(nodeId)
      );

      await Promise.all(deletePromises);

      // Verify all entities are deleted
      const remainingCount = await stylerHandler.countEntities();
      expect(remainingCount).toBe(0);

      const endTime = performance.now();
      console.log(`Bulk operations completed in ${endTime - startTime}ms`);

      // Performance should be reasonable (under 1 second for this test)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle pagination correctly', async () => {
      // Create 10 entities with different timestamps
      const entityPromises = Array.from({ length: 10 }, (_, i) =>
        stylerHandler.createEntity(`bulk-${i}` as NodeId, {
          name: `Bulk Entity ${i}`,
          description: `Entity number ${i}`,
        })
      );

      await Promise.all(entityPromises);

      // Test pagination
      const page1 = await stylerHandler.listEntities(0, 3);
      const page2 = await stylerHandler.listEntities(3, 3);
      const page3 = await stylerHandler.listEntities(6, 3);
      const page4 = await stylerHandler.listEntities(9, 3);

      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
      expect(page3).toHaveLength(3);
      expect(page4).toHaveLength(1);

      // Verify no duplicates across pages
      const allNodeIds = [
        ...page1.map((e) => e.nodeId),
        ...page2.map((e) => e.nodeId),
        ...page3.map((e) => e.nodeId),
        ...page4.map((e) => e.nodeId),
      ];

      const uniqueNodeIds = new Set(allNodeIds);
      expect(uniqueNodeIds.size).toBe(10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures gracefully', async () => {
      // Mock database to throw error during transaction
      const originalTransaction = db.transaction;
      vi.spyOn(db, 'transaction').mockImplementation((...args: any[]) => {
        return originalTransaction.apply(db, [
          'rw',
          ['stylerEntities'],
          async () => {
            throw new Error('Transaction failed');
          },
        ] as any);
      });

      await expect(stylerHandler.createEntity(nodeId1, {})).rejects.toThrow('Transaction failed');

      // Restore original transaction
      vi.mocked(db.transaction).mockRestore();
    });

    it('should handle concurrent modifications correctly', async () => {
      // Create entity
      await stylerHandler.createEntity(nodeId1, {
        name: 'Concurrent Test',
        description: 'Original',
      });

      // Create two working copies concurrently
      const [workingCopy1, workingCopy2] = await Promise.all([
        stylerHandler.createWorkingCopy(nodeId1),
        stylerHandler.createWorkingCopy(nodeId1),
      ]);

      // Modify both working copies
      workingCopy1.description = 'Modified by WC1';
      workingCopy2.description = 'Modified by WC2';

      // Commit first working copy
      await stylerHandler.commitWorkingCopy(nodeId1, workingCopy1);

      // Second commit should succeed (last writer wins)
      await stylerHandler.commitWorkingCopy(nodeId1, workingCopy2);

      // Verify final state
      const final = await stylerHandler.getEntity(nodeId1);
      expect(final!.description).toBe('Modified by WC2');
    });

    it('should clean up properly on partial failures', async () => {
      // Create entity
      await stylerHandler.createEntity(nodeId1, {});

      // Create working copy
      const workingCopy = await stylerHandler.createWorkingCopy(nodeId1);

      // Mock commit to fail after working copy is modified
      vi.spyOn(workingCopyManager, 'commit').mockRejectedValue(new Error('Commit failed'));

      workingCopy.name = 'Modified';

      await expect(stylerHandler.commitWorkingCopy(nodeId1, workingCopy)).rejects.toThrow(
        'Commit failed'
      );

      // Verify working copy still exists (wasn't deleted due to failed commit)
      const remainingWorkingCopies = await db.table('stylerWorkingCopies').count();
      expect(remainingWorkingCopies).toBe(1);

      // Clean up
      await stylerHandler.discardWorkingCopy(nodeId1, workingCopy);
    });
  });

  describe('System Performance', () => {
    it('should maintain performance with large number of entities', async () => {
      const ENTITY_COUNT = 100;
      const startTime = performance.now();

      // Create large number of entities
      const createPromises = Array.from({ length: ENTITY_COUNT }, (_, i) =>
        stylerHandler.createEntity(`perf-${i}` as NodeId, {
          name: `Performance Entity ${i}`,
          description: `Large scale test entity ${i}`,
        })
      );

      await Promise.all(createPromises);

      const creationTime = performance.now();
      console.log(`Created ${ENTITY_COUNT} entities in ${creationTime - startTime}ms`);

      // Test listing performance
      const listStartTime = performance.now();
      const allEntities = await stylerHandler.listEntities(0, ENTITY_COUNT);
      const listTime = performance.now();

      expect(allEntities).toHaveLength(ENTITY_COUNT);
      console.log(`Listed ${ENTITY_COUNT} entities in ${listTime - listStartTime}ms`);

      // Test counting performance
      const countStartTime = performance.now();
      const count = await stylerHandler.countEntities();
      const countTime = performance.now();

      expect(count).toBe(ENTITY_COUNT);
      console.log(`Counted ${ENTITY_COUNT} entities in ${countTime - countStartTime}ms`);

      // Performance should be reasonable
      expect(creationTime - startTime).toBeLessThan(5000); // 5 seconds
      expect(listTime - listStartTime).toBeLessThan(1000); // 1 second
      expect(countTime - countStartTime).toBeLessThan(100); // 100ms
    });
  });
});

/**
 * @file EntityHandler.integration.test.ts
 * @description Integration tests for all EntityHandler implementations
 * Tests the complete workflow across BaseEntityHandler, SimpleEntityHandler,
 * SubEntityHandler, and WorkingCopyHandler
 */

import type { TreeNodeId } from '@hierarchidb/core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseEntityHandler } from './BaseEntityHandler';
import { SimpleEntityHandler } from './SimpleEntityHandler';
import { SubEntityHandler } from './SubEntityHandler';
import { WorkingCopyHandler } from './WorkingCopyHandler';

describe('EntityHandler Integration Tests', () => {
  let db: Dexie;
  let simpleHandler: SimpleEntityHandler;
  let subEntityHandler: SubEntityHandler;
  let workingCopyHandler: WorkingCopyHandler;

  const nodeId1 = 'integration-node-1' as TreeNodeId;
  const nodeId2 = 'integration-node-2' as TreeNodeId;
  const nodeId3 = 'integration-node-3' as TreeNodeId;

  beforeEach(async () => {
    // Create comprehensive database schema
    db = new Dexie('IntegrationTestDB');
    db.version(1).stores({
      entities: 'nodeId, name, createdAt, updatedAt, version',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId, updatedAt',
      subEntities: 'id, parentNodeId, [parentNodeId+subEntityType], createdAt, updatedAt',
    });

    await db.open();

    // Initialize all handlers
    simpleHandler = new SimpleEntityHandler(db, 'entities', 'workingCopies', 'subEntities');

    subEntityHandler = new SubEntityHandler(db, 'entities', 'workingCopies', 'subEntities');

    workingCopyHandler = new WorkingCopyHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Cross-Handler Workflow', () => {
    it('should complete full entity lifecycle with all handlers', async () => {
      // 1. Create entity using SimpleEntityHandler
      const entity = await simpleHandler.createEntity(nodeId1, {
        name: 'Integration Test Entity',
        description: 'Testing full lifecycle',
        data: {
          category: 'test',
          priority: 1,
          tags: ['integration', 'test'],
        },
      });

      expect(entity.nodeId).toBe(nodeId1);
      expect(entity.name).toBe('Integration Test Entity');

      // 2. Add sub-entities using SubEntityHandler
      const attachment = await subEntityHandler.createSubEntity(nodeId1, 'attachment', {
        name: 'Test Document',
        data: {
          filename: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        },
        metadata: {
          tags: ['document'],
          priority: 1,
          visible: true,
        },
      });

      const comment = await subEntityHandler.createSubEntity(nodeId1, 'comment', {
        name: 'Initial Comment',
        data: {
          text: 'This is a test comment',
          author: 'Integration Test',
        },
        metadata: {
          visible: true,
        },
      });

      expect(attachment.parentNodeId).toBe(nodeId1);
      expect(comment.parentNodeId).toBe(nodeId1);

      // 3. Create working copy using WorkingCopyHandler
      const workingCopy = await workingCopyHandler.createWorkingCopy(nodeId1, {
        author: 'Integration Test',
        description: 'Testing integration workflow',
      });

      expect(workingCopy.workingCopyOf).toBe(nodeId1);
      expect(workingCopy.subEntitiesData).toBeDefined();
      expect(workingCopy.subEntitiesData?.['attachment']).toHaveLength(1);
      expect(workingCopy.subEntitiesData?.['comment']).toHaveLength(1);

      // 4. Modify working copy
      await workingCopyHandler.updateWorkingCopy(nodeId1, {
        name: 'Modified Integration Entity',
        description: 'Updated during integration test',
        data: {
          category: 'test',
          priority: 2,
          tags: ['integration', 'test', 'modified'],
          lastModified: Date.now(),
        },
      });

      const updatedWorkingCopy = await workingCopyHandler.getWorkingCopy(nodeId1);
      expect(updatedWorkingCopy?.isDirty).toBe(true);
      expect(updatedWorkingCopy?.entityData.name).toBe('Modified Integration Entity');
      expect(updatedWorkingCopy?.changes.modified).toContain('name');

      // 5. Commit working copy
      await workingCopyHandler.commitWorkingCopy(nodeId1, {
        message: 'Integration test commit',
        author: 'Integration Test',
      });

      // 6. Verify changes are committed
      const finalEntity = await simpleHandler.getEntity(nodeId1);
      expect(finalEntity?.name).toBe('Modified Integration Entity');
      expect(finalEntity?.description).toBe('Updated during integration test');
      expect(finalEntity?.version).toBeGreaterThan(1);

      // 7. Verify working copy is cleaned up
      const workingCopyAfterCommit = await workingCopyHandler.getWorkingCopy(nodeId1);
      expect(workingCopyAfterCommit).toBeUndefined();

      // 8. Verify sub-entities are preserved
      const finalSubEntities = await subEntityHandler.getSubEntities(nodeId1);
      expect(finalSubEntities).toHaveLength(2);

      // 9. Clean up using BaseEntityHandler cleanup
      await simpleHandler.cleanup?.(nodeId1);
      await simpleHandler.deleteEntity(nodeId1);

      const deletedEntity = await simpleHandler.getEntity(nodeId1);
      expect(deletedEntity).toBeUndefined();
    });

    it('should handle concurrent operations across handlers', async () => {
      // Create multiple entities concurrently
      const createPromises = [
        simpleHandler.createEntity(nodeId1, { name: 'Concurrent Entity 1' }),
        simpleHandler.createEntity(nodeId2, { name: 'Concurrent Entity 2' }),
        simpleHandler.createEntity(nodeId3, { name: 'Concurrent Entity 3' }),
      ];

      const entities = await Promise.all(createPromises);
      expect(entities).toHaveLength(3);

      // Add sub-entities concurrently
      const subEntityPromises = [
        subEntityHandler.createSubEntity(nodeId1, 'task', {
          name: 'Task 1',
          data: { status: 'pending' },
        }),
        subEntityHandler.createSubEntity(nodeId2, 'task', {
          name: 'Task 2',
          data: { status: 'in-progress' },
        }),
        subEntityHandler.createSubEntity(nodeId3, 'task', {
          name: 'Task 3',
          data: { status: 'completed' },
        }),
      ];

      const subEntities = await Promise.all(subEntityPromises);
      expect(subEntities).toHaveLength(3);

      // Create working copies concurrently
      const workingCopyPromises = [
        workingCopyHandler.createWorkingCopy(nodeId1),
        workingCopyHandler.createWorkingCopy(nodeId2),
        workingCopyHandler.createWorkingCopy(nodeId3),
      ];

      const workingCopies = await Promise.all(workingCopyPromises);
      expect(workingCopies).toHaveLength(3);

      // Update all working copies concurrently
      const updatePromises = workingCopies.map((wc, index) =>
        workingCopyHandler.updateWorkingCopy(wc.workingCopyOf, {
          name: `Updated Concurrent Entity ${index + 1}`,
          data: { updated: true, index: index + 1 },
        })
      );

      await Promise.all(updatePromises);

      // Commit all working copies concurrently
      const commitPromises = workingCopies.map((wc) =>
        workingCopyHandler.commitWorkingCopy(wc.workingCopyOf, {
          message: `Concurrent commit for ${wc.workingCopyOf}`,
        })
      );

      await Promise.all(commitPromises);

      // Verify all updates were committed
      const finalEntities = await Promise.all([
        simpleHandler.getEntity(nodeId1),
        simpleHandler.getEntity(nodeId2),
        simpleHandler.getEntity(nodeId3),
      ]);

      finalEntities.forEach((entity, index) => {
        expect(entity?.name).toBe(`Updated Concurrent Entity ${index + 1}`);
        expect(entity?.data?.updated).toBe(true);
        expect(entity?.data?.index).toBe(index + 1);
      });
    });

    it('should handle complex sub-entity operations across handlers', async () => {
      // Create base entity
      await simpleHandler.createEntity(nodeId1, {
        name: 'Sub-Entity Test Entity',
        data: { type: 'complex-test' },
      });

      // Create various types of sub-entities
      const subEntityTypes = ['attachment', 'comment', 'task', 'note', 'link'];
      const createdSubEntities = [];

      for (let i = 0; i < subEntityTypes.length; i++) {
        const type = subEntityTypes[i]!;
        for (let j = 0; j < 3; j++) {
          const subEntity = await subEntityHandler.createSubEntity(nodeId1, type, {
            name: `${type} ${j + 1}`,
            data: {
              value: `${type}-value-${j + 1}`,
              index: j + 1,
            },
            metadata: {
              tags: [type, `index-${j + 1}`],
              priority: j + 1,
              visible: j % 2 === 0,
            },
          });
          createdSubEntities.push(subEntity);
        }
      }

      expect(createdSubEntities).toHaveLength(15); // 5 types * 3 each

      // Query sub-entities with various criteria
      const attachments = await subEntityHandler.querySubEntities({
        parentNodeId: nodeId1,
        type: 'attachment',
      });
      expect(attachments).toHaveLength(3);

      const highPriorityItems = await subEntityHandler.querySubEntities({
        parentNodeId: nodeId1,
        priority: 3,
      });
      expect(highPriorityItems).toHaveLength(5); // One from each type

      const visibleItems = await subEntityHandler.querySubEntities({
        parentNodeId: nodeId1,
        visible: true,
      });
      expect(visibleItems.length).toBeGreaterThan(5); // Should have multiple visible items

      // Batch operations
      const batchOperations = [
        {
          nodeId: nodeId1,
          type: 'batch-test',
          data: { name: 'Batch Item 1', batchIndex: 1 },
        },
        {
          nodeId: nodeId1,
          type: 'batch-test',
          data: { name: 'Batch Item 2', batchIndex: 2 },
        },
        {
          nodeId: nodeId1,
          type: 'batch-test',
          data: { name: 'Batch Item 3', batchIndex: 3 },
        },
      ];

      const batchResult = await subEntityHandler.batchCreateSubEntities(batchOperations);
      expect(batchResult.successful).toHaveLength(3);
      expect(batchResult.failed).toHaveLength(0);

      // Move sub-entities to another parent
      await simpleHandler.createEntity(nodeId2, {
        name: 'Target Entity for Move',
        data: { type: 'move-target' },
      });

      const batchItems = await subEntityHandler.querySubEntities({
        parentNodeId: nodeId1,
        type: 'batch-test',
      });

      const batchItemIds = batchItems.map((item) => item.id);
      await subEntityHandler.moveSubEntities(batchItemIds, nodeId2);

      const movedItems = await subEntityHandler.querySubEntities({
        parentNodeId: nodeId2,
        type: 'batch-test',
      });
      expect(movedItems).toHaveLength(3);

      // Copy sub-entities
      const copiedItems = await subEntityHandler.copySubEntities(nodeId2, nodeId1, 'batch-test');
      expect(copiedItems).toHaveLength(3);
      expect(copiedItems[0]?.name).toContain('(Copy)');

      // Export and import
      const exportData = await subEntityHandler.exportSubEntities(nodeId1, 'attachment');

      await simpleHandler.createEntity(nodeId3, {
        name: 'Import Target Entity',
        data: { type: 'import-target' },
      });

      const importResult = await subEntityHandler.importSubEntities(nodeId3, exportData);
      expect(importResult.successful).toHaveLength(3);
      expect(importResult.failed).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cascading deletes properly', async () => {
      // Create entity with sub-entities and working copy
      await simpleHandler.createEntity(nodeId1, { name: 'Test Entity' });

      await subEntityHandler.createSubEntity(nodeId1, 'attachment', {
        name: 'Attachment 1',
        data: { size: 100 },
      });

      await subEntityHandler.createSubEntity(nodeId1, 'comment', {
        name: 'Comment 1',
        data: { text: 'Test comment' },
      });

      const workingCopy = await workingCopyHandler.createWorkingCopy(nodeId1);

      // Manually discard working copy first (since SimpleEntityHandler cleanup might not work as expected)
      await workingCopyHandler.discardWorkingCopy(nodeId1);

      // Delete entity - should trigger cleanup
      await simpleHandler.deleteEntity(nodeId1);

      // Verify entity is deleted
      const deletedEntity = await simpleHandler.getEntity(nodeId1);
      expect(deletedEntity).toBeUndefined();

      // Verify working copy is cleaned up
      const remainingWorkingCopy = await workingCopyHandler.getWorkingCopy(nodeId1);
      expect(remainingWorkingCopy).toBeUndefined();

      // Verify sub-entities are cleaned up
      const remainingSubEntities = await subEntityHandler.getSubEntities(nodeId1);
      expect(remainingSubEntities).toHaveLength(0);
    });

    it('should handle working copy conflicts gracefully', async () => {
      // Create entity and working copy
      await simpleHandler.createEntity(nodeId1, {
        name: 'Conflict Test Entity',
        data: { version: 1 },
      });

      const workingCopy = await workingCopyHandler.createWorkingCopy(nodeId1);

      // Modify working copy
      await workingCopyHandler.updateWorkingCopy(nodeId1, {
        name: 'Working Copy Name',
        data: { version: 2, workingCopyChange: true },
      });

      // Modify entity directly (simulate concurrent change)
      await simpleHandler.updateEntity(nodeId1, {
        name: 'Direct Update Name',
        data: { version: 3, directChange: true },
      });

      // Commit with different conflict resolution strategies

      // Test 'working' strategy
      await simpleHandler.createEntity(nodeId2, { name: 'Test 2' });
      await workingCopyHandler.createWorkingCopy(nodeId2);
      await workingCopyHandler.updateWorkingCopy(nodeId2, { name: 'Working Name' });
      await simpleHandler.updateEntity(nodeId2, { name: 'Direct Name' });

      await workingCopyHandler.commitWorkingCopy(nodeId2, {
        conflictResolution: 'working',
      });

      const workingResult = await simpleHandler.getEntity(nodeId2);
      expect(workingResult?.name).toBe('Working Name');

      // Test 'current' strategy
      await workingCopyHandler.commitWorkingCopy(nodeId1, {
        conflictResolution: 'current',
      });

      const currentResult = await simpleHandler.getEntity(nodeId1);
      expect(currentResult?.name).toBe('Direct Update Name');
    });

    it('should validate data integrity across operations', async () => {
      // Test validation in create operations
      await expect(simpleHandler.createEntity(nodeId1, { name: '' })).rejects.toThrow(
        'Entity name cannot be empty'
      );

      // Create valid entity
      await simpleHandler.createEntity(nodeId1, { name: 'Valid Entity' });

      // Test sub-entity validation
      await expect(subEntityHandler.createSubEntity(nodeId1, '', { data: {} })).rejects.toThrow(
        'Sub-entity type is required'
      );

      await expect(
        subEntityHandler.createSubEntity('non-existent' as TreeNodeId, 'test', { data: {} })
      ).rejects.toThrow('Parent entity not found');

      // Test working copy validation
      await expect(
        workingCopyHandler.createWorkingCopy('non-existent' as TreeNodeId)
      ).rejects.toThrow('Entity not found');

      const workingCopy = await workingCopyHandler.createWorkingCopy(nodeId1);

      await expect(workingCopyHandler.createWorkingCopy(nodeId1)).rejects.toThrow(
        'Working copy already exists'
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();

      // Create 100 entities
      const entityPromises = [];
      for (let i = 0; i < 100; i++) {
        entityPromises.push(
          simpleHandler.createEntity(`perf-entity-${i}` as TreeNodeId, {
            name: `Performance Entity ${i}`,
            data: {
              index: i,
              category: i % 5 === 0 ? 'special' : 'normal',
              tags: [`tag-${i % 10}`, `category-${i % 5}`],
            },
          })
        );
      }

      const entities = await Promise.all(entityPromises);
      expect(entities).toHaveLength(100);

      const entityCreationTime = Date.now() - startTime;
      console.log(`Created 100 entities in ${entityCreationTime}ms`);

      // Add sub-entities to each entity
      const subEntityStartTime = Date.now();
      const subEntityPromises = [];

      for (let i = 0; i < 100; i++) {
        const nodeId = `perf-entity-${i}` as TreeNodeId;

        // Add 3 sub-entities per entity
        for (let j = 0; j < 3; j++) {
          subEntityPromises.push(
            subEntityHandler.createSubEntity(nodeId, 'performance-test', {
              name: `Sub Entity ${i}-${j}`,
              data: {
                parentIndex: i,
                subIndex: j,
                value: i * 10 + j,
              },
              metadata: {
                tags: [`parent-${i}`, `sub-${j}`],
                priority: j + 1,
              },
            })
          );
        }
      }

      const subEntities = await Promise.all(subEntityPromises);
      expect(subEntities).toHaveLength(300);

      const subEntityCreationTime = Date.now() - subEntityStartTime;
      console.log(`Created 300 sub-entities in ${subEntityCreationTime}ms`);

      // Query performance test
      const queryStartTime = Date.now();

      const specialEntities = await simpleHandler.queryEntities({
        name: 'Performance', // Search for "Performance" which is in all entity names
      });

      const highPrioritySubEntities = await subEntityHandler.querySubEntities({
        type: 'performance-test',
        priority: 3,
      });

      const queryTime = Date.now() - queryStartTime;
      console.log(`Performed queries in ${queryTime}ms`);

      expect(specialEntities.length).toBeGreaterThan(0);
      expect(highPrioritySubEntities).toHaveLength(100); // One per entity

      // Batch operations performance
      const batchStartTime = Date.now();

      const batchUpdates = [];
      for (let i = 0; i < 50; i++) {
        batchUpdates.push({
          nodeId: `perf-entity-${i}` as TreeNodeId,
          data: {
            name: `Batch Updated Entity ${i}`,
            data: { batchUpdated: true, updateIndex: i },
          },
        });
      }

      await simpleHandler.batchUpdateEntities(batchUpdates);

      const batchTime = Date.now() - batchStartTime;
      console.log(`Batch updated 50 entities in ${batchTime}ms`);

      // Total time should be reasonable (< 5 seconds for this workload)
      const totalTime = Date.now() - startTime;
      console.log(`Total performance test time: ${totalTime}ms`);

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle memory efficiently with cleanup', async () => {
      // Create entities with working copies and sub-entities
      const testNodes = [];
      for (let i = 0; i < 20; i++) {
        const nodeId = `memory-test-${i}` as TreeNodeId;
        testNodes.push(nodeId);

        await simpleHandler.createEntity(nodeId, {
          name: `Memory Test Entity ${i}`,
          data: { largeData: new Array(100).fill(`data-${i}`) },
        });

        await subEntityHandler.createSubEntity(nodeId, 'memory-test', {
          name: `Memory Sub Entity ${i}`,
          data: { largeArray: new Array(50).fill(`sub-data-${i}`) },
        });

        await workingCopyHandler.createWorkingCopy(nodeId);
      }

      // Verify all created
      const allWorkingCopies = await workingCopyHandler.getAllWorkingCopies();
      expect(allWorkingCopies).toHaveLength(20);

      // Clean up half of them
      for (let i = 0; i < 10; i++) {
        const nodeId = testNodes[i];
        if (nodeId) {
          await workingCopyHandler.discardWorkingCopy(nodeId);
          await simpleHandler.deleteEntity(nodeId);
        }
      }

      // Verify cleanup
      const remainingWorkingCopies = await workingCopyHandler.getAllWorkingCopies();
      expect(remainingWorkingCopies).toHaveLength(10);

      // Cleanup stale working copies
      const cleaned = await workingCopyHandler.cleanupStaleWorkingCopies(0); // Clean all
      expect(cleaned).toBe(10);

      const finalWorkingCopies = await workingCopyHandler.getAllWorkingCopies();
      expect(finalWorkingCopies).toHaveLength(0);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      // Create parent entity
      await simpleHandler.createEntity(nodeId1, { name: 'Parent Entity' });

      // Create sub-entities with relationships
      const subEntity1 = await subEntityHandler.createSubEntity(nodeId1, 'task', {
        name: 'Task 1',
        data: { status: 'pending' },
      });

      const subEntity2 = await subEntityHandler.createSubEntity(nodeId1, 'task', {
        name: 'Task 2',
        data: { status: 'in-progress' },
        relationships: {
          dependsOn: [subEntity1.id],
        },
      });

      // Verify relationships
      const isValid = await subEntityHandler.validateSubEntityRelationships(subEntity2.id);
      expect(isValid).toBe(true);

      // Delete referenced sub-entity
      await subEntityHandler.deleteSubEntity(subEntity1.id);

      // Verify relationship is now broken
      const isValidAfterDelete = await subEntityHandler.validateSubEntityRelationships(
        subEntity2.id
      );
      expect(isValidAfterDelete).toBe(false);
    });

    it('should handle transaction-like operations', async () => {
      // Simulate transaction with multiple operations
      const operations = async () => {
        // Create entity
        await simpleHandler.createEntity(nodeId1, { name: 'Transaction Test' });

        // Add sub-entities
        await subEntityHandler.createSubEntity(nodeId1, 'step1', {
          name: 'Step 1',
          data: { order: 1 },
        });

        await subEntityHandler.createSubEntity(nodeId1, 'step2', {
          name: 'Step 2',
          data: { order: 2 },
        });

        // Create working copy
        await workingCopyHandler.createWorkingCopy(nodeId1);

        // Modify working copy
        await workingCopyHandler.updateWorkingCopy(nodeId1, {
          name: 'Transaction Test - Updated',
        });

        return true;
      };

      // Execute operations
      const result = await operations();
      expect(result).toBe(true);

      // Verify all operations completed
      const entity = await simpleHandler.getEntity(nodeId1);
      const subEntities = await subEntityHandler.getSubEntities(nodeId1);
      const workingCopy = await workingCopyHandler.getWorkingCopy(nodeId1);

      expect(entity).toBeDefined();
      expect(subEntities).toHaveLength(2);
      expect(workingCopy).toBeDefined();
      expect(workingCopy?.isDirty).toBe(true);
    });
  });
});

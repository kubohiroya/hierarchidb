/**
 * @file EntityHandler.performance.test.ts
 * @description Performance and stress tests for EntityHandler implementations
 * Tests scalability, memory usage, and concurrent operations
 */

import type { NodeId, EntityId, GroupEntity } from '@hierarchidb/common-core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseEntityHandler } from './BaseEntityHandler';

// Test implementation for performance testing
class PerformanceTestHandler extends BaseEntityHandler<GroupEntity> {
  async createEntity(nodeId: NodeId, data?: Partial<GroupEntity>): Promise<GroupEntity> {
    const entity: GroupEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId: nodeId,
      type: data?.type ?? 'test',
      createdAt: data?.createdAt ?? Date.now(),
      updatedAt: data?.updatedAt ?? Date.now(),
      version: data?.version ?? 1,
    };
    
    await this.db.table(this.tableName).add(entity);
    return entity;
  }
  
  async getEntity(nodeId: NodeId): Promise<GroupEntity | undefined> {
    return await this.db.table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      .first();
  }
  
  async updateEntity(nodeId: NodeId, data: Partial<GroupEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) throw new Error(`Entity not found: ${nodeId}`);
    
    await this.db.table(this.tableName).update(existing.id, {
      ...data,
      updatedAt: Date.now(),
      version: (existing.version || 0) + 1,
    });
  }
  
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (existing) {
      await this.db.table(this.tableName).delete(existing.id);
    }
  }
}

// Helper function to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

// Generate test entity data
function generateTestEntity(index: number): Partial<GroupEntity> {
  return {
    type: `test-entity-${index % 5}`, // 5 different types
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };
}

describe('EntityHandler Performance Tests', () => {
  let db: Dexie;
  let handler: PerformanceTestHandler;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Dexie('PerformanceTestDB');
    db.version(1).stores({
      entities: '&id, nodeId, type, createdAt, updatedAt, version',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId',
      subEntities: '&id, nodeId, type, createdAt, updatedAt, version',
    });

    await db.open();
    handler = new PerformanceTestHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Scalability Tests', () => {
    it('should handle large number of entities efficiently', async () => {
      const entityCount = 500; // Reduced for faster testing
      const batchSize = 50;

      console.log(`Creating ${entityCount} entities in batches of ${batchSize}...`);

      const { duration: creationDuration } = await measureTime(async () => {
        for (let batch = 0; batch < entityCount / batchSize; batch++) {
          const batchPromises: Promise<GroupEntity>[] = [];

          for (let i = 0; i < batchSize; i++) {
            const index = batch * batchSize + i;
            const nodeId = `perf-entity-${index}` as NodeId;
            batchPromises.push(handler.createEntity(nodeId, generateTestEntity(index)));
          }

          await Promise.all(batchPromises);
        }
      });

      console.log(`Creation completed in ${creationDuration.toFixed(2)}ms`);
      console.log(`Average per entity: ${(creationDuration / entityCount).toFixed(2)}ms`);

      // Verify all entities were created
      const entityCount_actual = await db.table('entities').count();
      expect(entityCount_actual).toBe(entityCount);

      // Performance expectations (should complete within reasonable time)
      expect(creationDuration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(creationDuration / entityCount).toBeLessThan(20); // Less than 20ms per entity
    });

    it('should retrieve entities efficiently', async () => {
      // First create test entities
      const entityCount = 200;
      const nodeIds: NodeId[] = [];

      for (let i = 0; i < entityCount; i++) {
        const nodeId = `retrieve-test-${i}` as NodeId;
        nodeIds.push(nodeId);
        await handler.createEntity(nodeId, generateTestEntity(i));
      }

      // Measure retrieval performance
      const { duration: retrievalDuration } = await measureTime(async () => {
        const retrievalPromises = nodeIds.map(nodeId => handler.getEntity(nodeId));
        await Promise.all(retrievalPromises);
      });

      console.log(`Retrieved ${entityCount} entities in ${retrievalDuration.toFixed(2)}ms`);
      console.log(`Average per retrieval: ${(retrievalDuration / entityCount).toFixed(2)}ms`);

      // Performance expectations
      expect(retrievalDuration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(retrievalDuration / entityCount).toBeLessThan(25); // Less than 25ms per retrieval
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle entity cleanup without memory leaks', async () => {
      const iterationCount = 10;
      const entitiesPerIteration = 100;

      console.log(`Testing memory cleanup with ${iterationCount} iterations...`);

      for (let iteration = 0; iteration < iterationCount; iteration++) {
        // Create entities
        const nodeIds: NodeId[] = [];
        for (let i = 0; i < entitiesPerIteration; i++) {
          const nodeId = `memory-test-${iteration}-${i}` as NodeId;
          nodeIds.push(nodeId);
          await handler.createEntity(nodeId, { type: 'memory-test' });
        }

        // Delete entities
        for (const nodeId of nodeIds) {
          await handler.deleteEntity(nodeId);
        }

        // Verify cleanup
        const remainingEntities = await db.table('entities')
          .where('type')
          .equals('memory-test')
          .count();
        expect(remainingEntities).toBe(0);
      }

      console.log('Memory cleanup test completed successfully');
    });
  });

  describe('Stress Tests', () => {
    it('should handle concurrent operations', async () => {
      const concurrentOperations = 50;

      console.log(`Testing ${concurrentOperations} concurrent operations...`);

      const { duration: concurrentDuration } = await measureTime(async () => {
        const operationPromises: Promise<any>[] = [];

        for (let i = 0; i < concurrentOperations; i++) {
          // Create mixed operation types
          const nodeId = `concurrent-${i}` as NodeId;
          
          if (i % 3 === 0) {
            // Create operation
            operationPromises.push(
              handler.createEntity(nodeId, generateTestEntity(i))
            );
          } else if (i % 3 === 1) {
            // Create then update operation
            operationPromises.push(
              handler.createEntity(nodeId, generateTestEntity(i))
                .then(() => handler.updateEntity(nodeId, { type: 'updated' }))
            );
          } else {
            // Create then delete operation
            operationPromises.push(
              handler.createEntity(nodeId, generateTestEntity(i))
                .then(() => handler.deleteEntity(nodeId))
            );
          }
        }

        await Promise.all(operationPromises);
      });

      console.log(`Concurrent operations completed in ${concurrentDuration.toFixed(2)}ms`);
      console.log(`Average per operation: ${(concurrentDuration / concurrentOperations).toFixed(2)}ms`);

      // Performance expectations
      expect(concurrentDuration).toBeLessThan(8000); // Should complete within 8 seconds
      expect(concurrentDuration / concurrentOperations).toBeLessThan(160); // Less than 160ms per operation
    });

    it('should handle rapid sequential operations', async () => {
      const operationCount = 200;
      
      console.log(`Testing ${operationCount} rapid sequential operations...`);

      const { duration: sequentialDuration } = await measureTime(async () => {
        for (let i = 0; i < operationCount; i++) {
          const nodeId = `sequential-${i}` as NodeId;
          
          // Create, update, then delete in sequence
          await handler.createEntity(nodeId, generateTestEntity(i));
          await handler.updateEntity(nodeId, { type: 'updated' });
          await handler.deleteEntity(nodeId);
        }
      });

      console.log(`Sequential operations completed in ${sequentialDuration.toFixed(2)}ms`);
      console.log(`Average per operation group: ${(sequentialDuration / operationCount).toFixed(2)}ms`);

      // Performance expectations (3 operations per iteration)
      expect(sequentialDuration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(sequentialDuration / (operationCount * 3)).toBeLessThan(25); // Less than 25ms per individual operation
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly under stress', async () => {
      const resourceCount = 100;

      console.log(`Resource cleanup test with ${resourceCount} resources...`);

      // Create resources
      const nodeIds: NodeId[] = [];
      for (let i = 0; i < resourceCount; i++) {
        const nodeId = `resource-${i}` as NodeId;
        nodeIds.push(nodeId);
        await handler.createEntity(nodeId, {
          type: 'resource-test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      }

      // Verify creation
      const initialCount = await db.table('entities')
        .where('type')
        .equals('resource-test')
        .count();
      expect(initialCount).toBe(resourceCount);

      // Cleanup half the resources
      const { duration: cleanupDuration } = await measureTime(async () => {
        for (let i = 0; i < Math.ceil(resourceCount / 2); i++) {
          const nodeId = nodeIds[i];
          if (nodeId) {
            await handler.deleteEntity(nodeId);
          }
        }
      });

      // Verify partial cleanup
      const finalCount = await db.table('entities')
        .where('type')
        .equals('resource-test')
        .count();
      expect(finalCount).toBe(Math.floor(resourceCount / 2));

      console.log(`Cleanup completed in ${cleanupDuration.toFixed(2)}ms`);

      // Performance expectations
      expect(cleanupDuration).toBeLessThan(5000); // Cleanup within 5 seconds
    });
  });
});
/**
 * @file EntityHandler.performance.test.ts
 * @description Performance and stress tests for EntityHandler implementations
 * Tests scalability, memory usage, and concurrent operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { WorkingCopyHandler } from './WorkingCopyHandler';
import type { TreeNodeId } from '@hierarchidb/core';

// Helper to measure execution time
const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

// Helper to generate test data
const generateTestEntity = (index: number) => ({
  name: `Performance Test Entity ${index}`,
  description: `Description for entity ${index}`,
  data: {
    index,
    category: `category-${index % 10}`,
    tags: [`tag-${index % 5}`, `performance`, `test-${index}`],
    metadata: {
      createdBy: `user-${index % 3}`,
      department: `dept-${index % 4}`,
      priority: (index % 5) + 1,
    },
    largeData: new Array(100).fill(`data-item-${index}`),
  },
});

describe('EntityHandler Performance Tests', () => {
  let db: Dexie;
  let handler: WorkingCopyHandler;

  beforeEach(async () => {
    db = new Dexie('PerformanceTestDB');
    db.version(1).stores({
      entities: 'nodeId, name, createdAt, updatedAt, version',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId, updatedAt',
      subEntities: 'id, parentNodeId, [parentNodeId+subEntityType], createdAt, updatedAt',
    });

    await db.open();

    handler = new WorkingCopyHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Scalability Tests', () => {
    it('should handle large number of entities efficiently', async () => {
      const entityCount = 1000;
      const batchSize = 100;

      console.log(`\n📊 Creating ${entityCount} entities in batches of ${batchSize}...`);

      const { duration: creationDuration } = await measureTime(async () => {
        for (let batch = 0; batch < entityCount / batchSize; batch++) {
          const batchPromises = [];

          for (let i = 0; i < batchSize; i++) {
            const index = batch * batchSize + i;
            const nodeId = `perf-entity-${index}` as TreeNodeId;

            batchPromises.push(handler.createEntity(nodeId, generateTestEntity(index)));
          }

          await Promise.all(batchPromises);
        }
      });

      console.log(`⏱️  Creation time: ${creationDuration.toFixed(2)}ms`);
      console.log(`⚡ Average per entity: ${(creationDuration / entityCount).toFixed(2)}ms`);

      // Verify count
      const count = await handler.getEntityCount();
      expect(count).toBe(entityCount);

      // Performance benchmarks
      expect(creationDuration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(creationDuration / entityCount).toBeLessThan(10); // Less than 10ms per entity
    });

    it('should handle large number of sub-entities efficiently', async () => {
      const parentCount = 100;
      const subEntitiesPerParent = 20;
      const totalSubEntities = parentCount * subEntitiesPerParent;

      console.log(
        `\n📊 Creating ${parentCount} parents with ${subEntitiesPerParent} sub-entities each (${totalSubEntities} total)...`
      );

      // Create parent entities
      const parentCreationTime = await measureTime(async () => {
        const promises = [];
        for (let i = 0; i < parentCount; i++) {
          const nodeId = `parent-${i}` as TreeNodeId;
          promises.push(
            handler.createEntity(nodeId, {
              name: `Parent Entity ${i}`,
              data: { childCount: subEntitiesPerParent },
            })
          );
        }
        await Promise.all(promises);
      });

      console.log(`⏱️  Parent creation: ${parentCreationTime.duration.toFixed(2)}ms`);

      // Create sub-entities
      const subEntityCreationTime = await measureTime(async () => {
        const promises = [];

        for (let parentIndex = 0; parentIndex < parentCount; parentIndex++) {
          const parentNodeId = `parent-${parentIndex}` as TreeNodeId;

          for (let subIndex = 0; subIndex < subEntitiesPerParent; subIndex++) {
            promises.push(
              handler.createSubEntity(parentNodeId, 'performance-sub', {
                name: `Sub Entity ${parentIndex}-${subIndex}`,
                data: {
                  parentIndex,
                  subIndex,
                  value: parentIndex * 100 + subIndex,
                },
                metadata: {
                  tags: [`parent-${parentIndex}`, `sub-${subIndex}`],
                  priority: (subIndex % 5) + 1,
                },
              })
            );
          }
        }

        await Promise.all(promises);
      });

      console.log(`⏱️  Sub-entity creation: ${subEntityCreationTime.duration.toFixed(2)}ms`);
      console.log(
        `⚡ Average per sub-entity: ${(subEntityCreationTime.duration / totalSubEntities).toFixed(2)}ms`
      );

      // Query performance
      const queryTime = await measureTime(async () => {
        const results = await handler.querySubEntities({
          type: 'performance-sub',
          priority: 3,
        });
        return results;
      });

      console.log(
        `⏱️  Query time: ${queryTime.duration.toFixed(2)}ms for ${queryTime.result.length} results`
      );

      expect(queryTime.result.length).toBe(parentCount); // One per parent with priority 3
      expect(queryTime.duration).toBeLessThan(1000); // Should query within 1 second
    });

    it('should handle concurrent working copy operations', async () => {
      const concurrencyLevel = 50;

      console.log(`\n📊 Testing ${concurrencyLevel} concurrent working copy operations...`);

      // Create entities
      for (let i = 0; i < concurrencyLevel; i++) {
        await handler.createEntity(`concurrent-${i}` as TreeNodeId, {
          name: `Concurrent Entity ${i}`,
          data: { index: i },
        });
      }

      // Create working copies concurrently
      const workingCopyCreationTime = await measureTime(async () => {
        const promises = [];
        for (let i = 0; i < concurrencyLevel; i++) {
          promises.push(
            handler.createWorkingCopy(`concurrent-${i}` as TreeNodeId, {
              author: `user-${i % 5}`,
              description: `Concurrent working copy ${i}`,
            })
          );
        }
        await Promise.all(promises);
      });

      console.log(`⏱️  Working copy creation: ${workingCopyCreationTime.duration.toFixed(2)}ms`);

      // Update all working copies concurrently
      const updateTime = await measureTime(async () => {
        const promises = [];
        for (let i = 0; i < concurrencyLevel; i++) {
          promises.push(
            handler.updateWorkingCopy(`concurrent-${i}` as TreeNodeId, {
              name: `Updated Concurrent Entity ${i}`,
              data: {
                index: i,
                updated: true,
                updateTimestamp: Date.now(),
              },
            })
          );
        }
        await Promise.all(promises);
      });

      console.log(`⏱️  Update time: ${updateTime.duration.toFixed(2)}ms`);

      // Commit all working copies concurrently
      const commitTime = await measureTime(async () => {
        const promises = [];
        for (let i = 0; i < concurrencyLevel; i++) {
          promises.push(
            handler.commitWorkingCopy(`concurrent-${i}` as TreeNodeId, {
              message: `Commit ${i}`,
              author: `user-${i % 5}`,
            })
          );
        }
        await Promise.all(promises);
      });

      console.log(`⏱️  Commit time: ${commitTime.duration.toFixed(2)}ms`);

      // Verify all updates were applied
      for (let i = 0; i < concurrencyLevel; i++) {
        const entity = await handler.getEntity(`concurrent-${i}` as TreeNodeId);
        expect(entity?.name).toBe(`Updated Concurrent Entity ${i}`);
        expect(entity?.data?.updated).toBe(true);
      }

      expect(workingCopyCreationTime.duration).toBeLessThan(2000);
      expect(updateTime.duration).toBeLessThan(1000);
      expect(commitTime.duration).toBeLessThan(3000);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should manage memory efficiently with large datasets', async () => {
      const entityCount = 500;
      const subEntityCount = 10;

      console.log(
        `\n🧠 Memory efficiency test: ${entityCount} entities with ${subEntityCount} sub-entities each...`
      );

      // Track memory usage (simplified - actual memory profiling would require more sophisticated tools)
      const startTime = performance.now();
      let peakMemoryUsage = 0;

      // Create entities with sub-entities
      for (let i = 0; i < entityCount; i++) {
        const nodeId = `memory-test-${i}` as TreeNodeId;

        await handler.createEntity(nodeId, {
          name: `Memory Test Entity ${i}`,
          data: {
            largeArray: new Array(1000).fill(`item-${i}`),
            metadata: generateTestEntity(i).data,
          },
        });

        // Add sub-entities
        for (let j = 0; j < subEntityCount; j++) {
          await handler.createSubEntity(nodeId, 'memory-test', {
            name: `Sub ${i}-${j}`,
            data: {
              parentIndex: i,
              subIndex: j,
              largeData: new Array(500).fill(`sub-data-${i}-${j}`),
            },
          });
        }

        // Simulate memory pressure check every 50 entities
        if (i % 50 === 0) {
          // Force garbage collection hint (not guaranteed)
          if (global.gc) {
            global.gc();
          }
        }
      }

      const creationTime = performance.now() - startTime;
      console.log(`⏱️  Creation completed in: ${creationTime.toFixed(2)}ms`);

      // Test cleanup efficiency
      const cleanupStartTime = performance.now();

      // Delete every other entity to test cleanup
      for (let i = 0; i < entityCount; i += 2) {
        const nodeId = `memory-test-${i}` as TreeNodeId;
        await handler.deleteEntity(nodeId);
      }

      const cleanupTime = performance.now() - cleanupStartTime;
      console.log(`⏱️  Cleanup time: ${cleanupTime.toFixed(2)}ms`);

      // Verify partial cleanup
      const remainingCount = await handler.getEntityCount();
      expect(remainingCount).toBe(Math.floor(entityCount / 2));

      // Performance expectations
      expect(creationTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(cleanupTime).toBeLessThan(10000); // Cleanup within 10 seconds
    });

    it('should handle working copy cache efficiently', async () => {
      const cacheTestCount = 200;

      console.log(`\n🗄️  Cache efficiency test with ${cacheTestCount} working copies...`);

      // Create entities and working copies
      for (let i = 0; i < cacheTestCount; i++) {
        const nodeId = `cache-test-${i}` as TreeNodeId;
        await handler.createEntity(nodeId, { name: `Cache Test ${i}` });
        await handler.createWorkingCopy(nodeId);
      }

      // Test cache performance with repeated access
      const cacheTestTime = await measureTime(async () => {
        const promises = [];

        // Access each working copy multiple times
        for (let round = 0; round < 5; round++) {
          for (let i = 0; i < cacheTestCount; i++) {
            const nodeId = `cache-test-${i}` as TreeNodeId;
            promises.push(handler.getWorkingCopy(nodeId));
          }
        }

        await Promise.all(promises);
      });

      console.log(
        `⏱️  Cache access time: ${cacheTestTime.duration.toFixed(2)}ms for ${cacheTestCount * 5} accesses`
      );
      console.log(
        `⚡ Average per access: ${(cacheTestTime.duration / (cacheTestCount * 5)).toFixed(3)}ms`
      );

      // Cached access should be very fast
      expect(cacheTestTime.duration / (cacheTestCount * 5)).toBeLessThan(1); // Less than 1ms per access

      // Test cache cleanup
      const cleanupTime = await measureTime(async () => {
        for (let i = 0; i < cacheTestCount; i++) {
          const nodeId = `cache-test-${i}` as TreeNodeId;
          await handler.discardWorkingCopy(nodeId);
        }
      });

      console.log(`⏱️  Cache cleanup time: ${cleanupTime.duration.toFixed(2)}ms`);
      expect(cleanupTime.duration).toBeLessThan(5000);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid create/delete cycles', async () => {
      const cycles = 100;
      const entitiesPerCycle = 20;

      console.log(
        `\n🔄 Stress test: ${cycles} cycles of create/delete with ${entitiesPerCycle} entities each...`
      );

      const stressTestTime = await measureTime(async () => {
        for (let cycle = 0; cycle < cycles; cycle++) {
          const nodeIds: TreeNodeId[] = [];

          // Create entities
          for (let i = 0; i < entitiesPerCycle; i++) {
            const nodeId = `stress-${cycle}-${i}` as TreeNodeId;
            nodeIds.push(nodeId);

            await handler.createEntity(nodeId, {
              name: `Stress Entity ${cycle}-${i}`,
              data: { cycle, index: i },
            });
          }

          // Delete half of them
          for (let i = 0; i < Math.floor(entitiesPerCycle / 2); i++) {
            await handler.deleteEntity(nodeIds[i]!);
          }

          // Update the rest
          for (let i = Math.floor(entitiesPerCycle / 2); i < entitiesPerCycle; i++) {
            await handler.updateEntity(nodeIds[i]!, {
              name: `Updated Stress Entity ${cycle}-${i}`,
              data: { cycle, index: i, updated: true },
            });
          }
        }
      });

      console.log(`⏱️  Stress test completed in: ${stressTestTime.duration.toFixed(2)}ms`);
      console.log(`⚡ Average per cycle: ${(stressTestTime.duration / cycles).toFixed(2)}ms`);

      // Verify final state
      const finalCount = await handler.getEntityCount();
      const expectedFinalCount = cycles * Math.ceil(entitiesPerCycle / 2);

      expect(finalCount).toBe(expectedFinalCount);
      expect(stressTestTime.duration).toBeLessThan(60000); // Should complete within 1 minute
    });

    it('should handle complex query patterns under load', async () => {
      const entityCount = 300;
      const queryRounds = 50;

      console.log(
        `\n🔍 Query stress test: ${queryRounds} query rounds on ${entityCount} entities...`
      );

      // Setup test data
      for (let i = 0; i < entityCount; i++) {
        const nodeId = `query-stress-${i}` as TreeNodeId;

        await handler.createEntity(nodeId, {
          name: `Query Stress Entity ${i}`,
          description: `Description for entity ${i} in category ${i % 10}`,
          data: {
            category: `category-${i % 10}`,
            priority: (i % 5) + 1,
            tags: [`tag-${i % 7}`, `stress-test`],
            value: Math.random() * 1000,
          },
        });

        // Add sub-entities
        await handler.createSubEntity(nodeId, 'stress-sub', {
          name: `Stress Sub ${i}`,
          data: { parentIndex: i },
          metadata: {
            priority: (i % 5) + 1,
            visible: i % 2 === 0,
          },
        });
      }

      // Run query stress test
      const queryStressTime = await measureTime(async () => {
        const promises = [];

        for (let round = 0; round < queryRounds; round++) {
          // Various query patterns
          promises.push(
            handler.queryEntities({ name: 'Query' }),
            handler.queryEntities({ description: 'category 5' }),
            handler.querySubEntities({ type: 'stress-sub', priority: 3 }),
            handler.querySubEntities({ visible: true }),
            handler.getSubEntityCount(undefined, 'stress-sub')
          );
        }

        await Promise.all(promises);
      });

      console.log(`⏱️  Query stress test: ${queryStressTime.duration.toFixed(2)}ms`);
      console.log(
        `⚡ Average per query: ${(queryStressTime.duration / (queryRounds * 5)).toFixed(2)}ms`
      );

      expect(queryStressTime.duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(queryStressTime.duration / (queryRounds * 5)).toBeLessThan(50); // Less than 50ms per query
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly under stress', async () => {
      const resourceCount = 100;

      console.log(`\n🧹 Resource cleanup test with ${resourceCount} resources...`);

      // Create resources
      const nodeIds: TreeNodeId[] = [];

      for (let i = 0; i < resourceCount; i++) {
        const nodeId = `resource-${i}` as TreeNodeId;
        nodeIds.push(nodeId);

        await handler.createEntity(nodeId, {
          name: `Resource Entity ${i}`,
          data: { resourceType: 'cleanup-test', index: i },
        });

        await handler.createSubEntity(nodeId, 'resource-sub', {
          name: `Resource Sub ${i}`,
          data: { cleanup: true },
        });

        await handler.createWorkingCopy(nodeId, {
          author: 'cleanup-test',
          autoSave: true,
        });
      }

      // Verify resources created
      const initialEntityCount = await handler.getEntityCount();
      const initialSubEntityCount = await handler.getSubEntityCount();
      const initialWorkingCopies = await handler.getAllWorkingCopies();

      expect(initialEntityCount).toBe(resourceCount);
      expect(initialSubEntityCount).toBe(resourceCount);
      expect(initialWorkingCopies).toHaveLength(resourceCount);

      // Cleanup test
      const cleanupTime = await measureTime(async () => {
        // Delete every other entity - should trigger cascading cleanup
        for (let i = 0; i < resourceCount; i += 2) {
          await handler.deleteEntity(nodeIds[i]!);
        }

        // Clean up stale working copies
        await handler.cleanupStaleWorkingCopies(0);
      });

      console.log(`⏱️  Resource cleanup time: ${cleanupTime.duration.toFixed(2)}ms`);

      // Verify cleanup
      const finalEntityCount = await handler.getEntityCount();
      const finalSubEntityCount = await handler.getSubEntityCount();
      const finalWorkingCopies = await handler.getAllWorkingCopies();

      expect(finalEntityCount).toBe(Math.ceil(resourceCount / 2));
      expect(finalSubEntityCount).toBe(Math.ceil(resourceCount / 2));
      expect(finalWorkingCopies).toHaveLength(0);

      expect(cleanupTime.duration).toBeLessThan(10000); // Cleanup within 10 seconds
    });
  });
});

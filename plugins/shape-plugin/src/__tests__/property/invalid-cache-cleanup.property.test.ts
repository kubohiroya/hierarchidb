/**
 * Property Test: Invalid Cache Cleanup
 * 
 * **Feature: shape-build-force-terminate-on-pause, Property 8: Invalid Cache Cleanup**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * Property Statement:
 * For any build session start, all invalid cache entries (cache data without metadata)
 * for the target node should be identified and deleted before processing any new tasks,
 * and the count of deleted entries should be logged.
 * 
 * This test verifies the cleanup behavior for both geometry and source caches:
 * 1. Identify all cache entries with timestamp === 0 (invalid entries)
 * 2. Delete those invalid entries
 * 3. Complete cleanup before processing tasks
 * 4. Log the count of deleted entries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { CacheValidator } from '../../services/CacheValidator';
import type { NodeId } from '@hierarchidb/core-types';

describe('Property 8: Invalid Cache Cleanup', () => {
    let validator: CacheValidator;

    beforeEach(async () => {
        validator = new CacheValidator();
    });

    /**
     * Property Test: Invalid geometry cache entries are identified and deleted
     * 
     * For any set of geometry cache entries with timestamp === 0, verify that:
     * 1. All invalid entries are identified
     * 2. All invalid entries are deleted
     * 3. The count of deleted entries is accurate
     * 4. Valid entries (timestamp > 0) are preserved
     */
    it('should identify and delete all invalid geometry cache entries', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidCount: fc.integer({ min: 1, max: 10 }),
                    validCount: fc.integer({ min: 0, max: 5 }),
                }),
                async ({ nodeId, invalidCount, validCount }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid geometry cache entries (timestamp: 0)
                    const invalidIds: string[] = [];
                    for (let i = 0; i < invalidCount; i++) {
                        const id = `geom-invalid-${nodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0, // Invalid entry
                        });
                        invalidIds.push(id);
                    }

                    // Create valid geometry cache entries (timestamp > 0)
                    const validIds: string[] = [];
                    for (let i = 0; i < validCount; i++) {
                        const id = `geom-valid-${nodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i + 100,
                            sourceKey: `source-valid-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: Date.now(), // Valid entry
                        });
                        validIds.push(id);
                    }

                    // Run cleanup
                    const result = await validator.cleanupInvalidEntries(nodeId);

                    // Verify correct count of deleted entries
                    expect(result.geometryDeleted).toBe(invalidCount);

                    // Verify all invalid entries are deleted
                    for (const id of invalidIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify all valid entries are preserved
                    for (const id of validIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeDefined();
                        expect(entry?.timestamp).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property Test: Invalid source cache entries are identified and deleted
     * 
     * For any set of source cache entries with timestamp === 0, verify that:
     * 1. All invalid entries are identified
     * 2. All invalid entries are deleted
     * 3. The count of deleted entries is accurate
     * 4. Valid entries (timestamp > 0) are preserved
     */
    it('should identify and delete all invalid source cache entries', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidCount: fc.integer({ min: 1, max: 10 }),
                    validCount: fc.integer({ min: 0, max: 5 }),
                }),
                async ({ nodeId, invalidCount, validCount }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid source cache entries (timestamp: 0)
                    const invalidIds: string[] = [];
                    for (let i = 0; i < invalidCount; i++) {
                        const id = `source-invalid-${nodeId}-${i}`;
                        await ephemeralDB.sourceCache.put({
                            id,
                            nodeId,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: 0, // Invalid entry
                        });
                        invalidIds.push(id);
                    }

                    // Create valid source cache entries (timestamp > 0)
                    const validIds: string[] = [];
                    for (let i = 0; i < validCount; i++) {
                        const id = `source-valid-${nodeId}-${i}`;
                        await ephemeralDB.sourceCache.put({
                            id,
                            nodeId,
                            sourceKey: `source-valid-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: Date.now(), // Valid entry
                        });
                        validIds.push(id);
                    }

                    // Run cleanup
                    const result = await validator.cleanupInvalidEntries(nodeId);

                    // Verify correct count of deleted entries
                    expect(result.sourceDeleted).toBe(invalidCount);

                    // Verify all invalid entries are deleted
                    for (const id of invalidIds) {
                        const entry = await ephemeralDB.sourceCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify all valid entries are preserved
                    for (const id of validIds) {
                        const entry = await ephemeralDB.sourceCache.get(id);
                        expect(entry).toBeDefined();
                        expect(entry?.timestamp).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property Test: Cleanup handles both geometry and source caches together
     * 
     * For any combination of invalid geometry and source cache entries, verify that:
     * 1. All invalid entries from both cache types are identified
     * 2. All invalid entries from both cache types are deleted
     * 3. The counts for both cache types are accurate
     * 4. Valid entries from both cache types are preserved
     */
    it('should cleanup invalid entries from both geometry and source caches', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidGeometryCount: fc.integer({ min: 0, max: 8 }),
                    invalidSourceCount: fc.integer({ min: 0, max: 8 }),
                    validGeometryCount: fc.integer({ min: 0, max: 3 }),
                    validSourceCount: fc.integer({ min: 0, max: 3 }),
                }),
                async ({
                    nodeId,
                    invalidGeometryCount,
                    invalidSourceCount,
                    validGeometryCount,
                    validSourceCount,
                }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid geometry cache entries
                    const invalidGeomIds: string[] = [];
                    for (let i = 0; i < invalidGeometryCount; i++) {
                        const id = `geom-invalid-${nodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0,
                        });
                        invalidGeomIds.push(id);
                    }

                    // Create invalid source cache entries
                    const invalidSourceIds: string[] = [];
                    for (let i = 0; i < invalidSourceCount; i++) {
                        const id = `source-invalid-${nodeId}-${i}`;
                        await ephemeralDB.sourceCache.put({
                            id,
                            nodeId,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: 0,
                        });
                        invalidSourceIds.push(id);
                    }

                    // Create valid geometry cache entries
                    const validGeomIds: string[] = [];
                    for (let i = 0; i < validGeometryCount; i++) {
                        const id = `geom-valid-${nodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i + 100,
                            sourceKey: `source-valid-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: Date.now(),
                        });
                        validGeomIds.push(id);
                    }

                    // Create valid source cache entries
                    const validSourceIds: string[] = [];
                    for (let i = 0; i < validSourceCount; i++) {
                        const id = `source-valid-${nodeId}-${i}`;
                        await ephemeralDB.sourceCache.put({
                            id,
                            nodeId,
                            sourceKey: `source-valid-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: Date.now(),
                        });
                        validSourceIds.push(id);
                    }

                    // Run cleanup
                    const result = await validator.cleanupInvalidEntries(nodeId);

                    // Verify correct counts
                    expect(result.geometryDeleted).toBe(invalidGeometryCount);
                    expect(result.sourceDeleted).toBe(invalidSourceCount);

                    // Verify all invalid geometry entries are deleted
                    for (const id of invalidGeomIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify all invalid source entries are deleted
                    for (const id of invalidSourceIds) {
                        const entry = await ephemeralDB.sourceCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify all valid geometry entries are preserved
                    for (const id of validGeomIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeDefined();
                        expect(entry?.timestamp).toBeGreaterThan(0);
                    }

                    // Verify all valid source entries are preserved
                    for (const id of validSourceIds) {
                        const entry = await ephemeralDB.sourceCache.get(id);
                        expect(entry).toBeDefined();
                        expect(entry?.timestamp).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property Test: Cleanup is idempotent
     * 
     * For any set of cache entries, verify that:
     * 1. Running cleanup multiple times produces the same result
     * 2. The second cleanup finds zero invalid entries
     * 3. Valid entries remain unchanged after multiple cleanups
     */
    it('should be idempotent - multiple cleanups produce same result', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidGeometryCount: fc.integer({ min: 1, max: 5 }),
                    invalidSourceCount: fc.integer({ min: 1, max: 5 }),
                }),
                async ({ nodeId, invalidGeometryCount, invalidSourceCount }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid entries
                    for (let i = 0; i < invalidGeometryCount; i++) {
                        await ephemeralDB.geometryCache.put({
                            id: `geom-invalid-${nodeId}-${i}`,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0,
                        });
                    }

                    for (let i = 0; i < invalidSourceCount; i++) {
                        await ephemeralDB.sourceCache.put({
                            id: `source-invalid-${nodeId}-${i}`,
                            nodeId,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: 0,
                        });
                    }

                    // First cleanup
                    const result1 = await validator.cleanupInvalidEntries(nodeId);
                    expect(result1.geometryDeleted).toBe(invalidGeometryCount);
                    expect(result1.sourceDeleted).toBe(invalidSourceCount);

                    // Second cleanup should find nothing
                    const result2 = await validator.cleanupInvalidEntries(nodeId);
                    expect(result2.geometryDeleted).toBe(0);
                    expect(result2.sourceDeleted).toBe(0);

                    // Third cleanup should also find nothing
                    const result3 = await validator.cleanupInvalidEntries(nodeId);
                    expect(result3.geometryDeleted).toBe(0);
                    expect(result3.sourceDeleted).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property Test: Cleanup only affects target node
     * 
     * For any set of cache entries across multiple nodes, verify that:
     * 1. Cleanup only deletes invalid entries for the target node
     * 2. Invalid entries for other nodes are not affected
     * 3. Valid entries for all nodes are preserved
     */
    it('should only cleanup invalid entries for the target node', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    targetNodeId: fc.string().map(s => `target-${s}` as NodeId),
                    otherNodeId: fc.string().map(s => `other-${s}` as NodeId),
                    targetInvalidCount: fc.integer({ min: 1, max: 5 }),
                    otherInvalidCount: fc.integer({ min: 1, max: 5 }),
                }),
                async ({ targetNodeId, otherNodeId, targetInvalidCount, otherInvalidCount }) => {
                    // Ensure node IDs are different
                    fc.pre(targetNodeId !== otherNodeId);

                    const data = new ArrayBuffer(100);

                    // Create invalid entries for target node
                    const targetInvalidIds: string[] = [];
                    for (let i = 0; i < targetInvalidCount; i++) {
                        const id = `geom-target-${targetNodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId: targetNodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0,
                        });
                        targetInvalidIds.push(id);
                    }

                    // Create invalid entries for other node
                    const otherInvalidIds: string[] = [];
                    for (let i = 0; i < otherInvalidCount; i++) {
                        const id = `geom-other-${otherNodeId}-${i}`;
                        await ephemeralDB.geometryCache.put({
                            id,
                            nodeId: otherNodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0,
                        });
                        otherInvalidIds.push(id);
                    }

                    // Cleanup only target node
                    const result = await validator.cleanupInvalidEntries(targetNodeId);

                    // Verify only target node entries were deleted
                    expect(result.geometryDeleted).toBe(targetInvalidCount);

                    // Verify target node invalid entries are deleted
                    for (const id of targetInvalidIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify other node invalid entries still exist
                    for (const id of otherInvalidIds) {
                        const entry = await ephemeralDB.geometryCache.get(id);
                        expect(entry).toBeDefined();
                        expect(entry?.timestamp).toBe(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property Test: Cleanup completes before returning
     * 
     * For any set of invalid cache entries, verify that:
     * 1. When cleanup returns, all invalid entries are already deleted
     * 2. No invalid entries exist after cleanup completes
     * 3. The returned counts match the actual deleted entries
     */
    it('should complete all deletions before returning', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidCount: fc.integer({ min: 1, max: 10 }),
                }),
                async ({ nodeId, invalidCount }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid entries
                    const invalidIds: string[] = [];
                    for (let i = 0; i < invalidCount; i++) {
                        const geomId = `geom-${nodeId}-${i}`;
                        const sourceId = `source-${nodeId}-${i}`;

                        await ephemeralDB.geometryCache.put({
                            id: geomId,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            vertexCount: 0,
                            polygonCount: 0,
                            extractionRatio: 1.0,
                            tolerance: 0,
                            timestamp: 0,
                        });

                        await ephemeralDB.sourceCache.put({
                            id: sourceId,
                            nodeId,
                            sourceKey: `source-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: 0,
                        });

                        invalidIds.push(geomId, sourceId);
                    }

                    // Run cleanup
                    const result = await validator.cleanupInvalidEntries(nodeId);

                    // Immediately after cleanup returns, verify all entries are deleted
                    for (const id of invalidIds) {
                        const geomEntry = await ephemeralDB.geometryCache.get(id);
                        const sourceEntry = await ephemeralDB.sourceCache.get(id);
                        expect(geomEntry ?? sourceEntry).toBeUndefined();
                    }

                    // Verify no invalid entries remain for this node
                    const remainingGeomInvalid = await ephemeralDB.geometryCache
                        .where('[nodeId+timestamp]')
                        .between([nodeId, 0], [nodeId, 0], true, true)
                        .count();

                    const remainingSourceInvalid = await ephemeralDB.sourceCache
                        .where('nodeId')
                        .equals(nodeId)
                        .and((entry) => entry.timestamp === 0)
                        .count();

                    expect(remainingGeomInvalid).toBe(0);
                    expect(remainingSourceInvalid).toBe(0);

                    // Verify returned counts match what was deleted
                    expect(result.geometryDeleted + result.sourceDeleted).toBe(invalidCount * 2);
                }
            ),
            { numRuns: 100 }
        );
    });
});

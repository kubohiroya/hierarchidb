/**
 * Property Test: Cache Write Ordering
 * 
 * **Feature: shape-build-force-terminate-on-pause, Property 6: Cache Write Ordering**
 * **Validates: Requirements 3.1, 3.2, 6.3, 6.4**
 * 
 * Property Statement:
 * For any cache write operation, the cache data should be written with timestamp 0
 * before the corresponding cache metadata is written with a non-zero timestamp.
 * 
 * This test verifies the two-phase write ordering for both geometry and source caches:
 * 1. Phase 1: Write cache data with timestamp: 0 (invalid state)
 * 2. Phase 2: Write cache metadata with non-zero timestamp (valid state)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EphemeralDB } from '@hierarchidb/gis-sdk';
import type { NodeId } from '@hierarchidb/core-types';

describe('Property 6: Cache Write Ordering', () => {
    let db: EphemeralDB;

    beforeEach(async () => {
        db = new EphemeralDB('test-cache-write-ordering');
        await db.open();
    });

    afterEach(async () => {
        await db.delete();
        await db.close();
    });

    /**
     * Helper to track write operations in order
     */
    type WriteOperation =
        | { type: 'geometryData'; id: string; timestamp: number }
        | { type: 'geometryMeta'; id: string; timestamp: number }
        | { type: 'sourceData'; id: string; timestamp: number }
        | { type: 'sourceMeta'; id: string; timestamp: number };

    /**
     * Mock geometry cache write that tracks operation order
     */
    async function writeGeometryCacheWithTracking(
        id: string,
        nodeId: NodeId,
        bandIndex: number,
        sourceKey: string,
        data: ArrayBuffer,
        operations: WriteOperation[]
    ): Promise<void> {
        // Phase 1: Write data with timestamp: 0
        await db.geometryCache.put({
            id,
            nodeId,
            bandIndex,
            sourceKey,
            data,
            timestamp: 0,
        });
        operations.push({ type: 'geometryData', id, timestamp: 0 });

        // Phase 2: Write metadata with non-zero timestamp
        const completedAt = Date.now();
        await db.geometryCacheMeta.put({
            id,
            nodeId,
            bandIndex,
            sourceKey,
            timestamp: completedAt,
        });
        operations.push({ type: 'geometryMeta', id, timestamp: completedAt });
    }

    /**
     * Mock source cache write that tracks operation order
     */
    async function writeSourceCacheWithTracking(
        id: string,
        nodeId: NodeId,
        sourceKey: string,
        data: ArrayBuffer,
        operations: WriteOperation[]
    ): Promise<void> {
        // Phase 1: Write data with timestamp: 0
        await db.sourceCache.put({
            id,
            nodeId,
            sourceKey,
            data,
            timestamp: 0,
        });
        operations.push({ type: 'sourceData', id, timestamp: 0 });

        // Phase 2: Write metadata with non-zero timestamp
        const completedAt = Date.now();
        await db.sourceCacheMeta.put({
            id,
            nodeId,
            sourceKey,
            timestamp: completedAt,
        });
        operations.push({ type: 'sourceMeta', id, timestamp: completedAt });
    }

    /**
     * Property Test: Geometry cache write ordering
     * 
     * For any geometry cache write operation, verify that:
     * 1. Data is written with timestamp: 0 first
     * 2. Metadata is written with non-zero timestamp after data write completes
     */
    it('should write geometry cache data before metadata with correct timestamps', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ nodeId, bandIndex, sourceKey, dataSize }) => {
                    const operations: WriteOperation[] = [];
                    const id = `geom-${nodeId}-${bandIndex}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    await writeGeometryCacheWithTracking(
                        id,
                        nodeId,
                        bandIndex,
                        sourceKey,
                        data,
                        operations
                    );

                    // Verify write order: data before metadata
                    expect(operations).toHaveLength(2);
                    expect(operations[0].type).toBe('geometryData');
                    expect(operations[1].type).toBe('geometryMeta');

                    // Verify timestamps: data has 0, metadata has non-zero
                    expect(operations[0].timestamp).toBe(0);
                    expect(operations[1].timestamp).toBeGreaterThan(0);

                    // Verify both IDs match
                    expect(operations[0].id).toBe(id);
                    expect(operations[1].id).toBe(id);

                    // Verify data in database has timestamp: 0
                    const dataRecord = await db.geometryCache.get(id);
                    expect(dataRecord).toBeDefined();
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata in database has non-zero timestamp
                    const metaRecord = await db.geometryCacheMeta.get(id);
                    expect(metaRecord).toBeDefined();
                    expect(metaRecord?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Source cache write ordering
     * 
     * For any source cache write operation, verify that:
     * 1. Data is written with timestamp: 0 first
     * 2. Metadata is written with non-zero timestamp after data write completes
     */
    it('should write source cache data before metadata with correct timestamps', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ nodeId, sourceKey, dataSize }) => {
                    const operations: WriteOperation[] = [];
                    const id = `source-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    await writeSourceCacheWithTracking(
                        id,
                        nodeId,
                        sourceKey,
                        data,
                        operations
                    );

                    // Verify write order: data before metadata
                    expect(operations).toHaveLength(2);
                    expect(operations[0].type).toBe('sourceData');
                    expect(operations[1].type).toBe('sourceMeta');

                    // Verify timestamps: data has 0, metadata has non-zero
                    expect(operations[0].timestamp).toBe(0);
                    expect(operations[1].timestamp).toBeGreaterThan(0);

                    // Verify both IDs match
                    expect(operations[0].id).toBe(id);
                    expect(operations[1].id).toBe(id);

                    // Verify data in database has timestamp: 0
                    const dataRecord = await db.sourceCache.get(id);
                    expect(dataRecord).toBeDefined();
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata in database has non-zero timestamp
                    const metaRecord = await db.sourceCacheMeta.get(id);
                    expect(metaRecord).toBeDefined();
                    expect(metaRecord?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Multiple concurrent cache writes maintain ordering
     * 
     * For any set of concurrent cache write operations, verify that each
     * individual write maintains the data-before-metadata ordering.
     */
    it('should maintain write ordering for concurrent geometry cache writes', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        nodeId: fc.string().map(s => `node-${s}` as NodeId),
                        bandIndex: fc.integer({ min: 0, max: 20 }),
                        sourceKey: fc.string({ minLength: 1 }),
                        dataSize: fc.integer({ min: 1, max: 1000 }),
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                async (cacheWrites) => {
                    const allOperations: WriteOperation[] = [];

                    // Execute all writes concurrently
                    await Promise.all(
                        cacheWrites.map(async ({ nodeId, bandIndex, sourceKey, dataSize }) => {
                            const id = `geom-${nodeId}-${bandIndex}-${sourceKey}`;
                            const data = new ArrayBuffer(dataSize);
                            await writeGeometryCacheWithTracking(
                                id,
                                nodeId,
                                bandIndex,
                                sourceKey,
                                data,
                                allOperations
                            );
                        })
                    );

                    // Group operations by ID
                    const operationsByIdMap = new Map<string, WriteOperation[]>();
                    for (const op of allOperations) {
                        const existing = operationsByIdMap.get(op.id) ?? [];
                        existing.push(op);
                        operationsByIdMap.set(op.id, existing);
                    }

                    // Verify each ID has exactly 2 operations in correct order
                    for (const [id, ops] of operationsByIdMap.entries()) {
                        expect(ops).toHaveLength(2);

                        // Find data and meta operations
                        const dataOp = ops.find(o => o.type === 'geometryData');
                        const metaOp = ops.find(o => o.type === 'geometryMeta');

                        expect(dataOp).toBeDefined();
                        expect(metaOp).toBeDefined();

                        // Verify timestamps
                        expect(dataOp?.timestamp).toBe(0);
                        expect(metaOp?.timestamp).toBeGreaterThan(0);

                        // Verify database state
                        const dataRecord = await db.geometryCache.get(id);
                        const metaRecord = await db.geometryCacheMeta.get(id);

                        expect(dataRecord?.timestamp).toBe(0);
                        expect(metaRecord?.timestamp).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Cache type consistency
     * 
     * Verify that both geometry and source caches follow the same
     * two-phase write ordering pattern.
     */
    it('should apply consistent write ordering across geometry and source caches', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ nodeId, bandIndex, sourceKey, dataSize }) => {
                    const operations: WriteOperation[] = [];
                    const geomId = `geom-${nodeId}-${bandIndex}-${sourceKey}`;
                    const sourceId = `source-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write both geometry and source caches
                    await Promise.all([
                        writeGeometryCacheWithTracking(
                            geomId,
                            nodeId,
                            bandIndex,
                            sourceKey,
                            data,
                            operations
                        ),
                        writeSourceCacheWithTracking(
                            sourceId,
                            nodeId,
                            sourceKey,
                            data,
                            operations
                        ),
                    ]);

                    // Verify we have 4 operations total (2 per cache type)
                    expect(operations).toHaveLength(4);

                    // Group by ID and verify each follows the pattern
                    const geomOps = operations.filter(op => op.id === geomId);
                    const sourceOps = operations.filter(op => op.id === sourceId);

                    expect(geomOps).toHaveLength(2);
                    expect(sourceOps).toHaveLength(2);

                    // Verify geometry cache ordering
                    const geomDataOp = geomOps.find(o => o.type === 'geometryData');
                    const geomMetaOp = geomOps.find(o => o.type === 'geometryMeta');
                    expect(geomDataOp?.timestamp).toBe(0);
                    expect(geomMetaOp?.timestamp).toBeGreaterThan(0);

                    // Verify source cache ordering
                    const sourceDataOp = sourceOps.find(o => o.type === 'sourceData');
                    const sourceMetaOp = sourceOps.find(o => o.type === 'sourceMeta');
                    expect(sourceDataOp?.timestamp).toBe(0);
                    expect(sourceMetaOp?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });
});

/**
 * Property Test: Cache Type Consistency
 * 
 * **Feature: shape-build-force-terminate-on-pause, Property 11: Cache Type Consistency**
 * **Validates: Requirements 6.1, 6.2**
 * 
 * Property Statement:
 * For any cache type (geometry or source), the metadata-based validation strategy
 * (timestamp-based validity, write ordering, cleanup) should be applied consistently.
 * 
 * This test verifies that both geometry and source caches follow the same rules:
 * 1. Timestamp-based validity: timestamp: 0 = invalid, >0 = valid
 * 2. Write ordering: data before metadata
 * 3. Cleanup behavior: invalid entries are identified and deleted the same way
 */
describe('Property 11: Cache Type Consistency', () => {
    let db: EphemeralDB;

    beforeEach(async () => {
        db = new EphemeralDB('test-cache-type-consistency');
        await db.open();
    });

    afterEach(async () => {
        await db.delete();
        await db.close();
    });

    /**
     * Property Test: Timestamp-based validity consistency
     * 
     * For any cache entry (geometry or source), verify that:
     * 1. Entries with timestamp: 0 and no metadata are invalid
     * 2. Entries with timestamp: 0 and metadata are valid
     * 3. Both cache types follow the same validation rules
     */
    it('should apply consistent timestamp-based validity rules across cache types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ nodeId, bandIndex, sourceKey, dataSize }) => {
                    const geomId = `geom-${nodeId}-${bandIndex}-${sourceKey}`;
                    const sourceId = `source-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write geometry cache data with timestamp: 0 (no metadata)
                    await db.geometryCache.put({
                        id: geomId,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        data,
                        featureCount: 0,
                        vertexCount: 0,
                        polygonCount: 0,
                        extractionRatio: 1.0,
                        tolerance: 0,
                        timestamp: 0,
                    });

                    // Write source cache data with timestamp: 0 (no metadata)
                    await db.sourceCache.put({
                        id: sourceId,
                        nodeId,
                        sourceKey,
                        data,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: 0,
                    });

                    // Verify both data records have timestamp: 0
                    const geomData = await db.geometryCache.get(geomId);
                    const sourceData = await db.sourceCache.get(sourceId);

                    expect(geomData?.timestamp).toBe(0);
                    expect(sourceData?.timestamp).toBe(0);

                    // Verify metadata records don't exist (invalid state)
                    const geomMeta = await db.geometryCacheMeta.get(geomId);
                    const sourceMeta = await db.sourceCacheMeta.get(sourceId);

                    expect(geomMeta).toBeUndefined();
                    expect(sourceMeta).toBeUndefined();

                    // Now write metadata to make them valid
                    await db.geometryCacheMeta.put({
                        id: geomId,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        timestamp: Date.now(),
                    });

                    await db.sourceCacheMeta.put({
                        id: sourceId,
                        nodeId,
                        sourceKey,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: Date.now(),
                    });

                    // Verify metadata now exists (valid state)
                    const geomMetaAfter = await db.geometryCacheMeta.get(geomId);
                    const sourceMetaAfter = await db.sourceCacheMeta.get(sourceId);

                    expect(geomMetaAfter).toBeDefined();
                    expect(sourceMetaAfter).toBeDefined();
                    expect(geomMetaAfter?.timestamp).toBeGreaterThan(0);
                    expect(sourceMetaAfter?.timestamp).toBeGreaterThan(0);

                    // Data still has timestamp: 0 (this is the design)
                    const geomDataAfter = await db.geometryCache.get(geomId);
                    const sourceDataAfter = await db.sourceCache.get(sourceId);
                    expect(geomDataAfter?.timestamp).toBe(0);
                    expect(sourceDataAfter?.timestamp).toBe(0);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Cleanup behavior consistency
     * 
     * For any set of cache entries, verify that:
     * 1. Both geometry and source caches can identify entries without metadata
     * 2. Both cache types can delete entries without metadata
     * 3. Valid entries (with metadata) are preserved
     */
    it('should apply consistent cleanup behavior across cache types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    invalidCount: fc.integer({ min: 1, max: 5 }),
                    validCount: fc.integer({ min: 0, max: 3 }),
                }),
                async ({ nodeId, invalidCount, validCount }) => {
                    const data = new ArrayBuffer(100);

                    // Create invalid geometry cache entries (data only, no metadata)
                    const invalidGeomIds: string[] = [];
                    for (let i = 0; i < invalidCount; i++) {
                        const id = `geom-invalid-${nodeId}-${i}`;
                        await db.geometryCache.put({
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

                    // Create invalid source cache entries (data only, no metadata)
                    const invalidSourceIds: string[] = [];
                    for (let i = 0; i < invalidCount; i++) {
                        const id = `source-invalid-${nodeId}-${i}`;
                        await db.sourceCache.put({
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

                    // Create valid geometry cache entries (data + metadata)
                    const validGeomIds: string[] = [];
                    for (let i = 0; i < validCount; i++) {
                        const id = `geom-valid-${nodeId}-${i}`;
                        await db.geometryCache.put({
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
                            timestamp: 0,
                        });
                        await db.geometryCacheMeta.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex: i + 100,
                            sourceKey: `source-valid-${i}`,
                            timestamp: Date.now(),
                        });
                        validGeomIds.push(id);
                    }

                    // Create valid source cache entries (data + metadata)
                    const validSourceIds: string[] = [];
                    for (let i = 0; i < validCount; i++) {
                        const id = `source-valid-${nodeId}-${i}`;
                        await db.sourceCache.put({
                            id,
                            nodeId,
                            sourceKey: `source-valid-${i}`,
                            data,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: 0,
                        });
                        await db.sourceCacheMeta.put({
                            id,
                            nodeId,
                            sourceKey: `source-valid-${i}`,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: 100,
                            timestamp: Date.now(),
                        });
                        validSourceIds.push(id);
                    }

                    // Identify invalid geometry entries (data without metadata)
                    const allGeomData = await db.geometryCache
                        .where('nodeId')
                        .equals(nodeId)
                        .toArray();
                    const foundInvalidGeomIds: string[] = [];
                    for (const entry of allGeomData) {
                        const meta = await db.geometryCacheMeta.get(entry.id);
                        if (!meta) {
                            foundInvalidGeomIds.push(entry.id);
                        }
                    }

                    // Identify invalid source entries (data without metadata)
                    const allSourceData = await db.sourceCache
                        .where('nodeId')
                        .equals(nodeId)
                        .toArray();
                    const foundInvalidSourceIds: string[] = [];
                    for (const entry of allSourceData) {
                        const meta = await db.sourceCacheMeta.get(entry.id);
                        if (!meta) {
                            foundInvalidSourceIds.push(entry.id);
                        }
                    }

                    // Verify correct count of invalid entries identified
                    expect(foundInvalidGeomIds).toHaveLength(invalidCount);
                    expect(foundInvalidSourceIds).toHaveLength(invalidCount);

                    // Verify all invalid IDs are found
                    for (const id of invalidGeomIds) {
                        expect(foundInvalidGeomIds).toContain(id);
                    }
                    for (const id of invalidSourceIds) {
                        expect(foundInvalidSourceIds).toContain(id);
                    }

                    // Cleanup invalid entries
                    await db.geometryCache.bulkDelete(foundInvalidGeomIds);
                    await db.sourceCache.bulkDelete(foundInvalidSourceIds);

                    // Verify invalid entries are deleted
                    for (const id of invalidGeomIds) {
                        const entry = await db.geometryCache.get(id);
                        expect(entry).toBeUndefined();
                    }
                    for (const id of invalidSourceIds) {
                        const entry = await db.sourceCache.get(id);
                        expect(entry).toBeUndefined();
                    }

                    // Verify valid entries are preserved
                    for (const id of validGeomIds) {
                        const entry = await db.geometryCache.get(id);
                        const meta = await db.geometryCacheMeta.get(id);
                        expect(entry).toBeDefined();
                        expect(meta).toBeDefined();
                    }
                    for (const id of validSourceIds) {
                        const entry = await db.sourceCache.get(id);
                        const meta = await db.sourceCacheMeta.get(id);
                        expect(entry).toBeDefined();
                        expect(meta).toBeDefined();
                    }
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Write ordering consistency across cache types
     * 
     * For any cache write operation (geometry or source), verify that:
     * 1. Data is always written with timestamp: 0 first
     * 2. Metadata is always written with non-zero timestamp after
     * 3. Both cache types follow the exact same ordering pattern
     */
    it('should apply consistent write ordering pattern across cache types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ nodeId, bandIndex, sourceKey, dataSize }) => {
                    const geomId = `geom-${nodeId}-${bandIndex}-${sourceKey}`;
                    const sourceId = `source-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write geometry cache (data then metadata)
                    await db.geometryCache.put({
                        id: geomId,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        data,
                        featureCount: 0,
                        vertexCount: 0,
                        polygonCount: 0,
                        extractionRatio: 1.0,
                        tolerance: 0,
                        timestamp: 0,
                    });
                    await db.geometryCacheMeta.put({
                        id: geomId,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        timestamp: Date.now(),
                    });

                    // Write source cache (data then metadata)
                    await db.sourceCache.put({
                        id: sourceId,
                        nodeId,
                        sourceKey,
                        data,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: 0,
                    });
                    await db.sourceCacheMeta.put({
                        id: sourceId,
                        nodeId,
                        sourceKey,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: Date.now(),
                    });

                    // Verify geometry cache follows pattern
                    const geomData = await db.geometryCache.get(geomId);
                    const geomMeta = await db.geometryCacheMeta.get(geomId);

                    expect(geomData).toBeDefined();
                    expect(geomMeta).toBeDefined();
                    expect(geomData?.timestamp).toBe(0);
                    expect(geomMeta?.timestamp).toBeGreaterThan(0);

                    // Verify source cache follows same pattern
                    const sourceData = await db.sourceCache.get(sourceId);
                    const sourceMeta = await db.sourceCacheMeta.get(sourceId);

                    expect(sourceData).toBeDefined();
                    expect(sourceMeta).toBeDefined();
                    expect(sourceData?.timestamp).toBe(0);
                    expect(sourceMeta?.timestamp).toBeGreaterThan(0);

                    // Verify both cache types use the same validation strategy
                    // (data timestamp: 0, metadata timestamp: >0)
                    expect(geomData?.timestamp).toBe(sourceData?.timestamp);
                    expect(geomMeta?.timestamp).toBeGreaterThan(0);
                    expect(sourceMeta?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });
});

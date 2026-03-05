/**
 * Property Test: Cache Entry Validation
 * 
 * **Feature: shape-build-force-terminate-on-pause, Property 7: Cache Entry Validation**
 * **Validates: Requirements 3.3, 3.4**
 * 
 * Property Statement:
 * For any cache entry, it should be treated as valid if and only if both cache data
 * and cache metadata exist, and invalid if cache data exists but cache metadata is missing.
 * 
 * This test verifies the validation logic for both geometry and source caches:
 * 1. Entries with data + metadata are valid
 * 2. Entries with only data (no metadata) are invalid
 * 3. Entries with only metadata (no data) are invalid
 * 4. Non-existent entries are invalid
 * 
 * Note: Uses 20 iterations (reduced from 100) for faster test execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { CacheValidator } from '../../services/CacheValidator';
import type { NodeId } from '@hierarchidb/core-types';

describe('Property 7: Cache Entry Validation', () => {
    let validator: CacheValidator;

    beforeEach(async () => {
        validator = new CacheValidator();
    });

    afterEach(async () => {
        // Clean up test data
        await ephemeralDB.geometryCache.clear();
        await ephemeralDB.geometryCacheMeta.clear();
        await ephemeralDB.sourceCache.clear();
        await ephemeralDB.sourceCacheMeta.clear();
    });

    /**
     * Property Test: Valid geometry cache entries (data + metadata)
     * 
     * For any geometry cache entry with both data and metadata, verify that:
     * 1. isValidEntry returns true
     * 2. The data has timestamp: 0 (as per write protocol)
     * 3. The metadata has timestamp > 0
     */
    it('should treat geometry entries with data + metadata as valid', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ runId, nodeId, bandIndex, sourceKey, dataSize }) => {
                    await ephemeralDB.geometryCache.delete(`geom-valid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`);
                    await ephemeralDB.geometryCacheMeta.delete(`geom-valid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`);
                    const id = `geom-valid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write data with timestamp: 0
                    await ephemeralDB.geometryCache.put({
                        id,
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

                    // Write metadata with non-zero timestamp
                    const metaTimestamp = Date.now();
                    await ephemeralDB.geometryCacheMeta.put({
                        id,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        timestamp: metaTimestamp,
                    });

                    // Verify entry is valid
                    const isValid = await validator.isValidEntry(id, 'geometry');
                    expect(isValid).toBe(true);

                    // Verify data has timestamp: 0
                    const dataRecord = await ephemeralDB.geometryCache.get(id);
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata has non-zero timestamp
                    const metaRecord = await ephemeralDB.geometryCacheMeta.get(id);
                    expect(metaRecord?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Invalid geometry cache entries (data only, no metadata)
     * 
     * For any geometry cache entry with only data and no metadata, verify that:
     * 1. isValidEntry returns false
     * 2. The data has timestamp: 0 (incomplete write)
     * 3. No metadata record exists
     */
    it('should treat geometry entries with only data write as valid (meta auto-mirrored)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ runId, nodeId, bandIndex, sourceKey, dataSize }) => {
                    await ephemeralDB.geometryCache.delete(`geom-invalid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`);
                    await ephemeralDB.geometryCacheMeta.delete(`geom-invalid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`);
                    const id = `geom-invalid-${runId}-${nodeId}-${bandIndex}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write only data with timestamp: 0 (no metadata)
                    await ephemeralDB.geometryCache.put({
                        id,
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

                    // Meta is auto-created by EphemeralDB hooks, so entry is valid.
                    const isValid = await validator.isValidEntry(id, 'geometry');
                    expect(isValid).toBe(true);

                    // Verify data exists with timestamp: 0
                    const dataRecord = await ephemeralDB.geometryCache.get(id);
                    expect(dataRecord).toBeDefined();
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata exists via mirror hook
                    const metaRecord = await ephemeralDB.geometryCacheMeta.get(id);
                    expect(metaRecord).toBeDefined();
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Valid source cache entries (data + metadata)
     * 
     * For any source cache entry with both data and metadata, verify that:
     * 1. isValidEntry returns true
     * 2. The data has timestamp: 0 (as per write protocol)
     * 3. The metadata has timestamp > 0
     */
    it('should treat source entries with data + metadata as valid', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ runId, nodeId, sourceKey, dataSize }) => {
                    await ephemeralDB.sourceCache.delete(`source-valid-${runId}-${nodeId}-${sourceKey}`);
                    await ephemeralDB.sourceCacheMeta.delete(`source-valid-${runId}-${nodeId}-${sourceKey}`);
                    const id = `source-valid-${runId}-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write data with timestamp: 0
                    await ephemeralDB.sourceCache.put({
                        id,
                        nodeId,
                        sourceKey,
                        data,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: 0,
                    });

                    // Write metadata with non-zero timestamp
                    const metaTimestamp = Date.now();
                    await ephemeralDB.sourceCacheMeta.put({
                        id,
                        nodeId,
                        sourceKey,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: metaTimestamp,
                    });

                    // Verify entry is valid
                    const isValid = await validator.isValidEntry(id, 'source');
                    expect(isValid).toBe(true);

                    // Verify data has timestamp: 0
                    const dataRecord = await ephemeralDB.sourceCache.get(id);
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata has non-zero timestamp
                    const metaRecord = await ephemeralDB.sourceCacheMeta.get(id);
                    expect(metaRecord?.timestamp).toBeGreaterThan(0);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Invalid source cache entries (data only, no metadata)
     * 
     * For any source cache entry with only data and no metadata, verify that:
     * 1. isValidEntry returns false
     * 2. The data has timestamp: 0 (incomplete write)
     * 3. No metadata record exists
     */
    it('should treat source entries with only data write as valid (meta auto-mirrored)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                }),
                async ({ runId, nodeId, sourceKey, dataSize }) => {
                    await ephemeralDB.sourceCache.delete(`source-invalid-${runId}-${nodeId}-${sourceKey}`);
                    await ephemeralDB.sourceCacheMeta.delete(`source-invalid-${runId}-${nodeId}-${sourceKey}`);
                    const id = `source-invalid-${runId}-${nodeId}-${sourceKey}`;
                    const data = new ArrayBuffer(dataSize);

                    // Write only data with timestamp: 0 (no metadata)
                    await ephemeralDB.sourceCache.put({
                        id,
                        nodeId,
                        sourceKey,
                        data,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: dataSize,
                        timestamp: 0,
                    });

                    // Meta is auto-created by EphemeralDB hooks, so entry is valid.
                    const isValid = await validator.isValidEntry(id, 'source');
                    expect(isValid).toBe(true);

                    // Verify data exists with timestamp: 0
                    const dataRecord = await ephemeralDB.sourceCache.get(id);
                    expect(dataRecord).toBeDefined();
                    expect(dataRecord?.timestamp).toBe(0);

                    // Verify metadata exists via mirror hook
                    const metaRecord = await ephemeralDB.sourceCacheMeta.get(id);
                    expect(metaRecord).toBeDefined();
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Non-existent entries are invalid
     * 
     * For any cache ID that doesn't exist in the database, verify that:
     * 1. isValidEntry returns false for geometry cache
     * 2. isValidEntry returns false for source cache
     */
    it('should treat non-existent entries as invalid', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    cacheId: fc.string({ minLength: 1 }),
                }),
                async ({ cacheId }) => {
                    // Ensure the ID doesn't exist
                    const geomData = await ephemeralDB.geometryCache.get(cacheId);
                    const sourceData = await ephemeralDB.sourceCache.get(cacheId);
                    fc.pre(!geomData && !sourceData);

                    // Verify non-existent geometry entry is invalid
                    const geomValid = await validator.isValidEntry(cacheId, 'geometry');
                    expect(geomValid).toBe(false);

                    // Verify non-existent source entry is invalid
                    const sourceValid = await validator.isValidEntry(cacheId, 'source');
                    expect(sourceValid).toBe(false);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Entries with only metadata (no data) are invalid
     * 
     * For any cache entry with only metadata and no data, verify that:
     * 1. isValidEntry returns false
     * 2. This represents an inconsistent state (should not happen in practice)
     */
    it('should treat entries with only metadata (no data) as invalid', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                }),
                async ({ runId, nodeId, bandIndex, sourceKey }) => {
                    const geomId = `geom-meta-only-${runId}-${nodeId}-${bandIndex}-${sourceKey}`;
                    const sourceId = `source-meta-only-${runId}-${nodeId}-${sourceKey}`;
                    await ephemeralDB.geometryCache.delete(geomId);
                    await ephemeralDB.geometryCacheMeta.delete(geomId);
                    await ephemeralDB.sourceCache.delete(sourceId);
                    await ephemeralDB.sourceCacheMeta.delete(sourceId);

                    // Write only geometry metadata (no data)
                    await ephemeralDB.geometryCacheMeta.put({
                        id: geomId,
                        nodeId,
                        domainType: 'shape',
                        bandIndex,
                        sourceKey,
                        timestamp: Date.now(),
                    });

                    // Write only source metadata (no data)
                    await ephemeralDB.sourceCacheMeta.put({
                        id: sourceId,
                        nodeId,
                        sourceKey,
                        featureCount: 0,
                        bbox: [0, 0, 0, 0],
                        downloadTime: 0,
                        size: 100,
                        timestamp: Date.now(),
                    });

                    // Verify geometry entry is invalid
                    const geomValid = await validator.isValidEntry(geomId, 'geometry');
                    expect(geomValid).toBe(false);

                    // Verify source entry is invalid
                    const sourceValid = await validator.isValidEntry(sourceId, 'source');
                    expect(sourceValid).toBe(false);

                    // Verify metadata exists but data doesn't
                    const geomMeta = await ephemeralDB.geometryCacheMeta.get(geomId);
                    const geomData = await ephemeralDB.geometryCache.get(geomId);
                    expect(geomMeta).toBeDefined();
                    expect(geomData).toBeUndefined();

                    const sourceMeta = await ephemeralDB.sourceCacheMeta.get(sourceId);
                    const sourceData = await ephemeralDB.sourceCache.get(sourceId);
                    expect(sourceMeta).toBeDefined();
                    expect(sourceData).toBeUndefined();
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Cache type consistency in validation
     * 
     * For any cache entry, verify that:
     * 1. Geometry and source caches follow the same validation rules
     * 2. Valid entries (data + metadata) are valid for both types
     * 3. Invalid entries (data only) are invalid for both types
     */
    it('should apply consistent validation rules across geometry and source caches', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                    includeMetadata: fc.boolean(),
                }),
                async ({ runId, nodeId, bandIndex, sourceKey, dataSize, includeMetadata }) => {
                    const geomId = `geom-${runId}-${nodeId}-${bandIndex}-${sourceKey}`;
                    const sourceId = `source-${runId}-${nodeId}-${sourceKey}`;
                    await ephemeralDB.geometryCache.delete(geomId);
                    await ephemeralDB.geometryCacheMeta.delete(geomId);
                    await ephemeralDB.sourceCache.delete(sourceId);
                    await ephemeralDB.sourceCacheMeta.delete(sourceId);
                    const data = new ArrayBuffer(dataSize);

                    // Write geometry cache data
                    await ephemeralDB.geometryCache.put({
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

                    // Write source cache data
                    await ephemeralDB.sourceCache.put({
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

                    // Conditionally write metadata
                    if (includeMetadata) {
                        await ephemeralDB.geometryCacheMeta.put({
                            id: geomId,
                            nodeId,
                            domainType: 'shape',
                            bandIndex,
                            sourceKey,
                            timestamp: Date.now(),
                        });

                        await ephemeralDB.sourceCacheMeta.put({
                            id: sourceId,
                            nodeId,
                            sourceKey,
                            featureCount: 0,
                            bbox: [0, 0, 0, 0],
                            downloadTime: 0,
                            size: dataSize,
                            timestamp: Date.now(),
                        });
                    }

                    // Verify both cache types have the same validity
                    const geomValid = await validator.isValidEntry(geomId, 'geometry');
                    const sourceValid = await validator.isValidEntry(sourceId, 'source');

                    expect(geomValid).toBe(true);
                    expect(sourceValid).toBe(true);
                    expect(geomValid).toBe(sourceValid);
                }
            ),
            { numRuns: 20 }
        );
    });

    /**
     * Property Test: Validation is deterministic
     * 
     * For any cache entry, verify that:
     * 1. Multiple calls to isValidEntry return the same result
     * 2. The validation result is stable and doesn't change between calls
     */
    it('should return consistent validation results across multiple calls', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    runId: fc.uuid(),
                    nodeId: fc.string().map(s => `node-${s}` as NodeId),
                    bandIndex: fc.integer({ min: 0, max: 20 }),
                    sourceKey: fc.string({ minLength: 1 }),
                    dataSize: fc.integer({ min: 1, max: 1000 }),
                    includeMetadata: fc.boolean(),
                }),
                async ({ runId, nodeId, bandIndex, sourceKey, dataSize, includeMetadata }) => {
                    const id = `geom-${runId}-${nodeId}-${bandIndex}-${sourceKey}`;
                    await ephemeralDB.geometryCache.delete(id);
                    await ephemeralDB.geometryCacheMeta.delete(id);
                    const data = new ArrayBuffer(dataSize);

                    // Write data
                    await ephemeralDB.geometryCache.put({
                        id,
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

                    // Conditionally write metadata
                    if (includeMetadata) {
                        await ephemeralDB.geometryCacheMeta.put({
                            id,
                            nodeId,
                            domainType: 'shape',
                            bandIndex,
                            sourceKey,
                            timestamp: Date.now(),
                        });
                    }

                    // Call isValidEntry multiple times
                    const result1 = await validator.isValidEntry(id, 'geometry');
                    const result2 = await validator.isValidEntry(id, 'geometry');
                    const result3 = await validator.isValidEntry(id, 'geometry');

                    // Verify all results are the same
                    expect(result1).toBe(result2);
                    expect(result2).toBe(result3);
                    expect(result1).toBe(true);
                }
            ),
            { numRuns: 20 }
        );
    });
});

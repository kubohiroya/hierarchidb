import { describe, it, expect, beforeEach } from 'vitest';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { CacheValidator } from '../CacheValidator';
import type { NodeId } from '@hierarchidb/core-types';

describe('CacheValidator', () => {
    let validator: CacheValidator;
    const testNodeId: NodeId = 'test-node-123' as NodeId;

    beforeEach(async () => {
        validator = new CacheValidator();
        // Clean up any existing test data
        await ephemeralDB.clearNodeData(testNodeId);
    });

    describe('cleanupInvalidEntries', () => {
        it('should delete geometry cache entries with timestamp === 0', async () => {
            // Create invalid geometry cache entry (timestamp: 0)
            const invalidGeometryId = 'invalid-geometry-1';
            await ephemeralDB.geometryCache.put({
                id: invalidGeometryId,
                nodeId: testNodeId,
                domainType: 'shape',
                bandIndex: 0,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                vertexCount: 100,
                polygonCount: 5,
                extractionRatio: 0.5,
                tolerance: 0.001,
                timestamp: 0, // Invalid entry
            });

            // Create valid geometry cache entry (timestamp > 0)
            const validGeometryId = 'valid-geometry-1';
            await ephemeralDB.geometryCache.put({
                id: validGeometryId,
                nodeId: testNodeId,
                domainType: 'shape',
                bandIndex: 1,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                vertexCount: 100,
                polygonCount: 5,
                extractionRatio: 0.5,
                tolerance: 0.001,
                timestamp: Date.now(), // Valid entry
            });

            const result = await validator.cleanupInvalidEntries(testNodeId);

            expect(result.geometryDeleted).toBe(1);
            expect(result.sourceDeleted).toBe(0);

            // Verify invalid entry was deleted
            const invalidEntry = await ephemeralDB.geometryCache.get(invalidGeometryId);
            expect(invalidEntry).toBeUndefined();

            // Verify valid entry still exists
            const validEntry = await ephemeralDB.geometryCache.get(validGeometryId);
            expect(validEntry).toBeDefined();
            expect(validEntry?.timestamp).toBeGreaterThan(0);
        });

        it('should delete source cache entries with timestamp === 0', async () => {
            // Create invalid source cache entry (timestamp: 0)
            const invalidSourceId = 'invalid-source-1';
            await ephemeralDB.sourceCache.put({
                id: invalidSourceId,
                nodeId: testNodeId,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                bbox: [0, 0, 1, 1],
                downloadTime: 1000,
                size: 100,
                timestamp: 0, // Invalid entry
            });

            // Create valid source cache entry (timestamp > 0)
            const validSourceId = 'valid-source-1';
            await ephemeralDB.sourceCache.put({
                id: validSourceId,
                nodeId: testNodeId,
                sourceKey: 'test-source-2',
                data: new ArrayBuffer(100),
                featureCount: 10,
                bbox: [0, 0, 1, 1],
                downloadTime: 1000,
                size: 100,
                timestamp: Date.now(), // Valid entry
            });

            const result = await validator.cleanupInvalidEntries(testNodeId);

            expect(result.geometryDeleted).toBe(0);
            expect(result.sourceDeleted).toBe(1);

            // Verify invalid entry was deleted
            const invalidEntry = await ephemeralDB.sourceCache.get(invalidSourceId);
            expect(invalidEntry).toBeUndefined();

            // Verify valid entry still exists
            const validEntry = await ephemeralDB.sourceCache.get(validSourceId);
            expect(validEntry).toBeDefined();
            expect(validEntry?.timestamp).toBeGreaterThan(0);
        });

        it('should delete both geometry and source invalid entries', async () => {
            // Create invalid entries for both cache types
            await ephemeralDB.geometryCache.put({
                id: 'invalid-geometry-1',
                nodeId: testNodeId,
                domainType: 'shape',
                bandIndex: 0,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                vertexCount: 100,
                polygonCount: 5,
                extractionRatio: 0.5,
                tolerance: 0.001,
                timestamp: 0,
            });

            await ephemeralDB.sourceCache.put({
                id: 'invalid-source-1',
                nodeId: testNodeId,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                bbox: [0, 0, 1, 1],
                downloadTime: 1000,
                size: 100,
                timestamp: 0,
            });

            const result = await validator.cleanupInvalidEntries(testNodeId);

            expect(result.geometryDeleted).toBe(1);
            expect(result.sourceDeleted).toBe(1);
        });

        it('should return zero counts when no invalid entries exist', async () => {
            const result = await validator.cleanupInvalidEntries(testNodeId);

            expect(result.geometryDeleted).toBe(0);
            expect(result.sourceDeleted).toBe(0);
        });
    });

    describe('isValidEntry', () => {
        it('should return true for valid geometry cache entry', async () => {
            const cacheId = 'valid-geometry-1';
            const now = Date.now();

            // Create valid geometry cache entry with both data and metadata
            await ephemeralDB.geometryCache.put({
                id: cacheId,
                nodeId: testNodeId,
                domainType: 'shape',
                bandIndex: 0,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                vertexCount: 100,
                polygonCount: 5,
                extractionRatio: 0.5,
                tolerance: 0.001,
                timestamp: now,
            });

            // Metadata is automatically created by Dexie hooks
            const isValid = await validator.isValidEntry(cacheId, 'geometry');
            expect(isValid).toBe(true);
        });

        it('should return false for geometry cache entry with timestamp === 0', async () => {
            const cacheId = 'invalid-geometry-1';

            await ephemeralDB.geometryCache.put({
                id: cacheId,
                nodeId: testNodeId,
                domainType: 'shape',
                bandIndex: 0,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                vertexCount: 100,
                polygonCount: 5,
                extractionRatio: 0.5,
                tolerance: 0.001,
                timestamp: 0, // Invalid
            });

            const isValid = await validator.isValidEntry(cacheId, 'geometry');
            expect(isValid).toBe(false);
        });

        it('should return false for non-existent geometry cache entry', async () => {
            const isValid = await validator.isValidEntry('non-existent', 'geometry');
            expect(isValid).toBe(false);
        });

        it('should return true for valid source cache entry', async () => {
            const cacheId = 'valid-source-1';
            const now = Date.now();

            await ephemeralDB.sourceCache.put({
                id: cacheId,
                nodeId: testNodeId,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                bbox: [0, 0, 1, 1],
                downloadTime: 1000,
                size: 100,
                timestamp: now,
            });

            const isValid = await validator.isValidEntry(cacheId, 'source');
            expect(isValid).toBe(true);
        });

        it('should return false for source cache entry with timestamp === 0', async () => {
            const cacheId = 'invalid-source-1';

            await ephemeralDB.sourceCache.put({
                id: cacheId,
                nodeId: testNodeId,
                sourceKey: 'test-source',
                data: new ArrayBuffer(100),
                featureCount: 10,
                bbox: [0, 0, 1, 1],
                downloadTime: 1000,
                size: 100,
                timestamp: 0, // Invalid
            });

            const isValid = await validator.isValidEntry(cacheId, 'source');
            expect(isValid).toBe(false);
        });

        it('should return false for non-existent source cache entry', async () => {
            const isValid = await validator.isValidEntry('non-existent', 'source');
            expect(isValid).toBe(false);
        });
    });
});

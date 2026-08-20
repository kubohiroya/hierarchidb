import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { runShapeArtifactCascadeCleanup } from './vt/runShapeArtifactCascadeCleanup.ts';

/**
 * CacheValidator service for identifying and cleaning up invalid cache entries.
 * 
 * Invalid cache entries are those where:
 * - Cache data exists with timestamp === 0
 * - No corresponding metadata exists
 * 
 * This service implements the metadata-based validation strategy from
 * Requirements 4.1, 4.2, 4.3, 4.4.
 */
export class CacheValidator {
    /**
     * Find and delete invalid cache entries for a node.
     * 
     * Invalid entries are cache data records with timestamp === 0 and no matching metadata.
     * A timestamp of zero alone is the expected first phase of the cache write protocol.
     * 
     * @param nodeId - The node ID to clean up cache entries for
     * @returns Object containing counts of deleted entries by cache type
     */
    async cleanupInvalidEntries(nodeId: NodeId): Promise<{
        geometryDeleted: number;
        sourceDeleted: number;
    }> {
        const pendingGeometryEntries = await ephemeralDB.geometryCache
            .where('[nodeId+timestamp]')
            .between([nodeId, 0], [nodeId, 0], true, true)
            .toArray();
        const geometryMetadata = await ephemeralDB.geometryCacheMeta.bulkGet(
            pendingGeometryEntries.map((entry) => entry.id)
        );
        const invalidGeometryEntries = pendingGeometryEntries.filter(
            (_entry, index) => geometryMetadata[index] === undefined
        );
        const geometryDeleted = invalidGeometryEntries.length;

        const pendingSourceEntries = await ephemeralDB.sourceCache
            .where('nodeId')
            .equals(nodeId)
            .and((entry) => entry.timestamp === 0)
            .toArray();
        const sourceMetadata = await ephemeralDB.sourceCacheMeta.bulkGet(
            pendingSourceEntries.map((entry) => entry.id)
        );
        const invalidSourceEntries = pendingSourceEntries.filter(
            (_entry, index) => sourceMetadata[index] === undefined
        );
        const sourceDeleted = invalidSourceEntries.length;

        if (geometryDeleted > 0 || sourceDeleted > 0) {
            await runShapeArtifactCascadeCleanup({
                nodeId,
                target: {
                    kind: 'invalid-caches',
                    geometryCacheIds: invalidGeometryEntries.map((entry) => entry.id),
                    sourceCacheIds: invalidSourceEntries.map((entry) => entry.id),
                },
            });
        }

        const totalDeleted = geometryDeleted + sourceDeleted;
        if (totalDeleted > 0) {
            console.log(
                `[CacheValidator] Cleaned up ${totalDeleted} invalid cache entries for node ${nodeId}:`,
                { geometryDeleted, sourceDeleted }
            );
        }

        return {
            geometryDeleted,
            sourceDeleted,
        };
    }

    /**
     * Check if a cache entry is valid.
     * 
     * A cache entry is valid if:
     * - Both cache data and cache metadata exist
     * 
     * Note: Data timestamp is always 0 (as per two-phase write protocol).
     * Validity is determined by the presence of metadata, not data timestamp.
     * 
     * @param cacheId - The cache entry ID to check
     * @param cacheType - The type of cache ('geometry' or 'source')
     * @returns True if the entry is valid, false otherwise
     */
    async isValidEntry(cacheId: string, cacheType: 'geometry' | 'source'): Promise<boolean> {
        if (cacheType === 'geometry') {
            const [data, meta] = await Promise.all([
                ephemeralDB.geometryCache.get(cacheId),
                ephemeralDB.geometryCacheMeta.get(cacheId),
            ]);

            // Entry is valid only if both data and metadata exist
            return Boolean(data && meta);
        } else {
            const [data, meta] = await Promise.all([
                ephemeralDB.sourceCache.get(cacheId),
                ephemeralDB.sourceCacheMeta.get(cacheId),
            ]);

            // Entry is valid only if both data and metadata exist
            return Boolean(data && meta);
        }
    }
}

/**
 * Singleton instance of CacheValidator
 */
export const cacheValidator = new CacheValidator();

import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';

/**
 * CacheValidator service for identifying and cleaning up invalid cache entries.
 * 
 * Invalid cache entries are those where:
 * - Cache data exists with timestamp === 0
 * - No corresponding metadata exists (or metadata is incomplete)
 * 
 * This service implements the metadata-based validation strategy from
 * Requirements 4.1, 4.2, 4.3, 4.4.
 */
export class CacheValidator {
    /**
     * Find and delete invalid cache entries for a node.
     * 
     * Invalid entries are cache data records with timestamp === 0,
     * which indicates the write was interrupted before metadata could be written.
     * 
     * @param nodeId - The node ID to clean up cache entries for
     * @returns Object containing counts of deleted entries by cache type
     */
    async cleanupInvalidEntries(nodeId: NodeId): Promise<{
        geometryDeleted: number;
        sourceDeleted: number;
    }> {
        // Query and delete invalid geometry cache entries (timestamp === 0)
        const invalidGeometryEntries = await ephemeralDB.geometryCache
            .where('[nodeId+timestamp]')
            .between([nodeId, 0], [nodeId, 0], true, true)
            .toArray();

        const geometryDeleted = invalidGeometryEntries.length;

        if (geometryDeleted > 0) {
            const geometryIds = invalidGeometryEntries.map((entry) => entry.id);
            await ephemeralDB.geometryCache.bulkDelete(geometryIds);
        }

        // Query and delete invalid source cache entries (timestamp === 0)
        const invalidSourceEntries = await ephemeralDB.sourceCache
            .where('nodeId')
            .equals(nodeId)
            .and((entry) => entry.timestamp === 0)
            .toArray();

        const sourceDeleted = invalidSourceEntries.length;

        if (sourceDeleted > 0) {
            const sourceIds = invalidSourceEntries.map((entry) => entry.id);
            await ephemeralDB.sourceCache.bulkDelete(sourceIds);
        }

        // Log cleanup results
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
     * - The cache data has a non-zero timestamp
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

            // Entry is valid only if both data and metadata exist, and timestamp > 0
            return Boolean(data && meta && data.timestamp > 0);
        } else {
            const [data, meta] = await Promise.all([
                ephemeralDB.sourceCache.get(cacheId),
                ephemeralDB.sourceCacheMeta.get(cacheId),
            ]);

            // Entry is valid only if both data and metadata exist, and timestamp > 0
            return Boolean(data && meta && data.timestamp > 0);
        }
    }
}

/**
 * Singleton instance of CacheValidator
 */
export const cacheValidator = new CacheValidator();

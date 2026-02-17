/**
 * Worker API implementation tests
 */

import { describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig, ShapeProcessingConfig } from '../../../common/types/index.js';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  mergeBuildConfig,
  mergeProcessingConfig,
} from '../../../common/types/index.js';
import { shapeBatchAPI } from '../../api.js';

const createBuildConfig = (
  overrides: Partial<ShapeBuildConfig> = {},
): ShapeBuildConfig => mergeBuildConfig(DEFAULT_BUILD_CONFIG, overrides);

const createProcessingConfig = (
  overrides: Partial<ShapeProcessingConfig> = {},
): ShapeProcessingConfig => mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, overrides);

describe('Shape Plugin API', () => {
  describe('Batch Session Recovery for Direct Link Access', () => {
    it('should find pending batch sessions for node', async () => {
      const nodeId = 'node-123' as NodeId;

      const sessions = await shapeBatchAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should return empty array for node without pending sessions', async () => {
      const nodeId = 'node-no-sessions' as NodeId;

      const sessions = await shapeBatchAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });

    it('should return missing session status for unknown session', async () => {
      const status = await shapeBatchAPI.getBuildSessionStatus('session-unknown');
      expect(status.exists).toBe(false);
    });
  });

  describe('Data Source and Validation APIs', () => {
    it('should return default data source configurations', async () => {
      const configs = await shapeBatchAPI.getDataSourceConfigs();

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty('name');
      expect(configs[0]).toHaveProperty('displayName');
      expect(configs[0]).toHaveProperty('license');
    });

    it('should return mock country metadata', async () => {
      const metadata = await shapeBatchAPI.getCountryMetadata('node-1', 'naturalearth');

      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0]).toHaveProperty('countryCode');
      expect(metadata[0]).toHaveProperty('countryName');
      expect(metadata[0]).toHaveProperty('availableAdminLevels');
    });

    it('should validate correct selection', async () => {
      const result = await shapeBatchAPI.validateSelection(['US', 'JP'], [0, 1], 'naturalearth');

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty country selection', async () => {
      const result = await shapeBatchAPI.validateSelection([], [0, 1], 'naturalearth');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one country must be selected');
    });

    it('should reject empty admin level selection', async () => {
      const result = await shapeBatchAPI.validateSelection(['US'], [], 'naturalearth');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one administrative level must be selected');
    });

    it('should reject invalid data source', async () => {
      const result = await shapeBatchAPI.validateSelection(['US'], [0], 'invalid-source');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid data source selected');
    });

    it('should warn about large selections', async () => {
      const manyCountries = Array.from({ length: 15 }, (_, i) => `C${i}`);
      const result = await shapeBatchAPI.validateSelection(manyCountries, [0], 'naturalearth');

      expect(result.warnings).toContain(
        'Large country selection may require significant processing time',
      );
    });
  });

  describe('Build Processing', () => {
    it('should reject invalid processing config', async () => {
      const draftId = 'node-123' as NodeId;
      const buildConfig = createBuildConfig();
      const processingConfig = createProcessingConfig({
        fetch: {
          ...DEFAULT_PROCESSING_CONFIG.fetch,
          maxConcurrent: 20,
        },
      });

      await expect(
        shapeBatchAPI.startBuildSession(draftId, buildConfig, processingConfig, []),
      ).rejects.toThrow('Invalid processing config');
    });
  });

  describe('EphemeralDB Cleanup', () => {
    it('should perform cleanup of expired data', async () => {
      const result = await shapeBatchAPI.performCleanup();

      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.buildSessionsRemoved).toBeDefined();
      expect(result.totalSpaceRecovered).toBeDefined();
    });

    it('should get cleanup statistics', async () => {
      const stats = await shapeBatchAPI.getCleanupStats();

      expect(stats).toBeDefined();
      expect(stats.totalDrafts).toBeDefined();
      expect(stats.expiredDrafts).toBeDefined();
      expect(stats.totalBuildSessions).toBeDefined();
      expect(stats.expiredBuildSessions).toBeDefined();
    });

    it('should force cleanup all data', async () => {
      const result = await shapeBatchAPI.forceCleanup();

      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.buildSessionsRemoved).toBeDefined();
    });
  });
});

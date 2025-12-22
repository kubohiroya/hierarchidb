/**
 * Worker API implementation tests
 */

import { describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import type { BatchConfig } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../../common/types/index.js';
import { shapePluginAPI } from '../../api.js';

const createBatchConfig = (
  overrides: Partial<BatchConfig> = {},
): BatchConfig => ({
  ...DEFAULT_PROCESSING_CONFIG,
  ...overrides,
  downloadConfig: {
    ...DEFAULT_PROCESSING_CONFIG.downloadConfig,
    ...overrides.downloadConfig,
  },
  simplificationConfig: {
    ...DEFAULT_PROCESSING_CONFIG.simplificationConfig,
    ...overrides.simplificationConfig,
  },
  tileConfig: {
    ...DEFAULT_PROCESSING_CONFIG.tileConfig,
    ...overrides.tileConfig,
  },
  cleanupConfig: {
    ...DEFAULT_PROCESSING_CONFIG.cleanupConfig,
    ...overrides.cleanupConfig,
  },
});

describe('Shape Plugin API', () => {
  describe('Batch Session Recovery for Direct Link Access', () => {
    it('should find pending batch sessions for node', async () => {
      const nodeId = 'node-123' as NodeId;

      const sessions = await shapePluginAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should return empty array for node without pending sessions', async () => {
      const nodeId = 'node-no-sessions' as NodeId;

      const sessions = await shapePluginAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });

    it('should return missing session status for unknown session', async () => {
      const status = await shapePluginAPI.getBatchSessionStatus('session-unknown');
      expect(status.exists).toBe(false);
    });
  });

  describe('Data Source and Validation APIs', () => {
    it('should return default data source configurations', async () => {
      const configs = await shapePluginAPI.getDataSourceConfigs();

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty('name');
      expect(configs[0]).toHaveProperty('displayName');
      expect(configs[0]).toHaveProperty('license');
    });

    it('should return mock country metadata', async () => {
      const metadata = await shapePluginAPI.getCountryMetadata('naturalearth');

      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0]).toHaveProperty('countryCode');
      expect(metadata[0]).toHaveProperty('countryName');
      expect(metadata[0]).toHaveProperty('availableAdminLevels');
    });

    it('should validate correct selection', async () => {
      const result = await shapePluginAPI.validateSelection(['US', 'JP'], [0, 1], 'naturalearth');

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty country selection', async () => {
      const result = await shapePluginAPI.validateSelection([], [0, 1], 'naturalearth');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one country must be selected');
    });

    it('should reject empty admin level selection', async () => {
      const result = await shapePluginAPI.validateSelection(['US'], [], 'naturalearth');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one administrative level must be selected');
    });

    it('should reject invalid data source', async () => {
      const result = await shapePluginAPI.validateSelection(['US'], [0], 'invalid-source');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid data source selected');
    });

    it('should warn about large selections', async () => {
      const manyCountries = Array.from({ length: 15 }, (_, i) => `C${i}`);
      const result = await shapePluginAPI.validateSelection(manyCountries, [0], 'naturalearth');

      expect(result.warnings).toContain(
        'Large country selection may require significant processing time',
      );
    });
  });

  describe('Batch Processing', () => {
    it('should reject invalid processing config', async () => {
      const draftId = 'node-123' as NodeId;
      const config = createBatchConfig({
        downloadConfig: {
          ...DEFAULT_PROCESSING_CONFIG.downloadConfig,
          maxConcurrent: 20,
        },
      });

      await expect(
        shapePluginAPI.startBatchProcessing(draftId, config, []),
      ).rejects.toThrow('Invalid processing config');
    });
  });

  describe('Selection Stats', () => {
    it('should calculate stats for URL metadata', async () => {
      const urlMetadata = [
        {
          url: 'http://example.com/us.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 1000000,
        },
      ];

      const stats = await shapePluginAPI.calculateSelectionStats(urlMetadata);

      expect(stats.totalSelected).toBe(1);
      expect(stats.countriesWithSelection).toBe(1);
      expect(stats.estimatedSize).toBe(1000000);
    });
  });

  describe('EphemeralDB Cleanup', () => {
    it('should perform cleanup of expired data', async () => {
      const result = await shapePluginAPI.performCleanup();

      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.batchSessionsRemoved).toBeDefined();
      expect(result.totalSpaceRecovered).toBeDefined();
    });

    it('should get cleanup statistics', async () => {
      const stats = await shapePluginAPI.getCleanupStats();

      expect(stats).toBeDefined();
      expect(stats.totalDrafts).toBeDefined();
      expect(stats.expiredDrafts).toBeDefined();
      expect(stats.totalBatchSessions).toBeDefined();
      expect(stats.expiredBatchSessions).toBeDefined();
    });

    it('should force cleanup all data', async () => {
      const result = await shapePluginAPI.forceCleanup();

      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.batchSessionsRemoved).toBeDefined();
    });
  });
});

/**
 * DownloadWorker Unit Tests
 * 
 * Tests for geographic data download, validation, and caching functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadWorker } from '../DownloadWorker';
import type { DownloadTask, DownloadTaskConfig } from '../../types';

describe('DownloadWorker', () => {
  let worker: DownloadWorker;

  beforeEach(() => {
    worker = new DownloadWorker();
  });

  describe('processDownload', () => {
    it('should successfully download and process GeoJSON data', async () => {
      // Arrange
      const task: DownloadTask = {
        taskId: 'test-download-1',
        sessionId: 'session-1',
        type: 'download',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'download',
        config: {
          dataSource: 'GADM',
          country: 'JP',
          adminLevel: 1,
          url: 'https://example.com/data.geojson',
          timeout: 30000,
          retryDelay: 1000,
          expectedFormat: 'geojson',
          validateSSL: true
        }
      };

      // Act
      const result = await worker.processDownload(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.featureCount).toBeGreaterThan(0);
      expect(result.downloadSize).toBeGreaterThan(0);
      expect(result.spatialIndices).toBeDefined();
      expect(result.spatialIndices.length).toBeGreaterThan(0);
    });

    it('should handle download failures gracefully', async () => {
      // Arrange
      const task: DownloadTask = {
        taskId: 'test-download-fail',
        sessionId: 'session-1',
        type: 'download',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'download',
        config: {
          dataSource: 'GADM',
          country: 'XX',
          adminLevel: 1,
          url: 'https://invalid-url.example.com/data.geojson',
          timeout: 1000,
          retryDelay: 100,
          expectedFormat: 'geojson',
          validateSSL: true
        }
      };

      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      const result = await worker.processDownload(task);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.errorMessage).toContain('Network error');
      expect(result.featureCount).toBe(0);
    });

    it('should use cached data when available', async () => {
      // Arrange
      const config: DownloadTaskConfig = {
        dataSource: 'GADM',
        country: 'JP',
        adminLevel: 1,
        url: 'https://example.com/cached-data.geojson',
        timeout: 1000, // Shorter timeout to avoid long waits
        retryDelay: 100,
        expectedFormat: 'geojson',
        validateSSL: true
      };

      const task1: DownloadTask = {
        taskId: 'test-download-cache-1',
        sessionId: 'session-1',
        type: 'download',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'download',
        config
      };

      // Pre-cache the data
      const cacheKey = 'GADM:JP:1';
      const mockData = new TextEncoder().encode(JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }]
      })).buffer;
      await worker.cacheData(cacheKey, mockData);

      // Act
      const result = await worker.processDownload(task1);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.downloadTime).toBeLessThan(1000); // Should be fast due to cache
    });
  });

  describe('validateData', () => {
    it('should validate correct GeoJSON data', async () => {
      // Arrange
      const validGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Test' },
            geometry: { type: 'Point', coordinates: [0, 0] }
          }
        ]
      };
      const data = new TextEncoder().encode(JSON.stringify(validGeoJSON)).buffer;

      // Act
      const result = await worker.validateData(data);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty data', async () => {
      // Arrange
      const emptyData = new ArrayBuffer(0);

      // Act
      const result = await worker.validateData(emptyData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'EMPTY_DATA')).toBe(true);
    });

    it('should reject non-GeoJSON data', async () => {
      // Arrange
      const invalidData = new TextEncoder().encode('This is not JSON').buffer;

      // Act
      const result = await worker.validateData(invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about large data sizes', async () => {
      // Arrange - Create actually large data (>10MB) to trigger warning
      const largeFeatures = Array(50000).fill(null).map((_, i) => ({
        type: 'Feature',
        properties: { 
          id: i, 
          name: `Feature ${i}`.repeat(20), // Make each feature larger
          description: 'A'.repeat(200) // Add more data per feature
        },
        geometry: { 
          type: 'Polygon', 
          coordinates: [Array(100).fill(null).map((_, j) => [i % 180, j % 90])] // Large polygons
        }
      }));
      
      const largeGeoJSON = {
        type: 'FeatureCollection',
        features: largeFeatures
      };
      const largeData = new TextEncoder().encode(JSON.stringify(largeGeoJSON)).buffer;

      // Act
      const result = await worker.validateData(largeData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('large'))).toBe(true);
    });
  });

  describe('cacheData and getCachedData', () => {
    it('should store and retrieve cached data', async () => {
      // Arrange
      const key = 'test-cache-key';
      const data = new TextEncoder().encode('test data').buffer;

      // Act
      await worker.cacheData(key, data);
      const retrieved = await worker.getCachedData(key);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved!.byteLength).toBe(data.byteLength);
    });

    it('should return null for non-existent cache keys', async () => {
      // Act
      const result = await worker.getCachedData('non-existent-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should implement LRU cache eviction', async () => {
      // Arrange
      const data = new TextEncoder().encode('test').buffer;

      // Fill cache beyond limit (assuming 10 entries max)
      for (let i = 0; i < 15; i++) {
        await worker.cacheData(`key-${i}`, data);
      }

      // Act
      const oldData = await worker.getCachedData('key-0');
      const newData = await worker.getCachedData('key-14');

      // Assert
      expect(oldData).toBeNull(); // Should be evicted
      expect(newData).toBeDefined(); // Should still exist
    });
  });

  describe('spatial indexing', () => {
    it('should generate spatial indices for features', async () => {
      // This is tested indirectly through processDownload
      // We could add more specific tests for spatial indexing logic
      const task: DownloadTask = {
        taskId: 'test-spatial-index',
        sessionId: 'session-1',
        type: 'download',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'download',
        config: {
          dataSource: 'GADM',
          country: 'JP',
          adminLevel: 1,
          url: 'https://example.com/spatial-test.geojson',
          timeout: 30000,
          retryDelay: 1000,
          expectedFormat: 'geojson',
          validateSSL: true
        }
      };

      const result = await worker.processDownload(task);

      expect(result.spatialIndices).toBeDefined();
      expect(result.spatialIndices.length).toBeGreaterThan(0);
      
      const firstIndex = result.spatialIndices[0];
      expect(firstIndex).toHaveProperty('indexId');
      expect(firstIndex).toHaveProperty('featureId');
      expect(firstIndex).toHaveProperty('mortonCode');
      expect(firstIndex).toHaveProperty('bbox');
      expect(firstIndex).toHaveProperty('centroid');
      expect(firstIndex).toHaveProperty('area');
      expect(firstIndex).toHaveProperty('complexity');
    });
  });
});
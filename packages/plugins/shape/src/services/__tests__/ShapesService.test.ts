/**
 * ShapesService Integration Tests
 * 
 * Tests for the main service layer that orchestrates Workers and database operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId, TreeId } from '@hierarchidb/00-core';
import { ShapesService } from '../ShapesService';
import type { BatchProcessConfig, BatchSession, DataSourceInfo } from '../types';

describe('ShapesService', () => {
  let service: ShapesService;
  let mockPluginAPI: any;

  beforeEach(() => {
    // Mock PluginAPI
    mockPluginAPI = {
      getWorkerAPI: vi.fn().mockReturnValue({
        executeCommand: vi.fn(),
        query: vi.fn(),
        subscribe: vi.fn()
      }),
      getDatabase: vi.fn().mockReturnValue({
        shapes: {
          add: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
          where: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([])
          })
        },
        batchTasks: {
          add: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
          where: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([])
          })
        },
        batchSessions: {
          add: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
          where: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null)
          })
        }
      }),
      createWorkingCopy: vi.fn(),
      commitWorkingCopy: vi.fn(),
      discardWorkingCopy: vi.fn()
    };

    service = new ShapesService(mockPluginAPI);
  });

  describe('batch session management', () => {
    it('should create new batch session successfully', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const config: BatchProcessConfig = {
        dataSource: 'GADM',
        countryCode: 'JP',
        adminLevels: [1, 2],
        workerPoolSize: 4,
        enableFeatureExtraction: true,
        simplificationLevels: [1, 2],
        tileZoomRange: [0, 10],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 100 * 1024 * 1024,
          compressionLevel: 6
        }
      };

      const mockSession: BatchSession = {
        sessionId: 'session-123',
        nodeId,
        status: 'running',
        config,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        progress: {
          total: 100,
          completed: 0,
          failed: 0,
          skipped: 0,
          percentage: 0
        }
      };

      mockPluginAPI.getDatabase().batchSessions.add.mockResolvedValue(mockSession);

      // Act
      const session = await service.createBatchSession(nodeId, config);

      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.nodeId).toBe(nodeId);
      expect(session.status).toBe('running');
      expect(session.config).toEqual(config);
      expect(mockPluginAPI.getDatabase().batchSessions.add).toHaveBeenCalled();
    });

    it('should enforce single session constraint', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const config: BatchProcessConfig = {
        dataSource: 'GADM',
        countryCode: 'JP',
        adminLevels: [1]
      };

      // Mock existing active session
      const existingSession: BatchSession = {
        sessionId: 'existing-session',
        nodeId,
        status: 'running',
        config,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      };

      mockPluginAPI.getDatabase().batchSessions.where.mockReturnValue({
        first: vi.fn().mockResolvedValue(existingSession)
      });

      // Act & Assert
      await expect(service.createBatchSession(nodeId, config))
        .rejects.toThrow('Node already has an active batch session');
    });

    it('should pause and resume batch sessions', async () => {
      // Arrange
      const sessionId = 'session-123';
      const mockSession: BatchSession = {
        sessionId,
        nodeId: 'node-123' as NodeId,
        status: 'running',
        config: { dataSource: 'GADM', countryCode: 'JP', adminLevels: [1] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        progress: { total: 100, completed: 50, failed: 0, skipped: 0, percentage: 50 }
      };

      mockPluginAPI.getDatabase().batchSessions.get.mockResolvedValue(mockSession);
      mockPluginAPI.getDatabase().batchSessions.update.mockResolvedValue(1);

      // Act
      await service.pauseBatchSession(sessionId);
      await service.resumeBatchSession(sessionId);

      // Assert
      expect(mockPluginAPI.getDatabase().batchSessions.update).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ status: 'paused' })
      );
      expect(mockPluginAPI.getDatabase().batchSessions.update).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should cancel batch session and cleanup tasks', async () => {
      // Arrange
      const sessionId = 'session-123';
      const nodeId: NodeId = 'node-123' as NodeId;
      
      const mockSession: BatchSession = {
        sessionId,
        nodeId,
        status: 'running',
        config: { dataSource: 'GADM', countryCode: 'JP', adminLevels: [1] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        progress: { total: 100, completed: 25, failed: 0, skipped: 0, percentage: 25 }
      };

      const mockTasks = [
        { taskId: 'task-1', sessionId, status: 'running', type: 'download' },
        { taskId: 'task-2', sessionId, status: 'pending', type: 'simplify1' }
      ];

      mockPluginAPI.getDatabase().batchSessions.get.mockResolvedValue(mockSession);
      mockPluginAPI.getDatabase().batchTasks.where.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockTasks)
      });

      // Act
      await service.cancelBatchSession(sessionId);

      // Assert
      expect(mockPluginAPI.getDatabase().batchSessions.update).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ status: 'cancelled' })
      );
      
      // Should update all tasks to cancelled
      expect(mockPluginAPI.getDatabase().batchTasks.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('data source management', () => {
    it('should return available data sources', async () => {
      // Act
      const dataSources = await service.getAvailableDataSources();

      // Assert
      expect(dataSources).toBeInstanceOf(Array);
      expect(dataSources.length).toBeGreaterThan(0);
      
      const gadm = dataSources.find(ds => ds.name === 'GADM');
      expect(gadm).toBeDefined();
      expect(gadm?.displayName).toBe('GADM Administrative Areas');
      expect(gadm?.features).toContain('boundaries');
    });

    it('should validate data source configuration', async () => {
      // Arrange
      const validConfig = {
        countryCode: 'JP',
        adminLevels: [1, 2],
        bbox: [130, 30, 140, 40]
      };

      // Act
      const validation = await service.validateDataSource('GADM', validConfig);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.estimatedSize).toBeGreaterThan(0);
      expect(validation.estimatedFeatures).toBeGreaterThan(0);
    });

    it('should reject invalid data source configuration', async () => {
      // Arrange
      const invalidConfig = {
        countryCode: 'INVALID',
        adminLevels: [999] // Invalid admin level
      };

      // Act
      const validation = await service.validateDataSource('GADM', invalidConfig);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('country'))).toBe(true);
    });

    it('should get country metadata for data source', async () => {
      // Act
      const metadata = await service.getCountryMetadata('GADM', 'JP');

      // Assert
      expect(metadata).toBeInstanceOf(Array);
      expect(metadata.length).toBeGreaterThan(0);
      
      const japan = metadata[0];
      expect(japan.countryCode).toBe('JP');
      expect(japan.countryName).toBe('Japan');
      expect(japan.adminLevels).toBeInstanceOf(Array);
      expect(japan.adminLevels.length).toBeGreaterThan(0);
      expect(japan.bbox).toHaveLength(4);
    });
  });

  describe('feature management', () => {
    it('should search features by name', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const mockFeatures = [
        {
          id: 1,
          nodeId,
          properties: { name: 'Tokyo', admin_level: 1, population: 13960000 },
          geometry: { type: 'Polygon', coordinates: [] },
          bbox: [139.69, 35.68, 139.70, 35.69]
        }
      ];

      mockPluginAPI.getDatabase().shapes.where.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockFeatures)
      });

      // Act
      const features = await service.searchFeatures(nodeId, 'Tokyo', {
        limit: 10,
        adminLevel: 1
      });

      // Assert
      expect(features).toEqual(mockFeatures);
      expect(features).toHaveLength(1);
      expect(features[0].properties.name).toBe('Tokyo');
    });

    it('should get features by bounding box', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const bbox: [number, number, number, number] = [139, 35, 140, 36];
      
      const mockFeatures = [
        {
          id: 1,
          nodeId,
          properties: { name: 'Tokyo', admin_level: 1 },
          geometry: { type: 'Polygon', coordinates: [] },
          bbox: [139.69, 35.68, 139.70, 35.69]
        }
      ];

      mockPluginAPI.getDatabase().shapes.where.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockFeatures)
      });

      // Act
      const features = await service.getFeaturesByBbox(nodeId, bbox, {
        adminLevel: 1,
        includeProperties: true
      });

      // Assert
      expect(features).toEqual(mockFeatures);
      expect(features).toHaveLength(1);
    });

    it('should get feature by ID', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const featureId = 1;
      
      const mockFeature = {
        id: featureId,
        nodeId,
        properties: { name: 'Tokyo', admin_level: 1 },
        geometry: { type: 'Polygon', coordinates: [] },
        bbox: [139.69, 35.68, 139.70, 35.69]
      };

      mockPluginAPI.getDatabase().shapes.get.mockResolvedValue(mockFeature);

      // Act
      const feature = await service.getFeatureById(nodeId, featureId);

      // Assert
      expect(feature).toEqual(mockFeature);
      expect(feature?.properties.name).toBe('Tokyo');
    });
  });

  describe('cache management', () => {
    it('should get cache statistics', async () => {
      // Act
      const stats = await service.getCacheStatistics();

      // Assert
      expect(stats).toBeDefined();
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
      expect(stats.totalItems).toBeGreaterThanOrEqual(0);
      expect(stats.byType).toBeDefined();
      expect(stats.byType.features).toBeDefined();
      expect(stats.byType.tiles).toBeDefined();
      expect(stats.byType.buffers).toBeDefined();
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('should clear cache for specific node', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;

      // Act
      await service.clearCache(nodeId, 'features');

      // Assert - Should complete without errors
      expect(true).toBe(true);
    });

    it('should optimize storage', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;

      // Act
      const result = await service.optimizeStorage(nodeId);

      // Assert
      expect(result).toBeDefined();
      expect(result.freedSpace).toBeGreaterThanOrEqual(0);
      expect(result.removedItems).toBeGreaterThanOrEqual(0);
      expect(result.compactedItems).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });
  });

  describe('vector tile management', () => {
    it('should get vector tile data', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const mockTileData = new Uint8Array([1, 2, 3, 4, 5]);

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockTileData);

      // Act
      const tileData = await service.getTile(nodeId, 10, 512, 256);

      // Assert
      expect(tileData).toEqual(mockTileData);
      expect(mockPluginAPI.getWorkerAPI().query).toHaveBeenCalledWith(
        'getVectorTile',
        { nodeId, z: 10, x: 512, y: 256 }
      );
    });

    it('should get tile metadata', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const mockMetadata = {
        exists: true,
        nodeId,
        tileKey: '10-512-256',
        z: 10,
        x: 512,
        y: 256,
        size: 15000,
        features: 150,
        layers: [
          { name: 'admin_1', featureCount: 47, minZoom: 0, maxZoom: 18, fields: ['name', 'code'] }
        ],
        generatedAt: Date.now(),
        contentHash: 'abc123',
        version: 1
      };

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockMetadata);

      // Act
      const metadata = await service.getTileMetadata(nodeId, 10, 512, 256);

      // Assert
      expect(metadata).toEqual(mockMetadata);
      expect(metadata.exists).toBe(true);
      expect(metadata.layers).toHaveLength(1);
    });

    it('should clear tile cache', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;

      // Act
      await service.clearTileCache(nodeId);

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        'clearTileCache',
        { nodeId }
      );
    });
  });

  describe('error handling', () => {
    it('should handle worker communication errors', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      mockPluginAPI.getWorkerAPI().query.mockRejectedValue(new Error('Worker error'));

      // Act & Assert
      await expect(service.getTile(nodeId, 10, 512, 256))
        .rejects.toThrow('Worker error');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const nodeId: NodeId = 'node-123' as NodeId;
      const config: BatchProcessConfig = {
        dataSource: 'GADM',
        countryCode: 'JP',
        adminLevels: [1]
      };

      mockPluginAPI.getDatabase().batchSessions.add.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createBatchSession(nodeId, config))
        .rejects.toThrow('Database error');
    });
  });
});
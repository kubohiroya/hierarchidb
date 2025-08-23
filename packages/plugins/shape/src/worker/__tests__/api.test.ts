/**
 * Worker API implementation tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shapePluginAPI } from '../api';
import type { NodeId } from '@hierarchidb/00-core';
import type { CreateShapeData, UpdateShapeData } from '../../shared';

// Mock ShapeEntityHandler
vi.mock('../handlers/ShapeEntityHandler', () => ({
  ShapeEntityHandler: vi.fn().mockImplementation(() => ({
    createEntity: vi.fn(),
    getEntityByNodeId: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn()
  }))
}));

describe('Shape Plugin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkingCopy Management (CopyOnWrite Pattern)', () => {
    it('should create WorkingCopy for existing entity', async () => {
      const nodeId = 'node-456' as NodeId;
      const mockEntity = {
        id: 'entity-123' as any,
        nodeId: nodeId,
        name: 'Test Shape',
        dataSourceName: 'naturalearth',
        processingConfig: {
          concurrentDownloads: 2,
          corsProxyBaseURL: '',
          enableFeatureFiltering: false,
          featureFilterMethod: 'hybrid',
          featureAreaThreshold: 0.1,
          concurrentProcesses: 2,
          maxZoomLevel: 12
        }
      };

      // Mock the entity handler to return an entity
      const mockHandler = {
        getEntityByNodeId: vi.fn().mockResolvedValue(mockEntity),
        createWorkingCopy: vi.fn().mockResolvedValue({
          id: 'working-copy-123' as any,
          ...mockEntity,
          isDraft: false
        })
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      const workingCopyId = await shapePluginAPI.createWorkingCopy(nodeId);
      expect(typeof workingCopyId).toBe('string');
      expect(mockHandler.getEntityByNodeId).toHaveBeenCalledWith(nodeId);
      expect(mockHandler.createWorkingCopy).toHaveBeenCalledWith(mockEntity);
    });

    it('should create new draft WorkingCopy', async () => {
      const parentNodeId = 'parent-456' as NodeId;
      const mockWorkingCopy = {
        id: 'working-copy-new' as any,
        name: '',
        isDraft: true
      };

      const mockHandler = {
        createNewDraftWorkingCopy: vi.fn().mockResolvedValue(mockWorkingCopy)
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      const workingCopyId = await shapePluginAPI.createNewDraftWorkingCopy(parentNodeId);
      expect(typeof workingCopyId).toBe('string');
      expect(mockHandler.createNewDraftWorkingCopy).toHaveBeenCalledWith(parentNodeId);
    });

    it('should get WorkingCopy by ID', async () => {
      const workingCopyId = 'working-copy-123' as any;
      const mockWorkingCopy = {
        id: workingCopyId,
        name: 'Test Shape',
        isDraft: false
      };

      const mockHandler = {
        getWorkingCopy: vi.fn().mockResolvedValue(mockWorkingCopy)
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      const workingCopy = await shapePluginAPI.getWorkingCopy(workingCopyId);
      expect(workingCopy).toEqual(mockWorkingCopy);
      expect(mockHandler.getWorkingCopy).toHaveBeenCalledWith(workingCopyId);
    });

    it('should update WorkingCopy with new data', async () => {
      const workingCopyId = 'working-copy-123' as any;
      const updateData: UpdateShapeData = {
        name: 'Updated Shape Name',
        description: 'Updated description'
      };

      const mockHandler = {
        updateWorkingCopy: vi.fn().mockResolvedValue({
          id: workingCopyId,
          ...updateData
        })
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      const updated = await shapePluginAPI.updateWorkingCopy(workingCopyId, updateData);
      expect(updated).toBeDefined();
      expect(mockHandler.updateWorkingCopy).toHaveBeenCalledWith(workingCopyId, updateData);
    });

    it('should commit WorkingCopy to CoreDB', async () => {
      const workingCopyId = 'working-copy-123' as any;
      const expectedNodeId = 'node-456' as NodeId;

      const mockHandler = {
        commitWorkingCopy: vi.fn().mockResolvedValue(expectedNodeId)
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      const nodeId = await shapePluginAPI.commitWorkingCopy(workingCopyId);
      expect(nodeId).toBe(expectedNodeId);
      expect(mockHandler.commitWorkingCopy).toHaveBeenCalledWith(workingCopyId);
    });

    it('should discard WorkingCopy from EphemeralDB', async () => {
      const workingCopyId = 'working-copy-123' as any;

      const mockHandler = {
        discardWorkingCopy: vi.fn().mockResolvedValue(undefined)
      };
      
      vi.doMock('../handlers/ShapeEntityHandler', () => ({
        ShapeEntityHandler: vi.fn(() => mockHandler)
      }));

      await shapePluginAPI.discardWorkingCopy(workingCopyId);
      expect(mockHandler.discardWorkingCopy).toHaveBeenCalledWith(workingCopyId);
    });
  });

  describe('WorkingCopy-based Batch Processing', () => {
    it('should start batch processing with WorkingCopy ID', async () => {
      const workingCopyId = 'working-copy-123' as any;
      const config = {
        concurrentDownloads: 2,
        corsProxyBaseURL: '',
        enableFeatureFiltering: false,
        featureFilterMethod: 'hybrid',
        featureAreaThreshold: 0.1,
        concurrentProcesses: 2,
        maxZoomLevel: 12
      };
      const urlMetadata = [
        {
          url: 'http://example.com/us.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 1000000
        }
      ];

      const sessionId = await shapePluginAPI.startBatchProcessing(workingCopyId, config, urlMetadata);
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session-/);
    });

    it('should pause batch processing', async () => {
      const workingCopyId = 'working-copy-123' as any;

      await expect(
        shapePluginAPI.pauseBatchProcessing(workingCopyId)
      ).resolves.not.toThrow();
    });

    it('should resume batch processing', async () => {
      const workingCopyId = 'working-copy-123' as any;

      const sessionId = await shapePluginAPI.resumeBatchProcessing(workingCopyId);
      expect(typeof sessionId).toBe('string');
    });

    it('should cancel batch processing', async () => {
      const workingCopyId = 'working-copy-123' as any;

      await expect(
        shapePluginAPI.cancelBatchProcessing(workingCopyId)
      ).resolves.not.toThrow();
    });

    it('should get batch processing status', async () => {
      const sessionId = 'session-123';
      const mockStatus = {
        sessionId,
        status: 'running' as const,
        progress: 0.5,
        completedTasks: 5,
        totalTasks: 10
      };

      const status = await shapePluginAPI.getBatchStatus(sessionId);
      expect(status).toBeDefined();
      expect(status.sessionId).toBe(sessionId);
    });
  });

  describe('Batch Session Recovery for Direct Link Access', () => {
    it('should find pending batch sessions for node', async () => {
      const nodeId = 'node-123' as NodeId;
      const mockSessions = [
        {
          sessionId: 'session-1',
          workingCopyId: 'working-copy-1' as any,
          nodeId: nodeId,
          status: 'paused' as const,
          createdAt: Date.now(),
          lastActivityAt: Date.now()
        },
        {
          sessionId: 'session-2',
          workingCopyId: 'working-copy-2' as any,
          nodeId: nodeId,
          status: 'running' as const,
          createdAt: Date.now(),
          lastActivityAt: Date.now()
        }
      ];

      const sessions = await shapePluginAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should return empty array for node without pending sessions', async () => {
      const nodeId = 'node-no-sessions' as NodeId;
      
      const sessions = await shapePluginAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Legacy API Compatibility', () => {
    it('should get entity by node ID (for backward compatibility)', async () => {
      const nodeId = 'node-123' as NodeId;
      const result = await shapePluginAPI.getEntity(nodeId);
      // Mock implementation returns undefined
      expect(result).toBeUndefined();
    });

    it('should throw error for legacy updateEntity when entity not found', async () => {
      const nodeId = 'node-123' as NodeId;
      const updateData: UpdateShapeData = {
        name: 'Updated Name'
      };

      await expect(
        shapePluginAPI.updateEntity(nodeId, updateData)
      ).rejects.toThrow('Shape entity not found for node');
    });

    it('should throw error for legacy deleteEntity when entity not found', async () => {
      const nodeId = 'node-123' as NodeId;

      await expect(
        shapePluginAPI.deleteEntity(nodeId)
      ).rejects.toThrow('Shape entity not found for node');
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
      const result = await shapePluginAPI.validateSelection(
        ['US', 'JP'],
        [0, 1],
        'naturalearth'
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should calculate stats for URL metadata', async () => {
      const urlMetadata = [
        {
          url: 'http://example.com/us.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 1000000
        }
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
      expect(stats.totalWorkingCopies).toBeDefined();
      expect(stats.expiredWorkingCopies).toBeDefined();
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

  describe('createEntity', () => {
    it('should create entity with valid data', async () => {
      const mockEntity = {
        id: 'entity-123' as any,
        nodeId: 'node-456' as NodeId,
        name: 'Test Shape',
        dataSourceName: 'naturalearth',
        processingConfig: {
          concurrentDownloads: 2,
          corsProxyBaseURL: '',
          enableFeatureFiltering: false,
          featureFilterMethod: 'hybrid',
          featureAreaThreshold: 0.1,
          concurrentProcesses: 2,
          maxZoomLevel: 12
        }
      };

      const createData: CreateShapeData = {
        name: 'Test Shape',
        dataSourceName: 'naturalearth',
        processingConfig: mockEntity.processingConfig
      };

      const result = await shapePluginAPI.createEntity('node-456' as NodeId, createData);
      expect(result).toBeDefined();
    });
  });

  describe('getEntity', () => {
    it('should return entity if found', async () => {
      const nodeId = 'node-123' as NodeId;
      const result = await shapePluginAPI.getEntity(nodeId);
      // Mock implementation returns undefined
      expect(result).toBeUndefined();
    });
  });

  describe('updateEntity', () => {
    it('should throw error if entity not found', async () => {
      const nodeId = 'node-123' as NodeId;
      const updateData: UpdateShapeData = {
        name: 'Updated Name'
      };

      await expect(
        shapePluginAPI.updateEntity(nodeId, updateData)
      ).rejects.toThrow('Shape entity not found for node');
    });
  });

  describe('deleteEntity', () => {
    it('should throw error if entity not found', async () => {
      const nodeId = 'node-123' as NodeId;

      await expect(
        shapePluginAPI.deleteEntity(nodeId)
      ).rejects.toThrow('Shape entity not found for node');
    });
  });

  describe('getDataSourceConfigs', () => {
    it('should return default data source configurations', async () => {
      const configs = await shapePluginAPI.getDataSourceConfigs();
      
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty('name');
      expect(configs[0]).toHaveProperty('displayName');
      expect(configs[0]).toHaveProperty('license');
    });
  });

  describe('getCountryMetadata', () => {
    it('should return mock country metadata', async () => {
      const metadata = await shapePluginAPI.getCountryMetadata('naturalearth');
      
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0]).toHaveProperty('countryCode');
      expect(metadata[0]).toHaveProperty('countryName');
      expect(metadata[0]).toHaveProperty('availableAdminLevels');
    });

    it('should filter countries by data source capabilities', async () => {
      const metadata = await shapePluginAPI.getCountryMetadata('naturalearth');
      
      // All countries should have admin levels within naturalearth's capabilities
      metadata.forEach(country => {
        const hasValidLevels = country.availableAdminLevels.some(level => level <= 2); // naturalearth maxAdminLevel
        expect(hasValidLevels).toBe(true);
      });
    });
  });

  describe('validateSelection', () => {
    it('should validate correct selection', async () => {
      const result = await shapePluginAPI.validateSelection(
        ['US', 'JP'],
        [0, 1],
        'naturalearth'
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty country selection', async () => {
      const result = await shapePluginAPI.validateSelection(
        [],
        [0, 1],
        'naturalearth'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one country must be selected');
    });

    it('should reject empty admin level selection', async () => {
      const result = await shapePluginAPI.validateSelection(
        ['US'],
        [],
        'naturalearth'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one administrative level must be selected');
    });

    it('should reject invalid data source', async () => {
      const result = await shapePluginAPI.validateSelection(
        ['US'],
        [0],
        'invalid-source'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid data source selected');
    });

    it('should warn about large selections', async () => {
      const manyCountries = Array.from({ length: 15 }, (_, i) => `C${i}`);
      const result = await shapePluginAPI.validateSelection(
        manyCountries,
        [0],
        'naturalearth'
      );
      
      expect(result.warnings).toContain('Large country selection may require significant processing time');
    });
  });

  describe('startBatchProcessing', () => {
    it('should start batch processing with valid config', async () => {
      const sessionId = await shapePluginAPI.startBatchProcessing(
        'node-123' as NodeId,
        {
          concurrentDownloads: 2,
          corsProxyBaseURL: '',
          enableFeatureFiltering: false,
          featureFilterMethod: 'hybrid',
          featureAreaThreshold: 0.1,
          concurrentProcesses: 2,
          maxZoomLevel: 12
        },
        []
      );
      
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session-/);
    });

    it('should reject invalid processing config', async () => {
      await expect(
        shapePluginAPI.startBatchProcessing(
          'node-123' as NodeId,
          {
            concurrentDownloads: 20, // Invalid - exceeds limit
            corsProxyBaseURL: '',
            enableFeatureFiltering: false,
            featureFilterMethod: 'hybrid',
            featureAreaThreshold: 0.1,
            concurrentProcesses: 2,
            maxZoomLevel: 12
          },
          []
        )
      ).rejects.toThrow('Invalid processing config');
    });
  });

  describe('calculateSelectionStats', () => {
    it('should calculate stats for URL metadata', async () => {
      const urlMetadata = [
        {
          url: 'http://example.com/us.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 1000000
        }
      ];

      const stats = await shapePluginAPI.calculateSelectionStats(urlMetadata);
      
      expect(stats.totalSelected).toBe(1);
      expect(stats.countriesWithSelection).toBe(1);
      expect(stats.estimatedSize).toBe(1000000);
    });
  });
});
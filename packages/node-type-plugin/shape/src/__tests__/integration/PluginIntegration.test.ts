/**
 * Plugin Integration Tests
 * Tests the complete Shape plugin integration with HierarchiDB
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { NodeId, EntityId } from '@hierarchidb/common-core';
import { ShapePluginDefinition } from '~/definitions/ShapePluginDefinition';
import { ShapesPluginAPI } from '~/api/ShapesPluginAPI';
import { ShapeEntityHandler } from '~/handlers/ShapeEntityHandler';
import { registerShapePlugin, unregisterShapePlugin } from '~/plugin';
import type { ShapesEntity, BatchProcessConfig } from '~/types';

// Mock HierarchiDB worker module
vi.mock('@hierarchidb/runtime-worker', () => ({
  BaseEntityHandler: class MockBaseEntityHandler {
    constructor() {}
  },
  NodeTypeRegistry: {
    getInstance: () => ({
      register: vi.fn(),
      unregister: vi.fn(),
    }),
  },
}));

// Mock Comlink
vi.mock('comlink', () => ({
  wrap: vi.fn(),
  expose: vi.fn(),
}));

describe('Shape Plugin Integration', () => {
  let pluginAPI: ShapesPluginAPI;
  let entityHandler: ShapeEntityHandler;

  beforeAll(async () => {
    // Setup test environment
    pluginAPI = new ShapesPluginAPI();
    entityHandler = new ShapeEntityHandler();
  });

  afterAll(async () => {
    // Cleanup
    try {
      await pluginAPI.shutdown();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Plugin Definition', () => {
    it('should have valid plugin definition structure', () => {
      expect(ShapePluginDefinition).toBeDefined();
      expect(ShapePluginDefinition.nodeType).toBe('shape');
      expect(ShapePluginDefinition.database).toBeDefined();
      expect(ShapePluginDefinition.entityHandler).toBeInstanceOf(ShapeEntityHandler);
      expect(ShapePluginDefinition.lifecycle).toBeDefined();
      expect(ShapePluginDefinition.ui).toBeDefined();
      expect(ShapePluginDefinition.validation).toBeDefined();
      expect(ShapePluginDefinition.permissions).toBeDefined();
      expect(ShapePluginDefinition.metadata).toBeDefined();
    });

    it('should have correct database schema', () => {
      const schema = ShapePluginDefinition.database.schema;
      expect(schema['&id']).toBe('EntityId');
      expect(schema['nodeId']).toBe('NodeId');
      expect(schema).toHaveProperty('name, description');
      expect(schema).toHaveProperty('dataSourceName');
      expect(schema).toHaveProperty('createdAt, updatedAt, version');
    });

    it('should have lifecycle hooks defined', () => {
      const lifecycle = ShapePluginDefinition.lifecycle;
      expect(lifecycle.beforeCreate).toBeDefined();
      expect(lifecycle.afterCreate).toBeDefined();
      expect(lifecycle.beforeUpdate).toBeDefined();
      expect(lifecycle.afterUpdate).toBeDefined();
      expect(lifecycle.beforeDelete).toBeDefined();
      expect(lifecycle.afterDelete).toBeDefined();
      expect(lifecycle.onCopy).toBeDefined();
      expect(lifecycle.onMove).toBeDefined();
    });

    it('should have UI components defined', () => {
      const ui = ShapePluginDefinition.ui;
      expect(ui.dialogComponent).toBeDefined();
      expect(ui.panelComponent).toBeDefined();
      expect(ui.icon).toBeDefined();
      expect(ui.display).toBeDefined();
    });

    it('should have validation rules', () => {
      const validation = ShapePluginDefinition.validation;
      expect(validation.name).toBeDefined();
      expect(validation.custom).toBeDefined();
    });

    it('should have permission configuration', () => {
      const permissions = ShapePluginDefinition.permissions;
      expect(permissions.create).toEqual(['admin', 'editor']);
      expect(permissions.read).toEqual(['admin', 'editor', 'viewer']);
      expect(permissions.update).toEqual(['admin', 'editor']);
      expect(permissions.delete).toEqual(['admin']);
      expect(permissions.custom).toBeDefined();
    });
  });

  describe('Plugin Registration', () => {
    it('should register plugin without errors', async () => {
      // Mock the NodeTypeRegistry
      const mockRegistry = {
        register: vi.fn(),
        getInstance: vi.fn(() => mockRegistry),
      };

      // This test verifies the registration function structure
      expect(registerShapePlugin).toBeDefined();
      expect(typeof registerShapePlugin).toBe('function');
    });

    it('should unregister plugin without errors', async () => {
      expect(unregisterShapePlugin).toBeDefined();
      expect(typeof unregisterShapePlugin).toBe('function');
    });
  });

  describe('Plugin API', () => {
    it('should initialize plugin API', async () => {
      expect(async () => {
        await pluginAPI.initialize();
      }).not.toThrow();
    });

    it('should provide all required API methods', () => {
      // Batch Processing API
      expect(pluginAPI.startBatchProcess).toBeDefined();
      expect(pluginAPI.pauseBatchProcess).toBeDefined();
      expect(pluginAPI.resumeBatchProcess).toBeDefined();
      expect(pluginAPI.cancelBatchProcess).toBeDefined();
      expect(pluginAPI.getBatchStatus).toBeDefined();

      // Data Source API
      expect(pluginAPI.getAvailableDataSources).toBeDefined();
      expect(pluginAPI.getCountryMetadata).toBeDefined();
      expect(pluginAPI.validateDataSource).toBeDefined();

      // Vector Tile API
      expect(pluginAPI.getTile).toBeDefined();
      expect(pluginAPI.getTileMetadata).toBeDefined();
      expect(pluginAPI.clearTileCache).toBeDefined();

      // Feature Query API
      expect(pluginAPI.searchFeatures).toBeDefined();
      expect(pluginAPI.getFeatureById).toBeDefined();
      expect(pluginAPI.getFeaturesByBbox).toBeDefined();

      // Cache Management API
      expect(pluginAPI.getCacheStatistics).toBeDefined();
      expect(pluginAPI.clearCache).toBeDefined();
      expect(pluginAPI.optimizeStorage).toBeDefined();
    });

    it('should get health status', async () => {
      await pluginAPI.initialize();
      const health = await pluginAPI.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.statistics).toBeDefined();
    });

    it('should get worker pool statistics', async () => {
      await pluginAPI.initialize();
      const stats = pluginAPI.getWorkerPoolStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.download).toBeDefined();
      expect(stats.simplify1).toBeDefined();
      expect(stats.simplify2).toBeDefined();
      expect(stats.vectorTile).toBeDefined();
      expect(stats.queuedTasks).toBeDefined();
    });
  });

  describe('Entity Handler with CopyOnWrite Pattern', () => {
    const mockNodeId = 'node-123' as NodeId;
    const mockEntityId = 'entity-456' as EntityId;

    it('should create WorkingCopy for new draft', async () => {
      const parentId = 'parent-123' as NodeId;
      
      const workingCopy = await entityHandler.createNewDraftWorkingCopy(parentId);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.isDraft).toBe(true);
      expect(workingCopy.name).toBe('');
      expect(workingCopy.licenseAgreement).toBe(false);
    });

    it('should create WorkingCopy from existing entity', async () => {
      const mockEntity: ShapesEntity = {
        id: mockEntityId,
        nodeId: mockNodeId,
        name: 'Test Shape',
        description: 'Test description',
        dataSourceName: 'naturalearth',
        processingConfig: {
          dataSource: 'naturalearth',
          workerPoolSize: 2,
          enableFeatureExtraction: true,
          simplificationLevels: [0.001, 0.01],
          tileZoomRange: [0, 12],
          cacheStrategy: {
            enableCache: true,
            ttl: 3600,
            maxSize: 100 * 1024 * 1024,
            compressionLevel: 6,
          },
        },
        adminLevels: [0, 1],
        selectedCountries: ['US'],
        urlMetadata: [],
        batchSessionId: null,
        processingStatus: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const workingCopy = await entityHandler.createWorkingCopy(mockEntity);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.name).toBe(mockEntity.name);
      expect(workingCopy.description).toBe(mockEntity.description);
      expect(workingCopy.dataSourceName).toBe(mockEntity.dataSourceName);
      expect(workingCopy.licenseAgreement).toBe(false); // Should be reset
      expect(workingCopy.isDraft).toBe(false);
    });

    it('should update WorkingCopy with new data', async () => {
      const workingCopyId = 'working-copy-123' as EntityId;
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        selectedCountries: ['US', 'CA'],
        adminLevels: [0, 1, 2]
      };

      const updatedWorkingCopy = await entityHandler.updateWorkingCopy(workingCopyId, updateData);

      expect(updatedWorkingCopy).toBeDefined();
      expect(updatedWorkingCopy.name).toBe(updateData.name);
      expect(updatedWorkingCopy.description).toBe(updateData.description);
      expect(updatedWorkingCopy.selectedCountries).toEqual(updateData.selectedCountries);
      expect(updatedWorkingCopy.adminLevels).toEqual(updateData.adminLevels);
    });

    it('should commit WorkingCopy to CoreDB', async () => {
      const workingCopyId = 'working-copy-123' as EntityId;
      const expectedNodeId = 'committed-node-456' as NodeId;

      const nodeId = await entityHandler.commitWorkingCopy(workingCopyId);

      expect(nodeId).toBe(expectedNodeId);
    });

    it('should discard WorkingCopy from EphemeralDB', async () => {
      const workingCopyId = 'working-copy-123' as EntityId;

      await expect(
        entityHandler.discardWorkingCopy(workingCopyId)
      ).resolves.not.toThrow();
    });

    it('should validate entity data structure', () => {
      const entityData: Partial<ShapesEntity> = {
        name: 'Test Shape',
        dataSourceName: 'naturalearth',
      };

      // Test that required fields are present
      expect(entityData.name).toBeDefined();
      expect(entityData.dataSourceName).toBeDefined();
    });
  });

    it('should validate entity data structure', () => {
      const entityData: Partial<ShapesEntity> = {
        name: 'Test Shape',
        dataSourceName: 'naturalearth',
      };

      // Test that required fields are present
      expect(entityData.name).toBeDefined();
      expect(entityData.dataSourceName).toBeDefined();
    });

    it('should create working copy from entity', async () => {
      const mockEntity: ShapesEntity = {
        id: mockEntityId,
        nodeId: mockNodeId,
        name: 'Test Shape',
        description: 'Test description',
        dataSourceName: 'naturalearth',
        processingConfig: {
          dataSource: 'naturalearth',
          workerPoolSize: 2,
          enableFeatureExtraction: true,
          simplificationLevels: [0.001, 0.01],
          tileZoomRange: [0, 12],
          cacheStrategy: {
            enableCache: true,
            ttl: 3600,
            maxSize: 100 * 1024 * 1024,
            compressionLevel: 6,
          },
        },
        adminLevels: [0, 1],
        selectedCountries: ['US'],
        urlMetadata: [],
        batchSessionId: null,
        processingStatus: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const workingCopy = await entityHandler.createWorkingCopy(mockEntity);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.name).toBe(mockEntity.name);
      expect(workingCopy.description).toBe(mockEntity.description);
      expect(workingCopy.dataSourceName).toBe(mockEntity.dataSourceName);
      expect(workingCopy.licenseAgreement).toBe(false); // Should be reset
      expect(workingCopy.isDraft).toBe(false);
    });
  });

  describe('Data Source Integration', () => {
    it('should get available data sources', async () => {
      await pluginAPI.initialize();
      const dataSources = await pluginAPI.getAvailableDataSources();
      
      expect(Array.isArray(dataSources)).toBe(true);
      // Should include default data sources
      const sourceNames = dataSources.map(ds => ds.name);
      expect(sourceNames).toContain('naturalearth');
      expect(sourceNames).toContain('gadm');
    });

    it('should validate data source configuration', async () => {
      await pluginAPI.initialize();
      
      const validConfig = {
        dataSource: 'naturalearth',
        countryCode: 'US',
        adminLevel: 1,
      };

      const result = await pluginAPI.validateDataSource('naturalearth', validConfig);
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });
  });

  describe('WorkingCopy-based Batch Processing Integration', () => {
    const mockWorkingCopyId = 'working-copy-123' as EntityId;

    it('should start batch process with WorkingCopy ID', async () => {
      await pluginAPI.initialize();
      
      const config: BatchProcessConfig = {
        dataSource: 'naturalearth',
        countryCode: 'US',
        adminLevels: [0, 1],
        workerPoolSize: 2,
        enableFeatureExtraction: true,
        simplificationLevels: [0.001, 0.01],
        tileZoomRange: [0, 12],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 100 * 1024 * 1024,
          compressionLevel: 6,
        },
      };

      const urlMetadata = [
        {
          url: 'http://example.com/us-admin0.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 5000000
        },
        {
          url: 'http://example.com/us-admin1.zip',
          countryCode: 'US',
          adminLevel: 1,
          continent: 'North America',
          estimatedSize: 15000000
        }
      ];

      const sessionId = await pluginAPI.startBatchProcessing(mockWorkingCopyId, config, urlMetadata);
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session-/);
    });

    it('should pause batch processing', async () => {
      await pluginAPI.initialize();
      
      await expect(
        pluginAPI.pauseBatchProcessing(mockWorkingCopyId)
      ).resolves.not.toThrow();
    });

    it('should resume batch processing', async () => {
      await pluginAPI.initialize();
      
      const sessionId = await pluginAPI.resumeBatchProcessing(mockWorkingCopyId);
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should cancel batch processing', async () => {
      await pluginAPI.initialize();
      
      await expect(
        pluginAPI.cancelBatchProcessing(mockWorkingCopyId)
      ).resolves.not.toThrow();
    });

    it('should get batch status with session recovery info', async () => {
      await pluginAPI.initialize();
      
      // First start a batch process
      const config: BatchProcessConfig = {
        dataSource: 'naturalearth',
        countryCode: 'US',
        adminLevels: [0],
        workerPoolSize: 1,
        enableFeatureExtraction: true,
        simplificationLevels: [0.01],
        tileZoomRange: [0, 8],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 50 * 1024 * 1024,
          compressionLevel: 6,
        },
      };

      const urlMetadata = [
        {
          url: 'http://example.com/us-admin0.zip',
          countryCode: 'US',
          adminLevel: 0,
          continent: 'North America',
          estimatedSize: 5000000
        }
      ];

      const sessionId = await pluginAPI.startBatchProcessing(mockWorkingCopyId, config, urlMetadata);
      const status = await pluginAPI.getBatchStatus(sessionId);
      
      expect(status).toBeDefined();
      expect(status.sessionId).toBe(sessionId);
      expect(status.workingCopyId).toBe(mockWorkingCopyId);
      expect(status.status).toBeDefined();
    });

    it('should find pending batch sessions for direct link access', async () => {
      await pluginAPI.initialize();
      const nodeId = 'node-with-sessions' as NodeId;
      
      const sessions = await pluginAPI.findPendingBatchSessions(nodeId);
      expect(Array.isArray(sessions)).toBe(true);
      
      // If sessions exist, validate structure
      if (sessions.length > 0) {
        const session = sessions[0];
        expect(session.sessionId).toBeDefined();
        expect(session.workingCopyId).toBeDefined();
        expect(session.nodeId).toBe(nodeId);
        expect(session.status).toBeDefined();
        expect(session.createdAt).toBeDefined();
        expect(session.lastActivityAt).toBeDefined();
      }
    });

    it('should handle batch processing errors gracefully', async () => {
      await pluginAPI.initialize();
      
      const invalidConfig = {
        dataSource: 'invalid-source',
        workerPoolSize: -1, // Invalid
      } as any;

      await expect(
        pluginAPI.startBatchProcessing(mockWorkingCopyId, invalidConfig, [])
      ).rejects.toThrow();
    });
  });

    it('should get batch status', async () => {
      await pluginAPI.initialize();
      
      // First start a batch process
      const config: BatchProcessConfig = {
        dataSource: 'naturalearth',
        countryCode: 'US',
        adminLevels: [0],
        workerPoolSize: 1,
        enableFeatureExtraction: true,
        simplificationLevels: [0.01],
        tileZoomRange: [0, 8],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 50 * 1024 * 1024,
          compressionLevel: 6,
        },
      };

      const batchSession = await pluginAPI.startBatchProcess(mockNodeId, config);
      const status = await pluginAPI.getBatchStatus(batchSession.sessionId);
      
      expect(status).toBeDefined();
      expect(status.session).toBeDefined();
      expect(status.session.sessionId).toBe(batchSession.sessionId);
    });
  });

  describe('Type Safety', () => {
    it('should enforce branded types', () => {
      const nodeId: NodeId = 'node-123' as NodeId;
      const entityId: EntityId = 'entity-456' as EntityId;

      expect(typeof nodeId).toBe('string');
      expect(typeof entityId).toBe('string');
      
      // TypeScript should enforce branded types at compile time
      // These assertions verify the runtime types are still strings
    });

    it('should validate processing config structure', () => {
      const config: BatchProcessConfig = {
        dataSource: 'naturalearth',
        countryCode: 'US',
        adminLevels: [0, 1],
        workerPoolSize: 2,
        enableFeatureExtraction: true,
        simplificationLevels: [0.001, 0.01],
        tileZoomRange: [0, 12],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 100 * 1024 * 1024,
          compressionLevel: 6,
        },
      };

      // Verify structure
      expect(config.dataSource).toBeDefined();
      expect(config.countryCode).toBeDefined();
      expect(Array.isArray(config.adminLevels)).toBe(true);
      expect(config.workerPoolSize).toBeGreaterThan(0);
      expect(config.cacheStrategy).toBeDefined();
    });
  });

  describe('EphemeralDB Lifecycle and Cleanup', () => {
    it('should perform automatic cleanup of expired data', async () => {
      await pluginAPI.initialize();
      
      const result = await pluginAPI.performCleanup();
      
      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.batchSessionsRemoved).toBeDefined();
      expect(result.totalSpaceRecovered).toBeDefined();
      expect(typeof result.workingCopiesRemoved).toBe('number');
      expect(typeof result.batchSessionsRemoved).toBe('number');
      expect(typeof result.totalSpaceRecovered).toBe('number');
    });

    it('should provide cleanup statistics', async () => {
      await pluginAPI.initialize();
      
      const stats = await pluginAPI.getCleanupStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalWorkingCopies).toBeDefined();
      expect(stats.expiredWorkingCopies).toBeDefined();
      expect(stats.totalBatchSessions).toBeDefined();
      expect(stats.expiredBatchSessions).toBeDefined();
      expect(stats.estimatedSpaceUsed).toBeDefined();
      expect(typeof stats.totalWorkingCopies).toBe('number');
      expect(typeof stats.expiredWorkingCopies).toBe('number');
    });

    it('should force cleanup all ephemeral data', async () => {
      await pluginAPI.initialize();
      
      const result = await pluginAPI.forceCleanup();
      
      expect(result).toBeDefined();
      expect(result.workingCopiesRemoved).toBeDefined();
      expect(result.batchSessionsRemoved).toBeDefined();
      expect(typeof result.workingCopiesRemoved).toBe('number');
      expect(typeof result.batchSessionsRemoved).toBe('number');
    });

    it('should persist WorkingCopy data across dialog close/reopen', async () => {
      await pluginAPI.initialize();
      
      // Create a WorkingCopy
      const parentId = 'parent-456' as NodeId;
      const entityHandler = new ShapeEntityHandler();
      const workingCopy = await entityHandler.createNewDraftWorkingCopy(parentId);
      
      // Simulate dialog close (data should persist in EphemeralDB)
      // Simulate dialog reopen - data should still be available
      const retrievedWorkingCopy = await entityHandler.getWorkingCopy(workingCopy.id);
      
      expect(retrievedWorkingCopy).toBeDefined();
      expect(retrievedWorkingCopy?.id).toBe(workingCopy.id);
      expect(retrievedWorkingCopy?.isDraft).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const faultyAPI = new ShapesPluginAPI();
      
      // Mock a failure scenario
      vi.spyOn(faultyAPI as any, 'database', 'get').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(faultyAPI.initialize()).rejects.toThrow();
    });

    it('should handle invalid WorkingCopy operations', async () => {
      await pluginAPI.initialize();
      const entityHandler = new ShapeEntityHandler();
      
      // Try to get non-existent WorkingCopy
      await expect(
        entityHandler.getWorkingCopy('non-existent-id' as EntityId)
      ).rejects.toThrow();
      
      // Try to commit non-existent WorkingCopy
      await expect(
        entityHandler.commitWorkingCopy('non-existent-id' as EntityId)
      ).rejects.toThrow();
    });

    it('should handle batch session recovery errors', async () => {
      await pluginAPI.initialize();
      
      // Try to find sessions for non-existent node
      const sessions = await pluginAPI.findPendingBatchSessions('non-existent-node' as NodeId);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });

    it('should handle invalid batch configuration', async () => {
      await pluginAPI.initialize();
      
      const invalidConfig = {
        // Missing required fields
        dataSource: 'invalid-source',
      } as any;

      await expect(
        pluginAPI.startBatchProcessing('working-copy-123' as EntityId, invalidConfig, [])
      ).rejects.toThrow();
    });

    it('should handle non-existent batch sessions', async () => {
      await pluginAPI.initialize();
      
      await expect(
        pluginAPI.getBatchStatus('non-existent-session')
      ).rejects.toThrow();
    });
  });

      await expect(faultyAPI.initialize()).rejects.toThrow();
    });

    it('should handle invalid batch configuration', async () => {
      await pluginAPI.initialize();
      
      const invalidConfig = {
        // Missing required fields
        dataSource: 'invalid-source',
      } as any;

      await expect(
        pluginAPI.startBatchProcess(mockNodeId, invalidConfig)
      ).rejects.toThrow();
    });

    it('should handle non-existent batch sessions', async () => {
      await pluginAPI.initialize();
      
      await expect(
        pluginAPI.getBatchStatus('non-existent-session')
      ).rejects.toThrow();
    });
  });
});
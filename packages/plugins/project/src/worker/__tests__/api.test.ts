/**
 * Project Worker API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { projectPluginAPI } from '../api';
import { NodeId } from '@hierarchidb/00-core';
import { CreateProjectData } from '../../shared';

// Mock ProjectEntityHandler
vi.mock('../handlers/ProjectEntityHandler', () => ({
  ProjectEntityHandler: vi.fn().mockImplementation(() => ({
    createEntity: vi.fn(),
    getEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    addResourceReference: vi.fn(),
    removeResourceReference: vi.fn(),
    getResourceReferences: vi.fn(),
    configureLayer: vi.fn(),
    getLayerConfiguration: vi.fn(),
    removeLayerConfiguration: vi.fn(),
    aggregateProject: vi.fn(),
    getAggregationStatus: vi.fn(),
    getProjectStatistics: vi.fn()
  }))
}));

import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';

describe('Project Worker API', () => {
  const mockNodeId = 'test-node-id' as NodeId;
  let mockHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = new (ProjectEntityHandler as any)();
  });

  describe('API structure', () => {
    it('should have correct node type', () => {
      expect(projectPluginAPI.nodeType).toBe('project');
    });

    it('should have all required methods', () => {
      const expectedMethods = [
        'createEntity',
        'getEntity',
        'updateEntity',
        'deleteEntity',
        'addResourceReference',
        'removeResourceReference',
        'getResourceReferences',
        'configureLayer',
        'getLayerConfiguration',
        'removeLayerConfiguration',
        'aggregateProject',
        'getAggregationStatus',
        'getProjectStatistics'
      ];

      expectedMethods.forEach(method => {
        expect(projectPluginAPI.methods).toHaveProperty(method);
        expect(typeof projectPluginAPI.methods[method]).toBe('function');
      });
    });
  });

  describe('createEntity method', () => {
    it('should call ProjectEntityHandler.createEntity', async () => {
      const createData: CreateProjectData = {
        name: 'Test Project',
        description: 'Test Description'
      };

      const mockEntity = {
        id: 'mock-entity-id',
        nodeId: mockNodeId,
        name: 'Test Project'
      };

      mockHandler.createEntity.mockResolvedValue(mockEntity);

      const result = await projectPluginAPI.methods.createEntity(mockNodeId, createData);

      expect(mockHandler.createEntity).toHaveBeenCalledWith(mockNodeId, createData);
      expect(result).toEqual(mockEntity);
    });
  });

  describe('getEntity method', () => {
    it('should call ProjectEntityHandler.getEntity', async () => {
      const mockEntity = {
        id: 'mock-entity-id',
        nodeId: mockNodeId,
        name: 'Test Project'
      };

      mockHandler.getEntity.mockResolvedValue(mockEntity);

      const result = await projectPluginAPI.methods.getEntity(mockNodeId);

      expect(mockHandler.getEntity).toHaveBeenCalledWith(mockNodeId);
      expect(result).toEqual(mockEntity);
    });
  });

  describe('updateEntity method', () => {
    it('should call ProjectEntityHandler.updateEntity', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated Description'
      };

      mockHandler.updateEntity.mockResolvedValue(undefined);

      await projectPluginAPI.methods.updateEntity(mockNodeId, updateData);

      expect(mockHandler.updateEntity).toHaveBeenCalledWith(mockNodeId, updateData);
    });
  });

  describe('deleteEntity method', () => {
    it('should call ProjectEntityHandler.deleteEntity', async () => {
      mockHandler.deleteEntity.mockResolvedValue(undefined);

      await projectPluginAPI.methods.deleteEntity(mockNodeId);

      expect(mockHandler.deleteEntity).toHaveBeenCalledWith(mockNodeId);
    });
  });

  describe('resource reference methods', () => {
    const resourceNodeId = 'resource-123' as NodeId;

    it('should handle addResourceReference', async () => {
      mockHandler.addResourceReference.mockResolvedValue(undefined);

      await projectPluginAPI.methods.addResourceReference(mockNodeId, resourceNodeId);

      expect(mockHandler.addResourceReference).toHaveBeenCalledWith(mockNodeId, resourceNodeId);
    });

    it('should handle removeResourceReference', async () => {
      mockHandler.removeResourceReference.mockResolvedValue(undefined);

      await projectPluginAPI.methods.removeResourceReference(mockNodeId, resourceNodeId);

      expect(mockHandler.removeResourceReference).toHaveBeenCalledWith(mockNodeId, resourceNodeId);
    });

    it('should handle getResourceReferences', async () => {
      const mockReferences = ['resource-1', 'resource-2'] as NodeId[];
      mockHandler.getResourceReferences.mockResolvedValue(mockReferences);

      const result = await projectPluginAPI.methods.getResourceReferences(mockNodeId);

      expect(mockHandler.getResourceReferences).toHaveBeenCalledWith(mockNodeId);
      expect(result).toEqual(mockReferences);
    });
  });

  describe('layer configuration methods', () => {
    const resourceNodeId = 'resource-123' as NodeId;
    const layerConfig = {
      layerId: 'layer-123',
      layerType: 'vector' as const,
      layerOrder: 1,
      isVisible: true,
      opacity: 1,
      styleConfig: {
        source: {
          type: 'vector' as const,
          url: 'test://source'
        }
      },
      interactionConfig: {
        clickable: true,
        hoverable: true
      }
    };

    it('should handle configureLayer', async () => {
      mockHandler.configureLayer.mockResolvedValue(undefined);

      await projectPluginAPI.methods.configureLayer(mockNodeId, resourceNodeId, layerConfig);

      expect(mockHandler.configureLayer).toHaveBeenCalledWith(mockNodeId, resourceNodeId, layerConfig);
    });

    it('should handle getLayerConfiguration', async () => {
      mockHandler.getLayerConfiguration.mockResolvedValue(layerConfig);

      const result = await projectPluginAPI.methods.getLayerConfiguration(mockNodeId, resourceNodeId);

      expect(mockHandler.getLayerConfiguration).toHaveBeenCalledWith(mockNodeId, resourceNodeId);
      expect(result).toEqual(layerConfig);
    });

    it('should handle removeLayerConfiguration', async () => {
      mockHandler.removeLayerConfiguration.mockResolvedValue(undefined);

      await projectPluginAPI.methods.removeLayerConfiguration(mockNodeId, resourceNodeId);

      expect(mockHandler.removeLayerConfiguration).toHaveBeenCalledWith(mockNodeId, resourceNodeId);
    });
  });

  describe('aggregation methods', () => {
    it('should handle aggregateProject', async () => {
      const mockAggregationResult = {
        projectNodeId: mockNodeId,
        layers: [],
        metadata: {
          aggregationId: 'agg-123',
          totalResources: 0,
          totalLayers: 0,
          aggregationTime: 100
        },
        statistics: {
          resourcesLoaded: 0,
          layersComposed: 0,
          totalDataSize: 0
        }
      };

      mockHandler.aggregateProject.mockResolvedValue(mockAggregationResult);

      const result = await projectPluginAPI.methods.aggregateProject(mockNodeId);

      expect(mockHandler.aggregateProject).toHaveBeenCalledWith(mockNodeId);
      expect(result).toEqual(mockAggregationResult);
    });

    it('should handle getAggregationStatus', async () => {
      const mockStatus = {
        status: 'completed' as const,
        lastAggregated: Date.now(),
        resourceCount: 3,
        layerCount: 2,
        hasErrors: false,
        errorMessages: []
      };

      mockHandler.getAggregationStatus.mockResolvedValue(mockStatus);

      const result = await projectPluginAPI.methods.getAggregationStatus(mockNodeId);

      expect(mockHandler.getAggregationStatus).toHaveBeenCalledWith(mockNodeId);
      expect(result).toEqual(mockStatus);
    });

    it('should handle getProjectStatistics', async () => {
      const mockStats = {
        totalReferences: 3,
        validReferences: 2,
        totalLayers: 2,
        visibleLayers: 1,
        lastAggregated: Date.now(),
        exportCount: 0
      };

      mockHandler.getProjectStatistics.mockResolvedValue(mockStats);

      const result = await projectPluginAPI.methods.getProjectStatistics(mockNodeId);

      expect(mockHandler.getProjectStatistics).toHaveBeenCalledWith(mockNodeId);
      expect(result).toEqual(mockStats);
    });
  });
});
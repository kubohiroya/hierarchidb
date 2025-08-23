/**
 * ProjectEntityHandler tests for Worker layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
import { NodeId, generateEntityId } from '@hierarchidb/00-core';
import { CreateProjectData, DEFAULT_MAP_CONFIG, DEFAULT_RENDER_CONFIG } from '../../shared';

// Mock the BaseEntityHandler
vi.mock('@hierarchidb/worker', () => ({
  BaseEntityHandler: class MockBaseEntityHandler {
    protected table = {
      add: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
          delete: vi.fn(),
          modify: vi.fn()
        }))
      }))
    };
    
    constructor(tableName: string) {
      // Mock constructor
    }
  }
}));

// Mock generateEntityId
vi.mock('@hierarchidb/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/core')>();
  return {
    ...actual,
    generateEntityId: vi.fn(() => 'mock-entity-id' as any)
  };
});

describe('ProjectEntityHandler', () => {
  let handler: ProjectEntityHandler;
  const mockNodeId = 'test-node-id' as NodeId;

  beforeEach(() => {
    handler = new ProjectEntityHandler();
    vi.clearAllMocks();
  });

  describe('createEntity', () => {
    it('should create project entity with required fields', async () => {
      const createData: CreateProjectData = {
        name: 'Test Project',
        description: 'Test Description'
      };

      const result = await handler.createEntity(mockNodeId, createData);

      expect(result).toMatchObject({
        id: 'mock-entity-id',
        nodeId: mockNodeId,
        name: 'Test Project',
        description: 'Test Description',
        mapConfig: DEFAULT_MAP_CONFIG,
        renderConfig: DEFAULT_RENDER_CONFIG,
        layerConfigurations: {},
        exportConfigurations: [],
        version: 1
      });

      expect(result.createdAt).toBeTypeOf('number');
      expect(result.updatedAt).toBeTypeOf('number');
      expect(handler.table.add).toHaveBeenCalledWith(result);
    });

    it('should throw error when name is missing', async () => {
      const createData: CreateProjectData = {
        name: '', // Empty name
        description: 'Test Description'
      };

      await expect(handler.createEntity(mockNodeId, createData))
        .rejects.toThrow('Project name is required');
    });

    it('should merge partial map config', async () => {
      const createData: CreateProjectData = {
        name: 'Test Project',
        mapConfig: {
          zoom: 15 // Override default zoom
        }
      };

      const result = await handler.createEntity(mockNodeId, createData);

      expect(result.mapConfig).toEqual({
        ...DEFAULT_MAP_CONFIG,
        zoom: 15
      });
    });

    it('should merge partial render config', async () => {
      const createData: CreateProjectData = {
        name: 'Test Project',
        renderConfig: {
          maxZoom: 20 // Override default maxZoom
        }
      };

      const result = await handler.createEntity(mockNodeId, createData);

      expect(result.renderConfig).toEqual({
        ...DEFAULT_RENDER_CONFIG,
        maxZoom: 20
      });
    });

    it('should include initial layer configurations', async () => {
      const layerConfigurations = {
        'resource-1': {
          layerId: 'layer-1',
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
        }
      };

      const createData: CreateProjectData = {
        name: 'Test Project',
        layerConfigurations
      };

      const result = await handler.createEntity(mockNodeId, createData);

      expect(result.layerConfigurations).toEqual(layerConfigurations);
    });
  });

  describe('getEntity', () => {
    it('should call table.where with nodeId', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockEquals = vi.fn().mockReturnValue({ first: mockFirst });
      const mockWhere = vi.fn().mockReturnValue({ equals: mockEquals });
      
      handler.table.where = mockWhere;

      await handler.getEntity(mockNodeId);

      expect(mockWhere).toHaveBeenCalledWith('nodeId');
      expect(mockEquals).toHaveBeenCalledWith(mockNodeId);
      expect(mockFirst).toHaveBeenCalled();
    });
  });

  describe('updateEntity', () => {
    it('should update entity with new data', async () => {
      const mockEntity = {
        id: 'mock-entity-id',
        nodeId: mockNodeId,
        name: 'Old Name',
        mapConfig: DEFAULT_MAP_CONFIG,
        renderConfig: DEFAULT_RENDER_CONFIG,
        version: 1
      };

      const mockFirst = vi.fn().mockResolvedValue(mockEntity);
      const mockModify = vi.fn();
      const mockEquals = vi.fn().mockReturnValue({ 
        first: mockFirst,
        modify: mockModify
      });
      const mockWhere = vi.fn().mockReturnValue({ equals: mockEquals });
      
      handler.table.where = mockWhere;

      const updateData = {
        name: 'New Name',
        description: 'New Description'
      };

      await handler.updateEntity(mockNodeId, updateData);

      expect(mockModify).toHaveBeenCalledWith({
        name: 'New Name',
        description: 'New Description',
        updatedAt: expect.any(Number),
        version: 2
      });
    });

    it('should throw error when entity not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockEquals = vi.fn().mockReturnValue({ first: mockFirst });
      const mockWhere = vi.fn().mockReturnValue({ equals: mockEquals });
      
      handler.table.where = mockWhere;

      await expect(handler.updateEntity(mockNodeId, { name: 'New Name' }))
        .rejects.toThrow(`Project not found: ${mockNodeId}`);
    });
  });

  describe('deleteEntity', () => {
    it('should delete entity by nodeId', async () => {
      const mockDelete = vi.fn();
      const mockEquals = vi.fn().mockReturnValue({ delete: mockDelete });
      const mockWhere = vi.fn().mockReturnValue({ equals: mockEquals });
      
      handler.table.where = mockWhere;

      await handler.deleteEntity(mockNodeId);

      expect(mockWhere).toHaveBeenCalledWith('nodeId');
      expect(mockEquals).toHaveBeenCalledWith(mockNodeId);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('configureLayer', () => {
    it('should add layer configuration to project', async () => {
      const mockEntity = {
        id: 'mock-entity-id',
        nodeId: mockNodeId,
        layerConfigurations: {},
        updatedAt: Date.now() - 1000,
        version: 1
      };

      const mockFirst = vi.fn().mockResolvedValue(mockEntity);
      const mockModify = vi.fn();
      const mockEquals = vi.fn().mockReturnValue({ 
        first: mockFirst,
        modify: mockModify 
      });
      const mockWhere = vi.fn().mockReturnValue({ equals: mockEquals });
      
      handler.table.where = mockWhere;

      const resourceNodeId = 'resource-123' as NodeId;
      const layerConfig = {
        layerId: 'layer-123',
        layerType: 'vector' as const,
        layerOrder: 1,
        isVisible: true,
        opacity: 0.8,
        styleConfig: {
          source: {
            type: 'vector' as const,
            url: 'test://source'
          }
        },
        interactionConfig: {
          clickable: true,
          hoverable: false
        }
      };

      await handler.configureLayer(mockNodeId, resourceNodeId, layerConfig);

      expect(mockModify).toHaveBeenCalledWith({
        layerConfigurations: {
          [resourceNodeId]: layerConfig
        },
        updatedAt: expect.any(Number),
        version: 2
      });
    });
  });
});
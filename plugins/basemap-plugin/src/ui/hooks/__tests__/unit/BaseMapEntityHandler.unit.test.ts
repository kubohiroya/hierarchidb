import type { NodeId } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseMapEntityHandler } from '../../handlers/BaseMapEntityHandler.js';
import type { BaseMapEntity } from '../../types/BaseMapEntity.js';

// Mock the FolderEntityHandler since BaseMapEntityHandler extends it
vi.mock('@hierarchidb/folder-plugin', () => ({
  FolderEntityHandler: class {
    async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>) {
      return {
        id: crypto.randomUUID(),
        nodeId,
        name: data?.name || 'New Folder',
        description: data?.description || '',
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name',
        },
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
    }

    async updateEntity() {}

    async deleteEntity() {}

    async getEntity() {}

    async createWorkingCopy() {}

    async commitWorkingCopy() {}

    async discardWorkingCopy() {}

    async cleanup() {}
  },
}));

describe('BaseMapEntityHandler', () => {
  let handler: BaseMapEntityHandler;
  let testNodeId: NodeId;

  beforeEach(async () => {
    handler = new BaseMapEntityHandler();
    testNodeId = 'test-basemap-123' as NodeId;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await handler.deleteEntity(testNodeId);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createEntity', () => {
    it('should create a BaseMap entity with default values', async () => {
      const entity = await handler.createEntity(testNodeId);

      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('New BaseMap');
      expect(entity.mapStyle.style).toBe('streets');
      expect(entity.viewport.center).toEqual([0, 0]);
      expect(entity.viewport.zoom).toBe(2);
      expect(entity.displayOptions.showLabels).toBe(true);
      expect(entity.displayOptions.show3dBuildings).toBe(false);
      expect(entity.version).toBe(1);
    });

    it('should create a BaseMap entity with custom data', async () => {
      const customData: Partial<BaseMapEntity> = {
        name: 'Tokyo Streets',
        description: 'Tokyo street map configuration',
        mapStyle: {
          style: 'terrain',
        },
        viewport: {
          center: [139.6917, 35.6895], // Tokyo
          zoom: 12,
          bearing: 45,
          pitch: 15,
        },
        displayOptions: {
          show3dBuildings: true,
          showTraffic: true,
          showTransit: false,
          showTerrain: true,
          showLabels: true,
          tags: ['tokyo', 'streets'],
        },
      };

      const entity = await handler.createEntity(testNodeId, customData);

      expect(entity.name).toBe('Tokyo Streets');
      expect(entity.description).toBe('Tokyo street map configuration');
      expect(entity.mapStyle.style).toBe('terrain');
      expect(entity.viewport.center).toEqual([139.6917, 35.6895]);
      expect(entity.viewport.zoom).toBe(12);
      expect(entity.viewport.bearing).toBe(45);
      expect(entity.viewport.pitch).toBe(15);
      expect(entity.displayOptions.show3dBuildings).toBe(true);
      expect(entity.displayOptions.showTraffic).toBe(true);
      expect(entity.displayOptions.tags).toEqual(['tokyo', 'streets']);
    });

    it('should create entity with custom style URL when style is custom', async () => {
      const customData: Partial<BaseMapEntity> = {
        name: 'Custom Style Map',
        mapStyle: {
          style: 'custom',
          customStyleUrl: 'https://api.mapbox.com/styles/v1/custom-style',
          customStyleConfig: {
            attribution: 'Custom Map Style',
            sprite: 'https://api.mapbox.com/sprites/custom',
            glyphs: 'https://api.mapbox.com/fonts/custom/{fontstack}/{range}.pbf',
          },
        },
      };

      const entity = await handler.createEntity(testNodeId, customData);

      expect(entity.mapStyle.style).toBe('custom');
      expect(entity.mapStyle.customStyleUrl).toBe('https://api.mapbox.com/styles/v1/custom-style');
      expect(entity.mapStyle.customStyleConfig?.attribution).toBe('Custom Map Style');
    });
  });

  describe('updateEntity', () => {
    it('should update BaseMap-specific fields', async () => {
      // Create initial entity
      await handler.createEntity(testNodeId, {
        name: 'Original Map',
      });

      // Update BaseMap-specific fields
      await handler.updateEntity(testNodeId, {
        name: 'Updated Map',
        mapStyle: {
          style: 'satellite',
        },
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 15,
          bearing: 0,
          pitch: 0,
        },
        displayOptions: {
          show3dBuildings: true,
          showTraffic: false,
          showTransit: true,
          showTerrain: false,
          showLabels: true,
        },
      });

      const updatedEntity = await handler.getEntity(testNodeId);
      expect(updatedEntity?.name).toBe('Updated Map');
      expect(updatedEntity?.mapStyle.style).toBe('satellite');
      expect(updatedEntity?.viewport.zoom).toBe(15);
      expect(updatedEntity?.displayOptions.show3dBuildings).toBe(true);
      expect(updatedEntity?.displayOptions.showTransit).toBe(true);
      expect(updatedEntity?.version).toBe(2);
    });
  });

  describe('working copy operations', () => {
    it('should create and commit working copy for new BaseMap', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId);

      expect(workingCopy.nodeId).toBe(testNodeId);
      expect(workingCopy.isDraft).toBe(true);
      expect(workingCopy.mapStyle.style).toBe('streets');
      expect(workingCopy.viewport.center).toEqual([0, 0]);

      // Update working copy
      workingCopy.name = 'Test BaseMap Working Copy';
      workingCopy.mapStyle.style = 'dark';
      workingCopy.viewport.zoom = 8;

      await handler.commitWorkingCopy(testNodeId, workingCopy);

      const committedEntity = await handler.getEntity(testNodeId);
      expect(committedEntity?.name).toBe('Test BaseMap Working Copy');
      expect(committedEntity?.mapStyle.style).toBe('dark');
      expect(committedEntity?.viewport.zoom).toBe(8);
    });

    it('should create and discard working copy', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId);
      expect(workingCopy.isDraft).toBe(true);

      await handler.discardWorkingCopy(testNodeId);

      // Verify entity was not created
      const entity = await handler.getEntity(testNodeId);
      expect(entity).toBeUndefined();
    });

    it('should create working copy from existing entity', async () => {
      // Create existing entity
      const originalEntity = await handler.createEntity(testNodeId, {
        name: 'Existing Map',
        mapStyle: { style: 'terrain' },
        viewport: { center: [100, 50], zoom: 10, bearing: 0, pitch: 0 },
      });

      const workingCopy = await handler.createWorkingCopy(testNodeId);

      expect(workingCopy.nodeId).toBe(testNodeId);
      expect(workingCopy.isDraft).toBe(true);
      expect(workingCopy.originalId).toBe(originalEntity.id);
      expect(workingCopy.name).toBe('Existing Map');
      expect(workingCopy.mapStyle.style).toBe('terrain');
      expect(workingCopy.viewport.center).toEqual([100, 50]);
    });
  });

  describe('BaseMap-specific methods', () => {
    it('should update map style', async () => {
      await handler.createEntity(testNodeId);

      const newMapStyle = {
        style: 'custom' as const,
        customStyleUrl: 'https://example.com/style.json',
      };

      await handler.updateMapStyle(testNodeId, newMapStyle);

      const entity = await handler.getEntity(testNodeId);
      expect(entity?.mapStyle.style).toBe('custom');
      expect(entity?.mapStyle.customStyleUrl).toBe('https://example.com/style.json');
    });

    it('should update viewport', async () => {
      await handler.createEntity(testNodeId);

      const newViewport = {
        center: [139.6917, 35.6895] as [number, number],
        zoom: 15,
        bearing: 90,
        pitch: 30,
      };

      await handler.updateViewport(testNodeId, newViewport);

      const entity = await handler.getEntity(testNodeId);
      expect(entity?.viewport.center).toEqual([139.6917, 35.6895]);
      expect(entity?.viewport.zoom).toBe(15);
      expect(entity?.viewport.bearing).toBe(90);
      expect(entity?.viewport.pitch).toBe(30);
    });

    it('should update display options', async () => {
      await handler.createEntity(testNodeId);

      const newDisplayOptions = {
        show3dBuildings: true,
        showTraffic: true,
        showTransit: false,
        showTerrain: true,
        showLabels: false,
        attribution: 'Custom Attribution',
        tags: ['custom', 'map'],
      };

      await handler.updateDisplayOptions(testNodeId, newDisplayOptions);

      const entity = await handler.getEntity(testNodeId);
      expect(entity?.displayOptions.show3dBuildings).toBe(true);
      expect(entity?.displayOptions.showTraffic).toBe(true);
      expect(entity?.displayOptions.showLabels).toBe(false);
      expect(entity?.displayOptions.attribution).toBe('Custom Attribution');
      expect(entity?.displayOptions.tags).toEqual(['custom', 'map']);
    });

    it('should get configuration for export', async () => {
      await handler.createEntity(testNodeId, {
        mapStyle: { style: 'satellite' },
        viewport: { center: [0, 0], zoom: 5, bearing: 45, pitch: 30 },
        //displayOptions: { show3dBuildings: true, showLabels: false },
      });

      const config = await handler.getConfiguration(testNodeId);

      expect(config).toBeDefined();
      expect(config?.mapStyle.style).toBe('satellite');
      expect(config?.viewport.zoom).toBe(5);
      expect(config?.viewport.bearing).toBe(45);
      expect(config?.displayOptions.show3dBuildings).toBe(true);
      expect(config?.displayOptions.showLabels).toBe(false);
    });

    it('should return null configuration for non-existent entity', async () => {
      const config = await handler.getConfiguration('non-existent' as NodeId);
      expect(config).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate correct BaseMap configuration', async () => {
      const validConfig: Partial<BaseMapEntity> = {
        mapStyle: {
          style: 'streets',
        },
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 12,
          bearing: 45,
          pitch: 15,
        },
      };

      const result = await handler.validateConfiguration(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate custom style with URL', async () => {
      const validConfig: Partial<BaseMapEntity> = {
        mapStyle: {
          style: 'custom',
          customStyleUrl: 'https://api.mapbox.com/styles/v1/custom',
        },
      };

      const result = await handler.validateConfiguration(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid map style', async () => {
      const invalidConfig: Partial<BaseMapEntity> = {
        mapStyle: {
          style: 'invalid-style' as unknown as BaseMapEntity['mapStyle']['style'],
        },
      };

      const result = await handler.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid map style');
    });

    it('should reject custom style without URL', async () => {
      const invalidConfig: Partial<BaseMapEntity> = {
        mapStyle: {
          style: 'custom',
          // Missing customStyleUrl
        },
      };

      const result = await handler.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Custom style URL is required when using custom style');
    });

    it('should reject invalid coordinates', async () => {
      const invalidConfig: Partial<BaseMapEntity> = {
        viewport: {
          center: [200, 100], // Invalid longitude/latitude
          zoom: 12,
          bearing: 0,
          pitch: 0,
        },
      };

      const result = await handler.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Longitude must be a number between -180 and 180');
      expect(result.errors).toContain('Latitude must be a number between -90 and 90');
    });

    it('should reject invalid zoom level', async () => {
      const invalidConfig: Partial<BaseMapEntity> = {
        viewport: {
          center: [0, 0],
          zoom: 30, // Invalid zoom
          bearing: 0,
          pitch: 0,
        },
      };

      const result = await handler.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zoom must be a number between 0 and 24');
    });

    it('should reject invalid bearing and pitch', async () => {
      const invalidConfig: Partial<BaseMapEntity> = {
        viewport: {
          center: [0, 0],
          zoom: 10,
          bearing: 400, // Invalid bearing
          pitch: 80, // Invalid pitch
        },
      };

      const result = await handler.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bearing must be a number between 0 and 360');
      expect(result.errors).toContain('Pitch must be a number between 0 and 60');
    });
  });

  describe('search operations', () => {
    beforeEach(async () => {
      // Create test data
      await handler.createEntity('map1' as NodeId, {
        name: 'Tokyo Streets',
        mapStyle: { style: 'streets' },
        //displayOptions: { tags: ['tokyo', 'japan'] },
      });

      await handler.createEntity('map2' as NodeId, {
        name: 'New York Satellite',
        mapStyle: { style: 'satellite' },
        //displayOptions: { tags: ['newyork', 'usa'] },
      });

      await handler.createEntity('map3' as NodeId, {
        name: 'London Terrain',
        mapStyle: { style: 'terrain' },
        //displayOptions: { tags: ['london', 'uk'] },
      });
    });

    afterEach(async () => {
      // Clean up test data
      try {
        await handler.deleteEntity('map1' as NodeId);
        await handler.deleteEntity('map2' as NodeId);
        await handler.deleteEntity('map3' as NodeId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should search BaseMaps by name', async () => {
      const results = await handler.searchBaseMaps({ name: 'tokyo' });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Tokyo Streets');
    });

    it('should search BaseMaps by map style', async () => {
      const results = await handler.searchBaseMaps({ mapStyle: 'satellite' });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('New York Satellite');
    });

    it('should search BaseMaps by tags', async () => {
      const results = await handler.searchBaseMaps({ tags: ['japan'] });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Tokyo Streets');
    });

    it('should return empty array when no matches found', async () => {
      const results = await handler.searchBaseMaps({ name: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });
});

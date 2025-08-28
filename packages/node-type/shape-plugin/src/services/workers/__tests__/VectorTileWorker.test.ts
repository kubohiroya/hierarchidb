/**
 * VectorTileWorker Unit Tests
 * 
 * Tests for Mapbox Vector Tile generation from TopoJSON data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorTileWorker } from '../VectorTileWorker';
import type { VectorTileTask, TopoJSONTopology, TileCoordinate, TileMetadata } from '../../types';

describe('VectorTileWorker', () => {
  let worker: VectorTileWorker;

  beforeEach(() => {
    worker = new VectorTileWorker();
  });

  describe('generateVectorTile', () => {
    it('should successfully generate MVT from TopoJSON', async () => {
      // Arrange
      const task: VectorTileTask = {
        taskId: 'test-vector-tile-1',
        sessionId: 'session-1',
        type: 'vectorTile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        inputBufferId: 'buffer-1',
        config: {
          tileSize: 256,
          buffer: 64,
          extent: 4096,
          minZoom: 0,
          maxZoom: 14,
          layerConfig: {
            'admin_1': {
              minZoom: 0,
              maxZoom: 10,
              properties: ['name', 'admin_level']
            },
            'admin_2': {
              minZoom: 8,
              maxZoom: 14,
              properties: ['name', 'admin_level', 'population']
            }
          }
        },
        tileCoords: { z: 10, x: 512, y: 256 }
      };

      // Act
      const result = await worker.generateVectorTile(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.tileData).toBeDefined();
      expect(result.tileData.byteLength).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.layers).toBeDefined();
      expect(result.metadata.layers.length).toBeGreaterThan(0);
      expect(result.generationTime).toBeGreaterThan(0);
    });

    it('should handle tile generation failures gracefully', async () => {
      // Arrange
      const task: VectorTileTask = {
        taskId: 'test-vector-tile-fail',
        sessionId: 'session-1',
        type: 'vectorTile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        inputBufferId: 'invalid-buffer',
        config: {
          tileSize: 256,
          buffer: 64,
          extent: 4096
        },
        tileCoords: { z: 10, x: 512, y: 256 }
      };

      // Act
      const result = await worker.generateVectorTile(task);

      // Assert - Worker should handle missing buffer gracefully
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });

    it('should generate tiles at different zoom levels', async () => {
      // Arrange
      const lowZoomTask: VectorTileTask = {
        taskId: 'test-low-zoom',
        sessionId: 'session-1',
        type: 'vectorTile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        inputBufferId: 'buffer-1',
        config: {
          tileSize: 256,
          buffer: 64,
          extent: 4096,
          minZoom: 0,
          maxZoom: 14
        },
        tileCoords: { z: 2, x: 1, y: 1 }
      };

      const highZoomTask: VectorTileTask = {
        taskId: 'test-high-zoom',
        sessionId: 'session-1',
        type: 'vectorTile',
        status: 'running',
        index: 1,
        progress: 0,
        taskType: 'vectorTile',
        inputBufferId: 'buffer-1',
        config: {
          tileSize: 256,
          buffer: 64,
          extent: 4096,
          minZoom: 0,
          maxZoom: 14
        },
        tileCoords: { z: 12, x: 2048, y: 1024 }
      };

      // Act
      const lowZoomResult = await worker.generateVectorTile(lowZoomTask);
      const highZoomResult = await worker.generateVectorTile(highZoomTask);

      // Assert
      expect(lowZoomResult.status).toBe('completed');
      expect(highZoomResult.status).toBe('completed');
      expect(lowZoomResult.metadata.z).toBe(2);
      expect(highZoomResult.metadata.z).toBe(12);
    });
  });

  describe('tileCoordinateTransform', () => {
    it('should transform geographic coordinates to tile coordinates', async () => {
      // Arrange
      const tileCoords: TileCoordinate = { z: 10, x: 512, y: 256 };
      const extent = 4096;
      
      // Geographic coordinates (longitude, latitude)
      const geoCoords: [number, number] = [139.6917, 35.6895]; // Tokyo

      // Act
      const tilePixelCoords = await worker.transformCoordinates(geoCoords, tileCoords, extent);

      // Assert
      expect(tilePixelCoords).toHaveLength(2);
      expect(tilePixelCoords[0]).toBeGreaterThanOrEqual(0);
      expect(tilePixelCoords[0]).toBeLessThanOrEqual(extent);
      expect(tilePixelCoords[1]).toBeGreaterThanOrEqual(0);
      expect(tilePixelCoords[1]).toBeLessThanOrEqual(extent);
    });

    it('should handle coordinate transformation at different zoom levels', async () => {
      // Arrange
      const geoCoords: [number, number] = [0, 0]; // Equator, Greenwich
      const extent = 4096;

      // Act
      const zoom0 = await worker.transformCoordinates(geoCoords, { z: 0, x: 0, y: 0 }, extent);
      const zoom10 = await worker.transformCoordinates(geoCoords, { z: 10, x: 512, y: 512 }, extent);

      // Assert
      expect(zoom0).toHaveLength(2);
      expect(zoom10).toHaveLength(2);
      // Coordinates should be at tile center for (0,0) geographic coordinates
      expect(zoom0[0]).toBeCloseTo(extent / 2, 0);
      expect(zoom0[1]).toBeCloseTo(extent / 2, 0);
    });
  });

  describe('validateTileData', () => {
    it('should validate correct MVT data', async () => {
      // Arrange - Mock valid MVT buffer
      const validMVTData = new Uint8Array([0x1a, 0x02, 0x08, 0x01]); // Simplified MVT header

      // Act
      const result = await worker.validateTileData(validMVTData.buffer);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty tile data', async () => {
      // Arrange
      const emptyData = new ArrayBuffer(0);

      // Act
      const result = await worker.validateTileData(emptyData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'EMPTY_TILE')).toBe(true);
    });

    it('should warn about large tile sizes', async () => {
      // Arrange - Create large tile data
      const largeTileData = new ArrayBuffer(600 * 1024); // 600KB

      // Act
      const result = await worker.validateTileData(largeTileData);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('large'))).toBe(true);
    });
  });

  describe('generateTileMetadata', () => {
    it('should generate comprehensive tile metadata', async () => {
      // Arrange
      const tileCoords: TileCoordinate = { z: 10, x: 512, y: 256 };
      const tileData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const layers = [
        {
          name: 'admin_1',
          featureCount: 47,
          minZoom: 0,
          maxZoom: 10,
          fields: ['name', 'admin_level']
        },
        {
          name: 'admin_2',
          featureCount: 150,
          minZoom: 8,
          maxZoom: 14,
          fields: ['name', 'admin_level', 'population']
        }
      ];

      // Act
      const metadata = await worker.generateTileMetadata(tileCoords, tileData, layers);

      // Assert
      expect(metadata.z).toBe(10);
      expect(metadata.x).toBe(512);
      expect(metadata.y).toBe(256);
      expect(metadata.size).toBe(5);
      expect(metadata.features).toBe(197); // 47 + 150
      expect(metadata.layers).toHaveLength(2);
      expect(metadata.generatedAt).toBeGreaterThan(0);
      expect(metadata.contentHash).toBeDefined();
      expect(metadata.version).toBe(1);
    });

    it('should calculate correct bounding box for tile', async () => {
      // Arrange
      const tileCoords: TileCoordinate = { z: 1, x: 0, y: 0 }; // Northwest quadrant
      const tileData = new ArrayBuffer(0);
      const layers: any[] = [];

      // Act
      const metadata = await worker.generateTileMetadata(tileCoords, tileData, layers);

      // Assert
      expect(metadata.bbox).toBeDefined();
      expect(metadata.bbox).toHaveLength(4);
      // At zoom 1, x=0, y=0 should cover western hemisphere, northern half
      expect(metadata.bbox[0]).toBe(-180); // west
      expect(metadata.bbox[1]).toBeCloseTo(0, 0); // south (approximately equator)
      expect(metadata.bbox[2]).toBe(0); // east
      expect(metadata.bbox[3]).toBeCloseTo(85.05, 0); // north (approximately 85°)
    });
  });

  describe('optimizeTileData', () => {
    it('should compress tile data efficiently', async () => {
      // Arrange
      const originalData = new ArrayBuffer(1000);
      const view = new Uint8Array(originalData);
      view.fill(42); // Fill with repeating pattern for better compression

      // Act
      const compressed = await worker.optimizeTileData(originalData);

      // Assert
      expect(compressed.byteLength).toBeLessThanOrEqual(originalData.byteLength);
      expect(compressed.byteLength).toBeGreaterThan(0);
    });

    it('should handle small data efficiently', async () => {
      // Arrange
      const smallData = new ArrayBuffer(10);

      // Act
      const result = await worker.optimizeTileData(smallData);

      // Assert
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });

  describe('layerFiltering', () => {
    it('should filter features by zoom level', async () => {
      // Arrange
      const features = [
        { properties: { admin_level: 1 }, geometry: {} },
        { properties: { admin_level: 2 }, geometry: {} },
        { properties: { admin_level: 3 }, geometry: {} }
      ];

      const layerConfig = {
        'admin_1': { minZoom: 0, maxZoom: 8, properties: ['name'] },
        'admin_2': { minZoom: 6, maxZoom: 12, properties: ['name'] },
        'admin_3': { minZoom: 10, maxZoom: 16, properties: ['name'] }
      };

      // Act - Test at zoom level 7
      const filtered = await worker.filterFeaturesByZoom(features, layerConfig, 7);

      // Assert
      // At zoom 7, only admin_1 (0-8) and admin_2 (6-12) should be included
      expect(filtered.length).toBe(2);
      expect(filtered.some(f => f.properties.admin_level === 1)).toBe(true);
      expect(filtered.some(f => f.properties.admin_level === 2)).toBe(true);
      expect(filtered.some(f => f.properties.admin_level === 3)).toBe(false);
    });

    it('should filter properties according to layer configuration', async () => {
      // Arrange
      const features = [
        {
          properties: {
            name: 'Tokyo',
            admin_level: 1,
            population: 13960000,
            area: 2194,
            unnecessary_field: 'should be removed'
          },
          geometry: {}
        }
      ];

      const layerConfig = {
        'admin_1': {
          minZoom: 0,
          maxZoom: 10,
          properties: ['name', 'admin_level'] // Only these should be kept
        }
      };

      // Act
      const filtered = await worker.filterProperties(features, layerConfig);

      // Assert
      expect(filtered).toHaveLength(1);
      const feature = filtered[0];
      expect(feature.properties).toHaveProperty('name', 'Tokyo');
      expect(feature.properties).toHaveProperty('admin_level', 1);
      expect(feature.properties).not.toHaveProperty('population');
      expect(feature.properties).not.toHaveProperty('area');
      expect(feature.properties).not.toHaveProperty('unnecessary_field');
    });
  });
});
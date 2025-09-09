/**
 * VectorTileWorker Unit Tests
 *
 * Tests for Mapbox Vector Tile generation from TopoJSON data
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { VectorTileWorker } from '../VectorTileWorker';
import type { VectorTileTask, VectorTileTaskConfig } from '../../types';

describe('VectorTileWorker', () => {
  let worker: VectorTileWorker;

  beforeEach(() => {
    worker = new VectorTileWorker();
    // Seed an input buffer into the worker's in-memory cache
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'feat-1',
          properties: { name: 'Test A', admin_level: 1, population: 1000 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[139.0, 35.0], [140.0, 35.0], [140.0, 36.0], [139.0, 36.0], [139.0, 35.0]]],
          },
        },
      ],
    } as any;
    const enc = new TextEncoder();
    (worker as any).tileCache.set('buffer-1', enc.encode(JSON.stringify(fc)));
  });

  describe('generateVectorTile', () => {
    it('should successfully generate a tile from GeoJSON buffer', async () => {
      // Arrange
      const task: VectorTileTask = {
        taskId: 'test-vector-tile-1',
        sessionId: 'session-1',
        type: 'vectortile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        tileBufferId: 'buffer-1',
        config: {
          zoomLevel: 10,
          tileX: 512,
          tileY: 256,
          extent: 4096,
          buffer: 64,
          layers: [
            { name: 'admin_1', minZoom: 0, maxZoom: 10, properties: ['name', 'admin_level'], simplificationLevel: 1 },
            {
              name: 'admin_2',
              minZoom: 8,
              maxZoom: 14,
              properties: ['name', 'admin_level', 'population'],
              simplificationLevel: 2
            },
          ],
          format: 'mvt',
          compression: false,
        } satisfies VectorTileTaskConfig,
      };

      // Act
      const result = await worker.generateVectorTile(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.mvtSize).toBeGreaterThan(0);
      expect(result.featureCount).toBeGreaterThan(0);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should handle tile generation failures gracefully', async () => {
      // Arrange
      const task: VectorTileTask = {
        taskId: 'test-vector-tile-fail',
        sessionId: 'session-1',
        type: 'vectortile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        tileBufferId: 'invalid-buffer',
        config: {
          zoomLevel: 10,
          tileX: 512,
          tileY: 256,
          extent: 4096,
          buffer: 64,
          layers: [],
          format: 'mvt',
          compression: false,
        } as VectorTileTaskConfig,
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
        type: 'vectortile',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'vectorTile',
        tileBufferId: 'buffer-1',
        config: {
          zoomLevel: 2,
          tileX: 1,
          tileY: 1,
          extent: 4096,
          buffer: 64,
          layers: [],
          format: 'mvt',
          compression: false
        },
      };

      const highZoomTask: VectorTileTask = {
        taskId: 'test-high-zoom',
        sessionId: 'session-1',
        type: 'vectortile',
        status: 'running',
        index: 1,
        progress: 0,
        taskType: 'vectorTile',
        tileBufferId: 'buffer-1',
        config: {
          zoomLevel: 12,
          tileX: 2048,
          tileY: 1024,
          extent: 4096,
          buffer: 64,
          layers: [],
          format: 'mvt',
          compression: false
        },
      };

      // Act
      const lowZoomResult = await worker.generateVectorTile(lowZoomTask);
      const highZoomResult = await worker.generateVectorTile(highZoomTask);

      // Assert
      expect(lowZoomResult.status).toBe('completed');
      expect(highZoomResult.status).toBe('completed');
      expect(lowZoomResult.tileId).toContain('-2-');
      expect(highZoomResult.tileId).toContain('-12-');
    });
  });

  describe('tileCoordinateTransform', () => {
    it('should transform geographic coordinates to tile coordinates', async () => {
      const extent = 4096;
      const bounds = (worker as any).getTileBounds(512, 256, 10);
      const pt = (worker as any).transformGeometry({
        type: 'Point',
        coordinates: [139.6917, 35.6895]
      }, bounds, extent) as any;
      expect(pt).toHaveLength(2);
      expect(pt[0]).toBeGreaterThanOrEqual(0);
      expect(pt[0]).toBeLessThanOrEqual(extent);
      expect(pt[1]).toBeGreaterThanOrEqual(0);
      expect(pt[1]).toBeLessThanOrEqual(extent);
    });
  });

  describe('validateTile', () => {
    it('should reject empty tile data', async () => {
      // Arrange
      const emptyData = new ArrayBuffer(0);

      // Act
      const result = await worker.validateTile(emptyData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'EMPTY_TILE')).toBe(true);
    });

    it('should warn about large tile sizes', async () => {
      // Arrange - Create very large tile data (>5MB)
      const largeTileData = new ArrayBuffer(6 * 1024 * 1024);

      // Act
      const result = await worker.validateTile(largeTileData);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('very large'))).toBe(true);
    });
  });

  // Note: Tile metadata generation API has changed; dedicated tests will be added
  // when real MVT encoding is introduced. For now, skip metadata tests.

  describe('optimizeTile', () => {
    it('should compress tile data efficiently', async () => {
      // Arrange
      const originalData = new ArrayBuffer(1000);
      const view = new Uint8Array(originalData);
      view.fill(42); // Fill with repeating pattern for better compression

      // Act
      const compressed = await worker.optimizeTile(originalData);

      // Assert
      expect(compressed.byteLength).toBeLessThanOrEqual(originalData.byteLength);
      expect(compressed.byteLength).toBeGreaterThan(0);
    });

    it('should handle small data efficiently', async () => {
      // Arrange
      const smallData = new ArrayBuffer(10);

      // Act
      const result = await worker.optimizeTile(smallData);

      // Assert
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });
});
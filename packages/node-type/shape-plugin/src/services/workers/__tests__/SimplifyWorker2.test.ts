/**
 * SimplifyWorker2 Unit Tests
 *
 * Tests for TopoJSON-based topology-preserving simplification
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SimplifyWorker2 } from '../SimplifyWorker2';
import type { Feature, Simplify2Task, TileSimplifyConfig } from '../../types';

describe('SimplifyWorker2', () => {
  let worker: SimplifyWorker2;

  beforeEach(() => {
    worker = new SimplifyWorker2();
    // Seed an input FeatureCollection into the worker's in-memory cache
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'a',
          properties: { name: 'A' },
          geometry: { type: 'Polygon', coordinates: [[[139,35],[140,35],[140,36],[139,36],[139,35]]] },
        },
        {
          type: 'Feature',
          id: 'b',
          properties: { name: 'B' },
          geometry: { type: 'Polygon', coordinates: [[[140,35],[141,35],[141,36],[140,36],[140,35]]] },
        },
      ],
    } as any;
    (worker as any).tileCache.set('buffer-1', JSON.stringify(fc));
  });

  describe('processTileSimplification', () => {
    it('should successfully create tile buffers from features', async () => {
      // Arrange
      const task: Simplify2Task = {
        taskId: 'test-simplify2-1',
        sessionId: 'session-1',
        type: 'simplify2',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify2',
        inputBufferId: 'buffer-1',
        config: {
          algorithm: 'douglas-peucker',
          tolerance: 0.01,
          preserveTopology: true,
          zoomLevel: 10,
          preserveSharedBoundaries: true,
          quantization: 1e5,
          coordinatePrecision: 5,
        } satisfies TileSimplifyConfig,
      };

      // Act
      const result = await worker.processTileSimplification(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.tileBufferIds.length).toBeGreaterThan(0);
      expect(result.tilesGenerated).toBeGreaterThan(0);
      expect(typeof result.topologyPreserved).toBe('boolean');
    });

    it('should handle topology creation failures gracefully', async () => {
      // Arrange
      const task: Simplify2Task = {
        taskId: 'test-simplify2-fail',
        sessionId: 'session-1',
        type: 'simplify2',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify2',
        inputBufferId: 'invalid-buffer',
        config: { algorithm: 'douglas-peucker', tolerance: 0.01, preserveTopology: true, zoomLevel: 8, preserveSharedBoundaries: true, quantization: 1e5, coordinatePrecision: 5 } as TileSimplifyConfig,
      };

      // Act
      const result = await worker.processTileSimplification(task);

      // Assert - Worker should handle missing buffer gracefully
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('validateTopology', () => {
    it('should validate feature topology (no self intersections)', async () => {
      const features: Feature[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } } as any,
      ];
      const result = await worker.validateTopology(features);
      expect(result.isValid).toBe(true);
      expect(result.sharedBoundariesPreserved).toBe(true);
    });

    it('should reject invalid topology structures', async () => {
      // Arrange
      const invalidFeatures: Feature[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0,0],[1,1],[0,1]]] } } as any,
      ];
      const result = await worker.validateTopology(invalidFeatures);
      expect(result.isValid).toBe(false);
    });

    it('should reject null topology', async () => {
      // Act & Assert
      // @ts-expect-error intentional
      const result = await worker.validateTopology(null);
      expect(result.isValid).toBe(false);
    });
  });
  // Additional light check for TopoJSON processing API
  describe('processTopoJSON', () => {
    it('should return a basic TopoJSON structure', async () => {
      const features: Feature[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] } } as any,
      ];
      const cfg: TileSimplifyConfig = { algorithm: 'douglas-peucker', tolerance: 0.01, preserveTopology: true, zoomLevel: 8, preserveSharedBoundaries: true, quantization: 1e4, coordinatePrecision: 5 };
      const topo = await worker.processTopoJSON(features, cfg);
      expect(topo.topology.type).toBe('Topology');
      expect(Array.isArray(topo.topology.arcs)).toBe(true);
      expect(topo.objects.features).toBeDefined();
    });
  });
});

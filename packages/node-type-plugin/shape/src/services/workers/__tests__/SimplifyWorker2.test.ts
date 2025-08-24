/**
 * SimplifyWorker2 Unit Tests
 * 
 * Tests for TopoJSON-based topology-preserving simplification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GeoJSON } from 'geojson';
import { SimplifyWorker2 } from '../SimplifyWorker2';
import type { Simplify2Task, FeatureData, TopoJSONTopology } from '../../types';

describe('SimplifyWorker2', () => {
  let worker: SimplifyWorker2;

  beforeEach(() => {
    worker = new SimplifyWorker2();
  });

  describe('processTopologySimplification', () => {
    it('should successfully create TopoJSON topology from features', async () => {
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
          algorithm: 'topojson',
          quantization: 1e5,
          presimplify: true,
          coordinateSystem: 'cartesian'
        }
      };

      // Act
      const result = await worker.processTopologySimplification(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.topology).toBeDefined();
      expect(result.topology.type).toBe('Topology');
      expect(result.topology.arcs).toBeDefined();
      expect(result.topology.objects).toBeDefined();
      expect(result.sharedBoundaryCount).toBeGreaterThanOrEqual(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
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
        config: {
          algorithm: 'topojson',
          quantization: 1e5
        }
      };

      // Act
      const result = await worker.processTopologySimplification(task);

      // Assert - Worker should handle missing buffer gracefully
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });

    it('should preserve topology with shared boundaries', async () => {
      // Arrange
      const task: Simplify2Task = {
        taskId: 'test-topology-preservation',
        sessionId: 'session-1',
        type: 'simplify2',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify2',
        inputBufferId: 'buffer-1',
        config: {
          algorithm: 'topojson',
          quantization: 1e4,
          presimplify: true,
          coordinateSystem: 'cartesian',
          preserveSharedBoundaries: true
        }
      };

      // Act
      const result = await worker.processTopologySimplification(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.sharedBoundaryCount).toBeGreaterThan(0);
      expect(result.topology.arcs).toBeDefined();
      expect(result.topology.arcs.length).toBeGreaterThan(0);
    });
  });

  describe('validateTopology', () => {
    it('should validate correct TopoJSON topology', async () => {
      // Arrange
      const validTopology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [[[0, 0], [1, 1]], [[1, 1], [2, 0]]],
        objects: {
          'features': {
            type: 'GeometryCollection',
            geometries: [{
              type: 'LineString',
              arcs: [0, 1]
            }]
          }
        }
      };

      // Act & Assert
      expect(await worker.validateTopology(validTopology)).toBe(true);
    });

    it('should reject invalid topology structures', async () => {
      // Arrange
      const invalidTopology = {
        type: 'InvalidTopology',
        objects: {}
      } as any;

      // Act & Assert
      expect(await worker.validateTopology(invalidTopology)).toBe(false);
    });

    it('should reject null topology', async () => {
      // Act & Assert
      expect(await worker.validateTopology(null)).toBe(false);
    });
  });

  describe('calculateTopologyMetrics', () => {
    it('should calculate compression ratio correctly', async () => {
      // Arrange
      const features: FeatureData[] = [
        {
          id: 'feature-1',
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
          },
          properties: { name: 'Test 1' },
          metadata: {
            originalId: 'orig-1',
            dataSource: 'test',
            downloadedAt: Date.now(),
            simplificationLevel: 1,
            qualityScore: 1,
            bbox: [0, 0, 1, 1]
          }
        },
        {
          id: 'feature-2',
          geometry: {
            type: 'Polygon',
            coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]]
          },
          properties: { name: 'Test 2' },
          metadata: {
            originalId: 'orig-2',
            dataSource: 'test',
            downloadedAt: Date.now(),
            simplificationLevel: 1,
            qualityScore: 1,
            bbox: [1, 0, 2, 1]
          }
        }
      ];

      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]],
        objects: {
          'features': {
            type: 'GeometryCollection',
            geometries: [{
              type: 'Polygon',
              arcs: [[0, 1, 2, 3]]
            }]
          }
        }
      };

      // Act
      const metrics = await worker.calculateTopologyMetrics(features, topology);

      // Assert
      expect(metrics.compressionRatio).toBeGreaterThan(0);
      expect(metrics.compressionRatio).toBeLessThanOrEqual(1);
      expect(metrics.sharedBoundaryCount).toBeGreaterThanOrEqual(0);
      expect(metrics.arcCount).toBe(4);
      expect(metrics.originalFeatureCount).toBe(2);
    });

    it('should handle empty features array', async () => {
      // Arrange
      const features: FeatureData[] = [];
      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [],
        objects: {}
      };

      // Act
      const metrics = await worker.calculateTopologyMetrics(features, topology);

      // Assert
      expect(metrics.compressionRatio).toBe(1);
      expect(metrics.sharedBoundaryCount).toBe(0);
      expect(metrics.arcCount).toBe(0);
      expect(metrics.originalFeatureCount).toBe(0);
    });
  });

  describe('optimizeTopology', () => {
    it('should remove redundant arcs', async () => {
      // Arrange
      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [
          [[0, 0], [1, 0]], // Used arc
          [[1, 0], [1, 1]], // Used arc
          [[2, 2], [3, 3]], // Unused arc
          [[1, 1], [0, 1]], // Used arc
          [[0, 1], [0, 0]]  // Used arc
        ],
        objects: {
          'features': {
            type: 'GeometryCollection',
            geometries: [{
              type: 'Polygon',
              arcs: [[0, 1, 3, 4]] // Only references arcs 0, 1, 3, 4
            }]
          }
        }
      };

      // Act
      const optimized = await worker.optimizeTopology(topology);

      // Assert
      expect(optimized.arcs.length).toBeLessThan(topology.arcs.length);
      expect(optimized.type).toBe('Topology');
      expect(optimized.objects).toBeDefined();
    });

    it('should preserve essential topology structure', async () => {
      // Arrange
      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [[[0, 0], [1, 1]]],
        objects: {
          'features': {
            type: 'GeometryCollection',
            geometries: [{
              type: 'LineString',
              arcs: [0]
            }]
          }
        }
      };

      // Act
      const optimized = await worker.optimizeTopology(topology);

      // Assert
      expect(optimized.arcs.length).toBe(1);
      expect(optimized.objects.features).toBeDefined();
    });
  });

  describe('createFeatureCollection', () => {
    it('should convert TopoJSON back to GeoJSON FeatureCollection', async () => {
      // Arrange
      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]],
        objects: {
          'features': {
            type: 'GeometryCollection',
            geometries: [{
              type: 'Polygon',
              arcs: [[0, 1, 2, 3]]
            }]
          }
        }
      };

      // Act
      const featureCollection = await worker.createFeatureCollection(topology);

      // Assert
      expect(featureCollection.type).toBe('FeatureCollection');
      expect(featureCollection.features).toBeDefined();
      expect(featureCollection.features.length).toBeGreaterThan(0);
      
      const feature = featureCollection.features[0];
      expect(feature.type).toBe('Feature');
      expect(feature.geometry).toBeDefined();
      expect(feature.properties).toBeDefined();
    });

    it('should handle empty topology', async () => {
      // Arrange
      const topology: TopoJSONTopology = {
        type: 'Topology',
        arcs: [],
        objects: {}
      };

      // Act
      const featureCollection = await worker.createFeatureCollection(topology);

      // Assert
      expect(featureCollection.type).toBe('FeatureCollection');
      expect(featureCollection.features).toEqual([]);
    });
  });
});
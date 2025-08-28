/**
 * SimplifyWorker1 Unit Tests
 * 
 * Tests for Douglas-Peucker feature-level simplification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GeoJSON } from 'geojson';
import { SimplifyWorker1 } from '../SimplifyWorker1';
import type { Simplify1Task, SimplifyTaskConfig, FeatureData } from '../../types';

describe('SimplifyWorker1', () => {
  let worker: SimplifyWorker1;

  beforeEach(() => {
    worker = new SimplifyWorker1();
  });

  describe('processSimplification', () => {
    it('should successfully simplify features using Douglas-Peucker algorithm', async () => {
      // Arrange
      const task: Simplify1Task = {
        taskId: 'test-simplify-1',
        sessionId: 'session-1',
        type: 'simplify1',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify1',
        inputBufferId: 'buffer-1',
        config: {
          algorithm: 'douglas-peucker',
          tolerance: 0.01,
          preserveTopology: true,
          minimumArea: 1000,
          maxVertices: 1000
        }
      };

      // Act
      const result = await worker.processSimplification(task);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(task.taskId);
      expect(result.originalFeatureCount).toBeGreaterThan(0);
      expect(result.simplifiedFeatureCount).toBeGreaterThanOrEqual(0);
      expect(result.reductionRatio).toBeGreaterThanOrEqual(0);
      expect(result.reductionRatio).toBeLessThanOrEqual(1);
      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.geometricAccuracy).toBeGreaterThan(0);
      expect(result.qualityMetrics.geometricAccuracy).toBeLessThanOrEqual(1);
    });

    it('should handle simplification failures gracefully', async () => {
      // Arrange
      const task: Simplify1Task = {
        taskId: 'test-simplify-fail',
        sessionId: 'session-1',
        type: 'simplify1',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify1',
        inputBufferId: 'invalid-buffer',
        config: {
          algorithm: 'douglas-peucker',
          tolerance: 0.01,
          preserveTopology: true
        }
      };

      // Act
      const result = await worker.processSimplification(task);

      // Assert - Worker should handle missing buffer gracefully
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });

    it('should reduce vertex count based on tolerance', async () => {
      // Arrange
      const lowToleranceTask: Simplify1Task = {
        taskId: 'test-low-tolerance',
        sessionId: 'session-1',
        type: 'simplify1',
        status: 'running',
        index: 0,
        progress: 0,
        taskType: 'simplify1',
        inputBufferId: 'buffer-1',
        config: {
          algorithm: 'douglas-peucker',
          tolerance: 0.001, // Very low tolerance
          preserveTopology: true
        }
      };

      const highToleranceTask: Simplify1Task = {
        taskId: 'test-high-tolerance',
        sessionId: 'session-1',
        type: 'simplify1',
        status: 'running',
        index: 1,
        progress: 0,
        taskType: 'simplify1',
        inputBufferId: 'buffer-1',
        config: {
          algorithm: 'douglas-peucker',
          tolerance: 0.1, // High tolerance
          preserveTopology: true
        }
      };

      // Act
      const lowToleranceResult = await worker.processSimplification(lowToleranceTask);
      const highToleranceResult = await worker.processSimplification(highToleranceTask);

      // Assert
      expect(lowToleranceResult.status).toBe('completed');
      expect(highToleranceResult.status).toBe('completed');
      // High tolerance should result in greater reduction
      expect(highToleranceResult.reductionRatio).toBeGreaterThanOrEqual(lowToleranceResult.reductionRatio);
    });
  });

  describe('validateGeometry', () => {
    it('should validate correct geometries', async () => {
      // Arrange
      const validPoint: GeoJSON.Point = {
        type: 'Point',
        coordinates: [0, 0]
      };

      const validPolygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      };

      // Act & Assert
      expect(await worker.validateGeometry(validPoint)).toBe(true);
      expect(await worker.validateGeometry(validPolygon)).toBe(true);
    });

    it('should reject invalid geometries', async () => {
      // Arrange
      const invalidGeometry = null;
      const incompleteGeometry = { type: 'Point' } as any;

      // Act & Assert
      expect(await worker.validateGeometry(invalidGeometry)).toBe(false);
      expect(await worker.validateGeometry(incompleteGeometry)).toBe(false);
    });

    it('should reject unsupported geometry types', async () => {
      // Arrange
      const unsupportedGeometry = {
        type: 'UnsupportedType',
        coordinates: [0, 0]
      } as any;

      // Act & Assert
      expect(await worker.validateGeometry(unsupportedGeometry)).toBe(false);
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate vertex count correctly', async () => {
      // Arrange
      const simplePoint: GeoJSON.Point = {
        type: 'Point',
        coordinates: [0, 0]
      };

      const simpleLineString: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [[0, 0], [1, 1], [2, 2]]
      };

      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      };

      // Act
      const pointComplexity = await worker.calculateComplexity(simplePoint);
      const lineComplexity = await worker.calculateComplexity(simpleLineString);
      const polygonComplexity = await worker.calculateComplexity(polygon);

      // Assert
      expect(pointComplexity).toBe(1);
      expect(lineComplexity).toBe(3);
      expect(polygonComplexity).toBe(5);
    });

    it('should handle null geometry', async () => {
      // Act
      const complexity = await worker.calculateComplexity(null);

      // Assert
      expect(complexity).toBe(0);
    });
  });

  describe('optimizeFeatures', () => {
    it('should remove duplicate features', async () => {
      // Arrange
      const feature1: FeatureData = {
        id: 'feature-1',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: 'Test' },
        metadata: {
          originalId: 'orig-1',
          dataSource: 'test',
          downloadedAt: Date.now(),
          simplificationLevel: 0,
          qualityScore: 1,
          bbox: [0, 0, 0, 0]
        }
      };

      const feature2: FeatureData = {
        id: 'feature-2',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: { name: 'Test 2' },
        metadata: {
          originalId: 'orig-2',
          dataSource: 'test',
          downloadedAt: Date.now(),
          simplificationLevel: 0,
          qualityScore: 1,
          bbox: [1, 1, 1, 1]
        }
      };

      const duplicateFeature1: FeatureData = { ...feature1 }; // Same ID

      const features = [feature1, feature2, duplicateFeature1];

      // Act
      const optimized = await worker.optimizeFeatures(features);

      // Assert
      expect(optimized).toHaveLength(2); // Duplicate should be removed
      expect(optimized.map(f => f.id)).toEqual(['feature-1', 'feature-2']);
    });

    it('should remove features with invalid geometries', async () => {
      // Arrange
      const validFeature: FeatureData = {
        id: 'valid-feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: 'Valid' },
        metadata: {
          originalId: 'orig-1',
          dataSource: 'test',
          downloadedAt: Date.now(),
          simplificationLevel: 0,
          qualityScore: 1,
          bbox: [0, 0, 0, 0]
        }
      };

      const invalidFeature: FeatureData = {
        id: 'invalid-feature',
        geometry: { type: 'InvalidType' } as any,
        properties: { name: 'Invalid' },
        metadata: {
          originalId: 'orig-2',
          dataSource: 'test',
          downloadedAt: Date.now(),
          simplificationLevel: 0,
          qualityScore: 1,
          bbox: [0, 0, 0, 0]
        }
      };

      const features = [validFeature, invalidFeature];

      // Act
      const optimized = await worker.optimizeFeatures(features);

      // Assert
      expect(optimized).toHaveLength(1);
      expect(optimized[0].id).toBe('valid-feature');
    });
  });
});
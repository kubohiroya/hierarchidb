/**
 * Shared utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateMapConfiguration,
  validateRenderConfiguration,
  generateLayerId,
  parseLayerId,
  calculateBounds,
  debounce
} from '../utils';

describe('Project Shared Utils', () => {
  describe('validateMapConfiguration', () => {
    it('should validate correct map configuration', () => {
      const config = {
        center: [139.6917, 35.6895] as [number, number],
        zoom: 10,
        bearing: 0,
        pitch: 0
      };

      const result = validateMapConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid longitude', () => {
      const config = {
        center: [200, 35.6895] as [number, number], // Invalid longitude
        zoom: 10
      };

      const result = validateMapConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          field: 'center.longitude',
          message: 'Longitude must be between -180 and 180',
          severity: 'error'
        }
      ]);
    });

    it('should reject invalid latitude', () => {
      const config = {
        center: [139.6917, -100] as [number, number], // Invalid latitude
        zoom: 10
      };

      const result = validateMapConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          field: 'center.latitude',
          message: 'Latitude must be between -90 and 90',
          severity: 'error'
        }
      ]);
    });

    it('should reject invalid zoom level', () => {
      const config = {
        zoom: 25 // Invalid zoom
      };

      const result = validateMapConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          field: 'zoom',
          message: 'Zoom level must be between 0 and 24',
          severity: 'error'
        }
      ]);
    });
  });

  describe('validateRenderConfiguration', () => {
    it('should validate correct render configuration', () => {
      const config = {
        maxZoom: 18,
        minZoom: 0,
        pixelRatio: 1,
        preserveDrawingBuffer: false
      };

      const result = validateRenderConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when minZoom >= maxZoom', () => {
      const config = {
        maxZoom: 10,
        minZoom: 10
      };

      const result = validateRenderConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          field: 'zoom',
          message: 'Min zoom must be less than max zoom',
          severity: 'error'
        }
      ]);
    });
  });

  describe('generateLayerId and parseLayerId', () => {
    it('should generate and parse layer ID correctly', () => {
      const resourceNodeId = 'resource-123';
      const layerId = generateLayerId(resourceNodeId, 0);
      
      expect(layerId).toBe('layer_resource-123_0');
      
      const parsed = parseLayerId(layerId);
      expect(parsed).toEqual({
        resourceNodeId: 'resource-123',
        layerIndex: 0
      });
    });

    it('should return null for invalid layer ID format', () => {
      const parsed = parseLayerId('invalid-format');
      expect(parsed).toBe(null);
    });
  });

  describe('calculateBounds', () => {
    it('should calculate bounds from center and zoom', () => {
      const center: [number, number] = [139.6917, 35.6895];
      const zoom = 10;
      
      const bounds = calculateBounds(center, zoom);
      
      expect(bounds).toHaveLength(2);
      expect(bounds[0]).toHaveLength(2); // Southwest
      expect(bounds[1]).toHaveLength(2); // Northeast
      expect(bounds[0][0]).toBeLessThan(center[0]); // SW lng < center lng
      expect(bounds[0][1]).toBeLessThan(center[1]); // SW lat < center lat
      expect(bounds[1][0]).toBeGreaterThan(center[0]); // NE lng > center lng
      expect(bounds[1][1]).toBeGreaterThan(center[1]); // NE lat > center lat
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 100);

      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Check after debounce delay
      setTimeout(() => {
        expect(callCount).toBe(1);
        // done();
      }, 150);
    });
  });
});
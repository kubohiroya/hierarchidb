/**
 * @file plugin-integration.test.ts
 * @description Integration tests for BaseMap plugin extension
 */

import { describe, it, expect } from 'vitest';
import { BaseMapExtension } from '../extension/definition';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../extension/definition';

describe('BaseMap Plugin Integration', () => {
  describe('Extension Definition', () => {
    it('should have correct basic structure', () => {
      expect(BaseMapExtension.extends).toBe('folder-plugin');
      expect(BaseMapExtension.nodeType).toBe('basemap');
      expect(BaseMapExtension.name).toBe('BaseMap');
      expect(BaseMapExtension.displayName).toBe('ベースマップ');
    });

    it('should define required extended steps', () => {
      expect(BaseMapExtension.extendedSteps).toHaveLength(3);
      
      const steps = BaseMapExtension.extendedSteps!;
      expect(steps[0]!.stepNumber).toBe(2);
      expect(steps[0]!.title).toBe('Map Style');
      expect(steps[1]!.stepNumber).toBe(3);
      expect(steps[1]!.title).toBe('Map Viewport');
      expect(steps[2]!.stepNumber).toBe(4);
      expect(steps[2]!.title).toBe('Display Options');
    });

    it('should define extended fields', () => {
      const fields = BaseMapExtension.extendedFields;
      expect(fields).toHaveLength(4);
      
      const fieldNames = fields.map(f => f.name);
      expect(fieldNames).toContain('baseMapMetadataId');
      expect(fieldNames).toContain('mapStyle');
      expect(fieldNames).toContain('viewport');
      expect(fieldNames).toContain('displayOptions');
    });

    it('should have validation rules', () => {
      expect(BaseMapExtension.extendedValidation).toBeDefined();
      expect(BaseMapExtension.extendedValidation.extendedRules).toBeDefined();
      expect(BaseMapExtension.extendedValidation.extendedRules.coordinateRangeRule).toBeDefined();
      expect(BaseMapExtension.extendedValidation.extendedRules.customStyleUrlRule).toBeDefined();
    });
  });

  describe('Step Validation', () => {
    it('should validate map style step', async () => {
      const step = BaseMapExtension.extendedSteps?.[0]!;
      
      // Valid data
      const validData = {
        mapStyle: { style: 'streets' }
      };
      const validResult = await step.validation!.validate(validData);
      expect(validResult.isValid).toBe(true);

      // Invalid data - missing style
      const invalidData = {};
      const invalidResult = await step.validation!.validate(invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Map style selection is required');

      // Invalid data - custom style without URL
      const customStyleData = {
        mapStyle: { style: 'custom' }
      };
      const customStyleResult = await step.validation!.validate(customStyleData);
      expect(customStyleResult.isValid).toBe(false);
      expect(customStyleResult.errors).toContain('Custom style URL is required when custom style is selected');
    });

    it('should validate viewport step', async () => {
      const step = BaseMapExtension.extendedSteps?.[1]!
      
      // Valid data
      const validData = {
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 10
        }
      };
      const validResult = await step.validation!.validate(validData);
      expect(validResult.isValid).toBe(true);

      // Invalid data - missing viewport
      const invalidData = {};
      const invalidResult = await step.validation!.validate(invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Viewport configuration is required');

      // Invalid data - invalid coordinates
      const invalidCoordsData = {
        viewport: {
          center: ['not', 'numbers'],
          zoom: 10
        }
      };
      const invalidCoordsResult = await step.validation!.validate(invalidCoordsData);
      expect(invalidCoordsResult.isValid).toBe(false);
      expect(invalidCoordsResult.errors).toContain('Valid center coordinates are required');

      // Invalid data - invalid zoom
      const invalidZoomData = {
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 25 // Over limit
        }
      };
      const invalidZoomResult = await step.validation!.validate(invalidZoomData);
      expect(invalidZoomResult.isValid).toBe(false);
      expect(invalidZoomResult.errors).toContain('Zoom level must be between 0 and 24');
    });

    it('should validate display options step', async () => {
      const step = BaseMapExtension.extendedSteps?.[2]!
      
      // Display options are optional, so should always pass
      const emptyData = {};
      const result = await step.validation!.validate(emptyData);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Extended Validation Rules', () => {
    it('should validate coordinate range', () => {
      const rule = BaseMapExtension.extendedValidation.extendedRules.coordinateRangeRule;
      
      // Valid coordinates
      expect(rule.validate({
        viewport: { center: [139.6917, 35.6895] }
      })).toBe(true);

      // Invalid longitude
      expect(rule.validate({
        viewport: { center: [200, 35.6895] }
      })).toBe(false);

      // Invalid latitude
      expect(rule.validate({
        viewport: { center: [139.6917, 95] }
      })).toBe(false);

      // Missing viewport
      expect(rule.validate({})).toBe(true);
    });

    it('should validate custom style URL', () => {
      const rule = BaseMapExtension.extendedValidation.extendedRules.customStyleUrlRule;
      
      // Valid URL for custom style
      expect(rule.validate({
        mapStyle: {
          style: 'custom',
          customStyleUrl: 'https://example.com/style.json'
        }
      })).toBe(true);

      // Invalid URL for custom style
      expect(rule.validate({
        mapStyle: {
          style: 'custom',
          customStyleUrl: 'not-a-url'
        }
      })).toBe(false);

      // Missing URL for custom style
      expect(rule.validate({
        mapStyle: {
          style: 'custom'
        }
      })).toBe(false);

      // Non-custom style (should pass regardless of URL)
      expect(rule.validate({
        mapStyle: {
          style: 'streets'
        }
      })).toBe(true);
    });
  });

  describe('Type System', () => {
    it('should have correct BaseMapEntity structure', () => {
      // This is a compile-time test - if it compiles, types are correct
      const entity: BaseMapEntity = {
        id: 'test-id' as any,
        nodeId: 'node-123' as any,
        name: 'Test BaseMap',
        description: 'Test description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        
        // BaseMap-specific fields
        mapStyle: {
          style: 'streets'
        },
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 10,
          bearing: 0,
          pitch: 0
        },
        displayOptions: {
          show3dBuildings: false,
          showTraffic: false,
          showTransit: false,
          showTerrain: false,
          showLabels: true
        }
      };
      
      expect(entity.name).toBe('Test BaseMap');
      expect(entity.mapStyle.style).toBe('streets');
      expect(entity.viewport.center).toEqual([139.6917, 35.6895]);
    });

    it('should have correct BaseMapWorkingCopy structure', () => {
      const workingCopy: BaseMapWorkingCopy = {
        id: 'test-id' as any,
        nodeId: 'node-123' as any,
        name: 'Test BaseMap',
        description: 'Test description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        
        // BaseMap-specific fields
        mapStyle: {
          style: 'streets'
        },
        viewport: {
          center: [139.6917, 35.6895],
          zoom: 10,
          bearing: 0,
          pitch: 0
        },
        displayOptions: {
          show3dBuildings: false,
          showTraffic: false,
          showTransit: false,
          showTerrain: false,
          showLabels: true
        },
        
        // Working copy fields
        isDraft: true,
        originalId: 'original-123',
        copiedAt: Date.now()
      };
      
      expect(workingCopy.isDraft).toBe(true);
      expect(workingCopy.originalId).toBe('original-123');
    });
  });
});
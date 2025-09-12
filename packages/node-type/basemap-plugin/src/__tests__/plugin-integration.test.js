/**
 * @file plugin-integration.test.js
 * @description Integration tests for BaseMap plugin extension (ESM)
 */
import { describe, it, expect } from 'vitest';
import { BaseMapExtension } from '../extension/definition';

describe('BaseMap Plugin Integration', () => {
  describe('Extension Definition', () => {
    it('should have correct basic structure', () => {
      // Basemap extends the core folder node type
      expect(BaseMapExtension.extends).toBe('folder');
      expect(BaseMapExtension.nodeType).toBe('basemap');
      expect(BaseMapExtension.name).toBe('BaseMap');
      expect(BaseMapExtension.displayName).toBe('ベースマップ');
    });

    it('should define required extended steps', () => {
      expect(BaseMapExtension.extendedSteps).toHaveLength(3);
      const steps = BaseMapExtension.extendedSteps!;
      expect(steps[0].stepNumber).toBe(2);
      expect(steps[0].title).toBe('Map Style');
      expect(steps[1].stepNumber).toBe(3);
      expect(steps[1].title).toBe('Map Viewport');
      expect(steps[2].stepNumber).toBe(4);
      expect(steps[2].title).toBe('Display Options');
    });

    it('should define extended fields', () => {
      const fields = BaseMapExtension.extendedFields;
      expect(fields).toHaveLength(4);
      const fieldNames = fields.map((f) => f.name);
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
      const validData = { mapStyle: { style: 'streets' } };
      const validResult = await step.validation.validate(validData);
      expect(validResult.isValid).toBe(true);

      const invalidResult = await step.validation.validate({});
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Map style selection is required');

      const customStyleData = { mapStyle: { style: 'custom' } };
      const customStyleResult = await step.validation.validate(customStyleData);
      expect(customStyleResult.isValid).toBe(false);
      expect(customStyleResult.errors).toContain('Custom style URL is required when custom style is selected');
    });

    it('should validate viewport step', async () => {
      const step = BaseMapExtension.extendedSteps?.[1]!;
      const validData = { viewport: { center: [139.6917, 35.6895], zoom: 10 } };
      const validResult = await step.validation.validate(validData);
      expect(validResult.isValid).toBe(true);

      const invalidResult = await step.validation.validate({});
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Viewport configuration is required');

      const invalidCoordsData = { viewport: { center: ['not', 'numbers'], zoom: 10 } } as any;
      const invalidCoordsResult = await step.validation.validate(invalidCoordsData);
      expect(invalidCoordsResult.isValid).toBe(false);
      expect(invalidCoordsResult.errors).toContain('Valid center coordinates are required');

      const invalidZoomData = { viewport: { center: [139.6917, 35.6895], zoom: 25 } };
      const invalidZoomResult = await step.validation.validate(invalidZoomData);
      expect(invalidZoomResult.isValid).toBe(false);
      expect(invalidZoomResult.errors).toContain('Zoom level must be between 0 and 24');
    });
  });
        (0, vitest_1.it)('should validate display options step', function () { return __awaiter(void 0, void 0, void 0, function () {
            var step, emptyData, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        step = (_a = definition_1.BaseMapExtension.extendedSteps) === null || _a === void 0 ? void 0 : _a[2];
                        emptyData = {};
                        return [4 /*yield*/, step.validation.validate(emptyData)];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.isValid).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('Extended Validation Rules', function () {
        (0, vitest_1.it)('should validate coordinate range', function () {
            var rule = definition_1.BaseMapExtension.extendedValidation.extendedRules.coordinateRangeRule;
            // Valid coordinates
            (0, vitest_1.expect)(rule.validate({
                viewport: { center: [139.6917, 35.6895] }
            })).toBe(true);
            // Invalid longitude
            (0, vitest_1.expect)(rule.validate({
                viewport: { center: [200, 35.6895] }
            })).toBe(false);
            // Invalid latitude
            (0, vitest_1.expect)(rule.validate({
                viewport: { center: [139.6917, 95] }
            })).toBe(false);
            // Missing viewport
            (0, vitest_1.expect)(rule.validate({})).toBe(true);
        });
        (0, vitest_1.it)('should validate custom style URL', function () {
            var rule = definition_1.BaseMapExtension.extendedValidation.extendedRules.customStyleUrlRule;
            // Valid URL for custom style
            (0, vitest_1.expect)(rule.validate({
                mapStyle: {
                    style: 'custom',
                    customStyleUrl: 'https://example.com/style.json'
                }
            })).toBe(true);
            // Invalid URL for custom style
            (0, vitest_1.expect)(rule.validate({
                mapStyle: {
                    style: 'custom',
                    customStyleUrl: 'not-a-url'
                }
            })).toBe(false);
            // Missing URL for custom style
            (0, vitest_1.expect)(rule.validate({
                mapStyle: {
                    style: 'custom'
                }
            })).toBe(false);
            // Non-custom style (should pass regardless of URL)
            (0, vitest_1.expect)(rule.validate({
                mapStyle: {
                    style: 'streets'
                }
            })).toBe(true);
        });
    });
    (0, vitest_1.describe)('Type System', function () {
        (0, vitest_1.it)('should have correct BaseMapEntity structure', function () {
            // This is a compile-time test - if it compiles, types are correct
            var entity = {
                id: 'test-id',
                nodeId: 'node-123',
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
            (0, vitest_1.expect)(entity.name).toBe('Test BaseMap');
            (0, vitest_1.expect)(entity.mapStyle.style).toBe('streets');
            (0, vitest_1.expect)(entity.viewport.center).toEqual([139.6917, 35.6895]);
        });
        (0, vitest_1.it)('should have correct BaseMapWorkingCopy structure', function () {
            var workingCopy = {
                id: 'test-id',
                nodeId: 'node-123',
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
            (0, vitest_1.expect)(workingCopy.isDraft).toBe(true);
            (0, vitest_1.expect)(workingCopy.originalId).toBe('original-123');
        });
    });
});

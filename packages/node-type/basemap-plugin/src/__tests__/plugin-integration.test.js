"use strict";
/**
 * @file plugin-integration.test.ts
 * @description Integration tests for BaseMap plugin extension
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var definition_1 = require("../extension/definition");
(0, vitest_1.describe)('BaseMap Plugin Integration', function () {
    (0, vitest_1.describe)('Extension Definition', function () {
        (0, vitest_1.it)('should have correct basic structure', function () {
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extends).toBe('folder-plugin');
            (0, vitest_1.expect)(definition_1.BaseMapExtension.nodeType).toBe('basemap');
            (0, vitest_1.expect)(definition_1.BaseMapExtension.name).toBe('BaseMap');
            (0, vitest_1.expect)(definition_1.BaseMapExtension.displayName).toBe('ベースマップ');
        });
        (0, vitest_1.it)('should define required extended steps', function () {
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extendedSteps).toHaveLength(3);
            var steps = definition_1.BaseMapExtension.extendedSteps;
            (0, vitest_1.expect)(steps[0].stepNumber).toBe(2);
            (0, vitest_1.expect)(steps[0].title).toBe('Map Style');
            (0, vitest_1.expect)(steps[1].stepNumber).toBe(3);
            (0, vitest_1.expect)(steps[1].title).toBe('Map Viewport');
            (0, vitest_1.expect)(steps[2].stepNumber).toBe(4);
            (0, vitest_1.expect)(steps[2].title).toBe('Display Options');
        });
        (0, vitest_1.it)('should define extended fields', function () {
            var fields = definition_1.BaseMapExtension.extendedFields;
            (0, vitest_1.expect)(fields).toHaveLength(4);
            var fieldNames = fields.map(function (f) { return f.name; });
            (0, vitest_1.expect)(fieldNames).toContain('baseMapMetadataId');
            (0, vitest_1.expect)(fieldNames).toContain('mapStyle');
            (0, vitest_1.expect)(fieldNames).toContain('viewport');
            (0, vitest_1.expect)(fieldNames).toContain('displayOptions');
        });
        (0, vitest_1.it)('should have validation rules', function () {
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extendedValidation).toBeDefined();
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extendedValidation.extendedRules).toBeDefined();
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extendedValidation.extendedRules.coordinateRangeRule).toBeDefined();
            (0, vitest_1.expect)(definition_1.BaseMapExtension.extendedValidation.extendedRules.customStyleUrlRule).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Step Validation', function () {
        (0, vitest_1.it)('should validate map style step', function () { return __awaiter(void 0, void 0, void 0, function () {
            var step, validData, validResult, invalidData, invalidResult, customStyleData, customStyleResult;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        step = (_a = definition_1.BaseMapExtension.extendedSteps) === null || _a === void 0 ? void 0 : _a[0];
                        validData = {
                            mapStyle: { style: 'streets' }
                        };
                        return [4 /*yield*/, step.validation.validate(validData)];
                    case 1:
                        validResult = _b.sent();
                        (0, vitest_1.expect)(validResult.isValid).toBe(true);
                        invalidData = {};
                        return [4 /*yield*/, step.validation.validate(invalidData)];
                    case 2:
                        invalidResult = _b.sent();
                        (0, vitest_1.expect)(invalidResult.isValid).toBe(false);
                        (0, vitest_1.expect)(invalidResult.errors).toContain('Map style selection is required');
                        customStyleData = {
                            mapStyle: { style: 'custom' }
                        };
                        return [4 /*yield*/, step.validation.validate(customStyleData)];
                    case 3:
                        customStyleResult = _b.sent();
                        (0, vitest_1.expect)(customStyleResult.isValid).toBe(false);
                        (0, vitest_1.expect)(customStyleResult.errors).toContain('Custom style URL is required when custom style is selected');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should validate viewport step', function () { return __awaiter(void 0, void 0, void 0, function () {
            var step, validData, validResult, invalidData, invalidResult, invalidCoordsData, invalidCoordsResult, invalidZoomData, invalidZoomResult;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        step = (_a = definition_1.BaseMapExtension.extendedSteps) === null || _a === void 0 ? void 0 : _a[1];
                        validData = {
                            viewport: {
                                center: [139.6917, 35.6895],
                                zoom: 10
                            }
                        };
                        return [4 /*yield*/, step.validation.validate(validData)];
                    case 1:
                        validResult = _b.sent();
                        (0, vitest_1.expect)(validResult.isValid).toBe(true);
                        invalidData = {};
                        return [4 /*yield*/, step.validation.validate(invalidData)];
                    case 2:
                        invalidResult = _b.sent();
                        (0, vitest_1.expect)(invalidResult.isValid).toBe(false);
                        (0, vitest_1.expect)(invalidResult.errors).toContain('Viewport configuration is required');
                        invalidCoordsData = {
                            viewport: {
                                center: ['not', 'numbers'],
                                zoom: 10
                            }
                        };
                        return [4 /*yield*/, step.validation.validate(invalidCoordsData)];
                    case 3:
                        invalidCoordsResult = _b.sent();
                        (0, vitest_1.expect)(invalidCoordsResult.isValid).toBe(false);
                        (0, vitest_1.expect)(invalidCoordsResult.errors).toContain('Valid center coordinates are required');
                        invalidZoomData = {
                            viewport: {
                                center: [139.6917, 35.6895],
                                zoom: 25 // Over limit
                            }
                        };
                        return [4 /*yield*/, step.validation.validate(invalidZoomData)];
                    case 4:
                        invalidZoomResult = _b.sent();
                        (0, vitest_1.expect)(invalidZoomResult.isValid).toBe(false);
                        (0, vitest_1.expect)(invalidZoomResult.errors).toContain('Zoom level must be between 0 and 24');
                        return [2 /*return*/];
                }
            });
        }); });
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

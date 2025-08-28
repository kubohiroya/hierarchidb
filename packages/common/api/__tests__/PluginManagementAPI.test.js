"use strict";
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
(0, vitest_1.describe)('PluginManagementAPI - TDD Red Phase', function () {
    // テスト対象のAPIインスタンス（実装は未完成のため、テストは失敗する予定）
    var pluginManagementAPI;
    (0, vitest_1.describe)('register() - プラグイン登録機能', function () {
        (0, vitest_1.it)('🔴 有効なプラグイン定義を登録できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var pluginDefinition, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pluginDefinition = {
                            nodeType: 'custom-folder-plugin',
                            database: {
                                entityStore: 'customFolders',
                                schema: {
                                    '&id': 'string',
                                    nodeId: 'string',
                                    name: 'string',
                                    createdAt: 'number',
                                },
                                version: 1,
                            },
                            meta: {
                                name: 'Custom Folder Plugin',
                                version: '1.0.0',
                                description: 'Custom folder-plugin implementation',
                            },
                        };
                        return [4 /*yield*/, pluginManagementAPI.register(pluginDefinition)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.success).toBe(true);
                        (0, vitest_1.expect)(result.pluginId).toBeDefined();
                        (0, vitest_1.expect)(result.registeredNodeType).toBe('custom-folder-plugin');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 重複するnodeTypeの登録で適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var duplicateDefinition, result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        duplicateDefinition = {
                            nodeType: 'folder-plugin',
                            database: { entityStore: 'test', schema: {}, version: 1 },
                            meta: { name: 'Duplicate', version: '1.0.0' },
                        };
                        return [4 /*yield*/, pluginManagementAPI.register(duplicateDefinition)];
                    case 1:
                        result = _c.sent();
                        (0, vitest_1.expect)(result.success).toBe(false);
                        (0, vitest_1.expect)((_a = result.error) === null || _a === void 0 ? void 0 : _a.code).toBe('DUPLICATE_NODE_TYPE');
                        (0, vitest_1.expect)((_b = result.error) === null || _b === void 0 ? void 0 : _b.message).toContain('folder-plugin');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 不正なschema定義で登録が失敗する', function () { return __awaiter(void 0, void 0, void 0, function () {
            var invalidDefinition, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        invalidDefinition = {
                            nodeType: 'invalid-schema',
                            database: {
                                entityStore: '',
                                schema: {},
                                version: 0, // 無効なバージョン
                            },
                            meta: { name: 'Invalid', version: '1.0.0' },
                        };
                        return [4 /*yield*/, pluginManagementAPI.register(invalidDefinition)];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.success).toBe(false);
                        (0, vitest_1.expect)((_a = result.error) === null || _a === void 0 ? void 0 : _a.code).toBe('INVALID_SCHEMA');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('unregister() - プラグイン削除機能', function () {
        (0, vitest_1.it)('🔴 登録済みプラグインを正常に削除できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'test-plugin';
                        return [4 /*yield*/, pluginManagementAPI.unregister(nodeType)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.success).toBe(true);
                        (0, vitest_1.expect)(result.unregisteredNodeType).toBe(nodeType);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 未登録のnodeTypeの削除で適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nonExistentType, result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        nonExistentType = 'non-existent';
                        return [4 /*yield*/, pluginManagementAPI.unregister(nonExistentType)];
                    case 1:
                        result = _c.sent();
                        (0, vitest_1.expect)(result.success).toBe(false);
                        (0, vitest_1.expect)((_a = result.error) === null || _a === void 0 ? void 0 : _a.code).toBe('PLUGIN_NOT_FOUND');
                        (0, vitest_1.expect)((_b = result.error) === null || _b === void 0 ? void 0 : _b.message).toContain(nonExistentType);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 使用中のプラグイン削除で警告を含む結果を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var activeType, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        activeType = 'active-plugin';
                        return [4 /*yield*/, pluginManagementAPI.unregister(activeType)];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.success).toBe(true);
                        (0, vitest_1.expect)(result.warnings).toBeDefined();
                        (0, vitest_1.expect)((_a = result.warnings) === null || _a === void 0 ? void 0 : _a[0]).toContain('active nodes');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('validatePlugin() - プラグイン検証機能', function () {
        (0, vitest_1.it)('🔴 有効なプラグイン定義の検証が成功する', function () { return __awaiter(void 0, void 0, void 0, function () {
            var validDefinition, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validDefinition = {
                            nodeType: 'valid-plugin',
                            database: {
                                entityStore: 'validPlugins',
                                schema: {
                                    '&id': 'string',
                                    nodeId: 'string',
                                    data: 'string',
                                },
                                version: 1,
                            },
                            meta: {
                                name: 'Valid Plugin',
                                version: '2.0.0',
                                description: 'A valid test plugin',
                            },
                        };
                        return [4 /*yield*/, pluginManagementAPI.validatePlugin(validDefinition)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.isValid).toBe(true);
                        (0, vitest_1.expect)(result.errors).toHaveLength(0);
                        (0, vitest_1.expect)(result.warnings).toHaveLength(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 不正なプラグイン定義で詳細な検証エラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var invalidDefinition, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        invalidDefinition = {
                            nodeType: '',
                            database: {
                                entityStore: '123invalid',
                                schema: {
                                    'invalid-key': 'unknown-type', // 無効なスキーマ
                                },
                                version: -1, // 無効なバージョン
                            },
                            meta: {
                                name: '',
                                version: 'invalid-version', // 無効なバージョン形式
                            },
                        };
                        return [4 /*yield*/, pluginManagementAPI.validatePlugin(invalidDefinition)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.isValid).toBe(false);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'nodeType'; })).toBe(true);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'database.entityStore'; })).toBe(true);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'meta.name'; })).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('checkHealth() - プラグインヘルス監視機能', function () {
        (0, vitest_1.it)('🔴 健全なプラグインでHealthyステータスを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.checkHealth('folder-plugin')];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.status).toBe('healthy');
                        (0, vitest_1.expect)(result.lastCheck).toBeTypeOf('number');
                        (0, vitest_1.expect)(result.performance.avgResponseTime).toBeTypeOf('number');
                        (0, vitest_1.expect)(result.performance.errorRate).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 問題のあるプラグインでDegradedまたはUnhealthyステータスを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.checkHealth('problematic-plugin')];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(['degraded', 'unhealthy']).toContain(result.status);
                        (0, vitest_1.expect)(result.performance.errorRate).toBeGreaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 未登録プラグインで適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // 存在しないプラグインのヘルスチェック
                    return [4 /*yield*/, (0, vitest_1.expect)(pluginManagementAPI.checkHealth('non-existent')).rejects.toThrow('Plugin not found')];
                    case 1:
                        // 存在しないプラグインのヘルスチェック
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('listRegistered() - 登録プラグイン一覧取得', function () {
        (0, vitest_1.it)('🔴 すべての登録済みプラグイン情報を取得できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, firstPlugin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.listRegistered()];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(result)).toBe(true);
                        (0, vitest_1.expect)(result.length).toBeGreaterThan(0);
                        firstPlugin = result[0];
                        (0, vitest_1.expect)(firstPlugin.nodeType).toBeDefined();
                        (0, vitest_1.expect)(firstPlugin.meta.name).toBeDefined();
                        (0, vitest_1.expect)(firstPlugin.meta.version).toBeDefined();
                        (0, vitest_1.expect)(firstPlugin.registrationTime).toBeTypeOf('number');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 フィルター条件でプラグイン一覧を絞り込める', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            status: 'healthy',
                            category: 'core',
                        };
                        return [4 /*yield*/, pluginManagementAPI.listRegistered(options)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(result)).toBe(true);
                        result.forEach(function (plugin) {
                            (0, vitest_1.expect)(plugin.healthStatus.status).toBe('healthy');
                            (0, vitest_1.expect)(plugin.meta.category).toBe('core');
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('getDependencies() - プラグイン依存関係分析', function () {
        (0, vitest_1.it)('🔴 プラグインの依存関係情報を取得できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'complex-plugin';
                        return [4 /*yield*/, pluginManagementAPI.getDependencies(nodeType)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.nodeType).toBe(nodeType);
                        (0, vitest_1.expect)(Array.isArray(result.dependencies)).toBe(true);
                        (0, vitest_1.expect)(Array.isArray(result.dependents)).toBe(true);
                        (0, vitest_1.expect)(typeof result.circularDependencies).toBe('boolean');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 循環依存の検出と警告を行う', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.getDependencies('circular-plugin')];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.circularDependencies).toBe(true);
                        (0, vitest_1.expect)((_a = result.warnings) === null || _a === void 0 ? void 0 : _a.some(function (w) { return w.includes('circular'); })).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('bulkOperation() - 一括操作機能', function () {
        (0, vitest_1.it)('🔴 複数プラグインの一括登録が成功する', function () { return __awaiter(void 0, void 0, void 0, function () {
            var plugins, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        plugins = [
                            {
                                nodeType: 'bulk-test-1',
                                database: { entityStore: 'bulk1', schema: {}, version: 1 },
                                meta: { name: 'Bulk Test 1', version: '1.0.0' },
                            },
                            {
                                nodeType: 'bulk-test-2',
                                database: { entityStore: 'bulk2', schema: {}, version: 1 },
                                meta: { name: 'Bulk Test 2', version: '1.0.0' },
                            },
                        ];
                        return [4 /*yield*/, pluginManagementAPI.bulkOperation({
                                operation: 'register',
                                plugins: plugins,
                            })];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.successful).toHaveLength(2);
                        (0, vitest_1.expect)(result.failed).toHaveLength(0);
                        (0, vitest_1.expect)(result.summary.total).toBe(2);
                        (0, vitest_1.expect)(result.summary.success).toBe(2);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('🔴 部分的失敗を含む一括操作で詳細な結果を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeTypes, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeTypes = ['valid-plugin', 'invalid-plugin', 'another-valid'];
                        return [4 /*yield*/, pluginManagementAPI.bulkOperation({
                                operation: 'unregister',
                                nodeTypes: nodeTypes,
                            })];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.summary.total).toBe(3);
                        (0, vitest_1.expect)(result.summary.success + result.summary.failed).toBe(3);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

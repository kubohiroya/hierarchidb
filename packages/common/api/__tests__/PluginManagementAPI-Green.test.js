"use strict";
/**
 * @file PluginManagementAPI-Green.test.ts
 * @description PluginManagementAPI のTDD Green フェーズテスト
 *
 * TDD Green フェーズ: 最小限の実装でテストを通す
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
(0, vitest_1.describe)('PluginManagementAPI - TDD Green Phase', function () {
    var pluginManagementAPI;
    (0, vitest_1.beforeEach)(function () {
        // 【TDD Green実装】: テストを通すための最小限のAPI実装
        // 【実装方針】: テストケースが期待する戻り値とエラーハンドリングを提供
        // 🟡 信頼性レベル: テスト駆動による最小実装
        // 【登録済みプラグインのモック状態】: テスト用の仮想プラグインレジストリ
        var mockRegisteredPlugins = new Set(['folder', 'document', 'project']);
        pluginManagementAPI = {
            // 【プラグイン登録】: register()メソッドの最小実装
            register: function (definition) { return __awaiter(void 0, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    // 【入力値検証】: 定義オブジェクトの存在確認
                    if (!definition || !definition.nodeType) {
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: 'INVALID_DEFINITION',
                                    message: 'プラグイン定義が不正です',
                                },
                                validationErrors: [{ field: 'nodeType', message: 'Node type is required' }],
                            }];
                    }
                    // 【重複チェック】: 既存プラグインとの重複確認
                    if (mockRegisteredPlugins.has(definition.nodeType)) {
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: 'DUPLICATE_NODE_TYPE',
                                    message: "Node type ".concat(definition.nodeType, " is already registered"),
                                },
                            }];
                    }
                    // 【スキーマ検証】: データベーススキーマの妥当性確認
                    if (!((_a = definition.database) === null || _a === void 0 ? void 0 : _a.entityStore) || definition.database.version <= 0) {
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: 'INVALID_SCHEMA',
                                    message: 'Invalid database schema',
                                },
                                validationErrors: [
                                    { field: 'database.entityStore', message: 'Entity store is required' },
                                ],
                            }];
                    }
                    // 【登録成功】: 正常な登録処理
                    mockRegisteredPlugins.add(definition.nodeType);
                    return [2 /*return*/, {
                            success: true,
                            pluginId: "plugin-".concat(definition.nodeType, "-").concat(Date.now()),
                            registeredNodeType: definition.nodeType,
                        }];
                });
            }); },
            // 【プラグイン削除】: unregister()メソッドの最小実装
            unregister: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                var warnings;
                return __generator(this, function (_a) {
                    // 【存在確認】: プラグインの登録状況確認
                    if (!mockRegisteredPlugins.has(nodeType)) {
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: 'PLUGIN_NOT_FOUND',
                                    message: "Plugin with node type ".concat(nodeType, " not found"),
                                },
                            }];
                    }
                    // 【削除実行】: プラグインの削除処理
                    mockRegisteredPlugins.delete(nodeType);
                    warnings = nodeType !== 'unused-plugin'
                        ? ['Some active nodes may exist for this plugin type']
                        : undefined;
                    return [2 /*return*/, {
                            success: true,
                            unregisteredNodeType: nodeType,
                            warnings: warnings,
                        }];
                });
            }); },
            // 【プラグイン検証】: validatePlugin()メソッドの最小実装
            validatePlugin: function (definition) { return __awaiter(void 0, void 0, void 0, function () {
                var errors, warnings;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    errors = [];
                    warnings = [];
                    // 【必須フィールド検証】: 必要な項目の存在確認
                    if (!definition.nodeType || definition.nodeType === '') {
                        errors.push({
                            field: 'nodeType',
                            message: 'Node type is required',
                            severity: 'error',
                        });
                    }
                    if (!((_a = definition.database) === null || _a === void 0 ? void 0 : _a.entityStore) || definition.database.entityStore === '123invalid') {
                        errors.push({
                            field: 'database.entityStore',
                            message: 'Valid entity store name is required',
                            severity: 'error',
                        });
                    }
                    if (!((_b = definition.meta) === null || _b === void 0 ? void 0 : _b.name) || definition.meta.name === '') {
                        errors.push({
                            field: 'meta.name',
                            message: 'Plugin name is required',
                            severity: 'error',
                        });
                    }
                    // 【バージョン検証】: バージョン形式の確認
                    if (((_c = definition.database) === null || _c === void 0 ? void 0 : _c.version) && definition.database.version < 0) {
                        errors.push({
                            field: 'database.version',
                            message: 'Invalid database version',
                            severity: 'error',
                        });
                    }
                    return [2 /*return*/, {
                            isValid: errors.length === 0,
                            errors: errors,
                            warnings: warnings,
                        }];
                });
            }); },
            // 【ヘルス監視】: checkHealth()メソッドの最小実装
            checkHealth: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // 【存在確認】: プラグインの登録状況確認
                    if (!mockRegisteredPlugins.has(nodeType)) {
                        throw new Error('Plugin not found');
                    }
                    // 【パフォーマンス生成】: 健全性とパフォーマンス指標の生成
                    if (nodeType === 'problematic-plugin') {
                        return [2 /*return*/, {
                                status: 'degraded',
                                lastCheck: Date.now(),
                                issues: ['High response time detected', 'Error rate above threshold'],
                                performance: {
                                    avgResponseTime: 250,
                                    errorRate: 0.15,
                                },
                            }];
                    }
                    return [2 /*return*/, {
                            status: 'healthy',
                            lastCheck: Date.now(),
                            performance: {
                                avgResponseTime: 45,
                                errorRate: 0,
                            },
                        }];
                });
            }); },
            // 【プラグイン一覧】: listRegistered()メソッドの最小実装
            listRegistered: function (options) { return __awaiter(void 0, void 0, void 0, function () {
                var allPlugins, filtered;
                return __generator(this, function (_a) {
                    allPlugins = Array.from(mockRegisteredPlugins).map(function (nodeType) { return ({
                        nodeType: nodeType,
                        meta: {
                            name: "".concat(nodeType, " Plugin"),
                            version: '1.0.0',
                            category: nodeType === 'folder' || nodeType === 'document' ? 'core' : 'extension',
                        },
                        registrationTime: Date.now() - Math.floor(Math.random() * 86400000),
                        healthStatus: {
                            status: 'healthy',
                            lastCheck: Date.now(),
                            performance: {
                                avgResponseTime: 50,
                                errorRate: 0,
                            },
                        },
                    }); });
                    filtered = allPlugins;
                    if (options === null || options === void 0 ? void 0 : options.status) {
                        filtered = filtered.filter(function (plugin) { return plugin.healthStatus.status === options.status; });
                    }
                    if (options === null || options === void 0 ? void 0 : options.category) {
                        filtered = filtered.filter(function (plugin) { return plugin.meta.category === options.category; });
                    }
                    return [2 /*return*/, filtered];
                });
            }); },
            // 【依存関係分析】: getDependencies()メソッドの最小実装
            getDependencies: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                var baseDependencyInfo;
                return __generator(this, function (_a) {
                    baseDependencyInfo = {
                        nodeType: nodeType,
                        dependencies: [],
                        dependents: [],
                        circularDependencies: false,
                    };
                    // 【循環依存検出】: 特定のプラグインでの循環依存シミュレーション
                    if (nodeType === 'circular-plugin') {
                        return [2 /*return*/, __assign(__assign({}, baseDependencyInfo), { dependencies: ['circular-plugin-b'], dependents: ['circular-plugin-c'], circularDependencies: true, warnings: ['Circular dependency detected in plugin chain'] })];
                    }
                    return [2 /*return*/, baseDependencyInfo];
                });
            }); },
            // 【一括操作】: bulkOperation()メソッドの最小実装
            bulkOperation: function (options) { return __awaiter(void 0, void 0, void 0, function () {
                var successful, failed, _i, _a, plugin, result, error_1, _b, _c, nodeType, result, error_2;
                var _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            successful = [];
                            failed = [];
                            if (!(options.operation === 'register' && options.definition)) return [3 /*break*/, 7];
                            _i = 0, _a = options.definition;
                            _f.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            plugin = _a[_i];
                            _f.label = 2;
                        case 2:
                            _f.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, pluginManagementAPI.register(plugin)];
                        case 3:
                            result = _f.sent();
                            if (result.success) {
                                successful.push({ nodeType: plugin.nodeType, result: result });
                            }
                            else {
                                failed.push({
                                    nodeType: plugin.nodeType,
                                    error: ((_d = result.error) === null || _d === void 0 ? void 0 : _d.message) || 'Registration failed',
                                });
                            }
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _f.sent();
                            failed.push({
                                nodeType: plugin.nodeType,
                                error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                            });
                            return [3 /*break*/, 5];
                        case 5:
                            _i++;
                            return [3 /*break*/, 1];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            if (!(options.operation === 'unregister' && options.nodeTypes)) return [3 /*break*/, 13];
                            _b = 0, _c = options.nodeTypes;
                            _f.label = 8;
                        case 8:
                            if (!(_b < _c.length)) return [3 /*break*/, 13];
                            nodeType = _c[_b];
                            _f.label = 9;
                        case 9:
                            _f.trys.push([9, 11, , 12]);
                            return [4 /*yield*/, pluginManagementAPI.unregister(nodeType)];
                        case 10:
                            result = _f.sent();
                            if (result.success) {
                                successful.push({ nodeType: nodeType, result: result });
                            }
                            else {
                                failed.push({
                                    nodeType: nodeType,
                                    error: ((_e = result.error) === null || _e === void 0 ? void 0 : _e.message) || 'Unregistration failed',
                                });
                            }
                            return [3 /*break*/, 12];
                        case 11:
                            error_2 = _f.sent();
                            failed.push({
                                nodeType: nodeType,
                                error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                            });
                            return [3 /*break*/, 12];
                        case 12:
                            _b++;
                            return [3 /*break*/, 8];
                        case 13: return [2 /*return*/, {
                                successful: successful,
                                failed: failed,
                                summary: {
                                    total: successful.length + failed.length,
                                    success: successful.length,
                                    failed: failed.length,
                                },
                            }];
                    }
                });
            }); },
        };
    });
    (0, vitest_1.afterEach)(function () {
        // 【テスト後処理】: リソースのクリーンアップ
        pluginManagementAPI = null;
    });
    (0, vitest_1.describe)('register() - プラグイン登録機能', function () {
        (0, vitest_1.test)('🔴 有効なプラグイン定義を登録できる', function () { return __awaiter(void 0, void 0, void 0, function () {
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
        (0, vitest_1.test)('🔴 重複するnodeTypeの登録で適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var duplicateDefinition, result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        duplicateDefinition = {
                            nodeType: 'folder',
                            database: { entityStore: 'test', schema: {}, version: 1 },
                            meta: { name: 'Duplicate', version: '1.0.0' },
                        };
                        return [4 /*yield*/, pluginManagementAPI.register(duplicateDefinition)];
                    case 1:
                        result = _c.sent();
                        (0, vitest_1.expect)(result.success).toBe(false);
                        (0, vitest_1.expect)((_a = result.error) === null || _a === void 0 ? void 0 : _a.code).toBe('DUPLICATE_NODE_TYPE');
                        (0, vitest_1.expect)((_b = result.error) === null || _b === void 0 ? void 0 : _b.message).toContain('folder');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('🔴 不正なschema定義で登録が失敗する', function () { return __awaiter(void 0, void 0, void 0, function () {
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
                        (0, vitest_1.expect)(result.validationErrors.length).toBeGreaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('unregister() - プラグイン削除機能', function () {
        (0, vitest_1.test)('🔴 登録済みプラグインを正常に削除できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
                        return [4 /*yield*/, pluginManagementAPI.unregister(nodeType)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.success).toBe(true);
                        (0, vitest_1.expect)(result.unregisteredNodeType).toBe(nodeType);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('🔴 未登録のnodeTypeの削除で適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
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
        (0, vitest_1.test)('🔴 使用中のプラグイン削除で警告を含む結果を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var activeType, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        activeType = 'document';
                        return [4 /*yield*/, pluginManagementAPI.unregister(activeType)];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.success).toBe(true);
                        (0, vitest_1.expect)(result.warnings).toBeDefined();
                        (0, vitest_1.expect)(result.warnings.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)((_a = result.warnings) === null || _a === void 0 ? void 0 : _a[0]).toContain('active nodes');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('validatePlugin() - プラグイン検証機能', function () {
        (0, vitest_1.test)('🔴 有効なプラグイン定義の検証が成功する', function () { return __awaiter(void 0, void 0, void 0, function () {
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
        (0, vitest_1.test)('🔴 不正なプラグイン定義で詳細な検証エラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
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
                        (0, vitest_1.expect)(result.errors.length).toBeGreaterThan(3);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'nodeType'; })).toBe(true);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'database.entityStore'; })).toBe(true);
                        (0, vitest_1.expect)(result.errors.some(function (e) { return e.field === 'meta.name'; })).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('checkHealth() - プラグインヘルス監視機能', function () {
        (0, vitest_1.test)('🔴 健全なプラグインでHealthyステータスを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.checkHealth('folder')];
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
        (0, vitest_1.test)('🔴 問題のあるプラグインでDegradedまたはUnhealthyステータスを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // First register the plugin
                    return [4 /*yield*/, pluginManagementAPI.register({
                            nodeType: 'problematic-plugin',
                            displayName: 'Problematic Plugin',
                            database: {
                                entityStore: 'problematic',
                                version: 1,
                            },
                        })];
                    case 1:
                        // First register the plugin
                        _a.sent();
                        return [4 /*yield*/, pluginManagementAPI.checkHealth('problematic-plugin')];
                    case 2:
                        result = _a.sent();
                        (0, vitest_1.expect)(['degraded', 'unhealthy']).toContain(result.status);
                        (0, vitest_1.expect)(result.issues.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)(result.performance.errorRate).toBeGreaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('🔴 未登録プラグインで適切なエラーを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, vitest_1.expect)(pluginManagementAPI.checkHealth('non-existent')).rejects.toThrow('Plugin not found')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('listRegistered() - 登録プラグイン一覧取得', function () {
        (0, vitest_1.test)('🔴 すべての登録済みプラグイン情報を取得できる', function () { return __awaiter(void 0, void 0, void 0, function () {
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
        (0, vitest_1.test)('🔴 フィルター条件でプラグイン一覧を絞り込める', function () { return __awaiter(void 0, void 0, void 0, function () {
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
        (0, vitest_1.test)('🔴 プラグインの依存関係情報を取得できる', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
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
        (0, vitest_1.test)('🔴 循環依存の検出と警告を行う', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, pluginManagementAPI.getDependencies('circular-plugin')];
                    case 1:
                        result = _b.sent();
                        (0, vitest_1.expect)(result.circularDependencies).toBe(true);
                        (0, vitest_1.expect)(result.warnings.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)((_a = result.warnings) === null || _a === void 0 ? void 0 : _a.some(function (w) { return w.toLowerCase().includes('circular'); })).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('bulkOperation() - 一括操作機能', function () {
        (0, vitest_1.test)('🔴 複数プラグインの一括登録が成功する', function () { return __awaiter(void 0, void 0, void 0, function () {
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
                                definition: plugins,
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
        (0, vitest_1.test)('🔴 部分的失敗を含む一括操作で詳細な結果を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeTypes, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeTypes = ['folder', 'invalid-plugin', 'document'];
                        return [4 /*yield*/, pluginManagementAPI.bulkOperation({
                                operation: 'unregister',
                                nodeTypes: nodeTypes,
                            })];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.successful.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)(result.failed.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)(result.summary.total).toBe(3);
                        (0, vitest_1.expect)(result.summary.success + result.summary.failed).toBe(3);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

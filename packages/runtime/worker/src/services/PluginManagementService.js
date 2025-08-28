"use strict";
/**
 * @file PluginManagementService.ts
 * @description Plugin lifecycle management service implementation
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
exports.PluginManagementService = void 0;
// Import from plugin-registry package
var runtime_plugin_registry_1 = require("@hierarchidb/runtime-plugin-registry");
/**
 * Service implementation for plugin management operations
 */
var PluginManagementService = /** @class */ (function () {
    function PluginManagementService(nodeTypeRegistry) {
        this.nodeTypeRegistry = nodeTypeRegistry;
    }
    PluginManagementService.prototype.register = function (definition) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var validationResult, isAlreadyRegistered, nodeTypeConfig, pluginId;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.validatePlugin(definition)];
                    case 1:
                        validationResult = _b.sent();
                        if (!validationResult.isValid) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: 'INVALID_DEFINITION',
                                        message: 'Plugin definition validation failed'
                                    },
                                    validationErrors: validationResult.errors.map(function (e) { return ({
                                        field: e.field,
                                        message: e.message
                                    }); })
                                }];
                        }
                        return [4 /*yield*/, (0, runtime_plugin_registry_1.isNodeTypeRegistered)(definition.nodeType)];
                    case 2:
                        isAlreadyRegistered = _b.sent();
                        if (isAlreadyRegistered) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: 'DUPLICATE_NODE_TYPE',
                                        message: "Node type ".concat(definition.nodeType, " is already registered")
                                    }
                                }];
                        }
                        try {
                            nodeTypeConfig = __assign(__assign({}, definition), { icon: typeof definition.icon === 'object' ? (_a = definition.icon) === null || _a === void 0 ? void 0 : _a.name : definition.icon });
                            this.nodeTypeRegistry.register(definition.nodeType, nodeTypeConfig);
                            pluginId = "plugin-".concat(definition.nodeType, "-").concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                            return [2 /*return*/, {
                                    success: true,
                                    pluginId: pluginId,
                                    registeredNodeType: definition.nodeType
                                }];
                        }
                        catch (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: 'REGISTRATION_FAILED',
                                        message: error instanceof Error ? error.message : 'Plugin registration failed'
                                    }
                                }];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    PluginManagementService.prototype.unregister = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, dependencyInfo, warnings, trees, rootNode, searchResult, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, runtime_plugin_registry_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _a.sent();
                        if (!isRegistered) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: 'PLUGIN_NOT_FOUND',
                                        message: "Plugin with node type ".concat(nodeType, " not found")
                                    }
                                }];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.getDependencies(nodeType)];
                    case 3:
                        dependencyInfo = _a.sent();
                        warnings = [];
                        if (dependencyInfo.dependents.length > 0) {
                            warnings.push("Plugin has ".concat(dependencyInfo.dependents.length, " dependents that may be affected"));
                        }
                        try {
                            trees = [];
                            if (trees.length === 0) {
                                warnings.push('No trees found for node count verification');
                                return [2 /*return*/, { success: false, error: { code: 'NO_TREES', message: 'No trees available' } }];
                            }
                            rootNode = null;
                            if (!rootNode) {
                                warnings.push('Root node not found for node count verification');
                                return [2 /*return*/, { success: false, error: { code: 'ROOT_NODE_NOT_FOUND', message: 'Root node not available' } }];
                            }
                            searchResult = { nodes: [] };
                            /*
                            await this.queryService.searchNodes({
                              rootNodeId: rootNode.id,
                              query: '', // Empty query to get all nodes
                              maxResults: 1 // Just check if any exist
                            });
                            */
                            if (searchResult && searchResult.nodes.length > 0) {
                                warnings.push('Active nodes of this type exist');
                            }
                        }
                        catch (_b) {
                            warnings.push('Could not verify active node count');
                        }
                        this.nodeTypeRegistry.unregister(nodeType);
                        return [2 /*return*/, {
                                success: true,
                                unregisteredNodeType: nodeType,
                                warnings: warnings.length > 0 ? warnings : undefined
                            }];
                    case 4:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: 'UNREGISTRATION_FAILED',
                                    message: error_1 instanceof Error ? error_1.message : 'Plugin unregistration failed'
                                }
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PluginManagementService.prototype.validatePlugin = function (definition) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, warnings, nodeTypeRegex;
            return __generator(this, function (_a) {
                errors = [];
                warnings = [];
                if (!definition) {
                    errors.push({
                        field: 'root',
                        message: 'Plugin definition is required',
                        severity: 'error'
                    });
                    return [2 /*return*/, { isValid: false, errors: errors, warnings: warnings }];
                }
                if (!definition.nodeType || typeof definition.nodeType !== 'string') {
                    errors.push({
                        field: 'nodeType',
                        message: 'Node type is required and must be a string',
                        severity: 'error'
                    });
                }
                else {
                    nodeTypeRegex = /^[a-z][a-zA-Z0-9_]*$/;
                    if (!nodeTypeRegex.test(definition.nodeType)) {
                        errors.push({
                            field: 'nodeType',
                            message: 'Node type must start with lowercase letter',
                            severity: 'error'
                        });
                    }
                }
                if (!definition.database) {
                    errors.push({
                        field: 'database',
                        message: 'Database configuration is required',
                        severity: 'error'
                    });
                }
                else {
                    if (!definition.database.tableName) {
                        errors.push({
                            field: 'database.tableName',
                            message: 'Table name is required',
                            severity: 'error'
                        });
                    }
                }
                if (!definition.entityHandler) {
                    errors.push({
                        field: 'entityHandler',
                        message: 'Entity handler is required',
                        severity: 'error'
                    });
                }
                return [2 /*return*/, {
                        isValid: errors.length === 0,
                        errors: errors,
                        warnings: warnings
                    }];
            });
        });
    };
    PluginManagementService.prototype.checkHealth = function (nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, definition, startTime, status, issues, pluginDef, requiredMethods, _i, requiredMethods_1, method, tableExists, responseTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, runtime_plugin_registry_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _b.sent();
                        if (!isRegistered) {
                            throw new Error("Plugin ".concat(nodeType, " is not registered"));
                        }
                        return [4 /*yield*/, (0, runtime_plugin_registry_1.getPluginDefinition)(nodeType)];
                    case 2:
                        definition = _b.sent();
                        if (!definition) {
                            throw new Error("Plugin definition not found for ".concat(nodeType));
                        }
                        startTime = Date.now();
                        status = 'healthy';
                        issues = [];
                        try {
                            pluginDef = definition;
                            if (pluginDef.entityHandler) {
                                requiredMethods = ['createEntity', 'updateEntity', 'deleteEntity'];
                                for (_i = 0, requiredMethods_1 = requiredMethods; _i < requiredMethods_1.length; _i++) {
                                    method = requiredMethods_1[_i];
                                    if (typeof pluginDef.entityHandler[method] !== 'function') {
                                        issues.push("Missing required method: ".concat(method));
                                        status = 'unhealthy';
                                    }
                                }
                            }
                            if ((_a = definition.database) === null || _a === void 0 ? void 0 : _a.tableName) {
                                tableExists = false;
                                if (!tableExists) {
                                    issues.push("Table ".concat(definition.database.tableName, " not found"));
                                    status = 'degraded';
                                }
                            }
                            responseTime = Date.now() - startTime;
                            return [2 /*return*/, {
                                    status: status,
                                    lastCheck: Date.now(),
                                    issues: issues.length > 0 ? issues : undefined,
                                    performance: {
                                        avgResponseTime: responseTime,
                                        errorRate: status === 'unhealthy' ? 1 : 0
                                    }
                                }];
                        }
                        catch (error) {
                            return [2 /*return*/, {
                                    status: 'unhealthy',
                                    lastCheck: Date.now(),
                                    issues: ["Health check failed: ".concat(error instanceof Error ? error.message : 'Unknown error')],
                                    performance: {
                                        avgResponseTime: Date.now() - startTime,
                                        errorRate: 1
                                    }
                                }];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    PluginManagementService.prototype.listRegistered = function (options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var plugins, result, _i, plugins_1, plugin, healthStatus, registrationInfo, _c, error_2;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, (0, runtime_plugin_registry_1.getRegisteredPlugins)()];
                    case 1:
                        plugins = _d.sent();
                        result = [];
                        _i = 0, plugins_1 = plugins;
                        _d.label = 2;
                    case 2:
                        if (!(_i < plugins_1.length)) return [3 /*break*/, 7];
                        plugin = plugins_1[_i];
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.checkHealth(plugin.nodeType)];
                    case 4:
                        healthStatus = _d.sent();
                        registrationInfo = {
                            nodeType: plugin.nodeType,
                            meta: {
                                name: plugin.name || plugin.nodeType,
                                version: '1.0.0',
                                category: (_a = plugin.category) === null || _a === void 0 ? void 0 : _a.menuGroup
                            },
                            registrationTime: Date.now(),
                            healthStatus: healthStatus
                        };
                        result.push(registrationInfo);
                        return [3 /*break*/, 6];
                    case 5:
                        _c = _d.sent();
                        result.push({
                            nodeType: plugin.nodeType,
                            meta: {
                                name: plugin.name || plugin.nodeType,
                                version: '1.0.0',
                                category: (_b = plugin.category) === null || _b === void 0 ? void 0 : _b.menuGroup
                            },
                            registrationTime: Date.now(),
                            healthStatus: {
                                status: 'unhealthy',
                                lastCheck: Date.now(),
                                issues: ['Health check failed'],
                                performance: { avgResponseTime: 0, errorRate: 1 }
                            }
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        if (options === null || options === void 0 ? void 0 : options.status) {
                            result = result.filter(function (plugin) { return plugin.healthStatus.status === options.status; });
                        }
                        if (options === null || options === void 0 ? void 0 : options.category) {
                            result = result.filter(function (plugin) { return plugin.meta.category === options.category; });
                        }
                        result.sort(function (a, b) { return a.meta.name.localeCompare(b.meta.name); });
                        return [2 /*return*/, result];
                    case 8:
                        error_2 = _d.sent();
                        throw new Error("Failed to list registered plugins: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    PluginManagementService.prototype.getDependencies = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, definition, dependencies, dependents, warnings, allPlugins, _i, allPlugins_1, plugin, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, runtime_plugin_registry_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _a.sent();
                        if (!isRegistered) {
                            throw new Error("Plugin ".concat(nodeType, " is not registered"));
                        }
                        return [4 /*yield*/, (0, runtime_plugin_registry_1.getPluginDefinition)(nodeType)];
                    case 2:
                        definition = _a.sent();
                        if (!definition) {
                            throw new Error("Plugin definition not found for ".concat(nodeType));
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        dependencies = [];
                        dependents = [];
                        warnings = [];
                        return [4 /*yield*/, (0, runtime_plugin_registry_1.getRegisteredPlugins)()];
                    case 4:
                        allPlugins = _a.sent();
                        for (_i = 0, allPlugins_1 = allPlugins; _i < allPlugins_1.length; _i++) {
                            plugin = allPlugins_1[_i];
                            if (plugin.nodeType !== nodeType) {
                                // Check if other plugins depend on this one
                                // This is simplified - actual implementation would check plugin dependencies
                                // For now, we just return empty arrays
                            }
                        }
                        return [2 /*return*/, {
                                nodeType: nodeType,
                                dependencies: dependencies,
                                dependents: dependents,
                                circularDependencies: false,
                                warnings: warnings.length > 0 ? warnings : undefined
                            }];
                    case 5:
                        error_3 = _a.sent();
                        throw new Error("Failed to analyze dependencies for ".concat(nodeType, ": ").concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    PluginManagementService.prototype.bulkOperation = function (options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var successful, failed, _i, _c, plugin, result, error_4, _d, _e, nodeType, result, error_5, error_6;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        successful = [];
                        failed = [];
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 17, , 18]);
                        if (!(options.operation === 'register' && options.plugins)) return [3 /*break*/, 8];
                        _i = 0, _c = options.plugins;
                        _f.label = 2;
                    case 2:
                        if (!(_i < _c.length)) return [3 /*break*/, 7];
                        plugin = _c[_i];
                        _f.label = 3;
                    case 3:
                        _f.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.register(plugin)];
                    case 4:
                        result = _f.sent();
                        if (result.success) {
                            successful.push({
                                nodeType: plugin.nodeType,
                                result: {
                                    pluginId: result.pluginId,
                                    registeredNodeType: result.registeredNodeType
                                }
                            });
                        }
                        else {
                            failed.push({
                                nodeType: plugin.nodeType,
                                error: ((_a = result.error) === null || _a === void 0 ? void 0 : _a.message) || 'Registration failed'
                            });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _f.sent();
                        failed.push({
                            nodeType: plugin.nodeType,
                            error: error_4 instanceof Error ? error_4.message : 'Unknown registration error'
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [3 /*break*/, 16];
                    case 8:
                        if (!(options.operation === 'unregister' && options.nodeTypes)) return [3 /*break*/, 15];
                        _d = 0, _e = options.nodeTypes;
                        _f.label = 9;
                    case 9:
                        if (!(_d < _e.length)) return [3 /*break*/, 14];
                        nodeType = _e[_d];
                        _f.label = 10;
                    case 10:
                        _f.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.unregister(nodeType)];
                    case 11:
                        result = _f.sent();
                        if (result.success) {
                            successful.push({
                                nodeType: nodeType,
                                result: {
                                    unregisteredNodeType: result.unregisteredNodeType,
                                    warnings: result.warnings
                                }
                            });
                        }
                        else {
                            failed.push({
                                nodeType: nodeType,
                                error: ((_b = result.error) === null || _b === void 0 ? void 0 : _b.message) || 'Unregistration failed'
                            });
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        error_5 = _f.sent();
                        failed.push({
                            nodeType: nodeType,
                            error: error_5 instanceof Error ? error_5.message : 'Unknown unregistration error'
                        });
                        return [3 /*break*/, 13];
                    case 13:
                        _d++;
                        return [3 /*break*/, 9];
                    case 14: return [3 /*break*/, 16];
                    case 15: throw new Error('Invalid bulk operation: missing required parameters');
                    case 16: return [2 /*return*/, {
                            successful: successful,
                            failed: failed,
                            summary: {
                                total: successful.length + failed.length,
                                success: successful.length,
                                failed: failed.length
                            }
                        }];
                    case 17:
                        error_6 = _f.sent();
                        throw new Error("Bulk operation failed: ".concat(error_6 instanceof Error ? error_6.message : 'Unknown error'));
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reset plugin entities
     */
    PluginManagementService.prototype.resetPlugin = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeType, resetMode, _a, createBackup, backupLocation, deletedEntities;
            return __generator(this, function (_b) {
                nodeType = options.nodeType, resetMode = options.resetMode, _a = options.createBackup, createBackup = _a === void 0 ? false : _a;
                try {
                    // Check if plugin is registered
                    if (!this.nodeTypeRegistry.has(nodeType)) {
                        return [2 /*return*/, {
                                success: false,
                                nodeType: nodeType,
                                deletedEntities: {},
                                error: {
                                    code: 'PLUGIN_NOT_FOUND',
                                    message: "Plugin '".concat(nodeType, "' is not registered")
                                }
                            }];
                    }
                    backupLocation = void 0;
                    if (createBackup) {
                        // TODO: Implement backup creation
                        backupLocation = "/backups/plugin-".concat(nodeType, "-").concat(Date.now(), ".zip");
                    }
                    deletedEntities = {
                        groupEntities: 0,
                        relationalEntities: 0,
                        treeNodes: 0,
                        peerEntities: 0,
                    };
                    switch (resetMode) {
                        case 'individual':
                            // Delete only GroupEntity and RelationalEntity for this plugin
                            // TODO: Implement actual deletion from Dexie stores
                            // For now, return mock data
                            deletedEntities.groupEntities = 0;
                            deletedEntities.relationalEntities = 0;
                            // Don't set treeNodes and peerEntities for individual reset
                            delete deletedEntities.treeNodes;
                            delete deletedEntities.peerEntities;
                            break;
                        case 'folder':
                            // Delete everything (special case for folder-plugin plugin)
                            if (nodeType !== 'folder') {
                                return [2 /*return*/, {
                                        success: false,
                                        nodeType: nodeType,
                                        deletedEntities: {
                                            groupEntities: 0,
                                            relationalEntities: 0,
                                            treeNodes: 0,
                                            peerEntities: 0,
                                        },
                                        error: {
                                            code: 'INVALID_RESET_MODE',
                                            message: "Reset mode 'folder' is only valid for folder plugin"
                                        }
                                    }];
                            }
                            // TODO: Implement complete data deletion
                            deletedEntities.groupEntities = 0;
                            deletedEntities.relationalEntities = 0;
                            deletedEntities.treeNodes = 0;
                            deletedEntities.peerEntities = 0;
                            break;
                        case 'system':
                            // Reset entire system
                            // TODO: Implement system-wide reset
                            deletedEntities.groupEntities = 0;
                            deletedEntities.relationalEntities = 0;
                            deletedEntities.treeNodes = 0;
                            deletedEntities.peerEntities = 0;
                            break;
                        default:
                            return [2 /*return*/, {
                                    success: false,
                                    nodeType: nodeType,
                                    deletedEntities: {},
                                    error: {
                                        code: 'INVALID_RESET_MODE',
                                        message: "Invalid reset mode: ".concat(resetMode)
                                    }
                                }];
                    }
                    return [2 /*return*/, __assign({ success: true, nodeType: nodeType, deletedEntities: deletedEntities }, (backupLocation && { backupLocation: backupLocation }))];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            nodeType: nodeType,
                            deletedEntities: {
                                groupEntities: 0,
                                relationalEntities: 0,
                                treeNodes: 0,
                                peerEntities: 0,
                            },
                            error: {
                                code: 'RESET_FAILED',
                                message: error instanceof Error ? error.message : 'Unknown error'
                            }
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Delete a plugin completely
     */
    PluginManagementService.prototype.deletePlugin = function (nodeType) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var warnings, registeredNodeTypes, _i, registeredNodeTypes_1, registeredNodeType, pluginDefinition, typedDefinition, error_7;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        // Check if it's the folder-plugin plugin (cannot be deleted)
                        if (nodeType === 'folder') {
                            return [2 /*return*/, {
                                    success: false,
                                    nodeType: nodeType,
                                    error: {
                                        code: 'CORE_PLUGIN',
                                        message: 'The folder-plugin plugin is a core plugin and cannot be deleted'
                                    }
                                }];
                        }
                        // Check if plugin exists
                        if (!this.nodeTypeRegistry.has(nodeType)) {
                            return [2 /*return*/, {
                                    success: false,
                                    nodeType: nodeType,
                                    error: {
                                        code: 'PLUGIN_NOT_FOUND',
                                        message: "Plugin '".concat(nodeType, "' is not registered")
                                    }
                                }];
                        }
                        warnings = [];
                        registeredNodeTypes = this.nodeTypeRegistry.getAll();
                        for (_i = 0, registeredNodeTypes_1 = registeredNodeTypes; _i < registeredNodeTypes_1.length; _i++) {
                            registeredNodeType = registeredNodeTypes_1[_i];
                            pluginDefinition = this.nodeTypeRegistry.get(registeredNodeType);
                            typedDefinition = pluginDefinition;
                            if ((_b = (_a = typedDefinition === null || typedDefinition === void 0 ? void 0 : typedDefinition.meta) === null || _a === void 0 ? void 0 : _a.dependencies) === null || _b === void 0 ? void 0 : _b.includes(nodeType)) {
                                warnings.push("Plugin '".concat(registeredNodeType, "' depends on '").concat(nodeType, "'"));
                            }
                        }
                        // Unregister the plugin
                        return [4 /*yield*/, this.unregister(nodeType)];
                    case 1:
                        // Unregister the plugin
                        _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                nodeType: nodeType,
                                warnings: warnings.length > 0 ? warnings : undefined
                            }];
                    case 2:
                        error_7 = _c.sent();
                        return [2 /*return*/, {
                                success: false,
                                nodeType: nodeType,
                                error: {
                                    code: 'DELETE_FAILED',
                                    message: error_7 instanceof Error ? error_7.message : 'Unknown error'
                                }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reset the entire system
     */
    PluginManagementService.prototype.resetSystem = function (createBackup) {
        if (createBackup === void 0) { createBackup = false; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.resetPlugin({
                        nodeType: 'folder',
                        resetMode: 'system',
                        createBackup: createBackup
                    })];
            });
        });
    };
    return PluginManagementService;
}());
exports.PluginManagementService = PluginManagementService;

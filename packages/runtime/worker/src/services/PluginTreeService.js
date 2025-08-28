"use strict";
/**
 * @file PluginTreeService.ts
 * @description TreeTypes-specific plugin management service implementation
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
exports.PluginTreeService = void 0;
var plugin_registry_api_1 = require("../registry/plugin-registry-api");
/**
 * Service implementation for tree-specific plugin operations
 */
var PluginTreeService = /** @class */ (function () {
    function PluginTreeService(coreDB, queryService) {
        this.coreDB = coreDB;
        this.queryService = queryService;
    }
    PluginTreeService.prototype.getPluginsForTree = function (request) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var tree, registeredPlugins, plugins, _i, registeredPlugins_1, plugin, definition, isActive, treeRootNode, nodeCount, searchResult, pluginInfo, filteredPlugins, error_1;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 10, , 11]);
                        return [4 /*yield*/, this.queryService.getTree(request.treeId)];
                    case 1:
                        tree = _e.sent();
                        if (!tree) {
                            return [2 /*return*/, {
                                    success: false,
                                    treeId: request.treeId,
                                    plugins: [],
                                    error: {
                                        code: 'TREE_NOT_FOUND',
                                        message: "Tree ".concat(request.treeId, " not found")
                                    }
                                }];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getRegisteredPlugins)()];
                    case 2:
                        registeredPlugins = _e.sent();
                        plugins = [];
                        _i = 0, registeredPlugins_1 = registeredPlugins;
                        _e.label = 3;
                    case 3:
                        if (!(_i < registeredPlugins_1.length)) return [3 /*break*/, 9];
                        plugin = registeredPlugins_1[_i];
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(plugin.nodeType)];
                    case 4:
                        definition = _e.sent();
                        if (!definition)
                            return [3 /*break*/, 8];
                        isActive = !request.includeInactive || true;
                        return [4 /*yield*/, this.queryService.getNode(tree.rootId)];
                    case 5:
                        treeRootNode = _e.sent();
                        nodeCount = 0;
                        if (!treeRootNode) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.queryService.searchNodes({
                                rootNodeId: tree.rootId,
                                query: '',
                                maxResults: 1000 // Large limit to get approximate count
                            })];
                    case 6:
                        searchResult = _e.sent();
                        nodeCount = (searchResult === null || searchResult === void 0 ? void 0 : searchResult.length) || 0;
                        _e.label = 7;
                    case 7:
                        pluginInfo = {
                            nodeType: plugin.nodeType,
                            displayName: plugin.displayName || plugin.nodeType,
                            description: plugin.nodeType + ' plugin',
                            menuGroup: ((_a = definition.category) === null || _a === void 0 ? void 0 : _a.menuGroup) || 'basic',
                            createOrder: ((_b = definition.category) === null || _b === void 0 ? void 0 : _b.createOrder) || 0,
                            creatable: !!((_c = definition.ui) === null || _c === void 0 ? void 0 : _c.dialogComponentPath),
                            isActive: isActive,
                            usageCount: nodeCount,
                            capabilities: this.extractCapabilities(definition),
                            meta: {
                                name: plugin.name || plugin.nodeType,
                                version: '1.0.0',
                                category: (_d = definition.category) === null || _d === void 0 ? void 0 : _d.menuGroup
                            }
                        };
                        plugins.push(pluginInfo);
                        _e.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 3];
                    case 9:
                        filteredPlugins = plugins;
                        if (request.filters) {
                            if (request.filters.nodeTypes) {
                                filteredPlugins = filteredPlugins.filter(function (p) {
                                    return request.filters.nodeTypes.includes(p.nodeType);
                                });
                            }
                            if (request.filters.categories) {
                                filteredPlugins = filteredPlugins.filter(function (p) {
                                    return request.filters.categories.includes(p.menuGroup);
                                });
                            }
                            if (request.filters.capabilities) {
                                filteredPlugins = filteredPlugins.filter(function (p) {
                                    return request.filters.capabilities.every(function (cap) { return p.capabilities.includes(cap); });
                                });
                            }
                        }
                        // Apply sorting
                        if (request.sortBy) {
                            filteredPlugins.sort(function (a, b) {
                                var order = request.sortOrder === 'desc' ? -1 : 1;
                                switch (request.sortBy) {
                                    case 'usageCount':
                                        return (a.usageCount - b.usageCount) * order;
                                    case 'displayName':
                                        return a.displayName.localeCompare(b.displayName) * order;
                                    case 'createOrder':
                                        return (a.createOrder - b.createOrder) * order;
                                    default:
                                        return 0;
                                }
                            });
                        }
                        return [2 /*return*/, {
                                success: true,
                                treeId: request.treeId,
                                plugins: filteredPlugins
                            }];
                    case 10:
                        error_1 = _e.sent();
                        return [2 /*return*/, {
                                success: false,
                                treeId: request.treeId,
                                plugins: [],
                                error: {
                                    code: 'INTERNAL_ERROR',
                                    message: error_1 instanceof Error ? error_1.message : 'Unknown error'
                                }
                            }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    PluginTreeService.prototype.getPluginUsageStats = function (treeId, nodeType, period) {
        return __awaiter(this, void 0, void 0, function () {
            var tree, totalNodes, searchResult, activeNodes, lastUsed, operationStats, filteredOperationStats;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queryService.getTree(treeId)];
                    case 1:
                        tree = _a.sent();
                        totalNodes = 0;
                        if (!tree) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.queryService.searchNodes({
                                rootNodeId: tree.rootId,
                                query: '',
                                maxResults: 10000 // Large limit for stats
                            })];
                    case 2:
                        searchResult = _a.sent();
                        totalNodes = (searchResult === null || searchResult === void 0 ? void 0 : searchResult.length) || 0;
                        _a.label = 3;
                    case 3:
                        activeNodes = totalNodes;
                        lastUsed = Date.now();
                        operationStats = this.generateOperationStats(totalNodes, activeNodes, lastUsed);
                        filteredOperationStats = operationStats;
                        if (period) {
                            filteredOperationStats = operationStats.filter(function (stat) {
                                return stat.timestamp >= period.from && stat.timestamp <= period.to;
                            });
                        }
                        return [2 /*return*/, {
                                treeId: treeId,
                                nodeType: nodeType,
                                totalNodes: totalNodes,
                                activeNodes: activeNodes,
                                lastUsed: lastUsed,
                                period: period,
                                operationStats: filteredOperationStats
                            }];
                }
            });
        });
    };
    PluginTreeService.prototype.getPluginCompatibility = function (treeId, nodeTypes) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var conflicts, warnings, suggestions, pluginDefinitions, entityStores, _i, pluginDefinitions_1, _b, nodeType, definition, storeName, _c, entityStores_1, _d, storeName, types, i, j;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        conflicts = [];
                        warnings = [];
                        suggestions = [];
                        return [4 /*yield*/, Promise.all(nodeTypes.map(function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _a = {
                                                nodeType: nodeType
                                            };
                                            return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                                        case 1: return [2 /*return*/, (_a.definition = _b.sent(),
                                                _a)];
                                    }
                                });
                            }); }))];
                    case 1:
                        pluginDefinitions = _e.sent();
                        entityStores = new Map();
                        for (_i = 0, pluginDefinitions_1 = pluginDefinitions; _i < pluginDefinitions_1.length; _i++) {
                            _b = pluginDefinitions_1[_i], nodeType = _b.nodeType, definition = _b.definition;
                            if ((_a = definition === null || definition === void 0 ? void 0 : definition.database) === null || _a === void 0 ? void 0 : _a.tableName) {
                                storeName = definition.database.tableName;
                                if (!entityStores.has(storeName)) {
                                    entityStores.set(storeName, []);
                                }
                                entityStores.get(storeName).push(nodeType);
                            }
                        }
                        for (_c = 0, entityStores_1 = entityStores; _c < entityStores_1.length; _c++) {
                            _d = entityStores_1[_c], storeName = _d[0], types = _d[1];
                            if (types.length > 1) {
                                for (i = 0; i < types.length - 1; i++) {
                                    for (j = i + 1; j < types.length; j++) {
                                        conflicts.push({
                                            nodeType1: types[i],
                                            nodeType2: types[j],
                                            severity: 'error',
                                            description: "Both plugins use the same entity store: ".concat(storeName)
                                        });
                                    }
                                }
                            }
                        }
                        return [2 /*return*/, {
                                compatible: conflicts.filter(function (c) { return c.severity === 'error'; }).length === 0,
                                conflicts: conflicts,
                                warnings: warnings,
                                suggestions: suggestions.length > 0 ? suggestions : undefined
                            }];
                }
            });
        });
    };
    PluginTreeService.prototype.optimizePluginConfiguration = function (treeId) {
        return __awaiter(this, void 0, void 0, function () {
            var tree, recommendations, allPlugins, usageAnalysis, unusedPlugins, _i, unusedPlugins_1, plugin, currentPerformance, expectedImprovement;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queryService.getTree(treeId)];
                    case 1:
                        tree = _a.sent();
                        if (!tree) {
                            throw new Error("Tree ".concat(treeId, " not found"));
                        }
                        recommendations = [];
                        return [4 /*yield*/, (0, plugin_registry_api_1.getRegisteredPlugins)()];
                    case 2:
                        allPlugins = _a.sent();
                        return [4 /*yield*/, Promise.all(allPlugins.map(function (plugin) { return __awaiter(_this, void 0, void 0, function () {
                                var stats, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, this.getPluginUsageStats(treeId, plugin.nodeType)];
                                        case 1:
                                            stats = _b.sent();
                                            return [2 /*return*/, { plugin: plugin, stats: stats }];
                                        case 2:
                                            _a = _b.sent();
                                            return [2 /*return*/, { plugin: plugin, stats: null }];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 3:
                        usageAnalysis = _a.sent();
                        unusedPlugins = usageAnalysis.filter(function (_a) {
                            var stats = _a.stats;
                            return stats && stats.totalNodes === 0 && stats.lastUsed === 0;
                        });
                        for (_i = 0, unusedPlugins_1 = unusedPlugins; _i < unusedPlugins_1.length; _i++) {
                            plugin = unusedPlugins_1[_i].plugin;
                            recommendations.push({
                                type: 'disable',
                                nodeType: plugin.nodeType,
                                reason: "Plugin ".concat(plugin.displayName || plugin.nodeType, " is not being used"),
                                priority: 7
                            });
                        }
                        currentPerformance = {
                            score: Math.max(0.1, Math.min(1.0, 1.0 - (unusedPlugins.length * 0.1)))
                        };
                        expectedImprovement = {
                            performanceGain: Math.min(0.3, unusedPlugins.length * 0.05)
                        };
                        return [2 /*return*/, {
                                treeId: treeId,
                                recommendations: recommendations,
                                currentPerformance: currentPerformance,
                                expectedImprovement: expectedImprovement
                            }];
                }
            });
        });
    };
    PluginTreeService.prototype.getPluginDependencyGraph = function (treeId, options) {
        return __awaiter(this, void 0, void 0, function () {
            var tree, pluginsForTree, nodes, edges, _i, pluginsForTree_1, plugin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queryService.getTree(treeId)];
                    case 1:
                        tree = _a.sent();
                        if (!tree) {
                            throw new Error("Tree ".concat(treeId, " not found"));
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginsForTree)(treeId)];
                    case 2:
                        pluginsForTree = _a.sent();
                        nodes = [];
                        edges = [];
                        for (_i = 0, pluginsForTree_1 = pluginsForTree; _i < pluginsForTree_1.length; _i++) {
                            plugin = pluginsForTree_1[_i];
                            nodes.push({
                                nodeType: plugin.nodeType,
                                label: plugin.displayName || plugin.nodeType,
                                metrics: {} // Add empty metrics object as expected by the interface
                            });
                        }
                        return [2 /*return*/, {
                                treeId: treeId,
                                nodes: nodes,
                                edges: edges,
                                metadata: {
                                    totalPlugins: nodes.length,
                                    hasCycles: false
                                },
                                layout: (options === null || options === void 0 ? void 0 : options.layout) || 'hierarchical'
                            }];
                }
            });
        });
    };
    PluginTreeService.prototype.getPluginMetrics = function (treeId, nodeType, options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, tree, pluginDefinition, stats, responseTime, metrics;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            this.queryService.getTree(treeId),
                            (0, plugin_registry_api_1.getPluginDefinition)(nodeType)
                        ])];
                    case 1:
                        _a = _b.sent(), tree = _a[0], pluginDefinition = _a[1];
                        if (!tree) {
                            throw new Error("Tree ".concat(treeId, " not found"));
                        }
                        if (!pluginDefinition) {
                            throw new Error("Plugin ".concat(nodeType, " not found"));
                        }
                        return [4 /*yield*/, this.getPluginUsageStats(treeId, nodeType)];
                    case 2:
                        stats = _b.sent();
                        responseTime = 100;
                        metrics = {
                            treeId: treeId,
                            nodeType: nodeType,
                            performance: {
                                averageResponseTime: responseTime,
                                throughput: Math.floor(stats.totalNodes / 10),
                                errorRate: 0.01
                            },
                            resourceUsage: {
                                memoryMB: 5 + Math.floor(stats.totalNodes * 0.1)
                            }
                        };
                        if (options === null || options === void 0 ? void 0 : options.timeRange) {
                            metrics.history = this.generateMetricHistory(metrics, options.timeRange);
                        }
                        return [2 /*return*/, metrics];
                }
            });
        });
    };
    PluginTreeService.prototype.extractCapabilities = function (definition) {
        var _a;
        var capabilities = [];
        if ((_a = definition.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath) {
            capabilities.push('create', 'update');
        }
        capabilities.push('read', 'delete', 'move');
        if (definition.entityHandler) {
            capabilities.push('export', 'validation');
        }
        if (definition.lifecycle) {
            capabilities.push('lifecycle');
        }
        capabilities.push('search', 'offline');
        return capabilities;
    };
    PluginTreeService.prototype.generateOperationStats = function (totalNodes, activeNodes, lastUsed) {
        var operations = ['create', 'edit', 'delete', 'move'];
        var stats = [];
        for (var _i = 0, operations_1 = operations; _i < operations_1.length; _i++) {
            var operation = operations_1[_i];
            var count = 0;
            var baseTimestamp = lastUsed || Date.now();
            switch (operation) {
                case 'create':
                    count = Math.floor(totalNodes * 1.2);
                    break;
                case 'edit':
                    count = Math.floor(activeNodes * 2.5);
                    break;
                case 'delete':
                    count = Math.floor(totalNodes * 0.2);
                    break;
                case 'move':
                    count = Math.floor(activeNodes * 0.5);
                    break;
            }
            stats.push({
                operation: operation,
                count: count,
                timestamp: baseTimestamp - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
            });
        }
        return stats;
    };
    PluginTreeService.prototype.generateMetricHistory = function (baseMetrics, timeRange) {
        var history = [];
        var duration = timeRange.end - timeRange.start;
        var intervalMs = Math.max(60000, Math.floor(duration / 100));
        for (var timestamp = timeRange.start; timestamp <= timeRange.end; timestamp += intervalMs) {
            var variation = 0.8 + (Math.random() * 0.4);
            history.push({
                timestamp: timestamp,
                averageResponseTime: Math.floor(baseMetrics.performance.averageResponseTime * variation),
                throughput: Math.floor(baseMetrics.performance.throughput * variation),
                errorRate: Math.max(0, Math.min(0.1, baseMetrics.performance.errorRate * variation))
            });
        }
        return history;
    };
    return PluginTreeService;
}());
exports.PluginTreeService = PluginTreeService;

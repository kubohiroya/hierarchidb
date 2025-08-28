"use strict";
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
exports.WorkerAPIImpl = void 0;
var Comlink = require("comlink");
var common_core_1 = require("@hierarchidb/common-core");
var CommandProcessor_1 = require("./command/CommandProcessor");
var CoreDB_1 = require("./db/CoreDB");
var EphemeralDB_1 = require("./db/EphemeralDB");
var NodeLifecycleManager_1 = require("./lifecycle/NodeLifecycleManager");
var runtime_plugin_registry_1 = require("@hierarchidb/runtime-plugin-registry");
var default_plugins_1 = require("./registry/default-plugins");
// Services
var TreeMutationService_1 = require("./services/TreeMutationService");
var TreeSubscriptionService_1 = require("./services/TreeSubscriptionService");
var TreeQueryService_1 = require("./services/TreeQueryService");
var ImportService_1 = require("./services/ImportService");
var ExportService_1 = require("./services/ExportService");
var PluginTreeService_1 = require("./services/PluginTreeService");
var NodeTypeService_1 = require("./services/NodeTypeService");
var PluginManagementService_1 = require("./services/PluginManagementService");
var ImportExportAPIImpl_1 = require("./apis/ImportExportAPIImpl");
// import { importExportPluginRegistry } from '@hierarchidb/feature-import-export-plugin-plugin'; // Disabled due to build issues
/**
 * Worker API Facade Implementation
 *
 * Pure facade that delegates to specialized service classes.
 * Maintains single responsibility: routing API calls to appropriate services.
 */
var WorkerAPIImpl = /** @class */ (function () {
    function WorkerAPIImpl(dbName) {
        if (dbName === void 0) { dbName = 'default-worker-db'; }
        this.isInitialized = false;
        this.dbName = dbName;
    }
    WorkerAPIImpl.getSingleton = function (dbName) {
        if (dbName === void 0) { dbName = 'default-worker-db'; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, common_core_1.SingletonMixin.getSingleton(WorkerAPIImpl.name, function () { return __awaiter(_this, void 0, void 0, function () {
                        var instance;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    instance = new WorkerAPIImpl(dbName);
                                    return [4 /*yield*/, instance.initialize()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, instance];
                            }
                        });
                    }); })];
            });
        });
    };
    WorkerAPIImpl.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, unifiedRegistry, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        console.log('[WorkerAPIImpl] Starting initialization...');
                        if (this.isInitialized) {
                            console.log('[WorkerAPIImpl] Already initialized');
                            return [2 /*return*/];
                        }
                        // Initialize databases
                        _a = this;
                        return [4 /*yield*/, CoreDB_1.CoreDB.getSingleton(this.dbName)];
                    case 1:
                        // Initialize databases
                        _a.coreDB = _e.sent();
                        _b = this;
                        return [4 /*yield*/, EphemeralDB_1.EphemeralDB.getSingleton(this.dbName)];
                    case 2:
                        _b.ephemeralDB = _e.sent();
                        // Initialize registries
                        _c = this;
                        return [4 /*yield*/, runtime_plugin_registry_1.SimpleNodeTypeRegistry.getSingleton()];
                    case 3:
                        // Initialize registries
                        _c.nodeTypeRegistry = _e.sent();
                        unifiedRegistry = runtime_plugin_registry_1.UnifiedNodeTypeRegistry.getInstance();
                        (0, default_plugins_1.registerDefaultPlugins)(unifiedRegistry);
                        // Register Import/Export plugins with dependency resolution
                        try {
                            // const registrationResult = await importExportPluginRegistry.registerAllPlugins(unifiedRegistry); // Disabled due to build issues
                            // if (registrationResult.success) {
                            //   console.log('[WorkerAPIImpl] Import/Export plugins registered successfully:', registrationResult.registered);
                            // } else {
                            //   console.warn('[WorkerAPIImpl] Some Import/Export plugins failed to register:', registrationResult.errors);
                            // } // Disabled due to build issues
                        }
                        catch (error) {
                            console.error('[WorkerAPIImpl] Failed to register Import/Export plugins:', error);
                        }
                        // Initialize lifecycle manager
                        this.nodeLifecycleManager = new NodeLifecycleManager_1.NodeLifecycleManager(this.nodeTypeRegistry, this.coreDB, this.ephemeralDB);
                        // Initialize command processor
                        this.commandProcessor = new CommandProcessor_1.CommandProcessor();
                        // Initialize core services
                        this.queryService = new TreeQueryService_1.TreeQueryService(this.coreDB);
                        this.subscriptionService = new TreeSubscriptionService_1.TreeSubscriptionService(this.coreDB);
                        this.mutationService = new TreeMutationService_1.TreeMutationService(this.coreDB, this.ephemeralDB, this.commandProcessor, this.nodeLifecycleManager);
                        // Initialize plugin services
                        this.pluginTreeService = new PluginTreeService_1.PluginTreeService(this.coreDB, this.queryService);
                        this.nodeTypeService = new NodeTypeService_1.NodeTypeService(this.nodeTypeRegistry, this.queryService);
                        this.pluginManagementService = new PluginManagementService_1.PluginManagementService(this.nodeTypeRegistry);
                        // Initialize import/export services
                        this.importService = new ImportService_1.ImportService(this.coreDB, this.mutationService);
                        this.exportService = new ExportService_1.ExportService(this.coreDB, this.queryService);
                        _d = this;
                        return [4 /*yield*/, ImportExportAPIImpl_1.ImportExportAPIImpl.getInstance()];
                    case 4:
                        _d.importExportAPI = _e.sent();
                        this.isInitialized = true;
                        console.log('[WorkerAPIImpl] Initialization complete');
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkerAPIImpl.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Cleanup all subscriptions
                    return [4 /*yield*/, this.subscriptionService.unsubscribeAll()];
                    case 1:
                        // Cleanup all subscriptions
                        _a.sent();
                        // Close databases
                        return [4 /*yield*/, this.coreDB.close()];
                    case 2:
                        // Close databases
                        _a.sent();
                        return [4 /*yield*/, this.ephemeralDB.close()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==================
    // Facade API Methods - Pure delegation to services
    // ==================
    WorkerAPIImpl.prototype.getQueryAPI = function () {
        return this.queryService;
    };
    WorkerAPIImpl.prototype.getMutationAPI = function () {
        return this.mutationService;
    };
    WorkerAPIImpl.prototype.getSubscriptionAPI = function () {
        var _this = this;
        // Create a proper TreeSubscriptionAPI implementation
        var subscriptionAPI = {
            subscribeNode: function (nodeId, callback, options) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.subscribeNode(nodeId, callback, options)];
                        case 1: 
                        // Use the new API method that directly accepts callback
                        return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            subscribeSubtree: function (nodeId, callback, options) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.subscribeSubtree(nodeId, callback, options)];
                        case 1: 
                        // Use the new API method that directly accepts callback
                        return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            subscribeTree: function (treeId, callback, options) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.subscribeTree(treeId, callback, options)];
                        case 1: 
                        // Use the new API method that directly accepts callback
                        return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            unsubscribe: function (subscriptionId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.unsubscribe(subscriptionId)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            unsubscribeNode: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.unsubscribeNode(nodeId)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            unsubscribeTree: function (treeId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.subscriptionService.unsubscribeTree(treeId)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            unsubscribeAll: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.subscriptionService.unsubscribeAll()];
                });
            }); },
            listActiveSubscriptions: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, []];
                });
            }); },
            isSubscriptionActive: function (subscriptionId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, false];
                });
            }); },
            getSubscriptionStats: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, {
                            totalActive: 0,
                            nodeSubscriptions: 0,
                            subtreeSubscriptions: 0,
                            treeSubscriptions: 0,
                            eventsProcessedToday: 0,
                            averageEventLatency: 0
                        }];
                });
            }); },
            getRecentEvents: function (nodeId, limit) {
                if (limit === void 0) { limit = 50; }
                return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, []];
                    });
                });
            },
            getEventHistory: function (startTime, endTime, nodeId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, []];
                });
            }); }
        };
        return Comlink.proxy(subscriptionAPI);
    };
    WorkerAPIImpl.prototype.getWorkingCopyAPI = function () {
        var _this = this;
        // Create a complete WorkingCopyAPI implementation
        var workingCopyAPI = {
            // Basic operations
            createDraftWorkingCopy: function (nodeType, parentId, initialData) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopyId, workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            workingCopyId = "wc-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                            workingCopy = __assign({ id: workingCopyId, parentId: parentId || undefined, nodeType: nodeType, name: (initialData === null || initialData === void 0 ? void 0 : initialData.name) || "New ".concat(nodeType), createdAt: Date.now(), updatedAt: Date.now(), version: 1, copiedAt: Date.now() }, initialData);
                            return [4 /*yield*/, this.ephemeralDB.createWorkingCopy(workingCopy)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, workingCopy];
                    }
                });
            }); },
            createWorkingCopyFromNode: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                var node, workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.coreDB.getNode(nodeId)];
                        case 1:
                            node = _a.sent();
                            if (!node) {
                                throw new Error("Node ".concat(nodeId, " not found"));
                            }
                            workingCopy = __assign(__assign({}, node), { copiedAt: Date.now() });
                            return [4 /*yield*/, this.ephemeralDB.createWorkingCopy(workingCopy)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, workingCopy];
                    }
                });
            }); },
            getWorkingCopy: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                });
            }); },
            updateWorkingCopy: function (nodeId, updates) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopy, updatedWorkingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 1:
                            workingCopy = _a.sent();
                            if (!workingCopy) {
                                throw new Error("Working copy for ".concat(nodeId, " not found"));
                            }
                            updatedWorkingCopy = __assign(__assign(__assign({}, workingCopy), updates), { updatedAt: Date.now() });
                            return [4 /*yield*/, this.ephemeralDB.updateWorkingCopy(updatedWorkingCopy)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, updatedWorkingCopy];
                    }
                });
            }); },
            listWorkingCopies: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.ephemeralDB.listWorkingCopies()];
                });
            }); },
            hasWorkingCopy: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 1:
                            workingCopy = _a.sent();
                            return [2 /*return*/, !!workingCopy];
                    }
                });
            }); },
            // Commit and discard operations
            commitWorkingCopy: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 1:
                            workingCopy = _a.sent();
                            if (!workingCopy) {
                                return [2 /*return*/, { success: false, error: 'Working copy not found' }];
                            }
                            // In a real implementation, this would save to CoreDB
                            // For now, just remove from EphemeralDB
                            return [4 /*yield*/, this.ephemeralDB.discardWorkingCopy(nodeId)];
                        case 2:
                            // In a real implementation, this would save to CoreDB
                            // For now, just remove from EphemeralDB
                            _a.sent();
                            return [2 /*return*/, { success: true, nodeId: nodeId }];
                    }
                });
            }); },
            discardWorkingCopy: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.ephemeralDB.discardWorkingCopy(nodeId)];
                });
            }); },
            discardAllWorkingCopies: function () { return __awaiter(_this, void 0, void 0, function () {
                var workingCopies, _i, workingCopies_1, wc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.listWorkingCopies()];
                        case 1:
                            workingCopies = _a.sent();
                            _i = 0, workingCopies_1 = workingCopies;
                            _a.label = 2;
                        case 2:
                            if (!(_i < workingCopies_1.length)) return [3 /*break*/, 5];
                            wc = workingCopies_1[_i];
                            return [4 /*yield*/, this.ephemeralDB.discardWorkingCopy(wc.id)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/, workingCopies.length];
                    }
                });
            }); },
            // Validation operations
            validateWorkingCopy: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 1:
                            workingCopy = _a.sent();
                            if (!workingCopy) {
                                return [2 /*return*/, { valid: false, message: 'Working copy not found' }];
                            }
                            return [2 /*return*/, { valid: true }];
                    }
                });
            }); },
            hasUnsavedChanges: function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 1:
                            workingCopy = _a.sent();
                            return [2 /*return*/, !!workingCopy];
                    }
                });
            }); },
            // Bulk operations
            commitMultipleWorkingCopies: function (nodeIds) { return __awaiter(_this, void 0, void 0, function () {
                var results, _i, nodeIds_1, nodeId, workingCopy, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            results = [];
                            _i = 0, nodeIds_1 = nodeIds;
                            _a.label = 1;
                        case 1:
                            if (!(_i < nodeIds_1.length)) return [3 /*break*/, 9];
                            nodeId = nodeIds_1[_i];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 7, , 8]);
                            return [4 /*yield*/, this.ephemeralDB.getWorkingCopy(nodeId)];
                        case 3:
                            workingCopy = _a.sent();
                            if (!workingCopy) return [3 /*break*/, 5];
                            // In a real implementation, this would save to CoreDB
                            return [4 /*yield*/, this.ephemeralDB.discardWorkingCopy(nodeId)];
                        case 4:
                            // In a real implementation, this would save to CoreDB
                            _a.sent();
                            results.push({ success: true, nodeId: nodeId });
                            return [3 /*break*/, 6];
                        case 5:
                            results.push({ success: false, error: 'Working copy not found' });
                            _a.label = 6;
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_1 = _a.sent();
                            results.push({ success: false, error: error_1 instanceof Error ? error_1.message : 'Unknown error' });
                            return [3 /*break*/, 8];
                        case 8:
                            _i++;
                            return [3 /*break*/, 1];
                        case 9: return [2 /*return*/, results];
                    }
                });
            }); },
            createMultipleWorkingCopies: function (nodeIds) { return __awaiter(_this, void 0, void 0, function () {
                var results, _i, nodeIds_2, nodeId, node, workingCopy, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            results = [];
                            _i = 0, nodeIds_2 = nodeIds;
                            _a.label = 1;
                        case 1:
                            if (!(_i < nodeIds_2.length)) return [3 /*break*/, 8];
                            nodeId = nodeIds_2[_i];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 6, , 7]);
                            return [4 /*yield*/, this.coreDB.getNode(nodeId)];
                        case 3:
                            node = _a.sent();
                            if (!node) return [3 /*break*/, 5];
                            workingCopy = __assign(__assign({}, node), { copiedAt: Date.now() // Required by WorkingCopyProperties
                             });
                            return [4 /*yield*/, this.ephemeralDB.createWorkingCopy(workingCopy)];
                        case 4:
                            _a.sent();
                            results.push(workingCopy);
                            _a.label = 5;
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            error_2 = _a.sent();
                            return [3 /*break*/, 7];
                        case 7:
                            _i++;
                            return [3 /*break*/, 1];
                        case 8: return [2 /*return*/, results];
                    }
                });
            }); },
            // Working Copy Status
            getWorkingCopyStats: function () { return __awaiter(_this, void 0, void 0, function () {
                var workingCopies, now;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.listWorkingCopies()];
                        case 1:
                            workingCopies = _a.sent();
                            now = Date.now();
                            return [2 /*return*/, {
                                    total: workingCopies.length,
                                    drafts: workingCopies.filter(function (wc) { return wc.isDraft; }).length,
                                    edits: workingCopies.filter(function (wc) { return !wc.isDraft; }).length,
                                    oldestTimestamp: workingCopies.reduce(function (oldest, wc) { return Math.min(oldest, wc.updatedAt); }, now),
                                    newestTimestamp: workingCopies.reduce(function (newest, wc) { return Math.max(newest, wc.updatedAt); }, 0)
                                }];
                    }
                });
            }); },
            cleanupOldWorkingCopies: function (olderThan) { return __awaiter(_this, void 0, void 0, function () {
                var workingCopies, toDelete, _i, toDelete_1, wc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ephemeralDB.listWorkingCopies()];
                        case 1:
                            workingCopies = _a.sent();
                            toDelete = workingCopies.filter(function (wc) { return wc.updatedAt < olderThan; });
                            _i = 0, toDelete_1 = toDelete;
                            _a.label = 2;
                        case 2:
                            if (!(_i < toDelete_1.length)) return [3 /*break*/, 5];
                            wc = toDelete_1[_i];
                            return [4 /*yield*/, this.ephemeralDB.discardWorkingCopy(wc.id)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/, toDelete.length];
                    }
                });
            }); }
        };
        return Comlink.proxy(workingCopyAPI);
    };
    WorkerAPIImpl.prototype.getPluginTreeAPI = function () {
        return Comlink.proxy(this.pluginTreeService);
    };
    WorkerAPIImpl.prototype.getNodeTypeAPI = function () {
        return Comlink.proxy(this.nodeTypeService);
    };
    WorkerAPIImpl.prototype.getPluginManagementAPI = function () {
        return Comlink.proxy(this.pluginManagementService);
    };
    WorkerAPIImpl.prototype.getImportExportAPI = function () {
        return Comlink.proxy(this.importExportAPI);
    };
    /**
     * @deprecated Use specialized APIs instead. This legacy API will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getPluginRegistryAPI = function () {
        var _this = this;
        // Create a legacy adapter that delegates to the new APIs
        var legacyAdapter = {
            listSupportedNodeTypes: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, this.nodeTypeService.listSupported()];
            }); }); },
            isSupportedNodeType: function (nodeType) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, this.nodeTypeService.isSupported(nodeType)];
            }); }); },
            getNodeDefinition: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                var getPluginDefinition;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./registry/plugin-registry-api'); })];
                        case 1:
                            getPluginDefinition = (_a.sent()).getPluginDefinition;
                            return [2 /*return*/, getPluginDefinition(nodeType)];
                    }
                });
            }); },
            validateNodeTypeOperation: function (nodeType, operation, context) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.nodeTypeService.validateOperation(nodeType, operation, context)];
                });
            }); },
            listRegisteredPlugins: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, this.pluginManagementService.listRegistered()];
            }); }); },
            getPluginsForTree: function (treeId) { return __awaiter(_this, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.pluginTreeService.getPluginsForTree({
                                treeId: treeId,
                                includeInactive: false
                            })];
                        case 1:
                            response = _a.sent();
                            return [2 /*return*/, response.plugins];
                    }
                });
            }); },
            getPluginMetadata: function (pluginId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // This would need to be implemented based on plugin ID lookup
                    return [2 /*return*/, undefined];
                });
            }); },
            getPluginCapabilities: function (pluginId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // This would need to be implemented based on plugin ID lookup
                    return [2 /*return*/, undefined];
                });
            }); },
            isPluginActive: function (pluginId) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // This would need to be implemented based on plugin ID lookup
                    return [2 /*return*/, false];
                });
            }); },
            registerPlugin: function (definition) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.pluginManagementService.register(definition)];
                });
            }); },
            unregisterPlugin: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                var result;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.pluginManagementService.unregister(nodeType)];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, {
                                    success: result.success,
                                    cleanedUpNodes: 0,
                                    error: (_a = result.error) === null || _a === void 0 ? void 0 : _a.message
                                }];
                    }
                });
            }); },
            registerExtension: function (nodeType, api) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Extension registration would need to be implemented
                    return [2 /*return*/, { success: true }];
                });
            }); },
            unregisterExtension: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Extension unregistration would need to be implemented
                    return [2 /*return*/, { success: true }];
                });
            }); },
            getExtension: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Extension retrieval would need to be implemented
                    return [2 /*return*/, undefined];
                });
            }); },
            hasExtension: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Extension check would need to be implemented
                    return [2 /*return*/, false];
                });
            }); },
            listExtensions: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Extension listing would need to be implemented
                    return [2 /*return*/, []];
                });
            }); },
            invokeExtensionMethod: function (nodeType, method) {
                var args = [];
                for (var _i = 2; _i < arguments.length; _i++) {
                    args[_i - 2] = arguments[_i];
                }
                return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        // Extension method invocation would need to be implemented
                        return [2 /*return*/, undefined];
                    });
                });
            },
            validatePluginConfiguration: function (nodeType, config) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.pluginManagementService.validatePlugin(config)];
                });
            }); },
            getPluginHealth: function (nodeType) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.pluginManagementService.checkHealth(nodeType)];
                });
            }); }
        };
        return legacyAdapter;
    };
    // ==================
    // System Management
    // ==================
    /**
     * Simple ping method for health check
     */
    WorkerAPIImpl.prototype.ping = function () {
        console.log('[WorkerAPIImpl] ping() called');
        return {
            response: 'pong',
            timestamp: Date.now(),
        };
    };
    WorkerAPIImpl.prototype.getSystemHealth = function () {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_c) {
                return [2 /*return*/, {
                        databases: {
                            coreDB: this.coreDB.isOpen(),
                            ephemeralDB: this.ephemeralDB.isOpen(),
                        },
                        services: {
                            query: !!this.queryService,
                            mutation: !!this.mutationService,
                            subscription: !!this.subscriptionService,
                            plugin: !!this.nodeTypeRegistry,
                            workingCopy: !!this.ephemeralDB,
                        },
                        memory: {
                            used: ((_a = performance.memory) === null || _a === void 0 ? void 0 : _a.usedJSHeapSize) || 0,
                            limit: ((_b = performance.memory) === null || _b === void 0 ? void 0 : _b.jsHeapSizeLimit) || 0,
                        },
                        uptime: Date.now() - Date.now(), // Would need to track initialization time
                    }];
            });
        });
    };
    // ==================
    // Legacy compatibility methods
    // ==================
    /**
     * @deprecated Use getQueryAPI().getTree() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getTree = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.queryService.getTree(params.treeId)];
            });
        });
    };
    /**
     * @deprecated Use getQueryAPI().listTrees() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.listTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.queryService.listTrees()];
            });
        });
    };
    /**
     * @deprecated Use getQueryAPI().listTrees() instead. This is a naming mistake. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.listTrees()];
            });
        });
    };
    /**
     * @deprecated Use getQueryAPI().getNode() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getNode = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.queryService.getNode(nodeId)];
            });
        });
    };
    /**
     * @deprecated Use getQueryAPI().listChildren() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getChildren = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.queryService.getChildren(params)];
            });
        });
    };
    /**
     * @deprecated Use getMutationAPI().createNode() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.create = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.mutationService.createNode(params)];
            });
        });
    };
    /**
     * @deprecated Use getMutationAPI().recoverNodesFromTrash() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.recoverFromTrash = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.mutationService.recoverNodesFromTrash(params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, { success: false, error: error_3 instanceof Error ? error_3.message : 'Unknown error' }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * @deprecated Use getPluginTreeAPI().getPluginsForTree() instead for better type safety. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.getPluginsForTree = function (treeId) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pluginTreeService.getPluginsForTree({
                            treeId: treeId,
                            includeInactive: false
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.plugins];
                }
            });
        });
    };
    /**
     * @deprecated Use getMutationAPI().removeNodes() instead. Will be removed in v2.0.
     */
    WorkerAPIImpl.prototype.removeNodes = function (nodeIds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.mutationService.removeNodes(nodeIds)];
            });
        });
    };
    return WorkerAPIImpl;
}());
exports.WorkerAPIImpl = WorkerAPIImpl;

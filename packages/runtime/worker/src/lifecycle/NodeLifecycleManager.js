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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeLifecycleManager = void 0;
var workerLogger_1 = require("../utils/workerLogger");
/**
 * Manages lifecycle hooks for node operations
 */
var NodeLifecycleManager = /** @class */ (function () {
    function NodeLifecycleManager(registry, coreDB, ephemeralDB) {
        this.registry = registry;
        this.coreDB = coreDB;
        this.ephemeralDB = ephemeralDB;
        this.events = [];
    }
    /**
     * Execute a specific lifecycle hook
     */
    NodeLifecycleManager.prototype.executeLifecycleHook = function (hookName, nodeType) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var config, lifecycle, hook, startTime, success, error, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config = this.registry.getNodeTypeConfig(nodeType);
                        lifecycle = config === null || config === void 0 ? void 0 : config.lifecycle;
                        hook = lifecycle === null || lifecycle === void 0 ? void 0 : lifecycle[hookName];
                        if (!hook) {
                            return [2 /*return*/]; // No hook defined, silently continue
                        }
                        startTime = Date.now();
                        success = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, hook.apply(void 0, args)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        e_1 = _a.sent();
                        success = false;
                        error = e_1 instanceof Error ? e_1.message : 'Unknown error';
                        // Check if we should stop on error
                        if (lifecycle === null || lifecycle === void 0 ? void 0 : lifecycle.stopOnError) {
                            throw e_1;
                        }
                        // Otherwise, log and continue
                        (0, workerLogger_1.workerError)("Lifecycle hook ".concat(hookName, " failed for ").concat(nodeType, ":"), e_1);
                        return [3 /*break*/, 5];
                    case 4:
                        // Record event
                        this.recordEvent({
                            type: hookName,
                            nodeType: nodeType,
                            nodeId: args[0],
                            timestamp: startTime,
                            duration: Date.now() - startTime,
                            success: success,
                            error: error,
                        });
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle node creation with lifecycle hooks and reference counting
     */
    NodeLifecycleManager.prototype.handleNodeCreation = function (parentId, nodeData, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Execute beforeCreate hook
                    return [4 /*yield*/, this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData)];
                    case 1:
                        // Execute beforeCreate hook
                        _a.sent();
                        return [4 /*yield*/, this.createNodeCore(parentId, nodeData)];
                    case 2:
                        nodeId = _a.sent();
                        // Handle reference counting after node creation (when PeerEntity is created)
                        return [4 /*yield*/, this.handleReferenceCountIncrement(nodeId, nodeType)];
                    case 3:
                        // Handle reference counting after node creation (when PeerEntity is created)
                        _a.sent();
                        // Execute afterCreate hook
                        return [4 /*yield*/, this.executeLifecycleHook('afterCreate', nodeType, nodeId)];
                    case 4:
                        // Execute afterCreate hook
                        _a.sent();
                        return [2 /*return*/, nodeId];
                }
            });
        });
    };
    /**
     * Handle node update with lifecycle hooks
     */
    NodeLifecycleManager.prototype.handleNodeUpdate = function (nodeId, updates, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Execute beforeUpdate hook
                    return [4 /*yield*/, this.executeLifecycleHook('beforeUpdate', nodeType, nodeId, updates)];
                    case 1:
                        // Execute beforeUpdate hook
                        _a.sent();
                        // Update the node
                        return [4 /*yield*/, this.updateNodeCore(nodeId, updates)];
                    case 2:
                        // Update the node
                        _a.sent();
                        // Execute afterUpdate hook
                        return [4 /*yield*/, this.executeLifecycleHook('afterUpdate', nodeType, nodeId, updates)];
                    case 3:
                        // Execute afterUpdate hook
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle node deletion with lifecycle hooks and reference counting
     */
    NodeLifecycleManager.prototype.handleNodeDeletion = function (nodeId, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Execute beforeDelete hook
                    return [4 /*yield*/, this.executeLifecycleHook('beforeDelete', nodeType, nodeId)];
                    case 1:
                        // Execute beforeDelete hook
                        _a.sent();
                        // Handle reference counting before actual node deletion
                        return [4 /*yield*/, this.handleReferenceCountDecrement(nodeId, nodeType)];
                    case 2:
                        // Handle reference counting before actual node deletion
                        _a.sent();
                        // Delete the node
                        return [4 /*yield*/, this.deleteNodeCore(nodeId)];
                    case 3:
                        // Delete the node
                        _a.sent();
                        // Execute afterDelete hook
                        return [4 /*yield*/, this.executeLifecycleHook('afterDelete', nodeType, nodeId)];
                    case 4:
                        // Execute afterDelete hook
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle node move with lifecycle hooks
     */
    NodeLifecycleManager.prototype.handleNodeMove = function (nodeId, oldParentId, newParentId, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Execute beforeMove hook
                    return [4 /*yield*/, this.executeLifecycleHook('beforeMove', nodeType, nodeId, oldParentId, newParentId)];
                    case 1:
                        // Execute beforeMove hook
                        _a.sent();
                        // Move the node
                        return [4 /*yield*/, this.moveNodeCore(nodeId, newParentId)];
                    case 2:
                        // Move the node
                        _a.sent();
                        // Execute afterMove hook
                        return [4 /*yield*/, this.executeLifecycleHook('afterMove', nodeType, nodeId, oldParentId, newParentId)];
                    case 3:
                        // Execute afterMove hook
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle node load
     */
    NodeLifecycleManager.prototype.handleNodeLoad = function (nodeId, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executeLifecycleHook('onLoad', nodeType, nodeId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle node unload
     */
    NodeLifecycleManager.prototype.handleNodeUnload = function (nodeId, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executeLifecycleHook('onUnload', nodeType, nodeId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle batch node creation
     */
    NodeLifecycleManager.prototype.handleBatchCreate = function (parentId, nodes, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, _i, nodes_1, nodeData, nodeId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeIds = [];
                        _i = 0, nodes_1 = nodes;
                        _a.label = 1;
                    case 1:
                        if (!(_i < nodes_1.length)) return [3 /*break*/, 4];
                        nodeData = nodes_1[_i];
                        return [4 /*yield*/, this.handleNodeCreation(parentId, nodeData, nodeType)];
                    case 2:
                        nodeId = _a.sent();
                        nodeIds.push(nodeId);
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, nodeIds];
                }
            });
        });
    };
    /**
     * Handle batch node deletion
     */
    NodeLifecycleManager.prototype.handleBatchDelete = function (nodeIds, nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, nodeIds_1, nodeId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, nodeIds_1 = nodeIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < nodeIds_1.length)) return [3 /*break*/, 4];
                        nodeId = nodeIds_1[_i];
                        return [4 /*yield*/, this.handleNodeDeletion(nodeId, nodeType)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get lifecycle events for debugging/monitoring
     */
    NodeLifecycleManager.prototype.getEvents = function (filter) {
        var events = __spreadArray([], this.events, true);
        if (filter === null || filter === void 0 ? void 0 : filter.nodeType) {
            events = events.filter(function (e) { return e.nodeType === filter.nodeType; });
        }
        if (filter === null || filter === void 0 ? void 0 : filter.type) {
            events = events.filter(function (e) { return e.type === filter.type; });
        }
        return events;
    };
    /**
     * Clear event history
     */
    NodeLifecycleManager.prototype.clearEvents = function () {
        this.events = [];
    };
    // Core operations (without hooks)
    NodeLifecycleManager.prototype.createNodeCore = function (parentId, nodeData) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_c) {
                // In real implementation, this would create the node in CoreDB
                return [2 /*return*/, ((_b = (_a = this.coreDB).createNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeData)) || "node-".concat(Date.now())];
            });
        });
    };
    NodeLifecycleManager.prototype.updateNodeCore = function (nodeId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.coreDB.updateNode) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.coreDB.updateNode(nodeId, updates)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    NodeLifecycleManager.prototype.deleteNodeCore = function (nodeId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: 
                    // In real implementation, this would delete the node from CoreDB
                    return [4 /*yield*/, ((_b = (_a = this.coreDB).deleteNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 1:
                        // In real implementation, this would delete the node from CoreDB
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NodeLifecycleManager.prototype.moveNodeCore = function (nodeId, newParentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // In real implementation, this would update the parent in CoreDB
                    return [4 /*yield*/, this.updateNodeCore(nodeId, { parentId: newParentId })];
                    case 1:
                        // In real implementation, this would update the parent in CoreDB
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NodeLifecycleManager.prototype.recordEvent = function (event) {
        this.events.push(event);
        // Keep only last 1000 events
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }
    };
    /**
     * Handle reference count increment when PeerEntity is created
     */
    NodeLifecycleManager.prototype.handleReferenceCountIncrement = function (nodeId, nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var config, entityHints;
            return __generator(this, function (_b) {
                try {
                    config = this.registry.getNodeTypeConfig(nodeType);
                    entityHints = (_a = config === null || config === void 0 ? void 0 : config.metadata) === null || _a === void 0 ? void 0 : _a.entityHints;
                    if (!(entityHints === null || entityHints === void 0 ? void 0 : entityHints.relRefField)) {
                        return [2 /*return*/]; // No RelationalEntity to manage
                    }
                    // TODO: Implement getHandler method in registry
                    // For now, log that this functionality is not implemented
                    console.log("Reference counting not implemented for ".concat(nodeType, " node ").concat(nodeId));
                    // const handler = this.registry.getHandler(nodeType);
                    // if (!isReferenceCountingHandler(handler)) {
                    //   return; // Handler doesn't support reference counting
                    // }
                    // await handler.incrementReferenceCount(nodeId);
                }
                catch (e) {
                    (0, workerLogger_1.workerError)("Failed to increment reference count for ".concat(nodeType, " node ").concat(nodeId, ":"), e);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Handle reference count decrement when PeerEntity is deleted
     */
    NodeLifecycleManager.prototype.handleReferenceCountDecrement = function (nodeId, nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var config, entityHints;
            return __generator(this, function (_b) {
                try {
                    config = this.registry.getNodeTypeConfig(nodeType);
                    entityHints = (_a = config === null || config === void 0 ? void 0 : config.metadata) === null || _a === void 0 ? void 0 : _a.entityHints;
                    if (!(entityHints === null || entityHints === void 0 ? void 0 : entityHints.relRefField)) {
                        return [2 /*return*/]; // No RelationalEntity to manage
                    }
                    // TODO: Implement getHandler method in registry
                    // For now, log that this functionality is not implemented
                    console.log("Reference counting decrement not implemented for ".concat(nodeType, " node ").concat(nodeId));
                    // const handler = this.registry.getHandler(nodeType);
                    // if (!isReferenceCountingHandler(handler)) {
                    //   return; // Handler doesn't support reference counting
                    // }
                    // await handler.decrementReferenceCount(nodeId);
                }
                catch (e) {
                    (0, workerLogger_1.workerError)("Failed to decrement reference count for ".concat(nodeType, " node ").concat(nodeId, ":"), e);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Create lifecycle context for hooks
     */
    NodeLifecycleManager.prototype.createContext = function (metadata) {
        return {
            nodeType: 'unknown',
            timestamp: Date.now(),
            metadata: metadata,
        };
    };
    /**
     * Execute hooks with context
     */
    NodeLifecycleManager.prototype.executeHookWithContext = function (hookName, nodeType, context) {
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            args[_i - 3] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var enrichedContext;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        enrichedContext = __assign(__assign({}, context), { nodeType: nodeType });
                        // Store context for hook execution
                        globalThis.__lifecycleContext = enrichedContext;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, this.executeLifecycleHook.apply(this, __spreadArray([hookName, nodeType], args, false))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        delete globalThis.__lifecycleContext;
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return NodeLifecycleManager;
}());
exports.NodeLifecycleManager = NodeLifecycleManager;

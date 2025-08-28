"use strict";
/**
 * @file plugin-registry-api.ts
 * @description Worker API methods for plugin registry access
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
exports.getCreatableNodeTypesForTree = exports.getPluginsForTree = exports.getCreatableNodeTypes = exports.isNodeTypeRegistered = exports.getPluginDefinition = exports.getRegisteredPlugins = void 0;
var UnifiedNodeTypeRegistry_1 = require("./UnifiedNodeTypeRegistry");
/**
 * Get all registered plugins from the registry
 */
function getRegisteredPlugins() {
    return __awaiter(this, void 0, void 0, function () {
        var registry, plugins, nodeTypes, _i, nodeTypes_1, nodeType, definition;
        return __generator(this, function (_a) {
            registry = UnifiedNodeTypeRegistry_1.UnifiedNodeTypeRegistry.getInstance();
            plugins = [];
            nodeTypes = registry.getAllNodeTypes();
            for (_i = 0, nodeTypes_1 = nodeTypes; _i < nodeTypes_1.length; _i++) {
                nodeType = nodeTypes_1[_i];
                definition = registry.get(nodeType);
                if (definition) {
                    plugins.push(definition);
                }
            }
            return [2 /*return*/, plugins];
        });
    });
}
exports.getRegisteredPlugins = getRegisteredPlugins;
/**
 * Get a specific plugin definition by node type
 */
function getPluginDefinition(nodeType) {
    return __awaiter(this, void 0, void 0, function () {
        var registry;
        return __generator(this, function (_a) {
            registry = UnifiedNodeTypeRegistry_1.UnifiedNodeTypeRegistry.getInstance();
            return [2 /*return*/, registry.get(nodeType) || null];
        });
    });
}
exports.getPluginDefinition = getPluginDefinition;
/**
 * Check if a node type is registered
 */
function isNodeTypeRegistered(nodeType) {
    return __awaiter(this, void 0, void 0, function () {
        var registry;
        return __generator(this, function (_a) {
            registry = UnifiedNodeTypeRegistry_1.UnifiedNodeTypeRegistry.getInstance();
            return [2 /*return*/, registry.has(nodeType)];
        });
    });
}
exports.isNodeTypeRegistered = isNodeTypeRegistered;
/**
 * Get all node types that can be created (have UI containers)
 */
function getCreatableNodeTypes() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var registry, creatableTypes, nodeTypes, _i, nodeTypes_2, nodeType, definition;
        return __generator(this, function (_b) {
            registry = UnifiedNodeTypeRegistry_1.UnifiedNodeTypeRegistry.getInstance();
            creatableTypes = [];
            nodeTypes = registry.getAllNodeTypes();
            for (_i = 0, nodeTypes_2 = nodeTypes; _i < nodeTypes_2.length; _i++) {
                nodeType = nodeTypes_2[_i];
                definition = registry.get(nodeType);
                if ((_a = definition === null || definition === void 0 ? void 0 : definition.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath) {
                    creatableTypes.push(nodeType);
                }
            }
            return [2 /*return*/, creatableTypes];
        });
    });
}
exports.getCreatableNodeTypes = getCreatableNodeTypes;
/**
 * Get plugins filtered by tree ID and sorted by create order
 */
function getPluginsForTree(treeId) {
    return __awaiter(this, void 0, void 0, function () {
        var registry, plugins, nodeTypes, _i, nodeTypes_3, nodeType, definition, category;
        return __generator(this, function (_a) {
            registry = UnifiedNodeTypeRegistry_1.UnifiedNodeTypeRegistry.getInstance();
            plugins = [];
            nodeTypes = registry.getAllNodeTypes();
            for (_i = 0, nodeTypes_3 = nodeTypes; _i < nodeTypes_3.length; _i++) {
                nodeType = nodeTypes_3[_i];
                definition = registry.get(nodeType);
                if (definition) {
                    // If treeId is '*', return all plugins
                    if (treeId === '*') {
                        plugins.push(definition);
                    }
                    else {
                        category = definition.category;
                        if (category && (category.treeId === '*' || category.treeId === treeId)) {
                            plugins.push(definition);
                        }
                    }
                }
            }
            // Sort by menu group and create order
            return [2 /*return*/, plugins.sort(function (a, b) {
                    var aGroup = a.category.menuGroup || 'basic';
                    var bGroup = b.category.menuGroup || 'basic';
                    var aOrder = a.category.createOrder || 999;
                    var bOrder = b.category.createOrder || 999;
                    // Define group priority
                    var groupPriority = { basic: 1, container: 2, document: 3, advanced: 4 };
                    var aPriority = groupPriority[aGroup] || 999;
                    var bPriority = groupPriority[bGroup] || 999;
                    if (aPriority !== bPriority) {
                        return aPriority - bPriority;
                    }
                    return aOrder - bOrder;
                })];
        });
    });
}
exports.getPluginsForTree = getPluginsForTree;
/**
 * Get creatable node types for a specific tree ID
 */
function getCreatableNodeTypesForTree(treeId) {
    return __awaiter(this, void 0, void 0, function () {
        var plugins;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPluginsForTree(treeId)];
                case 1:
                    plugins = _a.sent();
                    return [2 /*return*/, plugins
                            .filter(function (plugin) { var _a; return (_a = plugin.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath; })
                            .map(function (plugin) { return plugin.nodeType; })];
            }
        });
    });
}
exports.getCreatableNodeTypesForTree = getCreatableNodeTypesForTree;

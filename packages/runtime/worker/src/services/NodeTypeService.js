"use strict";
/**
 * @file NodeTypeService.ts
 * @description Node type management service implementation
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
exports.NodeTypeService = void 0;
var plugin_registry_api_1 = require("../registry/plugin-registry-api");
/**
 * Service implementation for node type operations
 */
var NodeTypeService = /** @class */ (function () {
    function NodeTypeService(nodeTypeRegistry, queryService) {
        this.nodeTypeRegistry = nodeTypeRegistry;
        this.queryService = queryService;
    }
    NodeTypeService.prototype.listSupported = function () {
        return __awaiter(this, void 0, void 0, function () {
            var types;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.getCreatableNodeTypes)()];
                    case 1:
                        types = _a.sent();
                        return [2 /*return*/, types];
                }
            });
        });
    };
    NodeTypeService.prototype.isSupported = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(nodeType)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NodeTypeService.prototype.validateOperation = function (nodeType, operation, context) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var errors, isRegistered, definition, _b, parentNode, parentSupportsChildren, error_1, targetNode, error_2, targetNode, error_3, _c, targetNode, parentNode, isDescendant, error_4, error_5;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        errors = [];
                        return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _d.sent();
                        if (!isRegistered) {
                            errors.push("Node type ".concat(nodeType, " is not registered"));
                            return [2 /*return*/, { valid: false, message: errors.join('; ') }];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 2:
                        definition = _d.sent();
                        if (!definition) {
                            errors.push("Plugin definition not found for node type ".concat(nodeType));
                            return [2 /*return*/, { valid: false, message: errors.join('; ') }];
                        }
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 31, , 32]);
                        _b = operation;
                        switch (_b) {
                            case 'create': return [3 /*break*/, 4];
                            case 'update': return [3 /*break*/, 12];
                            case 'delete': return [3 /*break*/, 17];
                            case 'move': return [3 /*break*/, 22];
                        }
                        return [3 /*break*/, 29];
                    case 4:
                        if (!((_a = definition.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath)) {
                            errors.push("Node type ".concat(nodeType, " does not support create operation"));
                        }
                        if (!(context === null || context === void 0 ? void 0 : context.parentId)) return [3 /*break*/, 11];
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 10, , 11]);
                        return [4 /*yield*/, this.queryService.getNode(context.parentId)];
                    case 6:
                        parentNode = _d.sent();
                        if (!!parentNode) return [3 /*break*/, 7];
                        errors.push('Parent node not found');
                        return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, this.supportsChildren(parentNode.nodeType)];
                    case 8:
                        parentSupportsChildren = _d.sent();
                        if (!parentSupportsChildren) {
                            errors.push("Parent node type ".concat(parentNode.nodeType, " does not support child nodes"));
                        }
                        _d.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_1 = _d.sent();
                        errors.push('Failed to validate parent node');
                        return [3 /*break*/, 11];
                    case 11: return [3 /*break*/, 30];
                    case 12:
                        if (!(context === null || context === void 0 ? void 0 : context.targetNodeId)) return [3 /*break*/, 16];
                        _d.label = 13;
                    case 13:
                        _d.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, this.queryService.getNode(context.targetNodeId)];
                    case 14:
                        targetNode = _d.sent();
                        if (!targetNode) {
                            errors.push('Target node not found');
                        }
                        else if (targetNode.nodeType !== nodeType) {
                            errors.push('Node type mismatch for update operation');
                        }
                        return [3 /*break*/, 16];
                    case 15:
                        error_2 = _d.sent();
                        errors.push('Failed to validate target node');
                        return [3 /*break*/, 16];
                    case 16: return [3 /*break*/, 30];
                    case 17:
                        if (!(context === null || context === void 0 ? void 0 : context.targetNodeId)) return [3 /*break*/, 21];
                        _d.label = 18;
                    case 18:
                        _d.trys.push([18, 20, , 21]);
                        return [4 /*yield*/, this.queryService.getNode(context.targetNodeId)];
                    case 19:
                        targetNode = _d.sent();
                        if (!targetNode) {
                            errors.push('Target node not found');
                        }
                        return [3 /*break*/, 21];
                    case 20:
                        error_3 = _d.sent();
                        errors.push('Failed to validate delete target');
                        return [3 /*break*/, 21];
                    case 21: return [3 /*break*/, 30];
                    case 22:
                        if (!((context === null || context === void 0 ? void 0 : context.targetNodeId) && (context === null || context === void 0 ? void 0 : context.parentId))) return [3 /*break*/, 28];
                        if (context.targetNodeId === context.parentId) {
                            errors.push('Cannot move node to itself');
                        }
                        _d.label = 23;
                    case 23:
                        _d.trys.push([23, 27, , 28]);
                        return [4 /*yield*/, Promise.all([
                                this.queryService.getNode(context.targetNodeId),
                                this.queryService.getNode(context.parentId)
                            ])];
                    case 24:
                        _c = _d.sent(), targetNode = _c[0], parentNode = _c[1];
                        if (!targetNode) {
                            errors.push('Target node not found');
                        }
                        if (!parentNode) {
                            errors.push('Parent node not found');
                        }
                        if (!(targetNode && parentNode)) return [3 /*break*/, 26];
                        return [4 /*yield*/, this.isNodeDescendantOf(context.parentId, context.targetNodeId)];
                    case 25:
                        isDescendant = _d.sent();
                        if (isDescendant) {
                            errors.push('Cannot move node to its own descendant');
                        }
                        _d.label = 26;
                    case 26: return [3 /*break*/, 28];
                    case 27:
                        error_4 = _d.sent();
                        errors.push('Failed to validate move operation');
                        return [3 /*break*/, 28];
                    case 28: return [3 /*break*/, 30];
                    case 29:
                        errors.push("Unsupported operation: ".concat(operation));
                        _d.label = 30;
                    case 30: return [3 /*break*/, 32];
                    case 31:
                        error_5 = _d.sent();
                        errors.push("Validation failed: ".concat(error_5 instanceof Error ? error_5.message : 'Unknown error'));
                        return [3 /*break*/, 32];
                    case 32: return [2 /*return*/, {
                            valid: errors.length === 0,
                            message: errors.length === 0 ? '' : errors.join('; ')
                        }];
                }
            });
        });
    };
    NodeTypeService.prototype.getSupportedOperations = function (nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, definition, operations;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _b.sent();
                        if (!isRegistered) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 2:
                        definition = _b.sent();
                        if (!definition) {
                            return [2 /*return*/, []];
                        }
                        operations = [];
                        if ((_a = definition.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath) {
                            operations.push('create', 'update');
                        }
                        operations.push('read');
                        if (nodeType !== 'Root' && nodeType !== 'Trash') {
                            operations.push('delete', 'move');
                        }
                        if (definition.entityHandler) {
                            operations.push('copy');
                        }
                        return [2 /*return*/, operations];
                }
            });
        });
    };
    NodeTypeService.prototype.supportsChildren = function (nodeType) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, definition, category;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(nodeType)];
                    case 1:
                        isRegistered = _d.sent();
                        if (!isRegistered) {
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 2:
                        definition = _d.sent();
                        if (!definition) {
                            return [2 /*return*/, false];
                        }
                        if (((_a = definition.validation) === null || _a === void 0 ? void 0 : _a.maxChildren) !== undefined) {
                            return [2 /*return*/, definition.validation.maxChildren > 0];
                        }
                        if ((_b = definition.ui) === null || _b === void 0 ? void 0 : _b.panelComponentPath) {
                            return [2 /*return*/, true];
                        }
                        category = (_c = definition.category) === null || _c === void 0 ? void 0 : _c.menuGroup;
                        if (category === 'container' || category === 'basic') {
                            return [2 /*return*/, true];
                        }
                        return [2 /*return*/, true];
                }
            });
        });
    };
    NodeTypeService.prototype.getAllowedChildTypes = function (parentType) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var isRegistered, supportsChildren, definition, allTypes, parentCategory;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(parentType)];
                    case 1:
                        isRegistered = _c.sent();
                        if (!isRegistered) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.supportsChildren(parentType)];
                    case 2:
                        supportsChildren = _c.sent();
                        if (!supportsChildren) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(parentType)];
                    case 3:
                        definition = _c.sent();
                        if (!definition) {
                            return [2 /*return*/, []];
                        }
                        if ((_a = definition.validation) === null || _a === void 0 ? void 0 : _a.allowedChildTypes) {
                            return [2 /*return*/, definition.validation.allowedChildTypes];
                        }
                        return [4 /*yield*/, (0, plugin_registry_api_1.getCreatableNodeTypes)()];
                    case 4:
                        allTypes = _c.sent();
                        parentCategory = (_b = definition.category) === null || _b === void 0 ? void 0 : _b.menuGroup;
                        if (parentCategory === 'container') {
                            return [2 /*return*/, allTypes];
                        }
                        else if (parentCategory === 'document') {
                            return [2 /*return*/, allTypes.filter(function (type) { return !['project', 'basemap'].includes(type); })];
                        }
                        return [2 /*return*/, allTypes];
                }
            });
        });
    };
    NodeTypeService.prototype.hasCapability = function (nodeType, capability) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __awaiter(this, void 0, void 0, function () {
            var definition, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 1:
                        definition = _l.sent();
                        if (!definition) {
                            return [2 /*return*/, false];
                        }
                        _k = capability;
                        switch (_k) {
                            case 'create': return [3 /*break*/, 2];
                            case 'ui': return [3 /*break*/, 3];
                            case 'api': return [3 /*break*/, 4];
                            case 'children': return [3 /*break*/, 5];
                            case 'export': return [3 /*break*/, 7];
                            case 'lifecycle': return [3 /*break*/, 8];
                            case 'validation': return [3 /*break*/, 9];
                            case 'search': return [3 /*break*/, 10];
                            case 'permissions': return [3 /*break*/, 11];
                        }
                        return [3 /*break*/, 12];
                    case 2: return [2 /*return*/, !!((_a = definition.ui) === null || _a === void 0 ? void 0 : _a.dialogComponentPath)];
                    case 3: return [2 /*return*/, !!(((_b = definition.ui) === null || _b === void 0 ? void 0 : _b.dialogComponentPath) || ((_c = definition.ui) === null || _c === void 0 ? void 0 : _c.panelComponentPath))];
                    case 4: return [2 /*return*/, !!definition.api];
                    case 5: return [4 /*yield*/, this.supportsChildren(nodeType)];
                    case 6: return [2 /*return*/, _l.sent()];
                    case 7: return [2 /*return*/, !!definition.entityHandler];
                    case 8: return [2 /*return*/, !!(((_d = definition.lifecycle) === null || _d === void 0 ? void 0 : _d.beforeCreate) ||
                            ((_e = definition.lifecycle) === null || _e === void 0 ? void 0 : _e.afterCreate) ||
                            ((_f = definition.lifecycle) === null || _f === void 0 ? void 0 : _f.beforeUpdate) ||
                            ((_g = definition.lifecycle) === null || _g === void 0 ? void 0 : _g.afterUpdate) ||
                            ((_h = definition.lifecycle) === null || _h === void 0 ? void 0 : _h.beforeDelete) ||
                            ((_j = definition.lifecycle) === null || _j === void 0 ? void 0 : _j.afterDelete))];
                    case 9: return [2 /*return*/, !!definition.entityHandler];
                    case 10: return [2 /*return*/, true];
                    case 11: return [2 /*return*/, false];
                    case 12: return [2 /*return*/, false];
                }
            });
        });
    };
    // Additional methods expected by tests
    NodeTypeService.prototype.registerNodeType = function (nodeType) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var config;
            return __generator(this, function (_c) {
                config = {
                    icon: nodeType.icon,
                    allowedChildren: (_a = nodeType.validation) === null || _a === void 0 ? void 0 : _a.allowedChildTypes,
                    maxChildren: (_b = nodeType.validation) === null || _b === void 0 ? void 0 : _b.maxChildren,
                    // Sensible defaults for basic operations in the simple registry
                    canBeDeleted: true,
                    canBeRenamed: true,
                    canBeMoved: true,
                };
                this.nodeTypeRegistry.register(nodeType.nodeType, config);
                return [2 /*return*/];
            });
        });
    };
    NodeTypeService.prototype.unregisterNodeType = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.nodeTypeRegistry.unregister(nodeType)];
            });
        });
    };
    NodeTypeService.prototype.listNodeTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.nodeTypeRegistry.getAll()];
            });
        });
    };
    NodeTypeService.prototype.getNodeTypeDefinition = function (nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var def;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 1:
                        def = _b.sent();
                        return [2 /*return*/, (_a = def) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    NodeTypeService.prototype.getNodeTypesByCategory = function (category) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var allTypes, categorizedTypes, _i, allTypes_1, type, definition;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.listNodeTypes()];
                    case 1:
                        allTypes = _b.sent();
                        categorizedTypes = [];
                        _i = 0, allTypes_1 = allTypes;
                        _b.label = 2;
                    case 2:
                        if (!(_i < allTypes_1.length)) return [3 /*break*/, 5];
                        type = allTypes_1[_i];
                        return [4 /*yield*/, this.getNodeTypeDefinition(type)];
                    case 3:
                        definition = _b.sent();
                        if (((_a = definition === null || definition === void 0 ? void 0 : definition.category) === null || _a === void 0 ? void 0 : _a.menuGroup) === category) {
                            categorizedTypes.push(type);
                        }
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, categorizedTypes];
                }
            });
        });
    };
    NodeTypeService.prototype.isNodeTypeRegistered = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.isNodeTypeRegistered)(nodeType)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NodeTypeService.prototype.canContainChild = function (parentType, childType) {
        return __awaiter(this, void 0, void 0, function () {
            var allowedChildTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllowedChildTypes(parentType)];
                    case 1:
                        allowedChildTypes = _a.sent();
                        return [2 /*return*/, allowedChildTypes.includes(childType)];
                }
            });
        });
    };
    NodeTypeService.prototype.getNodeTypeMetadata = function (nodeType) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var pluginDef;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, plugin_registry_api_1.getPluginDefinition)(nodeType)];
                    case 1:
                        pluginDef = _b.sent();
                        return [2 /*return*/, (_a = pluginDef === null || pluginDef === void 0 ? void 0 : pluginDef.meta) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    NodeTypeService.prototype.updateNodeTypeMetadata = function (_nodeType, _metadata) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Metadata updates are not supported in the simple registry bridge.
                // In a full implementation, this would update the plugin definition in the registry.
                throw new Error('Updating node type metadata is not supported in this environment');
            });
        });
    };
    NodeTypeService.prototype.validateNodeType = function (node) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var definition, errors, _i, _c, validator, result, error_6;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.getNodeTypeDefinition(node.nodeType)];
                    case 1:
                        definition = _d.sent();
                        if (!definition) {
                            return [2 /*return*/, {
                                    valid: false,
                                    errors: ["Node type ".concat(node.nodeType, " is not registered")]
                                }];
                        }
                        errors = [];
                        if (!((_a = definition.validation) === null || _a === void 0 ? void 0 : _a.customValidators)) return [3 /*break*/, 7];
                        _i = 0, _c = definition.validation.customValidators;
                        _d.label = 2;
                    case 2:
                        if (!(_i < _c.length)) return [3 /*break*/, 7];
                        validator = _c[_i];
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, validator.validate(node)];
                    case 4:
                        result = _d.sent();
                        if (!result.valid) {
                            // result is { valid: false; message: string } in this branch
                            errors.push((_b = result.message) !== null && _b !== void 0 ? _b : "Validation failed: ".concat(validator.name));
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_6 = _d.sent();
                        errors.push("Validation error in ".concat(validator.name, ": ").concat(error_6 instanceof Error ? error_6.message : 'Unknown error'));
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, {
                            valid: errors.length === 0,
                            errors: errors
                        }];
                }
            });
        });
    };
    NodeTypeService.prototype.getNodeTypeHooks = function (nodeType) {
        return __awaiter(this, void 0, void 0, function () {
            var definition;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNodeTypeDefinition(nodeType)];
                    case 1:
                        definition = _a.sent();
                        if (!definition || !definition.lifecycle) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, definition.lifecycle];
                }
            });
        });
    };
    NodeTypeService.prototype.getNodeTypeStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allTypes, stats, _i, allTypes_2, type, _a, allTypes_3, nodeType;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.listNodeTypes()];
                    case 1:
                        allTypes = _b.sent();
                        stats = {};
                        // Initialize all registered types to 0
                        for (_i = 0, allTypes_2 = allTypes; _i < allTypes_2.length; _i++) {
                            type = allTypes_2[_i];
                            stats[type] = 0;
                        }
                        try {
                            // Count nodes by type using search functionality as substitute
                            for (_a = 0, allTypes_3 = allTypes; _a < allTypes_3.length; _a++) {
                                nodeType = allTypes_3[_a];
                                try {
                                    // TreeQueryService.searchNodes requires a rootNodeId and returns TreeNode[]
                                    // In this simplified stats implementation, we skip querying and default to 0.
                                    // A full implementation could traverse from known roots and count by type.
                                    stats[nodeType] = 0;
                                }
                                catch (error) {
                                    stats[nodeType] = 0;
                                }
                            }
                        }
                        catch (error) {
                            // If there's an error getting stats, return zeros
                        }
                        return [2 /*return*/, stats];
                }
            });
        });
    };
    NodeTypeService.prototype.isNodeDescendantOf = function (potentialParentId, nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var currentNodeId, visitedNodes, node, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        currentNodeId = nodeId;
                        visitedNodes = new Set();
                        _a.label = 1;
                    case 1:
                        if (!(currentNodeId && !visitedNodes.has(currentNodeId))) return [3 /*break*/, 3];
                        visitedNodes.add(currentNodeId);
                        return [4 /*yield*/, this.queryService.getNode(currentNodeId)];
                    case 2:
                        node = _a.sent();
                        if (!node || !node.parentId) {
                            return [3 /*break*/, 3];
                        }
                        if (node.parentId === potentialParentId) {
                            return [2 /*return*/, true];
                        }
                        currentNodeId = node.parentId;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, false];
                    case 4:
                        error_7 = _a.sent();
                        return [2 /*return*/, true]; // Assume circular reference on error
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return NodeTypeService;
}());
exports.NodeTypeService = NodeTypeService;

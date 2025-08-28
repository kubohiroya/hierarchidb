"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.CoreDB = void 0;
var common_core_1 = require("@hierarchidb/common-core");
var dexie_1 = require("dexie");
var rxjs_1 = require("rxjs");
var CoreDB = /** @class */ (function (_super) {
    __extends(CoreDB, _super);
    function CoreDB(name) {
        var _this = _super.call(this, "".concat(name, "-CoreDB")) || this;
        // イベント通知用のSubject
        _this.changeSubject = new rxjs_1.Subject();
        // Increment version to force schema update
        _this.version(4)
            .stores({
            trees: '&id, rootId, trashRootId, superRootId',
            nodes: [
                '&id',
                'parentId',
                '&[parentId+name]',
                '[parentId+updatedAt]',
                'removedAt',
                'isRemoved',
                'originalParentId',
                '*references',
            ].join(', '),
            // Fix: rootStates should use a composite key since rootNodeId might not be unique across trees
            rootStates: '&rootNodeId',
        })
            .upgrade(function (tx) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Clear all data to start fresh
                    return [4 /*yield*/, tx.table('trees').clear()];
                    case 1:
                        // Clear all data to start fresh
                        _a.sent();
                        return [4 /*yield*/, tx.table('nodes').clear()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, tx.table('rootStates').clear()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return _this;
    }
    CoreDB.getSingleton = function (name) {
        if (name === void 0) { name = 'hierarchidb'; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, common_core_1.SingletonMixin.getSingleton(CoreDB.name, function () { return __awaiter(_this, void 0, void 0, function () {
                        var instance;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    instance = new CoreDB(name);
                                    return [4 /*yield*/, instance.open()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, instance.initialize()];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, instance];
                            }
                        });
                    }); })];
            });
        });
    };
    CoreDB.prototype.treeIdToTreeName = function (treeId) {
        return treeId === 'r' ? 'Resources' : 'Projects';
    };
    CoreDB.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transaction('rw', this.trees, this.nodes, this.rootStates, function () { return __awaiter(_this, void 0, void 0, function () {
                            var now, treesCount, nodesCount, rootStatesCount, data, rootStateData, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        now = Date.now();
                                        return [4 /*yield*/, this.trees.count()];
                                    case 1:
                                        treesCount = _a.sent();
                                        return [4 /*yield*/, this.nodes.count()];
                                    case 2:
                                        nodesCount = _a.sent();
                                        return [4 /*yield*/, this.rootStates.count()];
                                    case 3:
                                        rootStatesCount = _a.sent();
                                        if (!(treesCount != 2 || rootStatesCount != 4)) return [3 /*break*/, 7];
                                        console.warn('Database is in an inconsistent state. Clearing and reinitializing...');
                                        return [4 /*yield*/, this.trees.clear()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, this.nodes.clear()];
                                    case 5:
                                        _a.sent();
                                        return [4 /*yield*/, this.rootStates.clear()];
                                    case 6:
                                        _a.sent();
                                        _a.label = 7;
                                    case 7:
                                        if (!(treesCount === 0)) return [3 /*break*/, 9];
                                        return [4 /*yield*/, this.trees.bulkPut(['r', 'p'].map(function (treeId) { return ({
                                                id: treeId,
                                                name: treeId === 'r' ? 'Resources' : 'Projects',
                                                rootId: common_core_1.NodeIdGenerator.rootNode(treeId),
                                                trashRootId: common_core_1.NodeIdGenerator.trashNode(treeId),
                                                superRootId: common_core_1.NodeIdGenerator.superRootNode(treeId),
                                            }); }))];
                                    case 8:
                                        _a.sent();
                                        _a.label = 9;
                                    case 9:
                                        if (!(nodesCount === 0)) return [3 /*break*/, 11];
                                        data = ['r', 'p'].flatMap(function (treeId) { return [
                                            {
                                                parentId: common_core_1.NodeIdGenerator.superRootNode(treeId),
                                                id: common_core_1.NodeIdGenerator.rootNode(treeId),
                                                nodeType: common_core_1.TREE_ROOT_NODE_TYPES.ROOT,
                                                name: treeId === 'r' ? 'Resources' : 'Projects',
                                                depth: 0,
                                                createdAt: now,
                                                updatedAt: now,
                                                version: 1,
                                            },
                                            {
                                                parentId: common_core_1.NodeIdGenerator.superRootNode(treeId),
                                                id: common_core_1.NodeIdGenerator.trashNode(treeId),
                                                nodeType: common_core_1.TREE_ROOT_NODE_TYPES.TRASH,
                                                name: 'Trash',
                                                depth: 0,
                                                createdAt: now,
                                                updatedAt: now,
                                                version: 1,
                                            },
                                        ]; });
                                        return [4 /*yield*/, this.nodes.bulkAdd(data)];
                                    case 10:
                                        _a.sent();
                                        _a.label = 11;
                                    case 11:
                                        if (!(rootStatesCount === 0)) return [3 /*break*/, 15];
                                        rootStateData = ['r', 'p'].flatMap(function (treeId) {
                                            return [common_core_1.TREE_ROOT_NODE_TYPES.ROOT, common_core_1.TREE_ROOT_NODE_TYPES.TRASH].map(function (treeRootNodeType) { return ({
                                                treeId: treeId,
                                                rootNodeId: treeRootNodeType === common_core_1.TREE_ROOT_NODE_TYPES.ROOT
                                                    ? common_core_1.NodeIdGenerator.rootNode(treeId)
                                                    : common_core_1.NodeIdGenerator.trashNode(treeId),
                                                expanded: {},
                                            }); });
                                        });
                                        _a.label = 12;
                                    case 12:
                                        _a.trys.push([12, 14, , 15]);
                                        return [4 /*yield*/, this.rootStates.bulkAdd(rootStateData)];
                                    case 13:
                                        _a.sent();
                                        return [3 /*break*/, 15];
                                    case 14:
                                        error_1 = _a.sent();
                                        console.error('Failed to initialize rootStates:', error_1);
                                        console.error('Data that failed:', rootStateData);
                                        // Try to get more details about the error
                                        if (error_1.failures) {
                                            console.error('Bulk add failures:', error_1.failures);
                                        }
                                        throw error_1;
                                    case 15: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.getTree = function (treeId) {
        return __awaiter(this, void 0, void 0, function () {
            var tree, plainTree, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[CoreDB] getTree called with treeId:', treeId);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.trees.get(treeId)];
                    case 2:
                        tree = _a.sent();
                        console.log('[CoreDB] getTree result:', tree);
                        // Ensure we return a plain object that can be serialized by Comlink
                        if (tree) {
                            plainTree = {
                                id: tree.id,
                                name: tree.name,
                                rootId: tree.rootId,
                                trashRootId: tree.trashRootId,
                                superRootId: tree.superRootId,
                            };
                            return [2 /*return*/, plainTree];
                        }
                        return [2 /*return*/, undefined];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[CoreDB] getTree error:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.listTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            var trees;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.trees.toArray()];
                    case 1:
                        trees = _a.sent();
                        // Ensure we return plain objects that can be serialized by Comlink
                        return [2 /*return*/, trees.map(function (tree) { return ({
                                id: tree.id,
                                name: tree.name,
                                rootId: tree.rootId,
                                trashRootId: tree.trashRootId,
                                superRootId: tree.superRootId,
                            }); })];
                }
            });
        });
    };
    // CRUD operations for TreeNode
    CoreDB.prototype.getNode = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var node, plainNode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Validate nodeId to prevent Dexie errors
                        if (!nodeId || typeof nodeId !== 'string' || nodeId.length === 0) {
                            console.warn('Invalid nodeId provided to CoreDB.getNode:', nodeId);
                            return [2 /*return*/, undefined];
                        }
                        return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 1:
                        node = _a.sent();
                        // Ensure we return a plain object that can be serialized by Comlink
                        if (node) {
                            plainNode = __assign(__assign(__assign({ id: node.id, parentId: node.parentId, nodeType: node.nodeType, name: node.name, depth: node.depth, createdAt: node.createdAt, updatedAt: node.updatedAt, version: node.version }, (node.removedAt && { removedAt: node.removedAt })), (node.originalParentId && { originalParentId: node.originalParentId })), (node.references && { references: node.references }));
                            return [2 /*return*/, plainNode];
                        }
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    CoreDB.prototype.createNode = function (node) {
        return __awaiter(this, void 0, void 0, function () {
            var parentNode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(node.depth === undefined || node.depth === null)) return [3 /*break*/, 3];
                        if (!(!node.parentId || node.parentId === '')) return [3 /*break*/, 1];
                        // Root nodes have depth 0
                        node.depth = 0;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.nodes.get(node.parentId)];
                    case 2:
                        parentNode = _a.sent();
                        if (parentNode) {
                            node.depth = (parentNode.depth || 0) + 1;
                        }
                        else {
                            // Default to depth 1 if parent not found
                            node.depth = 1;
                        }
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.nodes.add(node)];
                    case 4:
                        _a.sent();
                        // 作成イベントを通知
                        this.changeSubject.next({
                            type: 'node-created',
                            nodeId: node.id,
                            node: node,
                            timestamp: Date.now(),
                        });
                        return [2 /*return*/, node.id];
                }
            });
        });
    };
    CoreDB.prototype.updateNode = function (node) {
        return __awaiter(this, void 0, void 0, function () {
            var oldNode, changes, changeEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(node.id)];
                    case 1:
                        oldNode = _a.sent();
                        return [4 /*yield*/, this.nodes.put(node)];
                    case 2:
                        _a.sent();
                        // 更新イベントを通知
                        if (oldNode) {
                            changes = {
                                name: undefined,
                                parentId: undefined,
                            };
                            if (oldNode.name !== node.name) {
                                changes.name = { old: oldNode.name, new: node.name };
                            }
                            if (oldNode.parentId !== node.parentId) {
                                changes.parentId = { old: oldNode.parentId, new: node.parentId };
                            }
                            changeEvent = {
                                type: 'node-updated',
                                nodeId: node.id,
                                node: node,
                                previousNode: oldNode,
                                timestamp: Date.now(),
                            };
                            this.changeSubject.next(changeEvent);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.deleteNode = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.delete(nodeId)];
                    case 1:
                        _a.sent();
                        // 削除イベントを通知
                        this.changeSubject.next({
                            type: 'node-deleted',
                            nodeId: nodeId,
                            timestamp: Date.now(),
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.listChildren = function (parentId) {
        return __awaiter(this, void 0, void 0, function () {
            var children;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes
                            .where('parentId')
                            .equals(parentId)
                            .filter(function (node) { return !node.removedAt; })
                            .sortBy('createdAt')];
                    case 1:
                        children = _a.sent();
                        // Ensure we return plain objects that can be serialized by Comlink
                        return [2 /*return*/, children.map(function (node) { return (__assign(__assign(__assign({ id: node.id, parentId: node.parentId, nodeType: node.nodeType, name: node.name, depth: node.depth, createdAt: node.createdAt, updatedAt: node.updatedAt, version: node.version }, (node.removedAt && { removedAt: node.removedAt })), (node.originalParentId && { originalParentId: node.originalParentId })), (node.references && { references: node.references }))); })];
                }
            });
        });
    };
    /**
     * データベース接続を閉じる際にSubjectもクリーンアップ
     */
    CoreDB.prototype.close = function () {
        this.changeSubject.complete();
        _super.prototype.close.call(this);
    };
    /**
     * バルク操作用のメソッド
     */
    CoreDB.prototype.bulkCreateNodes = function (nodes) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.bulkAdd(nodes)];
                    case 1:
                        _a.sent();
                        // バルク作成イベントを個別に通知
                        nodes.forEach(function (node) {
                            _this.changeSubject.next({
                                type: 'node-created',
                                nodeId: node.id,
                                node: node,
                                timestamp: Date.now(),
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.bulkUpdateNodes = function (nodes) {
        return __awaiter(this, void 0, void 0, function () {
            var oldNodes;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(nodes.map(function (node) { return _this.nodes.get(node.id); }))];
                    case 1:
                        oldNodes = _a.sent();
                        return [4 /*yield*/, this.nodes.bulkPut(nodes)];
                    case 2:
                        _a.sent();
                        // バルク更新イベントを個別に通知
                        nodes.forEach(function (node, index) {
                            var oldNode = oldNodes[index];
                            if (oldNode) {
                                var changes = {
                                    name: undefined,
                                    parentId: undefined,
                                };
                                if (oldNode.name !== node.name) {
                                    changes.name = { old: oldNode.name, new: node.name };
                                }
                                if (oldNode.parentId !== node.parentId) {
                                    changes.parentId = { old: oldNode.parentId, new: node.parentId };
                                }
                                _this.changeSubject.next({
                                    type: 'node-updated',
                                    nodeId: node.id,
                                    node: node,
                                    previousNode: oldNode,
                                    timestamp: Date.now(),
                                });
                            }
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    CoreDB.prototype.bulkDeleteNodes = function (nodeIds) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.bulkDelete(nodeIds)];
                    case 1:
                        _a.sent();
                        // バルク削除イベントを個別に通知
                        nodeIds.forEach(function (nodeId) {
                            _this.changeSubject.next({
                                type: 'node-deleted',
                                nodeId: nodeId,
                                timestamp: Date.now(),
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Move a node to a new parent and update depths for the subtree
     */
    CoreDB.prototype.moveNode = function (nodeId, newParentId) {
        return __awaiter(this, void 0, void 0, function () {
            var node, newParent, oldDepth, newDepth, depthDifference;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 1:
                        node = _a.sent();
                        if (!node) {
                            throw new Error("Node ".concat(nodeId, " not found"));
                        }
                        return [4 /*yield*/, this.nodes.get(newParentId)];
                    case 2:
                        newParent = _a.sent();
                        if (!newParent) {
                            throw new Error("Parent node ".concat(newParentId, " not found"));
                        }
                        oldDepth = node.depth;
                        newDepth = newParent.depth + 1;
                        depthDifference = newDepth - oldDepth;
                        // Update the node's parent and depth
                        node.parentId = newParentId;
                        node.depth = newDepth;
                        node.updatedAt = Date.now();
                        node.version++;
                        return [4 /*yield*/, this.updateNode(node)];
                    case 3:
                        _a.sent();
                        if (!(depthDifference !== 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.updateSubtreeDepth(nodeId, depthDifference)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recursively update depths for all descendants
     */
    CoreDB.prototype.updateSubtreeDepth = function (parentId, depthDifference) {
        return __awaiter(this, void 0, void 0, function () {
            var children, _i, children_1, child;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes
                            .where('parentId')
                            .equals(parentId)
                            .toArray()];
                    case 1:
                        children = _a.sent();
                        _i = 0, children_1 = children;
                        _a.label = 2;
                    case 2:
                        if (!(_i < children_1.length)) return [3 /*break*/, 6];
                        child = children_1[_i];
                        child.depth += depthDifference;
                        child.updatedAt = Date.now();
                        child.version++;
                        return [4 /*yield*/, this.nodes.put(child)];
                    case 3:
                        _a.sent();
                        // Recursively update descendants
                        return [4 /*yield*/, this.updateSubtreeDepth(child.id, depthDifference)];
                    case 4:
                        // Recursively update descendants
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get nodes by depth level
     */
    CoreDB.prototype.getNodesByDepth = function (depth) {
        return __awaiter(this, void 0, void 0, function () {
            var nodes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes
                            .filter(function (node) { return node.depth === depth; })
                            .toArray()];
                    case 1:
                        nodes = _a.sent();
                        // Return plain objects
                        return [2 /*return*/, nodes.map(function (node) { return (__assign(__assign(__assign({ id: node.id, parentId: node.parentId, nodeType: node.nodeType, name: node.name, depth: node.depth, createdAt: node.createdAt, updatedAt: node.updatedAt, version: node.version }, (node.removedAt && { removedAt: node.removedAt })), (node.originalParentId && { originalParentId: node.originalParentId })), (node.references && { references: node.references }))); })];
                }
            });
        });
    };
    /**
     * Migrate existing nodes to include depth property
     */
    CoreDB.prototype.migrateNodeWithDepth = function (node) {
        return __awaiter(this, void 0, void 0, function () {
            var parent_1, parentWithDepth;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (node.depth !== undefined && node.depth !== null) {
                            return [2 /*return*/, node]; // Already has depth
                        }
                        if (!(!node.parentId || node.parentId === '')) return [3 /*break*/, 1];
                        node.depth = 0;
                        return [3 /*break*/, 5];
                    case 1: return [4 /*yield*/, this.nodes.get(node.parentId)];
                    case 2:
                        parent_1 = _a.sent();
                        if (!(parent_1 && parent_1.depth !== undefined)) return [3 /*break*/, 3];
                        node.depth = parent_1.depth + 1;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.migrateNodeWithDepth(parent_1 || {})];
                    case 4:
                        parentWithDepth = _a.sent();
                        node.depth = (parentWithDepth.depth || 0) + 1;
                        _a.label = 5;
                    case 5: return [4 /*yield*/, this.nodes.put(node)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, node];
                }
            });
        });
    };
    /**
     * Batch migrate all nodes in the database to include depth
     */
    CoreDB.prototype.migrateAllNodesWithDepth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var migratedCount, rootNodes, queue, processed, node, parent_2, children, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        migratedCount = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 11]);
                        return [4 /*yield*/, this.nodes
                                .filter(function (node) { return !node.parentId || node.parentId === ''; })
                                .toArray()];
                    case 2:
                        rootNodes = _a.sent();
                        queue = __spreadArray([], rootNodes, true);
                        processed = new Set();
                        _a.label = 3;
                    case 3:
                        if (!(queue.length > 0)) return [3 /*break*/, 9];
                        node = queue.shift();
                        if (processed.has(node.id)) {
                            return [3 /*break*/, 3];
                        }
                        if (!(!node.parentId || node.parentId === '')) return [3 /*break*/, 4];
                        node.depth = 0;
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.nodes.get(node.parentId)];
                    case 5:
                        parent_2 = _a.sent();
                        if (parent_2 && parent_2.depth !== undefined) {
                            node.depth = parent_2.depth + 1;
                        }
                        else {
                            // Skip this node for now, will process when parent is ready
                            queue.push(node);
                            return [3 /*break*/, 3];
                        }
                        _a.label = 6;
                    case 6: return [4 /*yield*/, this.nodes.put(node)];
                    case 7:
                        _a.sent();
                        processed.add(node.id);
                        migratedCount++;
                        return [4 /*yield*/, this.nodes
                                .where('parentId')
                                .equals(node.id)
                                .toArray()];
                    case 8:
                        children = _a.sent();
                        queue.push.apply(queue, children);
                        return [3 /*break*/, 3];
                    case 9: return [2 /*return*/, { success: true, migratedCount: migratedCount }];
                    case 10:
                        error_3 = _a.sent();
                        console.error('Migration failed:', error_3);
                        return [2 /*return*/, { success: false, migratedCount: migratedCount }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Duplicate a node with correct depth calculation
     */
    CoreDB.prototype.duplicateNode = function (sourceNodeId, targetParentId, newNodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceNode, targetParent, duplicatedNodeId, duplicatedNode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(sourceNodeId)];
                    case 1:
                        sourceNode = _a.sent();
                        if (!sourceNode) {
                            throw new Error("Source node ".concat(sourceNodeId, " not found"));
                        }
                        return [4 /*yield*/, this.nodes.get(targetParentId)];
                    case 2:
                        targetParent = _a.sent();
                        if (!targetParent) {
                            throw new Error("Target parent ".concat(targetParentId, " not found"));
                        }
                        duplicatedNodeId = newNodeId || crypto.randomUUID();
                        duplicatedNode = __assign(__assign({}, sourceNode), { id: duplicatedNodeId, parentId: targetParentId, depth: targetParent.depth + 1, name: sourceNode.name + ' (Copy)', createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                        return [4 /*yield*/, this.createNode(duplicatedNode)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, duplicatedNodeId];
                }
            });
        });
    };
    /**
     * Duplicate a subtree with correct depth calculation
     */
    CoreDB.prototype.duplicateSubtree = function (sourceRootId, targetParentId) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceRoot, targetParent, idMapping, newRootId, subtreeNodes, collectNodes, _i, subtreeNodes_1, node, duplicatedNodes, _loop_1, _a, subtreeNodes_2, originalNode;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(sourceRootId)];
                    case 1:
                        sourceRoot = _b.sent();
                        if (!sourceRoot) {
                            throw new Error("Source root ".concat(sourceRootId, " not found"));
                        }
                        return [4 /*yield*/, this.nodes.get(targetParentId)];
                    case 2:
                        targetParent = _b.sent();
                        if (!targetParent) {
                            throw new Error("Target parent ".concat(targetParentId, " not found"));
                        }
                        idMapping = new Map();
                        newRootId = crypto.randomUUID();
                        idMapping.set(sourceRootId, newRootId);
                        subtreeNodes = [];
                        collectNodes = function (nodeId) { return __awaiter(_this, void 0, void 0, function () {
                            var node, children, _i, children_2, child;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.nodes.get(nodeId)];
                                    case 1:
                                        node = _a.sent();
                                        if (!node) return [3 /*break*/, 6];
                                        subtreeNodes.push(node);
                                        return [4 /*yield*/, this.listChildren(nodeId)];
                                    case 2:
                                        children = _a.sent();
                                        _i = 0, children_2 = children;
                                        _a.label = 3;
                                    case 3:
                                        if (!(_i < children_2.length)) return [3 /*break*/, 6];
                                        child = children_2[_i];
                                        return [4 /*yield*/, collectNodes(child.id)];
                                    case 4:
                                        _a.sent();
                                        _a.label = 5;
                                    case 5:
                                        _i++;
                                        return [3 /*break*/, 3];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, collectNodes(sourceRootId)];
                    case 3:
                        _b.sent();
                        // Generate new IDs for all nodes
                        for (_i = 0, subtreeNodes_1 = subtreeNodes; _i < subtreeNodes_1.length; _i++) {
                            node = subtreeNodes_1[_i];
                            if (!idMapping.has(node.id)) {
                                idMapping.set(node.id, crypto.randomUUID());
                            }
                        }
                        duplicatedNodes = [];
                        _loop_1 = function (originalNode) {
                            var newNodeId = idMapping.get(originalNode.id);
                            var newParentId;
                            var newDepth = void 0;
                            if (originalNode.id === sourceRootId) {
                                // Root of duplicated subtree
                                newParentId = targetParentId;
                                newDepth = targetParent.depth + 1;
                            }
                            else {
                                // Child nodes
                                newParentId = idMapping.get(originalNode.parentId);
                                var newParent = duplicatedNodes.find(function (n) { return n.id === newParentId; });
                                newDepth = newParent ? newParent.depth + 1 : 0;
                            }
                            var duplicatedNode = __assign(__assign({}, originalNode), { id: newNodeId, parentId: newParentId, depth: newDepth, createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                            duplicatedNodes.push(duplicatedNode);
                        };
                        for (_a = 0, subtreeNodes_2 = subtreeNodes; _a < subtreeNodes_2.length; _a++) {
                            originalNode = subtreeNodes_2[_a];
                            _loop_1(originalNode);
                        }
                        // Create all nodes
                        return [4 /*yield*/, this.bulkCreateNodes(duplicatedNodes)];
                    case 4:
                        // Create all nodes
                        _b.sent();
                        return [2 /*return*/, newRootId];
                }
            });
        });
    };
    /**
     * Restore node from trash with correct depth
     */
    CoreDB.prototype.restoreFromTrash = function (nodeId, newParentId) {
        return __awaiter(this, void 0, void 0, function () {
            var node, newParent, restoredNode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 1:
                        node = _a.sent();
                        if (!node || !node.isRemoved) {
                            throw new Error("Node ".concat(nodeId, " is not in trash"));
                        }
                        return [4 /*yield*/, this.nodes.get(newParentId)];
                    case 2:
                        newParent = _a.sent();
                        if (!newParent) {
                            throw new Error("Target parent ".concat(newParentId, " not found"));
                        }
                        restoredNode = __assign(__assign({}, node), { parentId: newParentId, depth: newParent.depth + 1, isRemoved: false, removedAt: undefined, updatedAt: Date.now(), version: node.version + 1 });
                        return [4 /*yield*/, this.updateNode(restoredNode)];
                    case 3:
                        _a.sent();
                        // Update depths for all descendants
                        return [4 /*yield*/, this.updateSubtreeDepthFromParent(nodeId)];
                    case 4:
                        // Update depths for all descendants
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Paste nodes with correct depth calculation
     */
    CoreDB.prototype.pasteNodes = function (nodeIds, targetParentId) {
        return __awaiter(this, void 0, void 0, function () {
            var targetParent, pastedNodeIds, _i, nodeIds_1, nodeId, sourceNode, newNodeId, pastedNode, children;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(targetParentId)];
                    case 1:
                        targetParent = _a.sent();
                        if (!targetParent) {
                            throw new Error("Target parent ".concat(targetParentId, " not found"));
                        }
                        pastedNodeIds = [];
                        _i = 0, nodeIds_1 = nodeIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < nodeIds_1.length)) return [3 /*break*/, 8];
                        nodeId = nodeIds_1[_i];
                        return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 3:
                        sourceNode = _a.sent();
                        if (!sourceNode)
                            return [3 /*break*/, 7];
                        newNodeId = crypto.randomUUID();
                        pastedNode = __assign(__assign({}, sourceNode), { id: newNodeId, parentId: targetParentId, depth: targetParent.depth + 1, createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                        return [4 /*yield*/, this.createNode(pastedNode)];
                    case 4:
                        _a.sent();
                        pastedNodeIds.push(newNodeId);
                        return [4 /*yield*/, this.listChildren(nodeId)];
                    case 5:
                        children = _a.sent();
                        if (!(children.length > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.pasteNodes(children.map(function (c) { return c.id; }), newNodeId)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/, pastedNodeIds];
                }
            });
        });
    };
    /**
     * Update subtree depth based on parent's depth
     */
    CoreDB.prototype.updateSubtreeDepthFromParent = function (parentId) {
        return __awaiter(this, void 0, void 0, function () {
            var parent, children, _i, children_3, child;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(parentId)];
                    case 1:
                        parent = _a.sent();
                        if (!parent)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.listChildren(parentId)];
                    case 2:
                        children = _a.sent();
                        _i = 0, children_3 = children;
                        _a.label = 3;
                    case 3:
                        if (!(_i < children_3.length)) return [3 /*break*/, 7];
                        child = children_3[_i];
                        child.depth = parent.depth + 1;
                        child.updatedAt = Date.now();
                        child.version++;
                        return [4 /*yield*/, this.nodes.put(child)];
                    case 4:
                        _a.sent();
                        // Recursively update descendants
                        return [4 /*yield*/, this.updateSubtreeDepthFromParent(child.id)];
                    case 5:
                        // Recursively update descendants
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 3];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Import nodes with depth validation and recalculation
     */
    CoreDB.prototype.importNodesWithDepthValidation = function (nodes) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, _i, nodeIds_2, nodeId, node, correctDepth;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Create all nodes first
                    return [4 /*yield*/, this.bulkCreateNodes(nodes)];
                    case 1:
                        // Create all nodes first
                        _a.sent();
                        nodeIds = nodes.map(function (n) { return n.id; });
                        _i = 0, nodeIds_2 = nodeIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < nodeIds_2.length)) return [3 /*break*/, 7];
                        nodeId = nodeIds_2[_i];
                        return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 3:
                        node = _a.sent();
                        if (!node) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.calculateCorrectDepth(nodeId)];
                    case 4:
                        correctDepth = _a.sent();
                        if (!(node.depth !== correctDepth)) return [3 /*break*/, 6];
                        node.depth = correctDepth;
                        node.updatedAt = Date.now();
                        node.version++;
                        return [4 /*yield*/, this.nodes.put(node)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate correct depth for a node based on its parent chain
     */
    CoreDB.prototype.calculateCorrectDepth = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var node, parentDepth;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodes.get(nodeId)];
                    case 1:
                        node = _a.sent();
                        if (!node)
                            return [2 /*return*/, 0];
                        if (!node.parentId || node.parentId === '') {
                            return [2 /*return*/, 0]; // Root node
                        }
                        return [4 /*yield*/, this.calculateCorrectDepth(node.parentId)];
                    case 2:
                        parentDepth = _a.sent();
                        return [2 /*return*/, parentDepth + 1];
                }
            });
        });
    };
    /**
     * Reset singleton instance for testing
     */
    CoreDB.resetInstance = function () {
        common_core_1.SingletonMixin.terminate(CoreDB.name);
    };
    return CoreDB;
}(dexie_1.default));
exports.CoreDB = CoreDB;

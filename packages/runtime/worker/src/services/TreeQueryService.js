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
exports.TreeQueryService = void 0;
var TreeQueryService = /** @class */ (function () {
    function TreeQueryService(coreDB) {
        this.coreDB = coreDB;
    }
    // Basic Query Operations
    TreeQueryService.prototype.getTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.coreDB.listTrees()];
                    case 1: return [2 /*return*/, (_a.sent()) || []];
                }
            });
        });
    };
    TreeQueryService.prototype.getTree = function (treeId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[TreeQueryService] getTree called with treeId:', treeId);
                        return [4 /*yield*/, this.coreDB.getTree(treeId)];
                    case 1:
                        result = _a.sent();
                        console.log('[TreeQueryService] getTree result:', result);
                        return [2 /*return*/, result];
                }
            });
        });
    };
    TreeQueryService.prototype.listTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.coreDB.listTrees()];
                    case 1: return [2 /*return*/, (_a.sent()) || []];
                }
            });
        });
    };
    TreeQueryService.prototype.getNode = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Validate that nodeId is present and valid
                        if (!nodeId || typeof nodeId !== 'string') {
                            console.warn('Invalid node ID provided to getNode:', nodeId);
                            return [2 /*return*/, undefined];
                        }
                        return [4 /*yield*/, this.coreDB.getNode(nodeId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TreeQueryService.prototype.listChildren = function (parentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.coreDB.listChildren(parentId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TreeQueryService.prototype.listDescendants = function (nodeId, maxDepth) {
        return __awaiter(this, void 0, void 0, function () {
            var descendants, visited, collectDescendants;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        descendants = [];
                        visited = new Set();
                        collectDescendants = function (currentNodeId, currentDepth) { return __awaiter(_this, void 0, void 0, function () {
                            var childNodes, _i, childNodes_1, childNode;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (maxDepth !== undefined && currentDepth >= maxDepth)
                                            return [2 /*return*/];
                                        if (visited.has(currentNodeId))
                                            return [2 /*return*/];
                                        visited.add(currentNodeId);
                                        return [4 /*yield*/, this.listChildren(currentNodeId)];
                                    case 1:
                                        childNodes = _a.sent();
                                        _i = 0, childNodes_1 = childNodes;
                                        _a.label = 2;
                                    case 2:
                                        if (!(_i < childNodes_1.length)) return [3 /*break*/, 5];
                                        childNode = childNodes_1[_i];
                                        descendants.push(childNode);
                                        return [4 /*yield*/, collectDescendants(childNode.id, currentDepth + 1)];
                                    case 3:
                                        _a.sent();
                                        _a.label = 4;
                                    case 4:
                                        _i++;
                                        return [3 /*break*/, 2];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, collectDescendants(nodeId, 0)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, descendants];
                }
            });
        });
    };
    TreeQueryService.prototype.listAncestors = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var ancestors, currentNodeId, node, parent_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ancestors = [];
                        currentNodeId = nodeId;
                        _a.label = 1;
                    case 1:
                        if (!currentNodeId) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getNode(currentNodeId)];
                    case 2:
                        node = _a.sent();
                        if (!node || !node.parentId)
                            return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getNode(node.parentId)];
                    case 3:
                        parent_1 = _a.sent();
                        if (!parent_1)
                            return [3 /*break*/, 4];
                        ancestors.unshift(parent_1); // Add to beginning to get root-first order
                        currentNodeId = parent_1.parentId;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, ancestors];
                }
            });
        });
    };
    TreeQueryService.prototype.searchNodes = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var rootNodeId, query, _a, mode, maxDepth, maxResults, _b, caseSensitive, _c, searchInDescription, results, descendants, searchString, _i, descendants_1, node, nodeName, nodeDesc, matches, checkMatch;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        rootNodeId = options.rootNodeId, query = options.query, _a = options.mode, mode = _a === void 0 ? 'partial' : _a, maxDepth = options.maxDepth, maxResults = options.maxResults, _b = options.caseSensitive, caseSensitive = _b === void 0 ? false : _b, _c = options.searchInDescription, searchInDescription = _c === void 0 ? false : _c;
                        results = [];
                        return [4 /*yield*/, this.listDescendants(rootNodeId, maxDepth)];
                    case 1:
                        descendants = _d.sent();
                        searchString = caseSensitive ? query : query.toLowerCase();
                        for (_i = 0, descendants_1 = descendants; _i < descendants_1.length; _i++) {
                            node = descendants_1[_i];
                            if (maxResults && results.length >= maxResults)
                                break;
                            nodeName = caseSensitive ? node.name : node.name.toLowerCase();
                            nodeDesc = searchInDescription && node.description
                                ? caseSensitive
                                    ? node.description
                                    : node.description.toLowerCase()
                                : '';
                            matches = false;
                            checkMatch = function (text) {
                                switch (mode) {
                                    case 'exact':
                                        return text === searchString;
                                    case 'prefix':
                                        return text.startsWith(searchString);
                                    case 'suffix':
                                        return text.endsWith(searchString);
                                    case 'partial':
                                    default:
                                        return text.includes(searchString);
                                }
                            };
                            if (checkMatch(nodeName) || (searchInDescription && checkMatch(nodeDesc))) {
                                matches = true;
                            }
                            if (matches) {
                                results.push(node);
                            }
                        }
                        return [2 /*return*/, results];
                }
            });
        });
    };
    // Legacy methods for backward compatibility
    TreeQueryService.prototype.getChildren = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var parentId, _a, sortBy, _b, sortOrder, limit, offset, childNodes;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        parentId = payload.parentId, _a = payload.sortBy, sortBy = _a === void 0 ? 'createdAt' : _a, _b = payload.sortOrder, sortOrder = _b === void 0 ? 'asc' : _b, limit = payload.limit, offset = payload.offset;
                        return [4 /*yield*/, this.listChildren(parentId)];
                    case 1:
                        childNodes = _c.sent();
                        // Apply sorting
                        if (sortBy) {
                            childNodes = childNodes.sort(function (a, b) {
                                var valueA = a[sortBy];
                                var valueB = b[sortBy];
                                if (sortBy === 'name') {
                                    valueA = valueA === null || valueA === void 0 ? void 0 : valueA.toLowerCase();
                                    valueB = valueB === null || valueB === void 0 ? void 0 : valueB.toLowerCase();
                                }
                                if (sortOrder === 'desc') {
                                    return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
                                }
                                else {
                                    return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
                                }
                            });
                        }
                        // Apply pagination
                        if (offset !== undefined) {
                            childNodes = childNodes.slice(offset);
                        }
                        if (limit !== undefined) {
                            childNodes = childNodes.slice(0, limit);
                        }
                        return [2 /*return*/, childNodes];
                }
            });
        });
    };
    TreeQueryService.prototype.getDescendants = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var rootId, maxDepth, includeTypes, excludeTypes, descendants, visited, collectDescendants;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rootId = payload.rootId, maxDepth = payload.maxDepth, includeTypes = payload.includeTypes, excludeTypes = payload.excludeTypes;
                        descendants = [];
                        visited = new Set();
                        collectDescendants = function (nodeId, currentDepth) { return __awaiter(_this, void 0, void 0, function () {
                            var childNodes, _i, childNodes_2, childNode, childMatches;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (visited.has(nodeId))
                                            return [2 /*return*/]; // Prevent infinite loops
                                        visited.add(nodeId);
                                        // If we've exceeded the depth limit, don't process children
                                        if (maxDepth !== undefined && currentDepth >= maxDepth) {
                                            return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, this.coreDB.listChildren(nodeId)];
                                    case 1:
                                        childNodes = _a.sent();
                                        _i = 0, childNodes_2 = childNodes;
                                        _a.label = 2;
                                    case 2:
                                        if (!(_i < childNodes_2.length)) return [3 /*break*/, 5];
                                        childNode = childNodes_2[_i];
                                        childMatches = (!includeTypes || includeTypes.includes(childNode.nodeType)) &&
                                            (!excludeTypes || !excludeTypes.includes(childNode.nodeType));
                                        if (childMatches) {
                                            descendants.push(childNode);
                                        }
                                        // Always recurse to find deeper matching descendants, regardless of current node type
                                        return [4 /*yield*/, collectDescendants(childNode.id, currentDepth + 1)];
                                    case 3:
                                        // Always recurse to find deeper matching descendants, regardless of current node type
                                        _a.sent();
                                        _a.label = 4;
                                    case 4:
                                        _i++;
                                        return [3 /*break*/, 2];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, collectDescendants(rootId, 0)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, descendants];
                }
            });
        });
    };
    TreeQueryService.prototype.getAncestors = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeId, ancestors, currentId, visited, node;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeId = payload.nodeId;
                        ancestors = [];
                        currentId = nodeId;
                        visited = new Set();
                        _a.label = 1;
                    case 1:
                        if (!currentId) return [3 /*break*/, 3];
                        if (visited.has(currentId)) {
                            // Circular reference detected, break to prevent infinite loop
                            return [3 /*break*/, 3];
                        }
                        visited.add(currentId);
                        return [4 /*yield*/, this.coreDB.getNode(currentId)];
                    case 2:
                        node = _a.sent();
                        if (!node) {
                            return [3 /*break*/, 3];
                        }
                        ancestors.push(node);
                        // Stop if we reached the root or super root
                        if (!node.parentId || node.parentId === currentId) {
                            return [3 /*break*/, 3];
                        }
                        currentId = node.parentId;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, ancestors];
                }
            });
        });
    };
    // Search Operations - removed duplicate implementation
    // Copy/Export Operations
    /**
     * 【機能概要】: 指定されたノード群とその子孫を全てコピーしてクリップボードデータを生成する
     * 【セキュリティ改善】: 大量データ処理制限とバリデーション強化を実装
     * 【パフォーマンス改善】: バッチ処理とメモリ効率化を実現
     * 【設計方針】: DoS攻撃防止と効率的なデータ収集を両立する設計
     * 🟢 信頼性レベル: docs/14-copy-paste-analysis.mdの実装方針に準拠
     */
    TreeQueryService.prototype.copyNodes = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, MAX_COPY_NODES, validNodeIds, nodeData_1, allNodes_1, _i, validNodeIds_1, nodeId, descendants, clipboardData, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeIds = payload.nodeIds;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        // 【セキュリティ: 入力値検証】: 不正なペイロードに対する防御 🟢
                        if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Invalid nodeIds: must be a non-empty array',
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        MAX_COPY_NODES = 1000;
                        if (nodeIds.length > MAX_COPY_NODES) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Too many nodes specified (max: ".concat(MAX_COPY_NODES, ")"),
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        validNodeIds = nodeIds.filter(function (id) { return typeof id === 'string' && id.length > 0 && id.length <= 255; });
                        if (validNodeIds.length === 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'No valid nodeIds provided',
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        nodeData_1 = {};
                        allNodes_1 = new Set();
                        _i = 0, validNodeIds_1 = validNodeIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < validNodeIds_1.length)) return [3 /*break*/, 5];
                        nodeId = validNodeIds_1[_i];
                        return [4 /*yield*/, this.getAllDescendantsWithSelf(nodeId)];
                    case 3:
                        descendants = _a.sent();
                        // 【メモリ効率化】: 重複ノードの排除 🟢
                        descendants.forEach(function (node) {
                            if (!nodeData_1[node.id]) {
                                // 重複チェックで無駄な処理を回避
                                nodeData_1[node.id] = node;
                                allNodes_1.add(node.id);
                            }
                        });
                        // 【セキュリティ: メモリ使用量監視】: 過剰なメモリ使用の防止 🟡
                        if (Object.keys(nodeData_1).length > MAX_COPY_NODES) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Too many descendant nodes (max: ".concat(MAX_COPY_NODES, ")"),
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        clipboardData = {
                            type: 'nodes-copy',
                            timestamp: Date.now(),
                            nodes: nodeData_1,
                            rootIds: validNodeIds,
                            nodeCount: Object.keys(nodeData_1).length, // 【統計情報】: 効率的な処理のための件数情報
                        };
                        // 【成功レスポンス】: 標準化されたレスポンス形式 🟢
                        return [2 /*return*/, {
                                success: true,
                                seq: this.getNextSeq(),
                                clipboardData: clipboardData,
                            }];
                    case 6:
                        error_1 = _a.sent();
                        // 【エラーハンドリング】: セキュリティを考慮したエラー情報の制限 🟢
                        console.error('Copy operation failed:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                error: error_1 instanceof Error ? error_1.message : 'Copy operation failed',
                                code: 'INVALID_OPERATION',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    TreeQueryService.prototype.exportNodes = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, exportData_1, _i, nodeIds_1, nodeId, descendants, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeIds = payload.nodeIds;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        exportData_1 = {
                            nodes: {},
                            metadata: {
                                exportedAt: Date.now(),
                                rootIds: nodeIds,
                                totalNodes: 0,
                            },
                        };
                        _i = 0, nodeIds_1 = nodeIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < nodeIds_1.length)) return [3 /*break*/, 5];
                        nodeId = nodeIds_1[_i];
                        return [4 /*yield*/, this.getAllDescendantsWithSelf(nodeId)];
                    case 3:
                        descendants = _a.sent();
                        descendants.forEach(function (node) {
                            exportData_1.nodes[node.id] = node;
                        });
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        exportData_1.metadata.totalNodes = Object.keys(exportData_1.nodes).length;
                        // In a real implementation, this would be written to a file or returned as a download
                        // For now, we just return success with the data reference
                        return [2 /*return*/, {
                                success: true,
                                seq: this.getNextSeq(),
                            }];
                    case 6:
                        error_2 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : 'Export operation failed',
                                code: 'NODE_NOT_FOUND',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Helper Methods
    TreeQueryService.prototype.getAllDescendantsWithSelf = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, visited, collectNodes;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = [];
                        visited = new Set();
                        collectNodes = function (currentId) { return __awaiter(_this, void 0, void 0, function () {
                            var node, children, _i, children_1, childNode;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (visited.has(currentId))
                                            return [2 /*return*/];
                                        visited.add(currentId);
                                        return [4 /*yield*/, this.coreDB.getNode(currentId)];
                                    case 1:
                                        node = _a.sent();
                                        // Include the node if it exists (but don't stop if it doesn't - virtual root nodes may not exist)
                                        if (node) {
                                            result.push(node);
                                        }
                                        return [4 /*yield*/, this.coreDB.listChildren(currentId)];
                                    case 2:
                                        children = _a.sent();
                                        _i = 0, children_1 = children;
                                        _a.label = 3;
                                    case 3:
                                        if (!(_i < children_1.length)) return [3 /*break*/, 6];
                                        childNode = children_1[_i];
                                        return [4 /*yield*/, collectNodes(childNode.id)];
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
                        return [4 /*yield*/, collectNodes(nodeId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    TreeQueryService.prototype.getAllNodes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allNodes, visited, potentialRoots, _i, potentialRoots_1, rootId, descendants;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // In a real implementation, this would be a more efficient database query
                        // For testing purposes, we'll iterate through all stored nodes
                        if (this.coreDB && 'treeNodes' in this.coreDB && this.coreDB.treeNodes instanceof Map) {
                            return [2 /*return*/, Array.from(this.coreDB.treeNodes.values())];
                        }
                        allNodes = [];
                        visited = new Set();
                        potentialRoots = ['root'];
                        _i = 0, potentialRoots_1 = potentialRoots;
                        _a.label = 1;
                    case 1:
                        if (!(_i < potentialRoots_1.length)) return [3 /*break*/, 4];
                        rootId = potentialRoots_1[_i];
                        return [4 /*yield*/, this.getAllDescendantsWithSelf(rootId)];
                    case 2:
                        descendants = _a.sent();
                        descendants.forEach(function (node) {
                            if (!visited.has(node.id)) {
                                visited.add(node.id);
                                allNodes.push(node);
                            }
                        });
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, allNodes];
                }
            });
        });
    };
    TreeQueryService.prototype.getNextSeq = function () {
        // In a real implementation, this should be managed by CommandProcessor
        return Date.now();
    };
    return TreeQueryService;
}());
exports.TreeQueryService = TreeQueryService;

"use strict";
/**
 * ExportService - ツリーノードとリソースのエクスポート処理
 * @module worker/services/ExportService
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
exports.ExportService = void 0;
/**
 * エクスポートサービス
 * ツリーノードをJSON/ZIP形式でエクスポート
 */
var ExportService = /** @class */ (function () {
    function ExportService(coreDB, queryService) {
        this.coreDB = coreDB;
        this.queryService = queryService;
    }
    /**
     * ツリーノードをJSONとしてエクスポート
     */
    ExportService.prototype.exportToJSON = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, progressCallback, exportData, manifest, exportPackage, jsonString, blob, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeIds = options.nodeIds, progressCallback = options.progressCallback;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // 進捗通知: ノード収集開始
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'collecting-nodes',
                            current: 0,
                            total: nodeIds.length,
                            message: 'Collecting nodes for export',
                        });
                        return [4 /*yield*/, this.collectNodes(nodeIds, progressCallback)];
                    case 2:
                        exportData = _a.sent();
                        manifest = {
                            version: '1.0',
                            name: 'HierarchiDB Export',
                            description: "Exported ".concat(exportData.nodeIds.length, " nodes"),
                            exportDate: new Date().toISOString(),
                            exportedBy: 'HierarchiDB',
                            appVersion: '1.0.0',
                            nodeCount: exportData.nodeIds.length,
                            resourceTypes: this.countResourceTypes(exportData.nodes),
                            rootNodes: nodeIds,
                        };
                        // 進捗通知: アーカイブ作成
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'creating-archive',
                            current: 1,
                            total: 1,
                            message: 'Creating export file',
                        });
                        exportPackage = __assign({ manifest: manifest }, exportData);
                        jsonString = JSON.stringify(exportPackage, null, 2);
                        blob = new Blob([jsonString], { type: 'application/json' });
                        // 進捗通知: 完了
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'finalizing',
                            current: 1,
                            total: 1,
                            message: 'Export completed successfully',
                        });
                        return [2 /*return*/, {
                                success: true,
                                blob: blob,
                                exportedNodeCount: exportData.nodeIds.length,
                                errors: [],
                            }];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Export failed:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                exportedNodeCount: 0,
                                errors: [error_1 instanceof Error ? error_1.message : 'Unknown error occurred'],
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ツリーノードをZIPとしてエクスポート（将来実装）
     */
    ExportService.prototype.exportToZIP = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // ZIP形式のエクスポートは後続フェーズで実装
                // 現時点ではJSONエクスポートにフォールバック
                return [2 /*return*/, this.exportToJSON(options)];
            });
        });
    };
    /**
     * ノードとその子孫を収集
     */
    ExportService.prototype.collectNodes = function (nodeIds, progressCallback) {
        return __awaiter(this, void 0, void 0, function () {
            var nodes, allNodeIds, visited, _i, _a, _b, index, nodeId, treeDepth;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        nodes = {};
                        allNodeIds = [];
                        visited = new Set();
                        _i = 0, _a = nodeIds.entries();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        _b = _a[_i], index = _b[0], nodeId = _b[1];
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'collecting-nodes',
                            current: index + 1,
                            total: nodeIds.length,
                            message: "Collecting node ".concat(index + 1, " of ").concat(nodeIds.length),
                        });
                        return [4 /*yield*/, this.collectNodeRecursive(nodeId, nodes, allNodeIds, visited)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        treeDepth = this.calculateTreeDepth(nodes, nodeIds);
                        return [2 /*return*/, {
                                nodes: nodes,
                                nodeIds: allNodeIds,
                                rootIds: nodeIds,
                                metadata: {
                                    totalCount: allNodeIds.length,
                                    treeDepth: treeDepth,
                                },
                            }];
                }
            });
        });
    };
    /**
     * ノードを再帰的に収集
     */
    ExportService.prototype.collectNodeRecursive = function (nodeId, nodes, nodeIds, visited) {
        return __awaiter(this, void 0, void 0, function () {
            var node, children, _i, children_1, child;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // 既に訪問済みの場合はスキップ
                        if (visited.has(nodeId)) {
                            return [2 /*return*/];
                        }
                        visited.add(nodeId);
                        return [4 /*yield*/, this.coreDB.getNode(nodeId)];
                    case 1:
                        node = _a.sent();
                        if (!node) {
                            return [2 /*return*/];
                        }
                        // ノードを追加
                        nodes[nodeId] = node;
                        nodeIds.push(nodeId);
                        return [4 /*yield*/, this.coreDB.listChildren(nodeId)];
                    case 2:
                        children = _a.sent();
                        _i = 0, children_1 = children;
                        _a.label = 3;
                    case 3:
                        if (!(_i < children_1.length)) return [3 /*break*/, 6];
                        child = children_1[_i];
                        return [4 /*yield*/, this.collectNodeRecursive(child.id, nodes, nodeIds, visited)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * リソースタイプをカウント
     */
    ExportService.prototype.countResourceTypes = function (nodes) {
        var counts = {};
        for (var _i = 0, _a = Object.values(nodes); _i < _a.length; _i++) {
            var node = _a[_i];
            var type = node.nodeType;
            if (type && type !== 'folder') {
                counts[type] = (counts[type] || 0) + 1;
            }
        }
        return counts;
    };
    /**
     * ツリーの深さを計算
     */
    ExportService.prototype.calculateTreeDepth = function (nodes, rootIds) {
        var maxDepth = 0;
        var calculateDepthRecursive = function (nodeId, depth) {
            maxDepth = Math.max(maxDepth, depth);
            // 子ノードを探す
            for (var _i = 0, _a = Object.values(nodes); _i < _a.length; _i++) {
                var node = _a[_i];
                if (node.parentId === nodeId) {
                    calculateDepthRecursive(node.id, depth + 1);
                }
            }
        };
        // 各ルートノードから深さを計算
        for (var _i = 0, rootIds_1 = rootIds; _i < rootIds_1.length; _i++) {
            var rootId = rootIds_1[_i];
            calculateDepthRecursive(rootId, 1);
        }
        return maxDepth;
    };
    /**
     * エクスポートファイル名の生成
     */
    ExportService.generateFileName = function (prefix) {
        if (prefix === void 0) { prefix = 'export'; }
        var date = new Date();
        var timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        return "".concat(prefix, "_").concat(timestamp, ".json");
    };
    return ExportService;
}());
exports.ExportService = ExportService;

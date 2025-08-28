"use strict";
/**
 * ImportService - ツリーノードとリソースのインポート処理
 * @module worker/services/ImportService
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
exports.ImportService = void 0;
// Use native crypto.randomUUID() instead of uuid package
/**
 * インポートサービス
 * テンプレートやZIPファイルからのインポート処理を管理
 */
var ImportService = /** @class */ (function () {
    function ImportService(coreDB, mutationService) {
        this.coreDB = coreDB;
        this.mutationService = mutationService;
    }
    /**
     * テンプレートからインポート
     */
    ImportService.prototype.importFromTemplate = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var templateId, targetParentId, _a, mergeStrategy, progressCallback, manifestResponse, manifest, nodesResponse, treeData, idMapping, newNodes, newNodeIds, _i, _b, _c, index, oldId, newId, oldNode, newParentId, command, result, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        templateId = options.templateId, targetParentId = options.targetParentId, _a = options.mergeStrategy, mergeStrategy = _a === void 0 ? 'rename' : _a, progressCallback = options.progressCallback;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 9, , 10]);
                        // 進捗通知: 読み込み開始
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'reading',
                            current: 0,
                            total: 1,
                            message: "Loading template: ".concat(templateId),
                        });
                        return [4 /*yield*/, fetch("/templates/".concat(templateId, "/manifest.json"))];
                    case 2:
                        manifestResponse = _d.sent();
                        if (!manifestResponse.ok) {
                            throw new Error("Template not found: ".concat(templateId));
                        }
                        return [4 /*yield*/, manifestResponse.json()];
                    case 3:
                        manifest = _d.sent();
                        // 進捗通知: 検証
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'validating',
                            current: 1,
                            total: 1,
                            message: 'Validating template data',
                        });
                        return [4 /*yield*/, fetch("/templates/".concat(templateId, "/tree-nodes.json"))];
                    case 4:
                        nodesResponse = _d.sent();
                        if (!nodesResponse.ok) {
                            throw new Error("Template data not found: ".concat(templateId));
                        }
                        return [4 /*yield*/, nodesResponse.json()];
                    case 5:
                        treeData = _d.sent();
                        // 進捗通知: インポート開始
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'importing-nodes',
                            current: 0,
                            total: treeData.nodeIds.length,
                            message: "Importing ".concat(treeData.nodeIds.length, " nodes"),
                        });
                        idMapping = new Map();
                        newNodes = {};
                        newNodeIds = [];
                        // 各ノードに新しいIDを割り当て
                        for (_i = 0, _b = treeData.nodeIds.entries(); _i < _b.length; _i++) {
                            _c = _b[_i], index = _c[0], oldId = _c[1];
                            newId = crypto.randomUUID();
                            idMapping.set(oldId, newId);
                            newNodeIds.push(newId);
                            oldNode = treeData.nodes[oldId];
                            if (oldNode) {
                                newParentId = null;
                                if (oldNode.parentId) {
                                    newParentId = idMapping.get(oldNode.parentId) || targetParentId;
                                }
                                else {
                                    // ルートノードの場合、targetParentIdを親に設定
                                    newParentId = targetParentId;
                                }
                                // 新しいノードの作成
                                newNodes[newId] = __assign(__assign({}, oldNode), { id: newId, parentId: newParentId, createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                                // 進捗更新
                                progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                                    phase: 'importing-nodes',
                                    current: index + 1,
                                    total: treeData.nodeIds.length,
                                    message: "Importing node: ".concat(oldNode.name),
                                });
                            }
                        }
                        if (!(mergeStrategy === 'rename')) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.handleNameConflicts(newNodes, targetParentId)];
                    case 6:
                        _d.sent();
                        _d.label = 7;
                    case 7:
                        command = {
                            payload: {
                                nodes: newNodes,
                                nodeIds: newNodeIds,
                                toParentId: targetParentId,
                                onNameConflict: mergeStrategy === 'rename' ? 'auto-rename' : 'error',
                            },
                            commandId: "import-template-".concat(Date.now()),
                            groupId: "template-".concat(templateId),
                            kind: 'importNodes',
                            issuedAt: Date.now(),
                        };
                        return [4 /*yield*/, this.mutationService.importNodes(command)];
                    case 8:
                        result = _d.sent();
                        // 進捗通知: 完了
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'finalizing',
                            current: 1,
                            total: 1,
                            message: 'Import completed successfully',
                        });
                        return [2 /*return*/, {
                                success: result.success,
                                importedNodeIds: newNodeIds,
                                skippedNodes: 0,
                                errors: result.success ? [] : ['error' in result ? result.error : 'Import failed'],
                                warnings: [],
                            }];
                    case 9:
                        error_1 = _d.sent();
                        console.error('Import failed:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                importedNodeIds: [],
                                skippedNodes: 0,
                                errors: [error_1 instanceof Error ? error_1.message : 'Unknown error occurred'],
                            }];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ZIPファイルからインポート
     */
    ImportService.prototype.importFromFile = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var file, targetParentId, _a, mergeStrategy, progressCallback, text, data, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        file = options.file, targetParentId = options.targetParentId, _a = options.mergeStrategy, mergeStrategy = _a === void 0 ? 'rename' : _a, progressCallback = options.progressCallback;
                        // 進捗通知: 読み込み開始
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'reading',
                            current: 0,
                            total: 1,
                            message: "Reading file: ".concat(file.name),
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, file.text()];
                    case 2:
                        text = _b.sent();
                        data = JSON.parse(text);
                        // JSONデータをツリーノードとして処理
                        if (data.nodes && data.nodeIds) {
                            // tree-nodes.json形式として処理
                            return [2 /*return*/, this.importTreeNodes(data, targetParentId, mergeStrategy, progressCallback)];
                        }
                        else {
                            throw new Error('Invalid file format. Expected tree-nodes.json structure.');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        return [2 /*return*/, {
                                success: false,
                                importedNodeIds: [],
                                skippedNodes: 0,
                                errors: [error_2 instanceof Error ? error_2.message : 'Failed to parse file'],
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ツリーノードデータのインポート（内部処理）
     */
    ImportService.prototype.importTreeNodes = function (treeData, targetParentId, mergeStrategy, progressCallback) {
        return __awaiter(this, void 0, void 0, function () {
            var idMapping, newNodes, newNodeIds, _i, _a, _b, index, oldId, newId, oldNode, newParentId, command, result;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        idMapping = new Map();
                        newNodes = {};
                        newNodeIds = [];
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'importing-nodes',
                            current: 0,
                            total: treeData.nodeIds.length,
                            message: "Importing ".concat(treeData.nodeIds.length, " nodes"),
                        });
                        // 各ノードに新しいIDを割り当て
                        for (_i = 0, _a = treeData.nodeIds.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], index = _b[0], oldId = _b[1];
                            newId = crypto.randomUUID();
                            idMapping.set(oldId, newId);
                            newNodeIds.push(newId);
                            oldNode = treeData.nodes[oldId];
                            if (oldNode) {
                                newParentId = null;
                                if (oldNode.parentId) {
                                    newParentId = idMapping.get(oldNode.parentId) || targetParentId;
                                }
                                else {
                                    newParentId = targetParentId;
                                }
                                newNodes[newId] = __assign(__assign({}, oldNode), { id: newId, parentId: newParentId, createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                                progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                                    phase: 'importing-nodes',
                                    current: index + 1,
                                    total: treeData.nodeIds.length,
                                    message: "Importing: ".concat(oldNode.name),
                                });
                            }
                        }
                        command = {
                            payload: {
                                nodes: newNodes,
                                nodeIds: newNodeIds,
                                toParentId: targetParentId,
                                onNameConflict: mergeStrategy === 'rename' ? 'auto-rename' : 'error',
                            },
                            commandId: "import-file-".concat(Date.now()),
                            groupId: "import-".concat(Date.now()),
                            kind: 'importNodes',
                            issuedAt: Date.now(),
                        };
                        return [4 /*yield*/, this.mutationService.importNodes(command)];
                    case 1:
                        result = _c.sent();
                        progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback({
                            phase: 'finalizing',
                            current: 1,
                            total: 1,
                            message: 'Import completed',
                        });
                        return [2 /*return*/, {
                                success: result.success,
                                importedNodeIds: newNodeIds,
                                skippedNodes: 0,
                                errors: result.success ? [] : ['error' in result ? result.error : 'Import failed'],
                            }];
                }
            });
        });
    };
    /**
     * 名前衝突の処理
     */
    ImportService.prototype.handleNameConflicts = function (nodes, parentId) {
        return __awaiter(this, void 0, void 0, function () {
            var existingChildren, existingNames, _i, _a, node, counter, newName;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.coreDB.listChildren(parentId)];
                    case 1:
                        existingChildren = _b.sent();
                        existingNames = new Set(existingChildren.map(function (node) { return node.name; }));
                        // 衝突するノードの名前を変更
                        for (_i = 0, _a = Object.values(nodes); _i < _a.length; _i++) {
                            node = _a[_i];
                            if (node.parentId === parentId && existingNames.has(node.name)) {
                                counter = 1;
                                newName = "".concat(node.name, " (").concat(counter, ")");
                                while (existingNames.has(newName)) {
                                    counter++;
                                    newName = "".concat(node.name, " (").concat(counter, ")");
                                }
                                node.name = newName;
                                existingNames.add(newName);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return ImportService;
}());
exports.ImportService = ImportService;

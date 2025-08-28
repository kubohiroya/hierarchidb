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
exports.TreeMutationService = void 0;
var common_core_1 = require("@hierarchidb/common-core");
var WorkingCopyOperations_1 = require("../operations/WorkingCopyOperations");
var TreeMutationService = /** @class */ (function () {
    function TreeMutationService(coreDB, ephemeralDB, commandProcessor, lifecycleManager) {
        this.coreDB = coreDB;
        this.ephemeralDB = ephemeralDB;
        this.commandProcessor = commandProcessor;
        this.lifecycleManager = lifecycleManager;
    }
    // ==================
    // TreeMutationAPI Interface Methods
    // ==================
    TreeMutationService.prototype.createNode = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeId, now, node, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        nodeId = (0, common_core_1.generateNodeId)();
                        now = Date.now();
                        node = {
                            id: nodeId,
                            parentId: params.parentId,
                            nodeType: params.nodeType,
                            name: params.name,
                            depth: 0,
                            createdAt: now,
                            updatedAt: now,
                            version: 1,
                        };
                        if (params.description) {
                            node.description = params.description;
                        }
                        return [4 /*yield*/, this.coreDB.createNode(node)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { success: true, nodeId: nodeId }];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, { success: false, error: String(error_1) }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.updateNode = function (params) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var node, updatedNode, error_2;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, params.nodeId))];
                    case 1:
                        node = _e.sent();
                        if (!node) {
                            return [2 /*return*/, { success: false, error: 'Node not found' }];
                        }
                        updatedNode = __assign(__assign(__assign(__assign({}, node), (params.name && { name: params.name })), (params.description !== undefined && { description: params.description })), { updatedAt: Date.now(), version: node.version + 1 });
                        return [4 /*yield*/, ((_d = (_c = this.coreDB).updateNode) === null || _d === void 0 ? void 0 : _d.call(_c, updatedNode))];
                    case 2:
                        _e.sent();
                        return [2 /*return*/, { success: true }];
                    case 3:
                        error_2 = _e.sent();
                        return [2 /*return*/, { success: false, error: String(error_2) }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.moveNodes = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var cmd, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cmd = {
                            commandId: crypto.randomUUID(),
                            groupId: crypto.randomUUID(),
                            kind: 'moveNodes',
                            payload: {
                                nodeIds: params.nodeIds,
                                toParentId: params.toParentId,
                                onNameConflict: params.onNameConflict,
                            },
                            issuedAt: Date.now(),
                        };
                        return [4 /*yield*/, this.moveNodesCommand(cmd)];
                    case 1:
                        result = _a.sent();
                        if (!result.success) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'error' in result ? result.error : 'Unknown error',
                                }];
                        }
                        return [2 /*return*/, { success: true }];
                }
            });
        });
    };
    TreeMutationService.prototype.duplicateNodes = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var firstNodeId, parentId, _a, cmd, result, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        firstNodeId = params.nodeIds[0];
                        if (!firstNodeId) {
                            return [2 /*return*/, { success: false, error: 'No node IDs provided' }];
                        }
                        _a = params.toParentId;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getParentId(firstNodeId)];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        parentId = _a;
                        cmd = {
                            commandId: crypto.randomUUID(),
                            groupId: crypto.randomUUID(),
                            kind: 'duplicateNodes',
                            payload: {
                                nodeIds: params.nodeIds,
                                toParentId: parentId,
                            },
                            issuedAt: Date.now(),
                        };
                        return [4 /*yield*/, this.duplicateNodesCommand(cmd)];
                    case 3:
                        result = _b.sent();
                        if (result.success) {
                            return [2 /*return*/, {
                                    success: true,
                                    nodeIds: result.newNodeIds || [],
                                }];
                        }
                        else {
                            return [2 /*return*/, { success: false, error: 'error' in result ? result.error : 'Unknown error' }];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _b.sent();
                        return [2 /*return*/, { success: false, error: String(error_3) }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.removeNodes = function (nodeIds) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _i, nodeIds_1, nodeId, error_4;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 5, , 6]);
                        _i = 0, nodeIds_1 = nodeIds;
                        _c.label = 1;
                    case 1:
                        if (!(_i < nodeIds_1.length)) return [3 /*break*/, 4];
                        nodeId = nodeIds_1[_i];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).deleteNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, { success: true }];
                    case 5:
                        error_4 = _c.sent();
                        return [2 /*return*/, { success: false, error: String(error_4) }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /*
    async moveNodesToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
      const cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'moveToTrash',
        payload: { nodeIds },
        issuedAt: Date.now() as Timestamp,
      };
      
      const result = await this.moveToTrash(cmd);
      if (!result.success) {
        return {
          success: false,
          error: (result as any).error || 'Unknown error',
        };
      }
      return { success: true };
    }
     */
    TreeMutationService.prototype.recoverNodesFromTrash = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var cmd, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cmd = {
                            commandId: crypto.randomUUID(),
                            groupId: crypto.randomUUID(),
                            kind: 'recoverFromTrash',
                            payload: {
                                nodeIds: params.nodeIds,
                                toParentId: params.toParentId,
                            },
                            issuedAt: Date.now(),
                        };
                        return [4 /*yield*/, this.recoverFromTrash(cmd)];
                    case 1:
                        result = _a.sent();
                        if (!result.success) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'error' in result ? result.error : 'Unknown error',
                                }];
                        }
                        return [2 /*return*/, { success: true }];
                }
            });
        });
    };
    TreeMutationService.prototype.getParentId = function (nodeId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var node;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 1:
                        node = _c.sent();
                        return [2 /*return*/, (node === null || node === void 0 ? void 0 : node.parentId) || ''];
                }
            });
        });
    };
    // Working Copy Operations
    TreeMutationService.prototype.createWorkingCopyForCreate = function (cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, workingCopyId, parentId, name, description, now, workingCopy;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cmd.payload, workingCopyId = _a.workingCopyId, parentId = _a.parentId, name = _a.name, description = _a.description;
                        now = Date.now();
                        workingCopy = {
                            workingCopyId: workingCopyId,
                            id: (0, common_core_1.generateNodeId)(),
                            parentId: parentId,
                            name: 'New Folder',
                            nodeType: 'folder',
                            status: 'draft',
                            depth: 0,
                            createdAt: now,
                            updatedAt: now,
                            changes: {
                                name: name,
                                description: description,
                            },
                            copiedAt: now,
                            version: 1,
                        };
                        // EphemeralDBの適切なメソッドを使用
                        return [4 /*yield*/, this.ephemeralDB.createWorkingCopy(workingCopy)];
                    case 1:
                        // EphemeralDBの適切なメソッドを使用
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.createWorkingCopy = function (cmd) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var sourceNodeId, sourceNode;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        sourceNodeId = cmd.payload.sourceNodeId;
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, sourceNodeId))];
                    case 1:
                        sourceNode = _c.sent();
                        if (!sourceNode) {
                            throw new Error('Node not found');
                        }
                        return [4 /*yield*/, (0, WorkingCopyOperations_1.createWorkingCopyFromNode)(this.ephemeralDB, this.coreDB, sourceNodeId)];
                    case 2:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.discardWorkingCopyForCreate = function (cmd) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var workingCopyId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        workingCopyId = cmd.payload.workingCopyId;
                        return [4 /*yield*/, ((_b = (_a = this.ephemeralDB).discardWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, workingCopyId))];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.discardWorkingCopy = function (cmd) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var workingCopyId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        workingCopyId = cmd.payload.workingCopyId;
                        return [4 /*yield*/, ((_b = (_a = this.ephemeralDB).discardWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, workingCopyId))];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.commitWorkingCopyForCreate = function (cmd) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _c, workingCopyId, _d, onNameConflict, workingCopy, newNodeId, now, newNode, error_5;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _c = cmd.payload, workingCopyId = _c.workingCopyId, _d = _c.onNameConflict, onNameConflict = _d === void 0 ? 'error' : _d;
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, ((_a = this.ephemeralDB.workingCopies) === null || _a === void 0 ? void 0 : _a.get(workingCopyId))];
                    case 2:
                        workingCopy = _e.sent();
                        if (!workingCopy) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Working copy not found: ".concat(workingCopyId),
                                    code: 'NODE_NOT_FOUND',
                                }];
                        }
                        newNodeId = (0, common_core_1.generateNodeId)();
                        now = Date.now();
                        newNode = {
                            id: newNodeId,
                            parentId: workingCopy.parentId,
                            nodeType: workingCopy.nodeType || 'folder',
                            name: workingCopy.originalName || 'New Folder',
                            depth: 0,
                            createdAt: now,
                            updatedAt: now,
                            version: 1,
                        };
                        // descriptionがある場合は追加
                        if (workingCopy.description) {
                            newNode.description = workingCopy.description;
                        }
                        // CoreDBに保存
                        return [4 /*yield*/, this.coreDB.createNode(newNode)];
                    case 3:
                        // CoreDBに保存
                        _e.sent();
                        // Working Copyを削除
                        return [4 /*yield*/, ((_b = this.ephemeralDB.workingCopies) === null || _b === void 0 ? void 0 : _b.delete(workingCopyId))];
                    case 4:
                        // Working Copyを削除
                        _e.sent();
                        return [2 /*return*/, {
                                success: true,
                                seq: this.getNextSeq(),
                                nodeId: newNodeId,
                            }];
                    case 5:
                        error_5 = _e.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: String(error_5),
                                code: 'INVALID_OPERATION',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.commitWorkingCopy = function (cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, workingCopyId, _b, onNameConflict, result;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = cmd.payload, workingCopyId = _a.workingCopyId, _b = _a.onNameConflict, onNameConflict = _b === void 0 ? 'error' : _b;
                        return [4 /*yield*/, (0, WorkingCopyOperations_1.commitWorkingCopy)(this.ephemeralDB, this.coreDB, workingCopyId, false, // not a draft
                            onNameConflict)];
                    case 1:
                        result = _c.sent();
                        // Convert worker CommandResult to CoreCommandResult
                        return [2 /*return*/, result];
                }
            });
        });
    };
    // Physical Operations
    // Internal method for command processing
    TreeMutationService.prototype.moveNodesCommand = function (cmd) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function () {
            var _g, nodeIds, toParentId, _h, onNameConflict, _i, nodeIds_2, nodeId, _j, nodeIds_3, nodeId, node, newName, siblings, siblingNames;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        _g = cmd.payload, nodeIds = _g.nodeIds, toParentId = _g.toParentId, _h = _g.onNameConflict, onNameConflict = _h === void 0 ? 'error' : _h;
                        _i = 0, nodeIds_2 = nodeIds;
                        _k.label = 1;
                    case 1:
                        if (!(_i < nodeIds_2.length)) return [3 /*break*/, 4];
                        nodeId = nodeIds_2[_i];
                        return [4 /*yield*/, this.isDescendantOf(toParentId, nodeId)];
                    case 2:
                        if (_k.sent()) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Circular reference detected',
                                    code: 'ILLEGAL_RELATION',
                                }];
                        }
                        _k.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _j = 0, nodeIds_3 = nodeIds;
                        _k.label = 5;
                    case 5:
                        if (!(_j < nodeIds_3.length)) return [3 /*break*/, 11];
                        nodeId = nodeIds_3[_j];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 6:
                        node = _k.sent();
                        if (!node)
                            return [3 /*break*/, 10];
                        newName = node.name;
                        if (!(onNameConflict === 'auto-rename')) return [3 /*break*/, 8];
                        return [4 /*yield*/, ((_d = (_c = this.coreDB).listChildren) === null || _d === void 0 ? void 0 : _d.call(_c, toParentId))];
                    case 7:
                        siblings = (_k.sent()) || [];
                        siblingNames = siblings.map(function (sibling) { return sibling.name; });
                        newName = (0, WorkingCopyOperations_1.createNewName)(siblingNames, node.name);
                        _k.label = 8;
                    case 8: return [4 /*yield*/, ((_f = (_e = this.coreDB).updateNode) === null || _f === void 0 ? void 0 : _f.call(_e, __assign(__assign({}, node), { parentId: toParentId, name: newName, updatedAt: Date.now() })))];
                    case 9:
                        _k.sent();
                        _k.label = 10;
                    case 10:
                        _j++;
                        return [3 /*break*/, 5];
                    case 11: return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                        }];
                }
            });
        });
    };
    // Internal method for command processing
    TreeMutationService.prototype.duplicateNodesCommand = function (cmd) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _c, nodeIds, toParentId, _d, onNameConflict, newNodeIds, _i, nodeIds_4, sourceId, sourceNode, idMapping;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _c = cmd.payload, nodeIds = _c.nodeIds, toParentId = _c.toParentId, _d = _c.onNameConflict, onNameConflict = _d === void 0 ? 'error' : _d;
                        newNodeIds = [];
                        _i = 0, nodeIds_4 = nodeIds;
                        _e.label = 1;
                    case 1:
                        if (!(_i < nodeIds_4.length)) return [3 /*break*/, 5];
                        sourceId = nodeIds_4[_i];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, sourceId))];
                    case 2:
                        sourceNode = _e.sent();
                        if (!sourceNode)
                            return [3 /*break*/, 4];
                        idMapping = new Map();
                        return [4 /*yield*/, this.duplicateBranch(sourceId, toParentId, idMapping, true)];
                    case 3:
                        _e.sent();
                        newNodeIds.push.apply(newNodeIds, Array.from(idMapping.values()));
                        _e.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                            newNodeIds: newNodeIds,
                        }];
                }
            });
        });
    };
    /**
     * 【機能概要】: クリップボードデータからノード群をペーストし、新しいノードを作成する
     * 【セキュリティ改善】: 入力値検証とデータサニタイズを強化
     * 【パフォーマンス改善】: バッチ処理と効率的な名前衝突解決を実装
     * 【設計方針】: 安全で高速なペースト処理を実現
     * 🟢 信頼性レベル: docs/14-copy-paste-analysis.mdの実装方針に準拠
     */
    TreeMutationService.prototype.pasteNodes = function (cmd) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function () {
            var _g, nodes, nodeIds, toParentId, _h, onNameConflict, MAX_PASTE_NODES, parentId, parentNode, newNodeIds, siblings, existingNames, timestamp, _i, nodeIds_5, nodeId, sourceNode, newNodeId, newName, newNode, error_6;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _g = cmd.payload, nodes = _g.nodes, nodeIds = _g.nodeIds, toParentId = _g.toParentId, _h = _g.onNameConflict, onNameConflict = _h === void 0 ? 'error' : _h;
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 8, , 9]);
                        // 【セキュリティ: 入力値検証】: 不正なペイロードに対する防御 🟢
                        if (!nodes || typeof nodes !== 'object' || !nodeIds || !Array.isArray(nodeIds)) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Invalid paste payload: nodes and nodeIds are required',
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        if (!toParentId || typeof toParentId !== 'string') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Invalid toParentId: must be a non-empty string',
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        MAX_PASTE_NODES = 1000;
                        if (nodeIds.length > MAX_PASTE_NODES) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Too many nodes to paste (max: ".concat(MAX_PASTE_NODES, ")"),
                                    code: 'INVALID_OPERATION',
                                }];
                        }
                        parentId = toParentId;
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, parentId))];
                    case 2:
                        parentNode = _j.sent();
                        if (!parentNode) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Parent node not found: ".concat(toParentId),
                                    code: 'NODE_NOT_FOUND',
                                }];
                        }
                        newNodeIds = [];
                        return [4 /*yield*/, ((_d = (_c = this.coreDB).listChildren) === null || _d === void 0 ? void 0 : _d.call(_c, parentId))];
                    case 3:
                        siblings = (_j.sent()) || [];
                        existingNames = new Set(siblings.map(function (sibling) { return sibling.name; }));
                        timestamp = Date.now();
                        _i = 0, nodeIds_5 = nodeIds;
                        _j.label = 4;
                    case 4:
                        if (!(_i < nodeIds_5.length)) return [3 /*break*/, 7];
                        nodeId = nodeIds_5[_i];
                        sourceNode = nodes[nodeId];
                        if (!sourceNode) {
                            // 【データ整合性】: 存在しないノードはスキップして処理継続 🟢
                            console.warn("Source node not found in clipboard data: ".concat(nodeId));
                            return [3 /*break*/, 6];
                        }
                        // 【入力値サニタイズ】: ノードデータの検証 🟡
                        if (!sourceNode.name || typeof sourceNode.name !== 'string') {
                            console.warn("Invalid node name for ".concat(nodeId, ", skipping"));
                            return [3 /*break*/, 6];
                        }
                        newNodeId = (0, common_core_1.generateNodeId)();
                        newName = sourceNode.name;
                        if (onNameConflict === 'auto-rename' && existingNames.has(newName)) {
                            newName = this.resolveNameConflictEfficiently(newName, existingNames);
                        }
                        else if (onNameConflict === 'error' && existingNames.has(newName)) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Name conflict: '".concat(newName, "' already exists"),
                                    code: 'NAME_NOT_UNIQUE',
                                }];
                        }
                        newNode = __assign(__assign({}, sourceNode), { id: newNodeId, parentId: parentId, name: newName, createdAt: timestamp, updatedAt: timestamp, version: 1, 
                            // 【データクリーニング】: 不要なプロパティを削除 🟢
                            originalParentNodeId: undefined, originalName: undefined, removedAt: undefined, isRemoved: false });
                        return [4 /*yield*/, ((_f = (_e = this.coreDB).createNode) === null || _f === void 0 ? void 0 : _f.call(_e, newNode))];
                    case 5:
                        _j.sent();
                        newNodeIds.push(newNodeId);
                        // 【名前管理更新】: 新しい名前を既存名セットに追加 🟡
                        existingNames.add(newName);
                        _j.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7: 
                    // 【成功レスポンス】: 詳細な結果情報を含む 🟢
                    return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                            newNodeIds: newNodeIds,
                        }];
                    case 8:
                        error_6 = _j.sent();
                        // 【エラーハンドリング】: セキュリティを考慮したエラー情報の制限 🟢
                        console.error('Paste operation failed:', error_6);
                        return [2 /*return*/, {
                                success: false,
                                error: error_6 instanceof Error ? error_6.message : 'Paste operation failed',
                                code: 'INVALID_OPERATION',
                            }];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 【ヘルパー関数】: 効率的な名前衝突解決アルゴリズム
     * 【パフォーマンス】: Set使用で O(1) の名前チェック
     * 【再利用性】: 他の操作でも使用可能な汎用的実装
     * 🟡 信頼性レベル: 一般的なアルゴリズムを参考に実装
     */
    TreeMutationService.prototype.resolveNameConflictEfficiently = function (baseName, existingNames) {
        // 【効率的な番号探索】: 連続した番号で最初に利用可能な名前を発見
        var counter = 1;
        var candidateName;
        do {
            candidateName = "".concat(baseName, " (").concat(counter, ")");
            counter++;
            // 【安全装置】: 無限ループ防止 🟡
            if (counter > 10000) {
                candidateName = "".concat(baseName, " (").concat(Date.now(), ")");
                break;
            }
        } while (existingNames.has(candidateName));
        return candidateName;
    };
    /**
     * 【機能概要】: ノードをゴミ箱に移動し、復元用の情報を保存する
     * 【実装方針】: isRemovedフラグとremovedAtタイムスタンプを設定して完全なゴミ箱状態を実現
     * 【テスト対応】: folder-plugin-operations.test.tsの isRemoved 期待値を満たすための実装
     * 🟢 信頼性レベル: docs/13-trash-operations-analysis.mdの実装方針に完全準拠
     */
    TreeMutationService.prototype.moveNodesToTrash = function (nodeIds) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var trashRootId, _i, nodeIds_6, nodeId, node, updateData, updatedNode, error_7;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        trashRootId = 'trash';
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        _i = 0, nodeIds_6 = nodeIds;
                        _c.label = 2;
                    case 2:
                        if (!(_i < nodeIds_6.length)) return [3 /*break*/, 6];
                        nodeId = nodeIds_6[_i];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 3:
                        node = _c.sent();
                        if (!node) {
                            // 【存在しないノードのスキップ】: エラーではなく警告レベルで処理継続
                            console.warn("Node not found for moveToTrash: ".concat(nodeId));
                            return [3 /*break*/, 5];
                        }
                        updateData = {
                            // 【物理移動】: ゴミ箱ルートへの親ID変更
                            parentId: trashRootId,
                            // 【復元用情報保存】: 元の親IDと名前を保存
                            originalParentId: node.parentId,
                            originalName: node.name,
                            // 【ゴミ箱フラグ設定】: テストで期待されるisRemovedプロパティ 🟢
                            isRemoved: true,
                            // 【タイムスタンプ記録】: ゴミ箱移動時刻の記録
                            removedAt: Date.now(),
                            // 【更新時刻】: ノード更新時刻の記録
                            updatedAt: Date.now(),
                            // 【バージョン管理】: 楽観的排他制御のためのバージョン更新
                            version: node.version + 1,
                        };
                        updatedNode = __assign(__assign({}, node), updateData);
                        return [4 /*yield*/, this.coreDB.updateNode(updatedNode)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: 
                    // 【成功応答】: テストで期待される成功ステータスを返却 🟢
                    return [2 /*return*/, {
                            success: true,
                        }];
                    case 7:
                        error_7 = _c.sent();
                        // 【エラーハンドリング】: 例外発生時の適切なエラーレスポンス
                        console.error('Error in moveToTrash:', error_7);
                        return [2 /*return*/, {
                                success: false,
                                error: String(error_7),
                            }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.remove = function (cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeIds, _i, nodeIds_7, nodeId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeIds = cmd.payload.nodeIds;
                        _i = 0, nodeIds_7 = nodeIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < nodeIds_7.length)) return [3 /*break*/, 4];
                        nodeId = nodeIds_7[_i];
                        // Delete node and all descendants recursively
                        return [4 /*yield*/, this.deleteNodeRecursively(nodeId)];
                    case 2:
                        // Delete node and all descendants recursively
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                        }];
                }
            });
        });
    };
    /**
     * 【機能概要】: ゴミ箱からノードを復元し、元の場所または指定された場所に戻す
     * 【実装方針】: isRemovedフラグをfalseに設定し、復元用プロパティをクリアする
     * 【テスト対応】: folder-plugin-operations.test.tsの復元テストでisRemovedがfalseになることを確認
     * 🟢 信頼性レベル: docs/13-trash-operations-analysis.mdの復元実装方針に準拠
     */
    TreeMutationService.prototype.recoverFromTrash = function (cmd) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var _e, nodeIds, toParentId, _f, onNameConflict, _i, nodeIds_8, nodeId, node, targetParentId, restoredName, siblings, siblingNames, restoreData, restoredNode, error_8;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _e = cmd.payload, nodeIds = _e.nodeIds, toParentId = _e.toParentId, _f = _e.onNameConflict, onNameConflict = _f === void 0 ? 'error' : _f;
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 9, , 10]);
                        _i = 0, nodeIds_8 = nodeIds;
                        _g.label = 2;
                    case 2:
                        if (!(_i < nodeIds_8.length)) return [3 /*break*/, 8];
                        nodeId = nodeIds_8[_i];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 3:
                        node = _g.sent();
                        if (!node) {
                            // 【存在しないノードのスキップ】: エラーではなく警告レベルで処理継続
                            console.warn("Node not found for recoverFromTrash: ".concat(nodeId));
                            return [3 /*break*/, 7];
                        }
                        // 【ゴミ箱状態チェック】: isRemovedがtrueのノードのみ復元対象
                        if (!node.isRemoved) {
                            console.warn("Node ".concat(nodeId, " is not in trash, skipping recovery"));
                            return [3 /*break*/, 7];
                        }
                        targetParentId = toParentId || node.originalParentId;
                        if (!targetParentId) {
                            console.warn("No target parent for node ".concat(nodeId, ", skipping recovery"));
                            return [3 /*break*/, 7];
                        }
                        restoredName = node.originalName || node.name;
                        if (!(onNameConflict === 'auto-rename')) return [3 /*break*/, 5];
                        return [4 /*yield*/, ((_d = (_c = this.coreDB).listChildren) === null || _d === void 0 ? void 0 : _d.call(_c, targetParentId))];
                    case 4:
                        siblings = (_g.sent()) || [];
                        siblingNames = siblings.map(function (sibling) { return sibling.name; });
                        restoredName = (0, WorkingCopyOperations_1.createNewName)(siblingNames, restoredName);
                        _g.label = 5;
                    case 5:
                        restoreData = {
                            // 【親ID復元】: 元の場所または指定された場所に移動
                            parentId: targetParentId,
                            // 【名前復元】: 元の名前または衝突回避後の名前に設定
                            name: restoredName,
                            // 【ゴミ箱フラグクリア】: テストで期待されるisRemoved=falseの設定 🟢
                            isRemoved: false,
                            // 【復元用データクリア】: 全ての復元用プロパティを未定義に設定
                            originalParentId: undefined,
                            originalName: undefined,
                            removedAt: undefined,
                            // 【更新時刻記録】: 復元時刻の記録
                            updatedAt: Date.now(),
                            // 【バージョン管理】: 楽観的排他制御のためのバージョン更新
                            version: node.version + 1,
                        };
                        restoredNode = __assign(__assign({}, node), restoreData);
                        return [4 /*yield*/, this.coreDB.updateNode(restoredNode)];
                    case 6:
                        _g.sent();
                        _g.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: 
                    // 【成功応答】: テストで期待される成功ステータスを返却 🟢
                    return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                        }];
                    case 9:
                        error_8 = _g.sent();
                        // 【エラーハンドリング】: 例外発生時の適切なエラーレスポンス
                        console.error('Error in recoverFromTrash:', error_8);
                        return [2 /*return*/, {
                                success: false,
                                error: String(error_8),
                                code: 'INVALID_OPERATION',
                            }];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.importNodes = function (cmd) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var _e, nodes, nodeIds, toParentId, _f, onNameConflict, newNodeIds, idMapping, _i, nodeIds_9, nodeId, newNodeId, _g, nodeIds_10, nodeId, node, newNodeId, newParentId, newName, siblings, siblingNames;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _e = cmd.payload, nodes = _e.nodes, nodeIds = _e.nodeIds, toParentId = _e.toParentId, _f = _e.onNameConflict, onNameConflict = _f === void 0 ? 'error' : _f;
                        newNodeIds = [];
                        idMapping = new Map();
                        // First pass: create ID mappings
                        for (_i = 0, nodeIds_9 = nodeIds; _i < nodeIds_9.length; _i++) {
                            nodeId = nodeIds_9[_i];
                            newNodeId = (0, common_core_1.generateNodeId)();
                            idMapping.set(nodeId, newNodeId);
                            newNodeIds.push(newNodeId);
                        }
                        _g = 0, nodeIds_10 = nodeIds;
                        _h.label = 1;
                    case 1:
                        if (!(_g < nodeIds_10.length)) return [3 /*break*/, 6];
                        nodeId = nodeIds_10[_g];
                        node = nodes[nodeId];
                        if (!node)
                            return [3 /*break*/, 5];
                        newNodeId = idMapping.get(nodeId);
                        newParentId = idMapping.get(node.parentId) || toParentId;
                        newName = node.name;
                        if (!(onNameConflict === 'auto-rename')) return [3 /*break*/, 3];
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).listChildren) === null || _b === void 0 ? void 0 : _b.call(_a, newParentId))];
                    case 2:
                        siblings = (_h.sent()) || [];
                        siblingNames = siblings.map(function (sibling) { return sibling.name; });
                        newName = (0, WorkingCopyOperations_1.createNewName)(siblingNames, node.name);
                        _h.label = 3;
                    case 3: return [4 /*yield*/, ((_d = (_c = this.coreDB).createNode) === null || _d === void 0 ? void 0 : _d.call(_c, __assign(__assign({}, node), { id: newNodeId, parentId: newParentId, name: newName, createdAt: Date.now(), updatedAt: Date.now(), version: 1 })))];
                    case 4:
                        _h.sent();
                        _h.label = 5;
                    case 5:
                        _g++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, {
                            success: true,
                            seq: this.getNextSeq(),
                            newNodeIds: newNodeIds,
                        }];
                }
            });
        });
    };
    // Undo/Redo Operations
    TreeMutationService.prototype.undo = function (_cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandProcessor.undo()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    TreeMutationService.prototype.redo = function (_cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandProcessor.redo()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    // Helper methods
    TreeMutationService.prototype.isDescendantOf = function (nodeId, ancestorId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var currentId, visited, node;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        currentId = nodeId;
                        visited = new Set();
                        _c.label = 1;
                    case 1:
                        if (!(currentId && currentId !== 'root')) return [3 /*break*/, 3];
                        if (visited.has(currentId)) {
                            return [2 /*return*/, false]; // Circular reference protection
                        }
                        visited.add(currentId);
                        if (currentId === ancestorId) {
                            return [2 /*return*/, true];
                        }
                        return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, currentId))];
                    case 2:
                        node = _c.sent();
                        if (!node)
                            return [3 /*break*/, 3];
                        currentId = node.parentId;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, false];
                }
            });
        });
    };
    TreeMutationService.prototype.duplicateBranch = function (sourceId, targetParentId, idMapping, isRoot) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function () {
            var sourceNode, newNodeId, children, _i, children_1, child;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = this.coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, sourceId))];
                    case 1:
                        sourceNode = _g.sent();
                        if (!sourceNode)
                            return [2 /*return*/];
                        newNodeId = (0, common_core_1.generateNodeId)();
                        idMapping.set(sourceId, newNodeId);
                        // Create duplicated node
                        return [4 /*yield*/, ((_d = (_c = this.coreDB).createNode) === null || _d === void 0 ? void 0 : _d.call(_c, __assign(__assign({}, sourceNode), { id: newNodeId, parentId: targetParentId, name: isRoot ? "".concat(sourceNode.name, " (Copy)") : sourceNode.name, createdAt: Date.now(), updatedAt: Date.now(), version: 1 })))];
                    case 2:
                        // Create duplicated node
                        _g.sent();
                        return [4 /*yield*/, ((_f = (_e = this.coreDB).listChildren) === null || _f === void 0 ? void 0 : _f.call(_e, sourceId))];
                    case 3:
                        children = (_g.sent()) || [];
                        _i = 0, children_1 = children;
                        _g.label = 4;
                    case 4:
                        if (!(_i < children_1.length)) return [3 /*break*/, 7];
                        child = children_1[_i];
                        return [4 /*yield*/, this.duplicateBranch(child.id, newNodeId, idMapping, false)];
                    case 5:
                        _g.sent();
                        _g.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.deleteNodeRecursively = function (nodeId) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var children, _i, children_2, child;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = this.coreDB).listChildren) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                    case 1:
                        children = (_e.sent()) || [];
                        _i = 0, children_2 = children;
                        _e.label = 2;
                    case 2:
                        if (!(_i < children_2.length)) return [3 /*break*/, 5];
                        child = children_2[_i];
                        return [4 /*yield*/, this.deleteNodeRecursively(child.id)];
                    case 3:
                        _e.sent();
                        _e.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: 
                    // Delete the node itself
                    return [4 /*yield*/, ((_d = (_c = this.coreDB).deleteNode) === null || _d === void 0 ? void 0 : _d.call(_c, nodeId))];
                    case 6:
                        // Delete the node itself
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeMutationService.prototype.getNextSeq = function () {
        // In a real implementation, this should be managed by CommandProcessor
        return Date.now();
    };
    return TreeMutationService;
}());
exports.TreeMutationService = TreeMutationService;

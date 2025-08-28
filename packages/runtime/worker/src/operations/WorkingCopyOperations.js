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
exports.createNewName = exports.getChildNames = exports.checkWorkingCopyConflict = exports.updateWorkingCopy = exports.getWorkingCopy = exports.discardWorkingCopy = exports.commitWorkingCopy = exports.createWorkingCopyFromNode = exports.createNewDraftWorkingCopy = void 0;
var common_core_1 = require("@hierarchidb/common-core");
var types_1 = require("../command/types");
/**
 * Create a new draft working copy for creating a new node
 * Working copy is a TreeNode stored in EphemeralDB
 */
function createNewDraftWorkingCopy(ephemeralDB, coreDB, parentId, nodeType, baseName) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var siblingNames, uniqueName, newNodeId, now, workingCopy;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getChildNames(coreDB, parentId)];
                case 1:
                    siblingNames = _d.sent();
                    uniqueName = createNewName(siblingNames, baseName);
                    newNodeId = (0, common_core_1.generateNodeId)();
                    now = Date.now();
                    workingCopy = {
                        // TreeNode properties
                        id: newNodeId,
                        parentId: parentId,
                        nodeType: nodeType,
                        name: uniqueName,
                        depth: 0,
                        createdAt: now,
                        updatedAt: now,
                        version: 1,
                        // WorkingCopyTypes properties
                        copiedAt: now,
                        // Draft property
                        isDraft: true,
                    };
                    return [4 /*yield*/, ((_b = (_a = ephemeralDB).createWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, workingCopy))];
                case 2:
                    // Store in EphemeralDB with the same ID
                    (_d.sent()) ||
                        ((_c = ephemeralDB.workingCopies) === null || _c === void 0 ? void 0 : _c.set(newNodeId, workingCopy));
                    return [2 /*return*/, newNodeId];
            }
        });
    });
}
exports.createNewDraftWorkingCopy = createNewDraftWorkingCopy;
/**
 * Create a working copy from an existing node for editing
 * Working copy uses the same treeNodeId as the original
 */
function createWorkingCopyFromNode(ephemeralDB, coreDB, nodeId) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __awaiter(this, void 0, void 0, function () {
        var node, existingWc, now, workingCopy;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0: return [4 /*yield*/, ((_b = (_a = coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                case 1:
                    node = (_j.sent()) || ((_c = coreDB.nodes) === null || _c === void 0 ? void 0 : _c.get(nodeId));
                    if (!node) {
                        throw new Error('Node not found');
                    }
                    return [4 /*yield*/, ((_e = (_d = ephemeralDB).getWorkingCopy) === null || _e === void 0 ? void 0 : _e.call(_d, nodeId))];
                case 2:
                    existingWc = _j.sent();
                    if (existingWc) {
                        throw new Error('Working copy already exists');
                    }
                    now = Date.now();
                    workingCopy = {
                        // TreeNode properties (copied from original)
                        id: nodeId,
                        parentId: node.parentId,
                        nodeType: node.nodeType,
                        name: node.name,
                        description: node.description,
                        createdAt: node.createdAt,
                        updatedAt: now,
                        version: 1,
                        // WorkingCopyTypes properties
                        copiedAt: now,
                        // Store original version for conflict detection
                        originalVersion: node.version,
                    };
                    return [4 /*yield*/, ((_g = (_f = ephemeralDB).createWorkingCopy) === null || _g === void 0 ? void 0 : _g.call(_f, workingCopy))];
                case 3:
                    // Store in EphemeralDB with the SAME ID as original
                    (_j.sent()) ||
                        ((_h = ephemeralDB.workingCopies) === null || _h === void 0 ? void 0 : _h.set(nodeId, workingCopy));
                    return [2 /*return*/, nodeId];
            }
        });
    });
}
exports.createWorkingCopyFromNode = createWorkingCopyFromNode;
/**
 * Commit working copy changes
 * Merges working copy TreeNode back to original or creates new node
 */
function commitWorkingCopy(ephemeralDB, coreDB, workingCopyNodeId, isDraft, onNameConflict) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (onNameConflict === void 0) { onNameConflict = 'error'; }
    return __awaiter(this, void 0, void 0, function () {
        var workingCopy, nodeId, now, siblingNames, finalName, newNode, nodeId, currentNode, originalVersion, siblingNames, updates, error_1;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0: return [4 /*yield*/, getWorkingCopy(ephemeralDB, workingCopyNodeId)];
                case 1:
                    workingCopy = _j.sent();
                    if (!workingCopy) {
                        return [2 /*return*/, {
                                success: false,
                                error: 'Working copy not found',
                                code: types_1.WorkerErrorCode.WORKING_COPY_NOT_FOUND,
                            }];
                    }
                    _j.label = 2;
                case 2:
                    _j.trys.push([2, 13, , 14]);
                    if (!isDraft) return [3 /*break*/, 6];
                    nodeId = workingCopy.id;
                    now = Date.now();
                    return [4 /*yield*/, getChildNames(coreDB, workingCopy.parentId)];
                case 3:
                    siblingNames = _j.sent();
                    finalName = workingCopy.name;
                    if (siblingNames.includes(workingCopy.name)) {
                        if (onNameConflict === 'error') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Name \"".concat(workingCopy.name, "\" already exists"),
                                    code: types_1.WorkerErrorCode.VALIDATION_ERROR,
                                }];
                        }
                        else {
                            finalName = createNewName(siblingNames, workingCopy.name);
                        }
                    }
                    newNode = {
                        id: nodeId,
                        parentId: workingCopy.parentId,
                        nodeType: workingCopy.nodeType,
                        name: finalName,
                        description: workingCopy.description,
                        depth: 0,
                        createdAt: now,
                        updatedAt: now,
                        version: 1,
                    };
                    return [4 /*yield*/, ((_b = (_a = coreDB).createNode) === null || _b === void 0 ? void 0 : _b.call(_a, newNode))];
                case 4:
                    (_j.sent()) || ((_c = coreDB.nodes) === null || _c === void 0 ? void 0 : _c.set(nodeId, newNode));
                    // Delete working copy
                    return [4 /*yield*/, discardWorkingCopy(ephemeralDB, workingCopyNodeId)];
                case 5:
                    // Delete working copy
                    _j.sent();
                    return [2 /*return*/, {
                            success: true,
                            seq: 1,
                            nodeId: nodeId,
                        }];
                case 6:
                    nodeId = workingCopy.id;
                    return [4 /*yield*/, ((_e = (_d = coreDB).getNode) === null || _e === void 0 ? void 0 : _e.call(_d, nodeId))];
                case 7:
                    currentNode = (_j.sent()) || ((_f = coreDB.nodes) === null || _f === void 0 ? void 0 : _f.get(nodeId));
                    if (!currentNode) {
                        return [2 /*return*/, {
                                success: false,
                                error: 'Target node not found',
                                code: types_1.WorkerErrorCode.NODE_NOT_FOUND,
                            }];
                    }
                    originalVersion = workingCopy.originalVersion || 1;
                    if (currentNode.version > originalVersion) {
                        return [2 /*return*/, {
                                success: false,
                                error: 'Node was modified by another user',
                                code: types_1.WorkerErrorCode.COMMIT_CONFLICT,
                            }];
                    }
                    if (!(workingCopy.name !== currentNode.name)) return [3 /*break*/, 9];
                    return [4 /*yield*/, getChildNames(coreDB, workingCopy.parentId)];
                case 8:
                    siblingNames = _j.sent();
                    if (siblingNames.includes(workingCopy.name)) {
                        if (onNameConflict === 'error') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Name \"".concat(workingCopy.name, "\" already exists"),
                                    code: types_1.WorkerErrorCode.VALIDATION_ERROR,
                                }];
                        }
                        else {
                            workingCopy.name = createNewName(siblingNames, workingCopy.name);
                        }
                    }
                    _j.label = 9;
                case 9:
                    updates = {
                        name: workingCopy.name,
                        description: workingCopy.description,
                        updatedAt: Date.now(),
                        version: currentNode.version + 1,
                    };
                    return [4 /*yield*/, ((_h = (_g = coreDB).updateNode) === null || _h === void 0 ? void 0 : _h.call(_g, nodeId, updates))];
                case 10:
                    _j.sent();
                    // Delete working copy
                    return [4 /*yield*/, discardWorkingCopy(ephemeralDB, workingCopyNodeId)];
                case 11:
                    // Delete working copy
                    _j.sent();
                    return [2 /*return*/, {
                            success: true,
                            seq: 1,
                            nodeId: nodeId,
                        }];
                case 12: return [3 /*break*/, 14];
                case 13:
                    error_1 = _j.sent();
                    return [2 /*return*/, {
                            success: false,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                            code: types_1.WorkerErrorCode.UNKNOWN_ERROR,
                        }];
                case 14: return [2 /*return*/];
            }
        });
    });
}
exports.commitWorkingCopy = commitWorkingCopy;
/**
 * Discard a working copy
 * Removes the working copy TreeNode from EphemeralDB
 */
function discardWorkingCopy(ephemeralDB, workingCopyNodeId) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, ((_b = (_a = ephemeralDB).deleteWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, workingCopyNodeId))];
                case 1:
                    (_d.sent()) ||
                        ((_c = ephemeralDB.workingCopies) === null || _c === void 0 ? void 0 : _c.delete(workingCopyNodeId));
                    return [2 /*return*/];
            }
        });
    });
}
exports.discardWorkingCopy = discardWorkingCopy;
/**
 * Get a working copy by TreeNode ID
 */
function getWorkingCopy(ephemeralDB, nodeId) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, ((_b = (_a = ephemeralDB).getWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                case 1: return [2 /*return*/, ((_d.sent()) ||
                        ((_c = ephemeralDB.workingCopies) === null || _c === void 0 ? void 0 : _c.get(nodeId)))];
            }
        });
    });
}
exports.getWorkingCopy = getWorkingCopy;
/**
 * Update working copy properties
 */
function updateWorkingCopy(ephemeralDB, nodeId, updates) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var existing, updated;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getWorkingCopy(ephemeralDB, nodeId)];
                case 1:
                    existing = _d.sent();
                    if (!existing) {
                        throw new Error('Working copy not found');
                    }
                    updated = __assign(__assign(__assign({}, existing), updates), { updatedAt: Date.now() });
                    return [4 /*yield*/, ((_b = (_a = ephemeralDB).updateWorkingCopy) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId, updated))];
                case 2:
                    (_d.sent()) ||
                        ((_c = ephemeralDB.workingCopies) === null || _c === void 0 ? void 0 : _c.set(nodeId, updated));
                    return [2 /*return*/];
            }
        });
    });
}
exports.updateWorkingCopy = updateWorkingCopy;
/**
 * Check if a working copy has conflicts with the current node version
 */
function checkWorkingCopyConflict(ephemeralDB, coreDB, nodeId) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var workingCopy, currentNode, originalVersion;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getWorkingCopy(ephemeralDB, nodeId)];
                case 1:
                    workingCopy = _d.sent();
                    if (!workingCopy) {
                        return [2 /*return*/, false];
                    }
                    // Draft working copies have no conflict
                    if (workingCopy.isDraft) {
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, ((_b = (_a = coreDB).getNode) === null || _b === void 0 ? void 0 : _b.call(_a, nodeId))];
                case 2:
                    currentNode = (_d.sent()) || ((_c = coreDB.nodes) === null || _c === void 0 ? void 0 : _c.get(nodeId));
                    if (!currentNode) {
                        return [2 /*return*/, false];
                    }
                    originalVersion = workingCopy.originalVersion || 1;
                    return [2 /*return*/, currentNode.version > originalVersion];
            }
        });
    });
}
exports.checkWorkingCopyConflict = checkWorkingCopyConflict;
/**
 * Get names of all children of a parent node
 * 🟢 Utility function from eria-cartograph
 */
function getChildNames(coreDB, parentId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var children;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, ((_b = (_a = coreDB).getChildren) === null || _b === void 0 ? void 0 : _b.call(_a, parentId))];
                case 1:
                    children = (_c.sent()) || [];
                    return [2 /*return*/, children.map(function (child) { return child.name; })];
            }
        });
    });
}
exports.getChildNames = getChildNames;
/**
 * Create a unique name by adding (n) suffix if needed
 * 🟢 Based on user requirements and eria-cartograph pattern
 */
function createNewName(siblingNames, baseName) {
    if (!siblingNames.includes(baseName)) {
        return baseName;
    }
    // Extract existing numbers for this base name
    var escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var pattern = new RegExp("^".concat(escapedBase, "\\s*\\((\\d+)\\)$"));
    var existingNumbers = siblingNames
        .map(function (name) {
        var match = pattern.exec(name);
        return match && match[1] ? parseInt(match[1], 10) : 0;
    })
        .filter(function (n) { return n > 0; });
    var nextNumber = existingNumbers.length > 0 ? Math.max.apply(Math, existingNumbers) + 1 : 2;
    return "".concat(baseName, " (").concat(nextNumber, ")");
}
exports.createNewName = createNewName;

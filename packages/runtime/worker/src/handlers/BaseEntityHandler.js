"use strict";
/**
 * @file BaseEntityHandler.ts
 * @description Abstract base class for entity handlers
 * Provides common functionality for all entity handlers
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEntityHandler = void 0;
var workerLogger_1 = require("../utils/workerLogger");
/**
 * Abstract base implementation for entity handlers
 * Provides common database operations and patterns
 */
var BaseEntityHandler = /** @class */ (function () {
    /**
     * Constructor
     * @param db Dexie database instance
     * @param tableName Main entity table name
     * @param workingCopyTableName Working copy table name
     * @param groupEntityTableName Optional sub-entity table name
     */
    function BaseEntityHandler(db, tableName, workingCopyTableName, groupEntityTableName) {
        this.db = db;
        this.tableName = tableName;
        this.workingCopyTableName = workingCopyTableName;
        this.groupEntityTableName = groupEntityTableName;
    }
    // ==================
    // Working copy operations - can be overridden
    // ==================
    /**
     * Create a working copy of an entity
     */
    BaseEntityHandler.prototype.createWorkingCopy = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var entity, workingCopy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getEntity(nodeId)];
                    case 1:
                        entity = _a.sent();
                        if (!entity) {
                            throw new Error("Entity not found: ".concat(nodeId));
                        }
                        workingCopy = __assign(__assign({}, entity), { workingCopyId: this.generateNodeId(), workingCopyOf: nodeId, copiedAt: Date.now(), isDirty: false });
                        return [4 /*yield*/, this.db.table(this.workingCopyTableName).add(workingCopy)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, workingCopy];
                }
            });
        });
    };
    /**
     * Commit a working copy back to the entity
     */
    BaseEntityHandler.prototype.commitWorkingCopy = function (nodeId, workingCopy) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, workingCopyId, workingCopyOf, copiedAt, isDirty, entityData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = workingCopy, workingCopyId = _a.workingCopyId, workingCopyOf = _a.workingCopyOf, copiedAt = _a.copiedAt, isDirty = _a.isDirty, entityData = __rest(_a, ["workingCopyId", "workingCopyOf", "copiedAt", "isDirty"]);
                        // Update the entity
                        return [4 /*yield*/, this.updateEntity(nodeId, entityData)];
                    case 1:
                        // Update the entity
                        _b.sent();
                        // Delete the working copy
                        return [4 /*yield*/, this.db.table(this.workingCopyTableName).delete(workingCopyId)];
                    case 2:
                        // Delete the working copy
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Discard a working copy
     */
    BaseEntityHandler.prototype.discardWorkingCopy = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var workingCopy, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.db
                                .table(this.workingCopyTableName)
                                .where('workingCopyOf')
                                .equals(nodeId)
                                .first()];
                    case 1:
                        workingCopy = _a.sent();
                        if (!workingCopy) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.db.table(this.workingCopyTableName).delete(workingCopy.workingCopyId)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        // Ignore if table doesn't exist
                        this.log('Warning: working copy table not found', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // ==================
    // Sub-entity operations - optional
    // ==================
    /**
     * Create a sub-entity
     */
    BaseEntityHandler.prototype.createGroupEntity = function (nodeId, groupEntityType, data) {
        return __awaiter(this, void 0, void 0, function () {
            var groupEntity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.groupEntityTableName) {
                            throw new Error('Sub-entity table not configured');
                        }
                        groupEntity = __assign(__assign({}, data), { id: this.generateNodeId(), parentId: nodeId, groupEntityType: groupEntityType, createdAt: Date.now(), updatedAt: Date.now() });
                        return [4 /*yield*/, this.db.table(this.groupEntityTableName).add(groupEntity)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get sub-entities for a node
     */
    BaseEntityHandler.prototype.getGroupEntities = function (nodeId, groupEntityType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.groupEntityTableName) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.db
                                .table(this.groupEntityTableName)
                                .where(['parentId', 'groupEntityType'])
                                .equals([nodeId, groupEntityType])
                                .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Delete sub-entities for a node
     */
    BaseEntityHandler.prototype.deleteGroupEntities = function (nodeId, groupEntityType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.groupEntityTableName) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.db
                                .table(this.groupEntityTableName)
                                .where(['parentId', 'groupEntityType'])
                                .equals([nodeId, groupEntityType])
                                .delete()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==================
    // Special operations - optional
    // ==================
    /**
     * Duplicate an entity
     */
    BaseEntityHandler.prototype.duplicate = function (nodeId, newNodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var entity, newEntity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getEntity(nodeId)];
                    case 1:
                        entity = _a.sent();
                        if (!entity) {
                            throw new Error("Entity not found: ".concat(nodeId));
                        }
                        newEntity = __assign(__assign({}, entity), { nodeId: newNodeId, createdAt: Date.now(), updatedAt: Date.now(), version: 1 });
                        return [4 /*yield*/, this.createEntity(newNodeId, newEntity)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a backup of an entity
     */
    BaseEntityHandler.prototype.backup = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var entity, groupEntities, allGroupEntities, _i, allGroupEntities_1, groupEntity, type;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getEntity(nodeId)];
                    case 1:
                        entity = _a.sent();
                        if (!entity) {
                            throw new Error("Entity not found: ".concat(nodeId));
                        }
                        groupEntities = {};
                        if (!this.groupEntityTableName) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.db
                                .table(this.groupEntityTableName)
                                .where('parentId')
                                .equals(nodeId)
                                .toArray()];
                    case 2:
                        allGroupEntities = _a.sent();
                        // Group by type
                        for (_i = 0, allGroupEntities_1 = allGroupEntities; _i < allGroupEntities_1.length; _i++) {
                            groupEntity = allGroupEntities_1[_i];
                            type = groupEntity.groupEntityType || 'default';
                            if (!groupEntities[type]) {
                                groupEntities[type] = [];
                            }
                            groupEntities[type].push(groupEntity);
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/, {
                            entity: entity,
                            subEntities: Object.keys(groupEntities).length > 0 ? groupEntities : undefined,
                            metadata: {
                                backupDate: Date.now(),
                                version: '1.0.0',
                                nodeType: entity.nodeType || 'unknown',
                            },
                        }];
                }
            });
        });
    };
    /**
     * Restore an entity from backup
     */
    BaseEntityHandler.prototype.restore = function (nodeId, backup) {
        return __awaiter(this, void 0, void 0, function () {
            var entity, subEntities, existing, _i, _a, _b, type, entities, _c, entities_1, groupEntity;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        entity = backup.entity, subEntities = backup.subEntities;
                        return [4 /*yield*/, this.getEntity(nodeId)];
                    case 1:
                        existing = _d.sent();
                        if (!existing) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.updateEntity(nodeId, entity)];
                    case 2:
                        _d.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.createEntity(nodeId, entity)];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        if (!(subEntities && this.groupEntityTableName)) return [3 /*break*/, 12];
                        // Delete existing sub-entities
                        return [4 /*yield*/, this.db.table(this.groupEntityTableName).where('parentId').equals(nodeId).delete()];
                    case 6:
                        // Delete existing sub-entities
                        _d.sent();
                        _i = 0, _a = Object.entries(subEntities);
                        _d.label = 7;
                    case 7:
                        if (!(_i < _a.length)) return [3 /*break*/, 12];
                        _b = _a[_i], type = _b[0], entities = _b[1];
                        if (!Array.isArray(entities)) return [3 /*break*/, 11];
                        _c = 0, entities_1 = entities;
                        _d.label = 8;
                    case 8:
                        if (!(_c < entities_1.length)) return [3 /*break*/, 11];
                        groupEntity = entities_1[_c];
                        return [4 /*yield*/, this.db.table(this.groupEntityTableName).add(__assign(__assign({}, groupEntity), { parentId: nodeId, groupEntityType: type }))];
                    case 9:
                        _d.sent();
                        _d.label = 10;
                    case 10:
                        _c++;
                        return [3 /*break*/, 8];
                    case 11:
                        _i++;
                        return [3 /*break*/, 7];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cleanup resources for an entity
     */
    BaseEntityHandler.prototype.cleanup = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Discard working copies
                        return [4 /*yield*/, this.discardWorkingCopy(nodeId)];
                    case 1:
                        // Discard working copies
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        // Ignore errors if table doesn't exist
                        this.log('Cleanup warning: working copy table issue', error_2);
                        return [3 /*break*/, 3];
                    case 3:
                        if (!this.groupEntityTableName) return [3 /*break*/, 7];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.db.table(this.groupEntityTableName).where('parentId').equals(nodeId).delete()];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        // Ignore errors if table doesn't exist
                        this.log('Cleanup warning: sub-entity table issue', error_3);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ==================
    // Helper methods
    // ==================
    /**
     * Generate a string v4
     */
    BaseEntityHandler.prototype.generateNodeId = function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };
    /**
     * Get current timestamp
     */
    BaseEntityHandler.prototype.now = function () {
        return Date.now();
    };
    /**
     * Validate entity data
     */
    BaseEntityHandler.prototype.validateEntity = function (data) {
        // Override in subclasses for specific validation
    };
    /**
     * Log in development mode
     */
    BaseEntityHandler.prototype.log = function (message, data) {
        if (process.env.NODE_ENV === 'development') {
            (0, workerLogger_1.workerLog)("[".concat(this.constructor.name, "] ").concat(message), data || '');
        }
    };
    return BaseEntityHandler;
}());
exports.BaseEntityHandler = BaseEntityHandler;

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
exports.EphemeralDB = void 0;
var common_core_1 = require("@hierarchidb/common-core");
var dexie_1 = require("dexie");
var EphemeralDB = /** @class */ (function (_super) {
    __extends(EphemeralDB, _super);
    function EphemeralDB(name) {
        if (name === void 0) { name = 'hierarchidb'; }
        var _this = _super.call(this, "".concat(name, "-EphemeralDB")) || this;
        _this.version(1).stores({
            workingCopies: '&workingCopyId, workingCopyOf, parentId, updatedAt',
            views: '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]',
        });
        return _this;
    }
    EphemeralDB.getSingleton = function (name) {
        if (name === void 0) { name = 'hierarchidb'; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, common_core_1.SingletonMixin.getSingleton(EphemeralDB.name, function () { return __awaiter(_this, void 0, void 0, function () {
                        var instance;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    instance = new EphemeralDB(name);
                                    return [4 /*yield*/, instance.initialize()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, instance];
                            }
                        });
                    }); })];
            });
        });
    };
    EphemeralDB.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.count()];
                    case 1:
                        if (!((_a.sent()) !== 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.workingCopies.clear()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // WorkingCopyTypes CRUD operations
    EphemeralDB.prototype.getWorkingCopy = function (workingCopyId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.get(workingCopyId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    EphemeralDB.prototype.updateWorkingCopy = function (workingCopy) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.put(workingCopy)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EphemeralDB.prototype.discardWorkingCopy = function (workingCopyId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.delete(workingCopyId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EphemeralDB.prototype.createWorkingCopy = function (workingCopy) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.add(workingCopy)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EphemeralDB.prototype.deleteWorkingCopy = function (workingCopyId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.delete(workingCopyId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EphemeralDB.prototype.listWorkingCopies = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workingCopies.toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return EphemeralDB;
}(dexie_1.default));
exports.EphemeralDB = EphemeralDB;

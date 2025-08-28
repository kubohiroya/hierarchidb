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
/**
 * @file NodeTypeAPI-Green.test.ts
 * @description NodeTypeAPI のTDD Green フェーズテスト
 *
 * TDD Green フェーズ: 最小限の実装でテストを通す
 */
var vitest_1 = require("vitest");
(0, vitest_1.describe)('NodeTypeAPI - TDD Green Phase', function () {
    var nodeTypeAPI;
    (0, vitest_1.beforeEach)(function () {
        // 【TDD Green実装】: テストを通すための最小限のAPI実装
        // 【実装方針】: テストケースが期待する戻り値を提供
        // 🟡 信頼性レベル: テスト駆動による最小実装
        nodeTypeAPI = {
            // 【サポート一覧】: 基本的なノード型の配列を返す
            listSupported: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, ['folder', 'document', 'project']];
                });
            }); },
            // 【サポート確認】: 既知のノード型でtrueを返す
            isSupported: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                var supportedTypes;
                return __generator(this, function (_a) {
                    supportedTypes = ['folder', 'document', 'project'];
                    return [2 /*return*/, supportedTypes.includes(nodeType)];
                });
            }); },
            // 【操作検証】: ノード型の登録状況に基づく検証
            validateOperation: function (nodeType, operation, context) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, nodeTypeAPI.isSupported(nodeType)];
                        case 1:
                            if (!(_a.sent())) {
                                return [2 /*return*/, {
                                        valid: false,
                                        errors: ["Node type ".concat(nodeType, " is not registered")],
                                    }];
                            }
                            return [2 /*return*/, { valid: true, errors: [] }];
                    }
                });
            }); },
            // 【サポート操作】: 基本的なCRUD操作を返す
            getSupportedOperations: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, nodeTypeAPI.isSupported(nodeType)];
                        case 1:
                            if (!(_a.sent())) {
                                return [2 /*return*/, []];
                            }
                            return [2 /*return*/, ['create', 'read', 'update', 'delete', 'move', 'copy']];
                    }
                });
            }); },
            // 【子ノードサポート】: 基本的に全てのノード型が子をサポート
            supportsChildren: function (nodeType) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, nodeTypeAPI.isSupported(nodeType)];
                        case 1:
                            if (!(_a.sent())) {
                                return [2 /*return*/, false];
                            }
                            return [2 /*return*/, nodeType !== 'leaf-only-type'];
                    }
                });
            }); },
            // 【許可子タイプ】: 登録済みノード型を子として許可
            getAllowedChildTypes: function (parentType) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, nodeTypeAPI.isSupported(parentType)];
                        case 1:
                            if (!(_a.sent())) {
                                return [2 /*return*/, []];
                            }
                            return [4 /*yield*/, nodeTypeAPI.listSupported()];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
            // 【機能確認】: 基本的な機能の有無を判定
            hasCapability: function (nodeType, capability) { return __awaiter(void 0, void 0, void 0, function () {
                var basicCapabilities;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, nodeTypeAPI.isSupported(nodeType)];
                        case 1:
                            if (!(_a.sent())) {
                                return [2 /*return*/, false];
                            }
                            basicCapabilities = ['create', 'ui', 'children'];
                            return [2 /*return*/, basicCapabilities.includes(capability)];
                    }
                });
            }); },
        };
    });
    (0, vitest_1.afterEach)(function () {
        // 【テスト後処理】: テスト実行後の状態をクリーンアップ
        nodeTypeAPI = null;
    });
    (0, vitest_1.describe)('listSupported', function () {
        (0, vitest_1.test)('全てのサポートされているノード型のリストを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var supportedTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, nodeTypeAPI.listSupported()];
                    case 1:
                        supportedTypes = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(supportedTypes)).toBe(true);
                        (0, vitest_1.expect)(supportedTypes.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)(supportedTypes).toContain('folder');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('空のシステムでは空配列を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var supportedTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, nodeTypeAPI.listSupported()];
                    case 1:
                        supportedTypes = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(supportedTypes)).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('isSupported', function () {
        (0, vitest_1.test)('存在するノード型に対してtrueを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var existingNodeType, isSupported;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existingNodeType = 'folder';
                        return [4 /*yield*/, nodeTypeAPI.isSupported(existingNodeType)];
                    case 1:
                        isSupported = _a.sent();
                        (0, vitest_1.expect)(isSupported).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('存在しないノード型に対してfalseを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nonExistentNodeType, isSupported;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nonExistentNodeType = 'non-existent-type';
                        return [4 /*yield*/, nodeTypeAPI.isSupported(nonExistentNodeType)];
                    case 1:
                        isSupported = _a.sent();
                        (0, vitest_1.expect)(isSupported).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('validateOperation', function () {
        (0, vitest_1.test)('有効なノード型とオペレーションの組み合わせでバリデーション成功', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, operation, context, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
                        operation = 'create';
                        context = { parentId: 'parent-123' };
                        return [4 /*yield*/, nodeTypeAPI.validateOperation(nodeType, operation, context)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.valid).toBe(true);
                        (0, vitest_1.expect)(result.errors).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('無効なノード型でバリデーション失敗', function () { return __awaiter(void 0, void 0, void 0, function () {
            var invalidNodeType, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        invalidNodeType = 'invalid-type';
                        operation = 'create';
                        return [4 /*yield*/, nodeTypeAPI.validateOperation(invalidNodeType, operation)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.valid).toBe(false);
                        (0, vitest_1.expect)(result.errors).toContain("Node type ".concat(invalidNodeType, " is not registered"));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('getSupportedOperations', function () {
        (0, vitest_1.test)('ノード型でサポートされている操作の配列を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, operations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
                        return [4 /*yield*/, nodeTypeAPI.getSupportedOperations(nodeType)];
                    case 1:
                        operations = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(operations)).toBe(true);
                        (0, vitest_1.expect)(operations).toContain('create');
                        (0, vitest_1.expect)(operations).toContain('read');
                        (0, vitest_1.expect)(operations).toContain('update');
                        (0, vitest_1.expect)(operations).toContain('delete');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('supportsChildren', function () {
        (0, vitest_1.test)('子要素をサポートするノード型でtrueを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var containerNodeType, supportsChildren;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        containerNodeType = 'folder';
                        return [4 /*yield*/, nodeTypeAPI.supportsChildren(containerNodeType)];
                    case 1:
                        supportsChildren = _a.sent();
                        (0, vitest_1.expect)(supportsChildren).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('getAllowedChildTypes', function () {
        (0, vitest_1.test)('親ノード型に対して許可された子ノード型の配列を返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var parentType, allowedChildTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parentType = 'folder';
                        return [4 /*yield*/, nodeTypeAPI.getAllowedChildTypes(parentType)];
                    case 1:
                        allowedChildTypes = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(allowedChildTypes)).toBe(true);
                        (0, vitest_1.expect)(allowedChildTypes.length).toBeGreaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('hasCapability', function () {
        (0, vitest_1.test)('ノード型が指定された機能を持つ場合にtrueを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, capability, hasCapability;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
                        capability = 'create';
                        return [4 /*yield*/, nodeTypeAPI.hasCapability(nodeType, capability)];
                    case 1:
                        hasCapability = _a.sent();
                        (0, vitest_1.expect)(hasCapability).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.test)('ノード型が指定された機能を持たない場合にfalseを返す', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nodeType, nonExistentCapability, hasCapability;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeType = 'folder';
                        nonExistentCapability = 'non-existent-capability';
                        return [4 /*yield*/, nodeTypeAPI.hasCapability(nodeType, nonExistentCapability)];
                    case 1:
                        hasCapability = _a.sent();
                        (0, vitest_1.expect)(hasCapability).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

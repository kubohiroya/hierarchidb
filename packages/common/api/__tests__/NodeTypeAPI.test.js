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
 * @file NodeTypeAPI.test.ts
 * @description NodeTypeAPI のテストケース集
 *
 * TDD Redフェーズ: 新しいNodeTypeAPI仕様に基づく失敗するテストを作成
 */
var vitest_1 = require("vitest");
(0, vitest_1.describe)('NodeTypeAPI', function () {
    var nodeTypeAPI;
    (0, vitest_1.beforeEach)(function () {
        // 【テスト前準備】: 各テスト実行前にNodeTypeAPI実装のモックを初期化
        // 【環境初期化】: テスト間の状態を独立させ、一貫したテスト結果を保証
        nodeTypeAPI = {}; // モック実装（実装時に適切なインスタンス化が必要）
    });
    (0, vitest_1.afterEach)(function () {
        // 【テスト後処理】: テスト実行後の状態をクリーンアップ
        // 【状態復元】: 次のテストに影響しないよう、リソースを解放
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
                        // 【結果検証】: 返されるデータの型と内容を確認
                        // 【期待値確認】: 配列形式で複数のノード型が含まれることを確認
                        (0, vitest_1.expect)(Array.isArray(supportedTypes)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
                        (0, vitest_1.expect)(supportedTypes.length).toBeGreaterThan(0); // 【確認内容】: 少なくとも1つのノード型が登録されていることを確認 🟢
                        (0, vitest_1.expect)(supportedTypes).toContain('folder'); // 【確認内容】: デフォルトのfolderノード型が含まれることを確認 🟢
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
                        // 【結果検証】: 空配列が返されることを確認
                        // 【期待値確認】: プラグインが無い場合は空配列を返すべき
                        (0, vitest_1.expect)(supportedTypes).toEqual([]); // 【確認内容】: 空配列が返されることを確認 🟡
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
                        // 【結果検証】: trueが返されることを確認
                        // 【期待値確認】: 登録されているノード型は存在すると判定されるべき
                        (0, vitest_1.expect)(isSupported).toBe(true); // 【確認内容】: 存在するノード型に対してtrueが返されることを確認 🟢
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
                        // 【結果検証】: falseが返されることを確認
                        // 【期待値確認】: 未登録のノード型は存在しないと判定されるべき
                        (0, vitest_1.expect)(isSupported).toBe(false); // 【確認内容】: 存在しないノード型に対してfalseが返されることを確認 🟢
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
                        // 【結果検証】: バリデーション成功の結果を確認
                        // 【期待値確認】: 有効な組み合わせではvalidがtrueでerrorsが空配列になるべき
                        (0, vitest_1.expect)(result.valid).toBe(true); // 【確認内容】: バリデーション結果が成功であることを確認 🟢
                        (0, vitest_1.expect)(result.errors).toEqual([]); // 【確認内容】: エラーが発生していないことを確認 🟢
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
                        // 【結果検証】: バリデーション失敗の結果を確認
                        // 【期待値確認】: 無効なノード型ではvalidがfalseでエラーメッセージが含まれるべき
                        (0, vitest_1.expect)(result.valid).toBe(false); // 【確認内容】: バリデーション結果が失敗であることを確認 🟢
                        (0, vitest_1.expect)(result.errors).toContain("Node type ".concat(invalidNodeType, " is not registered")); // 【確認内容】: 適切なエラーメッセージが含まれることを確認 🟢
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
                        // 【結果検証】: 操作配列の内容と型を確認
                        // 【期待値確認】: 基本的なCRUD操作とmove操作がサポートされているべき
                        (0, vitest_1.expect)(Array.isArray(operations)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
                        (0, vitest_1.expect)(operations).toContain('create'); // 【確認内容】: create操作がサポートされることを確認 🟢
                        (0, vitest_1.expect)(operations).toContain('read'); // 【確認内容】: read操作がサポートされることを確認 🟢
                        (0, vitest_1.expect)(operations).toContain('update'); // 【確認内容】: update操作がサポートされることを確認 🟢
                        (0, vitest_1.expect)(operations).toContain('delete'); // 【確認内容】: delete操作がサポートされることを確認 🟢
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
                        // 【結果検証】: 子要素サポート状況を確認
                        // 【期待値確認】: folderのようなコンテナ型は子要素をサポートするべき
                        (0, vitest_1.expect)(supportsChildren).toBe(true); // 【確認内容】: 子要素をサポートするノード型でtrueが返されることを確認 🟢
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
                        // 【結果検証】: 許可された子ノード型の配列内容を確認
                        // 【期待値確認】: 少なくとも基本的なノード型が子として許可されるべき
                        (0, vitest_1.expect)(Array.isArray(allowedChildTypes)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
                        (0, vitest_1.expect)(allowedChildTypes.length).toBeGreaterThan(0); // 【確認内容】: 少なくとも1つの子ノード型が許可されることを確認 🟡
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
                        // 【結果検証】: 機能の有無を確認
                        // 【期待値確認】: folderノード型は基本的なcreate機能を持つべき
                        (0, vitest_1.expect)(hasCapability).toBe(true); // 【確認内容】: 指定された機能を持つノード型でtrueが返されることを確認 🟡
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
                        // 【結果検証】: 機能の不在を確認
                        // 【期待値確認】: 存在しない機能に対してはfalseが返されるべき
                        (0, vitest_1.expect)(hasCapability).toBe(false); // 【確認内容】: 存在しない機能に対してfalseが返されることを確認 🟡
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

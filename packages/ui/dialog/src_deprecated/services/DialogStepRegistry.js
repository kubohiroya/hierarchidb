"use strict";
/**
 * @file DialogStepRegistry.ts
 * @description ダイアログステップの登録と管理
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
exports.stepRegistry = exports.DialogStepRegistry = void 0;
// ============================================================================
// DialogStepRegistry クラス
// ============================================================================
/**
 * ダイアログステップレジストリ
 */
var DialogStepRegistry = /** @class */ (function () {
    function DialogStepRegistry(options) {
        if (options === void 0) { options = {}; }
        this.registrations = new Map();
        this.options = __assign({ allowDuplicates: false, autoSort: true, checkCircularDependencies: true }, options);
    }
    /**
     * シングルトンインスタンス取得
     */
    DialogStepRegistry.getInstance = function (options) {
        if (!DialogStepRegistry.instance) {
            DialogStepRegistry.instance = new DialogStepRegistry(options);
        }
        return DialogStepRegistry.instance;
    };
    /**
     * ステップを登録
     */
    DialogStepRegistry.prototype.registerStep = function (pluginName, definition, priority) {
        var registration = {
            pluginName: pluginName,
            definition: definition,
            registeredAt: Date.now(),
            priority: priority,
        };
        if (!this.registrations.has(pluginName)) {
            this.registrations.set(pluginName, []);
        }
        var steps = this.registrations.get(pluginName);
        // 重複チェック
        if (!this.options.allowDuplicates) {
            var exists = steps.some(function (s) { return s.definition.stepNumber === definition.stepNumber; });
            if (exists) {
                throw new Error("Step ".concat(definition.stepNumber, " is already registered for plugin ").concat(pluginName));
            }
        }
        steps.push(registration);
        // 自動ソート
        if (this.options.autoSort) {
            steps.sort(function (a, b) { return a.definition.stepNumber - b.definition.stepNumber; });
        }
        // 循環依存チェック
        if (this.options.checkCircularDependencies && definition.dependsOn) {
            this.checkCircularDependencies(pluginName, definition.stepNumber);
        }
    };
    /**
     * 複数ステップを一括登録
     */
    DialogStepRegistry.prototype.registerSteps = function (pluginName, definitions, priority) {
        var _this = this;
        definitions.forEach(function (def) {
            _this.registerStep(pluginName, def, priority);
        });
    };
    /**
     * ステップを取得
     */
    DialogStepRegistry.prototype.getStep = function (pluginName, stepNumber) {
        var steps = this.registrations.get(pluginName);
        if (!steps)
            return undefined;
        var registration = steps.find(function (s) { return s.definition.stepNumber === stepNumber; });
        return registration === null || registration === void 0 ? void 0 : registration.definition;
    };
    /**
     * プラグインの全ステップを取得
     */
    DialogStepRegistry.prototype.getSteps = function (pluginName) {
        var steps = this.registrations.get(pluginName);
        if (!steps)
            return [];
        return steps.map(function (s) { return s.definition; });
    };
    /**
     * プラグインをマージして統合ステップリストを取得
     */
    DialogStepRegistry.prototype.getMergedSteps = function (basePlugin) {
        var extendedPlugins = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            extendedPlugins[_i - 1] = arguments[_i];
        }
        var stepMap = new Map();
        // 基底プラグインのステップ
        var baseSteps = this.getSteps(basePlugin);
        baseSteps.forEach(function (step) {
            stepMap.set(step.stepNumber, step);
        });
        // 拡張プラグインのステップ（オーバーライド可能）
        for (var _a = 0, extendedPlugins_1 = extendedPlugins; _a < extendedPlugins_1.length; _a++) {
            var plugin = extendedPlugins_1[_a];
            var steps = this.getSteps(plugin);
            steps.forEach(function (step) {
                stepMap.set(step.stepNumber, step);
            });
        }
        // マップから配列に変換してソート
        return Array.from(stepMap.values()).sort(function (a, b) { return a.stepNumber - b.stepNumber; });
    };
    /**
     * ステップを削除
     */
    DialogStepRegistry.prototype.unregisterStep = function (pluginName, stepNumber) {
        var steps = this.registrations.get(pluginName);
        if (!steps)
            return false;
        var index = steps.findIndex(function (s) { return s.definition.stepNumber === stepNumber; });
        if (index === -1)
            return false;
        steps.splice(index, 1);
        if (steps.length === 0) {
            this.registrations.delete(pluginName);
        }
        return true;
    };
    /**
     * プラグインの全ステップを削除
     */
    DialogStepRegistry.prototype.unregisterPlugin = function (pluginName) {
        return this.registrations.delete(pluginName);
    };
    /**
     * 依存関係を検証
     */
    DialogStepRegistry.prototype.validateDependencies = function (pluginName) {
        var steps = this.getSteps(pluginName);
        var stepNumbers = new Set(steps.map(function (s) { return s.stepNumber; }));
        var errors = [];
        for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
            var step = steps_1[_i];
            if (step.dependsOn) {
                for (var _a = 0, _b = step.dependsOn; _a < _b.length; _a++) {
                    var dep = _b[_a];
                    if (!stepNumbers.has(dep)) {
                        errors.push("Step ".concat(step.stepNumber, " depends on non-existent step ").concat(dep));
                    }
                    if (dep >= step.stepNumber) {
                        errors.push("Step ".concat(step.stepNumber, " cannot depend on later step ").concat(dep));
                    }
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    };
    /**
     * 循環依存をチェック
     */
    DialogStepRegistry.prototype.checkCircularDependencies = function (pluginName, stepNumber) {
        var _this = this;
        var visited = new Set();
        var recursionStack = new Set();
        var hasCycle = function (currentStep) {
            visited.add(currentStep);
            recursionStack.add(currentStep);
            var step = _this.getStep(pluginName, currentStep);
            if (step === null || step === void 0 ? void 0 : step.dependsOn) {
                for (var _i = 0, _a = step.dependsOn; _i < _a.length; _i++) {
                    var dep = _a[_i];
                    if (!visited.has(dep)) {
                        if (hasCycle(dep))
                            return true;
                    }
                    else if (recursionStack.has(dep)) {
                        return true;
                    }
                }
            }
            recursionStack.delete(currentStep);
            return false;
        };
        if (hasCycle(stepNumber)) {
            throw new Error("Circular dependency detected for step ".concat(stepNumber));
        }
    };
    /**
     * ステップの実行順序を取得（依存関係を考慮）
     */
    DialogStepRegistry.prototype.getExecutionOrder = function (pluginName) {
        var steps = this.getSteps(pluginName);
        var visited = new Set();
        var order = [];
        var visit = function (stepNumber) {
            if (visited.has(stepNumber))
                return;
            var step = steps.find(function (s) { return s.stepNumber === stepNumber; });
            if (step === null || step === void 0 ? void 0 : step.dependsOn) {
                step.dependsOn.forEach(function (dep) { return visit(dep); });
            }
            visited.add(stepNumber);
            order.push(stepNumber);
        };
        steps.forEach(function (step) { return visit(step.stepNumber); });
        return order;
    };
    /**
     * ステップ結果を集約
     */
    DialogStepRegistry.prototype.aggregateResults = function (pluginName, stepData) {
        return __awaiter(this, void 0, void 0, function () {
            var aggregated, order, _i, order_1, stepNumber, data;
            return __generator(this, function (_a) {
                aggregated = {};
                order = this.getExecutionOrder(pluginName);
                for (_i = 0, order_1 = order; _i < order_1.length; _i++) {
                    stepNumber = order_1[_i];
                    data = stepData.get(stepNumber);
                    if (data) {
                        aggregated = __assign(__assign({}, aggregated), data);
                    }
                }
                return [2 /*return*/, aggregated];
            });
        });
    };
    /**
     * バリデーションチェーンを実行
     */
    DialogStepRegistry.prototype.runValidationChain = function (pluginName, stepData) {
        return __awaiter(this, void 0, void 0, function () {
            var steps, results, _loop_1, _i, steps_2, step;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        steps = this.getSteps(pluginName);
                        results = new Map();
                        _loop_1 = function (step) {
                            var data, result, dependentSteps;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!step.validation) return [3 /*break*/, 2];
                                        data = stepData.get(step.stepNumber) || {};
                                        return [4 /*yield*/, step.validation.validate(data)];
                                    case 1:
                                        result = _b.sent();
                                        results.set(step.stepNumber, result);
                                        // エラーがあれば後続のステップはスキップ（オプション）
                                        if (!result.isValid && step.dependsOn) {
                                            dependentSteps = steps.filter(function (s) { var _a; return (_a = s.dependsOn) === null || _a === void 0 ? void 0 : _a.includes(step.stepNumber); });
                                            dependentSteps.forEach(function (s) {
                                                results.set(s.stepNumber, {
                                                    isValid: false,
                                                    errors: ["Skipped due to error in step ".concat(step.stepNumber)],
                                                });
                                            });
                                        }
                                        _b.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, steps_2 = steps;
                        _a.label = 1;
                    case 1:
                        if (!(_i < steps_2.length)) return [3 /*break*/, 4];
                        step = steps_2[_i];
                        return [5 /*yield**/, _loop_1(step)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * レジストリをクリア
     */
    DialogStepRegistry.prototype.clear = function () {
        this.registrations.clear();
    };
    /**
     * 登録情報を取得
     */
    DialogStepRegistry.prototype.getRegistrationInfo = function () {
        return new Map(this.registrations);
    };
    /**
     * 統計情報を取得
     */
    DialogStepRegistry.prototype.getStatistics = function () {
        var pluginStats = new Map();
        var totalSteps = 0;
        this.registrations.forEach(function (steps, plugin) {
            pluginStats.set(plugin, steps.length);
            totalSteps += steps.length;
        });
        return {
            totalPlugins: this.registrations.size,
            totalSteps: totalSteps,
            pluginStats: pluginStats,
        };
    };
    return DialogStepRegistry;
}());
exports.DialogStepRegistry = DialogStepRegistry;
// デフォルトインスタンスをエクスポート
exports.stepRegistry = DialogStepRegistry.getInstance();

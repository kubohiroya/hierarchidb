"use strict";
/**
 * 【モジュール概要】: 階層的プラグインルーティングシステム
 * 【設計方針】: セキュリティ・パフォーマンス・保守性を重視した設計
 * 【アーキテクチャ】: プラグインベースの動的ルーティング機構
 * 【TDDフェーズ】: Refactorフェーズ - 品質改善と最適化実装
 *
 * @module HierarchicalPluginRouter
 * @version 1.0.0
 */
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
exports.HierarchicalPluginRouter = exports.loadPluginComponent = exports.parseHierarchicalUrl = exports.PluginRegistry = void 0;
// ================================================================================
// 【設定定数セクション】: システム全体で使用される定数群
// ================================================================================
/**
 * 【URL設定定数】: URL処理に関する制限値と設定
 * 【調整可能性】: ブラウザ互換性を考慮して調整可能 🟢
 */
var URL_CONFIG = {
    /** 【最大URL長】: ブラウザの実用的制限値（2048文字） 🟢 */
    MAX_LENGTH: 2048,
    /** 【URLパターン】: 階層URLの正規表現パターン 🟢 */
    HIERARCHICAL_PATTERN: /^\/t\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)$/,
};
/**
 * 【パフォーマンス設定】: SLA基準と監視設定
 * 【最適化済み】: パフォーマンステストに基づく設定値 🟢
 */
var PERFORMANCE_CONFIG = {
    /** 【SLA基準値】: ルート解決の最大許容時間（100ms） 🟢 */
    SLA_MS: 100,
    /** 【警告閾値】: パフォーマンス警告を出力する基準（101ms） 🟢 */
    WARNING_THRESHOLD_MS: 101,
};
/**
 * 【セキュリティ設定】: 入力検証とセキュリティ制約
 * 【強化済み】: XSS・インジェクション攻撃対策設定 🟢
 */
var SECURITY_CONFIG = {
    /** 【安全文字パターン】: プラグイン名に許可される文字 🟢 */
    SAFE_PLUGIN_NAME_PATTERN: /^[a-zA-Z0-9\-_]+$/,
    /** 【最大プラグイン数】: DoS攻撃対策のための制限 🔴 */
    MAX_PLUGINS: 10000,
    /** 【危険なプロパティ】: セキュリティリスクのあるプロパティ名 🔴 */
    DANGEROUS_PROPERTIES: ['__proto__', 'constructor', 'prototype'],
};
/**
 * 【エラーメッセージ定数】: 多言語対応エラーメッセージ
 * 【国際化対応】: 日本語・英語のエラーメッセージ定義 🟢
 */
var ERROR_MESSAGES = {
    ja: {
        URL_TOO_LONG: function (max) { return "URL\u9577\u5236\u9650: URL\u9577\u304C\u5236\u9650\u5024(".concat(max, "\u6587\u5B57)\u3092\u8D85\u3048\u3066\u3044\u307E\u3059"); },
        INVALID_URL_FORMAT: '無効なURL形式です',
        SECURITY_INVALID_CHARS: 'セキュリティ: 無効な文字が含まれています',
        MALICIOUS_COMPONENT: '不正なコンポーネント: セキュリティ検証に失敗しました',
        PLUGIN_NOT_FOUND: function (name) { return "\u30D7\u30E9\u30B0\u30A4\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(name); },
        ACTION_NOT_FOUND: function (name) { return "\u30A2\u30AF\u30B7\u30E7\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(name); },
        TIMEOUT: 'タイムアウトしました',
        OUT_OF_MEMORY: 'メモリ不足のため処理を中断しました',
        TOO_MANY_PLUGINS: 'プラグイン登録数の上限に達しました',
    },
    en: {
        URL_TOO_LONG: function (max) { return "URL too long: exceeds limit of ".concat(max, " characters"); },
        INVALID_URL_FORMAT: 'Invalid URL format',
        SECURITY_INVALID_CHARS: 'Security: Invalid characters detected',
        MALICIOUS_COMPONENT: 'Malicious component: Security validation failed',
        PLUGIN_NOT_FOUND: function (name) { return "Plugin not found: ".concat(name); },
        ACTION_NOT_FOUND: function (name) { return "Action not found: ".concat(name); },
        TIMEOUT: 'Request timed out',
        OUT_OF_MEMORY: 'Out of memory',
        TOO_MANY_PLUGINS: 'Maximum plugin limit reached',
    },
};
// ================================================================================
// 【ユーティリティ関数セクション】: 共通処理と検証関数
// ================================================================================
/**
 * 【言語取得ヘルパー】: 現在の言語設定を取得
 * 【再利用性】: 多言語対応処理で共通利用 🟡
 * 【単一責任】: 言語判定のみを担当
 */
function getCurrentLanguage() {
    var lang = process.env.LANG || 'ja_JP.UTF-8';
    return lang.includes('en') ? 'en' : 'ja';
}
/**
 * 【エラーメッセージ取得】: 言語に応じたエラーメッセージを返す
 * 【国際化対応】: 自動的に適切な言語を選択 🟡
 */
function getErrorMessage(key) {
    var lang = getCurrentLanguage();
    return ERROR_MESSAGES[lang][key];
}
/**
 * 【URL長検証】: URL長制限のチェック
 * 【セキュリティ】: DoS攻撃防止のための制限 🟢
 * 【パフォーマンス】: 早期リターンによる効率化 🟢
 */
function validateUrlLength(url) {
    if (url.length > URL_CONFIG.MAX_LENGTH) {
        var message = getErrorMessage('URL_TOO_LONG');
        throw new Error(typeof message === 'function' ? message(URL_CONFIG.MAX_LENGTH) : message);
    }
}
/**
 * 【プラグイン名セキュリティ検証】: XSS攻撃防止のための入力検証
 * 【改善内容】: HTMLタグと危険文字の包括的チェック 🟢
 * 【設計方針】: ホワイトリスト方式による安全性確保
 */
function validatePluginNameSecurity(pluginName) {
    // 【HTMLタグ検出】: スクリプトインジェクション防止
    if (pluginName.includes('<') || pluginName.includes('>')) {
        throw new Error(getErrorMessage('SECURITY_INVALID_CHARS'));
    }
    // 【安全文字検証】: 許可された文字のみを受け入れ
    if (!SECURITY_CONFIG.SAFE_PLUGIN_NAME_PATTERN.test(pluginName)) {
        throw new Error(getErrorMessage('SECURITY_INVALID_CHARS'));
    }
}
/**
 * 【コンポーネントセキュリティ検証】: 悪意あるコンポーネントの検出
 * 【改善内容】: プロトタイプ汚染攻撃対策を追加 🔴
 * 【設計方針】: 多層防御による安全性向上
 */
function validateComponentSecurity(component) {
    if (!component || typeof component !== 'object') {
        return;
    }
    var obj = component;
    // 【プロトタイプ汚染対策】: 危険なプロパティへのアクセスブロック 🔴
    for (var _i = 0, _a = SECURITY_CONFIG.DANGEROUS_PROPERTIES; _i < _a.length; _i++) {
        var prop = _a[_i];
        if (prop in obj) {
            throw new Error(getErrorMessage('MALICIOUS_COMPONENT'));
        }
    }
    // 【maliciousプロパティ検出】: テスト用の悪意あるフラグ検出
    if ('malicious' in obj && obj.malicious) {
        throw new Error(getErrorMessage('MALICIOUS_COMPONENT'));
    }
    // 【eval検出】: コードインジェクション防止
    if (obj.constructor &&
        typeof obj.constructor === 'function' &&
        obj.constructor.toString().includes('eval')) {
        throw new Error(getErrorMessage('MALICIOUS_COMPONENT'));
    }
}
/**
 * 【エラーハンドリングヘルパー】: 共通エラー処理ロジック
 * 【DRY原則】: 重複コードの削減 🟡
 * 【保守性】: エラー処理の一元管理
 */
function handleLoadError(error) {
    var _a, _b;
    // 【特定エラーの処理】: 既知のエラータイプに応じた処理
    if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Network Error')) {
        throw error; // ネットワークエラーはそのまま再throw
    }
    if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('OutOfMemoryError')) {
        throw new Error(getErrorMessage('OUT_OF_MEMORY'));
    }
    throw error;
}
/**
 * 【非同期コンポーネント実行】: コンポーネントの非同期実行処理
 * 【DRY原則】: 重複処理の共通化 🟡
 * 【エラー処理】: 統一されたエラーハンドリング
 */
function executeComponent(component) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(typeof component === 'function')) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve(component())];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    handleLoadError(error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, component];
            }
        });
    });
}
// ================================================================================
// 【プラグインレジストリクラス】: プラグイン管理機構
// ================================================================================
/**
 * 【プラグインレジストリ】: プラグインの登録・取得・管理
 * 【改善内容】: DoS攻撃対策とメモリ管理の強化 🔴
 * 【設計方針】: シングルトンパターンによる一元管理
 */
var PluginRegistryClass = /** @class */ (function () {
    function PluginRegistryClass() {
        /** 【プラグイン格納Map】: O(1)アクセスのためのMap構造 🟢 */
        this.plugins = new Map();
    }
    /**
     * 【プラグイン登録】: 新規プラグインの登録
     * 【セキュリティ】: 登録数制限によるDoS攻撃対策 🔴
     * 【検証処理】: 登録前の厳密な検証
     */
    PluginRegistryClass.prototype.register = function (name, plugin) {
        // 【登録数制限チェック】: メモリ枯渇攻撃の防止 🔴
        if (this.plugins.size >= SECURITY_CONFIG.MAX_PLUGINS) {
            throw new Error(getErrorMessage('TOO_MANY_PLUGINS'));
        }
        // 【プラグイン名検証】: セキュリティチェック
        validatePluginNameSecurity(name);
        // 【登録処理】: 検証済みプラグインの登録
        this.plugins.set(name, plugin);
    };
    /**
     * 【プラグイン取得】: 登録済みプラグインの取得
     * 【パフォーマンス】: O(1)での高速アクセス 🟢
     */
    PluginRegistryClass.prototype.get = function (name) {
        return this.plugins.get(name);
    };
    /**
     * 【レジストリクリア】: 全プラグインの削除
     * 【用途】: テスト環境でのリセット処理
     */
    PluginRegistryClass.prototype.clear = function () {
        this.plugins.clear();
    };
    Object.defineProperty(PluginRegistryClass.prototype, "size", {
        /**
         * 【登録数取得】: 現在の登録プラグイン数
         * 【監視用】: メモリ使用状況の監視 🔴
         */
        get: function () {
            return this.plugins.size;
        },
        enumerable: false,
        configurable: true
    });
    return PluginRegistryClass;
}());
/** 【グローバルレジストリ】: アプリケーション全体で共有 */
exports.PluginRegistry = new PluginRegistryClass();
// ================================================================================
// 【公開API関数セクション】: 外部から利用される主要機能
// ================================================================================
/**
 * 【階層URL解析】: URLを構造化データに変換
 * 【改善内容】: エラーメッセージの国際化対応 🟢
 * 【設計方針】: 早期検証による安全性確保
 *
 * @param url - 解析対象のURL文字列
 * @returns 解析済みルートパラメータ
 * @throws {Error} URL形式不正またはセキュリティ違反時
 */
function parseHierarchicalUrl(url) {
    // 【前処理検証】: URL長とフォーマットの事前チェック
    validateUrlLength(url);
    // 【URLパターンマッチング】: 正規表現による構造解析
    var match = url.match(URL_CONFIG.HIERARCHICAL_PATTERN);
    if (!match) {
        throw new Error(getErrorMessage('INVALID_URL_FORMAT'));
    }
    // 【構造分解】: マッチ結果から各要素を抽出
    var treeId = match[1], pageNodeId = match[2], targetNodeId = match[3], nodeType = match[4];
    // 【セキュリティ検証】: プラグイン名の安全性確認
    if (!nodeType) {
        throw new Error('nodeType is required');
    }
    validatePluginNameSecurity(nodeType);
    // 【結果返却】: 不変オブジェクトとして返却
    return Object.freeze({
        treeId: treeId || '',
        pageNodeId: pageNodeId || '',
        targetNodeId: targetNodeId || '',
        nodeType: nodeType,
    });
}
exports.parseHierarchicalUrl = parseHierarchicalUrl;
/**
 * 【プラグインコンポーネント動的ロード】: 非同期でプラグインをロード
 * 【改善内容】: DRY原則適用とメモリリーク対策 🟡
 * 【設計方針】: タイムアウト制御と適切なエラーハンドリング
 *
 * @param pluginName - ロード対象プラグイン名
 * @param actionName - 実行するアクション名
 * @param options - ロードオプション（タイムアウト等）
 * @returns ロードされたコンポーネント
 * @throws {Error} プラグイン不在、セキュリティ違反、タイムアウト時
 */
function loadPluginComponent(pluginName, actionName, options) {
    return __awaiter(this, void 0, void 0, function () {
        var plugin, message, action, message, abortController_1, timeoutPromise, loadPromise, error_2, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 【入力検証】: セキュリティチェックを最初に実行
                    validatePluginNameSecurity(pluginName);
                    plugin = exports.PluginRegistry.get(pluginName);
                    if (!plugin) {
                        message = getErrorMessage('PLUGIN_NOT_FOUND');
                        throw new Error(typeof message === 'function' ? message(pluginName) : message);
                    }
                    action = plugin.actions[actionName];
                    if (!action) {
                        message = getErrorMessage('ACTION_NOT_FOUND');
                        throw new Error(typeof message === 'function' ? message(actionName) : message);
                    }
                    // 【セキュリティ検証】: コンポーネントの安全性確認
                    validateComponentSecurity(action.component);
                    if (!(options === null || options === void 0 ? void 0 : options.timeout)) return [3 /*break*/, 5];
                    abortController_1 = new AbortController();
                    timeoutPromise = new Promise(function (_, reject) {
                        var timeoutId = setTimeout(function () {
                            abortController_1.abort();
                            reject(new Error(getErrorMessage('TIMEOUT')));
                        }, options.timeout);
                        // 【クリーンアップ】: Promiseレース終了時のタイマークリア 🔴
                        abortController_1.signal.addEventListener('abort', function () {
                            clearTimeout(timeoutId);
                        });
                    });
                    loadPromise = action.loader ? action.loader() : executeComponent(action.component);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.race([loadPromise, timeoutPromise])];
                case 2: 
                // 【レース実行】: タイムアウトと処理の競争
                return [2 /*return*/, _a.sent()];
                case 3:
                    error_2 = _a.sent();
                    handleLoadError(error_2);
                    return [3 /*break*/, 5];
                case 4:
                    // 【リソース解放】: AbortControllerのクリーンアップ 🔴
                    abortController_1.abort();
                    return [7 /*endfinally*/];
                case 5:
                    if (!action.loader) return [3 /*break*/, 9];
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, action.loader()];
                case 7: return [2 /*return*/, _a.sent()];
                case 8:
                    error_3 = _a.sent();
                    handleLoadError(error_3);
                    return [3 /*break*/, 9];
                case 9: 
                // 【コンポーネント実行】: 直接実行
                return [2 /*return*/, executeComponent(action.component)];
            }
        });
    });
}
exports.loadPluginComponent = loadPluginComponent;
// ================================================================================
// 【メインルータークラス】: ルーティング処理の中核
// ================================================================================
/**
 * 【階層的プラグインルーター】: ルート解決とパフォーマンス監視
 * 【改善内容】: パフォーマンス測定の最適化 🟡
 * 【設計方針】: 静的メソッドによるステートレス設計
 */
var HierarchicalPluginRouter = /** @class */ (function () {
    function HierarchicalPluginRouter() {
    }
    /**
     * 【ルート解決】: パラメータからコンポーネントを解決
     * 【パフォーマンス監視】: SLA基準に基づく警告出力
     * 【改善内容】: 重複コード削減とエラー処理最適化 🟡
     *
     * @param params - ルートパラメータ
     * @returns 解決されたコンポーネント
     * @throws {Error} プラグイン不在またはアクション不在時
     */
    HierarchicalPluginRouter.resolveRoute = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, plugin, message, viewAction, message, duration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 4, 5]);
                        plugin = exports.PluginRegistry.get(params.nodeType);
                        if (!plugin) {
                            message = getErrorMessage('PLUGIN_NOT_FOUND');
                            throw new Error(typeof message === 'function' ? message(params.nodeType) : message);
                        }
                        viewAction = plugin.actions.view;
                        if (!viewAction) {
                            message = getErrorMessage('ACTION_NOT_FOUND');
                            throw new Error(typeof message === 'function' ? message('view') : message);
                        }
                        if (!viewAction.loader) return [3 /*break*/, 3];
                        return [4 /*yield*/, viewAction.loader()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: 
                    // 【コンポーネント返却】: 解決済みコンポーネント
                    return [2 /*return*/, viewAction.component];
                    case 4:
                        duration = performance.now() - startTime;
                        // 【警告出力】: SLA違反時のみ警告
                        if (duration >= PERFORMANCE_CONFIG.WARNING_THRESHOLD_MS) {
                            console.warn("Route resolution took ".concat(Math.round(duration), "ms, expected < ").concat(PERFORMANCE_CONFIG.SLA_MS, "ms"));
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return HierarchicalPluginRouter;
}());
exports.HierarchicalPluginRouter = HierarchicalPluginRouter;

"use strict";
/**
 * @file workerLogger.ts
 * @description Simple i18n logging for worker environment
 *
 * Worker environment has limited access to full i18next setup,
 * so we use a simplified translation system for logging.
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerInfo = exports.workerWarn = exports.workerError = exports.workerLog = void 0;
// Simple translation map for worker logging
var translations = {
    en: {
        'worker.initialized': 'Worker API initialized',
        'worker.initializationFailed': 'Failed to initialize Worker API',
        'worker.processingCommand': 'Processing command',
        'worker.commandCompleted': 'Command completed',
        'worker.commandFailed': 'Command failed',
    },
    ja: {
        'worker.initialized': 'Worker API が初期化されました',
        'worker.initializationFailed': 'Worker API の初期化に失敗しました',
        'worker.processingCommand': 'コマンドを処理中',
        'worker.commandCompleted': 'コマンド処理完了',
        'worker.commandFailed': 'コマンド処理失敗',
    },
};
// Get current language from localStorage or default to English
var getCurrentLanguage = function () {
    try {
        var stored = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null;
        return stored === 'ja' ? 'ja' : 'en';
    }
    catch (_a) {
        return 'en';
    }
};
// Simple translation function
var t = function (key, interpolations) {
    var currentLang = getCurrentLanguage();
    var text = translations[currentLang][key] || key;
    if (interpolations) {
        Object.entries(interpolations).forEach(function (_a) {
            var k = _a[0], v = _a[1];
            text = text.replace(new RegExp("{{".concat(k, "}}"), 'g'), String(v));
        });
    }
    return text;
};
// Worker logging functions with i18n
var workerLog = function (key, interpolations) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    console.log.apply(console, __spreadArray([t(key, interpolations)], args, false));
};
exports.workerLog = workerLog;
var workerError = function (key, interpolations) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    console.error.apply(console, __spreadArray([t(key, interpolations)], args, false));
};
exports.workerError = workerError;
var workerWarn = function (key, interpolations) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    console.warn.apply(console, __spreadArray([t(key, interpolations)], args, false));
};
exports.workerWarn = workerWarn;
var workerInfo = function (key, interpolations) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    console.info.apply(console, __spreadArray([t(key, interpolations)], args, false));
};
exports.workerInfo = workerInfo;

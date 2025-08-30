"use strict";
/**
 * Base Vitest Setup Configuration
 *
 * Common test environment setup for all packages.
 * Provides Web Worker, IndexedDB, and other browser API mocks for Node.js environment.
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
exports.setupBasicTestEnvironment = exports.clearAllDatabases = void 0;
require("fake-indexeddb/auto");
var vitest_1 = require("vitest");
// ========================
// Comlink Mock Setup
// ========================
var comlinkMock = {
    wrap: function (target) {
        // Return API directly without proxy in test environment
        return target;
    },
    expose: function (api) {
        // No-op in Node environment
        return api;
    },
    transfer: function (obj, _transfers) { return obj; },
    transferHandlers: new Map(),
    proxy: function (obj) { return obj; },
    windowEndpoint: function (window) { return window; },
    createEndpoint: function () { return ({}); },
    releaseProxy: function () { },
};
vitest_1.vi.mock('comlink', function () { return comlinkMock; });
// ========================
// Worker Environment Setup
// ========================
// Set up Worker environment globals
if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
}
// Mock Web Worker class
var WorkerMock = /** @class */ (function () {
    function WorkerMock(url, options) {
        this.url = url;
        this.options = options;
        this.listeners = new Map();
    }
    WorkerMock.prototype.postMessage = function (message, _transfer) {
        var _this = this;
        // Simulate async message handling
        setTimeout(function () {
            var handlers = _this.listeners.get('message') || [];
            handlers.forEach(function (handler) { return handler({ data: message }); });
        }, 0);
    };
    WorkerMock.prototype.addEventListener = function (type, listener) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(listener);
    };
    WorkerMock.prototype.removeEventListener = function (type, listener) {
        var handlers = this.listeners.get(type) || [];
        var index = handlers.indexOf(listener);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    };
    WorkerMock.prototype.terminate = function () {
        this.listeners.clear();
    };
    return WorkerMock;
}());
// Set Worker globally if not available
if (typeof Worker === 'undefined') {
    globalThis.Worker = WorkerMock;
}
// ========================
// Browser API Polyfills
// ========================
// structuredClone polyfill (for Node < v17)
if (!globalThis.structuredClone) {
    globalThis.structuredClone = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    };
}
// crypto.subtle mock for tests that need crypto APIs
if (!globalThis.crypto) {
    globalThis.crypto = {
        subtle: {
            digest: vitest_1.vi.fn(),
            encrypt: vitest_1.vi.fn(),
            decrypt: vitest_1.vi.fn(),
        },
        getRandomValues: vitest_1.vi.fn(function (arr) {
            for (var i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }),
    };
}
// CompressionStream mock for compression tests
if (!globalThis.CompressionStream) {
    globalThis.CompressionStream = /** @class */ (function () {
        function CompressionStream(format) {
            this.format = format;
            this.writable = { getWriter: function () { return ({ write: vitest_1.vi.fn(), close: vitest_1.vi.fn() }); } };
            this.readable = { getReader: function () { return ({ read: vitest_1.vi.fn() }); } };
        }
        return CompressionStream;
    }());
}
// ========================
// Test Cleanup Utilities
// ========================
/**
 * Clear all IndexedDB databases
 * Use this in tests that need clean database state
 */
function clearAllDatabases() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var databases, _loop_1, _i, databases_1, db;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ((_a = indexedDB.databases) === null || _a === void 0 ? void 0 : _a.call(indexedDB))];
                case 1:
                    databases = (_b.sent()) || [];
                    _loop_1 = function (db) {
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (!db.name) return [3 /*break*/, 2];
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var deleteReq = indexedDB.deleteDatabase(db.name);
                                            deleteReq.onsuccess = function () { return resolve(); };
                                            deleteReq.onerror = function () { return reject(deleteReq.error); };
                                            deleteReq.onblocked = function () {
                                                // Force close any open connections
                                                setTimeout(function () { return resolve(); }, 100);
                                            };
                                        })];
                                case 1:
                                    _c.sent();
                                    _c.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, databases_1 = databases;
                    _b.label = 2;
                case 2:
                    if (!(_i < databases_1.length)) return [3 /*break*/, 5];
                    db = databases_1[_i];
                    return [5 /*yield**/, _loop_1(db)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.clearAllDatabases = clearAllDatabases;
/**
 * Basic setup that runs before each test
 * Can be extended by individual packages
 */
function setupBasicTestEnvironment() {
    var _this = this;
    (0, vitest_1.beforeEach)(function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clearAllDatabases()];
                case 1:
                    _a.sent();
                    vitest_1.vi.clearAllMocks();
                    return [2 /*return*/];
            }
        });
    }); });
}
exports.setupBasicTestEnvironment = setupBasicTestEnvironment;
// ========================
// Console Mock Setup
// ========================
// Mock console methods that might interfere with test output
global.console.error = vitest_1.vi.fn();
global.console.warn = vitest_1.vi.fn();
// ========================
// Default Setup
// ========================
// Run basic setup by default
setupBasicTestEnvironment();

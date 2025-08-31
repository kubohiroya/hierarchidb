"use strict";
/**
 * Worker-side initialization reporter
 *
 * This module handles sending initialization status messages from the Worker
 * to the UI thread via postMessage, independent of Comlink.
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
exports.WorkerInitializationReporter = void 0;
var WorkerInitializationReporter = /** @class */ (function () {
    function WorkerInitializationReporter(steps, debug) {
        if (steps === void 0) { steps = []; }
        if (debug === void 0) { debug = false; }
        this.isInitialized = false;
        this.initSteps = [];
        this.currentStep = 0;
        this.currentProgress = 0;
        this.debug = false;
        this.initSteps = steps;
        this.debug = debug;
        this.setupMessageListener();
    }
    /**
     * Set up message listener for initialization requests
     */
    WorkerInitializationReporter.prototype.setupMessageListener = function () {
        var _this = this;
        if (typeof self !== 'undefined' && 'addEventListener' in self) {
            self.addEventListener('message', function (event) {
                var request = event.data;
                if (request.type === 'INIT_REQUEST') {
                    _this.reportCurrentStatus();
                }
                else if (request.type === 'PING') {
                    _this.sendMessage('PING_RESPONSE', { timestamp: Date.now() });
                }
            });
        }
    };
    /**
     * Add initialization steps dynamically
     */
    WorkerInitializationReporter.prototype.addSteps = function (steps) {
        var _a;
        (_a = this.initSteps).push.apply(_a, steps);
    };
    /**
     * Report progress for a specific initialization step
     */
    WorkerInitializationReporter.prototype.reportStepProgress = function (stepName, stepProgress) {
        if (stepProgress === void 0) { stepProgress = 100; }
        var stepIndex = this.initSteps.findIndex(function (s) { return s.name === stepName; });
        if (stepIndex === -1) {
            if (this.debug) {
                console.warn("[WorkerInitReporter] Unknown step: ".concat(stepName));
            }
            return;
        }
        this.currentStep = stepIndex;
        // Calculate overall progress
        var totalProgress = 0;
        var totalWeight = this.initSteps.reduce(function (sum, step) { return sum + step.weight; }, 0);
        for (var i = 0; i < stepIndex; i++) {
            var step = this.initSteps[i];
            if (step) {
                totalProgress += step.weight;
            }
        }
        var currentStep = this.initSteps[stepIndex];
        if (currentStep) {
            totalProgress += (currentStep.weight * stepProgress / 100);
        }
        this.currentProgress = Math.round((totalProgress / totalWeight) * 100);
        this.sendMessage('INIT_PROGRESS', {
            progress: this.currentProgress,
            message: stepName,
        });
    };
    /**
     * Report initialization complete
     */
    WorkerInitializationReporter.prototype.reportComplete = function () {
        this.isInitialized = true;
        this.currentProgress = 100;
        this.sendMessage('INIT_COMPLETE', {
            progress: 100,
            message: 'Worker initialized successfully',
        });
    };
    /**
     * Report initialization error
     */
    WorkerInitializationReporter.prototype.reportError = function (error) {
        this.sendMessage('INIT_ERROR', {
            error: error instanceof Error ? error.message : error,
        });
    };
    /**
     * Report current status (for late requests)
     */
    WorkerInitializationReporter.prototype.reportCurrentStatus = function () {
        var _a;
        if (this.isInitialized) {
            this.reportComplete();
        }
        else if (this.currentProgress > 0) {
            var currentStepName = ((_a = this.initSteps[this.currentStep]) === null || _a === void 0 ? void 0 : _a.name) || 'Initializing...';
            this.sendMessage('INIT_PROGRESS', {
                progress: this.currentProgress,
                message: currentStepName,
            });
        }
        else {
            // Just started or not initialized yet
            this.sendMessage('INIT_PROGRESS', {
                progress: 0,
                message: 'Starting initialization...',
            });
        }
    };
    /**
     * Send a message to the UI thread
     */
    WorkerInitializationReporter.prototype.sendMessage = function (type, payload) {
        if (typeof self !== 'undefined' && 'postMessage' in self) {
            var message = {
                type: type,
                payload: __assign(__assign({}, payload), { timestamp: Date.now() }),
            };
            if (this.debug) {
                console.log('[WorkerInitReporter] Sending message:', message);
            }
            self.postMessage(message);
        }
    };
    /**
     * Track initialization with automatic progress reporting
     */
    WorkerInitializationReporter.prototype.trackInitialization = function (stepName, operation) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.reportStepProgress(stepName, 0);
                        return [4 /*yield*/, operation()];
                    case 1:
                        result = _a.sent();
                        this.reportStepProgress(stepName, 100);
                        return [2 /*return*/, result];
                    case 2:
                        error_1 = _a.sent();
                        this.reportError(error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if initialization is complete
     */
    WorkerInitializationReporter.prototype.isReady = function () {
        return this.isInitialized;
    };
    return WorkerInitializationReporter;
}());
exports.WorkerInitializationReporter = WorkerInitializationReporter;

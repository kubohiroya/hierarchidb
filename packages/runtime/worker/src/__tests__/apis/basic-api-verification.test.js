"use strict";
/**
 * @file basic-api-verification.test.ts
 * @description Simple verification tests for WorkerAPI implementation
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
var vitest_1 = require("vitest");
var WorkerAPIImpl_1 = require("../../WorkerAPIImpl");
(0, vitest_1.describe)('Basic API Verification', function () {
    var workerAPI;
    (0, vitest_1.beforeAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, WorkerAPIImpl_1.WorkerAPIImpl.getSingleton("test-db-".concat(Date.now()))];
                case 1:
                    // Initialize WorkerAPI with a unique database name for testing
                    workerAPI = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.afterAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, workerAPI.shutdown()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.describe)('API availability', function () {
        (0, vitest_1.it)('should have TreeQueryAPI available', function () {
            var queryAPI = workerAPI.getQueryAPI();
            (0, vitest_1.expect)(queryAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have TreeMutationAPI available', function () {
            var mutationAPI = workerAPI.getMutationAPI();
            (0, vitest_1.expect)(mutationAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have TreeSubscriptionAPI available', function () {
            var subscriptionAPI = workerAPI.getSubscriptionAPI();
            (0, vitest_1.expect)(subscriptionAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have NodeTypeAPI available', function () {
            var nodeTypeAPI = workerAPI.getNodeTypeAPI();
            (0, vitest_1.expect)(nodeTypeAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have PluginTreeAPI available', function () {
            var pluginTreeAPI = workerAPI.getPluginTreeAPI();
            (0, vitest_1.expect)(pluginTreeAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have PluginManagementAPI available', function () {
            var pluginManagementAPI = workerAPI.getPluginManagementAPI();
            (0, vitest_1.expect)(pluginManagementAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have PluginRegistryAPI available', function () {
            var pluginRegistryAPI = workerAPI.getPluginRegistryAPI();
            (0, vitest_1.expect)(pluginRegistryAPI).toBeDefined();
        });
        (0, vitest_1.it)('should have WorkingCopyAPI available', function () {
            var workingCopyAPI = workerAPI.getWorkingCopyAPI();
            (0, vitest_1.expect)(workingCopyAPI).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Basic functionality', function () {
        (0, vitest_1.it)('should respond to ping', function () {
            var response = workerAPI.ping();
            (0, vitest_1.expect)(response.response).toBe('pong');
            (0, vitest_1.expect)(response.timestamp).toBeTypeOf('number');
        });
        (0, vitest_1.it)('should provide system health information', function () { return __awaiter(void 0, void 0, void 0, function () {
            var health;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, workerAPI.getSystemHealth()];
                    case 1:
                        health = _a.sent();
                        (0, vitest_1.expect)(health).toHaveProperty('databases');
                        (0, vitest_1.expect)(health).toHaveProperty('services');
                        (0, vitest_1.expect)(health).toHaveProperty('memory');
                        (0, vitest_1.expect)(health).toHaveProperty('uptime');
                        // Check that databases are initialized
                        (0, vitest_1.expect)(health.databases.coreDB).toBe(true);
                        (0, vitest_1.expect)(health.databases.ephemeralDB).toBe(true);
                        // Check that core services are available
                        (0, vitest_1.expect)(health.services.query).toBe(true);
                        (0, vitest_1.expect)(health.services.mutation).toBe(true);
                        (0, vitest_1.expect)(health.services.subscription).toBe(true);
                        (0, vitest_1.expect)(health.services.plugin).toBe(true);
                        (0, vitest_1.expect)(health.services.workingCopy).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should list default trees', function () { return __awaiter(void 0, void 0, void 0, function () {
            var trees, treeNames;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, workerAPI.listTrees()];
                    case 1:
                        trees = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(trees)).toBe(true);
                        // Default setup should have Resources and Projects trees
                        (0, vitest_1.expect)(trees.length).toBeGreaterThanOrEqual(2);
                        treeNames = trees.map(function (t) { return t.name; });
                        (0, vitest_1.expect)(treeNames).toContain('Resources');
                        (0, vitest_1.expect)(treeNames).toContain('Projects');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('TreeQuery Service Basics', function () {
        (0, vitest_1.it)('should retrieve a tree by ID', function () { return __awaiter(void 0, void 0, void 0, function () {
            var trees, firstTree, retrievedTree;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, workerAPI.listTrees()];
                    case 1:
                        trees = _a.sent();
                        if (!(trees.length > 0)) return [3 /*break*/, 3];
                        firstTree = trees[0];
                        return [4 /*yield*/, workerAPI.getTree({ treeId: firstTree.id })];
                    case 2:
                        retrievedTree = _a.sent();
                        (0, vitest_1.expect)(retrievedTree).toBeDefined();
                        (0, vitest_1.expect)(retrievedTree.id).toBe(firstTree.id);
                        (0, vitest_1.expect)(retrievedTree.name).toBe(firstTree.name);
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should return null for non-existent tree', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nonExistentTree;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, workerAPI.getTree({ treeId: 'non-existent' })];
                    case 1:
                        nonExistentTree = _a.sent();
                        (0, vitest_1.expect)(nonExistentTree).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should get children of root node', function () { return __awaiter(void 0, void 0, void 0, function () {
            var trees, firstTree, children;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, workerAPI.listTrees()];
                    case 1:
                        trees = _a.sent();
                        if (!(trees.length > 0)) return [3 /*break*/, 3];
                        firstTree = trees[0];
                        return [4 /*yield*/, workerAPI.getChildren({ parentId: firstTree.rootId })];
                    case 2:
                        children = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(children)).toBe(true);
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('WorkingCopyTypes Service Basics', function () {
        (0, vitest_1.it)('should list working copies (initially empty)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workingCopyAPI, workingCopies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workingCopyAPI = workerAPI.getWorkingCopyAPI();
                        return [4 /*yield*/, workingCopyAPI.listWorkingCopies()];
                    case 1:
                        workingCopies = _a.sent();
                        (0, vitest_1.expect)(Array.isArray(workingCopies)).toBe(true);
                        // Initially should be empty
                        (0, vitest_1.expect)(workingCopies.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should provide working copy stats', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workingCopyAPI, stats;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workingCopyAPI = workerAPI.getWorkingCopyAPI();
                        return [4 /*yield*/, workingCopyAPI.getWorkingCopyStats()];
                    case 1:
                        stats = _a.sent();
                        (0, vitest_1.expect)(stats).toHaveProperty('total');
                        (0, vitest_1.expect)(stats).toHaveProperty('drafts');
                        (0, vitest_1.expect)(stats).toHaveProperty('edits');
                        (0, vitest_1.expect)(stats).toHaveProperty('oldestTimestamp');
                        (0, vitest_1.expect)(stats).toHaveProperty('newestTimestamp');
                        (0, vitest_1.expect)(typeof stats.total).toBe('number');
                        (0, vitest_1.expect)(typeof stats.drafts).toBe('number');
                        (0, vitest_1.expect)(typeof stats.edits).toBe('number');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

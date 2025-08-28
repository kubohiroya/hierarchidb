"use strict";
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
exports.TreeSubscriptionService = void 0;
var rxjs_1 = require("rxjs");
var TreeQueryService_1 = require("./TreeQueryService");
/**
 * TreeSubscriptionService - Implements TreeSubscriptionAPI
 * Provides real-time subscription functionality for tree structure changes
 */
var TreeSubscriptionService = /** @class */ (function () {
    function TreeSubscriptionService(coreDB) {
        var _this = this;
        this.coreDB = coreDB;
        this.subscriptions = new Map();
        this.globalChangeSubject = new rxjs_1.Subject();
        this.subscriptionCounter = 0;
        this.eventHistory = [];
        this.maxEventHistory = 1000;
        this.eventsProcessedToday = 0;
        this.totalLatency = 0;
        this.eventCount = 0;
        // CoreDBのchangeSubjectを購読してグローバルな変更イベントを中継
        this.coreDB.changeSubject.subscribe({
            next: function (event) {
                _this.globalChangeSubject.next(event);
            },
        });
        // Set up periodic subscription cleanup
        this.setupPeriodicSubscriptionCleanup();
    }
    TreeSubscriptionService.prototype.subscribeNodeCommand = function (cmd) {
        var _this = this;
        var _a = cmd.payload, nodeId = _a.nodeId, filter = _a.filter, _b = _a.includeInitialValue, includeInitialValue = _b === void 0 ? false : _b;
        var subscriptionId = this.generateSubscriptionId();
        var subject = new rxjs_1.Subject();
        // Store subscription info
        this.subscriptions.set(subscriptionId, {
            id: subscriptionId,
            type: 'node',
            nodeId: nodeId,
            callback: function (event) { return subject.next(event); },
            options: { includeMetadata: includeInitialValue },
            isActive: true,
            lastActivity: Date.now(),
            createdAt: Date.now()
        });
        // Create observable that filters global changes for this specific node
        var nodeObservable = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForNodeObservation(event, nodeId); }), (0, rxjs_1.map)(function (event) { return _this.transformEventForSubscription(event); }), (0, rxjs_1.share)());
        // Subscribe to global changes and forward relevant ones
        var subscription = nodeObservable.subscribe({
            next: function (event) {
                subject.next(event);
                _this.updateSubscriptionActivity(subscriptionId);
            },
        });
        // Handle initial value if requested
        var resultObservable = subject.asObservable();
        if (includeInitialValue) {
            resultObservable = resultObservable.pipe((0, rxjs_1.startWith)(this.createInitialNodeEvent(nodeId)));
        }
        // Clean up subscription when unsubscribed
        var originalSubscribe = resultObservable.subscribe.bind(resultObservable);
        var customSubscribe = function (observer) {
            var sub = originalSubscribe({ next: observer });
            var originalUnsubscribe = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function () {
                subscription.unsubscribe();
                _this.deactivateSubscription(subscriptionId);
                originalUnsubscribe();
            };
            return sub;
        };
        // Override the subscribe method
        Object.defineProperty(resultObservable, 'subscribe', {
            value: customSubscribe,
            writable: false,
            configurable: true,
        });
        return resultObservable;
    };
    TreeSubscriptionService.prototype.subscribeChildrenCommand = function (cmd) {
        var _this = this;
        var _a = cmd.payload, parentId = _a.parentId, filter = _a.filter, _b = _a.includeInitialSnapshot, includeInitialSnapshot = _b === void 0 ? false : _b;
        var subscriptionId = this.generateSubscriptionId();
        var subject = new rxjs_1.Subject();
        // Store subscription info
        this.subscriptions.set(subscriptionId, {
            id: subscriptionId,
            type: 'childNodes',
            nodeId: parentId,
            filter: filter,
            subject: subject,
            isActive: true,
            lastActivity: Date.now(),
            createdAt: Date.now(),
        });
        // Create observable that filters global changes for childNodes of this node
        var childNodesObservable = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForChildNodesObservation(event, parentId, filter); }), (0, rxjs_1.map)(function (event) { return _this.transformEventForSubscription(event); }), (0, rxjs_1.share)());
        // Subscribe to global changes and forward relevant ones
        var subscription = childNodesObservable.subscribe({
            next: function (event) {
                subject.next(event);
                _this.updateSubscriptionActivity(subscriptionId);
            },
        });
        // Handle initial snapshot if requested
        var resultObservable = subject.asObservable();
        if (includeInitialSnapshot) {
            resultObservable = resultObservable.pipe((0, rxjs_1.startWith)(this.createInitialChildNodesEvent(parentId, filter)));
        }
        // Set up unsubscribe handler
        var originalSubscribe = resultObservable.subscribe.bind(resultObservable);
        resultObservable.subscribe = function (observer) {
            var sub = originalSubscribe(observer);
            var originalUnsubscribe = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function () {
                subscription.unsubscribe();
                _this.deactivateSubscription(subscriptionId);
                originalUnsubscribe();
            };
            return sub;
        };
        return resultObservable;
    };
    TreeSubscriptionService.prototype.subscribeSubtreeCommand = function (cmd) {
        var _this = this;
        var _a = cmd.payload, rootId = _a.rootId, maxDepth = _a.maxDepth, filter = _a.filter, _b = _a.includeInitialSnapshot, includeInitialSnapshot = _b === void 0 ? false : _b;
        var subscriptionId = this.generateSubscriptionId();
        var subject = new rxjs_1.Subject();
        // Store subscription info
        this.subscriptions.set(subscriptionId, {
            id: subscriptionId,
            type: 'subtree',
            nodeId: rootId,
            callback: function (event) { return subject.next(event); },
            options: __assign(__assign({}, filter), { maxDepth: maxDepth }),
            isActive: true,
            lastActivity: Date.now(),
            createdAt: Date.now()
        });
        // Create observable that filters global changes for subtree
        var subtreeObservable = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) {
            return _this.isEventRelevantForSubtreeObservation(event, rootId, maxDepth, filter);
        }), (0, rxjs_1.map)(function (event) { return _this.transformEventForSubscription(event); }), (0, rxjs_1.share)());
        // Subscribe to global changes and forward relevant ones
        var subscription = subtreeObservable.subscribe({
            next: function (event) {
                subject.next(event);
                _this.updateSubscriptionActivity(subscriptionId);
            },
        });
        // Handle initial snapshot if requested
        var resultObservable = subject.asObservable();
        if (includeInitialSnapshot && maxDepth) {
            resultObservable = resultObservable.pipe((0, rxjs_1.startWith)(this.createInitialSubtreeEvent(rootId, { maxDepth: maxDepth })));
        }
        // Set up unsubscribe handler
        var originalSubscribe = resultObservable.subscribe.bind(resultObservable);
        resultObservable.subscribe = function (observer) {
            var sub = originalSubscribe(observer);
            var originalUnsubscribe = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function () {
                subscription.unsubscribe();
                _this.deactivateSubscription(subscriptionId);
                originalUnsubscribe();
            };
            return sub;
        };
        return resultObservable;
    };
    TreeSubscriptionService.prototype.subscribeWorkingCopies = function (cmd) {
        var _this = this;
        var _a = cmd.payload, nodeId = _a.nodeId, _b = _a.includeAllDrafts, includeAllDrafts = _b === void 0 ? false : _b;
        var subscriptionId = this.generateSubscriptionId();
        var subject = new rxjs_1.Subject();
        // Store subscription info
        this.subscriptions.set(subscriptionId, {
            id: subscriptionId,
            type: 'working-copies',
            nodeId: nodeId || 'all',
            filter: { properties: includeAllDrafts ? ['isDraft'] : [] },
            subject: subject,
            isActive: true,
            lastActivity: Date.now(),
            createdAt: Date.now(),
        });
        // For now, working copy events come through the same change stream
        // In a real implementation, this might have a separate event source
        var workingCopyObservable = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForWorkingCopies(event, nodeId); }), (0, rxjs_1.map)(function (event) { return _this.transformEventForSubscription(event); }), (0, rxjs_1.share)());
        // Subscribe to global changes and forward relevant ones
        var subscription = workingCopyObservable.subscribe({
            next: function (event) {
                subject.next(event);
                _this.updateSubscriptionActivity(subscriptionId);
            },
        });
        // Set up unsubscribe handler
        var resultObservable = subject.asObservable();
        var originalSubscribe = resultObservable.subscribe.bind(resultObservable);
        resultObservable.subscribe = function (observer) {
            var sub = originalSubscribe(observer);
            var originalUnsubscribe = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function () {
                subscription.unsubscribe();
                _this.deactivateSubscription(subscriptionId);
                originalUnsubscribe();
            };
            return sub;
        };
        return resultObservable;
    };
    TreeSubscriptionService.prototype.getActiveSubscriptions = function () {
        return Promise.resolve(Array.from(this.subscriptions.values()).filter(function (sub) { return sub.isActive; }).length);
    };
    TreeSubscriptionService.prototype.cleanupInactiveSubscriptions = function () {
        var _this = this;
        var now = Date.now();
        var maxInactiveTime = 5 * 60 * 1000; // 5 minutes
        var toDelete = [];
        for (var _i = 0, _a = Array.from(this.subscriptions.entries()); _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], subscription = _b[1];
            if (!subscription.isActive || now - subscription.lastActivity > maxInactiveTime) {
                subscription.subject.complete();
                toDelete.push(id);
            }
        }
        toDelete.map(function (id) { return _this.subscriptions.delete(id); });
        return Promise.resolve();
    };
    // Private helper methods
    TreeSubscriptionService.prototype.generateSubscriptionId = function () {
        return "sub_".concat(++this.subscriptionCounter, "_").concat(Date.now());
    };
    TreeSubscriptionService.prototype.updateSubscriptionActivity = function (subscriptionId) {
        var subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            subscription.lastActivity = Date.now();
        }
    };
    TreeSubscriptionService.prototype.deactivateSubscription = function (subscriptionId) {
        var subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            subscription.isActive = false;
        }
    };
    TreeSubscriptionService.prototype.isEventRelevantForNodeObservation = function (event, targetNodeId, filter) {
        // Must be about the specific node we're observing
        if (event.nodeId !== targetNodeId) {
            return false;
        }
        // Apply filter if provided
        if ((filter === null || filter === void 0 ? void 0 : filter.nodeTypes) && event.node) {
            if (!filter.nodeTypes.includes(event.node.nodeType)) {
                return false;
            }
        }
        return true;
    };
    TreeSubscriptionService.prototype.isEventRelevantForChildNodesObservation = function (event, parentId, filter) {
        // Check if this event is about a childNode of our target parentNode
        var isDirectChild = event.parentId === parentId || event.previousParentId === parentId;
        // For node deletions, we also need to check if the deleted node was a childNode
        if (event.type === 'node-deleted' && event.previousNode) {
            var wasChildNode = event.previousNode.parentId === parentId;
            if (!isDirectChild && !wasChildNode) {
                return false;
            }
        }
        else if (!isDirectChild) {
            return false;
        }
        // Apply filter if provided
        if (filter === null || filter === void 0 ? void 0 : filter.nodeTypes) {
            var nodeToCheck = event.node || event.previousNode;
            if (nodeToCheck && !filter.nodeTypes.includes(nodeToCheck.nodeType)) {
                return false;
            }
        }
        return true;
    };
    TreeSubscriptionService.prototype.isEventRelevantForSubtreeObservation = function (event, rootNodeId, maxDepthOrOptions, filter) {
        var _a;
        // Handle overloaded parameters
        var maxDepth;
        var options;
        var legacyFilter;
        if (typeof maxDepthOrOptions === 'number') {
            // Legacy call: (event, rootNodeId, maxDepth, filter)
            maxDepth = maxDepthOrOptions;
            legacyFilter = filter;
        }
        else {
            // New API call: (event, rootNodeId, options)
            options = maxDepthOrOptions;
        }
        // Basic subtree check
        var isInSubtree;
        if (event.node && maxDepth !== undefined) {
            // Legacy path with node data and maxDepth
            isInSubtree = this.isDescendantNodeByNode(event.node, rootNodeId, maxDepth);
        }
        else {
            // New path or fallback
            isInSubtree = this.isDescendantNode(event.nodeId, rootNodeId);
        }
        if (!isInSubtree && event.nodeId !== rootNodeId) {
            return false;
        }
        // Apply legacy filter
        if ((legacyFilter === null || legacyFilter === void 0 ? void 0 : legacyFilter.nodeTypes) && event.node) {
            if (!legacyFilter.nodeTypes.includes(event.node.nodeType)) {
                return false;
            }
        }
        // Apply new API filters
        if ((options === null || options === void 0 ? void 0 : options.excludeTypes) && ((_a = event.node) === null || _a === void 0 ? void 0 : _a.nodeType)) {
            return !options.excludeTypes.includes(event.node.nodeType);
        }
        // Apply depth filter for new API
        if ((options === null || options === void 0 ? void 0 : options.depth) !== undefined) {
            // Check exact depth match
            if (!event.node || event.node.depth !== options.depth) {
                return false;
            }
        }
        // Apply maxDepth filter
        if ((options === null || options === void 0 ? void 0 : options.maxDepth) !== undefined) {
            if (!event.node || event.node.depth > options.maxDepth) {
                return false;
            }
        }
        // Apply minDepth filter
        if ((options === null || options === void 0 ? void 0 : options.minDepth) !== undefined) {
            if (!event.node || event.node.depth < options.minDepth) {
                return false;
            }
        }
        return true;
    };
    TreeSubscriptionService.prototype.isEventRelevantForWorkingCopies = function (event, targetNodeId) {
        // If targetNodeId is specified, only events about that node
        if (targetNodeId && event.nodeId !== targetNodeId) {
            return false;
        }
        // Working copy events would typically have specific indicators
        // For this implementation, we'll assume all events could be relevant
        return true;
    };
    TreeSubscriptionService.prototype.transformEventForSubscription = function (event) {
        // Could add subscription-specific transformations here
        // For now, just return the event as-is
        return event;
    };
    TreeSubscriptionService.prototype.createInitialNodeEvent = function (nodeId) {
        // Get the current state of the node
        var node = this.getNodeFromDB(nodeId);
        return {
            type: 'node-updated',
            nodeId: nodeId,
            node: node,
            timestamp: Date.now(),
        };
    };
    TreeSubscriptionService.prototype.createInitialChildNodesEvent = function (parentId, filter) {
        // Get current childNodes
        var childNodes = this.getChildNodesFromDB(parentId, filter);
        return {
            type: 'children-changed',
            nodeId: parentId,
            affectedChildren: childNodes.map(function (childNode) { return childNode.id; }),
            timestamp: Date.now(),
        };
    };
    TreeSubscriptionService.prototype.createInitialSubtreeEvent = function (rootId, filter) {
        // For initial subtree event, we could return a snapshot
        // For now, return a simple childNodes-changed event for the root
        return this.createInitialChildNodesEvent(rootId, filter);
    };
    TreeSubscriptionService.prototype.getNodeFromDB = function (nodeId) {
        // For testing with Dexie in Node environment, we need to synchronously access the data
        // This is a simplified approach for testing - in real implementation this should be async
        try {
            // Access the underlying Dexie table data structure
            var table = this.coreDB.nodes;
            if (table && '_Items' in table) {
                // In fake-indexeddb, the data is stored in _Items
                var items = table._Items;
                if (items instanceof Map) {
                    return items.get(nodeId);
                }
                // Try alternative access patterns for fake-indexeddb
                for (var _i = 0, _a = Object.values(items || {}); _i < _a.length; _i++) {
                    var item = _a[_i];
                    if ((item === null || item === void 0 ? void 0 : item.id) === nodeId) {
                        return item;
                    }
                }
            }
        }
        catch (error) {
            // If we can't access the data synchronously, return undefined
            console.warn('Could not access node data synchronously:', error);
        }
        return undefined;
    };
    TreeSubscriptionService.prototype.getChildNodesFromDB = function (parentId, filter) {
        // Access the mock database directly for testing
        if (this.coreDB && 'treeNodes' in this.coreDB && this.coreDB.treeNodes instanceof Map) {
            var allNodes = Array.from(this.coreDB.treeNodes.values());
            var childNodes = allNodes.filter(function (node) { return node.parentId === parentId; });
            // Apply filter
            if (filter === null || filter === void 0 ? void 0 : filter.nodeTypes) {
                childNodes = childNodes.filter(function (node) {
                    return filter.nodeTypes.includes(node.nodeType);
                });
            }
            return childNodes;
        }
        return [];
    };
    TreeSubscriptionService.prototype.setupPeriodicSubscriptionCleanup = function () {
        var _this = this;
        // Run cleanup every 5 minutes
        setInterval(function () {
            _this.cleanupInactiveSubscriptions();
        }, 5 * 60 * 1000);
    };
    TreeSubscriptionService.prototype.isDescendantNodeByNode = function (node, ancestorNodeId, maxDepth) {
        // Handle the case where node is the ancestor itself
        if (node.id === ancestorNodeId) {
            return true;
        }
        // Direct childNode check (depth 1)
        if (node.parentId === ancestorNodeId) {
            return maxDepth === undefined || maxDepth >= 1;
        }
        // For deeper hierarchy, we would need to traverse up the tree
        // For now, we'll use the database lookup method as fallback
        return this.isDescendantNode(node.id, ancestorNodeId, maxDepth);
    };
    TreeSubscriptionService.prototype.isDescendantNode = function (nodeId, ancestorNodeId, maxDepth) {
        // Handle the case where nodeId is the ancestor itself
        if (nodeId === ancestorNodeId) {
            return true;
        }
        // Calculate the actual depth from ancestor to node
        var depthFromAncestor = this.calculateDepth(nodeId, ancestorNodeId);
        if (depthFromAncestor === -1) {
            return false; // Not a descendant
        }
        // If maxDepth is specified, check if the node is within the depth limit
        if (maxDepth !== undefined && depthFromAncestor > maxDepth) {
            return false;
        }
        return true;
    };
    TreeSubscriptionService.prototype.getInitialSubtreeV1 = function (pageNodeId) {
        console.log('getInitialSubtreeV1', pageNodeId);
        return Promise.resolve({
            treeId: '',
            rootNodeId: '',
            pageNodeId: pageNodeId,
            changes: {},
            version: 0,
        });
    };
    TreeSubscriptionService.prototype.toggleNodeExpanded = function (pageNodeId) {
        console.log('toggleNodeExpanded (V1 compat)', pageNodeId);
        return Promise.resolve();
    };
    TreeSubscriptionService.prototype.listChildNodes = function (parentId, doExpandNode) {
        console.log('listChildNodes (V1 compat)', parentId, doExpandNode);
        return Promise.resolve({
            treeId: '',
            rootNodeId: '',
            pageNodeId: parentId,
            changes: {},
            version: 0,
        });
    };
    TreeSubscriptionService.prototype.getNodeAncestors = function (pageNodeId) {
        console.log('getNodeAncestors (V1 compat)', pageNodeId);
        return Promise.resolve([]);
    };
    TreeSubscriptionService.prototype.searchByNameWithDepth = function (rootNodeId, query, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var queryService, searchResults, maxResults, limitedResults, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        queryService = new TreeQueryService_1.TreeQueryService(this.coreDB);
                        return [4 /*yield*/, queryService.searchNodes({
                                query: query,
                                rootNodeId: rootNodeId,
                                caseSensitive: false,
                                searchInDescription: false,
                            })];
                    case 1:
                        searchResults = _a.sent();
                        maxResults = opts.maxResults || opts.maxVisited || 100;
                        limitedResults = searchResults.slice(0, maxResults);
                        return [2 /*return*/, limitedResults];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Search failed:', error_1);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Enhanced search API with multiple matching modes
     *
     * @param rootNodeId - Root node to search under
     * @param query - Search query string
     * @param opts - Search options including match mode and limits
     * @returns Promise<TreeNode[]> - Array of matching nodes
     */
    TreeSubscriptionService.prototype.searchByNameWithMatchMode = function (rootNodeId, query, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var queryService, searchPattern, searchResults, maxResults, limitedResults, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        queryService = new TreeQueryService_1.TreeQueryService(this.coreDB);
                        searchPattern = void 0;
                        // Build search pattern based on match mode
                        switch (opts.matchMode) {
                            case 'exact':
                                // Exact match - use regex with start/end anchors
                                searchPattern = "^".concat(this.escapeRegexChars(query), "$");
                                break;
                            case 'prefix':
                                // Prefix match - starts with query
                                searchPattern = "^".concat(this.escapeRegexChars(query));
                                break;
                            case 'suffix':
                                // Suffix match - ends with query
                                searchPattern = "".concat(this.escapeRegexChars(query), "$");
                                break;
                            case 'partial':
                            default:
                                // Partial match - contains query (default behavior)
                                searchPattern = query;
                                break;
                        }
                        return [4 /*yield*/, queryService.searchNodes({
                                query: searchPattern,
                                rootNodeId: rootNodeId,
                                caseSensitive: opts.caseSensitive || false,
                                searchInDescription: opts.searchInDescription || false,
                            })];
                    case 1:
                        searchResults = _a.sent();
                        maxResults = opts.maxResults || 100;
                        limitedResults = searchResults.slice(0, maxResults);
                        return [2 /*return*/, limitedResults];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Enhanced search failed:', error_2);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Escape special regex characters in search query
     */
    TreeSubscriptionService.prototype.escapeRegexChars = function (str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    TreeSubscriptionService.prototype.calculateDepth = function (nodeId, ancestorId) {
        // Self is depth 0
        if (nodeId === ancestorId) {
            return 0;
        }
        var node = this.getNodeFromDB(nodeId);
        if (!node) {
            return -1;
        }
        // Check if this is a direct childNode (depth 1)
        if (node.parentId === ancestorId) {
            return 1;
        }
        // Optimized ancestor traversal with depth limit
        var MAX_DEPTH = 50; // Prevent infinite loops and improve performance
        var currentNodeId = node.parentId;
        var depth = 1;
        var visited = new Set([nodeId]);
        while (currentNodeId && depth < MAX_DEPTH) {
            // Check for circular references
            if (visited.has(currentNodeId)) {
                break;
            }
            visited.add(currentNodeId);
            // Found the ancestor
            if (currentNodeId === ancestorId) {
                return depth;
            }
            var currentNode = this.getNodeFromDB(currentNodeId);
            if (!currentNode || !currentNode.parentId) {
                break;
            }
            currentNodeId = currentNode.parentId;
            depth++;
        }
        return -1; // Not a descendant or exceeded max depth
    };
    /**
     * Remove all active subscriptions
     *
     * @returns Total number of subscriptions that were removed
     */
    TreeSubscriptionService.prototype.unsubscribeAll = function () {
        var count = this.subscriptions.size;
        // Complete all subjects
        for (var _i = 0, _a = Array.from(this.subscriptions.values()); _i < _a.length; _i++) {
            var subscription = _a[_i];
            subscription.subject.complete();
        }
        // Clear all subscriptions
        this.subscriptions.clear();
        return Promise.resolve(count);
    };
    // ==================
    // TreeSubscriptionAPI Implementation
    // ==================
    /**
     * Subscribe to changes for a specific node (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.subscribeNode = function (nodeId, callback, options) {
        return __awaiter(this, void 0, void 0, function () {
            var subscriptionId, stream, subscription, subscriptionInfo, node, initialEvent, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subscriptionId = this.generateSubscriptionId();
                        stream = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForNodeObservation(event, nodeId); }), (0, rxjs_1.map)(function (event) { return _this.convertToTreeNodeEvent(event); }));
                        subscription = stream.subscribe(callback);
                        subscriptionInfo = {
                            id: subscriptionId,
                            type: 'node',
                            nodeId: nodeId,
                            callback: callback,
                            options: options,
                            isActive: true,
                            lastActivity: Date.now(),
                            createdAt: Date.now(),
                            // Store the RxJS subscription for cleanup
                            subscription: subscription
                        };
                        this.subscriptions.set(subscriptionId, subscriptionInfo);
                        if (!(options === null || options === void 0 ? void 0 : options.includeMetadata)) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getNodeFromDB(nodeId)];
                    case 2:
                        node = _a.sent();
                        if (node) {
                            initialEvent = this.createTreeNodeEvent('updated', node);
                            callback(initialEvent);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.warn("Failed to get initial value for node ".concat(nodeId, ":"), error_3);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, subscriptionId];
                }
            });
        });
    };
    /**
     * Subscribe to changes for an entire subtree (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.subscribeSubtree = function (rootNodeId, callback, options) {
        return __awaiter(this, void 0, void 0, function () {
            var subscriptionId, subscriptionInfo, stream, subscription;
            var _this = this;
            return __generator(this, function (_a) {
                subscriptionId = this.generateSubscriptionId();
                subscriptionInfo = {
                    id: subscriptionId,
                    type: 'subtree',
                    nodeId: rootNodeId,
                    callback: callback,
                    options: options,
                    isActive: true,
                    lastActivity: Date.now(),
                    createdAt: Date.now()
                };
                this.subscriptions.set(subscriptionId, subscriptionInfo);
                stream = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForSubtreeObservation(event, rootNodeId, options); }), (0, rxjs_1.map)(function (event) { return _this.convertToTreeNodeEvent(event); }));
                subscription = stream.subscribe(callback);
                // Store the subscription for cleanup
                subscriptionInfo.subscription = subscription;
                return [2 /*return*/, subscriptionId];
            });
        });
    };
    /**
     * Subscribe to all changes within a specific tree (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.subscribeTree = function (treeId, callback, options) {
        return __awaiter(this, void 0, void 0, function () {
            var subscriptionId, subscriptionInfo, stream, subscription;
            var _this = this;
            return __generator(this, function (_a) {
                subscriptionId = this.generateSubscriptionId();
                subscriptionInfo = {
                    id: subscriptionId,
                    type: 'tree',
                    treeId: treeId,
                    callback: callback,
                    options: options,
                    isActive: true,
                    lastActivity: Date.now(),
                    createdAt: Date.now()
                };
                this.subscriptions.set(subscriptionId, subscriptionInfo);
                stream = this.globalChangeSubject.pipe((0, rxjs_1.filter)(function (event) { return _this.isEventRelevantForTreeObservation(event, treeId); }), (0, rxjs_1.map)(function (event) { return _this.convertToTreeNodeEvent(event); }));
                subscription = stream.subscribe(callback);
                // Store the subscription for cleanup
                subscriptionInfo.subscription = subscription;
                return [2 /*return*/, subscriptionId];
            });
        });
    };
    /**
     * Remove a specific subscription (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.unsubscribe = function (subscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                subscription = this.subscriptions.get(subscriptionId);
                if (subscription) {
                    subscription.isActive = false;
                    // Clean up RxJS subscription if present
                    if (subscription.subscription) {
                        subscription.subscription.unsubscribe();
                    }
                    // Clean up subject if present (for backward compatibility)
                    if (subscription.subject) {
                        subscription.subject.complete();
                    }
                    this.subscriptions.delete(subscriptionId);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Remove all subscriptions for a specific node (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.unsubscribeNode = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            var count, toRemove, _i, _a, _b, id, subscription, _c, toRemove_1, id;
            return __generator(this, function (_d) {
                count = 0;
                toRemove = [];
                for (_i = 0, _a = Array.from(this.subscriptions.entries()); _i < _a.length; _i++) {
                    _b = _a[_i], id = _b[0], subscription = _b[1];
                    if (subscription.nodeId === nodeId) {
                        subscription.isActive = false;
                        // Clean up RxJS subscription if present
                        if (subscription.subscription) {
                            subscription.subscription.unsubscribe();
                        }
                        // Clean up subject if present (for backward compatibility)
                        if (subscription.subject) {
                            subscription.subject.complete();
                        }
                        toRemove.push(id);
                        count++;
                    }
                }
                for (_c = 0, toRemove_1 = toRemove; _c < toRemove_1.length; _c++) {
                    id = toRemove_1[_c];
                    this.subscriptions.delete(id);
                }
                return [2 /*return*/, count];
            });
        });
    };
    /**
     * Remove all subscriptions for a specific tree (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.unsubscribeTree = function (treeId) {
        return __awaiter(this, void 0, void 0, function () {
            var count, toRemove, _i, _a, _b, id, subscription, _c, toRemove_2, id;
            return __generator(this, function (_d) {
                count = 0;
                toRemove = [];
                for (_i = 0, _a = Array.from(this.subscriptions.entries()); _i < _a.length; _i++) {
                    _b = _a[_i], id = _b[0], subscription = _b[1];
                    if (subscription.treeId === treeId) {
                        subscription.isActive = false;
                        toRemove.push(id);
                        count++;
                    }
                }
                for (_c = 0, toRemove_2 = toRemove; _c < toRemove_2.length; _c++) {
                    id = toRemove_2[_c];
                    this.subscriptions.delete(id);
                }
                return [2 /*return*/, count];
            });
        });
    };
    /**
     * Get list of active subscription identifiers (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.listActiveSubscriptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.subscriptions.keys()).filter(function (id) { var _a; return (_a = _this.subscriptions.get(id)) === null || _a === void 0 ? void 0 : _a.isActive; })];
            });
        });
    };
    /**
     * Check if a specific subscription is still active (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.isSubscriptionActive = function (subscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                subscription = this.subscriptions.get(subscriptionId);
                return [2 /*return*/, subscription ? subscription.isActive : false];
            });
        });
    };
    /**
     * Get subscription statistics (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.getSubscriptionStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var activeSubscriptions;
            return __generator(this, function (_a) {
                activeSubscriptions = Array.from(this.subscriptions.values()).filter(function (s) { return s.isActive; });
                return [2 /*return*/, {
                        totalActive: activeSubscriptions.length,
                        nodeSubscriptions: activeSubscriptions.filter(function (s) { return s.type === 'node'; }).length,
                        subtreeSubscriptions: activeSubscriptions.filter(function (s) { return s.type === 'subtree'; }).length,
                        treeSubscriptions: activeSubscriptions.filter(function (s) { return s.type === 'tree'; }).length,
                        eventsProcessedToday: this.eventsProcessedToday,
                        averageEventLatency: this.eventCount > 0 ? this.totalLatency / this.eventCount : 0
                    }];
            });
        });
    };
    /**
     * Get recent events for a specific node (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.getRecentEvents = function (nodeId, limit) {
        if (limit === void 0) { limit = 50; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.eventHistory
                        .filter(function (event) { return event.nodeId === nodeId; })
                        .slice(-limit)
                        .reverse()];
            });
        });
    };
    /**
     * Get event history for a time range (TreeSubscriptionAPI)
     */
    TreeSubscriptionService.prototype.getEventHistory = function (startTime, endTime, nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.eventHistory.filter(function (event) {
                        var inTimeRange = event.timestamp >= startTime && event.timestamp <= endTime;
                        var nodeMatch = !nodeId || event.nodeId === nodeId;
                        return inTimeRange && nodeMatch;
                    })];
            });
        });
    };
    // ==================
    // Helper Methods
    // ==================
    /**
     * Convert TreeChangeEvent to TreeNodeEvent
     */
    TreeSubscriptionService.prototype.convertToTreeNodeEvent = function (changeEvent) {
        var _a, _b;
        var nodeEvent = {
            nodeId: changeEvent.nodeId,
            type: changeEvent.type,
            timestamp: changeEvent.timestamp || Date.now(),
            node: changeEvent.node,
            parentId: (_a = changeEvent.node) === null || _a === void 0 ? void 0 : _a.parentId,
            previousParentNodeId: (_b = changeEvent.previousNode) === null || _b === void 0 ? void 0 : _b.parentId
        };
        // Add to event history
        this.addToEventHistory(nodeEvent);
        return nodeEvent;
    };
    /**
     * Create a TreeNodeEvent from a node and event type
     */
    TreeSubscriptionService.prototype.createTreeNodeEvent = function (type, node) {
        var event = {
            nodeId: node.id,
            type: type,
            timestamp: Date.now(),
            node: node,
            parentId: node.parentId
        };
        this.addToEventHistory(event);
        return event;
    };
    /**
     * Add event to history with size management
     */
    TreeSubscriptionService.prototype.addToEventHistory = function (event) {
        this.eventHistory.push(event);
        this.eventsProcessedToday++;
        // Maintain max history size
        if (this.eventHistory.length > this.maxEventHistory) {
            this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
        }
    };
    /**
     * Check if event is relevant for tree observation
     */
    TreeSubscriptionService.prototype.isEventRelevantForTreeObservation = function (event, treeId) {
        // TreeChangeEventにはtreeIdがないため、nodeIdからTreeIdを取得する必要がある
        // 現在の実装では、全てのイベントを関連性があるとみなす
        // TODO: nodeIdからTreeIdを取得してtreeIdと比較する実装を追加
        return true;
    };
    return TreeSubscriptionService;
}());
exports.TreeSubscriptionService = TreeSubscriptionService;

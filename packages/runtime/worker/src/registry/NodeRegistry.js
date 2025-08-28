"use strict";
/**
 * @file NodeRegistry.ts
 * @description Extended NodeTypeRegistry with PluginDefinition support
 * Singleton pattern implementation for centralized plugin management
 * References: docs/7-aop-architecture.md, ../eria-cartograph/app0/src/shared/services/ResourceDefinitionRegistry.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRegistry = void 0;
var workerLogger_1 = require("../utils/workerLogger");
/**
 * Unified NodeTypeRegistry with plugin support
 * Complete plugin registry implementation
 */
var NodeRegistry = /** @class */ (function () {
    // private nodeTypeConfigs: Map<TreeNodeType, NodeTypeConfig> = new Map();
    /**
     * Private constructor for singleton pattern
     */
    function NodeRegistry() {
        this.pluginDefinitions = new Map();
        this.entityHandlers = new Map();
        this.routingActions = new Map();
        // No parent constructor to call
    }
    /**
     * Get singleton instance
     */
    NodeRegistry.getInstance = function () {
        if (!NodeRegistry.instance) {
            NodeRegistry.instance = new NodeRegistry();
        }
        return NodeRegistry.instance;
    };
    /**
     * Reset singleton instance (useful for testing)
     */
    NodeRegistry.resetInstance = function () {
        NodeRegistry.instance = null;
    };
    /**
     * Register a unified plugin definition
     */
    NodeRegistry.prototype.registerPlugin = function (definition) {
        var _a, _b, _c;
        var nodeType = definition.nodeType;
        // Check for duplicate registration
        if (this.pluginDefinitions.has(nodeType)) {
            (0, workerLogger_1.workerWarn)("Plugin type ".concat(nodeType, " is already registered. Skipping..."));
            return; // Continue processing (warning level)
        }
        // Validate dependencies
        if ((_a = definition.meta) === null || _a === void 0 ? void 0 : _a.dependencies) {
            for (var _i = 0, _d = definition.meta.dependencies; _i < _d.length; _i++) {
                var dep = _d[_i];
                if (!this.pluginDefinitions.has(dep)) {
                    // Error level - should rollback
                    throw new Error("Missing dependency: ".concat(dep, " for plugin ").concat(nodeType));
                }
            }
        }
        // Register the plugin definition
        this.pluginDefinitions.set(nodeType, definition);
        // Register entity handler
        if (definition.entityHandler) {
            this.entityHandlers.set(nodeType, definition.entityHandler);
        }
        // Register routing actions
        if ((_b = definition.routing) === null || _b === void 0 ? void 0 : _b.actions) {
            var actions = new Map();
            for (var _e = 0, _f = Object.entries(definition.routing.actions); _e < _f.length; _e++) {
                var _g = _f[_e], actionName = _g[0], action = _g[1];
                actions.set(actionName, action);
            }
            this.routingActions.set(nodeType, actions);
        }
        // Store definition in pluginDefinitions map
        // (No base registry to store in since we don't extend BaseNodeTypeRegistry)
        // Log successful registration in development
        if (process.env.NODE_ENV === 'development') {
            (0, workerLogger_1.workerLog)("Plugin registered: ".concat(nodeType, " (").concat(definition.name, ") v").concat((_c = definition.meta) === null || _c === void 0 ? void 0 : _c.version));
        }
    };
    /**
     * Generic register method
     */
    NodeRegistry.prototype.register = function (_nodeType, config) {
        if (this.isPluginDefinition(config)) {
            this.registerPlugin(config);
        }
        else {
            throw new Error('NodeRegistry only accepts PluginDefinition');
        }
    };
    /**
     * Get plugin (generic method for interface)
     */
    NodeRegistry.prototype.getPlugin = function (nodeType) {
        return this.getPluginDefinition(nodeType);
    };
    /**
     * Get plugin definition
     */
    NodeRegistry.prototype.getPluginDefinition = function (nodeType) {
        if (!nodeType) {
            throw new Error('nodeType cannot be null or undefined');
        }
        return this.pluginDefinitions.get(nodeType);
    };
    /**
     * Get entity handler for a node type
     */
    NodeRegistry.prototype.getEntityHandler = function (nodeType) {
        if (!nodeType) {
            throw new Error('nodeType cannot be null or undefined');
        }
        return this.entityHandlers.get(nodeType);
    };
    /**
     * Get router action for a specific action name
     */
    NodeRegistry.prototype.getRouterAction = function (nodeType, action) {
        if (!nodeType || !action) {
            throw new Error('nodeType and action cannot be null or undefined');
        }
        var actions = this.routingActions.get(nodeType);
        return actions === null || actions === void 0 ? void 0 : actions.get(action);
    };
    /**
     * Get all available actions for a node type
     */
    NodeRegistry.prototype.getAvailableActions = function (nodeType) {
        if (!nodeType) {
            throw new Error('nodeType cannot be null or undefined');
        }
        var actions = this.routingActions.get(nodeType);
        return actions ? Array.from(actions.keys()) : [];
    };
    /**
     * Find plugins by tag
     */
    NodeRegistry.prototype.findPluginsByTag = function (tag) {
        if (!tag) {
            return [];
        }
        return Array.from(this.pluginDefinitions.values()).filter(function (definition) { var _a, _b, _c; return (_c = (_b = (_a = definition.meta) === null || _a === void 0 ? void 0 : _a.tags) === null || _b === void 0 ? void 0 : _b.includes(tag)) !== null && _c !== void 0 ? _c : false; });
    };
    /**
     * Get plugin dependencies
     */
    NodeRegistry.prototype.getPluginDependencies = function (nodeType) {
        var _a, _b;
        if (!nodeType) {
            throw new Error('nodeType cannot be null or undefined');
        }
        var definition = this.getPluginDefinition(nodeType);
        return (_b = (_a = definition === null || definition === void 0 ? void 0 : definition.meta) === null || _a === void 0 ? void 0 : _a.dependencies) !== null && _b !== void 0 ? _b : [];
    };
    /**
     * Validate plugin dependencies
     */
    NodeRegistry.prototype.validatePluginDependencies = function (nodeType) {
        var dependencies = this.getPluginDependencies(nodeType);
        for (var _i = 0, dependencies_1 = dependencies; _i < dependencies_1.length; _i++) {
            var dep = dependencies_1[_i];
            if (!this.pluginDefinitions.has(dep)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Get all registered plugins
     */
    NodeRegistry.prototype.getAllPlugins = function () {
        return Array.from(this.pluginDefinitions.values());
    };
    /**
     * Get node type config for compatibility
     */
    NodeRegistry.prototype.getNodeTypeConfig = function (nodeType) {
        var _a, _b, _c;
        var definition = this.getPluginDefinition(nodeType);
        if (!definition)
            return undefined;
        return {
            displayName: definition.displayName,
            icon: ((_a = definition.ui) === null || _a === void 0 ? void 0 : _a.iconComponentPath) ? 'custom' : undefined,
            allowedChildren: (_b = definition.validation) === null || _b === void 0 ? void 0 : _b.allowedChildTypes,
            maxChildren: (_c = definition.validation) === null || _c === void 0 ? void 0 : _c.maxChildren,
            canBeDeleted: true,
            canBeRenamed: true,
            canBeMoved: true,
        };
    };
    /**
     * Get all node types for compatibility
     */
    NodeRegistry.prototype.getAllNodeTypes = function () {
        return Array.from(this.pluginDefinitions.keys());
    };
    /**
     * Get all node types (alias for getAllNodeTypes)
     */
    NodeRegistry.prototype.getAll = function () {
        return this.getAllNodeTypes();
    };
    /**
     * Get plugins sorted by their dependencies (topological sort)
     */
    NodeRegistry.prototype.getPluginsInDependencyOrder = function () {
        var _this = this;
        var visited = new Set();
        var result = [];
        var visit = function (nodeType) {
            var _a, _b;
            if (visited.has(nodeType)) {
                return;
            }
            visited.add(nodeType);
            var definition = _this.getPluginDefinition(nodeType);
            if (definition) {
                // Visit dependencies first
                var dependencies = (_b = (_a = definition.meta) === null || _a === void 0 ? void 0 : _a.dependencies) !== null && _b !== void 0 ? _b : [];
                for (var _i = 0, dependencies_2 = dependencies; _i < dependencies_2.length; _i++) {
                    var dep = dependencies_2[_i];
                    visit(dep);
                }
                result.push(definition);
            }
        };
        // Visit all plugins
        for (var _i = 0, _a = this.pluginDefinitions.keys(); _i < _a.length; _i++) {
            var nodeType = _a[_i];
            visit(nodeType);
        }
        return result;
    };
    /**
     * Clear all registrations (useful for testing)
     */
    NodeRegistry.prototype.clear = function () {
        // Clear all internal maps
        this.pluginDefinitions.clear();
        this.entityHandlers.clear();
        this.routingActions.clear();
    };
    /**
     * Validate plugin dependencies
     */
    NodeRegistry.prototype.validateDependencies = function (nodeType) {
        var _a;
        var definition = this.pluginDefinitions.get(nodeType);
        if (!definition || !((_a = definition.meta) === null || _a === void 0 ? void 0 : _a.dependencies)) {
            return true;
        }
        for (var _i = 0, _b = definition.meta.dependencies; _i < _b.length; _i++) {
            var dep = _b[_i];
            if (!this.pluginDefinitions.has(dep)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Unregister a plugin
     */
    NodeRegistry.prototype.unregister = function (nodeType) {
        this.pluginDefinitions.delete(nodeType);
        this.entityHandlers.delete(nodeType);
        this.routingActions.delete(nodeType);
    };
    /**
     * Get a plugin definition (alias for getPluginDefinition)
     */
    NodeRegistry.prototype.get = function (nodeType) {
        return this.getPluginDefinition(nodeType);
    };
    /**
     * Check if a plugin is registered
     */
    NodeRegistry.prototype.has = function (nodeType) {
        return this.pluginDefinitions.has(nodeType);
    };
    /**
     * Type guard to check if config is PluginDefinition
     */
    NodeRegistry.prototype.isPluginDefinition = function (config) {
        return (config &&
            typeof config === 'object' &&
            'nodeType' in config &&
            'entityHandler' in config &&
            'routing' in config &&
            'meta' in config);
    };
    /**
     * Batch register multiple plugins
     */
    NodeRegistry.prototype.registerPluginBatch = function (definitions) {
        // Sort by dependencies first
        var sorted = this.sortByDependencies(definitions);
        // Register in order
        for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
            var definition = sorted_1[_i];
            this.registerPlugin(definition);
        }
    };
    /**
     * Sort plugins by dependencies
     */
    NodeRegistry.prototype.sortByDependencies = function (definitions) {
        var nodeTypeMap = new Map(definitions.map(function (d) { return [d.nodeType, d]; }));
        var visited = new Set();
        var result = [];
        var visit = function (definition) {
            var _a, _b;
            if (visited.has(definition.nodeType)) {
                return;
            }
            visited.add(definition.nodeType);
            // Visit dependencies first
            var dependencies = (_b = (_a = definition.meta) === null || _a === void 0 ? void 0 : _a.dependencies) !== null && _b !== void 0 ? _b : [];
            for (var _i = 0, dependencies_3 = dependencies; _i < dependencies_3.length; _i++) {
                var dep = dependencies_3[_i];
                var depDefinition = nodeTypeMap.get(dep);
                if (depDefinition) {
                    visit(depDefinition);
                }
            }
            result.push(definition);
        };
        // Visit all definitions
        for (var _i = 0, definitions_1 = definitions; _i < definitions_1.length; _i++) {
            var definition = definitions_1[_i];
            visit(definition);
        }
        return result;
    };
    NodeRegistry.instance = null;
    return NodeRegistry;
}());
exports.NodeRegistry = NodeRegistry;

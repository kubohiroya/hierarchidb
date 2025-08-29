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
exports.PluginAPIRegistry = void 0;
/**
 * Central registry for plugin API extensions
 *
 * Manages registration, discovery, and invocation of plugin-specific API methods.
 * Provides type-safe method calls and plugin capability queries.
 *
 * @example
 * ```typescript
 * const registry = new PluginAPIRegistry();
 *
 * // Register a plugin
 * registry.register(mapAPI);
 *
 * // Check if method exists
 * if (registry.hasMethod('map', 'getMapBounds')) {
 *   const bounds = await registry.invokeMethod('map', 'getMapBounds', nodeId);
 * }
 * ```
 */
/**
 * @deprecated Use PluginExtensionRegistry instead
 */
var PluginAPIRegistry = /** @class */ (function () {
    function PluginAPIRegistry() {
        /** Internal storage for registered plugin extensions */
        this.extensions = new Map();
    }
    /**
     * Register a plugin API extension
     *
     * @template T - Plugin methods type
     * @param extension - Plugin API to register
     *
     * @example
     * ```typescript
     * registry.register({
     *   nodeType: 'spreadsheet-plugin',
     *   methods: {
     *     getCellValue: async (nodeId, cell) => { ... }
     *   }
     * });
     * ```
     *
     * @remarks
     * Overwrites any existing plugin for the same nodeType
     */
    PluginAPIRegistry.prototype.register = function (extension) {
        this.extensions.set(extension.nodeType, extension);
    };
    /**
     * Unregister a plugin API extension
     *
     * @param nodeType - Node type to unregister
     *
     * @example
     * ```typescript
     * registry.unregister('spreadsheet-plugin');
     * ```
     */
    PluginAPIRegistry.prototype.unregister = function (nodeType) {
        this.extensions.delete(nodeType);
    };
    /**
     * Get a registered plugin API extension
     *
     * @template T - Expected plugin methods type
     * @param nodeType - Node type to retrieve extension for
     * @returns Plugin API if registered, undefined otherwise
     *
     * @example
     * ```typescript
     * const mapExtension = registry.getExtension<MapPluginMethods>('map');
     * if (mapExtension) {
     *   console.log('Map plugin is available');
     * }
     * ```
     */
    PluginAPIRegistry.prototype.getExtension = function (nodeType) {
        return this.extensions.get(nodeType);
    };
    /**
     * Invoke a plugin method with type safety
     *
     * @template TMethods - Plugin methods type
     * @template TMethod - Specific method name
     * @template TArgs - Method arguments type
     * @template TReturn - Method return type
     *
     * @param nodeType - Node type of the plugin
     * @param methodName - Name of the method to invoke
     * @param args - Arguments to pass to the method
     * @returns Promise resolving to method result
     *
     * @example
     * ```typescript
     * // Type-safe invocation
     * const bounds = await registry.invokeMethod<MapPluginMethods, 'getMapBounds'>(
     *   'map',
     *   'getMapBounds',
     *   nodeId
     * );
     *
     * // With multiple arguments
     * await registry.invokeMethod(
     *   'spreadsheet-plugin',
     *   'setCellValue',
     *   nodeId,
     *   'A1',
     *   42
     * );
     * ```
     *
     * @throws {Error} If plugin or method not found
     */
    PluginAPIRegistry.prototype.invokeMethod = function (nodeType, methodName) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var extension;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        extension = this.getExtension(nodeType);
                        if (!extension || !extension.methods[methodName]) {
                            throw new Error("Method ".concat(String(methodName), " not found for ").concat(nodeType));
                        }
                        return [4 /*yield*/, (_a = extension.methods)[methodName].apply(_a, args)];
                    case 1: return [2 /*return*/, (_b.sent())];
                }
            });
        });
    };
    /**
     * Check if a plugin has a specific method
     *
     * @param nodeType - Node type of the plugin
     * @param methodName - Method name to check
     * @returns True if method exists in plugin
     *
     * @example
     * ```typescript
     * if (registry.hasMethod('map', 'setMapStyle')) {
     *   // Safe to call setMapStyle
     * }
     * ```
     */
    PluginAPIRegistry.prototype.hasMethod = function (nodeType, methodName) {
        var extension = this.getExtension(nodeType);
        return !!(extension === null || extension === void 0 ? void 0 : extension.methods[methodName]);
    };
    /**
     * Get list of available methods for a plugin
     *
     * @param nodeType - Node type to query
     * @returns Array of method names, empty if plugin not found
     *
     * @example
     * ```typescript
     * const methods = registry.getAvailableMethods('spreadsheet-plugin');
     * console.log('Spreadsheet methods:', methods);
     * // Output: ['getCellValue', 'setCellValue', 'getRange', ...]
     * ```
     */
    PluginAPIRegistry.prototype.getAvailableMethods = function (nodeType) {
        var extension = this.getExtension(nodeType);
        return extension ? Object.keys(extension.methods) : [];
    };
    /**
     * Get all registered plugin extensions
     *
     * @returns Array of all registered plugin APIs
     *
     * @example
     * ```typescript
     * const allPlugins = registry.getAllExtensions();
     * allPlugins.forEach(plugin => {
     *   console.log(`${plugin.nodeType}: ${Object.keys(plugin.methods).length} methods`);
     * });
     * ```
     */
    PluginAPIRegistry.prototype.getAllExtensions = function () {
        return Array.from(this.extensions.values());
    };
    return PluginAPIRegistry;
}());
exports.PluginAPIRegistry = PluginAPIRegistry;

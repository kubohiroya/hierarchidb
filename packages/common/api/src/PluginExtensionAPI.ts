import type { APIMethodArgs, APIMethodReturn, NodeType, WorkerAPIMethod } from '@hierarchidb/common-types';

/**
 * @file PluginAPI.ts
 * @description Plugin-specific API extension system
 *
 * This API allows plugin-loader to define and expose their own custom methods
 * that extend the base Worker API functionality.
 */

/**
 * Plugin API extension interface
 *
 * Defines a plugin's custom API methods that extend the base Worker API.
 * Each plugin can expose type-safe methods specific to its node type.
 *
 * @template TMethods - Record of method name to method implementation
 *
 * @example
 * ```typescript
 * interface MapPluginMethods {
 *   getMapBounds: (nodeId: NodeId) => Promise<Bounds>;
 *   setMapStyle: (nodeId: NodeId, style: MapStyle) => Promise<void>;
 * }
 *
 * const mapAPI: PluginExtensionAPI<MapPluginMethods> = {
 *   nodeType: 'map',
 *   methods: {
 *     getMapBounds: async (nodeId) => { ... },
 *     setMapStyle: async (nodeId, style) => { ... }
 *   }
 * };
 * ```
 */
export interface PluginExtensionAPI<
  TMethods extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>,
> {
  /** Node type this plugin handles */
  readonly nodeType: NodeType;

  /** Collection of custom methods exposed by the plugin */
  readonly methods: TMethods;
}

/**
 * Type-safe method invocation result extractor
 *
 * Extracts the return type of a plugin method for type-safe invocation.
 *
 * @template T - Plugin API instance type
 * @template M - Method name to extract result type for
 *
 * @example
 * ```typescript
 * type BoundsResult = InvokeResult<typeof mapAPI, 'getMapBounds'>;
 * // BoundsResult is inferred as Bounds
 * ```
 */
export type InvokeResult<
  T extends PluginExtensionAPI,
  M extends keyof T['methods'],
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R>
  ? R extends APIMethodReturn
    ? R
    : never
  : never;

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
export class PluginExtensionRegistry {
  /** Internal storage for registered plugin extensions */
  private extensions: Map<NodeType, PluginExtensionAPI<Record<string, WorkerAPIMethod>>> = new Map();

  /**
   * Normalize a node type identifier to the canonical short form.
   * - Strips a trailing "-plugin" suffix for backward compatibility.
   */
  private normalizeNodeType<T extends string>(nodeType: T): T {
    // Accept values like "folder-plugin" and normalize to "folder"
    return (typeof nodeType === 'string' && nodeType.endsWith('-plugin')
      ? (nodeType.slice(0, -8) as T)
      : nodeType) as T;
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
  register<T extends Record<string, WorkerAPIMethod>>(extension: PluginExtensionAPI<T>): void {
    const key = this.normalizeNodeType(extension.nodeType);
    this.extensions.set(key, extension);
  }

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
  unregister(nodeType: NodeType): void {
    const key = this.normalizeNodeType(nodeType);
    this.extensions.delete(key);
  }

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
  getExtension<T extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>>(
    nodeType: NodeType,
  ): PluginExtensionAPI<T> | undefined {
    const key = this.normalizeNodeType(nodeType);
    return this.extensions.get(key) as PluginExtensionAPI<T> | undefined;
  }

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
  async invokeMethod<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods,
    TArgs extends Parameters<TMethods[TMethod]>,
    TReturn extends ReturnType<TMethods[TMethod]>,
  >(nodeType: NodeType, methodName: TMethod, ...args: TArgs): Promise<TReturn> {
    const extension = this.getExtension<TMethods>(nodeType);
    if (!extension || !extension.methods[methodName]) {
      throw new Error(`Method ${String(methodName)} not found for ${nodeType}`);
    }

    return (await (extension.methods[methodName] as WorkerAPIMethod<TArgs>)(...args)) as TReturn;
  }

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
  hasMethod(nodeType: NodeType, methodName: string): boolean {
    const extension = this.getExtension(nodeType);
    return !!extension?.methods[methodName];
  }

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
  getAvailableMethods(nodeType: NodeType): string[] {
    const extension = this.getExtension(nodeType);
    return extension ? Object.keys(extension.methods) : [];
  }

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
  getAllExtensions(): Array<PluginExtensionAPI<Record<string, WorkerAPIMethod>>> {
    return Array.from(this.extensions.values());
  }
}

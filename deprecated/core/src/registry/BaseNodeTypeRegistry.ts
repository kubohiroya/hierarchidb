/**
 * @file BaseNodeTypeRegistry.ts
 * @deprecated This file has been moved to worker and plugin-registry packages.
 * Import from those packages directly instead.
 * @see @hierarchidb/runtime-worker-worker/src/registry/BaseNodeTypeRegistry.ts
 * @see @hierarchidb/runtime-plugin-registry/src/registry/BaseNodeTypeRegistry.ts
 */

/**
 * Abstract base implementation for node type registries
 * Provides common functionality for all registry types
 */
export abstract class BaseNodeTypeRegistry<TValue = unknown> implements INodeTypeRegistry<TValue> {
  /**
   * Internal storage for registered items
   */
  protected registry: Map<NodeType, TValue> = new Map();

  /**
   * Register a node type with its configuration
   * Must be implemented by subclasses
   */
  abstract register(nodeType: NodeType, config: TValue): void;

  /**
   * Unregister a node type
   */
  unregister(nodeType: NodeType): void {
    this.registry.delete(nodeType);
    this.onUnregister(nodeType);
  }

  /**
   * Get configuration for a node type
   */
  get(nodeType: NodeType): TValue | undefined {
    return this.registry.get(nodeType);
  }

  /**
   * Check if a node type is registered
   */
  has(nodeType: NodeType): boolean {
    return this.registry.has(nodeType);
  }

  /**
   * Get all registered node types
   */
  getAll(): NodeType[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    const types = this.getAll();
    this.registry.clear();
    types.map((type) => this.onUnregister(type));
  }

  /**
   * Get the size of the registry
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Iterate over all entries
   */
  forEach(callback: (value: TValue, key: NodeType) => void): void {
    this.registry.forEach(callback);
  }

  /**
   * Get all values
   */
  values(): IterableIterator<TValue> {
    return this.registry.values();
  }

  /**
   * Get all entries
   */
  entries(): IterableIterator<[NodeType, TValue]> {
    return this.registry.entries();
  }

  /**
   * Hook called after successful registration
   * Can be overridden by subclasses
   */
  protected onRegister(_nodeType: NodeType, _config: TValue): void {
    // Override in subclasses if needed
  }

  /**
   * Hook called after unregistration
   * Can be overridden by subclasses
   */
  protected onUnregister(_nodeType: NodeType): void {
    // Override in subclasses if needed
  }

  /**
   * Validate configuration before registration
   * Can be overridden by subclasses
   */
  protected validateConfig(nodeType: NodeType, config: TValue): void {
    if (!nodeType) {
      throw new Error('Node type cannot be null or undefined');
    }
    if (config === null || config === undefined) {
      throw new Error('Configuration cannot be null or undefined');
    }
  }

  /**
   * Log registration in development mode
   */
  protected logRegistration(nodeType: NodeType, action: 'register' | 'unregister'): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Registry] ${action}: ${nodeType}`);
    }
  }
}

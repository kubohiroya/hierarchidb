/**
 * Plugin Dependency Resolver
 *
 * Handles plugin dependency resolution, ordering, and circular dependency detection.
 * Supports both priority-based ordering and dependency graph resolution.
 */

import {
  NodeType,
  PluginMetadata,
  ResolvedPlugin,
  DependencyGraph,
  ResolutionResult,
  DependencyError,
} from '@hierarchidb/common-type';

// Type definitions are now imported from ../types/RegistryTypes

// ResolutionResult type is imported from ../types/RegistryTypes

// DependencyError type is imported from ../types/RegistryTypes

/**
 * Plugin Dependency Resolver Implementation
 */
export class PluginDependencyResolver {
  private plugins: Map<NodeType, PluginMetadata> = new Map();
  private resolved: Map<NodeType, ResolvedPlugin> = new Map();

  /**
   * Register a plugin with its metadata
   */
  registerPlugin(metadata: PluginMetadata): void {
    this.plugins.set(metadata.nodeType, metadata);
    this.resolved.clear(); // Clear resolved cache
  }

  /**
   * Register multiple plugins at once
   */
  registerPlugins(plugins: PluginMetadata[]): void {
    for (const plugin of plugins) {
      this.plugins.set(plugin.nodeType, plugin);
    }
    this.resolved.clear();
  }

  /**
   * Resolve plugin dependencies and determine load order
   */
  resolve(): ResolutionResult {
    const errors: DependencyError[] = [];
    const warnings: string[] = [];

    // Build dependency graph
    const graph = this.buildDependencyGraph();

    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies(graph);
    if (circularDeps.length > 0) {
      errors.push(
        ...circularDeps.map((cycle) => ({
          type: 'circular' as const,
          message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`,
          nodeTypes: cycle,
          cycle,
        }))
      );
    }

    // Check for missing dependencies
    const missingDeps = this.detectMissingDependencies(graph);
    if (missingDeps.length > 0) {
      errors.push(...missingDeps);
    }

    // If there are critical errors, return early
    if (errors.length > 0) {
      return {
        success: false,
        resolvedOrder: [],
        errors,
        warnings,
        graph,
      };
    }

    // Perform topological sort with priority consideration
    const resolvedOrder = this.topologicalSort(graph);

    // Apply priority-based ordering within dependency constraints
    const finalOrder = this.applyPriorityOrdering(resolvedOrder, graph);

    return {
      success: true,
      resolvedOrder: finalOrder,
      errors: [],
      warnings,
      graph,
    };
  }

  /**
   * Get resolved plugin in load order
   */
  getResolvedPlugins(): ResolvedPlugin[] {
    if (this.resolved.size === 0) {
      const result = this.resolve();
      if (result.success) {
        result.resolvedOrder.forEach((plugin) => {
          this.resolved.set(plugin.nodeType, plugin);
        });
      }
    }
    return Array.from(this.resolved.values()).sort((a, b) => a.loadOrder - b.loadOrder);
  }

  /**
   * Check if a plugin can be loaded (all dependencies resolved)
   */
  canLoad(nodeType: NodeType): boolean {
    const metadata = this.plugins.get(nodeType);
    if (!metadata) return false;

    const dependencies = this.getAllDependencies(nodeType);
    return dependencies.every((dep) => this.resolved.has(dep));
  }

  /**
   * Get all dependencies for a plugin (including transitive)
   */
  getAllDependencies(nodeType: NodeType): NodeType[] {
    const visited = new Set<NodeType>();
    const dependencies: NodeType[] = [];

    const collect = (current: NodeType) => {
      if (visited.has(current)) return;
      visited.add(current);

      const metadata = this.plugins.get(current);
      if (!metadata) return;

      const directDeps = [
        ...(metadata.dependencies || []),
        ...(metadata.extends ? [metadata.extends] : []),
      ];

      for (const dep of directDeps) {
        if (!dependencies.includes(dep)) {
          dependencies.push(dep);
        }
        collect(dep);
      }
    };

    collect(nodeType);
    return dependencies;
  }

  /**
   * Build dependency graph from registered plugins
   */
  private buildDependencyGraph(): DependencyGraph {
    const nodes = new Map(this.plugins);
    const edges = new Map<NodeType, Set<NodeType>>();
    const reverseEdges = new Map<NodeType, Set<NodeType>>();

    for (const [nodeType, metadata] of this.plugins) {
      const deps = new Set<NodeType>();

      // Add explicit dependencies
      if (metadata.dependencies) {
        metadata.dependencies.forEach((dep) => deps.add(dep));
      }

      // Add inheritance dependency
      if (metadata.extends) {
        deps.add(metadata.extends);
      }

      edges.set(nodeType, deps);

      // Build reverse edges
      for (const dep of deps) {
        if (!reverseEdges.has(dep)) {
          reverseEdges.set(dep, new Set());
        }
        reverseEdges.get(dep)!.add(nodeType);
      }
    }

    // Calculate topological order
    const topologicalOrder = this.calculateTopologicalOrder(nodes, edges);

    return { nodes, edges, reverseEdges, topologicalOrder };
  }

  /**
   * Calculate topological order
   */
  private calculateTopologicalOrder(
    nodes: Map<NodeType, PluginMetadata>,
    edges: Map<NodeType, Set<NodeType>>
  ): NodeType[] {
    const result: NodeType[] = [];
    const visited = new Set<NodeType>();
    const temp = new Set<NodeType>();

    const visit = (node: NodeType) => {
      if (temp.has(node)) return; // Circular dependency, skip
      if (visited.has(node)) return;

      temp.add(node);
      const dependencies = edges.get(node) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }
      temp.delete(node);
      visited.add(node);
      result.push(node);
    };

    for (const node of nodes.keys()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: DependencyGraph): NodeType[][] {
    const visited = new Set<NodeType>();
    const recursionStack = new Set<NodeType>();
    const cycles: NodeType[][] = [];

    const dfs = (node: NodeType, path: NodeType[]) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = graph.edges.get(node) || new Set();
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Detect missing dependencies
   */
  private detectMissingDependencies(graph: DependencyGraph): DependencyError[] {
    const errors: DependencyError[] = [];

    for (const [nodeType, dependencies] of graph.edges) {
      for (const dep of dependencies) {
        if (!graph.nodes.has(dep)) {
          errors.push({
            type: 'missing',
            message: `Plugin '${nodeType}' depends on '${dep}' which is not registered`,
            nodeTypes: [nodeType, dep],
          });
        }
      }
    }

    return errors;
  }

  /**
   * Perform topological sort to determine load order
   */
  private topologicalSort(graph: DependencyGraph): ResolvedPlugin[] {
    const result: ResolvedPlugin[] = [];
    const visited = new Set<NodeType>();
    const temp = new Set<NodeType>();

    const visit = (node: NodeType, path: NodeType[]) => {
      if (temp.has(node)) {
        throw new Error(`Circular dependency detected: ${[...path, node].join(' -> ')}`);
      }

      if (visited.has(node)) return;

      temp.add(node);

      const nodeDependencies = graph.edges.get(node) || new Set();
      for (const dep of nodeDependencies) {
        visit(dep, [...path, node]);
      }

      temp.delete(node);
      visited.add(node);

      const metadata = graph.nodes.get(node)!;
      const dependencies = Array.from(graph.edges.get(node) || new Set()) as NodeType[];
      const dependents = Array.from(graph.reverseEdges.get(node) || new Set()) as NodeType[];

      result.push({
        nodeType: node,
        metadata,
        depth: path.length,
        loadOrder: result.length,
        dependencies,
        dependents,
      });
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        visit(node, []);
      }
    }

    return result;
  }

  /**
   * Apply priority-based ordering within dependency constraints
   */
  private applyPriorityOrdering(
    plugins: ResolvedPlugin[],
    graph: DependencyGraph
  ): ResolvedPlugin[] {
    // Group plugins by dependency level
    const levels = new Map<number, ResolvedPlugin[]>();

    for (const plugin of plugins) {
      const level = this.getDependencyLevel(plugin.nodeType, graph);
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(plugin);
    }

    // Sort each level by priority
    const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
    const result: ResolvedPlugin[] = [];

    for (const level of sortedLevels) {
      const levelPlugins = levels.get(level)!;

      // Sort by priority (higher priority first), then by name for stability
      levelPlugins.sort((a, b) => {
        const priorityA = a.metadata.priority || 0;
        const priorityB = b.metadata.priority || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        return a.metadata.name.localeCompare(b.metadata.name);
      });

      // Update load order
      for (const plugin of levelPlugins) {
        plugin.loadOrder = result.length;
        result.push(plugin);
      }
    }

    return result;
  }

  /**
   * Get dependency level (0 = no dependencies, higher = more dependencies)
   */
  private getDependencyLevel(nodeType: NodeType, graph: DependencyGraph): number {
    const visited = new Set<NodeType>();

    const getLevel = (node: NodeType, currentLevel: number): number => {
      if (visited.has(node)) return currentLevel;
      visited.add(node);

      const dependencies = graph.edges.get(node) || new Set();
      let level = currentLevel;

      for (const dep of dependencies) {
        level = Math.max(level, getLevel(dep, currentLevel + 1));
      }

      return level;
    };

    return getLevel(nodeType, 0);
  }

  /**
   * Generate plugin metadata automatically from available plugins
   */
  generateMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map((plugin) => ({
      nodeType: plugin.nodeType,
      name: plugin.name,
      version: plugin.version || '1.0.0',
      priority: plugin.priority || 100,
      dependencies: plugin.dependencies || [],
      extends: plugin.extends,
      description: plugin.description || `Plugin for ${plugin.name} functionality`,
      category: plugin.category || 'general',
    }));
  }

  /**
   * Export dependency graph for visualization
   */
  exportGraph(): { nodes: any[]; edges: any[] } {
    const graph = this.buildDependencyGraph();

    const nodes = Array.from(graph.nodes.entries()).map(([nodeType, metadata]) => ({
      id: nodeType,
      label: metadata.name,
      priority: metadata.priority || 0,
      category: metadata.category || 'general',
    }));

    const edges: any[] = [];
    for (const [from, dependencies] of graph.edges) {
      for (const to of dependencies) {
        edges.push({
          from,
          to,
          type: this.plugins.get(from)?.extends === to ? 'extends' : 'depends',
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
    this.resolved.clear();
  }
}

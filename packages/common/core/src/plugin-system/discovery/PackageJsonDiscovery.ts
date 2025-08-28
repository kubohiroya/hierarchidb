import { NodeType, PackageJson } from '@hierarchidb/common-type';
import { PluginDiscoveryResult } from '../types/DiscoveryTypes';

/**
 * Plugin discovery system that reads dependencies directly from package.json files
 * Uses package.json dependencies as the source of truth for plugin discovery
 */
export class PackageJsonDiscovery {
  private static readonly NODE_TYPE_PLUGIN_PATTERN = /^@hierarchidb\/node-type-(.+)-plugin$/;
  private packageJsonReader?: (packagePath: string) => PackageJson | Promise<PackageJson>;

  /**
   * Discovers plugins from app's package.json and builds dependency graph
   * @param appPackageJsonPath Path to app's package.json
   */
  async discoverPlugins(appPackageJsonPath: string): Promise<PluginDiscoveryResult> {
    if (!this.packageJsonReader) {
      throw new Error('Package JSON reader not set. Call setPackageJsonReader first.');
    }

    // Read app's package.json
    const appPackageJson = await this.packageJsonReader(appPackageJsonPath);
    
    // Find directly requested plugins
    const requestedPlugins = this.extractPluginsFromDependencies(appPackageJson.dependencies || {});
    
    if (requestedPlugins.length === 0) {
      return {
        requestedPlugins: [],
        allPlugins: [],
        loadOrder: [],
        dependencyGraph: {}
      };
    }

    // Build complete dependency graph
    const dependencyGraph: Record<NodeType, NodeType[]> = {};
    const visited = new Set<NodeType>();
    const toProcess = [...requestedPlugins];
    
    while (toProcess.length > 0) {
      const plugin = toProcess.shift()!;
      
      if (visited.has(plugin)) {
        continue;
      }
      
      visited.add(plugin);
      
      // Read this plugin's package.json
      const pluginPackagePath = this.resolvePluginPackagePath(plugin);
      const pluginPackageJson = await this.packageJsonReader(pluginPackagePath);
      
      // Extract plugin dependencies
      const pluginDeps = this.extractPluginsFromDependencies(pluginPackageJson.dependencies || {});
      dependencyGraph[plugin] = pluginDeps;
      
      // Add dependencies to process queue
      for (const dep of pluginDeps) {
        if (!visited.has(dep)) {
          toProcess.push(dep);
        }
      }
    }

    // Detect circular dependencies
    this.detectCircularDependencies(dependencyGraph);
    
    // Calculate load order using topological sort
    const loadOrder = this.topologicalSort(dependencyGraph);
    
    return {
      requestedPlugins,
      allPlugins: Array.from(visited),
      loadOrder,
      dependencyGraph
    };
  }

  /**
   * Extracts plugin names from dependencies object
   */
  private extractPluginsFromDependencies(dependencies: Record<string, string>): NodeType[] {
    const plugins: NodeType[] = [];
    
    for (const packageName of Object.keys(dependencies)) {
      const pluginName = this.extractPluginName(packageName);
      if (pluginName) {
        plugins.push(pluginName as NodeType);
      }
    }
    
    return plugins;
  }

  /**
   * Extracts plugin name from package name
   * Only matches node-type plugins, not feature plugins
   */
  extractPluginName(packageName: string): string | null {
    const match = packageName.match(PackageJsonDiscovery.NODE_TYPE_PLUGIN_PATTERN);
    return match ? (match[1] ?? null) : null;
  }

  /**
   * Resolves plugin package path for reading its package.json
   */
  private resolvePluginPackagePath(plugin: NodeType): string {
    // In real implementation, this would resolve to actual file path
    // For testing, we return a path that the mock can recognize
    return `node_modules/${this.getPluginPackagePath(plugin)}/package.json`;
  }

  /**
   * Gets the package name for a plugin
   */
  getPluginPackagePath(plugin: NodeType): string {
    return `@hierarchidb/node-type-${plugin}-plugin`;
  }

  /**
   * Detects circular dependencies in the graph
   */
  private detectCircularDependencies(graph: Record<NodeType, NodeType[]>): void {
    const visited = new Set<NodeType>();
    const recursionStack = new Set<NodeType>();
    
    const hasCycle = (node: NodeType): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a back edge (circular dependency)
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of Object.keys(graph) as NodeType[]) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          throw new Error(`Circular dependency detected involving plugin: ${node}`);
        }
      }
    }
  }

  /**
   * Performs topological sort to determine load order
   */
  private topologicalSort(graph: Record<NodeType, NodeType[]>): NodeType[] {
    // Calculate in-degree for each node
    const inDegree = new Map<NodeType, number>();
    const allNodes = new Set<NodeType>();
    
    // Add all nodes and their dependencies to the set
    for (const [node, deps] of Object.entries(graph) as [NodeType, NodeType[]][]) {
      allNodes.add(node);
      if (!inDegree.has(node)) {
        inDegree.set(node, 0);
      }
      
      for (const dep of deps) {
        allNodes.add(dep);
        if (!inDegree.has(dep)) {
          inDegree.set(dep, 0);
        }
      }
    }
    
    // Calculate in-degrees
    for (const [node, deps] of Object.entries(graph) as [NodeType, NodeType[]][]) {
      for (const dep of deps) {
        // Node depends on dep, so dep needs to be loaded before node
        // This means node has an incoming edge from dep
        if (!inDegree.has(dep)) {
          inDegree.set(dep, 0);
        }
        inDegree.set(node, (inDegree.get(node) || 0) + 1);
      }
    }
    
    // Find nodes with no dependencies
    const queue: NodeType[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }
    
    const loadOrder: NodeType[] = [];
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      loadOrder.push(node);
      
      // For each node that depends on the current node
      for (const [dependent, deps] of Object.entries(graph) as [NodeType, NodeType[]][]) {
        if (deps.includes(node)) {
          const newDegree = (inDegree.get(dependent) || 0) - 1;
          inDegree.set(dependent, newDegree);
          
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }
    
    return loadOrder;
  }

  /**
   * Generates dynamic import code for discovered plugins
   */
  generateDynamicImports(loadOrder: NodeType[]): string {
    const imports = loadOrder.map(plugin => 
      `    await import('${this.getPluginPackagePath(plugin)}');`
    ).join('\\n');
    
    return `/**
 * Auto-generated plugin loader
 * Load order: ${loadOrder.join(' -> ')}
 */
export async function loadPlugins(): Promise<void> {
  console.log('Loading plugins in dependency order...');
  
${imports}
  
  console.log('All plugins loaded successfully!');
}

export const PLUGIN_LOAD_ORDER = ${JSON.stringify(loadOrder, null, 2)};`;
  }

  /**
   * Sets the package.json reader function (for testing or custom implementations)
   */
  setPackageJsonReader(reader: (packagePath: string) => PackageJson | Promise<PackageJson>): void {
    this.packageJsonReader = reader;
  }
}
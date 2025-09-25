import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

export class PluginDependencyResolver {
  /**
   * @param definitions
   * @returns NodeType
*/
  resolveLoadOrder(definitions: Map<NodeType, PluginDefinition>): NodeType[] {
    const graph = this.buildDependencyGraph(definitions);
    const visited = new Set<NodeType>();
    const visiting = new Set<NodeType>();
    const loadOrder: NodeType[] = [];

    //  folder-plugin
    const folderNodeType = 'folder' as NodeType;
    if (definitions.has(folderNodeType)) {
      this.visit(folderNodeType, graph, visited, visiting, loadOrder, definitions);
    }

        const sortedNodeTypes = this.sortNodeTypesByPriority(
      Array.from(definitions.keys()).filter(nt => nt !== folderNodeType),
      definitions
    );

    for (const nodeType of sortedNodeTypes) {
      if (!visited.has(nodeType)) {
        this.visit(nodeType, graph, visited, visiting, loadOrder, definitions);
      }
    }

    return loadOrder;
  }

  /**
   * @param definitions
   * @returns
*/
  checkCircularDependencies(definitions: Map<NodeType, PluginDefinition>): string[] {
    const graph = this.buildDependencyGraph(definitions);
    const errors: string[] = [];
    const visited = new Set<NodeType>();
    const visiting = new Set<NodeType>();

    for (const nodeType of definitions.keys()) {
      if (!visited.has(nodeType)) {
        const cycle = this.detectCycle(nodeType, graph, visited, visiting, []);
        if (cycle.length > 0) {
          errors.push(`Circular dependency: ${cycle.join(' -> ')}`);
        }
      }
    }

    return errors;
  }

  /**
   * @param definitions
   * @returns NodeType -> Set<NodeType>
*/
  private buildDependencyGraph(definitions: Map<NodeType, PluginDefinition>): Map<NodeType, Set<NodeType>> {
    const graph = new Map<NodeType, Set<NodeType>>();

    for (const [nodeType, definition] of definitions.entries()) {
      const dependencies = new Set<NodeType>();

      //  extends
      if (definition.extends) {
        const parentNodeType = definition.extends as NodeType;
        if (definitions.has(parentNodeType)) {
          dependencies.add(parentNodeType);
        } else {
          console.warn(`Plugin "${nodeType}" extends non-existent plugin "${parentNodeType}"`);
        }
      }

      //  dependencies
      if (definition.dependencies && Array.isArray(definition.dependencies)) {
        for (const dep of definition.dependencies) {
          const depNodeType = dep as NodeType;
          if (definitions.has(depNodeType)) {
            dependencies.add(depNodeType);
          } else {
            console.warn(`Plugin "${nodeType}" depends on non-existent plugin "${depNodeType}"`);
          }
        }
      }

      graph.set(nodeType, dependencies);
    }

    return graph;
  }

  /**
   * @param nodeType
   * @param graph
   * @param visited
   * @param visiting
   * @param loadOrder
   * @param definitions
*/
  private visit(
    nodeType: NodeType,
    graph: Map<NodeType, Set<NodeType>>,
    visited: Set<NodeType>,
    visiting: Set<NodeType>,
    loadOrder: NodeType[],
    definitions: Map<NodeType, PluginDefinition>
  ): void {
    if (visited.has(nodeType)) {
      return;
    }

    if (visiting.has(nodeType)) {
      throw new Error(`Circular dependency detected at "${nodeType}"`);
    }

    visiting.add(nodeType);

        const dependencies = graph.get(nodeType) || new Set();
    const sortedDeps = this.sortDependenciesByPriority(Array.from(dependencies), definitions);
    
    for (const dep of sortedDeps) {
      this.visit(dep, graph, visited, visiting, loadOrder, definitions);
    }

    loadOrder.push(nodeType);
    visiting.delete(nodeType);
    visited.add(nodeType);
  }

  /**
   * @param deps NodeType
   * @param definitions
   * @returns
*/
  private sortDependenciesByPriority(deps: NodeType[], definitions: Map<NodeType, PluginDefinition>): NodeType[] {
    return deps.sort((a, b) => {
      //  folder-plugin
      if (a === 'folder') return -1;
      if (b === 'folder') return 1;

      const defA = definitions.get(a);
      const defB = definitions.get(b);

      const priorityA = defA?.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = defB?.priority ?? Number.MAX_SAFE_INTEGER;

      return priorityA - priorityB;
    });
  }

  /**
   * NodeType
   * @param nodeTypes NodeType
   * @param definitions
   * @returns
*/
  private sortNodeTypesByPriority(nodeTypes: NodeType[], definitions: Map<NodeType, PluginDefinition>): NodeType[] {
    return nodeTypes.sort((a, b) => {
      const defA = definitions.get(a);
      const defB = definitions.get(b);

      const priorityA = defA?.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = defB?.priority ?? Number.MAX_SAFE_INTEGER;

      return priorityA - priorityB;
    });
  }

  /**
   * @param nodeType
   * @param graph
   * @param visited
   * @param visiting
   * @param path
   * @returns
*/
  private detectCycle(
    nodeType: NodeType,
    graph: Map<NodeType, Set<NodeType>>,
    visited: Set<NodeType>,
    visiting: Set<NodeType>,
    path: NodeType[]
  ): NodeType[] {
    if (visited.has(nodeType)) {
      return [];
    }

    if (visiting.has(nodeType)) {
            const cycleStart = path.indexOf(nodeType);
      return [...path.slice(cycleStart), nodeType];
    }

    visiting.add(nodeType);
    path.push(nodeType);

    const dependencies = graph.get(nodeType) || new Set();
    for (const dep of dependencies) {
      const cycle = this.detectCycle(dep, graph, visited, visiting, [...path]);
      if (cycle.length > 0) {
        return cycle;
      }
    }

    path.pop();
    visiting.delete(nodeType);
    visited.add(nodeType);

    return [];
  }
}


function createTestDefinition(
  nodeType: NodeType,
  options: {
    dependencies?: (NodeType | string)[];
    extends?: NodeType | string;
    priority?: number;
    version?: string;
    description?: string;
  } = {}
): PluginDefinition {
  const label = String(nodeType);
  return {
    nodeType,
    name: `${label}-plugin`,
    displayName: `${label} plugin`,
    description: options.description ?? `${label} plugin fixture used for dependency resolver tests`,
    category: { treeId: '*' },
    database: {
      dbName: `${label}-db`,
      schema: {},
      version: 1,
    },
    dependencies: options.dependencies?.map(dep => String(dep)) ?? [],
    priority: options.priority ?? Number.MAX_SAFE_INTEGER,
    version: options.version ?? '0.0.0-test',
    ...(options.extends ? { extends: String(options.extends) } : {}),
  };
}

//  ESM
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Plugin Dependency Resolver Test ===\n');

  //  1:
  console.log('Test Case 1: Normal Dependencies');
  const definitions1 = new Map<NodeType, PluginDefinition>([
    ['folder' as NodeType, createTestDefinition('folder' as NodeType, { priority: 0 })],
    ['shape' as NodeType, createTestDefinition('shape' as NodeType, { dependencies: ['folder'], priority: 100 })],
    ['project' as NodeType, createTestDefinition('project' as NodeType, { extends: 'folder', priority: 50 })],
    ['basemap' as NodeType, createTestDefinition('basemap' as NodeType, { priority: 10 })],
  ]);

  const resolver = new PluginDependencyResolver();
  const loadOrder1 = resolver.resolveLoadOrder(definitions1);
  console.log('Load order:', loadOrder1);
  console.log('Expected: folder first, then dependencies resolved\n');

  //  2:
  console.log('Test Case 2: Circular Dependencies');
  const definitions2 = new Map<NodeType, PluginDefinition>([
    ['a' as NodeType, createTestDefinition('a' as NodeType, { dependencies: ['b'] })],
    ['b' as NodeType, createTestDefinition('b' as NodeType, { dependencies: ['c'] })],
    ['c' as NodeType, createTestDefinition('c' as NodeType, { dependencies: ['a'] })],
  ]);

  const errors = resolver.checkCircularDependencies(definitions2);
  console.log('Circular dependency errors:', errors);
  console.log('Expected: Circular dependency detected\n');

  //  3:
  console.log('Test Case 3: Complex Dependencies with Priority');
  const definitions3 = new Map<NodeType, PluginDefinition>([
    ['folder' as NodeType, createTestDefinition('folder' as NodeType, { priority: 0 })],
    ['layer' as NodeType, createTestDefinition('layer' as NodeType, { extends: 'folder', priority: 20 })],
    ['shape' as NodeType, createTestDefinition('shape' as NodeType, { extends: 'folder', dependencies: ['basemap'], priority: 100 })],
    ['basemap' as NodeType, createTestDefinition('basemap' as NodeType, { priority: 10 })],
    ['project' as NodeType, createTestDefinition('project' as NodeType, { extends: 'folder', dependencies: ['layer', 'shape'], priority: 200 })],
  ]);

  const loadOrder3 = resolver.resolveLoadOrder(definitions3);
  console.log('Load order:', loadOrder3);
  console.log('Expected: folder, basemap, layer, shape, project\n');

  const errors3 = resolver.checkCircularDependencies(definitions3);
  if (errors3.length === 0) {
    console.log('✓ No circular dependencies detected');
  } else {
    console.log('✗ Unexpected circular dependencies:', errors3);
  }

  //  4:
  console.log('\nTest Case 4: Non-existent Dependencies');
  const definitions4 = new Map<NodeType, PluginDefinition>([
    ['shape' as NodeType, createTestDefinition('shape' as NodeType, { dependencies: ['nonexistent'], extends: 'alsonotexist', priority: 100 })],
  ]);

  console.log('Testing with non-existent dependencies...');
  const loadOrder4 = resolver.resolveLoadOrder(definitions4);
  console.log('Load order (should handle gracefully):', loadOrder4);
  console.log('Expected: Warning messages in console, but process continues');
}

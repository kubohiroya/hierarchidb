import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

export class PluginDependencyResolver {
  /**
   * プラグインの読み込み順序を決定する
   * @param definitions プラグイン定義のマップ
   * @returns 読み込み順序（NodeType配列）
   */
  resolveLoadOrder(definitions: Map<NodeType, PluginDefinition>): NodeType[] {
    const graph = this.buildDependencyGraph(definitions);
    const visited = new Set<NodeType>();
    const visiting = new Set<NodeType>();
    const loadOrder: NodeType[] = [];

    // folder-pluginを最優先で処理
    const folderNodeType = 'folder' as NodeType;
    if (definitions.has(folderNodeType)) {
      this.visit(folderNodeType, graph, visited, visiting, loadOrder, definitions);
    }

    // 残りのプラグインを処理（優先度順）
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
   * 循環依存を事前検出する
   * @param definitions プラグイン定義のマップ
   * @returns エラーメッセージの配列
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
   * 依存関係グラフを構築
   * @param definitions プラグイン定義のマップ
   * @returns 依存関係グラフ（NodeType -> Set<NodeType>）
   */
  private buildDependencyGraph(definitions: Map<NodeType, PluginDefinition>): Map<NodeType, Set<NodeType>> {
    const graph = new Map<NodeType, Set<NodeType>>();

    for (const [nodeType, definition] of definitions.entries()) {
      const dependencies = new Set<NodeType>();

      // extends依存を追加
      if (definition.extends) {
        const parentNodeType = definition.extends as NodeType;
        if (definitions.has(parentNodeType)) {
          dependencies.add(parentNodeType);
        } else {
          console.warn(`Plugin "${nodeType}" extends non-existent plugin "${parentNodeType}"`);
        }
      }

      // dependencies依存を追加
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
   * 深さ優先探索によるトポロジカルソート（訪問処理）
   * @param nodeType 現在のノードタイプ
   * @param graph 依存関係グラフ
   * @param visited 訪問済みセット
   * @param visiting 訪問中セット
   * @param loadOrder 読み込み順序配列
   * @param definitions プラグイン定義（優先度参照用）
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

    // 依存先を優先度順に訪問
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
   * 依存関係を優先度順にソート
   * @param deps 依存関係のNodeType配列
   * @param definitions プラグイン定義
   * @returns ソート済み配列
   */
  private sortDependenciesByPriority(deps: NodeType[], definitions: Map<NodeType, PluginDefinition>): NodeType[] {
    return deps.sort((a, b) => {
      // folder-pluginを最優先
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
   * NodeType配列を優先度順にソート
   * @param nodeTypes NodeType配列
   * @param definitions プラグイン定義
   * @returns ソート済み配列
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
   * 循環依存を検出
   * @param nodeType 現在のノードタイプ
   * @param graph 依存関係グラフ
   * @param visited 訪問済みセット
   * @param visiting 訪問中セット
   * @param path 現在のパス
   * @returns 循環パス（循環がない場合は空配列）
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
      // 循環を検出
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

// 使用例とテストコード
// ESMモジュールとして実行時のチェック
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Plugin Dependency Resolver Test ===\n');

  // テストケース1: 正常系
  console.log('Test Case 1: Normal Dependencies');
  const definitions1 = new Map<NodeType, PluginDefinition>([
    ['folder' as NodeType, {
      nodeType: 'folder' as NodeType,
      pluginLabel: 'Folder Plugin',
      priority: 0
    }],
    ['shape' as NodeType, {
      nodeType: 'shape' as NodeType,
      pluginLabel: 'Shape Plugin',
      dependencies: ['folder'],
      priority: 100
    }],
    ['project' as NodeType, {
      nodeType: 'project' as NodeType,
      pluginLabel: 'Project Plugin',
      extends: 'folder',
      priority: 50
    }],
    ['basemap' as NodeType, {
      nodeType: 'basemap' as NodeType,
      pluginLabel: 'Basemap Plugin',
      priority: 10
    }]
  ]);

  const resolver = new PluginDependencyResolver();
  const loadOrder1 = resolver.resolveLoadOrder(definitions1);
  console.log('Load order:', loadOrder1);
  console.log('Expected: folder first, then dependencies resolved\n');

  // テストケース2: 循環依存の検出
  console.log('Test Case 2: Circular Dependencies');
  const definitions2 = new Map<NodeType, PluginDefinition>([
    ['a' as NodeType, {
      nodeType: 'a' as NodeType,
      pluginLabel: 'Plugin A',
      dependencies: ['b']
    }],
    ['b' as NodeType, {
      nodeType: 'b' as NodeType,
      pluginLabel: 'Plugin B',
      dependencies: ['c']
    }],
    ['c' as NodeType, {
      nodeType: 'c' as NodeType,
      pluginLabel: 'Plugin C',
      dependencies: ['a']
    }]
  ]);

  const errors = resolver.checkCircularDependencies(definitions2);
  console.log('Circular dependency errors:', errors);
  console.log('Expected: Circular dependency detected\n');

  // テストケース3: 複雑な依存関係
  console.log('Test Case 3: Complex Dependencies with Priority');
  const definitions3 = new Map<NodeType, PluginDefinition>([
    ['folder' as NodeType, {
      nodeType: 'folder' as NodeType,
      pluginLabel: 'Folder Plugin',
      priority: 0
    }],
    ['layer' as NodeType, {
      nodeType: 'layer' as NodeType,
      pluginLabel: 'Layer Plugin',
      extends: 'folder',
      priority: 20
    }],
    ['shape' as NodeType, {
      nodeType: 'shape' as NodeType,
      pluginLabel: 'Shape Plugin',
      extends: 'folder',
      dependencies: ['basemap'],
      priority: 100
    }],
    ['basemap' as NodeType, {
      nodeType: 'basemap' as NodeType,
      pluginLabel: 'Basemap Plugin',
      priority: 10
    }],
    ['project' as NodeType, {
      nodeType: 'project' as NodeType,
      pluginLabel: 'Project Plugin',
      extends: 'folder',
      dependencies: ['layer', 'shape'],
      priority: 200
    }]
  ]);

  const loadOrder3 = resolver.resolveLoadOrder(definitions3);
  console.log('Load order:', loadOrder3);
  console.log('Expected: folder, basemap, layer, shape, project\n');

  // エラーチェック
  const errors3 = resolver.checkCircularDependencies(definitions3);
  if (errors3.length === 0) {
    console.log('✓ No circular dependencies detected');
  } else {
    console.log('✗ Unexpected circular dependencies:', errors3);
  }

  // テストケース4: 存在しない依存への対処
  console.log('\nTest Case 4: Non-existent Dependencies');
  const definitions4 = new Map<NodeType, PluginDefinition>([
    ['shape' as NodeType, {
      nodeType: 'shape' as NodeType,
      pluginLabel: 'Shape Plugin',
      dependencies: ['nonexistent'],
      extends: 'alsonotexist',
      priority: 100
    }]
  ]);

  console.log('Testing with non-existent dependencies...');
  const loadOrder4 = resolver.resolveLoadOrder(definitions4);
  console.log('Load order (should handle gracefully):', loadOrder4);
  console.log('Expected: Warning messages in console, but process continues');
}
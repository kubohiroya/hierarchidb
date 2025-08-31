/**
 * 依存関係解決器（Dependency Resolution）
 */

import { NodeType, PluginDefinition } from '@hierarchidb/common-type';

/**
 * 依存関係解決結果
 */
export interface DependencyResolutionResult {
  /** 解決成功したか */
  success: boolean;
  
  /** 初期化順序（トポロジカルソート済み） */
  initializationOrder: NodeType[];
  
  /** 依存関係グラフ */
  dependencyGraph: DependencyGraph;
  
  /** エラー情報 */
  errors: DependencyError[];
  
  /** 警告 */
  warnings: string[];
}

/**
 * 依存関係グラフ
 */
export interface DependencyGraph {
  /** ノード（プラグイン） */
  nodes: Map<NodeType, PluginDefinition>;
  
  /** エッジ（依存関係） from -> to[] */
  edges: Map<NodeType, Set<NodeType>>;
  
  /** 逆エッジ（被依存関係） to -> from[] */
  reverseEdges: Map<NodeType, Set<NodeType>>;
}

/**
 * 依存関係エラー
 */
export interface DependencyError {
  type: 'missing' | 'circular' | 'version-conflict';
  message: string;
  affectedNodes: NodeType[];
}

/**
 * 依存関係解決器
 */
export class DependencyResolver {
  private topologicalSorter: TopologicalSorter;
  private circularDetector: CircularDependencyDetector;
  
  constructor() {
    this.topologicalSorter = new TopologicalSorter();
    this.circularDetector = new CircularDependencyDetector();
  }
  
  /**
   * 依存関係を解決して初期化順序を決定
   */
  resolve(definitions: Map<NodeType, PluginDefinition>): DependencyResolutionResult {
    const errors: DependencyError[] = [];
    const warnings: string[] = [];
    
    // 依存関係グラフを構築
    const graph = this.buildDependencyGraph(definitions);
    
    // 欠落している依存関係をチェック
    const missingDeps = this.checkMissingDependencies(graph);
    if (missingDeps.length > 0) {
      errors.push(...missingDeps);
    }
    
    // 循環依存をチェック
    const circularDeps = this.circularDetector.detect(graph);
    if (circularDeps.length > 0) {
      errors.push(...circularDeps);
    }
    
    // トポロジカルソート
    let initializationOrder: NodeType[] = [];
    if (errors.length === 0) {
      try {
        initializationOrder = this.topologicalSorter.sort(graph);
      } catch (error) {
        errors.push({
          type: 'circular',
          message: `Failed to determine initialization order: ${error}`,
          affectedNodes: Array.from(definitions.keys()),
        });
      }
    }
    
    return {
      success: errors.length === 0,
      initializationOrder,
      dependencyGraph: graph,
      errors,
      warnings,
    };
  }
  
  /**
   * 依存関係グラフを構築
   */
  private buildDependencyGraph(definitions: Map<NodeType, PluginDefinition>): DependencyGraph {
    const nodes = new Map(definitions);
    const edges = new Map<NodeType, Set<NodeType>>();
    const reverseEdges = new Map<NodeType, Set<NodeType>>();
    
    // 各ノードの依存関係を処理
    for (const [nodeType, definition] of definitions) {
      const dependencies = new Set<NodeType>();
      
      for (const dep of definition.dependencies) {
        dependencies.add(dep as NodeType);
        
        // 逆エッジも記録
        if (!reverseEdges.has(dep as NodeType)) {
          reverseEdges.set(dep as NodeType, new Set());
        }
        reverseEdges.get(dep as NodeType)!.add(nodeType);
      }
      
      edges.set(nodeType, dependencies);
    }
    
    return { nodes, edges, reverseEdges };
  }
  
  /**
   * 欠落している依存関係をチェック
   */
  private checkMissingDependencies(graph: DependencyGraph): DependencyError[] {
    const errors: DependencyError[] = [];
    
    for (const [nodeType, dependencies] of graph.edges) {
      for (const dep of dependencies) {
        if (!graph.nodes.has(dep)) {
          errors.push({
            type: 'missing',
            message: `Plugin '${nodeType}' depends on missing plugin '${dep}'`,
            affectedNodes: [nodeType, dep],
          });
        }
      }
    }
    
    return errors;
  }
}

/**
 * トポロジカルソート実装
 */
export class TopologicalSorter {
  /**
   * トポロジカルソート（Kahn's algorithm）
   */
  sort(graph: DependencyGraph): NodeType[] {
    const result: NodeType[] = [];
    const inDegree = new Map<NodeType, number>();
    
    // 入次数を計算
    for (const node of graph.nodes.keys()) {
      inDegree.set(node, 0);
    }
    
    for (const dependencies of graph.edges.values()) {
      for (const dep of dependencies) {
        const current = inDegree.get(dep) || 0;
        inDegree.set(dep, current + 1);
      }
    }
    
    // 入次数が0のノードをキューに追加
    const queue: NodeType[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }
    
    // BFSでトポロジカルソート
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      // このノードに依存するノードの入次数を減らす
      const dependents = graph.reverseEdges.get(node) || new Set();
      for (const dependent of dependents) {
        const degree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, degree);
        
        if (degree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    // すべてのノードが処理されたか確認
    if (result.length !== graph.nodes.size) {
      throw new Error('Circular dependency detected');
    }
    
    return result;
  }
}

/**
 * 循環依存検出器
 */
export class CircularDependencyDetector {
  /**
   * 循環依存を検出（DFS）
   */
  detect(graph: DependencyGraph): DependencyError[] {
    const errors: DependencyError[] = [];
    const visited = new Set<NodeType>();
    const recursionStack = new Set<NodeType>();
    
    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        const cycle = this.detectCycleDFS(node, graph, visited, recursionStack, []);
        if (cycle.length > 0) {
          errors.push({
            type: 'circular',
            message: `Circular dependency detected: ${cycle.join(' -> ')}`,
            affectedNodes: cycle,
          });
        }
      }
    }
    
    return errors;
  }
  
  private detectCycleDFS(
    node: NodeType,
    graph: DependencyGraph,
    visited: Set<NodeType>,
    recursionStack: Set<NodeType>,
    path: NodeType[]
  ): NodeType[] {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const dependencies = graph.edges.get(node) || new Set();
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        const cycle = this.detectCycleDFS(dep, graph, visited, recursionStack, [...path]);
        if (cycle.length > 0) {
          return cycle;
        }
      } else if (recursionStack.has(dep)) {
        // 循環を検出
        const cycleStart = path.indexOf(dep);
        return [...path.slice(cycleStart), dep];
      }
    }
    
    recursionStack.delete(node);
    return [];
  }
}
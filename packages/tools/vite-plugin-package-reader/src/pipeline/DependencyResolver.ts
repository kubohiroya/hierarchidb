import type { PackageJson } from '../types';

/**
 * 依存関係解決のユーティリティ
 */
export class DependencyResolver {
  /**
   * パッケージの依存関係を取得
   */
  static getDependencies(packageJson: PackageJson): string[] {
    const deps: string[] = [];
    
    if (packageJson.dependencies) {
      deps.push(...Object.keys(packageJson.dependencies));
    }
    
    if (packageJson.peerDependencies) {
      deps.push(...Object.keys(packageJson.peerDependencies));
    }
    
    return deps;
  }

  /**
   * ワークスペースプロトコルを解決
   */
  static resolveWorkspaceProtocol(version: string): string {
    if (version.startsWith('workspace:')) {
      return version.replace('workspace:', '');
    }
    return version;
  }

  /**
   * 依存関係グラフを構築
   */
  static buildDependencyGraph(
    packages: Map<string, PackageJson>
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const [name, pkg] of packages) {
      const deps = new Set<string>();
      
      // 依存関係を収集
      const allDeps = this.getDependencies(pkg);
      for (const dep of allDeps) {
        if (packages.has(dep)) {
          deps.add(dep);
        }
      }
      
      graph.set(name, deps);
    }

    return graph;
  }

  /**
   * 循環依存を検出
   */
  static detectCircularDependencies(
    graph: Map<string, Set<string>>
  ): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = graph.get(node) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...path]);
        } else if (recursionStack.has(dep)) {
          // 循環を検出
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), dep]);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * トポロジカルソート（DFS版）
   */
  static topologicalSort(
    packages: Map<string, PackageJson>
  ): string[] {
    const graph = this.buildDependencyGraph(packages);
    const visited = new Set<string>();
    const result: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      
      const deps = graph.get(node) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep);
        }
      }
      
      result.push(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return result;
  }

  /**
   * 推移的依存関係を取得
   */
  static getTransitiveDependencies(
    packageName: string,
    packages: Map<string, PackageJson>
  ): Set<string> {
    const graph = this.buildDependencyGraph(packages);
    const visited = new Set<string>();
    
    const dfs = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);
      
      const deps = graph.get(node) || new Set();
      for (const dep of deps) {
        dfs(dep);
      }
    };
    
    dfs(packageName);
    visited.delete(packageName); // 自身を除外
    
    return visited;
  }
}
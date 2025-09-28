import type { PackageJson } from '../types.js';

/**
    */
export class DependencyResolver {
  /**
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
            */
  static resolveWorkspaceProtocol(version: string): string {
    if (version.startsWith('workspace:')) {
      return version.replace('workspace:', '');
    }
    return version;
  }

  /**
            */
  static buildDependencyGraph(
    packages: Map<string, PackageJson>,
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const [name, pkg] of packages) {
      const deps = new Set<string>();

      const allDeps = DependencyResolver.getDependencies(pkg);
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
            */
  static detectCircularDependencies(
    graph: Map<string, Set<string>>,
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
      * DFS
      */
  static topologicalSort(
    packages: Map<string, PackageJson>,
  ): string[] {
    const graph = DependencyResolver.buildDependencyGraph(packages);
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
            */
  static getTransitiveDependencies(
    packageName: string,
    packages: Map<string, PackageJson>,
  ): Set<string> {
    const graph = DependencyResolver.buildDependencyGraph(packages);
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
    visited.delete(packageName);
    return visited;
  }
}
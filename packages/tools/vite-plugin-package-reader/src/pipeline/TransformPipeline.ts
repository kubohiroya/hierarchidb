import type { PackageJson, TransformPipelineOptions } from '../types.js';
import { Logger } from '../core/Logger.js';

export class TransformPipeline<T = any> {
  private options: TransformPipelineOptions<T>;
  private logger: Logger;

  constructor(options: TransformPipelineOptions<T>, logger?: Logger) {
    this.options = options;
    this.logger = logger || new Logger();
  }

  /**
            */
  async execute(packages: Map<string, PackageJson>): Promise<T> {
    this.logger.info('Starting transformation pipeline...');

    this.logger.debug('Executing transform function...');
    let result = this.options.transform(packages);

    if (Array.isArray(result) && this.options.resolveDependencies) {
      this.logger.debug('Resolving dependencies...');
      const resolver = this.options.resolveDependencies as (item: unknown) => readonly string[];
      const resolved = this.resolveDependenciesAndSort(result, resolver);
      result = resolved as unknown as T;
    }

    if (Array.isArray(result) && this.options.sort) {
      this.logger.debug('Applying custom sort...');
      const sorted = this.options.sort(result as unknown as T[]);
      result = sorted as unknown as T;
    }

    this.logger.info('Transformation pipeline completed');
    return result;
  }

  /**
            */
  private resolveDependenciesAndSort(items: readonly unknown[], resolver: (item: unknown) => readonly string[]): unknown[] {
    const mutableItems = [...items];

    const graph = new Map<unknown, Set<unknown>>();
    const itemMap = new Map<string, unknown>();

    for (const item of mutableItems) {
      const itemKey = this.getItemKey(item);
      itemMap.set(itemKey, item);
      graph.set(item, new Set());
    }

    for (const item of mutableItems) {
      const deps = resolver(item);
      const itemDeps = graph.get(item);
      if (!itemDeps) continue;

      for (const dep of deps) {
        const depItem = itemMap.get(dep);
        if (depItem && depItem !== item) {
          itemDeps.add(depItem);
        }
      }
    }

    return this.topologicalSort(mutableItems, graph);
  }

  /**
            */
  private getItemKey(item: unknown): string {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const byName = record.name;
      if (typeof byName === 'string') return byName;
      const byId = record.id;
      if (typeof byId === 'string') return byId;
      if (typeof byId === 'number') return byId.toString();
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }
    return String(item);
  }

  /**
      * Kahn's algorithm
      */
  private topologicalSort<I>(items: I[], graph: Map<I, Set<I>>): I[] {
    const inDegree = new Map<I, number>();
    for (const item of items) {
      inDegree.set(item, 0);
    }

    for (const deps of graph.values()) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    //  0
    const queue: I[] = [];
    for (const [item, degree] of inDegree) {
      if (degree === 0) {
        queue.push(item);
      }
    }

    const result: I[] = [];

    while (queue.length > 0) {
      const item = queue.shift()!;
      result.push(item);

      const deps = graph.get(item) || new Set();
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);

        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    if (result.length !== items.length) {
      const remaining = items.filter(item => !result.includes(item));
      this.logger.warn('Circular dependency detected. Affected items:', remaining);
      result.push(...remaining);
    }

    return result;
  }
}

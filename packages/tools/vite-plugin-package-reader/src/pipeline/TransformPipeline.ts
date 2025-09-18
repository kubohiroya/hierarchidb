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
      result = this.resolveDependenciesAndSort(result as any[]) as T;
    }

    if (Array.isArray(result) && this.options.sort) {
      this.logger.debug('Applying custom sort...');
      result = this.options.sort(result as any[]) as T;
    }

    this.logger.info('Transformation pipeline completed');
    return result;
  }

  /**
            */
  private resolveDependenciesAndSort<I>(items: I[]): I[] {
    if (!this.options.resolveDependencies) {
      return items;
    }

    const graph = new Map<I, Set<I>>();
    const itemMap = new Map<string, I>();

    for (const item of items) {
      const itemKey = this.getItemKey(item);
      itemMap.set(itemKey, item);
      graph.set(item, new Set());
    }

    for (const item of items) {
      const deps = this.options.resolveDependencies!(item as unknown as T);
      const itemDeps = graph.get(item)!;

      for (const dep of deps) {
        const depItem = itemMap.get(dep);
        if (depItem && depItem !== item) {
          itemDeps.add(depItem);
        }
      }
    }

    return this.topologicalSort(items, graph);
  }

  /**
            */
  private getItemKey(item: any): string {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object') {
      return item.name || item.id || JSON.stringify(item);
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
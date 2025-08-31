import type { PackageJson, TransformPipelineOptions } from '../types';
import { Logger } from '../core/Logger';

export class TransformPipeline<T = any> {
  private options: TransformPipelineOptions<T>;
  private logger: Logger;

  constructor(options: TransformPipelineOptions<T>, logger?: Logger) {
    this.options = options;
    this.logger = logger || new Logger();
  }

  /**
   * パイプラインを実行
   */
  async execute(packages: Map<string, PackageJson>): Promise<T> {
    this.logger.info('Starting transformation pipeline...');
    
    // 変換を実行
    this.logger.debug('Executing transform function...');
    let result = this.options.transform(packages);

    // 配列の場合、依存関係の解決とソートを実行
    if (Array.isArray(result) && this.options.resolveDependencies) {
      this.logger.debug('Resolving dependencies...');
      result = this.resolveDependenciesAndSort(result as any[]) as T;
    }

    // カスタムソート
    if (Array.isArray(result) && this.options.sort) {
      this.logger.debug('Applying custom sort...');
      result = this.options.sort(result as any[]) as T;
    }

    this.logger.info('Transformation pipeline completed');
    return result;
  }

  /**
   * 依存関係を解決してトポロジカルソート
   */
  private resolveDependenciesAndSort<I>(items: I[]): I[] {
    if (!this.options.resolveDependencies) {
      return items;
    }

    // 依存グラフを構築
    const graph = new Map<I, Set<I>>();
    const itemMap = new Map<string, I>();
    
    // アイテムをマップに登録
    for (const item of items) {
      const itemKey = this.getItemKey(item);
      itemMap.set(itemKey, item);
      graph.set(item, new Set());
    }

    // 依存関係を設定
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

    // トポロジカルソート
    return this.topologicalSort(items, graph);
  }

  /**
   * アイテムのキーを取得
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
   * トポロジカルソート（Kahn's algorithm）
   */
  private topologicalSort<I>(items: I[], graph: Map<I, Set<I>>): I[] {
    // 入次数を計算
    const inDegree = new Map<I, number>();
    for (const item of items) {
      inDegree.set(item, 0);
    }
    
    for (const deps of graph.values()) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    // 入次数が0のノードをキューに追加
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

      // 隣接ノードの入次数を減らす
      const deps = graph.get(item) || new Set();
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);
        
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // 循環依存のチェック
    if (result.length !== items.length) {
      const remaining = items.filter(item => !result.includes(item));
      this.logger.warn('Circular dependency detected. Affected items:', remaining);
      // 循環依存があるアイテムも結果に追加（元の順序を保持）
      result.push(...remaining);
    }

    return result;
  }
}
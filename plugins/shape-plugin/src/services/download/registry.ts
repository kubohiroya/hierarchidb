import type { BatchTaskLike } from '../../common/types/BatchTaskLike.js';
import type { IShapeDownloadStrategy } from './strategy.js';
import { HttpUrlStrategy } from './strategies/http-url.js';

class InMemoryRegistry {
  private list: IShapeDownloadStrategy[] = [];

  register(s: IShapeDownloadStrategy) {
    this.list.push(s);
  }

  resolve(task: BatchTaskLike): IShapeDownloadStrategy | null {
    return this.list.find((s) => s.supports(task)) ?? null;
  }
}

const registry = new InMemoryRegistry();
registry.register(new HttpUrlStrategy());

export function resolveShapeDownloadStrategy(task: BatchTaskLike): IShapeDownloadStrategy | null {
  return registry.resolve(task);
}

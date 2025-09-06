import type { BatchTaskLike } from '../../types/BatchTaskLike';
import type { IShapeDownloadStrategy } from './strategy';
import { HttpUrlStrategy } from './strategies/http-url';

class InMemoryRegistry {
  private list: IShapeDownloadStrategy[] = [];
  register(s: IShapeDownloadStrategy) { this.list.push(s); }
  resolve(task: BatchTaskLike): IShapeDownloadStrategy | null {
    return this.list.find((s) => s.supports(task)) ?? null;
  }
}

const registry = new InMemoryRegistry();
registry.register(new HttpUrlStrategy());

export function resolveShapeDownloadStrategy(task: BatchTaskLike): IShapeDownloadStrategy | null {
  const enabled =
    (typeof process !== 'undefined' && process?.env?.SHAPE_DOWNLOAD_STRATEGY === '1') ||
    (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.SHAPE_DOWNLOAD_STRATEGY === true;
  if (!enabled) return null;
  return registry.resolve(task);
}


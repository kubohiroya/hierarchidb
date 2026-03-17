import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BuildProgressAdapter,
  BuildProgressEvent,
  BuildUnifiedProgressInfo,
  UseBuildProgressOptions,
} from '@hierarchidb/build-api';

export class BuildService {
  async mapChunks<T, R>(items: T[], mapper: (item: T) => Promise<R>, _options?: { concurrency?: number }): Promise<R[]> {
    const results: R[] = [];
    for (const item of items) {
      results.push(await mapper(item));
    }
    return results;
  }
}

export class TabularWriter {
  async begin(_config: { filename: string; columns: string[] }) {
    // no-op for tests
  }

  async writeRows<T>(_rows: T[]): Promise<void> {
    // no-op
  }

  async commit(): Promise<{ tableId: string }> {
    return { tableId: 'test-table-id' };
  }
}

export class SimpleTableMetadataManager {
  constructor(_dbName: string) { }

  async forceDelete(_tableId: string): Promise<void> {
    // no-op
  }
}

export const getRowStoreDB = () => ({
  rowChunks: {
    where: (_field: string) => ({
      equals: (_value: string) => ({
        count: async () => 0,
        delete: async () => 0,
      }),
    }),
  },
});

export abstract class AbstractBuildSession<TConfig> {
  protected progress: Record<string, unknown> = {};

  constructor(public readonly nodeId: string, protected readonly config: TConfig) { }

  protected updateProgress(update: Record<string, unknown>): void {
    this.progress = { ...this.progress, ...update };
  }
}
export abstract class UnifiedBuildManagerBase<TConfig, TData> {
  private readonly pending = new Map<string, { config: TConfig; data: TData }>();

  protected constructor(protected readonly persistence?: unknown) { }

  async prepareSession(nodeId: string, config: TConfig, data: TData): Promise<void> {
    this.pending.set(nodeId, { config, data });
  }

  async startBuildSession(nodeId: string): Promise<string> {
    const payload = this.pending.get(nodeId);
    if (!payload) throw new Error(`No pending build session for node ${nodeId}`);
    this.pending.delete(nodeId);
    return this.performStart(nodeId, payload.config, payload.data);
  }
  async pauseBuildSession(nodeId: string): Promise<void> {
    await this.performPause(nodeId);
  }

  async getBuildSessionStatus(nodeId: string): Promise<unknown> {
    return this.performStatus(nodeId);
  }
  onBuildProgress(nodeId: string, callback: (event: unknown) => void): () => void {
    return this.performSubscribe(nodeId, callback);
  }

  protected abstract performStart(nodeId: string, config: TConfig, data: TData): Promise<string>;
  protected abstract performPause(nodeId: string): Promise<void>;
  protected abstract performStatus(nodeId: string): Promise<unknown>;
  protected abstract performSubscribe(nodeId: string, callback: (event: unknown) => void): () => void;
}

export class TabularDatabaseManager {
  constructor(_dbName: string) { }

  async forceDelete(_tableId: string): Promise<void> { }
}

export function createLaneSemaphoreRegistry(options: { defaults: Record<string, number>; fallback?: number }) {
  const defaults = options.defaults ?? {};
  const fallback = Math.max(1, Math.floor(options.fallback ?? 1));
  return {
    async runWithLane<T>(_lane: string, task: () => Promise<T>): Promise<T> {
      return task();
    },
    recommendConcurrency(lanes?: Iterable<string>, fallbackConcurrency?: number): number {
      if (!lanes) {
        return Math.max(1, Math.floor(fallbackConcurrency ?? fallback));
      }
      let total = 0;
      for (const lane of lanes) {
        const key = String(lane).trim().toLowerCase();
        total += defaults[key] ?? fallback;
      }
      const recommendation = total || (fallbackConcurrency ?? fallback);
      return Math.max(1, Math.floor(recommendation));
    },
    getLaneCapacity(lane: string): number {
      const key = String(lane).trim().toLowerCase();
      return defaults[key] ?? fallback;
    },
    isDisabled(): boolean {
      return false;
    },
  };
}

export function progressEventToUnified(event: BuildProgressEvent): BuildUnifiedProgressInfo {
  const payload = event.payload as BuildUnifiedProgressInfo['payload'] | undefined;
  if (!payload) {
    throw new Error(`[progressEventToUnified] event.payload is required but was absent (nodeId=${String(event.nodeId)}, stage=${String(event.stage)})`);
  }
  if (typeof payload.total !== 'number' || !Number.isFinite(payload.total)) {
    throw new Error(`[progressEventToUnified] payload.total must be a finite number, received ${String(payload.total)}`);
  }
  if (typeof payload.completed !== 'number' || !Number.isFinite(payload.completed)) {
    throw new Error(`[progressEventToUnified] payload.completed must be a finite number, received ${String(payload.completed)}`);
  }
  if (typeof payload.failed !== 'number' || !Number.isFinite(payload.failed)) {
    throw new Error(`[progressEventToUnified] payload.failed must be a finite number, received ${String(payload.failed)}`);
  }
  // BuildUnifiedProgressInfo is an alias for BuildProgressEvent — return as-is.
  return event;
}

export function createAdapterFromProgressSubscribe(
  subscribeProgress: (cb: (event: BuildProgressEvent) => void) => (() => void) | Promise<() => void>,
): BuildProgressAdapter {
  return {
    subscribe: (consumer: (info: BuildUnifiedProgressInfo) => void) => {
      const wrapped = (event: BuildProgressEvent) => {
        consumer(progressEventToUnified(event));
      };
      return subscribeProgress(wrapped);
    },
  } satisfies BuildProgressAdapter;
}

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe>;

export function useBuildProgress(
  adapter: BuildProgressAdapter | null,
  { autoSubscribe = true }: UseBuildProgressOptions = {},
) {
  const [progress, setProgress] = useState<BuildUnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);

  const subscribe = useCallback(() => {
    if (!adapter || subscribed) return;
    const result: SubscribeResult = adapter.subscribe((info: BuildUnifiedProgressInfo) => {
      setProgress(info);
    });
    if (typeof result === 'function') {
      unsubRef.current = result;
    } else if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<Unsubscribe>).then((value) => {
        if (typeof value === 'function') {
          unsubRef.current = value;
        }
      });
    }
    setSubscribed(true);
  }, [adapter, subscribed]);

  const unsubscribe = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setSubscribed(false);
  }, []);

  useEffect(() => {
    if (adapter && autoSubscribe) subscribe();
    return () => {
      unsubscribe();
    };
  }, [adapter, autoSubscribe, subscribe, unsubscribe]);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}

export function usePluginBuildProgress<TProgress>(
  _nodeType: string,
  _nodeId?: string | null,
  _options?: Record<string, unknown>,
) {
  return {
    progress: null as TProgress | null,
    unifiedProgress: null,
    error: null as Error | null,
    subscribe: () => undefined,
    unsubscribe: () => undefined,
  };
}

// default exports expected by SessionController
export const vtpbf = {
  fromGeojson: () => new Uint8Array(),
};
export const geojsonvt = (..._args: unknown[]) => ({
  getTile: () => ({ features: [] }),
});
// Support both default and named import styles
module.exports = Object.assign(module.exports || {}, { default: vtpbf, geojsonvt });

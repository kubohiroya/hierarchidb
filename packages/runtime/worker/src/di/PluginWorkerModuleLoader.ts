import { inject, injectable, optional } from 'inversify';
import type { PluginWorkerModuleLoader as PluginWorkerModuleLoaderContract } from './interfaces.js';
import { WorkerDiTokens } from './tokens.js';

type PluginWorkerModuleMap = Record<string, string>;
type PluginWorkerSourceMap = Record<string, string | undefined>;
type PluginWorkerLoaderMap = Record<string, () => Promise<unknown>>;

@injectable()
export class PluginWorkerModuleLoader implements PluginWorkerModuleLoaderContract {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    @inject(WorkerDiTokens.PluginWorkerSpecifierMap)
    private readonly specMap: PluginWorkerModuleMap,
    @inject(WorkerDiTokens.PluginWorkerLoaderMap)
    @optional()
    private readonly loaderMap?: PluginWorkerLoaderMap,
    @inject(WorkerDiTokens.PluginWorkerSourceMap)
    @optional()
    private readonly sourceMap?: PluginWorkerSourceMap,
    @inject(WorkerDiTokens.PluginRegistry)
    @optional()
    private readonly registry?: Array<{ nodeType: string }>
  ) {}

  has(nodeType: string): boolean {
    if (this.loaderMap && Object.hasOwn(this.loaderMap, nodeType)) {
      return true;
    }
    if (this.registry) {
      return this.registry.some((entry) => entry.nodeType === nodeType);
    }
    return Object.hasOwn(this.specMap, nodeType);
  }

  listNodeTypes(): string[] {
    const nodes = new Set<string>();
    if (this.registry) {
      for (const entry of this.registry) {
        nodes.add(entry.nodeType);
      }
    } else {
      for (const key of Object.keys(this.specMap)) {
        nodes.add(key);
      }
    }
    if (this.loaderMap) {
      for (const key of Object.keys(this.loaderMap)) {
        nodes.add(key);
      }
    }
    return Array.from(nodes);
  }

  importModule<T = unknown>(nodeType: string): Promise<T> {
    if (!this.cache.has(nodeType)) {
      const directLoader = this.loaderMap?.[nodeType];
      if (directLoader) {
        const spec = this.specMap[nodeType];
        const loaderPromise = (async () => {
          try {
            return await directLoader();
          } catch (loaderError) {
            if (spec) {
              return this.loadFromSpecifier<T>(nodeType, spec);
            }
            throw loaderError;
          }
        })();
        this.cache.set(nodeType, loaderPromise as Promise<unknown>);
      } else {
        const spec = this.specMap[nodeType];
        if (!spec) {
          return Promise.reject(
            new Error(`[PluginWorkerModuleLoader] Unknown worker plugin: ${nodeType}`)
          );
        }
        const loaderPromise = this.loadFromSpecifier<T>(nodeType, spec);
        this.cache.set(nodeType, loaderPromise as Promise<unknown>);
      }
    }

    const cached = this.cache.get(nodeType);
    if (!cached) {
      return Promise.reject(
        new Error(`[PluginWorkerModuleLoader] Plugin "${nodeType}" not registered in loader cache`)
      );
    }
    return cached as Promise<T>;
  }

  private async loadFromSpecifier<T>(nodeType: string, spec: string): Promise<T> {
    try {
      const result = await import(/* @vite-ignore */ spec);
      return result as T;
    } catch (primaryError) {
      const attempted: string[] = [spec];

      const isDevEnvironment =
        typeof import.meta !== 'undefined' &&
        Boolean((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.DEV);

      if (isDevEnvironment && this.sourceMap) {
        const relativePath = this.sourceMap[nodeType];
        if (relativePath) {
          try {
            const runtimeSrcUrl = new URL('../', import.meta.url);
            const devUrl = new URL(relativePath, runtimeSrcUrl).href;
            attempted.push(devUrl);
            const result = await import(/* @vite-ignore */ devUrl);
            return result as T;
          } catch (devError) {
            console.warn(
              `[PluginWorkerModuleLoader] dev import fallback failed for ${nodeType}`,
              devError
            );
          }
        }
      }

      if (this.sourceMap) {
        const relativeSource = this.sourceMap[nodeType];
        if (relativeSource) {
          try {
            const runtimeSrcUrl = new URL('../', import.meta.url);
            const normalizedSource = relativeSource.startsWith('.')
              ? relativeSource
              : `../../../../../${relativeSource}`;
            const prodUrl = new URL(normalizedSource, runtimeSrcUrl).href;
            attempted.push(prodUrl);
            const result = await import(/* @vite-ignore */ prodUrl);
            return result as T;
          } catch (sourceError) {
            console.warn(
              `[PluginWorkerModuleLoader] source import fallback failed for ${nodeType}`,
              sourceError
            );
          }
        }
      }

      // Attempt to load explicit dist path as a final fallback
      const distSpec = spec.replace(/\/worker$/, '/dist/worker/index.js');
      if (distSpec !== spec && !attempted.includes(distSpec)) {
        try {
          attempted.push(distSpec);
          const result = await import(/* @vite-ignore */ distSpec);
          return result as T;
        } catch (distError) {
          console.warn(
            `[PluginWorkerModuleLoader] dist import fallback failed for ${nodeType}`,
            distError
          );
        }
      }

      console.warn(
        `[PluginWorkerModuleLoader] import failed for ${nodeType} after attempts: ${attempted.join(', ')}`,
        primaryError
      );
      throw primaryError;
    }
  }
}

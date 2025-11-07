import { inject, injectable, optional } from 'inversify';
import type { PluginWorkerModuleLoader as PluginWorkerModuleLoaderContract } from './interfaces.js';
import { WorkerDiTokens } from './tokens.js';

type PluginWorkerModuleMap = Record<string, string>;
type PluginWorkerLoaderMap = Record<string, () => Promise<unknown>>;
const createPluginWorkerSpecifier = (nodeType: string) =>
  `@hierarchidb/${nodeType}-plugin/worker`;

@injectable()
export class PluginWorkerModuleLoader implements PluginWorkerModuleLoaderContract {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    @inject(WorkerDiTokens.PluginWorkerSpecifierMap)
    private readonly specMap: PluginWorkerModuleMap,
    @inject(WorkerDiTokens.PluginWorkerLoaderMap)
    @optional()
    private readonly loaderMap?: PluginWorkerLoaderMap,
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
      const loaderPromise = this.loadWorkerModule<T>(nodeType);
      this.cache.set(nodeType, loaderPromise as Promise<unknown>);
    }

    const cached = this.cache.get(nodeType);
    if (!cached) {
      return Promise.reject(
        new Error(`[PluginWorkerModuleLoader] Plugin "${nodeType}" not registered in loader cache`)
      );
    }
    return cached as Promise<T>;
  }

  private async loadWorkerModule<T>(nodeType: string): Promise<T> {
    const specifier = this.specMap[nodeType] ?? createPluginWorkerSpecifier(nodeType);
    if (!specifier) {
      throw new Error(`[PluginWorkerModuleLoader] Unknown worker plugin: ${nodeType}`);
    }

    const directLoader = this.loaderMap?.[nodeType];
    if (directLoader) {
      try {
        return (await directLoader()) as T;
      } catch (loaderError) {
        console.warn(
          `[PluginWorkerModuleLoader] direct loader failed for ${nodeType}, attempting bare specifier`,
          loaderError
        );
      }
    }

    try {
      return await this.loadFromSpecifier<T>(specifier);
    } catch (error) {
      console.warn(
        `[PluginWorkerModuleLoader] import failed for ${nodeType} via ${specifier}`,
        error
      );
      throw error;
    }
  }

  protected loadFromSpecifier<T>(specifier: string): Promise<T> {
    const isBareSpecifier = specifier.startsWith('@hierarchidb/');
    if (isBareSpecifier) {
      return import(specifier) as Promise<T>;
    }
    return import(/* @vite-ignore */ specifier) as Promise<T>;
  }
}

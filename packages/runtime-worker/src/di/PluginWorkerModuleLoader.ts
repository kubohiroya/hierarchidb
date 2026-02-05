import { inject, injectable, optional } from 'inversify';
import type { PluginWorkerModuleLoaderContract } from './PluginWorkerModuleLoaderContract.js';
import { WorkerDiTokens } from './tokens.js';

type PluginWorkerModuleMap = Record<string, string>;
type PluginWorkerLoaderMap = Record<string, () => Promise<unknown>>;
const createPluginWorkerSpecifier = (nodeType: string) => `@hierarchidb/${nodeType}-plugin/worker`;

type PluginModuleExports = { worker: boolean; database: boolean };

type RegistryEntry = {
  nodeType: string;
  exports?: string[];
  modules?: { worker?: unknown; database?: unknown };
};

const defaultPluginModuleExports: Record<string, PluginModuleExports> = {
  basemap: { worker: false, database: true },
  folder: { worker: false, database: false },
  linker: { worker: true, database: false },
  location: { worker: true, database: true },
  resolver: { worker: false, database: true },
  route: { worker: true, database: true },
  shape: { worker: true, database: false },
  spreadsheet: { worker: true, database: false },
  styler: { worker: true, database: false },
  timeline: { worker: true, database: false },
};

const deriveExports = (nodeType: string, entry?: RegistryEntry): PluginModuleExports => {
  if (entry && Array.isArray(entry.exports)) {
    const normalized = entry.exports.map((value) => value.replace(/^\.?\//, ''));
    const hasWorkerExport = normalized.some(
      (value) => value === 'worker' || value.startsWith('worker/')
    );
    const hasDatabaseExport = normalized.some(
      (value) =>
        value === 'database' ||
        value.startsWith('database/') ||
        value === 'worker/database' ||
        value.startsWith('worker/database/')
    );
    return { worker: hasWorkerExport, database: hasDatabaseExport };
  }
  return defaultPluginModuleExports[nodeType] ?? { worker: true, database: true };
};

const hasWorkerExport = (nodeType: string, entry?: RegistryEntry): boolean =>
  deriveExports(nodeType, entry).worker;

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
    private readonly registry?: RegistryEntry[]
  ) {}

  has(nodeType: string): boolean {
    const registryEntry = this.registry?.find((entry) => entry.nodeType === nodeType);
    if (!hasWorkerExport(nodeType, registryEntry)) return false;
    if (this.loaderMap && Object.hasOwn(this.loaderMap, nodeType)) return true;
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
    return Array.from(nodes).filter((nodeType) =>
      hasWorkerExport(
        nodeType,
        this.registry?.find((entry) => entry.nodeType === nodeType)
      )
    );
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
    const registryEntry = this.registry?.find((entry) => entry.nodeType === nodeType);
    if (!hasWorkerExport(nodeType, registryEntry)) {
      throw new Error(`[PluginWorkerModuleLoader] Worker entry not exported for ${nodeType}`);
    }

    const specifier = this.specMap[nodeType] ?? createPluginWorkerSpecifier(nodeType);
    const shouldLogWarn =
      typeof console !== 'undefined' &&
      typeof console.warn === 'function' &&
      !(globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean })
        .__HDB_SILENCE_WORKER_LOGS__;
    if (!specifier) {
      throw new Error(`[PluginWorkerModuleLoader] Unknown worker plugin: ${nodeType}`);
    }

    const directLoader = this.loaderMap?.[nodeType];
    if (directLoader) {
      try {
        return (await directLoader()) as T;
      } catch (loaderError) {
        if (shouldLogWarn) {
          console.warn(
            `[PluginWorkerModuleLoader] direct loader failed for ${nodeType}, attempting bare specifier`,
            loaderError
          );
        }
      }
    }

    try {
      return await this.loadFromSpecifier<T>(specifier);
    } catch (error) {
      if (shouldLogWarn) {
        console.warn(
          `[PluginWorkerModuleLoader] import failed for ${nodeType} via ${specifier}`,
          error
        );
      }
      throw error;
    }
  }

  protected loadFromSpecifier<T>(specifier: string): Promise<T> {
    const isBareSpecifier = specifier.startsWith('@hierarchidb/');
    if (isBareSpecifier) {
      return import(/* @vite-ignore */ specifier) as Promise<T>;
    }
    return import(/* @vite-ignore */ specifier) as Promise<T>;
  }
}

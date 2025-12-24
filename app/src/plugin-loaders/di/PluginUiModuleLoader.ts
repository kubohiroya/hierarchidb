import { inject, injectable } from 'inversify';
import type { PluginUiModuleLoader as PluginUiModuleLoaderContract } from './interfaces.js';
import { UIPluginRegistryTokens } from './tokens.js';

type PluginUiModuleMap = Record<string, string>;
type PluginUiLoaderMap = Record<string, () => Promise<unknown>>;

@injectable()
export class PluginUiModuleLoader implements PluginUiModuleLoaderContract {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    @inject(UIPluginRegistryTokens.PluginUiModuleMap)
    private readonly specMap: PluginUiModuleMap,
    @inject(UIPluginRegistryTokens.PluginUiLoaders)
    private readonly loaderMap: PluginUiLoaderMap
  ) {}

  has(nodeType: string): boolean {
    if (this.loaderMap && Object.hasOwn(this.loaderMap, nodeType)) {
      return true;
    }
    return Object.hasOwn(this.specMap, nodeType);
  }

  listNodeTypes(): string[] {
    const keys = new Set<string>(Object.keys(this.specMap));
    for (const key of Object.keys(this.loaderMap ?? {})) {
      keys.add(key);
    }
    return Array.from(keys);
  }

  loadModule<T = unknown>(nodeType: string): Promise<T> {
    if (!this.cache.has(nodeType)) {
      let promise: Promise<unknown> | undefined;
      const loader = this.loaderMap?.[nodeType];
      if (typeof loader === 'function') {
        promise = loader();
      } else {
        const spec = this.specMap[nodeType];
        if (!spec) {
          return Promise.reject(new Error(`[PluginUiModuleLoader] Unknown UI plugin: ${nodeType}`));
        }
        promise = import(/* @vite-ignore */ spec);
      }

      this.cache.set(nodeType, promise as Promise<unknown>);
    }

    const cached = this.cache.get(nodeType);
    if (!cached) {
      return Promise.reject(
        new Error(`[PluginUiModuleLoader] Failed to load UI plugin: ${nodeType}`)
      );
    }
    return cached as Promise<T>;
  }
}

// Local copy of shared type to avoid build-time cross-package coupling
export interface PluginRuntimeWiring {
  registerSharedDownloadService?: () => Promise<void> | void;
  registerAuthNotifier?: () => Promise<void> | void;
  registerRuntimeWorkerAdapters?: () => Promise<void> | void;
}

/**
 * wirePluginsFromModules
 * Reflectively scans given modules for an exported `runtimeWiring` object and
 * calls its optional hooks in a safe, best-effort manner.
 */
import { registerRuntimeExports } from './runtime-export-registry';

export interface PluginModuleEntry {
  nodeType: string;
  mod: unknown;
}

export async function wirePluginsFromModules(entries: PluginModuleEntry[]): Promise<void> {
  for (const entry of entries) {
    const mod = entry.mod;
    try {
      const m = mod as any;
      const wiring: PluginRuntimeWiring | undefined = m?.runtimeWiring;
      if (!wiring || typeof wiring !== 'object') continue;

      if (typeof wiring.registerSharedDownloadService === 'function') {
        await wiring.registerSharedDownloadService();
      }
      if (typeof wiring.registerAuthNotifier === 'function') {
        await wiring.registerAuthNotifier();
      }
      if (typeof wiring.registerRuntimeWorkerAdapters === 'function') {
        await wiring.registerRuntimeWorkerAdapters();
      }
      // Register standardized factories/lifecycle when present
      const exp: any = {};
      const workerSide = m?.worker || m; // tolerate packaging that nests exports under .worker
      if (typeof workerSide?.createEntityHandler === 'function') exp.createEntityHandler = workerSide.createEntityHandler;
      if (typeof workerSide?.createBatchManager === 'function') exp.createBatchManager = workerSide.createBatchManager;
      if (workerSide?.lifecycle && typeof workerSide.lifecycle === 'object') exp.lifecycle = workerSide.lifecycle;
      if (Object.keys(exp).length > 0) {
        registerRuntimeExports(entry.nodeType, exp);
      }
    } catch (e) {
      console.warn('[wirePlugins] wiring failed for a module:', e);
    }
  }
}

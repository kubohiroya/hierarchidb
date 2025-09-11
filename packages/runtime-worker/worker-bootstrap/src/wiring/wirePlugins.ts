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
export async function wirePluginsFromModules(modules: unknown[]): Promise<void> {
  for (const mod of modules) {
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[wirePlugins] wiring failed for a module:', e);
    }
  }
}

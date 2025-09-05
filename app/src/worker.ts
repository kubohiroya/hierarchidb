/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import { WorkerInitializationReporter } from '@hierarchidb/runtime-worker-bootstrap';

const reporter = new WorkerInitializationReporter();
reporter.reportStepProgress('Starting worker…', 0);

(async () => {
  try {
    // Dynamic import to localize failures
    reporter.reportStepProgress('Loading Comlink…', 3);
    const Comlink: typeof import('comlink') = await import('comlink');

    reporter.reportStepProgress('Loading plugin loaders…', 5);
    try {
      // Resolve plugin definitions and loader map from virtual modules
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const defsMod = await import('virtual:plugin-definitions');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { pluginMap } = await import('virtual:plugin-map');

      const defs = (defsMod?.default as any[]) || [];
      const loadOrder = defs.map((d) => d.nodeType);

      for (const nodeType of loadOrder) {
        const loader = (pluginMap as Record<string, () => Promise<unknown>>)[nodeType];
        if (typeof loader === 'function') {
          console.log(`⏳ Loading plugin: ${nodeType}`);
          await loader();
          console.log(`✅ Loaded plugin: ${nodeType}`);
        }
      }
    } catch (e) {
      console.warn('[Worker] Plugin virtual modules unavailable; skipping auto-load');
    }

    // After package-reader runs, resolve plugin defs
    let pluginDefinitions: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import('virtual:plugin-definitions');
      pluginDefinitions = (mod?.default as any[]) || [];
    } catch {
      pluginDefinitions = [];
    }

    reporter.reportStepProgress('Bootstrapping worker services…', 15);
    const { WorkerService } = await import('@hierarchidb/runtime-worker');
    const services = await WorkerService.getSingleton((pluginDefinitions as any[]) || []);

    reporter.reportStepProgress('Creating API facade…', 80);
    const api: any = {
      ping: () => services.ping(),
      initialize: () => services.initialize(),
      shutdown: () => services.shutdown(),
      getSystemHealth: () => services.getSystemHealth(),
      getQueryAPI: () => services.getQueryAPI(),
      getMutationAPI: () => services.getMutationAPI(),
      getSubscriptionAPI: () => services.getSubscriptionAPI(),
      getWorkingCopyAPI: () => services.getWorkingCopyAPI(),
      getPluginLifecycleAPI: () => services.getPluginLifecycleAPI(),
      getImportExportAPI: () => services.getImportExportAPI(),
      getTagAPI: () => services.getTagAPI(),
    };

    reporter.reportStepProgress('Exposing API via Comlink…', 95);
    Comlink.expose(api);

    reporter.reportComplete();
  } catch (error) {
    // Report full error to UI
    const err = error as any;
    const message = err?.message || String(err);
    const stack = err?.stack || null;
    reporter.reportError(`${message}`);
    // Also throw to surface error event
    throw error;
  }
})();

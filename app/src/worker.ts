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
      console.warn('[Worker] Plugin virtual modules unavailable; attempting manual fallback');

      // Manual fallback for environments without Vite virtual modules (e.g., Angular dev server)
      try {
        const manualDefs: any[] = [];

        // Import plugin definitions directly from packages (source paths resolve in monorepo)
        try {
          const { FolderDefinition } = await import(
            '@hierarchidb/folder-plugin'
          );
          manualDefs.push(FolderDefinition);
          console.log('✅ Fallback loaded: folder plugin');
        } catch (err) {
          console.warn('⚠️ Fallback failed: folder plugin not available', err);
        }

        try {
          const { BaseMapPluginDefinition } = await import(
            '@hierarchidb/basemap-plugin'
          );
          manualDefs.push(BaseMapPluginDefinition);
          console.log('✅ Fallback loaded: basemap plugin');
        } catch (err) {
          console.warn('⚠️ Fallback failed: basemap plugin not available', err);
        }

        try {
          const { ShapePluginDefinition } = await import(
            '@hierarchidb/shape-plugin'
          );
          manualDefs.push(ShapePluginDefinition);
          console.log('✅ Fallback loaded: shape plugin');
        } catch (err) {
          console.warn('⚠️ Fallback failed: shape plugin not available', err);
        }

        try {
          const { StylerExtension } = await import(
            '@hierarchidb/styler-plugin'
          );
          manualDefs.push(StylerExtension);
          console.log('✅ Fallback loaded: styler plugin');
        } catch (err) {
          console.warn('⚠️ Fallback failed: styler plugin not available', err);
        }

        // Note: store registration side-effects are optional and environment-specific.
        // Skipping direct import of subpath exports here to avoid bundler resolution issues.

        // Hold the manual definitions for later bootstrap
        ;(self as any).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__ = manualDefs;
      } catch (fallbackErr) {
        console.warn('[Worker] Manual plugin fallback failed:', fallbackErr);
      }
    }

    // After package-reader runs, resolve plugin defs (or fallback)
    let pluginDefinitions: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import('virtual:plugin-definitions');
      pluginDefinitions = (mod?.default as any[]) || [];
    } catch {
      // Try manual fallback collected above
      pluginDefinitions = (self as any).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__ || [];
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

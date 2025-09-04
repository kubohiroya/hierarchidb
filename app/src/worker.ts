/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

// Minimal init message helpers (compatible with WorkerInitializationChannel)
const send = (type: string, payload: Record<string, unknown> = {}) => {
  try {
    (self as unknown as WorkerGlobalScope).postMessage({
      type,
      payload: { ...payload, timestamp: Date.now() },
    });
  } catch {}
};

send('INIT_PROGRESS', { progress: 0, message: 'Starting worker…' });

(async () => {
  try {
    // Dynamic import to localize failures
    send('INIT_PROGRESS', { progress: 3, message: 'Loading Comlink…' });
    const Comlink: typeof import('comlink') = await import('comlink');

    send('INIT_PROGRESS', { progress: 5, message: 'Loading plugin loaders…' });
    const { autoLoadPlugins } = await import('./plugins/auto-load');
    await autoLoadPlugins();

    // After package-reader runs, resolve plugin defs
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { default: pluginDefinitions } = await import('virtual:plugin-definitions');

    send('INIT_PROGRESS', { progress: 15, message: 'Bootstrapping worker services…' });
    const { WorkerService } = await import('@hierarchidb/runtime-worker');
    const services = await WorkerService.getSingleton((pluginDefinitions as any[]) || []);

    send('INIT_PROGRESS', { progress: 80, message: 'Creating API facade…' });
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

    send('INIT_PROGRESS', { progress: 95, message: 'Exposing API via Comlink…' });
    Comlink.expose(api);

    send('INIT_COMPLETE', { progress: 100, message: 'Worker initialized successfully' });
  } catch (error) {
    // Report full error to UI
    const err = error as any;
    const message = err?.message || String(err);
    const stack = err?.stack || null;
    send('INIT_ERROR', { error: message, stack });
    // Also throw to surface error event
    throw error;
  }
})();

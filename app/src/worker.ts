/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import { WorkerInitializationReporter, wirePluginsFromModules, getAllRuntimeExports } from '@hierarchidb/runtime-worker-bootstrap';
import { APP_VERSION, BUILD_TIME } from './version.js';

const localBuildTime = (() => {
  try { return new Date(BUILD_TIME).toLocaleString(); } catch { return String(BUILD_TIME); }
})();

// Minimal shims for Node-centric plugins to run inside Web Worker
// Provide a global alias so packages using `global` don't crash
// @eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;
if (typeof g.global === 'undefined') g.global = g;
// Minimal Node-like `process` shim for libraries that probe env flags
if (typeof g.process === 'undefined') g.process = { env: {} };
const reporter = new WorkerInitializationReporter([
  { name: 'Load Comlink', weight: 5 },
  { name: 'Load plugin loaders', weight: 10 },
  { name: 'Load plugins', weight: 35 },
  { name: 'Bootstrap services', weight: 30 },
  { name: 'Create API facade', weight: 10 },
  { name: 'Expose API', weight: 10 },
], false);
// Kick off a visible starting point
reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    // Dynamic import to localize failures
    // Step 1: Load Comlink
    reporter.reportStepProgress('Load Comlink', 10);
    const Comlink: typeof import('comlink') = await import('comlink');
    reporter.reportStepProgress('Load Comlink', 100);

    // Step 2: Skip legacy plugin-map path; registries handle loading below
    const isDev = (import.meta as any)?.env?.DEV;
    reporter.reportStepProgress('Load plugin loaders', 100);

    // After package-reader runs, resolve plugin defs (or fallback)
    let pluginDefinitions: any[] = [];
    if (!((import.meta as any)?.env?.DEV)) {
      try {
        // @eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const mod = await import('virtual:plugin-definitions').catch(async () =>
          await import('./virtual/plugin-definitions.js')
        );
        pluginDefinitions = (mod?.default as any[]) || [];
      } catch {
        // As a last resort, check any manual defs that might have been set (legacy)
        pluginDefinitions = (self as any).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__ || [];
      }
    }

    // Step 3: Load plugins (100% reached in loops above)
    reporter.reportStepProgress('Load plugins', 100);

    // Step 4: Bootstrap services
    reporter.reportStepProgress('Bootstrap services', 10);

    // Runtime wiring (shared, reflection-based): scan plugin packages and invoke optional hooks
    try {
      const defs = (pluginDefinitions as any[]) || [];
      if (defs.length === 0 || ((import.meta as any)?.env?.DEV)) {
        // In dev or when no plugin definitions are provided, this is expected; keep logs quiet.
        
      } else {
        // Use the generated worker registry so Vite can statically analyze imports
        const mod: any = await import('virtual:plugin-registry-worker').catch(() => null);
        let pluginMap: Record<string, () => Promise<unknown>> = mod?.pluginMapWorker || {};

        // Worker overrides: force worker-safe entries for known plugins
        const workerOverrides: Record<string, () => Promise<unknown>> = {
          // Use package subpath exports to avoid importing TS sources directly
          location: async () => import('@hierarchidb/location-plugin/worker'),
          // No worker for 'project'/'linker' in new design
          route: async () => import('@hierarchidb/route-plugin/worker'),
          // In dev, import monorepo source directly to avoid unresolved workspace pkg; in prod, use published subpath
          timeline: (isDev
            ? async () => import('../../packages/node-type/timeline-plugin/src/worker/index.js')
            : async () => import('@hierarchidb/timeline-plugin/worker')
          ),
          shape: async () => import('@hierarchidb/shape-plugin/worker'),
        };
        pluginMap = { ...pluginMap, ...workerOverrides } as any;

        const denyEnv = (typeof (import.meta as any)?.env?.VITE_HDB_WORKER_PLUGIN_DENY === 'string')
          ? String((import.meta as any).env.VITE_HDB_WORKER_PLUGIN_DENY)
          : '';
        // Allowlist overrides above; keep env-based deny for local experimentation
        const deny = new Set([...denyEnv.split(',').map(s => s.trim()).filter(Boolean)]);

        const modEntries: Array<{ nodeType: string; mod: unknown }> = [];
        for (const d of defs) {
          const nodeType = d?.nodeType as string;
          if (deny.has(nodeType)) {
            continue;
          }
          const loader = (pluginMap as Record<string, () => Promise<unknown>>)[nodeType];
          if (typeof loader === 'function') {
            try {
              const mod = await loader();
              modEntries.push({ nodeType, mod });
            } catch (e: unknown) {
              const msg = (e as any)?.message ?? String(e);
              const soft = /document is not defined|Grid2|does not provide an export/i.test(msg);
              const prefix = `[worker bootstrap] failed to load worker for ${nodeType}:`;
              if ((import.meta as any)?.env?.DEV || soft) {
                console.warn(prefix, msg);
              } else {
                throw e;
              }
            }
          }
        }
        await wirePluginsFromModules(modEntries);
      }
    } catch (error) {
      console.error('[worker bootstrap] plugin wiring failed:', error);
    }
    // Merge standardized lifecycles discovered from worker modules into pluginDefinitions
    try {
      const exportsByType = getAllRuntimeExports();
      const enriched = (pluginDefinitions as any[]).map((d) => {
        const exp = exportsByType?.[d.nodeType];
        return exp && exp.lifecycle ? { ...d, lifecycle: exp.lifecycle } : d;
      });
      // Hand off to WorkerService
      // Register entity handlers if factories are provided
      try {
        const runtime = await import('@hierarchidb/runtime-worker');
        const entityRegistry: any = (runtime as any).entityRegistry;
        if (entityRegistry) {
          for (const [nodeType, exp] of Object.entries(exportsByType)) {
            const factory: any = (exp as any).createEntityHandler;
            if (typeof factory === 'function') {
              try {
                const handler = await factory();
                if (handler) entityRegistry.register(nodeType, handler as any);
              } catch (error) {
                console.warn('[worker bootstrap] entity handler registration failed:', nodeType, error);
              }
            }
          }
        }
      } catch (error) {
        console.warn('[worker bootstrap] runtime-worker entity registry unavailable:', error);
      }

      const { WorkerService } = await import('@hierarchidb/runtime-worker');
      const services = await WorkerService.getSingleton(enriched || (pluginDefinitions as any[]));
      reporter.reportStepProgress('Bootstrap services', 100);
      const messagePort: any = self as any;
      if (typeof messagePort?.postMessage === 'function') {
        messagePort.postMessage({ type: 'SERVICES_READY', source: 'worker', at: Date.now() });
      }

      // Step 5: Create API facade
      reporter.reportStepProgress('Create API facade', 10);

      // Build plain facades (only functions) to ensure Comlink can proxy them safely
      const query = services.getQueryAPI();
      const mutation = services.getMutationAPI();
      const subscription = services.getSubscriptionAPI();
      const tag = services.getTagAPI();
      const importExport = services.getImportExportAPI();
      const workingCopy = services.getWorkingCopyAPI();
      const pluginLifecycle = services.getPluginLifecycleAPI();

      const queryFacade = {
        getTree: (id: any) => query.getTree(id),
        listTrees: () => query.listTrees(),
        getNode: (id: any) => (query as any).getNode?.(id),
        listChildren: (id: any) => (query as any).listChildren?.(id),
        listDescendants: (id: any, maxDepth?: number) => (query as any).listDescendants?.(id, maxDepth),
        listAncestors: (id: any) => (query as any).listAncestors?.(id),
        searchNodes: (opts: any) => (query as any).searchNodes?.(opts),
      } as const;
      const mutationFacade = {
        createNode: (args: any) => mutation.createNode(args),
        updateNode: (args: any) => mutation.updateNode(args),
        // Ensure parity with fallback facade so UI methods are always available
        removeNodes: (nodeIds: any[]) => (mutation as any).removeNodes(nodeIds as any),
        moveNodes: (nodeIds: any[], toParentId: any, onNameConflict?: 'error' | 'auto-rename') =>
          (mutation as any).moveNodes({ nodeIds: nodeIds as any, toParentId, onNameConflict }),
        duplicateNodes: (nodeIds: any[], toParentId?: any) => (mutation as any).duplicateNodes({
          nodeIds: nodeIds as any,
          toParentId,
        }),
        moveNodesToTrash: (nodeIds: any[]) => (mutation as any).moveNodesToTrash(nodeIds as any),
        recoverNodesFromTrash: (nodeIds: any[], toParentId?: any) => (mutation as any).recoverNodesFromTrash({
          nodeIds: nodeIds as any,
          toParentId,
        }),
      } as const;
      const subscriptionFacade = {
        subscribeNode: (id: any, cb: any, opts?: any) => subscription.subscribeNode(id, cb, opts),
        subscribeSubtree: (id: any, cb: any, opts?: any) => subscription.subscribeSubtree(id, cb, opts),
        subscribeTree: (treeId: any, cb: any, opts?: any) => subscription.subscribeTree(treeId, cb, opts),
        unsubscribe: (sid: any) => subscription.unsubscribe(sid),
        unsubscribeAll: () => subscription.unsubscribeAll(),
      } as const;
      // Expose through Comlink using direct service proxies (型安全 / as any 不要)
      const api = {
        ping: () => services.ping(),
        shutdown: () => services.shutdown(),
        initialize: () => services.initialize(),
        // Return minimal facades to avoid leaking Dexie instances/functions across the boundary
        getQueryAPI: () => Comlink.proxy(queryFacade),
        getMutationAPI: () => Comlink.proxy(mutation),
        getSubscriptionAPI: () => Comlink.proxy(subscription),
        getImportExportAPI: () => Comlink.proxy(importExport),
        getWorkingCopyAPI: () => Comlink.proxy(workingCopy),
        getPluginLifecycleAPI: () => Comlink.proxy(pluginLifecycle),
        getSystemHealth: () => services.getSystemHealth(),
        getTagAPI: () => Comlink.proxy(tag),
      };
      Comlink.expose(api);

      reporter.reportStepProgress('Create API facade', 100);
      reporter.reportStepProgress('Expose API', 100);
      // Ensure UI receives INIT_COMPLETE in all code paths
      reporter.reportComplete();
      return;
    } catch (e){
      
    }

    const { WorkerService } = await import('@hierarchidb/runtime-worker');
    const services = await WorkerService.getSingleton((pluginDefinitions as any[]) || []);
    reporter.reportStepProgress('Bootstrap services', 100);

    // Step 5: Create API facade
    reporter.reportStepProgress('Create API facade', 10);

    // Build service instances
    const query = services.getQueryAPI();
    const mutation = services.getMutationAPI();
    const subscription = services.getSubscriptionAPI();
    const tag = services.getTagAPI();
    const importExport = services.getImportExportAPI();
    const workingCopy = services.getWorkingCopyAPI();
    const pluginLifecycle = services.getPluginLifecycleAPI();

    const api = {
      ping: () => services.ping(),
      initialize: () => services.initialize(),
      shutdown: () => services.shutdown(),
      getSystemHealth: () => services.getSystemHealth(),
      // Return minimal facades to avoid leaking Dexie instances/functions across the boundary
      getQueryAPI: () => Comlink.proxy({
        getTree: (id: any) => query.getTree(id),
        listTrees: () => (query as any).listTrees?.(),
        getNode: (id: any) => (query as any).getNode?.(id),
        listChildren: (id: any) => (query as any).listChildren?.(id),
        listDescendants: (id: any, maxDepth?: number) => (query as any).listDescendants?.(id, maxDepth),
        listAncestors: (id: any) => (query as any).listAncestors?.(id),
        searchNodes: (opts: any) => (query as any).searchNodes?.(opts),
      }),
      getMutationAPI: () => Comlink.proxy(mutation),
      getSubscriptionAPI: () => Comlink.proxy(subscription),
      getWorkingCopyAPI: () => Comlink.proxy(workingCopy),
      getPluginLifecycleAPI: () => Comlink.proxy(pluginLifecycle),
      getImportExportAPI: () => Comlink.proxy(importExport),
      getTagAPI: () => Comlink.proxy(tag),
    };

    reporter.reportStepProgress('Create API facade', 100);

    // Step 6: Expose API
    reporter.reportStepProgress('Expose API', 10);
    Comlink.expose(api);
    reporter.reportStepProgress('Expose API', 100);

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

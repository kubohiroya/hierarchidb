/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import { WorkerInitializationReporter, wirePluginsFromModules, getAllRuntimeExports } from '@hierarchidb/runtime-worker-bootstrap';
import { APP_VERSION, BUILD_TIME } from './version';

try {
  const localBuildTime = (() => {
    try {
      return new Date(BUILD_TIME).toLocaleString();
    } catch {
      return String(BUILD_TIME);
    }
  })();
  // eslint-disable-next-line no-console
  console.log(`[Worker] Version: ${APP_VERSION} | Build Time (local): ${localBuildTime}`);
} catch {
}

// Minimal shims for Node-centric plugins to run inside Web Worker
try {
  // Provide a global alias so packages using `global` don't crash
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (typeof g.global === 'undefined') g.global = g;
} catch {
}
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

    // Step 2: Load plugin loader virtual modules (skip in dev to avoid virtual: dependency races)
    const isDev = (import.meta as any)?.env?.DEV;
    reporter.reportStepProgress('Load plugin loaders', isDev ? 100 : 10);
    if (!isDev) {
      try {
        // Resolve plugin definitions and loader map from virtual modules (or local fallbacks)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const defsMod = await import('virtual:plugin-definitions').catch(async () =>
          // Local fallback to empty list when package-reader virtuals are unavailable
          await import('./virtual/plugin-definitions')
        );
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const modAny: any = await import('virtual:plugin-map').catch(async () => ({}));
        const pluginMap: Record<string, () => Promise<unknown>> =
          (modAny?.pluginMapWorker as any) || {};

        const defs = (defsMod?.default as any[]) || [];
        const loadOrder = defs.map((d) => d.nodeType);

        for (const [idx, nodeType] of loadOrder.entries()) {
          const loader = (pluginMap as Record<string, () => Promise<unknown>>)[nodeType];
          if (typeof loader === 'function') {
            console.log(`⏳ Loading plugin: ${nodeType}`);
            await loader();
            console.log(`✅ Loaded plugin: ${nodeType}`);
            // Update progress within the Load plugins step
            const stepProgress = Math.round(((idx + 1) / loadOrder.length) * 100);
            reporter.reportStepProgress('Load plugins', stepProgress);
          }
        }
        reporter.reportStepProgress('Load plugin loaders', 100);
      } catch (e) {
        if (!isDev) {
          console.warn('[Worker] Plugin loaders unavailable; skipping plugin loading phase');
        }
        reporter.reportStepProgress('Load plugin loaders', 100);
      }
    }

    // After package-reader runs, resolve plugin defs (or fallback)
    let pluginDefinitions: any[] = [];
    if (!((import.meta as any)?.env?.DEV)) {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const mod = await import('virtual:plugin-definitions').catch(async () =>
          await import('./virtual/plugin-definitions')
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
        if (defs.length === 0) console.warn('[Worker] No plugin definitions available; skipping plugin wiring');
        if (((import.meta as any)?.env?.DEV)) console.log('[Worker] Dev mode: skipping plugin wiring');
      } else {
        // Use the generated pluginMap so Vite can statically analyze imports
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // Prefer the worker map export from the unified virtual module, but be tolerant
        // of environments that only provide `pluginMap` or the legacy `virtual:plugin-map-worker`.
        let pluginMap: Record<string, () => Promise<unknown>> | undefined;
        try {
          const mod: any = await import('virtual:plugin-map');
          pluginMap = mod?.pluginMapWorker; // Worker専用のみ採用
        } catch {}
        if (!pluginMap) {
          // fallback to local stub only; do NOT attempt legacy virtual module to avoid CORS noise
          try {
            const local = await import('./virtual/plugin-map');
            pluginMap = (local as any)?.pluginMap || {};
          } catch {
            pluginMap = {} as any;
          }
        }
        if (!pluginMap) pluginMap = {} as any;

        // Worker overrides: force worker-safe entries for known plugins
        const workerOverrides: Record<string, () => Promise<unknown>> = {
          // Use package subpath exports to avoid importing TS sources directly
          location: async () => import('@hierarchidb/location-plugin/worker'),
          project: async () => import('@hierarchidb/project-plugin/worker'),
          route: async () => import('@hierarchidb/route-plugin/worker'),
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
            console.log(`[Worker] wiring: denylisted plugin skipped: ${nodeType}`);
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
              if ((import.meta as any)?.env?.DEV || soft) {
                console.log(`[Worker] wiring: skip module for ${nodeType}:`, msg);
              } else {
                console.warn(`[Worker] wiring: failed to load module for ${nodeType}:`, msg);
              }
            }
          }
        }
        await wirePluginsFromModules(modEntries);
      }
    } catch (e) {
      console.warn('[Worker] wiring failed:', e);
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
              } catch {}
            }
          }
        }
      } catch {}

      const { WorkerService } = await import('@hierarchidb/runtime-worker');
      const services = await WorkerService.getSingleton(enriched || (pluginDefinitions as any[]));
      reporter.reportStepProgress('Bootstrap services', 100);

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
        // Note: delete/move/remove are available on the fuller facade below
      } as const;
      const subscriptionFacade = {
        subscribeNode: (id: any, cb: any) => subscription.subscribeNode(id, cb),
        unsubscribe: (sid: any) => subscription.unsubscribe(sid),
        unsubscribeAll: () => subscription.unsubscribeAll(),
      } as const;
      // Minimal tag facade omitted here; the full facade is exposed in the fallback branch below
      const importExportFacade = {
        importNodes: (a: any) => importExport.importNodes(a),
        exportNodes: (a: any) => importExport.exportNodes(a),
      } as const;
      const workingCopyFacade = {
        createDraftWorkingCopy: (t: any, p: any) => workingCopy.createDraftWorkingCopy(t, p),
        commitWorkingCopy: (id: any) => workingCopy.commitWorkingCopy(id),
        discardWorkingCopy: (id: any) => workingCopy.discardWorkingCopy(id),
      } as const;

      // Expose through Comlink (return proxy-marked facades to avoid structured-clone of functions)
      Comlink.expose({
        ping: () => services.ping(),
        shutdown: () => services.shutdown(),
        initialize: () => services.initialize(),
        getQueryAPI: () => Comlink.proxy(queryFacade),
        getMutationAPI: () => Comlink.proxy(mutationFacade),
        getSubscriptionAPI: () => Comlink.proxy(subscriptionFacade),
        getImportExportAPI: () => Comlink.proxy(importExportFacade),
        getWorkingCopyAPI: () => Comlink.proxy(workingCopyFacade),
        getPluginLifecycleAPI: () => Comlink.proxy(pluginLifecycle as any),
        getSystemHealth: () => services.getSystemHealth(),
      });

      reporter.reportStepProgress('Create API facade', 100);
      reporter.reportStepProgress('Expose API', 100);
      // Ensure UI receives INIT_COMPLETE in all code paths
      reporter.reportComplete();
      return;
    } catch {}

    const { WorkerService } = await import('@hierarchidb/runtime-worker');
    const services = await WorkerService.getSingleton((pluginDefinitions as any[]) || []);
    reporter.reportStepProgress('Bootstrap services', 100);

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
      getNode: (id: any) => query.getNode(id),
      listChildren: (id: any) => query.listChildren(id),
      listDescendants: (id: any, maxDepth?: number) => query.listDescendants(id, maxDepth),
      listAncestors: (id: any) => query.listAncestors(id),
      searchNodes: (opts: any) => query.searchNodes(opts),
    };

    const mutationFacade = {
      createNode: (args: any) => mutation.createNode(args),
      updateNode: (args: any) => mutation.updateNode(args),
      removeNodes: (nodeIds: any[]) => mutation.removeNodes(nodeIds as any),
      moveNodes: (nodeIds: any[], toParentId: any, onNameConflict?: 'error' | 'auto-rename') =>
        mutation.moveNodes({ nodeIds: nodeIds as any, toParentId, onNameConflict }),
      duplicateNodes: (nodeIds: any[], toParentId?: any) => mutation.duplicateNodes({
        nodeIds: nodeIds as any,
        toParentId,
      }),
      moveNodesToTrash: (nodeIds: any[]) => mutation.moveNodesToTrash(nodeIds as any),
      recoverNodesFromTrash: (nodeIds: any[], toParentId?: any) => mutation.recoverNodesFromTrash({
        nodeIds: nodeIds as any,
        toParentId,
      }),
    };

    const subscriptionFacade = {
      subscribe: (...args: any[]) => (subscription as any).subscribe?.(...args),
      unsubscribe: (...args: any[]) => (subscription as any).unsubscribe?.(...args),
      unsubscribeAll: () => subscription.unsubscribeAll(),
    } as any;

    const tagFacade = {
      getAllTags: () => tag.getAllTags(),
      createTag: (request: any) => tag.createTag(request),
      deleteTag: (id: any) => tag.deleteTag(id),
      addTagToNode: (req: any) => tag.addTagToNode(req),
      removeTagFromNode: (req: any) => tag.removeTagFromNode(req),
      getTagsForNode: (nodeId: any) => tag.getTagsForNode(nodeId),
      getTag: (id: any) => tag.getTag(id),
      updateTag: (id: any, updates: any) => tag.updateTag(id, updates),
      searchTags: (q: string) => tag.searchTags(q),
      getTagSuggestions: (q: string, limit = 10) => tag.getTagSuggestions(q, limit),
      getTagStats: () => tag.getTagStats(),
      getNodesByTag: (id: any) => tag.getNodesByTag(id),
    };

    const importExportFacade = {
      importNodes: (p: any) => importExport.importNodes(p),
      exportNodes: (p: any) => importExport.exportNodes(p),
      validateImportData: (p: any) => importExport.validateImportData(p),
      getOperationStatus: (id: string) => importExport.getOperationStatus(id),
    };

    const workingCopyFacade = {
      createDraftWorkingCopy: (nodeType: any, parentId: any, initial?: any) =>
        workingCopy.createDraftWorkingCopy(nodeType, parentId, initial),
      createWorkingCopyFromNode: (nodeId: any) => workingCopy.createWorkingCopyFromNode(nodeId),
      getWorkingCopy: (nodeId: any) => workingCopy.getWorkingCopy(nodeId),
      updateWorkingCopy: (nodeId: any, updates: any) => workingCopy.updateWorkingCopy(nodeId, updates),
      listWorkingCopies: () => workingCopy.listWorkingCopies(),
      hasWorkingCopy: (nodeId: any) => workingCopy.hasWorkingCopy(nodeId),
      commitWorkingCopy: (nodeId: any) => workingCopy.commitWorkingCopy(nodeId),
      discardWorkingCopy: (nodeId: any) => workingCopy.discardWorkingCopy(nodeId),
      discardAllWorkingCopies: () => workingCopy.discardAllWorkingCopies(),
      validateWorkingCopy: (nodeId: any) => workingCopy.validateWorkingCopy(nodeId),
      hasUnsavedChanges: (nodeId: any) => workingCopy.hasUnsavedChanges(nodeId),
      commitMultipleWorkingCopies: (nodeIds: any[]) => workingCopy.commitMultipleWorkingCopies(nodeIds as any),
      createMultipleWorkingCopies: (nodeIds: any[]) => workingCopy.createMultipleWorkingCopies(nodeIds as any),
      getWorkingCopyStats: () => workingCopy.getWorkingCopyStats(),
      cleanupOldWorkingCopies: (olderThan: number) => workingCopy.cleanupOldWorkingCopies(olderThan),
    };

    const pluginLifecycleFacade = {
      register: (p: any) => pluginLifecycle.register(p),
      unregister: (p: any) => pluginLifecycle.unregister(p),
      validatePlugin: (p: any) => pluginLifecycle.validatePlugin(p),
      checkHealth: (nodeType: any) => pluginLifecycle.checkHealth(nodeType),
      listRegistered: (options?: any) => pluginLifecycle.listRegistered(options),
      getDependencies: (n: any) => pluginLifecycle.getDependencies(n),
      bulkOperation: (p: any) => pluginLifecycle.bulkOperation(p),
      resetPlugin: (p: any) => pluginLifecycle.resetPlugin(p),
      deletePlugin: (n: any) => pluginLifecycle.deletePlugin(n),
      resetSystem: (createBackup?: boolean) => pluginLifecycle.resetSystem(createBackup),
    };

    const api: any = {
      ping: () => services.ping(),
      initialize: () => services.initialize(),
      shutdown: () => services.shutdown(),
      getSystemHealth: () => services.getSystemHealth(),
      getQueryAPI: () => Comlink.proxy(queryFacade),
      getMutationAPI: () => Comlink.proxy(mutationFacade),
      getSubscriptionAPI: () => Comlink.proxy(subscriptionFacade),
      getWorkingCopyAPI: () => Comlink.proxy(workingCopyFacade),
      getPluginLifecycleAPI: () => Comlink.proxy(pluginLifecycleFacade),
      getImportExportAPI: () => Comlink.proxy(importExportFacade),
      getTagAPI: () => Comlink.proxy(tagFacade),
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

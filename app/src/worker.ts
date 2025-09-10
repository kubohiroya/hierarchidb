/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import { WorkerInitializationReporter } from '@hierarchidb/runtime-worker-bootstrap';
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

    // Step 2: Load plugin loader virtual modules
    reporter.reportStepProgress('Load plugin loaders', 10);
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

    // Step 3: Load plugins (100% reached in loops above)
    reporter.reportStepProgress('Load plugins', 100);

    // Step 4: Bootstrap services
    reporter.reportStepProgress('Bootstrap services', 10);

    // Register shared download/auth + optional runtime workers for plugins (flagged, safe to ignore on failure)
    try {
      const isFlagEnabled = (name: string, fallback = false) => {
        const g: any = (globalThis as any);
        const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
        const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
        const v = ls?.getItem(name) ?? g?.[name] ?? env?.[name];
        if (v == null) return fallback;
        const s = String(v).toLowerCase();
        return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
      };

      // Location plugin wiring (download DI + auth notifier always; runtime worker behind flag)
      try {
        const loc = await import('@hierarchidb/location-plugin');
        // Download service shared registration (opt-in defaults)
        const locPhc = Number((globalThis as any)['LOCATION_PER_HOST_CONCURRENCY'] || (typeof localStorage !== 'undefined' && localStorage.getItem('LOCATION_PER_HOST_CONCURRENCY')) || (typeof process !== 'undefined' && (process as any).env?.LOCATION_PER_HOST_CONCURRENCY) || 4);
        loc.registerLocationSharedDownloadService({ perHostConcurrency: isFinite(locPhc) ? locPhc : 4 });
        // Auth notifier (bridge to global registry if present)
        loc.registerLocationAuthNotifier?.((info: any) => {
          try {
            const g: any = globalThis as any;
            const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
            reg?.onAuthRequired?.(info);
          } catch { /* noop */ }
        });
        // Runtime worker adapters (flag LOCATION_RUNTIME_WORKER)
        if (isFlagEnabled('LOCATION_RUNTIME_WORKER', false)) {
          await loc.registerLocationRuntimeWorkerAdapters?.();
        }
      } catch { /* location wiring optional */ }

      // Route plugin wiring
      try {
        const route = await import('@hierarchidb/route-plugin');
        const rPhc = Number((globalThis as any)['ROUTE_PER_HOST_CONCURRENCY'] || (typeof localStorage !== 'undefined' && localStorage.getItem('ROUTE_PER_HOST_CONCURRENCY')) || (typeof process !== 'undefined' && (process as any).env?.ROUTE_PER_HOST_CONCURRENCY) || 4);
        route.registerRouteSharedDownloadService({ perHostConcurrency: isFinite(rPhc) ? rPhc : 4 });
        route.registerRouteAuthNotifier?.((info: any) => {
          try {
            const g: any = globalThis as any;
            const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
            reg?.onAuthRequired?.(info);
          } catch { /* noop */ }
        });
        if (isFlagEnabled('ROUTE_RUNTIME_WORKER', false)) {
          await route.registerRouteRuntimeWorkerAdapters?.();
        }
      } catch { /* route wiring optional */ }
    } catch { /* wiring block ignored on failure */ }
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

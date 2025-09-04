/**
 * Worker entry point for the application
 * This file is responsible for exposing the WorkerAPI via Comlink
 */

import * as Comlink from 'comlink';
import { WorkerService } from '@hierarchidb/runtime-worker';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerInitializationReporter } from '@hierarchidb/runtime-worker-bootstrap';
import { autoLoadPlugins } from './plugins/auto-load';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

console.log('[App Worker] Starting initialization...');

// Create initialization reporter to notify UI when Worker is ready
const initReporter = new WorkerInitializationReporter();

// Initialize Worker with Bootstrap
async function initializeWorker() {
  try {
    console.log('[App Worker] Loading plugins via virtual modules...');
    initReporter.reportStepProgress('Loading plugins...', 5);
    await autoLoadPlugins();

    // Load virtual module after package-reader plugin has generated it
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { default: pluginDefinitions } = await import('virtual:plugin-definitions');

    console.log('[App Worker] Bootstrapping worker services...');
    initReporter.reportStepProgress('Bootstrapping worker services...', 10);
    // Initialize WorkerService singleton with discovered plugins
    const services = await WorkerService.getSingleton((pluginDefinitions as any[]) || []);
    
    console.log('[App Worker] Creating WorkerService facade...');
    initReporter.reportStepProgress('Creating WorkerService facade...', 80);
    
    const workerService = services;
    
    console.log('[App Worker] Exposing WorkerAPI via Comlink...');
    initReporter.reportStepProgress('Exposing WorkerAPI via Comlink...', 95);
    // Build a plain function-based API facade to avoid exposing class instance
    const api: WorkerAPI = {
      // Health and lifecycle
      ping: () => workerService.ping(),
      initialize: () => workerService.initialize(),
      shutdown: () => workerService.shutdown(),
      getSystemHealth: () => workerService.getSystemHealth(),

      // Facaded sub-APIs (Comlink will proxy returned objects)
      getQueryAPI: () => workerService.getQueryAPI(),
      getMutationAPI: () => workerService.getMutationAPI(),
      getSubscriptionAPI: () => workerService.getSubscriptionAPI(),
      getWorkingCopyAPI: () => workerService.getWorkingCopyAPI(),
      getPluginLifecycleAPI: () => workerService.getPluginLifecycleAPI(),
      getImportExportAPI: () => workerService.getImportExportAPI(),
      getTagAPI: () => workerService.getTagAPI(),
    };

    // Expose via Comlink; Comlink typings are permissive, avoid `any`.
    Comlink.expose(api as unknown);
    
    
    console.log('[App Worker] Worker ready');
    initReporter.reportComplete();
    
  } catch (error) {
    console.error('[App Worker] Initialization failed:', error);
    initReporter.reportError(error instanceof Error ? error.message : 'Worker initialization failed');
    throw error;
  }
}

// Start initialization
initializeWorker();

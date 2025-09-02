/**
 * Worker entry point for the application
 * This file is responsible for exposing the WorkerAPI via Comlink
 */

import * as Comlink from 'comlink';
import { WorkerService } from '@hierarchidb/runtime-worker-worker';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerInitializationReporter } from '@hierarchidb/runtime-worker-worker-bootstrap';
import { Bootstrap } from '@hierarchidb/runtime-worker-worker';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

console.log('[App Worker] Starting initialization...');

// Create initialization reporter to notify UI when Worker is ready
const initReporter = new WorkerInitializationReporter();

// Initialize Worker with Bootstrap
async function initializeWorker() {
  try {
    console.log('[App Worker] Bootstrapping worker services...');
    initReporter.reportStepProgress('Bootstrapping worker services...', 10);
    
    // Bootstrap all services
    const bootstrap = new Bootstrap(appName);
    const services = await bootstrap.initialize();
    
    console.log('[App Worker] Creating WorkerService facade...');
    initReporter.reportStepProgress('Creating WorkerService facade...', 80);
    
    // Create WorkerService as the facade (internal implementation)
    const workerService = new WorkerService(services);
    
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

    // Expose via Comlink with explicit contract
    Comlink.expose<WorkerAPI>(api);
    
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

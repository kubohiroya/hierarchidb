/**
 * Worker entry point for the application
 * 新しいWorkerServiceを使用したシンプルな実装
 */

import * as Comlink from 'comlink';
import { WorkerBootstrap } from '@hierarchidb/runtime-worker-worker/1-bootstrap/WorkerBootstrap';
import { WorkerInitializationReporter } from '@hierarchidb/runtime-worker-worker-init-notifier';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

console.log('[App Worker] Starting initialization...');

// Create initialization reporter
const initReporter = new WorkerInitializationReporter();

// Initialize Worker
async function initialize() {
  try {
    initReporter.reportStepProgress('Starting Worker bootstrap...', 10);
    
    // 新しいブートストラップを使用
    const bootstrap = new WorkerBootstrap();
    await bootstrap.initialize();
    
    initReporter.reportStepProgress('Worker initialized successfully', 90);
    initReporter.reportComplete();
    
    console.log('[App Worker] Worker ready');
    
  } catch (error) {
    console.error('[App Worker] Initialization failed:', error);
    initReporter.reportError(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Start initialization
initialize();
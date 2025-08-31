/**
 * Workerエントリーポイント
 * 段階的移行をサポートする実装
 */

// 環境変数で新旧切り替え
const USE_NEW_BOOTSTRAP = process.env.USE_NEW_BOOTSTRAP === 'true';

async function initializeWorker() {
  console.log('[Worker] Initializing...');
  
  if (USE_NEW_BOOTSTRAP) {
    // 新しいブートストラップ方式
    console.log('[Worker] Using new bootstrap system');
    const { WorkerEntryPoint } = await import('./1-bootstrap/WorkerEntryPoint');
    // WorkerEntryPointは自動的に初期化を開始
  } else {
    // 既存の方式（段階的移行のため維持）
    console.log('[Worker] Using legacy bootstrap system');
    const { LegacyBootstrapper } = await import('./1-bootstrap/LegacyBootstrapper');
    
    const bootstrapper = new LegacyBootstrapper();
    await bootstrapper.bootstrapWithLegacy();
  }
  
  console.log('[Worker] Initialization complete');
}

// Worker初期化を開始
initializeWorker().catch(error => {
  console.error('[Worker] Failed to initialize:', error);
  
  // エラーをメインスレッドに通知
  if (typeof self !== 'undefined' && self.postMessage) {
    self.postMessage({
      type: 'worker-error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }
});
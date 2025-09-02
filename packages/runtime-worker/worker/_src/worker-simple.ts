/**
 * シンプルなWorkerエントリーポイント
 * 必要最小限の初期化のみ
 */

import { SimpleBootstrapper } from './1-bootstrap/SimpleBootstrapper';

// Workerコンテキストの型定義
declare const self: DedicatedWorkerGlobalScope;

// ブートストラッパーを作成して初期化
const bootstrapper = new SimpleBootstrapper();

bootstrapper.bootstrap().catch(error => {
  console.error('[Worker] Bootstrap failed:', error);
  self.close();
});
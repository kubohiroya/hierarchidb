/**
 * Vitest Setup for Worker Tests
 * 
 * Node環境でWeb Worker APIとIndexedDB APIをエミュレートし、
 * UIなしで統合テストを実行可能にします。
 */

import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';

// IndexedDB API のセットアップ（fake-indexeddb/autoで自動設定済み）

// Comlink のモック設定
// Node環境ではWeb Workerが存在しないため、Comlinkの機能を直接実行
const comlinkMock = {
  wrap: <T>(target: any): T => {
    // Worker APIをそのまま返す（プロキシなし）
    return target as T;
  },
  expose: (api: any) => {
    // Node環境では何もしない
    return api;
  },
  transfer: (obj: any, _transfers?: any[]) => obj,
  transferHandlers: new Map(),
  proxy: <T>(obj: T): T => obj,
  windowEndpoint: (window: any) => window,
  createEndpoint: () => ({}),
  releaseProxy: () => {},
};

vi.mock('comlink', () => comlinkMock);

// Worker環境のモック
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis as any;
}

// Web Worker のモック
class WorkerMock {
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(public url: string | URL, public options?: WorkerOptions) {}
  
  postMessage(message: any, _transfer?: Transferable[]): void {
    // メッセージ処理のシミュレーション
    setTimeout(() => {
      const handlers = this.listeners.get('message') || [];
      handlers.forEach(handler => handler({ data: message }));
    }, 0);
  }
  
  addEventListener(type: string, listener: Function): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  removeEventListener(type: string, listener: Function): void {
    const handlers = this.listeners.get(type) || [];
    const index = handlers.indexOf(listener);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
  
  terminate(): void {
    this.listeners.clear();
  }
}

// Worker をグローバルに設定
if (typeof Worker === 'undefined') {
  (globalThis as any).Worker = WorkerMock;
}

// structuredClone のポリフィル（Node v17未満の場合）
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// テスト環境のクリーンアップヘルパー
export async function clearAllDatabases(): Promise<void> {
  const databases = await indexedDB.databases?.() || [];
  for (const db of databases) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(db.name!);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    }
  }
}

// 各テストの前にデータベースをクリア
beforeEach(async () => {
  await clearAllDatabases();
});

// console.errorのモック（エラーの追跡用）
global.console.error = vi.fn();

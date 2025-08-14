import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// グローバルにIndexedDBをセットアップ
if (typeof globalThis.indexedDB === 'undefined') {
  const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
  const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

  globalThis.indexedDB = new FDBFactory();
  globalThis.IDBKeyRange = FDBKeyRange;
}

// Worker環境のモック
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis as any;
}

// console.errorのモック（必要に応じて）
global.console.error = vi.fn();

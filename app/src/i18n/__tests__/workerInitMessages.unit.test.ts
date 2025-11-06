import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getWorkerInitCompleteMessage,
  getWorkerInitFallbackMessage,
  getWorkerInitStartMessage,
} from '../workerInitMessages.js';

type MockI18n = {
  t: (key: string, options?: { defaultValue?: string }) => string;
};

const setMockI18n = (impl: MockI18n | null) => {
  const globalWithI18n = globalThis as typeof globalThis & { i18next?: MockI18n | null };
  if (impl) {
    globalWithI18n.i18next = impl;
  } else {
    delete globalWithI18n.i18next;
  }
};

describe('workerInitMessages', () => {
  let originalI18n: MockI18n | undefined;

  beforeEach(() => {
    const globalWithI18n = globalThis as typeof globalThis & { i18next?: MockI18n };
    originalI18n = globalWithI18n.i18next;
    setMockI18n(null);
  });

  afterEach(() => {
    const globalWithI18n = globalThis as typeof globalThis & { i18next?: MockI18n };
    if (originalI18n) {
      globalWithI18n.i18next = originalI18n;
    } else {
      delete globalWithI18n.i18next;
    }
  });

  it('falls back to default strings when i18n is unavailable', () => {
    expect(getWorkerInitStartMessage()).toContain('Starting worker initialization');
    expect(getWorkerInitCompleteMessage()).toContain('Worker initialization complete');
    expect(getWorkerInitFallbackMessage()).toContain('Worker initializing');
  });

  it('returns translated strings when i18n is available', () => {
    setMockI18n({
      t: (key, options) => {
        switch (key) {
          case 'workerInit.messages.start':
            return 'Worker 初期化開始';
          case 'workerInit.messages.complete':
            return 'Worker 初期化完了';
          case 'workerInit.progressFallback':
            return 'Worker 初期化中';
          default:
            return options?.defaultValue ?? key;
        }
      },
    });

    expect(getWorkerInitStartMessage()).toBe('Worker 初期化開始');
    expect(getWorkerInitCompleteMessage()).toBe('Worker 初期化完了');
    expect(getWorkerInitFallbackMessage()).toBe('Worker 初期化中');
  });
});

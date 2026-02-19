import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkerClientProxy } from '~/worker-runtime/WorkerClientProxy';
import { WorkerProvider } from './WorkerProvider.tsx';

const ensureInitializedMock = vi.fn(() => new Promise<never>(() => {}));
let runtimeState: 'uninitialized' | 'initializing' | 'ready' | 'failed' = 'uninitialized';

const proxyMock: WorkerClientProxy = {
  ensureInitialized: ensureInitializedMock,
  getCachedClient: () => null,
  getState: () => 'uninitialized',
  getLastError: () => null,
  getProgress: () => ({ progress: 0, message: 'Starting worker initialization…' }),
  subscribe: () => () => {},
  subscribeProgress: () => () => {},
};

vi.mock('@hierarchidb/ui-plugin-shell/ui-i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/useWorkerRuntimeProxy.js', () => ({
  useWorkerRuntimeProxy: () => ({
    proxy: proxyMock,
    state: runtimeState,
    error: null,
  }),
}));

vi.mock('../worker-runtime/workerApiClientLoader.js', () => ({
  getWorkerAPIClientModule: () => null,
  loadWorkerAPIClientModule: async () => ({
    WorkerAPIClient: {
      getOrInit: async () => null,
      reset: () => {},
      isReady: () => false,
    },
  }),
}));

vi.mock('../worker-runtime/WorkerStateStore.js', () => ({
  resetWorkerState: () => {},
}));

describe('WorkerProvider initialization remount behavior', () => {
  afterEach(() => {
    cleanup();
    ensureInitializedMock.mockClear();
    runtimeState = 'uninitialized';
  });

  it('does not restart initialization on remount while shared runtime is already initializing', async () => {
    const first = render(
      <WorkerProvider renderOverlay={false} fallback={null}>
        <div data-testid="content">content</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(ensureInitializedMock.mock.calls.length).toBeGreaterThan(0);
    });
    const firstMountCalls = ensureInitializedMock.mock.calls.length;

    runtimeState = 'initializing';
    first.unmount();

    render(
      <WorkerProvider renderOverlay={false} fallback={null}>
        <div data-testid="content">content</div>
      </WorkerProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ensureInitializedMock.mock.calls.length).toBe(firstMountCalls);
  });
});

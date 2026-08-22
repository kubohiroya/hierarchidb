import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildWorkerAPI } from '../../types/workerApiTypes';
import type { WorkerClientProxy } from '../../worker-runtime/WorkerClientProxy';
import { WorkerProvider } from '../WorkerProvider';

const setUiStorageBridgeMock = vi.fn();
const workerClient = {
  setUiStorageBridge: setUiStorageBridgeMock,
} as unknown as BuildWorkerAPI;
const ensureInitializedMock = vi.fn(async () => workerClient);

const proxyMock: WorkerClientProxy = {
  ensureInitialized: ensureInitializedMock,
  getCachedClient: () => null,
  getState: () => 'uninitialized',
  getLastError: () => null,
  getProgress: () => ({ progress: 0, message: 'Starting worker initialization…' }),
  subscribe: () => () => {},
  subscribeProgress: () => () => {},
};

vi.mock('@hierarchidb/ui-plugin-shell/ui-auth', () => ({
  AUTH_SESSION_CHANGED_EVENT: 'hierarchidb:auth-session-changed',
  createAuthSessionStorageBridge: () => ({
    getItem: async () => null,
    removeItem: async () => undefined,
  }),
}));

vi.mock('@hierarchidb/ui-plugin-shell/ui-i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/useWorkerRuntimeProxy.js', () => ({
  useWorkerRuntimeProxy: () => ({
    proxy: proxyMock,
    state: 'uninitialized',
    error: null,
  }),
}));

vi.mock('../../worker-runtime/workerApiClientLoader.js', () => ({
  getWorkerAPIClientModule: () => null,
  loadWorkerAPIClientModule: async () => ({
    WorkerAPIClient: {
      getOrInit: async () => workerClient,
      reset: () => undefined,
      isReady: () => false,
    },
  }),
}));

vi.mock('../../worker-runtime/WorkerStateStore.js', () => ({
  resetWorkerState: () => undefined,
}));

describe('WorkerProvider auth bridge readiness', () => {
  beforeEach(() => {
    setUiStorageBridgeMock.mockReset();
    ensureInitializedMock.mockClear();
    delete window.__HDB_WORKER_CLIENT_REF__;
    delete window.__HDB_INIT_COMPLETE__;
    delete window.__HDB_INIT_STARTED__;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not publish children before auth bridge registration completes', async () => {
    let resolveBridge: (() => void) | undefined;
    setUiStorageBridgeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBridge = resolve;
        })
    );

    render(
      <WorkerProvider renderOverlay={false} fallback={null}>
        <div data-testid="ready-content">ready</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(setUiStorageBridgeMock).toHaveBeenCalledOnce();
    });
    expect(screen.queryByTestId('ready-content')).toBeNull();
    expect(window.__HDB_WORKER_CLIENT_REF__?.isInitialized).toBe(false);

    if (!resolveBridge) throw new Error('Bridge resolver was not initialized');
    resolveBridge();

    await waitFor(() => {
      expect(screen.getByTestId('ready-content')).toBeDefined();
      expect(window.__HDB_WORKER_CLIENT_REF__?.isInitialized).toBe(true);
    });
  });

  it('surfaces auth bridge registration failures as worker initialization errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setUiStorageBridgeMock.mockRejectedValue(new Error('auth bridge registration failed'));

    render(
      <WorkerProvider renderOverlay>
        <div data-testid="ready-content">ready</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('auth bridge registration failed')).toBeDefined();
    });
    expect(screen.queryByTestId('ready-content')).toBeNull();
    expect(window.__HDB_WORKER_CLIENT_REF__?.isInitialized).toBe(false);
  });

  it('re-registers the bridge after the canonical auth session changes', async () => {
    setUiStorageBridgeMock.mockResolvedValue(undefined);

    render(
      <WorkerProvider renderOverlay={false} fallback={null}>
        <div data-testid="ready-content">ready</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready-content')).toBeDefined();
      expect(setUiStorageBridgeMock).toHaveBeenCalledOnce();
    });
    window.dispatchEvent(new Event('hierarchidb:auth-session-changed'));

    await waitFor(() => {
      expect(setUiStorageBridgeMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a retryable terminal error when post-ready bridge registration fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setUiStorageBridgeMock.mockResolvedValueOnce(undefined);

    render(
      <WorkerProvider renderOverlay={false} fallback={null}>
        <div data-testid="ready-content">ready</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready-content')).toBeDefined();
    });
    setUiStorageBridgeMock.mockRejectedValueOnce(new Error('session bridge refresh failed'));
    window.dispatchEvent(new Event('hierarchidb:auth-session-changed'));

    await waitFor(() => {
      expect(screen.getByText('session bridge refresh failed')).toBeDefined();
      expect(screen.getByRole('button', { name: 'workerInit.error.actions.retry' })).toBeDefined();
    });
    expect(screen.queryByTestId('ready-content')).toBeNull();
  });

  it('processes a later session event after an earlier registration fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setUiStorageBridgeMock.mockResolvedValueOnce(undefined);

    render(
      <WorkerProvider renderOverlay fallback={null}>
        <div data-testid="ready-content">ready</div>
      </WorkerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready-content')).toBeDefined();
      expect(setUiStorageBridgeMock).toHaveBeenCalledOnce();
    });

    let rejectEarlierRegistration: ((error: Error) => void) | undefined;
    setUiStorageBridgeMock
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectEarlierRegistration = reject;
          })
      )
      .mockResolvedValueOnce(undefined);

    window.dispatchEvent(new Event('hierarchidb:auth-session-changed'));
    await waitFor(() => {
      expect(setUiStorageBridgeMock).toHaveBeenCalledTimes(2);
    });
    window.dispatchEvent(new Event('hierarchidb:auth-session-changed'));
    expect(setUiStorageBridgeMock).toHaveBeenCalledTimes(2);

    if (!rejectEarlierRegistration) {
      throw new Error('Earlier bridge registration was not started');
    }
    rejectEarlierRegistration(new Error('superseded session bridge failed'));

    await waitFor(() => {
      expect(setUiStorageBridgeMock).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('ready-content')).toBeDefined();
      expect(screen.queryByText('superseded session bridge failed')).toBeNull();
    });
  });
});

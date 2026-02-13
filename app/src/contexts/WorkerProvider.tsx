/**
 * WorkerProvider – React context for the shared worker lifecycle.
 *
 * Exposes initialization progress, errors, and the `WorkerClientRef` bundle
 * to any descendant component while coordinating suspense for the worker
 * bootstrap flow so that consumers never observe a null client reference.
 */

import type { WorkerAPI } from '~/types/worker-api.js';
import { useTranslation } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import type { WorkerInitializationChannel } from '@hierarchidb/ui-worker-client';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { Remote } from 'comlink';
import * as Comlink from 'comlink';
import React, {
  type CSSProperties,
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type BootWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
  __HDB_INIT_STARTED__?: boolean;
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'error' in (error as Record<string, unknown>)) {
    const inner = (error as Record<string, unknown>).error;
    return normalizeError(inner);
  }
  return new Error(String(error));
}

import {
  getWorkerInitCompleteMessage,
  getWorkerInitFallbackMessage,
  getWorkerInitStartMessage,
} from '~/i18n/workerInitMessages.js';
import type { WorkerInitializationProgress } from '~/worker-runtime/WorkerClientProxy.ts';
import { useWorkerRuntimeProxy } from '../hooks/useWorkerRuntimeProxy.js';
import { bootLog } from '../utils/bootLog.ts';
import { resetWorkerState } from '../worker-runtime/WorkerStateStore.js';
import {
  getWorkerAPIClientModule,
  loadWorkerAPIClientModule,
} from '../worker-runtime/workerApiClientLoader.js';
import { useOptionalBootProgress } from './BootProgressProvider.js';

const logWorkerProviderWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  if (error === undefined) {
    console.warn('[WorkerProvider]', message);
  } else {
    console.warn('[WorkerProvider]', message, error);
  }
};

const getWorkerClientClass = () => getWorkerAPIClientModule()?.WorkerAPIClient ?? null;

const isWorkerClientReady = (): boolean => {
  const Client = getWorkerClientClass();
  return Client ? Client.isReady() : false;
};

const resetWorkerClient = () => {
  const Client = getWorkerClientClass();
  if (Client) {
    Client.reset();
    return;
  }
  void loadWorkerAPIClientModule()
    .then(({ WorkerAPIClient }) => {
      WorkerAPIClient.reset();
    })
    .catch((error) => {
      logWorkerProviderWarning('Failed to reset WorkerAPIClient (lazy load)', error);
    });
};

type WorkerStatusState = {
  client: Remote<WorkerAPI> | null;
  isInitialized: boolean;
  initProgress: number;
  initMessage: string;
  error: Error | null;
};

type WorkerContextValue = WorkerClientRef;

type WorkerProviderProps = {
  children: ReactNode;
  timeout?: number;
  debug?: boolean;
  renderOverlay?: boolean;
  fallback?: ReactNode | null;
};

const WorkerContext = createContext<WorkerContextValue | null>(null);

const noopAsync = async () => undefined;
const noopSync = () => undefined;
const DEFAULT_WORKER_INIT_TIMEOUT_MS = 30_000;

const createFallbackWorkerClient = (): Remote<WorkerAPI> => {
  const services = {
    modals: {
      open: noopAsync,
      close: noopSync,
      register: noopSync,
      unregister: noopSync,
    },
  };

  const tagApi = {
    getAllTags: async () => [],
    getTag: async () => null,
    createTag: async () => ({ id: 'stub', name: 'stub' }),
    updateTag: noopAsync,
    deleteTag: noopAsync,
  };

  return {
    services,
    getTagAPI: async () => tagApi,
  } as unknown as Remote<WorkerAPI>;
};

const noopWorkerClient = createFallbackWorkerClient();

const fallbackWorkerContextValue: WorkerContextValue = {
  client: noopWorkerClient,
  isInitialized: false,
  isConnected: false,
  initProgress: 0,
  initMessage: getWorkerInitFallbackMessage(),
  error: new Error('WorkerProvider context missing'),
  initialize: async () => {
    if (typeof console !== 'undefined') {
      console.warn('[WorkerProvider] initialize() called without provider; request ignored.');
    }
  },
  reset: () => {
    if (typeof console !== 'undefined') {
      console.warn('[WorkerProvider] reset() called without provider; request ignored.');
    }
  },
  getAPI: () => noopWorkerClient,
};

function useBootProgressSafe() {
  return useOptionalBootProgress();
}

const overlayContainerStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#ffffff',
  zIndex: 2000,
  padding: '24px',
};

const overlayCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  borderRadius: 12,
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
  padding: '24px',
  backgroundColor: '#ffffff',
};

const overlayHeadingStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  marginBottom: 12,
  color: '#0d47a1',
};

const overlayBodyStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 8,
  fontSize: '14px',
  color: '#37474f',
  lineHeight: 1.5,
};

const overlayCaptionStyle: CSSProperties = {
  fontSize: '12px',
  color: '#607d8b',
};

const progressTrackStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 8,
  borderRadius: 4,
  overflow: 'hidden',
  backgroundColor: '#e3f2fd',
};

const progressBarStyle = (value: number): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  width: `${Math.max(0, Math.min(100, value))}%`,
  backgroundColor: '#1976d2',
  transition: 'width 160ms ease-out',
});

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: 500,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#1976d2',
  color: '#ffffff',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#607d8b',
};

type WorkerClientGateProps = {
  status: WorkerStatusState;
  renderOverlay: boolean;
  onRetry: () => void;
  children: ReactNode;
};

function WorkerClientGate({
  status,
  renderOverlay,
  onRetry,
  children,
}: WorkerClientGateProps) {
  if (status.error) {
    return renderOverlay ? <ErrorOverlay error={status.error} onRetry={onRetry} /> : null;
  }

  if (!status.client || !status.isInitialized) {
    return renderOverlay ? (
      <InitializingOverlay progress={status.initProgress} message={status.initMessage} />
    ) : null;
  }

  return <>{children}</>;
}

function InitializingOverlay({ progress, message }: { progress: number; message?: string | null }) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const resolvedMessage = message?.trim().length ? message : t('workerInit.progressFallback');
  return (
    <div style={overlayContainerStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeadingStyle}>{t('workerInit.heading')}</div>
        <div style={progressTrackStyle}>
          <div style={progressBarStyle(clamped)} />
        </div>
        <div style={overlayBodyStyle}>{resolvedMessage}</div>
        <div style={overlayCaptionStyle}>{t('workerInit.progressLabel', { value: clamped })}</div>
      </div>
    </div>
  );
}

function ErrorOverlay({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={overlayContainerStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeadingStyle}>{t('workerInit.error.title')}</div>
        <div style={overlayBodyStyle}>{error.message || t('workerInit.error.unknown')}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" style={buttonStyle} onClick={onRetry}>
            {t('workerInit.error.actions.retry')}
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => window.location.reload()}
          >
            {t('workerInit.error.actions.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __HDB_WORKER_CLIENT_REF__?: WorkerContextValue;
  }
}

export const WorkerProvider = ({
  children,
  timeout = DEFAULT_WORKER_INIT_TIMEOUT_MS,
  debug = false,
  renderOverlay = true,
  fallback = null,
}: WorkerProviderProps) => {
  const bootProgress = useBootProgressSafe();
  const { t } = useTranslation();
  const { proxy, state: proxyState, error: proxyError } = useWorkerRuntimeProxy();
  const initialProgress = proxy.getProgress();
  const [status, setStatus] = useState<WorkerStatusState>(() => ({
    client: proxy.getCachedClient(),
    isInitialized: proxyState === 'ready',
    initProgress: initialProgress.progress,
    initMessage: initialProgress.message ?? getWorkerInitStartMessage(),
    error: proxyError,
  }));
  const initChannelRef = useRef<WorkerInitializationChannel | null>(null);
  const latestProgressRef = useRef(0);
  const latestProgressMessageRef = useRef(getWorkerInitStartMessage());
  const lastLoggedProgressRef = useRef(-1);
  const lastLoggedMessageRef = useRef('');
  const initializationInFlightRef = useRef<Promise<void> | null>(null);
  const completionMarkedRef = useRef(false);
  const lastAuthTokenRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setStatus({
      client: null,
      isInitialized: false,
      initProgress: 0,
      initMessage: getWorkerInitStartMessage(),
      error: null,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = proxy.subscribeProgress((detail: WorkerInitializationProgress) => {
      const progressMessage = detail.message ?? getWorkerInitFallbackMessage();
      latestProgressRef.current = detail.progress;
      latestProgressMessageRef.current = progressMessage;
      const normalizedProgress = Math.max(0, Math.min(100, Math.round(detail.progress)));
      const shouldLogProgress =
        normalizedProgress <= 0
        || normalizedProgress >= 100
        || Math.abs(normalizedProgress - lastLoggedProgressRef.current) >= 10
        || progressMessage !== lastLoggedMessageRef.current;
      if (shouldLogProgress) {
        lastLoggedProgressRef.current = normalizedProgress;
        lastLoggedMessageRef.current = progressMessage;
        console.info('[WorkerProvider] init progress', {
          progress: normalizedProgress,
          message: progressMessage,
        });
      }
      setStatus((prev) => ({
        ...prev,
        initProgress: detail.progress,
        initMessage: progressMessage,
      }));
      bootProgress?.setStepProgress('Worker', detail.progress, progressMessage);
    });
    return unsubscribe;
  }, [proxy, bootProgress]);
  useEffect(() => {
    setStatus((prev) => {
      let next = prev;
      let changed = false;

      if (proxyState === 'ready') {
        const client = proxy.getCachedClient();
        if (client && (!prev.client || !prev.isInitialized)) {
          next = {
            ...prev,
            client,
            isInitialized: true,
            initProgress: 100,
            initMessage: getWorkerInitCompleteMessage(),
            error: proxyError ?? null,
          };
          changed = true;
        }
      } else if (proxyState === 'initializing' && prev.isInitialized) {
        next = {
          ...prev,
          isInitialized: false,
          initProgress: 0,
          initMessage: getWorkerInitStartMessage(),
        };
        changed = true;
      }

      if (proxyState === 'failed' && proxyError && prev.error !== proxyError) {
        next = { ...next, error: proxyError, isInitialized: false };
        changed = true;
      }

      if (!changed) {
        return prev;
      }
      return next;
    });
  }, [proxy, proxyState, proxyError]);

  useEffect(() => {
    if (!status.client || !status.isInitialized) return;
    if (typeof window === 'undefined') return;
    try {
      const token = localStorage.getItem('access_token') || '';
      if (!token || token === lastAuthTokenRef.current) return;
      const rawExpires = localStorage.getItem('token_expires_at');
      const expiresAt = rawExpires ? Number(rawExpires) : undefined;
      status.client
        .setAuthToken(token, 'Bearer', Number.isFinite(expiresAt) ? expiresAt : undefined)
        .catch((error: unknown) => {
          logWorkerProviderWarning('Failed to sync worker auth token', error);
        });
      lastAuthTokenRef.current = token;
    } catch (error) {
      logWorkerProviderWarning('Failed to read access_token for worker', error);
    }
  }, [status.client, status.isInitialized]);

  const storageBridgeClientRef = useRef<Remote<WorkerAPI> | null>(null);

  useEffect(() => {
    if (!status.client || !status.isInitialized) return;
    if (typeof window === 'undefined') return;
    if (storageBridgeClientRef.current === status.client) return;
    storageBridgeClientRef.current = status.client;
    const bridge = Comlink.proxy({
      getItem: async (key: string) => localStorage.getItem(key),
      setItem: async (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        localStorage.removeItem(key);
      },
    });
    status.client.setUiStorageBridge(bridge).catch((error: unknown) => {
      logWorkerProviderWarning('Failed to register UI storage bridge', error);
    });
  }, [status.client, status.isInitialized]);

  const finalizeInitialized = useCallback(async () => {
    try {
      bootLog('WorkerProvider finalize');
      const { WorkerAPIClient } = await loadWorkerAPIClientModule();
      const client = await WorkerAPIClient.getOrInit();
      latestProgressRef.current = 100;
      setStatus({
        client,
        isInitialized: true,
        initProgress: 100,
        initMessage: getWorkerInitCompleteMessage(),
        error: null,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      console.error('[WorkerProvider] finalizeInitialized error', normalized);
      setStatus((prev) => ({ ...prev, error: normalized }));
    }
  }, []);

  const markComplete = useCallback(async () => {
    if (completionMarkedRef.current) return;
    completionMarkedRef.current = true;
    const readyLabel = t('workerInit.status.ready');
    try {
      if (typeof window !== 'undefined') {
        (window as BootWindow).__HDB_INIT_COMPLETE__ = true;
      }
    } catch (error) {
      logWorkerProviderWarning('Failed to set __HDB_INIT_COMPLETE__ flag', error);
    }
    bootProgress?.setStepProgress('Worker', 100, readyLabel);
    bootProgress?.markStepDone('Worker', readyLabel);
    console.info('[WorkerProvider] initialization complete');
    await finalizeInitialized();
  }, [bootProgress, finalizeInitialized, t]);

  const runInitialization = useCallback(async () => {
    if (initializationInFlightRef.current) {
      return initializationInFlightRef.current;
    }
    const initializationTask = (async () => {
      completionMarkedRef.current = false;
      lastLoggedProgressRef.current = -1;
      lastLoggedMessageRef.current = '';
      const timeoutMs = Number.isFinite(timeout) && timeout > 0
        ? Math.floor(timeout)
        : DEFAULT_WORKER_INIT_TIMEOUT_MS;
      const currentProxyState = proxy.getState();
      console.info('[WorkerProvider] initialization started', {
        timeoutMs,
        proxyState: currentProxyState,
        debug,
      });

      bootLog('WorkerProvider initialize() start');
      latestProgressRef.current = 0;
      latestProgressMessageRef.current = getWorkerInitStartMessage();
      const initializingLabel = t('workerInit.progressFallback');
      setStatus((prev) => ({
        ...prev,
        error: null,
        initProgress: 0,
        initMessage: getWorkerInitStartMessage(),
        isInitialized: false,
      }));
      bootProgress?.setStepProgress('Worker', 0, initializingLabel);

      try {
        if (typeof window !== 'undefined') {
          (window as BootWindow).__HDB_INIT_STARTED__ = true;
        }
      } catch (error) {
        logWorkerProviderWarning('Failed to set __HDB_INIT_STARTED__ flag', error);
      }

      try {
        const abortController = new AbortController();
        const client = await new Promise<Remote<WorkerAPI>>((resolve, reject) => {
          let settled = false;
          const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            abortController.abort();
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, timeoutMs);

          proxy.ensureInitialized({ signal: abortController.signal }).then(
            (value) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeoutId);
              resolve(value);
            },
            (error) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeoutId);
              reject(error);
            }
          );
        });
        setStatus((prev) => ({
          ...prev,
          client,
          isInitialized: true,
          error: null,
        }));
        await markComplete();
      } catch (error) {
        const normalizedRaw = normalizeError(error);
        const timedOut = normalizedRaw.name === 'AbortError';
        const normalized = timedOut
          ? new Error(
            `Worker initialization timed out after ${Math.max(0, Number(timeout) || DEFAULT_WORKER_INIT_TIMEOUT_MS)}ms `
            + `(progress=${latestProgressRef.current}%, step="${latestProgressMessageRef.current}").`
          )
          : normalizedRaw;
        console.error('[WorkerProvider] ensureInitialized diagnostic', {
          timedOut,
          timeoutMs: Math.max(0, Number(timeout) || DEFAULT_WORKER_INIT_TIMEOUT_MS),
          progress: latestProgressRef.current,
          message: latestProgressMessageRef.current,
          proxyState: currentProxyState,
          hasCachedClient: Boolean(proxy.getCachedClient()),
        });
        console.error('[WorkerProvider] ensureInitialized failed', normalized);
        setStatus((prev) => ({ ...prev, error: normalized, isInitialized: false }));
        const errorLabel = normalized.message || t('workerInit.error.unknown');
        bootProgress?.setStepProgress('Worker', latestProgressRef.current, errorLabel);
      }
    })().finally(() => {
      if (initializationInFlightRef.current === initializationTask) {
        initializationInFlightRef.current = null;
      }
    });
    initializationInFlightRef.current = initializationTask;
    return initializationTask;
  }, [bootProgress, debug, markComplete, proxy, t, timeout]);

  const retryInitialization = useCallback(() => {
    bootLog('WorkerProvider retry requested');
    resetWorkerClient();
    resetWorkerState();
    completionMarkedRef.current = false;
    initializationInFlightRef.current = null;
    latestProgressRef.current = 0;
    resetState();
    const initializingLabel = t('workerInit.progressFallback');
    bootProgress?.setStepProgress('Worker', 0, initializingLabel);
    void runInitialization();
  }, [bootProgress, resetState, runInitialization, t]);

  const getAPI = useCallback((): Remote<WorkerAPI> => {
    if (!status.client) {
      throw new Error('Worker client not initialized');
    }
    return status.client;
  }, [status.client]);

  const reset = useCallback(() => {
    bootLog('WorkerProvider reset requested');
    resetWorkerClient();
    resetWorkerState();
    completionMarkedRef.current = false;
    initializationInFlightRef.current = null;
    latestProgressRef.current = 0;
    resetState();
  }, [resetState]);

  const initialize = useCallback(async () => {
    await runInitialization();
  }, [runInitialization]);

  useEffect(() => {
    bootLog('WorkerProvider mount');
    let pollTimer: number | null = null;
    let devFallbackTimer: number | null = null;

    void loadWorkerAPIClientModule().catch((error) => {
      logWorkerProviderWarning('Failed to preload WorkerAPIClient module', error);
    });

    const onInitComplete = () => {
      void markComplete();
    };

    if (typeof window !== 'undefined') {
      const globalWin = window as BootWindow & { __HDB_WORKER_EVT_BOUND__?: boolean };
      if (!globalWin.__HDB_WORKER_EVT_BOUND__) {
        globalWin.__HDB_WORKER_EVT_BOUND__ = true;
        window.addEventListener('hierarchidb-worker-init-complete', onInitComplete, { once: true });
      }
    }

    if (!status.isInitialized && !status.error) {
      if (proxyState !== 'initializing') {
        void runInitialization();
      }
    } else if (status.isInitialized || isWorkerClientReady()) {
      void markComplete();
    }

    const poll = async () => {
      try {
        if (isWorkerClientReady()) {
          await markComplete();
          if (pollTimer) window.clearInterval(pollTimer);
        }
      } catch (error) {
        logWorkerProviderWarning('Polling worker readiness failed', error);
      }
    };
    pollTimer = window.setInterval(poll, 150);

    if (import.meta.env.DEV) {
      devFallbackTimer = window.setTimeout(() => {
        if (isWorkerClientReady()) {
          void markComplete();
        }
      }, 1500);
    }

    return () => {
      initChannelRef.current?.dispose();
      initChannelRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('hierarchidb-worker-init-complete', onInitComplete);
        const globalWin = window as BootWindow & { __HDB_WORKER_EVT_BOUND__?: boolean };
        globalWin.__HDB_WORKER_EVT_BOUND__ = false;
      }
      if (pollTimer) window.clearInterval(pollTimer);
      if (devFallbackTimer) window.clearTimeout(devFallbackTimer);
    };
  }, [markComplete, proxyState, runInitialization, status.error, status.isInitialized]);

  const contextValue = useMemo<WorkerContextValue>(
    () => ({
      client: status.client,
      isInitialized: status.isInitialized,
      isConnected: Boolean(status.client && status.isInitialized),
      initProgress: status.initProgress,
      initMessage: status.initMessage,
      error: status.error,
      initialize,
      reset,
      getAPI,
    }),
    [status, getAPI, initialize, reset]
  );

  const suspenseFallback = useMemo(() => {
    if (status.error) return null;
    if (fallback) return fallback;
    if (!renderOverlay) return null;
    return <InitializingOverlay progress={status.initProgress} message={status.initMessage} />;
  }, [fallback, renderOverlay, status.error, status.initMessage, status.initProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as BootWindow & { __HDB_WORKER_CLIENT_REF__?: WorkerContextValue };
    win.__HDB_WORKER_CLIENT_REF__ = contextValue;
    return () => {
      if (win.__HDB_WORKER_CLIENT_REF__ === contextValue) {
        delete win.__HDB_WORKER_CLIENT_REF__;
      }
    };
  }, [contextValue]);

  return (
    <WorkerContext.Provider value={contextValue}>
      <Suspense fallback={suspenseFallback}>
        <WorkerClientGate
          status={status}
          renderOverlay={renderOverlay}
          onRetry={retryInitialization}
        >
          {children}
        </WorkerClientGate>
      </Suspense>
    </WorkerContext.Provider>
  );
};

export const useWorker = (): WorkerContextValue => {
  const context = useContext(WorkerContext);
  if (!context) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[WorkerProvider] useWorker invoked outside provider; returning fallback context.'
      );
    }
    return fallbackWorkerContextValue;
  }
  return context;
};

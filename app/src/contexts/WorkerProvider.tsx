/**
 * WorkerProvider – React context for the shared worker lifecycle.
 *
 * Exposes initialization progress, errors, and the `WorkerClientRef` bundle
 * to any descendant component while coordinating suspense for the worker
 * bootstrap flow so that consumers never observe a null client reference.
 */

import {
  AUTH_SESSION_CHANGED_EVENT,
  createAuthSessionStorageBridge,
} from '@hierarchidb/ui-plugin-shell/ui-auth';
import { useTranslation } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import type { WorkerInitializationChannel } from '@hierarchidb/ui-worker-client';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { Remote } from 'comlink';
import * as Comlink from 'comlink';
import {
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
import { useWorkerRuntimeProxy } from '~/hooks/useWorkerRuntimeProxy';
import {
  getWorkerInitCompleteMessage,
  getWorkerInitFallbackMessage,
  getWorkerInitStartMessage,
} from '~/i18n/workerInitMessageConstants';
import type { BuildWorkerAPI } from '~/types/workerApiTypes';
import { bootLog } from '~/utils/bootLog';
import { sanitizeRemoteForReact } from '~/utils/comlinkSafeProxyUtils';
import type { WorkerInitializationProgress } from '~/worker-runtime/WorkerClientProxy';
import { resetWorkerState } from '~/worker-runtime/WorkerStateStore';
import {
  getWorkerAPIClientModule,
  loadWorkerAPIClientModule,
} from '~/worker-runtime/workerApiClientLoader';
import { useOptionalBootProgress } from './BootProgressProvider.js';

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

const WORKER_PROVIDER_LOG_PREFIX = '[WorkerProvider]';

const logWorkerProviderWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  if (error === undefined) {
    console.warn(WORKER_PROVIDER_LOG_PREFIX, message);
  } else {
    console.warn(WORKER_PROVIDER_LOG_PREFIX, message, error);
  }
};
const logWorkerProviderMessage = (message: string): void => {
  logWorkerProviderWarning(message, undefined);
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
      logWorkerProviderWarning(WORKER_PROVIDER_DIAGNOSTIC_MESSAGES.resetWorkerApiClientFailed, error);
    });
};

type WorkerStatusState = {
  client: Remote<BuildWorkerAPI> | null;
  isInitialized: boolean;
  initProgress: number;
  initMessage: string;
  error: Error | null;
};

type WorkerContextValue = WorkerClientRef;

type WorkerProviderProps = {
  children: ReactNode;
  timeout?: number;
  renderOverlay?: boolean;
  fallback?: ReactNode | null;
};

const WorkerContext = createContext<WorkerContextValue | null>(null);

const DEFAULT_WORKER_INIT_TIMEOUT_MS = 30_000;

const WORKER_UNAVAILABLE_BASE_MESSAGE = `${WORKER_PROVIDER_LOG_PREFIX} Worker API is not available yet`;
const WORKER_PROVIDER_MESSAGES = {
  contextMissing: `${WORKER_PROVIDER_LOG_PREFIX} context is not ready.`,
  initializeNoop: `${WORKER_PROVIDER_LOG_PREFIX} initialize() called without provider; request ignored.`,
  resetNoop: `${WORKER_PROVIDER_LOG_PREFIX} reset() called without provider; request ignored.`,
  fallbackContextError: 'WorkerProvider context missing',
  finalizeInitializedError: `${WORKER_PROVIDER_LOG_PREFIX} finalizeInitialized error`,
  ensureInitializedDiagnostic: `${WORKER_PROVIDER_LOG_PREFIX} ensureInitialized diagnostic`,
  ensureInitializedFailed: `${WORKER_PROVIDER_LOG_PREFIX} ensureInitialized failed`,
} as const;
const WORKER_PROVIDER_DIAGNOSTIC_MESSAGES = {
  preloadWorkerApiClientModuleFailed: 'Failed to preload WorkerAPIClient module',
  resetWorkerApiClientFailed: 'Failed to reset WorkerAPIClient (lazy load)',
  setInitCompleteFlagFailed: 'Failed to set __HDB_INIT_COMPLETE__ flag',
  setInitStartedFlagFailed: 'Failed to set __HDB_INIT_STARTED__ flag',
  pollWorkerReadinessFailed: 'Polling worker readiness failed',
} as const;
const WORKER_UNAVAILABLE_REASONS = {
  providerNotReady: 'Provider context is not initialized',
  clientNotReady: 'Worker client is not initialized',
} as const;
type WorkerUnavailableReason = (typeof WORKER_UNAVAILABLE_REASONS)[keyof typeof WORKER_UNAVAILABLE_REASONS];
const getWorkerUnavailableMessage = (reason: WorkerUnavailableReason): string =>
  `${WORKER_UNAVAILABLE_BASE_MESSAGE} (${reason}).`;
const throwWorkerUnavailable = (reason: WorkerUnavailableReason): Remote<BuildWorkerAPI> => {
  throw new Error(getWorkerUnavailableMessage(reason));
};

const fallbackWorkerContextValue: WorkerContextValue = {
  client: null,
  isInitialized: false,
  isConnected: false,
  initProgress: 0,
  initMessage: getWorkerInitFallbackMessage(),
  error: new Error(WORKER_PROVIDER_MESSAGES.fallbackContextError),
  initialize: async () => {
    logWorkerProviderMessage(WORKER_PROVIDER_MESSAGES.initializeNoop);
  },
  reset: () => {
    logWorkerProviderMessage(WORKER_PROVIDER_MESSAGES.resetNoop);
  },
  getAPI: () => throwWorkerUnavailable(WORKER_UNAVAILABLE_REASONS.providerNotReady),
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
    return <ErrorOverlay error={status.error} onRetry={onRetry} />;
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
  renderOverlay = true,
  fallback = null,
}: WorkerProviderProps) => {
  const bootProgress = useBootProgressSafe();
  const { t } = useTranslation();
  const { proxy, state: proxyState, error: proxyError } = useWorkerRuntimeProxy();
  const initialProgress = proxy.getProgress();
  const [status, setStatus] = useState<WorkerStatusState>(() => ({
    client: null,
    isInitialized: false,
    initProgress: initialProgress.progress,
    initMessage: initialProgress.message ?? getWorkerInitStartMessage(),
    error: proxyError,
  }));
  const initChannelRef = useRef<WorkerInitializationChannel | null>(null);
  const latestProgressRef = useRef(0);
  const latestProgressMessageRef = useRef(getWorkerInitStartMessage());
  const initializationInFlightRef = useRef<Promise<void> | null>(null);
  const completionMarkedRef = useRef(false);
  const authBridgeClientRef = useRef<Remote<BuildWorkerAPI> | null>(null);
  const authBridgeSetupRef = useRef<{
    client: Remote<BuildWorkerAPI>;
    promise: Promise<void>;
  } | null>(null);

  const resetState = useCallback(() => {
    authBridgeClientRef.current = null;
    authBridgeSetupRef.current = null;
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

      if (proxyState === 'initializing' && prev.isInitialized) {
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
  }, [proxyState, proxyError]);

  const safeClient = useMemo(
    () => (status.client ? sanitizeRemoteForReact(status.client) : null),
    [status.client]
  );

  const prepareAuthBridge = useCallback(
    async (client: Remote<BuildWorkerAPI>, forceRegistration = false): Promise<void> => {
      if (!forceRegistration && authBridgeClientRef.current === client) return;
      const activeSetup = authBridgeSetupRef.current;
      if (!forceRegistration && activeSetup?.client === client) {
        await activeSetup.promise;
        return;
      }

      const setupPromise = (async () => {
        if (activeSetup) {
          try {
            await activeSetup.promise;
          } catch {
            // A later explicit registration must validate its own session after an earlier failure.
          }
        }
        if (!forceRegistration && authBridgeClientRef.current === client) return;
        const bridge = Comlink.proxy(createAuthSessionStorageBridge());
        await client.setUiStorageBridge(bridge);
        authBridgeClientRef.current = client;
      })();
      authBridgeSetupRef.current = { client, promise: setupPromise };

      try {
        await setupPromise;
      } finally {
        if (authBridgeSetupRef.current?.promise === setupPromise) {
          authBridgeSetupRef.current = null;
        }
      }
    },
    []
  );

  const finalizeInitialized = useCallback(
    async (readyClient?: Remote<BuildWorkerAPI>) => {
      try {
        bootLog('WorkerProvider finalize');
        const client =
          readyClient ?? (await (await loadWorkerAPIClientModule()).WorkerAPIClient.getOrInit());
        await prepareAuthBridge(client);
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
        console.error(WORKER_PROVIDER_MESSAGES.finalizeInitializedError, normalized);
        setStatus((prev) => ({ ...prev, error: normalized, isInitialized: false }));
        throw normalized;
      }
    },
    [prepareAuthBridge]
  );

  const markComplete = useCallback(
    async (client?: Remote<BuildWorkerAPI>) => {
      if (completionMarkedRef.current && (!client || authBridgeClientRef.current === client))
        return;
      await finalizeInitialized(client);
      completionMarkedRef.current = true;
      const readyLabel = t('workerInit.status.ready');
      try {
        if (typeof window !== 'undefined') {
          (window as BootWindow).__HDB_INIT_COMPLETE__ = true;
        }
      } catch (error) {
        logWorkerProviderWarning(
          WORKER_PROVIDER_DIAGNOSTIC_MESSAGES.setInitCompleteFlagFailed,
          error
        );
      }
      bootProgress?.setStepProgress('Worker', 100, readyLabel);
      bootProgress?.markStepDone('Worker', readyLabel);
    },
    [bootProgress, finalizeInitialized, t]
  );

  const isInitializationSatisfied = useCallback(() => {
    const currentProxyState = proxy.getState();
    const hasCachedClient = Boolean(proxy.getCachedClient());
    const workerClientReady = isWorkerClientReady();
    const bootCompleted =
      typeof window !== 'undefined' && (window as BootWindow).__HDB_INIT_COMPLETE__ === true;
    return (
      currentProxyState === 'ready'
      || hasCachedClient
      || workerClientReady
      || bootCompleted
      || completionMarkedRef.current
    );
  }, [proxy]);

  const runInitialization = useCallback(async () => {
    if (initializationInFlightRef.current) {
      return initializationInFlightRef.current;
    }
    const initializationTask = (async () => {
      completionMarkedRef.current = false;
      const timeoutMs = Number.isFinite(timeout) && timeout > 0
        ? Math.floor(timeout)
        : DEFAULT_WORKER_INIT_TIMEOUT_MS;

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
        logWorkerProviderWarning(WORKER_PROVIDER_DIAGNOSTIC_MESSAGES.setInitStartedFlagFailed, error);
      }

      try {
        const abortController = new AbortController();
        const client = await new Promise<Remote<BuildWorkerAPI>>((resolve, reject) => {
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
        await markComplete(client);
      } catch (error) {
        const normalizedRaw = normalizeError(error);
        const timedOut = normalizedRaw.name === 'AbortError';
        const normalized = timedOut
          ? new Error(
            `Worker initialization timed out after ${Math.max(0, Number(timeout) || DEFAULT_WORKER_INIT_TIMEOUT_MS)}ms `
            + `(progress=${latestProgressRef.current}%, step="${latestProgressMessageRef.current}").`
          )
          : normalizedRaw;
        const latestProxyState = proxy.getState();
        const hasCachedClient = Boolean(proxy.getCachedClient());
        if (timedOut && isInitializationSatisfied()) {
          await markComplete();
          return;
        }
        console.error(WORKER_PROVIDER_MESSAGES.ensureInitializedDiagnostic, {
          timedOut,
          timeoutMs: Math.max(0, Number(timeout) || DEFAULT_WORKER_INIT_TIMEOUT_MS),
          progress: latestProgressRef.current,
          message: latestProgressMessageRef.current,
          proxyState: latestProxyState,
          hasCachedClient,
        });
        console.error(WORKER_PROVIDER_MESSAGES.ensureInitializedFailed, normalized);
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
  }, [bootProgress, isInitializationSatisfied, markComplete, proxy, t, timeout]);

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

  const getAPI = useCallback((): Remote<BuildWorkerAPI> => {
    if (!safeClient) {
      return throwWorkerUnavailable(WORKER_UNAVAILABLE_REASONS.clientNotReady);
    }
    return safeClient;
  }, [safeClient]);

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
      logWorkerProviderWarning(
        WORKER_PROVIDER_DIAGNOSTIC_MESSAGES.preloadWorkerApiClientModuleFailed,
        error
      );
    });

    const onInitComplete = () => {
      void runInitialization();
    };
    const handleAuthSessionChanged = (): void => {
      const client = authBridgeClientRef.current;
      if (!client) return;
      void prepareAuthBridge(client, true).then(
        () => {
          setStatus((prev) =>
            prev.client === client ? { ...prev, error: null, isInitialized: true } : prev
          );
        },
        (error: unknown) => {
          const normalized = normalizeError(error);
          console.error(WORKER_PROVIDER_MESSAGES.finalizeInitializedError, normalized);
          setStatus((prev) => ({ ...prev, error: normalized, isInitialized: false }));
        }
      );
    };

    if (typeof window !== 'undefined') {
      const globalWin = window as BootWindow & { __HDB_WORKER_EVT_BOUND__?: boolean };
      if (!globalWin.__HDB_WORKER_EVT_BOUND__) {
        globalWin.__HDB_WORKER_EVT_BOUND__ = true;
        window.addEventListener('hierarchidb-worker-init-complete', onInitComplete, { once: true });
      }
      window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    }

    if (!status.isInitialized && !status.error) {
      if (proxyState !== 'initializing') {
        void runInitialization();
      }
    }

    const poll = async () => {
      try {
        if (isWorkerClientReady()) {
          await runInitialization();
          if (pollTimer) window.clearInterval(pollTimer);
        }
      } catch (error) {
        logWorkerProviderWarning(WORKER_PROVIDER_DIAGNOSTIC_MESSAGES.pollWorkerReadinessFailed, error);
      }
    };
    pollTimer = window.setInterval(poll, 150);

    if (import.meta.env.DEV) {
      devFallbackTimer = window.setTimeout(() => {
        if (isWorkerClientReady()) {
          void runInitialization();
        }
      }, 1500);
    }

    return () => {
      initChannelRef.current?.dispose();
      initChannelRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('hierarchidb-worker-init-complete', onInitComplete);
        window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
        const globalWin = window as BootWindow & { __HDB_WORKER_EVT_BOUND__?: boolean };
        globalWin.__HDB_WORKER_EVT_BOUND__ = false;
      }
      if (pollTimer) window.clearInterval(pollTimer);
      if (devFallbackTimer) window.clearTimeout(devFallbackTimer);
    };
  }, [prepareAuthBridge, proxyState, runInitialization, status.error, status.isInitialized]);

  const contextValue = useMemo<WorkerContextValue>(
    () => ({
      client: safeClient,
      isInitialized: status.isInitialized,
      isConnected: Boolean(safeClient && status.isInitialized),
      initProgress: status.initProgress,
      initMessage: status.initMessage,
      error: status.error,
      initialize,
      reset,
      getAPI,
    }),
    [safeClient, status.isInitialized, status.initProgress, status.initMessage, status.error, initialize, reset, getAPI]
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
    logWorkerProviderMessage(WORKER_PROVIDER_MESSAGES.contextMissing);
    return fallbackWorkerContextValue;
  }
  return context;
};

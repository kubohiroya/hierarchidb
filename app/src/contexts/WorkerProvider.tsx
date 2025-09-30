/**
 * WorkerProvider – React context for the shared worker lifecycle.
 *
 * Exposes initialization progress, errors, and the `WorkerClientRef` bundle
 * to any descendant component while coordinating suspense for the worker
 * bootstrap flow so that consumers never observe a null client reference.
 */
import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerInitializationChannel, type WorkerClientRef } from '@hierarchidb/runtime-worker-bootstrap';

type BootWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
  __HDB_INIT_STARTED__?: boolean;
  __HDB_WORKER_CLIENT_REF__?: WorkerContextValue;
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'error' in (error as Record<string, unknown>)) {
    const inner = (error as Record<string, unknown>).error;
    return normalizeError(inner);
  }
  return new Error(String(error));
}
import { WorkerAPIClient } from '../WorkerAPIClient.js';
import { useWorkerRuntimeProxy } from '../worker-runtime/index.js';
import type { WorkerClientProxy, WorkerInitializationProgress } from '../worker-runtime/index.js';
import { bootLog } from '../utils/bootLog.js';
import { useBootProgress } from './BootProgressProvider.js';

const logWorkerProviderWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[WorkerProvider]', message, error);
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
};

const WorkerContext = createContext<WorkerContextValue | null>(null);

let initStarted = false;
let initCompleted = false;

function useBootProgressSafe() {
  try {
    return useBootProgress();
  } catch {
    return null;
  }
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
  proxy: WorkerClientProxy;
  children: ReactNode;
};

function WorkerClientGate({ status, renderOverlay, onRetry, proxy, children }: WorkerClientGateProps) {
  const initPromiseRef = useRef<Promise<Remote<WorkerAPI>> | null>(null);

  useEffect(() => {
    if (status.isInitialized) {
      initPromiseRef.current = null;
    }
  }, [status.isInitialized]);

  if (status.error) {
    if (renderOverlay) {
      return <ErrorOverlay error={status.error} onRetry={onRetry} />;
    }
    throw status.error;
  }

  if (!status.client || !status.isInitialized) {
    if (!initPromiseRef.current) {
      initPromiseRef.current = proxy.ensureInitialized();
    }
    throw initPromiseRef.current;
  }

  return <>{children}</>;
}

function InitializingOverlay({ progress, message }: { progress: number; message: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div style={overlayContainerStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeadingStyle}>Setting up worker…</div>
        <div style={progressTrackStyle}>
          <div style={progressBarStyle(clamped)} />
        </div>
        <div style={overlayBodyStyle}>{message || 'Worker initializing'}</div>
        <div style={overlayCaptionStyle}>{clamped}% Complete</div>
      </div>
    </div>
  );
}

function ErrorOverlay({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div style={overlayContainerStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeadingStyle}>Worker initialization error</div>
        <div style={overlayBodyStyle}>{error.message || 'Unknown error'}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" style={buttonStyle} onClick={onRetry}>Retry</button>
          <button type="button" style={secondaryButtonStyle} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

export const WorkerProvider = ({
  children,
  renderOverlay = true,
}: WorkerProviderProps) => {
  const bootProgress = useBootProgressSafe();
  const { proxy, state: proxyState, error: proxyError } = useWorkerRuntimeProxy();
  const initialProgress = proxy.getProgress();
  const [status, setStatus] = useState<WorkerStatusState>(() => ({
    client: proxy.getCachedClient(),
    isInitialized: proxyState === 'ready',
    initProgress: initialProgress.progress,
    initMessage: initialProgress.message,
    error: proxyError,
  }));
  const initChannelRef = useRef<WorkerInitializationChannel | null>(null);
  const latestProgressRef = useRef(0);

  const resetState = useCallback(() => {
    setStatus({
      client: null,
      isInitialized: false,
      initProgress: 0,
      initMessage: 'Worker初期化を開始しています...',
      error: null,
    });
  }, []);


  useEffect(() => {
    const unsubscribe = proxy.subscribeProgress((detail: WorkerInitializationProgress) => {
      setStatus((prev) => ({
        ...prev,
        initProgress: detail.progress,
        initMessage: detail.message,
      }));
      bootProgress?.setStepProgress('Worker', detail.progress, detail.message);
    });
    return unsubscribe;
  }, [proxy, bootProgress]);
  useEffect(() => {
    setStatus(prev => {
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
            initMessage: 'Worker初期化完了',
            error: proxyError ?? null,
          };
          changed = true;
        }
      } else if (proxyState === 'initializing' && prev.isInitialized) {
        next = {
          ...prev,
          isInitialized: false,
          initProgress: 0,
          initMessage: 'Worker初期化を開始しています...',
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

  const finalizeInitialized = useCallback(async () => {
    try {
      bootLog('WorkerProvider finalize');
      const client = WorkerAPIClient.getSingleton();
      latestProgressRef.current = 100;
      setStatus({
        client,
        isInitialized: true,
        initProgress: 100,
        initMessage: 'Worker初期化完了',
        error: null,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      setStatus(prev => ({ ...prev, error: normalized }));
    }
  }, []);

  const markComplete = useCallback(async () => {
    if (initCompleted) {
      if (!WorkerAPIClient.isReady()) {
        return;
      }
    }
    initCompleted = true;
    try {
      if (typeof window !== 'undefined') {
        (window as BootWindow).__HDB_INIT_COMPLETE__ = true;
      }
    } catch (error) {
      logWorkerProviderWarning('Failed to set __HDB_INIT_COMPLETE__ flag', error);
    }
    bootProgress?.setStepProgress('Worker', 100, 'Worker ready');
    bootProgress?.markStepDone('Worker', 'Worker ready');
    await finalizeInitialized();
  }, [bootProgress, finalizeInitialized]);

  const runInitialization = useCallback(async () => {
    bootLog('WorkerProvider initialize() start');
    latestProgressRef.current = 0;
    setStatus(prev => ({
      ...prev,
      error: null,
      initProgress: 0,
      initMessage: 'Worker初期化を開始しています...',
      isInitialized: false,
    }));
    bootProgress?.setStepProgress('Worker', 0, 'Worker initializing');

    try {
      if (typeof window !== 'undefined') {
        (window as BootWindow).__HDB_INIT_STARTED__ = true;
      }
    } catch (error) {
      logWorkerProviderWarning('Failed to set __HDB_INIT_STARTED__ flag', error);
    }

    try {
      const client = await proxy.ensureInitialized();
      setStatus(prev => ({
        ...prev,
        client,
        isInitialized: true,
        error: null,
      }));
      await markComplete();
    } catch (error) {
      const normalized = normalizeError(error);
      setStatus(prev => ({ ...prev, error: normalized, isInitialized: false }));
      bootProgress?.setStepProgress('Worker', latestProgressRef.current, normalized.message);
    }
  }, [bootProgress, markComplete, proxy]);

  const retryInitialization = useCallback(() => {
    bootLog('WorkerProvider retry requested');
    WorkerAPIClient.reset();
    initCompleted = false;
    initStarted = false;
    latestProgressRef.current = 0;
    resetState();
    bootProgress?.setStepProgress('Worker', 0, 'Worker initializing');
    void runInitialization();
  }, [bootProgress, resetState, runInitialization]);

  const getAPI = useCallback((): Remote<WorkerAPI> => {
    if (!status.client) {
      throw new Error('Worker client not initialized');
    }
    return status.client;
  }, [status.client]);

  const reset = useCallback(() => {
    bootLog('WorkerProvider reset requested');
    WorkerAPIClient.reset();
    initCompleted = false;
    initStarted = false;
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

    if (!initStarted) {
      initStarted = true;
      void runInitialization();
    } else if (initCompleted || WorkerAPIClient.isReady()) {
      void markComplete();
    }

    const poll = async () => {
      try {
        if (WorkerAPIClient.isReady()) {
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
        if (WorkerAPIClient.isReady()) {
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
  }, [markComplete, runInitialization]);

  const contextValue = useMemo<WorkerContextValue>(() => ({
    client: status.client,
    isInitialized: status.isInitialized,
    isConnected: Boolean(status.client && status.isInitialized),
    initProgress: status.initProgress,
    initMessage: status.initMessage,
    error: status.error,
    initialize,
    reset,
    getAPI,
  }), [status, getAPI, initialize, reset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as BootWindow;
    win.__HDB_WORKER_CLIENT_REF__ = contextValue;
    return () => {
      if (win.__HDB_WORKER_CLIENT_REF__ === contextValue) {
        delete win.__HDB_WORKER_CLIENT_REF__;
      }
    };
  }, [contextValue]);

  const suspenseFallback = useMemo(() => {
    if (!renderOverlay || status.error) return null;
    return <InitializingOverlay progress={status.initProgress} message={status.initMessage} />;
  }, [renderOverlay, status.error, status.initMessage, status.initProgress]);

  return (
    <WorkerContext.Provider value={contextValue}>
      <Suspense fallback={suspenseFallback}>
        <WorkerClientGate status={status} renderOverlay={renderOverlay} onRetry={retryInitialization} proxy={proxy}>
          {children}
        </WorkerClientGate>
      </Suspense>
    </WorkerContext.Provider>
  );
};

export const useWorker = (): WorkerContextValue => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerProvider');
  }
  return context;
};

export const useWorkerClient = (): WorkerContextValue => {
  return useWorker();
};

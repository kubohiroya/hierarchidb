/**
  * Worker Provider - UIWorkerReact Context
  * Worker
 * @hierarchidb/runtime-worker-worker-bootstrap
 * Worker
  */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { bootLog } from '../utils/bootLog';
import { Box, LinearProgress, Typography } from '@mui/material';
import { WorkerInitializationChannel } from '@hierarchidb/runtime-worker-bootstrap';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { TitleLogo } from '../components/TitleLogo';
import { useBootProgress } from './BootProgressProvider';

// ===========================
// ===========================

interface WorkerContextValue {
  client: Remote<WorkerAPI> | null;
  isInitialized: boolean;
  initProgress: number;
  initMessage: string;
  error: Error | null;
}

interface WorkerProviderProps {
  children: React.ReactNode;
  timeout?: number;
  debug?: boolean;
  renderOverlay?: boolean; // if false, do not render local initializing/error overlays
}

// ===========================
// Context
// ===========================

const WorkerContext = createContext<WorkerContextValue | null>(null);

// Module-level guards to survive React StrictMode dev remounts
let __WORKER_INIT_STARTED__ = false;
let __WORKER_INIT_COMPLETED__ = false;

// ===========================
// ===========================

/**
    */
const InitializingView: React.FC<{ progress: number; message: string }> = ({
                                                                             progress,
                                                                             message,
                                                                           }) => (
  <Box
    sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      padding: 4,
    }}
  >
    <TitleLogo showProgress={false} />

    <Box sx={{ width: '100%', maxWidth: 400, mt: 4 }}>
      {/**
       * UX: Avoid flicker from "0%" regression
       * - When progress is 0 (initial), show indeterminate bar and hide texts
       * - Once progress > 0, switch to determinate with percentage and step message
       */}
      <LinearProgress
        variant={progress > 0 ? 'determinate' : 'indeterminate'}
        value={progress}
        sx={{ height: 8, borderRadius: 4 }}
      />
      {progress > 0 && (
        <>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 2 }}
          >
            {message}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
            sx={{ mt: 1 }}
          >
            {progress}% Complete
          </Typography>
        </>
      )}
    </Box>
  </Box>
);

/**
    */
const ErrorView: React.FC<{ error: Error; onRetry: () => void }> = ({
                                                                      error,
                                                                      onRetry,
                                                                    }) => (
  <Box
    sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff5f5',
      padding: 4,
    }}
  >
    <Typography variant="h5" color="error" gutterBottom>
      Worker初期化エラー
    </Typography>

    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
      Workerの初期化に失敗しました。
    </Typography>

    <Box
      sx={{
        p: 2,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 1,
        maxWidth: 600,
        width: '100%',
        mb: 3,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontFamily: 'monospace', color: 'error.main' }}
      >
        {error.message || 'Unknown error'}
      </Typography>
    </Box>

    <Box sx={{ display: 'flex', gap: 2 }}>
      <button
        onClick={onRetry}
        style={{
          padding: '10px 20px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        再試行
      </button>

      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          backgroundColor: '#757575',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ページをリロード
      </button>
    </Box>
  </Box>
);

// ===========================
//  Provider
// ===========================

/**
  * WorkerProvider
  * Worker
  */
export const WorkerProvider: React.FC<WorkerProviderProps> = ({
  children,
  timeout = 30000,
  debug = false,
  renderOverlay = true,
}) => {
  // Bridge progress to BootProgress
  let bootProgress: { setStepProgress: (n: any, p: number, m?: string) => void; markStepDone: (n: any, m?: string) => void } | null = null;
  try { bootProgress = useBootProgress(); } catch { /* outside of provider in some tests */ }
  const [state, setState] = useState<WorkerContextValue>({
    client: null,
    isInitialized: false,
    initProgress: 0,
    initMessage: 'Worker初期化を開始しています...',
    error: null,
  });

  const [initChannel, setInitChannel] = useState<WorkerInitializationChannel | null>(null);

  // Helper to finalize initialization and hide the banner
  const finalizeInitialized = async () => {
    try {
      // Reduce boot log noise; print only when ?debug=init
      bootLog('WorkerProvider finalize start');
      const client = await WorkerAPIClient.getSingleton();
      setState({
        client,
        isInitialized: true,
        initProgress: 100,
        initMessage: 'Worker初期化完了',
        error: null,
      });
      bootLog('WorkerProvider finalized isInitialized=true');
    } catch (e) {
      console.warn('[WorkerProvider] finalizeInitialized failed, will rely on channel', e);
    }
  };

  /**
      * Worker
      */
  const initializeWorker = async () => {
    bootLog('WorkerProvider initialize() begin');
    try {
      setState(prev => ({ ...prev, error: null }));
      // Mark global guard so route loaders know initialization has begun
      try { (window as any).__HDB_INIT_STARTED__ = true; } catch {}

      //  WorkerAPIClientWorker
      await WorkerAPIClient.initialize();
      bootLog('WorkerProvider initialize resolved');
      // Fast-path if already ready
      try {
        if (WorkerAPIClient.isReady()) {
          bootLog('WorkerProvider fast-path isReady=true, finalizing');
          __WORKER_INIT_COMPLETED__ = true;
          await finalizeInitialized();
          return;
        }
      } catch {
      }

      const rawWorker = WorkerAPIClient.getRawWorkerInstance();

      if (!rawWorker) {
        throw new Error('Worker instance is not available');
      }

      //  INIT_PROGRESSUI
      const onProgressMessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; payload?: { progress?: number; message?: string } };
        if (data?.type === 'INIT_PROGRESS') {
          setState(prev => ({
            ...prev,
            initProgress: typeof data.payload?.progress === 'number' ? data.payload!.progress! : prev.initProgress,
            initMessage: data.payload?.message || prev.initMessage,
          }));
          try { bootProgress?.setStepProgress('Worker', Number(data?.payload?.progress ?? 0), data?.payload?.message || ''); } catch {}
          try { bootLog('WorkerProvider channel progress=%s msg=%s', data?.payload?.progress ?? 'n/a', data?.payload?.message ?? ''); } catch {}
        }
      };
      try {
        rawWorker.addEventListener('message', onProgressMessage);
      } catch {
      }

      const channel = new WorkerInitializationChannel();
      setInitChannel(channel);

      const result = await channel.waitForInitialization({
        worker: rawWorker,
        timeout,
        debug,
      });

      try {
        rawWorker.removeEventListener('message', onProgressMessage);
      } catch {
      }

      if (result.success) {
        __WORKER_INIT_COMPLETED__ = true;
        try { (window as any).__HDB_INIT_COMPLETE__ = true; } catch {}
        bootLog('WorkerProvider channel INIT_COMPLETE');
        try { bootProgress?.markStepDone('Worker', 'Worker ready'); } catch {}
        await finalizeInitialized();
      } else {
        throw new Error(result.error?.message || 'Worker initialization failed');
      }
    } catch (error) {
      console.error('[WorkerProvider] Initialization failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isInitialized: false,
      }));
    }
  };

  //  + event listener for INIT_COMPLETE
  useEffect(() => {
    bootLog('WorkerProvider mount');
    // In dev, add a short fallback to finalize if WorkerAPIClient becomes ready but the channel hasn't resolved (StrictMode races)
    let devFallbackTimer: number | undefined;
    const onInitComplete = async () => {
      bootLog('WorkerProvider event INIT_COMPLETE');
      __WORKER_INIT_COMPLETED__ = true;
      try { bootProgress?.markStepDone('Worker', 'Worker ready'); } catch {}
      try {
        await WorkerAPIClient.initialize();
        const client = await WorkerAPIClient.getSingleton();
        setState({ client, isInitialized: true, initProgress: 100, initMessage: 'Worker初期化完了', error: null });
      } catch (e) {
        console.warn('[WorkerProvider] finalize on event failed', e);
      }
    };
    try {
      const g: any = (typeof window !== 'undefined') ? (window as any) : {};
      if (!g.__HDB_WORKER_EVT_BOUND__) {
        g.__HDB_WORKER_EVT_BOUND__ = true;
        window.addEventListener('hierarchidb-worker-init-complete', onInitComplete, { once: true });
      }
    } catch {}

    if (!__WORKER_INIT_STARTED__) {
      __WORKER_INIT_STARTED__ = true;
      void initializeWorker();
    } else {
      // Fast finalize on remount if completed
      try {
        if (__WORKER_INIT_COMPLETED__ || WorkerAPIClient.isReady()) {
          const client = WorkerAPIClient.getSingleton();
          setState({ client, isInitialized: true, initProgress: 100, initMessage: 'Worker初期化完了', error: null });
        }
      } catch {
      }
    }

    // Stronger fallback: poll global flag/isReady briefly to avoid missing the event in SSR/hydration races
    let pollTimer: number | undefined;
    const start = Date.now();
    const poll = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = (typeof window !== 'undefined') ? (window as any) : {};
        if (g.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady()) {
          try {
            const client = await WorkerAPIClient.getOrInit();
            setState({ client, isInitialized: true, initProgress: 100, initMessage: 'Worker初期化完了', error: null });
            if (pollTimer) window.clearInterval(pollTimer);
            return;
          } catch {}
        }
        if (Date.now() - start > 5000 && pollTimer) {
          window.clearInterval(pollTimer);
        }
      } catch {}
    };
    // @ts-ignore setInterval returns number in browsers
    pollTimer = window.setInterval(poll, 100);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider] scheduling dev fallback finalization');
      // @ts-ignore setTimeout returns number in browsers
      devFallbackTimer = window.setTimeout(async () => {
        try {
          if (!state.isInitialized && WorkerAPIClient.isReady()) {
            // eslint-disable-next-line no-console
            console.log('[WorkerProvider] dev fallback finalizing');
            await finalizeInitialized();
          }
        } catch {
        }
      }, 1500);
    }

    return () => {
      initChannel?.dispose();
      try {
        window.removeEventListener('hierarchidb-worker-init-complete', onInitComplete);
        const g: any = (typeof window !== 'undefined') ? (window as any) : {};
        g.__HDB_WORKER_EVT_BOUND__ = false;
      } catch {}
      if (devFallbackTimer) {
        window.clearTimeout(devFallbackTimer);
      }
      // clear poll
      try { if (pollTimer) window.clearInterval(pollTimer); } catch {}
    };
  }, []);

  // When renderOverlay=false, always render children and expose state via context,
  // letting an outer BootProgress overlay handle UX and gating.
  if (renderOverlay) {
    if (state.error) {
      return <ErrorView error={state.error} onRetry={initializeWorker} />;
    }
    if (!state.isInitialized) {
      return <InitializingView progress={state.initProgress} message={state.initMessage} />;
    }
  }

  return (
    <WorkerContext.Provider value={state}>
      {children}
    </WorkerContext.Provider>
  );
};

// ===========================
// Hooks
// ===========================

/**
  * useWorker Hook
  * WorkerContext
  */
export const useWorker = (): WorkerContextValue => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerProvider');
  }
  return context;
};

/**
  * useWorkerClient Hook
  * WorkerAPIClient
  */
export const useWorkerClient = () => {
  const { client, isInitialized } = useWorker();

  return {
    client,
    isConnected: isInitialized,
  };
};

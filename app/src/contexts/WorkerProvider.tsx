/**
 * Worker Provider - UI層とWorker層を接続するReact Context
 * 
 * Worker初期化の完了を待ち、初期化状態を管理します。
 * @hierarchidb/runtime-worker-worker-bootstrapの仕組みを利用して、
 * Worker側から初期化完了通知を受け取ってからアプリケーションを開始します。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material';
import { WorkerInitializationChannel } from '@hierarchidb/runtime-worker-bootstrap';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { TitleLogo } from '../components/TitleLogo';

// ===========================
// 型定義
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
}

// ===========================
// Context
// ===========================

const WorkerContext = createContext<WorkerContextValue | null>(null);

// Module-level guard flags to survive React StrictMode remounts in dev
let __WORKER_INIT_STARTED__ = false;
let __WORKER_INIT_COMPLETED__ = false;

// ===========================
// コンポーネント
// ===========================

/**
 * 初期化中の表示コンポーネント
 */
const InitializingView: React.FC<{ progress: number; message: string }> = ({ 
  progress, 
  message 
}) => {
  // Log every render of the initializing view for debugging
  try {
    // eslint-disable-next-line no-console
    console.log('[InitializingView] render', { progress, message });
  } catch {}

  return (
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
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ height: 8, borderRadius: 4 }}
      />
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
    </Box>
  </Box>
);
};

/**
 * エラー表示コンポーネント
 */
const ErrorView: React.FC<{ error: Error; onRetry: () => void }> = ({ 
  error, 
  onRetry 
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
        mb: 3
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
// Provider実装
// ===========================

/**
 * WorkerProvider
 * 
 * Worker初期化を管理し、初期化完了後に子コンポーネントをレンダリング
 */
export const WorkerProvider: React.FC<WorkerProviderProps> = ({ 
  children, 
  timeout = 30000,
  debug = false 
}) => {
  const startedRef = React.useRef(false);
  const [state, setState] = useState<WorkerContextValue>({
    client: null,
    isInitialized: false,
    initProgress: 0,
    initMessage: 'Worker初期化を開始しています...',
    error: null,
  });

  const [initChannel, setInitChannel] = useState<WorkerInitializationChannel | null>(null);

  /**
   * Worker初期化処理
   */
  const initializeWorker = async () => {
    // eslint-disable-next-line no-console
    console.log('[WorkerProvider.initializeWorker] called');
    try {
      // 既存のエラーをクリア
      setState(prev => ({ ...prev, error: null }));
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] state cleared, starting WorkerAPIClient.initialize');

      // WorkerAPIClientを初期化（これによりWorkerが起動）
      await WorkerAPIClient.initialize();
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] WorkerAPIClient.initialize resolved');

      // Fast-path: if client is already ready, set state and return
      try {
        if (WorkerAPIClient.isReady()) {
          // eslint-disable-next-line no-console
          console.log('[WorkerProvider.initializeWorker] Fast-path: WorkerAPIClient is ready');
      const client = await WorkerAPIClient.getSingleton();
      __WORKER_INIT_COMPLETED__ = true;
      setState({
        client,
        isInitialized: true,
        initProgress: 100,
        initMessage: 'Worker初期化完了',
        error: null,
      });
          return;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[WorkerProvider.initializeWorker] Fast-path check threw, falling back to channel', e);
      }

      const rawWorker = WorkerAPIClient.getRawWorkerInstance();
      
      if (!rawWorker) {
        throw new Error('Worker instance is not available');
      }

      // 初期化チャンネルを作成し、初期化完了を待機
      const channel = new WorkerInitializationChannel();
      setInitChannel(channel);
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] WorkerInitializationChannel created');

      // Prefer channel, but fall back to WorkerAPIClient readiness (handles race where INIT_COMPLETE already fired)
      const channelPromise = channel.waitForInitialization({ worker: rawWorker, timeout, debug });
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] waitForInitialization started', { timeout, debug });

      // Small grace period to allow channel to capture INIT_COMPLETE; if already ready, proceed
      const fallbackPromise = new Promise<{ success: boolean; error?: Error }>((resolve) => {
        const checkReady = async () => {
          try {
            if (WorkerAPIClient.isReady()) {
              resolve({ success: true });
            } else {
              // re-check shortly until timeout window; actual timeout still governed by channel
              setTimeout(checkReady, 250);
            }
          } catch {
            setTimeout(checkReady, 250);
          }
        };
        checkReady();
      });

      const result = await Promise.race([channelPromise, fallbackPromise]);
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] init gate resolved', result);

      if (!result || !(result as any).success) {
        throw new Error((result as any)?.error?.message || 'Worker initialization failed');
      }

      const client = await WorkerAPIClient.getSingleton();
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider.initializeWorker] WorkerAPIClient.getSingleton resolved');
      setState({
        client,
        isInitialized: true,
        initProgress: 100,
        initMessage: 'Worker初期化完了',
        error: null,
      });
    } catch (error) {
      console.error('[WorkerProvider] Initialization failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isInitialized: false,
      }));
    }
  };

  // 初期化実行
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[WorkerProvider] useEffect mount');
    if (!startedRef.current && !__WORKER_INIT_STARTED__) {
      startedRef.current = true;
      __WORKER_INIT_STARTED__ = true;
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider] starting initializeWorker (guarded)');
      void initializeWorker();
    } else {
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider] initializeWorker already started; skipping');
      try {
        if (__WORKER_INIT_COMPLETED__ || WorkerAPIClient.isReady()) {
          // eslint-disable-next-line no-console
          console.log('[WorkerProvider] fast-set initialized state on remount');
          const client = WorkerAPIClient.getSingleton();
          setState({
            client,
            isInitialized: true,
            initProgress: 100,
            initMessage: 'Worker初期化完了',
            error: null,
          });
        }
      } catch {}
    }

    // クリーンアップ（本番のみチャネルを破棄。開発のStrictMode二重マウントでは破棄しない）
    return () => {
      // eslint-disable-next-line no-console
      console.log('[WorkerProvider] useEffect unmount');
      if (!import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[WorkerProvider] disposing initChannel (production)');
        initChannel?.dispose();
      }
    };
  }, []);

  // レンダリング
  if (state.error) {
    return <ErrorView error={state.error} onRetry={initializeWorker} />;
  }

  if (!state.isInitialized) {
    return <InitializingView progress={state.initProgress} message={state.initMessage} />;
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
 * 
 * WorkerContextの値を取得
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
 * 
 * WorkerAPIClientインスタンスを取得（後方互換性のため）
 */
export const useWorkerClient = () => {
  const { client, isInitialized } = useWorker();
  
  if (!client) {
    throw new Error('Worker client is not initialized');
  }
  
  return {
    client,
    isConnected: isInitialized,
  };
};

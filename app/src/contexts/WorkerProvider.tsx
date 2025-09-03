/**
 * Worker Provider - UI層とWorker層を接続するReact Context
 * 
 * Worker初期化の完了を待ち、初期化状態を管理します。
 * @hierarchidb/runtime-worker-worker-bootstrapの仕組みを利用して、
 * Worker側から初期化完了通知を受け取ってからアプリケーションを開始します。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material';
import { WorkerInitializationChannel } from '@hierarchidb/runtime-worker-worker-bootstrap';
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

// ===========================
// コンポーネント
// ===========================

/**
 * 初期化中の表示コンポーネント
 */
const InitializingView: React.FC<{ progress: number; message: string }> = ({ 
  progress, 
  message 
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
    try {
      // 既存のエラーをクリア
      setState(prev => ({ ...prev, error: null }));

      // WorkerAPIClientを初期化（これによりWorkerが起動）
      await WorkerAPIClient.initialize();
      const rawWorker = WorkerAPIClient.getRawWorkerInstance();
      
      if (!rawWorker) {
        throw new Error('Worker instance is not available');
      }

      // 初期化チャンネルを作成
      const channel = new WorkerInitializationChannel(rawWorker, { 
        timeout, 
        debug 
      });
      setInitChannel(channel);

      // 初期化の進捗を監視
      channel.on('progress', (event) => {
        setState(prev => ({
          ...prev,
          initProgress: event.progress,
          initMessage: event.message || 'Worker初期化中...',
        }));
      });

      // 初期化完了を待つ
      const result = await channel.waitForInitialization();
      
      if (result.success) {
        const client = await WorkerAPIClient.getSingleton();
        setState({
          client,
          isInitialized: true,
          initProgress: 100,
          initMessage: 'Worker初期化完了',
          error: null,
        });
      } else {
        throw new Error(result.error || 'Worker initialization failed');
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

  // 初期化実行
  useEffect(() => {
    initializeWorker();

    // クリーンアップ
    return () => {
      if (initChannel) {
        initChannel.destroy();
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

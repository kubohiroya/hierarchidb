/**
 * WorkerProvider wrapper for the app
 * Uses @hierarchidb/runtime-worker-init-notifier for initialization detection
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { 
  WorkerProvider as BaseWorkerProvider,
  useWorker 
} from '@hierarchidb/runtime-worker-init-notifier';
import { WorkerAPIClient } from '../WorkerAPIClient';
import { getRawWorkerInstance } from '../initWorkerClient';
import { TitleLogo } from '../components/TitleLogo';

interface AppWorkerProviderProps {
  children: React.ReactNode;
}

// Loading component
const LoadingComponent = () => (
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
    }}
  >
    <TitleLogo showProgress={true} />
  </Box>
);

// Error component
const ErrorComponent: React.FC<{ error: Error }> = ({ error }) => (
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
      Initialization Error
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
      Failed to initialize the application. Please refresh the page.
    </Typography>
    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>
      {error.message || 'Unknown error'}
    </Typography>
    <Box sx={{ mt: 3 }}>
      <button 
        onClick={() => window.location.reload()}
        style={{
          padding: '8px 16px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Refresh Page
      </button>
    </Box>
  </Box>
);

export const WorkerProvider: React.FC<AppWorkerProviderProps> = ({ children }) => {
  return (
    <BaseWorkerProvider
      loadingComponent={<LoadingComponent />}
      errorComponent={ErrorComponent}
      getWorkerClient={async () => {
        // Initialize the worker first to ensure raw instance is available
        await WorkerAPIClient.initialize();
        return WorkerAPIClient.getSingleton();
      }}
      getRawWorker={getRawWorkerInstance}
    >
      {children}
    </BaseWorkerProvider>
  );
};

// Re-export the useWorker hook
export { useWorker };

// Create useWorkerClient hook for compatibility
export const useWorkerClient = () => {
  const workerContext = useWorker();
  
  if (!workerContext) {
    throw new Error('useWorkerClient must be used within WorkerProvider');
  }
  
  return {
    client: workerContext.workerClient,
    isConnected: workerContext.isInitialized,
  };
};
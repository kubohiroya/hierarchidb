/**
 * WorkerProvider - Manages Worker API Client initialization and provides it to child components
 * 
 * This provider ensures the Worker is initialized before rendering child components,
 * preventing race conditions during direct URL access.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerAPIClient } from '../WorkerAPIClient';
import { TitleLogo } from '../components/TitleLogo';

interface WorkerContextValue {
  client: WorkerAPI | null;
  isReady: boolean;
  error: Error | null;
}

const WorkerContext = createContext<WorkerContextValue>({
  client: null,
  isReady: false,
  error: null,
});

export const useWorkerContext = () => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorkerContext must be used within WorkerProvider');
  }
  return context;
};

interface WorkerProviderProps {
  children: React.ReactNode;
}

export const WorkerProvider: React.FC<WorkerProviderProps> = ({ children }) => {
  const [state, setState] = useState<WorkerContextValue>({
    client: null,
    isReady: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const initializeWorker = async () => {
      try {
        console.log('[WorkerProvider] Checking Worker initialization status...');
        
        // Check if already initialized
        if (WorkerAPIClient.isReady()) {
          console.log('[WorkerProvider] Worker already initialized, getting instance...');
          const client = WorkerAPIClient.getSingleton();
          if (mounted) {
            setState({
              client,
              isReady: true,
              error: null,
            });
          }
          return;
        }

        // Initialize if not ready
        console.log('[WorkerProvider] Initializing Worker...');
        await WorkerAPIClient.initialize();
        
        const client = WorkerAPIClient.getSingleton();
        console.log('[WorkerProvider] Worker initialized successfully');
        
        if (mounted) {
          setState({
            client,
            isReady: true,
            error: null,
          });
        }
      } catch (error) {
        console.error('[WorkerProvider] Failed to initialize Worker:', error);
        if (mounted) {
          setState({
            client: null,
            isReady: false,
            error: error instanceof Error ? error : new Error('Failed to initialize Worker'),
          });
        }
      }
    };

    initializeWorker();

    return () => {
      mounted = false;
    };
  }, []);

  // Show loading screen while initializing
  if (!state.isReady && !state.error) {
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
        }}
      >
        <TitleLogo showProgress={true} />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Initializing application...
        </Typography>
      </Box>
    );
  }

  // Show error screen if initialization failed
  if (state.error) {
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
          {state.error.message}
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
  }

  return (
    <WorkerContext.Provider value={state}>
      {children}
    </WorkerContext.Provider>
  );
};
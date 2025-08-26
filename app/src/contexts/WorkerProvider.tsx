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
  console.log('[WorkerProvider] Component rendering, initial state setup');
  const [state, setState] = useState<WorkerContextValue>({
    client: null,
    isReady: false,
    error: null,
  });

  useEffect(() => {
    console.log('[WorkerProvider] useEffect triggered');
    
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const initializeWorker = async () => {
      console.log('[WorkerProvider] initializeWorker function started');
      while (retryCount < maxRetries && mounted) {
        try {
          console.log(`[WorkerProvider] Initialization attempt ${retryCount + 1}/${maxRetries} at ${new Date().toISOString()}`);
          
          // Log before calling initialize
          console.log('[WorkerProvider] Calling WorkerAPIClient.initialize()...');
          await WorkerAPIClient.initialize();
          console.log('[WorkerProvider] WorkerAPIClient.initialize() completed');
          
          // Log before calling getSingleton
          console.log('[WorkerProvider] Calling WorkerAPIClient.getSingleton()...');
          const client = WorkerAPIClient.getSingleton();
          console.log('[WorkerProvider] WorkerAPIClient.getSingleton() returned:', client);
          
          // Ping test for health check
          console.log('[WorkerProvider] Testing Worker connection with ping...');
          try {
            const pingStart = Date.now();
            const pingResult = await client.ping();
            const pingTime = Date.now() - pingStart;
            console.log(`[WorkerProvider] Ping successful! Response: ${pingResult.response}, Time: ${pingTime}ms`);
          } catch (pingError) {
            console.error('[WorkerProvider] Ping failed:', pingError);
            throw new Error(`Worker ping failed: ${pingError}`);
          }
          
          if (mounted) {
            console.log('[WorkerProvider] Setting state with ready client');
            setState({
              client,
              isReady: true,
              error: null,
            });
          }
          console.log('[WorkerProvider] Initialization successful');
          return; // Success, exit the retry loop
        } catch (error) {
          retryCount++;
          console.error(`[WorkerProvider] Failed to initialize Worker (attempt ${retryCount}/${maxRetries}):`, error);
          console.error('[WorkerProvider] Error stack:', (error as Error)?.stack);
          
          if (retryCount >= maxRetries) {
            // Final failure
            console.error('[WorkerProvider] All retry attempts exhausted');
            if (mounted) {
              setState({
                client: null,
                isReady: false,
                error: error instanceof Error ? error : new Error('Failed to initialize Worker after multiple attempts'),
              });
            }
            return;
          }
          
          // Wait before retrying
          console.log(`[WorkerProvider] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          console.log('[WorkerProvider] Retry delay completed');
        }
      }
    };

    console.log('[WorkerProvider] Starting initializeWorker call');
    initializeWorker().then(() => {
      console.log('[WorkerProvider] initializeWorker promise resolved');
    }).catch((error) => {
      console.error('[WorkerProvider] initializeWorker promise rejected:', error);
    });

    return () => {
      console.log('[WorkerProvider] Cleanup function called');
      mounted = false;
    };
  }, []);

  console.log('[WorkerProvider] Render - state:', { 
    isReady: state.isReady, 
    hasError: !!state.error,
    hasClient: !!state.client 
  });

  // Show loading screen while initializing
  if (!state.isReady && !state.error) {
    console.log('[WorkerProvider] Rendering loading screen');
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
    console.log('[WorkerProvider] Rendering error screen');
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
          {(state.error as Error)?.message || 'Unknown error'}
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

  // Show error screen if initialization failed
  if (state.error) {
    console.log('[WorkerProvider] Rendering error screen');
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
          {(state.error as Error)?.message || 'Unknown error'}
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

  console.log('[WorkerProvider] Rendering children with context');
  return (
    <WorkerContext.Provider value={state}>
      {children}
    </WorkerContext.Provider>
  );
};
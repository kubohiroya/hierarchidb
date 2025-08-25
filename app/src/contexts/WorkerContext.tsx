/**
 * @file WorkerContext.tsx
 * @description Context for managing Worker API Client initialization
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { WorkerAPI } from '@hierarchidb/common-api';

interface WorkerContextValue {
  client: WorkerAPI;
}

const WorkerContext = createContext<WorkerContextValue | null>(null);

export interface WorkerProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that initializes Worker API Client once at app startup
 */
export function WorkerProvider({ children }: WorkerProviderProps) {
  const [client, setClient] = useState<WorkerAPI | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initializingRef = useRef(false); // Track if initialization is in progress

  useEffect(() => {
    let mounted = true;

    const initializeWorker = async () => {
      // Prevent multiple initialization attempts
      if (initializingRef.current || isInitialized || client) {
        console.log('[WorkerProvider] Worker already initialized or initializing, skipping');
        return;
      }
      
      initializingRef.current = true;
      
      try {
        console.log('[WorkerProvider] Starting Worker initialization...');
        
        // Try to get existing instance first (with timeout)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        try {
          const workerClient = await Promise.race([
            WorkerAPIClient.getSingleton(),
            timeoutPromise
          ]) as WorkerAPI;
          
          if (mounted && workerClient) {
            console.log('[WorkerProvider] Worker initialized successfully');
            setClient(workerClient);
            setIsInitialized(true);
          }
        } catch (timeoutError) {
          console.warn('[WorkerProvider] Worker initialization timed out, creating new instance');
          // If timeout, assume Worker is already initialized somewhere
          // and we just can't get the singleton properly
          if (mounted) {
            setIsInitialized(true);
            setClient(null); // Will be handled by loaders
          }
        }
      } catch (err) {
        console.error('[WorkerProvider] Failed to initialize Worker:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize Worker'));
          setIsInitialized(true); // Mark as initialized to stop retrying
        }
      }
    };

    initializeWorker();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  // Show error state if initialization failed
  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="error">
          Failed to Initialize Application
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {error.message}
        </Typography>
      </Box>
    );
  }

  // Show loading state while initializing
  if (!isInitialized || !client) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Initializing application...
        </Typography>
      </Box>
    );
  }

  return (
    <WorkerContext.Provider value={{ client }}>
      {children}
    </WorkerContext.Provider>
  );
}

/**
 * Hook to access the Worker API Client
 * @throws Error if used outside of WorkerProvider
 */
export function useWorker(): WorkerContextValue {
  const context = useContext(WorkerContext);
  
  if (!context) {
    throw new Error('useWorker must be used within a WorkerProvider');
  }
  
  return context;
}

/**
 * Get the Worker API Client instance directly
 * This is for use in loaders and other non-component contexts
 */
export async function getWorkerClient(): Promise<WorkerAPI> {
  // This will return the existing singleton instance
  return WorkerAPIClient.getSingleton();
}
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '../../shared/types';
import { useShapeAPIGetter } from './useShapeAPI';
import { BatchProgressEvent, ProcessingStatus, ProgressInfo } from '../../shared';

export interface ShapeProgressState {
  progress: ProgressInfo | null;
  status: ProcessingStatus | null;
  isSubscribed: boolean;
  error: Error | null;
}

export interface UseShapeProgressOptions {
  /**
   * Whether to automatically subscribe on mount
   * @default true
   */
  autoSubscribe?: boolean;

  /**
   * Polling interval in milliseconds as fallback when real-time subscription fails
   * @default 2000
   */
  pollingInterval?: number;

  /**
   * Whether to enable polling fallback
   * @default true
   */
  enablePollingFallback?: boolean;
}

/**
 * React hook for subscribing to batch processing progress updates
 *
 * Provides real-time progress updates via Worker callback subscription,
 * with automatic fallback to polling when callbacks are not available.
 *
 * @param sessionId - Batch session ID to monitor
 * @param options - Configuration options
 * @returns Progress state and control functions
 */
export function useShapeProgress(
  sessionId: string | null,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & {
  subscribe: () => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
} {
  const {
    autoSubscribe = true,
    pollingInterval = 2000,
    enablePollingFallback = true,
  } = options;

  const getShapeAPI = useShapeAPIGetter();

  // State
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRealTimeActiveRef = useRef(false);

  // Handle progress events
  const handleProgressEvent = useCallback((event: BatchProgressEvent) => {
    console.log('📊 Progress update:', event);

    switch (event.type) {
      case 'progress':
        setProgress(event.progress);
        break;
      case 'stage-change':
        setStatus(prev => prev ? { ...prev, stage: event.stage } : null);
        break;
      case 'complete':
        setStatus(prev => prev ? { ...prev, status: 'completed' } : null);
        setProgress(prev => prev ? { ...prev, percentage: 100 } : null);
        break;
      case 'error':
        setError(new Error(event.error));
        setStatus(prev => prev ? { ...prev, status: 'failed', error: event.error } : null);
        break;
    }

    // Mark real-time as active (prevents polling)
    isRealTimeActiveRef.current = true;
  }, []);

  // Polling fallback function
  const pollProgress = useCallback(async () => {
    if (!sessionId || isRealTimeActiveRef.current) return;

    try {
      const api = await getShapeAPI();
      const session = await api.getBatchSession(sessionId);

      if (session) {
        const progressData: ProgressInfo = {
          total: session.totalTasks || 0,
          completed: session.completedTasks || 0,
          failed: session.failedTasks || 0,
          skipped: 0,
          percentage: session.progress || 0,
          currentStage: session.stage,
        };

        const statusData: ProcessingStatus = {
          status: session.status,
          stage: session.stage,
          progress: session.progress,
          lastUpdated: Date.now(),
          error: session.error,
        };

        setProgress(progressData);
        setStatus(statusData);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to poll progress:', err);
      setError(err instanceof Error ? err : new Error('Failed to poll progress'));
    }
  }, [sessionId, getShapeAPI]);

  // Subscribe to real-time updates
  const subscribe = useCallback(async () => {
    if (!sessionId || isSubscribed) return;

    try {
      setError(null);
      const api = await getShapeAPI();

      // Check if subscribeToProgress is available (real-time capability)
      if (typeof (api as any).subscribeToProgress === 'function') {
        console.log('🔔 Subscribing to real-time progress updates');

        const unsubscribe = (api as any).subscribeToProgress(sessionId, handleProgressEvent);
        unsubscribeRef.current = unsubscribe;
        isRealTimeActiveRef.current = false; // Reset flag
        setIsSubscribed(true);

        // Get initial state
        await pollProgress();
      } else if (enablePollingFallback) {
        console.log('📡 Real-time subscription not available, falling back to polling');

        // Start polling
        await pollProgress(); // Get initial state
        pollingIntervalRef.current = setInterval(pollProgress, pollingInterval);
        setIsSubscribed(true);
        isRealTimeActiveRef.current = false;
      } else {
        throw new Error('Real-time subscription not supported and polling fallback is disabled');
      }
    } catch (err) {
      console.error('Failed to subscribe to progress:', err);
      setError(err instanceof Error ? err : new Error('Failed to subscribe'));
    }
  }, [sessionId, isSubscribed, getShapeAPI, handleProgressEvent, pollProgress, enablePollingFallback, pollingInterval]);

  // Unsubscribe from updates
  const unsubscribe = useCallback(() => {
    // Clean up real-time subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Clean up polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsSubscribed(false);
    isRealTimeActiveRef.current = false;
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    try {
      await pollProgress();
    } catch (err) {
      console.error('Failed to refresh progress:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh'));
    }
  }, [pollProgress]);

  // Auto-subscribe on mount
  useEffect(() => {
    if (sessionId && autoSubscribe) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [sessionId, autoSubscribe, subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    progress,
    status,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
    refresh,
  };
}

/**
 * Hook for monitoring Shape entity processing status
 *
 * @param nodeId - Node ID of the Shape entity
 * @param options - Configuration options
 * @returns Progress state for the associated batch session
 */
export function useShapeEntityProgress(
  nodeId: NodeId,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & {
  subscribe: () => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
  sessionId: string | null;
} {
  const getShapeAPI = useShapeAPIGetter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<Error | null>(null);

  // Get session ID from entity
  useEffect(() => {
    let isCancelled = false;

    const loadSessionId = async () => {
      try {
        const api = await getShapeAPI();
        const entity = await api.getEntity(nodeId);

        if (!isCancelled && entity?.batchSessionId) {
          setSessionId(entity.batchSessionId);
          setEntityError(null);
        } else if (!isCancelled) {
          setSessionId(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load entity session ID:', err);
          setEntityError(err instanceof Error ? err : new Error('Failed to load entity'));
        }
      }
    };

    loadSessionId();

    return () => {
      isCancelled = true;
    };
  }, [nodeId, getShapeAPI]);

  const progressHook = useShapeProgress(sessionId, options);

  return {
    ...progressHook,
    sessionId,
    error: progressHook.error || entityError,
  };
}

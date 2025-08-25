/**
 * React hook for BaseMap API access via Comlink
 * NOTE: This hook should be provided by the host application context
 * or replaced with a proper plugin API pattern
 */

import { useMemo } from 'react';
import type { BaseMapAPI } from '../../shared';

/**
 * Hook to get BaseMap API proxy for UI-Worker communication
 * Returns a Comlink proxy that automatically handles RPC calls
 */
export function useBaseMapAPI(): Promise<BaseMapAPI> {
  // TODO: This should be provided by the application context
  // For now, returning a mock implementation
  return useMemo(async () => {
    throw new Error('useBaseMapAPI requires application context - not yet implemented');
  }, []);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useBaseMapAPIGetter(): () => Promise<BaseMapAPI> {
  // TODO: This should be provided by the application context
  return useMemo(() => {
    return async (): Promise<BaseMapAPI> => {
      throw new Error('useBaseMapAPIGetter requires application context - not yet implemented');
    };
  }, []);
}
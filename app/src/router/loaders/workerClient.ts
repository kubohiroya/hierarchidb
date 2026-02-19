/**
 * workerClient.ts - Worker initialization service for TanStack Router
 *
 * Phase 4: Worker initialization refactor
 *
 * This module provides a unified interface for Worker initialization with:
 * - Automatic retry with configurable delays
 * - Timeout handling
 * - AbortSignal support
 * - Integration with TanStack Router beforeLoad hooks
 */

import type { BuildWorkerAPI } from '~/types/worker-api';
import type { Remote } from 'comlink';
import {
  ensureWorkerInitialized,
  getWorkerSnapshot,
} from '~/worker-runtime/WorkerStateStore';

/**
 * Configuration options for Worker initialization
 */
export interface WorkerStartOptions {
  /**
   * Timeout in milliseconds for the entire initialization process
   * @default 20000 (20 seconds)
   */
  timeoutMs?: number;

  /**
   * Array of delays (in milliseconds) between retry attempts
   * @default [1000, 2000, 5000] - Exponential backoff: 1s, 2s, 5s
   */
  retryDelays?: number[];

  /**
   * AbortSignal to cancel initialization
   */
  signal?: AbortSignal;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration for Worker initialization
 */
const DEFAULT_OPTIONS: Required<Omit<WorkerStartOptions, 'signal'>> = {
  timeoutMs: 20000, // 20 seconds total timeout
  retryDelays: [1000, 2000, 5000], // 1s, 2s, 5s delays between retries
  debug: false,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensure Worker is started with retry and timeout support
 *
 * This function is the primary entry point for TanStack Router loaders
 * to ensure the Worker is initialized before loading data.
 *
 * Features:
 * - Automatic retry on failure with exponential backoff
 * - Global timeout to prevent indefinite waiting
 * - AbortSignal support for cancellation
 * - Returns cached client if already initialized
 *
 * @param options Configuration options for initialization
 * @returns Promise that resolves to the Worker API client
 * @throws Error if initialization fails after all retries or timeout
 *
 * @example
 * ```typescript
 * // In a TanStack Router beforeLoad hook
 * export const myRoute = createRoute({
 *   beforeLoad: async () => {
 *     const client = await ensureWorkerStarted();
 *     return { client };
 *   },
 * });
 * ```
 */
export async function ensureWorkerStarted(
  options: WorkerStartOptions = {}
): Promise<Remote<BuildWorkerAPI>> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (config.debug) {
    console.log('[workerClient] ensureWorkerStarted called with options:', config);
  }

  // Check if signal is already aborted
  if (config.signal?.aborted) {
    throw new DOMException('Worker initialization was aborted', 'AbortError');
  }

  // Check if worker is already initialized
  const snapshot = getWorkerSnapshot();
  if (snapshot.state === 'ready' && snapshot.client) {
    if (config.debug) {
      console.log('[workerClient] Worker already initialized, returning cached client');
    }
    return snapshot.client;
  }

  const maxAttempts = 1 + config.retryDelays.length; // Initial attempt + retries
  let lastError: Error | null = null;

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Worker initialization timeout after ${config.timeoutMs}ms`));
    }, config.timeoutMs);

    // Clear timeout if signal is aborted
    config.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
    });
  });

  // Attempt initialization with retries
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (config.debug) {
        console.log(`[workerClient] Initialization attempt ${attempt + 1}/${maxAttempts}`);
      }

      // Race between initialization and timeout
      const client = await Promise.race([
        ensureWorkerInitialized({ signal: config.signal }),
        timeoutPromise,
      ]);

      if (config.debug) {
        console.log('[workerClient] Worker initialized successfully');
      }

      // Dispatch custom event for compatibility with existing code
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hierarchidb-worker-init-complete'));
      }

      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort or timeout
      if (lastError.name === 'AbortError' || lastError.message.includes('timeout')) {
        throw lastError;
      }

      // If this is not the last attempt, wait before retrying
      if (attempt < maxAttempts - 1) {
        const delay = config.retryDelays[attempt];
        if (config.debug) {
          console.warn(
            `[workerClient] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
          );
        }
        if (delay) {
          await sleep(delay);
        }
      }
    }
  }

  // All attempts failed
  const errorMessage = `Worker initialization failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`;
  if (config.debug) {
    console.error('[workerClient]', errorMessage);
  }
  throw new Error(errorMessage);
}

/**
 * Get the cached Worker client if available
 *
 * This is a synchronous function that returns the client immediately
 * if it's already initialized, or null otherwise.
 *
 * Use this when you want to check if the Worker is ready without
 * triggering initialization.
 *
 * @returns The Worker API client or null if not initialized
 *
 * @example
 * ```typescript
 * const client = getWorkerClient();
 * if (client) {
 *   // Worker is ready
 * } else {
 *   // Need to call ensureWorkerStarted()
 * }
 * ```
 */
export function getWorkerClient(): Remote<BuildWorkerAPI> | null {
  const snapshot = getWorkerSnapshot();
  return snapshot.client;
}

/**
 * Check if Worker is ready
 *
 * @returns true if Worker is initialized and ready
 */
export function isWorkerReady(): boolean {
  const snapshot = getWorkerSnapshot();
  return snapshot.state === 'ready' && snapshot.client !== null;
}

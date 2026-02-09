/**
 * WorkerInitializationChannel - Handles Worker initialization detection via MessageChannel
 *
 * This provides a Comlink-independent way to detect when the Worker has completed
 * its internal initialization, using native browser messaging APIs.
 */

import type {
  InitializationResult,
  WorkerInitConfig,
  WorkerInitMessage,
  WorkerInitRequest,
  WorkerInitMessageTarget,
} from './types.js';

const INIT_EVENT_START = 'hierarchidb-worker-init-start';
const INIT_EVENT_PROGRESS = 'hierarchidb-worker-init-progress';
const INIT_EVENT_ERROR = 'hierarchidb-worker-init-error';
const INIT_EVENT_COMPLETE = 'hierarchidb-worker-init-complete';

const dispatchInitEvent = (eventName: string, detail?: unknown) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

export class WorkerInitializationChannel {
  private worker: WorkerInitMessageTarget | null = null;
  private initPromise: Promise<InitializationResult> | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private debug: boolean = false;

  /**
   * Attach to a Worker and wait for initialization
   */
  public waitForInitialization(config: WorkerInitConfig): Promise<InitializationResult> {
    const { worker, timeout = 30000, debug = false } = config;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.worker = worker as WorkerInitMessageTarget;
    this.debug = debug;
    const startTime = Date.now();

    dispatchInitEvent(INIT_EVENT_START, { timestamp: startTime });

    this.initPromise = new Promise<InitializationResult>((resolve, reject) => {
      let timeoutId: number | null = null;

      // Set up timeout
      timeoutId = window.setTimeout(() => {
        this.cleanup();
        const error = new Error(`Worker initialization timeout after ${timeout}ms`);
        dispatchInitEvent(INIT_EVENT_ERROR, { error: error.message });
        reject({ success: false, error, duration: Date.now() - startTime });
      }, timeout);

      // Set up message handler
      this.messageHandler = (event: MessageEvent) => {
        const message = event.data as WorkerInitMessage;

        if (this.debug) {
          console.log('[WorkerInitChannel] Received message:', message);
        }

        switch (message.type) {
          case 'INIT_COMPLETE':
            {
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
              this.cleanup();
              const duration = Date.now() - startTime;
              dispatchInitEvent(INIT_EVENT_COMPLETE, { duration });
              resolve({
                success: true,
                duration,
              });
            }
            break;

          case 'INIT_ERROR': {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            this.cleanup();
            const errorMessage = message.payload?.error || 'Worker initialization failed';
            const error = new Error(errorMessage);
            dispatchInitEvent(INIT_EVENT_ERROR, { error: errorMessage });
            reject({
              success: false,
              error,
              duration: Date.now() - startTime,
            });
            break;
          }

          case 'INIT_PROGRESS':
            if (this.debug) {
              console.log(
                `[WorkerInitChannel] Progress: ${message.payload?.progress}% - ${message.payload?.message}`
              );
            }
            dispatchInitEvent(INIT_EVENT_PROGRESS, {
              progress: message.payload?.progress,
              message: message.payload?.message,
            });
            break;

          case 'PING_RESPONSE':
            if (this.debug) {
              console.log('[WorkerInitChannel] Ping response received');
            }
            break;
        }
      };

      // Attach the message handler
      if (!this.worker) {
        throw new Error('Worker is not initialized');
      }
      this.worker.start?.();
      this.worker.addEventListener('message', this.messageHandler);

      // Send initialization request
      const request: WorkerInitRequest = {
        type: 'INIT_REQUEST',
        timestamp: Date.now(),
      };
      this.worker.postMessage(request);

      if (this.debug) {
        console.log('[WorkerInitChannel] Sent initialization request');
      }
    });

    return this.initPromise;
  }

  /**
   * Send a ping to check if Worker is responsive
   */
  public async ping(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 1000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'PING_RESPONSE') {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          resolve(true);
        }
      };

      if (this.worker) {
        this.worker.start?.();
        this.worker.addEventListener('message', handler);
        const request: WorkerInitRequest = { type: 'PING' };
        this.worker.postMessage(request);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Clean up event listeners
   */
  private cleanup(): void {
    if (this.worker && this.messageHandler) {
      this.worker.removeEventListener('message', this.messageHandler);
    }
    this.messageHandler = null;
    this.initPromise = null;
  }

  /**
   * Dispose of the channel
   */
  public dispose(): void {
    this.cleanup();
    this.worker = null;
  }
}

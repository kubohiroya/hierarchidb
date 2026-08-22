/**
 * Worker-side initialization reporter
 *
 * This module handles sending initialization status messages from the Worker
 * to the UI thread via postMessage, independent of Comlink.
 */

import type {
  InitializationStep,
  WorkerInitMessage,
  WorkerInitMessageTarget,
  WorkerInitRequest,
} from './types.js';

export class WorkerInitializationReporter {
  private isInitialized = false;
  private initSteps: InitializationStep[] = [];
  private currentStep = 0;
  private currentProgress = 0;
  private debug = false;
  private messageTarget: WorkerInitMessageTarget | null = null;
  private sender?: (message: WorkerInitMessage) => void;
  private messageListenerEnabled = true;

  constructor(
    steps: InitializationStep[] = [],
    debug = false,
    options?: {
      messageTarget?: WorkerInitMessageTarget | null;
      sender?: (message: WorkerInitMessage) => void;
      listenForRequests?: boolean;
    }
  ) {
    this.initSteps = steps;
    this.debug = debug;
    this.messageTarget =
      options?.messageTarget ??
      (typeof self !== 'undefined' ? (self as WorkerInitMessageTarget) : null);
    this.sender = options?.sender;
    this.messageListenerEnabled = options?.listenForRequests ?? true;
    this.setupMessageListener();
  }

  /**
   * Set up message listener for initialization requests
   */
  private setupMessageListener(): void {
    if (!this.messageListenerEnabled) return;
    if (!this.messageTarget || typeof this.messageTarget.addEventListener !== 'function') {
      return;
    }
    this.messageTarget.start?.();
    this.messageTarget.addEventListener('message', (event: MessageEvent) => {
      const request = event.data as WorkerInitRequest;

      if (request.type === 'INIT_REQUEST') {
        this.reportCurrentStatus();
      } else if (request.type === 'PING') {
        this.sendMessage('PING_RESPONSE', { timestamp: Date.now() });
      }
    });
  }

  /**
   * Add initialization steps dynamically
   */
  public addSteps(steps: InitializationStep[]): void {
    this.initSteps.push(...steps);
  }

  /**
   * Report progress for a specific initialization step
   */
  public reportStepProgress(stepName: string, stepProgress: number = 100): void {
    const stepIndex = this.initSteps.findIndex((s) => s.name === stepName);
    if (stepIndex === -1) {
      if (this.debug) {
        console.warn(`[WorkerInitReporter] Unknown step: ${stepName}`);
      }
      return;
    }

    this.currentStep = stepIndex;

    // Calculate overall progress
    let totalProgress = 0;
    const totalWeight = this.initSteps.reduce((sum, step) => sum + step.weight, 0);

    for (let i = 0; i < stepIndex; i++) {
      const step = this.initSteps[i];
      if (step) {
        totalProgress += step.weight;
      }
    }
    const currentStep = this.initSteps[stepIndex];
    if (currentStep) {
      totalProgress += (currentStep.weight * stepProgress) / 100;
    }

    this.currentProgress = Math.round((totalProgress / totalWeight) * 100);

    this.sendMessage('INIT_PROGRESS', {
      progress: this.currentProgress,
      message: stepName,
    });
  }

  /**
   * Report initialization complete
   */
  public reportComplete(): void {
    this.isInitialized = true;
    this.currentProgress = 100;
    this.sendMessage('INIT_COMPLETE', {
      progress: 100,
      message: 'Worker initialized successfully',
    });
  }

  /**
   * Report initialization error
   */
  public reportError(error: Error | string): void {
    this.sendMessage('INIT_ERROR', {
      error: error instanceof Error ? error.message : error,
    });
  }

  /**
   * Report current status (for late requests)
   */
  private reportCurrentStatus(): void {
    if (this.isInitialized) {
      this.reportComplete();
    } else if (this.currentProgress > 0) {
      const currentStepName = this.initSteps[this.currentStep]?.name || 'Initializing...';
      this.sendMessage('INIT_PROGRESS', {
        progress: this.currentProgress,
        message: currentStepName,
      });
    } else {
      // Just started or not initialized yet
      this.sendMessage('INIT_PROGRESS', {
        progress: 0,
        message: 'Starting initialization...',
      });
    }
  }

  /**
   * Send the current status to a specific target.
   */
  public sendStatusTo(target: WorkerInitMessageTarget): void {
    if (this.isInitialized) {
      this.sendMessageToTarget(target, 'INIT_COMPLETE', {
        progress: 100,
        message: 'Worker initialized successfully',
      });
      return;
    }
    if (this.currentProgress > 0) {
      const currentStepName = this.initSteps[this.currentStep]?.name || 'Initializing...';
      this.sendMessageToTarget(target, 'INIT_PROGRESS', {
        progress: this.currentProgress,
        message: currentStepName,
      });
      return;
    }
    this.sendMessageToTarget(target, 'INIT_PROGRESS', {
      progress: 0,
      message: 'Starting initialization...',
    });
  }

  /**
   * Send a message to the UI thread
   */
  private sendMessage(
    type: WorkerInitMessage['type'],
    payload?: WorkerInitMessage['payload']
  ): void {
    const message: WorkerInitMessage = {
      type,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    };

    if (this.debug) {
      console.log('[WorkerInitReporter] Sending message:', message);
    }

    if (this.sender) {
      this.sender(message);
      return;
    }

    if (this.messageTarget && typeof this.messageTarget.postMessage === 'function') {
      this.messageTarget.postMessage(message);
    }
  }

  private sendMessageToTarget(
    target: WorkerInitMessageTarget,
    type: WorkerInitMessage['type'],
    payload?: WorkerInitMessage['payload']
  ): void {
    const message: WorkerInitMessage = {
      type,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    };

    if (this.debug) {
      console.log('[WorkerInitReporter] Sending message to target:', message);
    }

    target.postMessage(message);
  }

  /**
   * Track initialization with automatic progress reporting
   */
  public async trackInitialization<T>(stepName: string, operation: () => Promise<T>): Promise<T> {
    try {
      this.reportStepProgress(stepName, 0);
      const result = await operation();
      this.reportStepProgress(stepName, 100);
      return result;
    } catch (error) {
      this.reportError(error as Error);
      throw error;
    }
  }

  /**
   * Check if initialization is complete
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

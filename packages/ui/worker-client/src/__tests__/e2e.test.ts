import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkerInitMessage } from '../types';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel';

type MessageListener = (this: Worker, ev: MessageEvent<WorkerInitMessage>) => unknown;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeWorker implements Worker {
  public onerror: ((this: Worker, ev: ErrorEvent) => unknown) | null = null;
  public onmessage: MessageListener | null = null;
  public onmessageerror: ((this: Worker, ev: MessageEvent<unknown>) => unknown) | null = null;
  public onPostMessage?: (message: unknown) => void;

  private listeners = new Map<EventListenerOrEventListenerObject, MessageListener>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'message') return;
    const wrapped: MessageListener = (event) => {
      if (typeof listener === 'function') {
        (listener as MessageListener).call(this, event);
      } else {
        listener.handleEvent?.(event);
      }
    };
    this.listeners.set(listener, wrapped);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'message') return;
    this.listeners.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    if (event.type !== 'message') return true;
    const messageEvent = event as MessageEvent<WorkerInitMessage>;
    this.onmessage?.call(this, messageEvent);
    for (const handler of this.listeners.values()) {
      handler.call(this, messageEvent);
    }
    return true;
  }

  postMessage(message: unknown): void {
    this.onPostMessage?.(message);
  }

  terminate(): void {
    this.listeners.clear();
    this.onmessage = null;
  }

  emit(type: WorkerInitMessage['type'], payload: Record<string, unknown> = {}): void {
    const event = new MessageEvent<WorkerInitMessage>('message', {
      data: {
        type,
        payload: {
          ...payload,
          timestamp: Date.now(),
        },
      },
    });
    queueMicrotask(() => {
      this.dispatchEvent(event);
    });
  }
}

async function simulateSuccessfulInitialization(worker: FakeWorker): Promise<void> {
  worker.emit('INIT_PROGRESS', { progress: 0, message: 'Starting initialization...' });
  await flush();
  worker.emit('INIT_PROGRESS', { progress: 33, message: 'Setting up worker...' });
  await flush();
  worker.emit('INIT_PROGRESS', { progress: 66, message: 'Preparing API...' });
  await flush();
  worker.emit('INIT_PROGRESS', { progress: 100, message: 'Almost ready...' });
  await flush();
  worker.emit('INIT_COMPLETE', { progress: 100, message: 'Worker initialized successfully' });
}

describe('Worker Initialization E2E Tests', () => {
  let worker: FakeWorker;
  let channel: WorkerInitializationChannel;

  beforeEach(() => {
    worker = new FakeWorker();
    channel = new WorkerInitializationChannel();
  });

  afterEach(() => {
    worker.terminate();
    channel.dispose();
  });

  it('should complete full initialization flow with progress updates', async () => {
    const progressUpdates: WorkerInitMessage[] = [];

    worker.addEventListener('message', (event) => {
      if (event.data.type === 'INIT_PROGRESS') {
        progressUpdates.push(event.data);
      }
    });

    worker.onPostMessage = (message) => {
      if (message.type === 'INIT_REQUEST') {
        void simulateSuccessfulInitialization(worker);
      }
    };

    const initPromise = channel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: true,
    });

    // Mirror original test flow by sending an explicit start message
    worker.postMessage({ type: 'START_INIT' });

    const result = await initPromise;

    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
    expect(progressUpdates.length).toBeGreaterThan(0);

    const progressValues = progressUpdates.map((update) => update.payload?.progress ?? 0);
    for (let index = 1; index < progressValues.length; index += 1) {
      expect(progressValues[index]).toBeGreaterThanOrEqual(progressValues[index - 1]);
    }
  }, 10000);

  it('should handle initialization timeout', async () => {
    worker.onPostMessage = () => {
      // Intentionally do nothing so the timeout triggers
    };

    await expect(
      channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 50,
        debug: false,
      })
    ).rejects.toMatchObject({
      success: false,
      error: expect.objectContaining({
        message: expect.stringContaining('timeout'),
      }),
    });
  });

  it('should handle worker errors during initialization', async () => {
    const errorWorker = new FakeWorker();
    errorWorker.onPostMessage = (message) => {
      if (message.type === 'INIT_REQUEST') {
        errorWorker.emit('INIT_ERROR', { error: 'Simulated initialization error' });
      }
    };

    await expect(
      channel.waitForInitialization({
        worker: errorWorker as unknown as Worker,
        timeout: 5000,
        debug: false,
      })
    ).rejects.toMatchObject({
      success: false,
      error: expect.objectContaining({ message: 'Simulated initialization error' }),
    });

    errorWorker.terminate();
  });

  it('should support ping functionality after initialization', async () => {
    worker.onPostMessage = (message) => {
      if (message.type === 'INIT_REQUEST') {
        void simulateSuccessfulInitialization(worker);
      }
      if (message.type === 'PING') {
        worker.emit('PING_RESPONSE', {});
      }
    };

    await channel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: false,
    });

    const pingResult = await channel.ping();
    expect(pingResult).toBe(true);
  });

  it('should handle concurrent initialization requests', async () => {
    worker.onPostMessage = (message) => {
      if (message.type === 'INIT_REQUEST') {
        void simulateSuccessfulInitialization(worker);
      }
    };

    const promise1 = channel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: false,
    });

    const promise2 = channel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: false,
    });

    expect(promise1).toBe(promise2);

    worker.postMessage({ type: 'START_INIT' });

    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual(result2);
    expect(result1.success).toBe(true);
  });

  it('should properly clean up resources on dispose', async () => {
    worker.onPostMessage = (message) => {
      if (message.type === 'PING') {
        worker.emit('PING_RESPONSE', {});
      }
    };

    void channel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: false,
    });

    channel.dispose();

    worker.postMessage({ type: 'PING' });
    await flush();

    worker.onPostMessage = (message) => {
      if (message.type === 'INIT_REQUEST') {
        void simulateSuccessfulInitialization(worker);
      }
    };

    const newChannel = new WorkerInitializationChannel();

    worker.postMessage({ type: 'START_INIT' });

    const result = await newChannel.waitForInitialization({
      worker: worker as unknown as Worker,
      timeout: 5000,
      debug: false,
    });

    expect(result.success).toBe(true);

    newChannel.dispose();
  });
});

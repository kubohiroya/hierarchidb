
import { parentPort } from 'worker_threads';

class WorkerInitializationReporter {
  constructor() {
    this.isInitialized = false;
    this.currentProgress = 0;
    this.setupMessageListener();
    console.log('[Worker] Reporter created');
  }

  setupMessageListener() {
    if (!parentPort) {
      console.error('[Worker] No parentPort available');
      return;
    }
    
    parentPort.on('message', (data) => {
      console.log('[Worker] Received message:', data);
      const request = data;
      
      if (request.type === 'INIT_REQUEST') {
        console.log('[Worker] Handling INIT_REQUEST');
        this.performInitialization();
      } else if (request.type === 'PING') {
        console.log('[Worker] Handling PING');
        this.sendMessage('PING_RESPONSE', { timestamp: Date.now() });
      } else if (request.type === 'START_INIT') {
        console.log('[Worker] Handling START_INIT');
        this.performInitialization();
      } else if (request.type === 'ERROR_TEST') {
        console.log('[Worker] Handling ERROR_TEST');
        this.sendMessage('INIT_ERROR', {
          error: 'Test error message',
        });
      }
    });
  }

  async performInitialization() {
    try {
      console.log('[Worker] Starting initialization');
      
      // Step 1: Loading
      this.sendMessage('INIT_PROGRESS', {
        progress: 0,
        message: 'Starting initialization...',
      });
      await this.delay(30);

      // Step 2: Setup
      this.sendMessage('INIT_PROGRESS', {
        progress: 33,
        message: 'Setting up worker...',
      });
      await this.delay(30);

      // Step 3: Preparing
      this.sendMessage('INIT_PROGRESS', {
        progress: 66,
        message: 'Preparing API...',
      });
      await this.delay(30);

      // Step 4: Complete
      this.sendMessage('INIT_PROGRESS', {
        progress: 100,
        message: 'Almost ready...',
      });
      await this.delay(10);

      // Mark as complete
      this.isInitialized = true;
      this.currentProgress = 100;
      console.log('[Worker] Sending INIT_COMPLETE');
      this.sendMessage('INIT_COMPLETE', {
        progress: 100,
        message: 'Worker initialized successfully',
      });
    } catch (error) {
      console.error('[Worker] Initialization error:', error);
      this.sendMessage('INIT_ERROR', {
        error: error.message || 'Initialization failed',
      });
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reportCurrentStatus() {
    if (this.isInitialized) {
      this.sendMessage('INIT_COMPLETE', {
        progress: 100,
        message: 'Worker initialized successfully',
      });
    } else {
      this.sendMessage('INIT_PROGRESS', {
        progress: this.currentProgress,
        message: 'Initializing...',
      });
    }
  }

  sendMessage(type, payload) {
    if (!parentPort) {
      console.error('[Worker] No parentPort for sending');
      return;
    }
    
    const message = {
      type,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    };
    console.log('[Worker] Sending message:', message);
    parentPort.postMessage(message);
  }
}

// Create reporter instance
const reporter = new WorkerInitializationReporter();
console.log('[TestWorker] Worker started');
  
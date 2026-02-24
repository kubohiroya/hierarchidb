/**
 * SharedWorker entry point (error-safe)
 * Keep imports explicit to stabilize preview bundling.
 */

import './worker-react-refresh-shim.js';
import type { WorkerInitMessage, WorkerInitRequest } from '@hierarchidb/ui-worker-client';
import { WorkerInitializationReporter } from '@hierarchidb/ui-worker-client';
import { ensureRuntimeWorkerBootstrap } from './workerBootstrap.ts';

const ports = new Set<MessagePort>();
let initCompleted = false;
let bootstrapPromise: Promise<{ api: unknown; servicesReadyAt: number }> | null = null;

const broadcastMessage = (message: unknown) => {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      ports.delete(port);
    }
  }
};

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugin-loaders', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false,
  {
    sender: (message) => broadcastMessage(message),
    listenForRequests: false,
  }
);

reporter.reportStepProgress('Load Comlink', 0);

const ensureBootstrap = async () => {
  if (!bootstrapPromise) {
    const bootstrap = async () => ensureRuntimeWorkerBootstrap({
      reporter,
      messageTarget: {
        postMessage: (msg: unknown) => {
          broadcastMessage(msg);
        },
      },
    });

    // SharedWorker is already single-runtime per origin/process.
    // Avoid Web Locks here to prevent lock-wait deadlocks across stale contexts.
    bootstrapPromise = bootstrap().catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn('[shared worker] bootstrap failed:', err.message);
      reporter.reportError(err);
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
};

const sendServicesReady = (port: MessagePort, at: number) => {
  try {
    port.postMessage({ type: 'SERVICES_READY', source: 'worker', at });
  } catch {
    ports.delete(port);
  }
};

const handleInitRequest = (port: MessagePort, request: WorkerInitRequest) => {
  if (request.type === 'INIT_REQUEST') {
    reporter.sendStatusTo(port);
    return;
  }
  if (request.type === 'PING') {
    port.postMessage({ type: 'PING_RESPONSE', payload: { timestamp: Date.now() } } satisfies WorkerInitMessage);
  }
};

type SharedWorkerConnectEvent = MessageEvent & { ports: MessagePort[] };
type SharedWorkerScope = {
  addEventListener: (type: 'connect', listener: EventListener) => void;
};

const globalScope = self as SharedWorkerScope;

globalScope.addEventListener('connect', ((event: Event) => {
  const connectEvent = event as SharedWorkerConnectEvent;
  const port = connectEvent.ports[0];
  if (!port) return;
  ports.add(port);
  port.start();

  port.addEventListener('message', (messageEvent: MessageEvent) => {
    const data = messageEvent.data as WorkerInitRequest | undefined;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'INIT_REQUEST' || data.type === 'PING') {
      handleInitRequest(port, data);
    }
  });

  void ensureBootstrap().then(async ({ api, servicesReadyAt }) => {
    const Comlink = await import('comlink');
    if (!initCompleted) {
      reporter.reportStepProgress('Expose API', 10);
    }
    Comlink.expose(api as object, port);

    if (!initCompleted) {
      reporter.reportStepProgress('Expose API', 100);
      reporter.reportComplete();
      initCompleted = true;
    }

    sendServicesReady(port, servicesReadyAt);
    reporter.sendStatusTo(port);
  }).catch(() => {});
}) as EventListener);

/**
 * SharedWorker entry point (error-safe)
 * Keep imports explicit to stabilize preview bundling.
 */

import './worker-react-refresh-shim.js';
import type { OriginCoordinatorMessageTarget } from '@hierarchidb/origin-coordinator';
import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
  revokeOriginCoordinatorOwnedClientHandles,
} from '@hierarchidb/origin-coordinator';
import type { WorkerInitMessage, WorkerInitRequest } from '@hierarchidb/ui-worker-client';
import { WorkerInitializationReporter } from '@hierarchidb/ui-worker-client';
import { revokeLegacyYamlAccessAndClose } from '@hierarchidb/yaml-store';
import type { BuildWorkerAPI } from '~/types/workerApiTypes';
import { ensureRuntimeWorkerBootstrap } from './workerBootstrapUtils.ts';

const ports = new Set<MessagePort>();
const coordinatorMessageListeners = new Set<(event: MessageEvent<unknown>) => void>();
let initCompleted = false;
let runtimeAccessRevoked = false;
let bootstrapPromise: Promise<{ api: BuildWorkerAPI; servicesReadyAt: number }> | null = null;

const coordinatorMessageTarget: OriginCoordinatorMessageTarget = {
  addEventListener(_type, listener): void {
    coordinatorMessageListeners.add(listener);
    for (const port of ports) port.addEventListener('message', listener);
  },
  removeEventListener(_type, listener): void {
    coordinatorMessageListeners.delete(listener);
    for (const port of ports) port.removeEventListener('message', listener);
  },
};

const responder = installOriginCoordinatorBridgeResponder({
  target: coordinatorMessageTarget,
  releaseId: getOriginCoordinatorSourceSha(),
  revokeLegacyYamlAccess: async () => {
    runtimeAccessRevoked = true;
    let closeFailed = false;
    const bootstrap = bootstrapPromise;
    if (bootstrap !== null) {
      try {
        const { api } = await bootstrap;
        await api.shutdown();
      } catch {
        closeFailed = true;
      }
    }
    try {
      await revokeOriginCoordinatorOwnedClientHandles();
    } catch {
      closeFailed = true;
    }
    try {
      revokeLegacyYamlAccessAndClose();
    } catch {
      closeFailed = true;
    }
    for (const port of ports) {
      try {
        port.close();
      } catch {
        closeFailed = true;
      }
    }
    ports.clear();
    if (closeFailed) throw new Error('shared-worker-quiescence-close-failed');
  },
});

const guardApi = (api: BuildWorkerAPI): BuildWorkerAPI =>
  new Proxy(api, {
    get(target, property, receiver) {
      responder.assertLegacyYamlAccessAllowed();
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function'
        ? (...args: unknown[]) => {
            responder.assertLegacyYamlAccessAllowed();
            return Reflect.apply(value, target, args);
          }
        : value;
    },
  });

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
  responder.assertLegacyYamlAccessAllowed();
  if (!bootstrapPromise) {
    const bootstrap = async () =>
      ensureRuntimeWorkerBootstrap({
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
    port.postMessage({
      type: 'PING_RESPONSE',
      payload: { timestamp: Date.now() },
    } satisfies WorkerInitMessage);
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
  for (const listener of coordinatorMessageListeners) {
    port.addEventListener('message', listener);
  }
  if (runtimeAccessRevoked) {
    port.close();
    return;
  }
  ports.add(port);
  port.start();

  port.addEventListener('message', (messageEvent: MessageEvent) => {
    const data = messageEvent.data as WorkerInitRequest | undefined;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'INIT_REQUEST' || data.type === 'PING') {
      handleInitRequest(port, data);
    }
  });

  void ensureBootstrap()
    .then(async ({ api, servicesReadyAt }) => {
      responder.assertLegacyYamlAccessAllowed();
      const Comlink = await import('comlink');
      if (!initCompleted) {
        reporter.reportStepProgress('Expose API', 10);
      }
      Comlink.expose(guardApi(api), port);

      if (!initCompleted) {
        reporter.reportStepProgress('Expose API', 100);
        reporter.reportComplete();
        initCompleted = true;
      }

      sendServicesReady(port, servicesReadyAt);
      reporter.sendStatusTo(port);
    })
    .catch(() => {});
}) as EventListener);

/**
 * Worker entry point (error-safe)
 * Keep imports explicit to stabilize preview bundling.
 */

import './worker-react-refresh-shim.js';
import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
  requireOriginCoordinatorDedicatedWorkerTarget,
  revokeOriginCoordinatorOwnedClientHandles,
} from '@hierarchidb/origin-coordinator';
import { WorkerInitializationReporter } from '@hierarchidb/ui-worker-client';
import { revokeLegacyYamlAccessAndClose } from '@hierarchidb/yaml-store/legacy-close';
import type { BuildWorkerAPI } from '~/types/workerApiTypes';
import { ensureRuntimeWorkerBootstrap } from './workerBootstrapUtils.ts';

let bootstrapPromise: Promise<{ api: BuildWorkerAPI; servicesReadyAt: number }> | null = null;

const yamlStorageGate = new URL(self.location.href).searchParams.get('yamlStorageGate');

const responder = installOriginCoordinatorBridgeResponder({
  target: requireOriginCoordinatorDedicatedWorkerTarget(globalThis),
  releaseId: getOriginCoordinatorSourceSha(),
  revokeLegacyYamlAccess: async () => {
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
    if (closeFailed) throw new Error('runtime-worker-quiescence-close-failed');
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

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugin-loaders', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false
);

reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    responder.assertLegacyYamlAccessAllowed();
    bootstrapPromise = ensureRuntimeWorkerBootstrap({
      reporter,
      yamlStorageGate:
        yamlStorageGate === 'revoked-ready-for-preflight'
          ? yamlStorageGate
          : (() => {
              throw new Error('yaml-storage-canonical-gate-required');
            })(),
      messageTarget: self,
    });
    const { api } = await bootstrapPromise;
    responder.assertLegacyYamlAccessAllowed();

    reporter.reportStepProgress('Expose API', 10);
    const Comlink = await import('comlink');
    Comlink.expose(guardApi(api));
    reporter.reportStepProgress('Expose API', 100);
    reporter.reportComplete();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn('[worker bootstrap] runtime-worker-worker wiring failed:', err.message);
    reporter.reportError(err);
    throw err;
  }
})();

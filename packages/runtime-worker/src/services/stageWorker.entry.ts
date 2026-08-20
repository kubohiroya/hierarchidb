import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
} from '@hierarchidb/origin-coordinator';
import * as Comlink from 'comlink';
import { getStageProcessingService } from './StageProcessingService.js';

installOriginCoordinatorBridgeResponder({
  target: globalThis.navigator.serviceWorker,
  releaseId: getOriginCoordinatorSourceSha(),
  revokeLegacyYamlAccess: () => undefined,
});

(async () => {
  const svc = await getStageProcessingService();
  // Expose a stable surface over Comlink
  Comlink.expose(svc);
})();

// Worker entry for StageProcessingService
// Exposes the StageProcessingService over Comlink

import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
} from '@hierarchidb/origin-coordinator';
import { expose } from 'comlink';
import { getStageProcessingService } from './services/StageProcessingService.js';

installOriginCoordinatorBridgeResponder({
  target: globalThis.navigator.serviceWorker,
  releaseId: getOriginCoordinatorSourceSha(),
  revokeLegacyYamlAccess: () => undefined,
});

async function main() {
  const svc = await getStageProcessingService();
  expose(svc);
}

main();

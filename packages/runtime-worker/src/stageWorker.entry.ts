// Worker entry for StageProcessingService
// Exposes the StageProcessingService over Comlink

import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorCensusResponder,
  type OriginCoordinatorMessageTarget,
} from '@hierarchidb/origin-coordinator';
import { expose } from 'comlink';
import { getStageProcessingService } from './services/StageProcessingService.js';

installOriginCoordinatorCensusResponder(
  globalThis as unknown as OriginCoordinatorMessageTarget,
  getOriginCoordinatorSourceSha()
);

async function main() {
  const svc = await getStageProcessingService();
  expose(svc);
}

main();

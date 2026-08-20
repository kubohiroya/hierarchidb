import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorCensusResponder,
  type OriginCoordinatorMessageTarget,
} from '@hierarchidb/origin-coordinator';
import * as Comlink from 'comlink';
import { getStageProcessingService } from './StageProcessingService.js';

installOriginCoordinatorCensusResponder(
  globalThis as unknown as OriginCoordinatorMessageTarget,
  getOriginCoordinatorSourceSha()
);

(async () => {
  const svc = await getStageProcessingService();
  // Expose a stable surface over Comlink
  Comlink.expose(svc);
})();

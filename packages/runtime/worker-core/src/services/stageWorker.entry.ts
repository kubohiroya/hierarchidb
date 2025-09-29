import * as Comlink from 'comlink';
import { getStageProcessingService } from './StageProcessingService.js';

(async () => {
  const svc = await getStageProcessingService();
  // Expose a stable surface over Comlink
  Comlink.expose(svc);
})();


// Worker entry for StageProcessingService
// Exposes the StageProcessingService over Comlink
import { expose } from 'comlink';
import { getStageProcessingService } from './services/StageProcessingService';

async function main() {
  const svc = await getStageProcessingService();
  expose(svc);
}

main();


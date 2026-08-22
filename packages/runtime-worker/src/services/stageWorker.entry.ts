import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
  requireOriginCoordinatorDedicatedWorkerTarget,
} from '@hierarchidb/origin-coordinator';
import { initializeRouteDB } from '@hierarchidb/route-store';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import * as Comlink from 'comlink';
import { getStageProcessingService } from './StageProcessingService.js';

const databasePrefix = getBuildDatabasePrefix();
initializeEphemeralDB(getDBName(databasePrefix, 'ephemeral'));
initializeRouteDB(getDBName(databasePrefix, 'route'));
initializeShapeDB(getDBName(databasePrefix, 'shape'));

installOriginCoordinatorBridgeResponder({
  target: requireOriginCoordinatorDedicatedWorkerTarget(globalThis),
  releaseId: getOriginCoordinatorSourceSha(),
  revokeLegacyYamlAccess: () => undefined,
});

(async () => {
  const svc = await getStageProcessingService();
  // Expose a stable surface over Comlink
  Comlink.expose(svc);
})();

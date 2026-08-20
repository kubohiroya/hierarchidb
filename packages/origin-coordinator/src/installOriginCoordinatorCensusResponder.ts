import {
  isOriginCoordinatorReleaseId,
  parseOriginCoordinatorCensusProbe,
} from './censusProbeValidatorUtils.js';
import {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
} from './constants.js';
import type { OriginCoordinatorCensusResponse, OriginCoordinatorMessageTarget } from './types.js';

export function installOriginCoordinatorCensusResponder(
  target: OriginCoordinatorMessageTarget,
  releaseId: string
): () => void {
  if (!isOriginCoordinatorReleaseId(releaseId)) {
    throw new Error('origin-coordinator-invalid-release-id');
  }
  const onMessage = (event: MessageEvent<unknown>): void => {
    const probe = parseOriginCoordinatorCensusProbe(event.data);
    const responsePort = event.ports.length === 1 ? event.ports[0] : undefined;
    if (probe === null || !responsePort) return;
    const response: OriginCoordinatorCensusResponse = Object.freeze({
      type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId: probe.requestId,
      releaseId,
      capabilities: Object.freeze([ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY] as const),
    });
    try {
      responsePort.postMessage(response);
    } finally {
      responsePort.close();
    }
  };
  target.addEventListener('message', onMessage);
  return () => target.removeEventListener('message', onMessage);
}

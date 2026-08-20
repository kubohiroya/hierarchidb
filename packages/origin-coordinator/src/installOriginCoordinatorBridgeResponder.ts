import {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
} from './constants.js';
import {
  isOriginCoordinatorReleaseId,
  parseOriginCoordinatorCensusProbe,
  parseOriginCoordinatorParticipantQuiescenceRequest,
  parseOriginCoordinatorSharedWorkerRelayRequest,
} from './originCoordinatorProtocolValidatorUtils.js';
import type {
  OriginCoordinatorBridgeResponderHandle,
  OriginCoordinatorBridgeResponderOptions,
  OriginCoordinatorCensusResponse,
  OriginCoordinatorParticipantQuiescenceRequest,
  OriginCoordinatorParticipantQuiescenceResult,
} from './types.js';

function hasSameIdentity(
  left: OriginCoordinatorParticipantQuiescenceRequest,
  right: OriginCoordinatorParticipantQuiescenceRequest
): boolean {
  return (
    left.activationId === right.activationId &&
    left.quiescenceRequestId === right.quiescenceRequestId &&
    left.participantKind === right.participantKind &&
    left.participantId === right.participantId
  );
}

function createFailedResult(
  request: OriginCoordinatorParticipantQuiescenceRequest
): OriginCoordinatorParticipantQuiescenceResult {
  return Object.freeze({
    type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    status: 'failed',
    activationId: request.activationId,
    quiescenceRequestId: request.quiescenceRequestId,
    participantKind: request.participantKind,
    participantId: request.participantId,
  });
}

export function installOriginCoordinatorBridgeResponder(
  options: OriginCoordinatorBridgeResponderOptions
): OriginCoordinatorBridgeResponderHandle {
  if (!isOriginCoordinatorReleaseId(options.releaseId)) {
    throw new Error('origin-coordinator-invalid-release-id');
  }
  let claimedRequest: OriginCoordinatorParticipantQuiescenceRequest | null = null;
  let quiescenceResultPromise: Promise<OriginCoordinatorParticipantQuiescenceResult> | null = null;

  const quiesce = (
    request: OriginCoordinatorParticipantQuiescenceRequest
  ): Promise<OriginCoordinatorParticipantQuiescenceResult> => {
    if (claimedRequest !== null) {
      if (!hasSameIdentity(claimedRequest, request) || quiescenceResultPromise === null) {
        return Promise.resolve(createFailedResult(request));
      }
      return quiescenceResultPromise;
    }
    claimedRequest = request;
    quiescenceResultPromise = Promise.resolve()
      .then(options.revokeLegacyYamlAccess)
      .then(() =>
        Object.freeze({
          type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT' as const,
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          status: 'acknowledged' as const,
          activationId: request.activationId,
          quiescenceRequestId: request.quiescenceRequestId,
          participantKind: request.participantKind,
          participantId: request.participantId,
          legacyYamlEntrypointsRevoked: true as const,
          ownedStorageHandlesClosed: true as const,
        })
      )
      .catch(() => createFailedResult(request));
    return quiescenceResultPromise;
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    const responsePort = event.ports.length === 1 ? event.ports[0] : undefined;
    if (!responsePort) return;
    const relayRequest = parseOriginCoordinatorSharedWorkerRelayRequest(event.data);
    if (relayRequest !== null) {
      if (!options.relaySharedWorkerRequest) return;
      try {
        options.relaySharedWorkerRequest(relayRequest, responsePort);
      } catch {
        responsePort.close();
      }
      return;
    }
    const probe = parseOriginCoordinatorCensusProbe(event.data);
    if (probe !== null) {
      const response: OriginCoordinatorCensusResponse = Object.freeze({
        type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: probe.requestId,
        releaseId: options.releaseId,
        capabilities: Object.freeze([
          ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
          ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
        ] as const),
      });
      try {
        responsePort.postMessage(response);
      } finally {
        responsePort.close();
      }
      return;
    }
    const request = parseOriginCoordinatorParticipantQuiescenceRequest(event.data);
    if (request === null) return;
    void quiesce(request).then((result) => {
      try {
        responsePort.postMessage(result);
      } finally {
        responsePort.close();
      }
    });
  };

  options.target.addEventListener('message', onMessage);
  return Object.freeze({
    assertLegacyYamlAccessAllowed(): void {
      if (claimedRequest !== null) throw new Error('origin-coordinator-legacy-yaml-access-revoked');
    },
    uninstall(): void {
      options.target.removeEventListener('message', onMessage);
    },
  });
}

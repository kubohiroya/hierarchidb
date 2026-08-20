import type {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
} from './constants.js';

export type OriginCoordinatorProtocolVersion = typeof ORIGIN_COORDINATOR_PROTOCOL_VERSION;
export type OriginCoordinatorFoundationCapability = typeof ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY;
export type OriginCoordinatorQuiescenceBridgeCapability =
  typeof ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY;
export type OriginCoordinatorBridgeCapabilities = readonly [
  OriginCoordinatorFoundationCapability,
  OriginCoordinatorQuiescenceBridgeCapability,
];
export type OriginCoordinatorParticipantKind = 'tab' | 'worker';

export interface OriginCoordinatorOwnedClientHandle {
  close(): void | Promise<void>;
}

export interface OriginCoordinatorCensusProbe {
  readonly type: 'HDB_COORDINATOR_CENSUS_PROBE';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly requestId: string;
}

export interface OriginCoordinatorCensusResponse {
  readonly type: 'HDB_COORDINATOR_CENSUS_RESPONSE';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly requestId: string;
  readonly releaseId: string;
  readonly capabilities: OriginCoordinatorBridgeCapabilities;
}

export interface OriginCoordinatorParticipantQuiescenceRequest {
  readonly type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_REQUEST';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly participantKind: OriginCoordinatorParticipantKind;
  readonly participantId: string;
}

export type OriginCoordinatorSharedWorkerRelayPayload =
  | OriginCoordinatorCensusProbe
  | OriginCoordinatorParticipantQuiescenceRequest;

export interface OriginCoordinatorSharedWorkerRelayRequest {
  readonly type: 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly targetClientId: string;
  readonly targetClientUrl: string;
  readonly request: OriginCoordinatorSharedWorkerRelayPayload;
}

export type OriginCoordinatorParticipantQuiescenceResult =
  | {
      readonly type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'acknowledged';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly participantKind: OriginCoordinatorParticipantKind;
      readonly participantId: string;
      readonly legacyYamlEntrypointsRevoked: boolean;
      readonly ownedStorageHandlesClosed: boolean;
    }
  | {
      readonly type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'failed';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly participantKind: OriginCoordinatorParticipantKind;
      readonly participantId: string;
    };

export interface OriginCoordinatorBridgeResponderOptions {
  readonly target: OriginCoordinatorMessageTarget;
  readonly releaseId: string;
  readonly revokeLegacyYamlAccess: () => void | Promise<void>;
  readonly relaySharedWorkerRequest?: (
    request: OriginCoordinatorSharedWorkerRelayRequest,
    responsePort: MessagePort
  ) => void;
}

export interface OriginCoordinatorBridgeResponderHandle {
  assertLegacyYamlAccessAllowed(): void;
  uninstall(): void;
}

export interface OriginCoordinatorMessageTarget {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

import type {
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
  OriginCoordinatorBridgeCapabilities,
  OriginCoordinatorParticipantKind,
  OriginCoordinatorSharedWorkerRelayRequest,
} from '@hierarchidb/origin-coordinator';

export type OriginCoordinatorProtocolVersion = typeof ORIGIN_COORDINATOR_PROTOCOL_VERSION;
export type OriginCoordinatorClientType = 'window' | 'worker' | 'sharedworker';

export interface OriginCoordinatorFoundationAllowedState {
  readonly key: typeof ORIGIN_COORDINATOR_YAML_STATE_KEY;
  readonly protocolVersion: 1;
  readonly phase: 'allowed';
}

export interface OriginCoordinatorAllowedState {
  readonly key: typeof ORIGIN_COORDINATOR_YAML_STATE_KEY;
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly phase: 'allowed';
}

export interface OriginCoordinatorPersistedParticipant {
  readonly participantKind: OriginCoordinatorParticipantKind;
  readonly participantId: string;
}

export interface OriginCoordinatorPersistedParticipantEvidence
  extends OriginCoordinatorPersistedParticipant {
  readonly outcome: 'acknowledged' | 'discarded';
}

export type OriginCoordinatorBridgeErrorCode =
  | 'LEGACY_FENCE_REJECTED'
  | 'PARTICIPANT_UNRESPONSIVE'
  | 'CLIENT_LOOKUP_FAILED'
  | 'COORDINATOR_RESTARTED_DURING_QUIESCENCE';

export type OriginCoordinatorBridgeErrorStage = 'request' | 'quiescing' | 'reconstruction';

export interface OriginCoordinatorRevokedState {
  readonly key: typeof ORIGIN_COORDINATOR_YAML_STATE_KEY;
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly phase: 'revoked';
  readonly status: 'quiescing' | 'ready-for-preflight';
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly participants: readonly OriginCoordinatorPersistedParticipant[];
  readonly evidence: readonly OriginCoordinatorPersistedParticipantEvidence[];
}

export interface OriginCoordinatorRejectedState {
  readonly key: typeof ORIGIN_COORDINATOR_YAML_STATE_KEY;
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly phase: 'rejected';
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly participants: readonly OriginCoordinatorPersistedParticipant[];
  readonly evidence: readonly OriginCoordinatorPersistedParticipantEvidence[];
  readonly errorCode: OriginCoordinatorBridgeErrorCode;
  readonly errorStage: OriginCoordinatorBridgeErrorStage;
}

export type OriginCoordinatorDurableState =
  | OriginCoordinatorAllowedState
  | OriginCoordinatorRevokedState
  | OriginCoordinatorRejectedState;

export interface OriginCoordinatorHelloRequest {
  readonly type: 'HDB_COORDINATOR_HELLO';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly releaseId: string;
  readonly capabilities: OriginCoordinatorBridgeCapabilities;
}

export type OriginCoordinatorHelloResult =
  | {
      readonly type: 'HDB_COORDINATOR_HELLO_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'accepted';
      readonly legacyYamlAccess: 'allowed';
    }
  | {
      readonly type: 'HDB_COORDINATOR_HELLO_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'rejected';
      readonly code:
        | 'INVALID_HELLO_REQUEST'
        | 'INVALID_DURABLE_STATE'
        | 'COORDINATOR_STORAGE_FAILED'
        | 'LEGACY_YAML_ACCESS_REVOKED'
        | 'LEGACY_YAML_ACCESS_REJECTED';
    };

export interface OriginCoordinatorReadinessRequest {
  readonly type: 'HDB_COORDINATOR_READINESS_REQUEST';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly requestId: string;
  readonly timeoutMs: number;
}

export interface OriginCoordinatorClientTypeCounts {
  readonly compatible: number;
  readonly incompatible: number;
  readonly unresponsive: number;
  readonly discarded: number;
}

export interface OriginCoordinatorReadinessCounts {
  readonly window: OriginCoordinatorClientTypeCounts;
  readonly worker: OriginCoordinatorClientTypeCounts;
  readonly sharedworker: OriginCoordinatorClientTypeCounts;
}

export type OriginCoordinatorReadinessResult =
  | {
      readonly type: 'HDB_COORDINATOR_READINESS_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly requestId: string;
      readonly status: 'accepted';
      readonly actualFenceEstablished: false;
      readonly counts: OriginCoordinatorReadinessCounts;
    }
  | {
      readonly type: 'HDB_COORDINATOR_READINESS_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly requestId: string;
      readonly status: 'rejected';
      readonly actualFenceEstablished: false;
      readonly code:
        | 'INVALID_READINESS_REQUEST'
        | 'INVALID_DURABLE_STATE'
        | 'COORDINATOR_STORAGE_FAILED'
        | 'CLIENT_CENSUS_FAILED'
        | 'INCOMPATIBLE_CLIENT'
        | 'UNRESPONSIVE_CLIENT'
        | 'MISSING_PRODUCTION_WINDOW'
        | 'MISSING_PRODUCTION_SHARED_WORKER'
        | 'LEGACY_YAML_ACCESS_REVOKED'
        | 'LEGACY_YAML_ACCESS_REJECTED';
      readonly counts: OriginCoordinatorReadinessCounts;
    };

export interface OriginCoordinatorReadinessInput {
  readonly requestId: string;
  readonly timeoutMs: number;
}

export interface OriginCoordinatorQuiescenceStartRequest {
  readonly type: 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly timeoutMs: number;
}

export interface OriginCoordinatorQuiescenceStatusRequest {
  readonly type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly activationId: string;
  readonly quiescenceRequestId: string;
}

export interface OriginCoordinatorQuiescenceProgress {
  readonly participantCount: number;
  readonly acknowledgedCount: number;
  readonly discardedCount: number;
}

export type OriginCoordinatorQuiescenceRequestErrorCode =
  | 'INVALID_QUIESCENCE_REQUEST'
  | 'INVALID_DURABLE_STATE'
  | 'COORDINATOR_STORAGE_FAILED'
  | 'CLIENT_CENSUS_FAILED'
  | 'QUIESCENCE_IDENTITY_MISMATCH';

export type OriginCoordinatorQuiescenceResult =
  | {
      readonly type: 'HDB_COORDINATOR_QUIESCENCE_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'quiescing' | 'ready-for-preflight';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly actualFenceEstablished: false;
      readonly progress: OriginCoordinatorQuiescenceProgress;
    }
  | {
      readonly type: 'HDB_COORDINATOR_QUIESCENCE_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'rejected';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly actualFenceEstablished: false;
      readonly progress: OriginCoordinatorQuiescenceProgress;
      readonly errorCode: OriginCoordinatorBridgeErrorCode;
      readonly errorStage: OriginCoordinatorBridgeErrorStage;
    }
  | {
      readonly type: 'HDB_COORDINATOR_QUIESCENCE_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly status: 'request-rejected';
      readonly actualFenceEstablished: false;
      readonly code: OriginCoordinatorQuiescenceRequestErrorCode;
    };

export interface OriginCoordinatorQuiescenceStartInput {
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly timeoutMs: number;
}

export interface OriginCoordinatorQuiescenceStatusInput {
  readonly activationId: string;
  readonly quiescenceRequestId: string;
}

export interface OriginCoordinatorClientHandle {
  getReadiness(input: OriginCoordinatorReadinessInput): Promise<OriginCoordinatorReadinessResult>;
  startQuiescence(
    input: OriginCoordinatorQuiescenceStartInput
  ): Promise<OriginCoordinatorQuiescenceResult>;
  getQuiescenceStatus(
    input: OriginCoordinatorQuiescenceStatusInput
  ): Promise<OriginCoordinatorQuiescenceResult>;
}

export interface OriginCoordinatorInitializeOptions {
  readonly releaseId: string;
  readonly registrationUrl: string;
  readonly scope: string;
  readonly activeWorkerTimeoutMs: number;
  readonly messageTimeoutMs: number;
  readonly relaySharedWorkerRequest: (
    request: OriginCoordinatorSharedWorkerRelayRequest,
    responsePort: MessagePort
  ) => void;
  readonly revokeLegacyYamlAccess: () => void | Promise<void>;
}

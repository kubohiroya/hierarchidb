export type YamlStorageLegacyFenceParticipantKind = 'tab' | 'worker';

export interface YamlStorageLegacyFenceParticipant {
  readonly participantKind: YamlStorageLegacyFenceParticipantKind;
  readonly participantId: string;
}

export type YamlStorageLegacyFencePhase = 'quiescing' | 'ready-for-preflight' | 'rejected';

export type YamlStorageLegacyFenceErrorStage =
  | 'input'
  | Exclude<YamlStorageLegacyFencePhase, 'rejected'>;

export type YamlStorageLegacyFenceErrorCode =
  | 'INVALID_FENCE_INPUT'
  | 'INVALID_ACTIVATION_ID'
  | 'INVALID_QUIESCENCE_REQUEST_ID'
  | 'INVALID_PARTICIPANT_SNAPSHOT'
  | 'EMPTY_PARTICIPANT_SNAPSHOT'
  | 'INVALID_PARTICIPANT'
  | 'DUPLICATE_PARTICIPANT_ID'
  | 'INVALID_FENCE_STATE'
  | 'INVALID_FENCE_EVENT'
  | 'ACTIVATION_ID_MISMATCH'
  | 'QUIESCENCE_REQUEST_ID_MISMATCH'
  | 'UNKNOWN_PARTICIPANT'
  | 'PARTICIPANT_KIND_MISMATCH'
  | 'DUPLICATE_PARTICIPANT_ACK'
  | 'DUPLICATE_PARTICIPANT_DISCARD'
  | 'PARTICIPANT_EVIDENCE_CONFLICT'
  | 'LEGACY_ENTRYPOINTS_NOT_REVOKED'
  | 'STORAGE_HANDLES_NOT_CLOSED'
  | 'PARTICIPANT_QUIESCENCE_FAILED'
  | 'ILLEGAL_TRANSITION';

export interface YamlStorageLegacyFenceError {
  readonly code: YamlStorageLegacyFenceErrorCode;
  readonly stage: YamlStorageLegacyFenceErrorStage;
}

interface YamlStorageLegacyFenceContext {
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly participants: readonly YamlStorageLegacyFenceParticipant[];
  readonly acknowledgedParticipants: readonly YamlStorageLegacyFenceParticipant[];
  readonly discardedParticipants: readonly YamlStorageLegacyFenceParticipant[];
}

export interface YamlStorageLegacyFenceQuiescingState extends YamlStorageLegacyFenceContext {
  readonly phase: 'quiescing';
}

export interface YamlStorageLegacyFenceReadyState extends YamlStorageLegacyFenceContext {
  readonly phase: 'ready-for-preflight';
}

export interface YamlStorageLegacyFenceRejectedState extends YamlStorageLegacyFenceContext {
  readonly phase: 'rejected';
  readonly error: YamlStorageLegacyFenceError;
}

export type YamlStorageLegacyFenceState =
  | YamlStorageLegacyFenceQuiescingState
  | YamlStorageLegacyFenceReadyState
  | YamlStorageLegacyFenceRejectedState;

export type YamlStorageLegacyFenceCreateResult =
  | {
      readonly ok: true;
      readonly state: YamlStorageLegacyFenceQuiescingState;
    }
  | {
      readonly ok: false;
      readonly error: YamlStorageLegacyFenceError;
    };

export type YamlStorageLegacyFenceReduceResult =
  | {
      readonly ok: true;
      readonly state: YamlStorageLegacyFenceState;
    }
  | {
      readonly ok: false;
      readonly error: YamlStorageLegacyFenceError;
    };

export type YamlStorageLegacyFenceEvent =
  | {
      readonly type: 'participant-quiescence-acknowledged';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly participantKind: YamlStorageLegacyFenceParticipantKind;
      readonly participantId: string;
      readonly legacyYamlEntrypointsRevoked: boolean;
      readonly ownedStorageHandlesClosed: boolean;
    }
  | {
      readonly type: 'participant-quiescence-failed';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly participantKind: YamlStorageLegacyFenceParticipantKind;
      readonly participantId: string;
    }
  | {
      readonly type: 'participant-context-discarded';
      readonly activationId: string;
      readonly quiescenceRequestId: string;
      readonly participantKind: YamlStorageLegacyFenceParticipantKind;
      readonly participantId: string;
    };

export type YamlStorageLegacyFenceDecision =
  | {
      readonly readyForPreflight: true;
      readonly actualFenceEstablished: false;
      readonly code: 'READY_FOR_PREFLIGHT';
    }
  | {
      readonly readyForPreflight: false;
      readonly actualFenceEstablished: false;
      readonly code:
        | 'QUIESCENCE_IN_PROGRESS'
        | 'QUIESCENCE_REJECTED'
        | 'INVALID_LEGACY_FENCE_STATE';
    };

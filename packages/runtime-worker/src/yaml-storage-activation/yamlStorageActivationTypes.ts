export type YamlStorageActivationPhase =
  | 'quiescing'
  | 'preflight'
  | 'opening-target'
  | 'blocked'
  | 'versionchanging'
  | 'initializing'
  | 'canonical-ready'
  | 'rejected';

export type YamlStorageActivationErrorStage =
  | 'input'
  | 'post-activation-boot'
  | Exclude<YamlStorageActivationPhase, 'rejected'>;

export type YamlStorageActivationErrorCode =
  | 'INVALID_ACTIVATION_ID'
  | 'INVALID_CURRENT_VERSION'
  | 'INVALID_TARGET_VERSION'
  | 'INVALID_VERSION_RANGE'
  | 'INVALID_OPEN_REQUEST_ID'
  | 'ACTIVATION_ID_MISMATCH'
  | 'OPEN_REQUEST_ID_MISMATCH'
  | 'ILLEGAL_TRANSITION'
  | 'QUIESCING_FAILED'
  | 'PREFLIGHT_FAILED'
  | 'TARGET_OPEN_FAILED'
  | 'UPGRADE_FAILED'
  | 'INITIALIZATION_FAILED'
  | 'INVALID_POST_ACTIVATION_EVIDENCE';

export interface YamlStorageActivationError {
  readonly code: YamlStorageActivationErrorCode;
  readonly stage: YamlStorageActivationErrorStage;
}

export interface YamlStorageActivationInput {
  readonly activationId: string;
  readonly currentVersion: number;
  readonly targetVersion: number;
}

export interface YamlStorageFreshActivationInput {
  readonly activationId: string;
  readonly targetVersion: number;
}

interface YamlStorageActivationContext {
  readonly activationId: string;
  readonly currentVersion: number;
  readonly targetVersion: number;
}

interface YamlStorageOpenRequestContext extends YamlStorageActivationContext {
  readonly openRequestId: string;
}

export interface YamlStorageQuiescingState extends YamlStorageActivationContext {
  readonly phase: 'quiescing';
}

export interface YamlStoragePreflightState extends YamlStorageActivationContext {
  readonly phase: 'preflight';
}

export interface YamlStorageOpeningTargetState extends YamlStorageOpenRequestContext {
  readonly phase: 'opening-target';
}

export interface YamlStorageBlockedState extends YamlStorageOpenRequestContext {
  readonly phase: 'blocked';
}

export interface YamlStorageVersionchangingState extends YamlStorageOpenRequestContext {
  readonly phase: 'versionchanging';
}

export interface YamlStorageInitializingState extends YamlStorageOpenRequestContext {
  readonly phase: 'initializing';
  readonly upgradeCommitted: true;
}

export interface YamlStorageCanonicalReadyState extends YamlStorageOpenRequestContext {
  readonly phase: 'canonical-ready';
  readonly upgradeCommitted: true;
  readonly initializationSucceeded: true;
  readonly readinessProof:
    | 'same-activation-upgrade'
    | 'same-activation-fresh-create'
    | 'post-activation-boot';
}

export interface YamlStorageRejectedState extends YamlStorageActivationContext {
  readonly phase: 'rejected';
  readonly openRequestId?: string;
  readonly actualFenceEstablished: boolean;
  readonly error: YamlStorageActivationError;
}

export type YamlStorageActivationState =
  | YamlStorageQuiescingState
  | YamlStoragePreflightState
  | YamlStorageOpeningTargetState
  | YamlStorageBlockedState
  | YamlStorageVersionchangingState
  | YamlStorageInitializingState
  | YamlStorageCanonicalReadyState
  | YamlStorageRejectedState;

export type YamlStorageActivationCreateResult =
  | {
      readonly ok: true;
      readonly state: YamlStorageQuiescingState;
    }
  | {
      readonly ok: false;
      readonly error: YamlStorageActivationError;
    };

export interface YamlStoragePostActivationReadyInput {
  readonly activationId: string;
  readonly currentVersion: number;
  readonly targetVersion: number;
  readonly openRequestId: string;
  readonly coordinatorGate: 'revoked-ready-for-preflight';
  readonly schemaValidated: true;
  readonly canonicalSnapshotValidated: true;
  readonly initializationSucceeded: true;
}

export type YamlStoragePostActivationReadyResult =
  | Readonly<{
      readonly ok: true;
      readonly state: YamlStorageCanonicalReadyState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly error: YamlStorageActivationError;
    }>;

interface YamlStorageActivationEventBase {
  readonly activationId: string;
}

interface YamlStorageOpenRequestEventBase extends YamlStorageActivationEventBase {
  readonly openRequestId: string;
}

type YamlStorageEarlyRejectionEvent = YamlStorageActivationEventBase & {
  readonly type: 'activation-rejected';
  readonly stage: 'quiescing' | 'preflight';
};

type YamlStorageOpenRequestRejectionEvent = YamlStorageOpenRequestEventBase & {
  readonly type: 'activation-rejected';
  readonly stage: 'opening-target' | 'blocked' | 'versionchanging' | 'initializing';
};

export type YamlStorageActivationEvent =
  | (YamlStorageActivationEventBase & {
      readonly type: 'quiescing-completed';
    })
  | (YamlStorageOpenRequestEventBase & {
      readonly type: 'preflight-completed';
    })
  | (YamlStorageOpenRequestEventBase & {
      readonly type: 'target-open-blocked';
    })
  | (YamlStorageOpenRequestEventBase & {
      readonly type: 'versionchange-started';
    })
  | (YamlStorageOpenRequestEventBase & {
      readonly type: 'upgrade-committed';
    })
  | (YamlStorageOpenRequestEventBase & {
      readonly type: 'initialization-succeeded';
    })
  | YamlStorageEarlyRejectionEvent
  | YamlStorageOpenRequestRejectionEvent;

export type YamlStorageRuntimeOperation = 'query' | 'mutation' | 'reader' | 'writer';

export type YamlStorageAccessRequest =
  | {
      readonly domain: 'runtime';
      readonly representation: 'legacy' | 'canonical';
      readonly operation: YamlStorageRuntimeOperation;
    }
  | {
      readonly domain: 'yaml-db';
      readonly operation: YamlStorageRuntimeOperation;
    };

export type YamlStorageAccessDecision =
  | {
      readonly allowed: true;
      readonly code: 'CANONICAL_READY';
    }
  | {
      readonly allowed: false;
      readonly code:
        | 'ACTIVATION_IN_PROGRESS'
        | 'ACTIVATION_REJECTED'
        | 'LEGACY_RUNTIME_UNAVAILABLE'
        | 'YAML_DB_UNAVAILABLE'
        | 'INVALID_ACTIVATION_STATE'
        | 'INVALID_ACCESS_REQUEST';
    };

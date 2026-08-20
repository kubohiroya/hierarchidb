import type {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
} from '@hierarchidb/origin-coordinator';

export type OriginCoordinatorProtocolVersion = typeof ORIGIN_COORDINATOR_PROTOCOL_VERSION;
export type OriginCoordinatorFoundationCapability = typeof ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY;
export type OriginCoordinatorClientType = 'window' | 'worker' | 'sharedworker';

export interface OriginCoordinatorAllowedState {
  readonly key: typeof ORIGIN_COORDINATOR_YAML_STATE_KEY;
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly phase: 'allowed';
}

export type OriginCoordinatorDurableState = OriginCoordinatorAllowedState;

export interface OriginCoordinatorHelloRequest {
  readonly type: 'HDB_COORDINATOR_HELLO';
  readonly protocolVersion: OriginCoordinatorProtocolVersion;
  readonly releaseId: string;
  readonly capabilities: readonly [OriginCoordinatorFoundationCapability];
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
        | 'COORDINATOR_STORAGE_FAILED';
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
      readonly counts: OriginCoordinatorReadinessCounts;
    }
  | {
      readonly type: 'HDB_COORDINATOR_READINESS_RESULT';
      readonly protocolVersion: OriginCoordinatorProtocolVersion;
      readonly requestId: string;
      readonly status: 'rejected';
      readonly code:
        | 'INVALID_READINESS_REQUEST'
        | 'INVALID_DURABLE_STATE'
        | 'COORDINATOR_STORAGE_FAILED'
        | 'CLIENT_CENSUS_FAILED'
        | 'INCOMPATIBLE_CLIENT'
        | 'UNRESPONSIVE_CLIENT';
      readonly counts: OriginCoordinatorReadinessCounts;
    };

export interface OriginCoordinatorReadinessInput {
  readonly requestId: string;
  readonly timeoutMs: number;
}

export interface OriginCoordinatorClientHandle {
  getReadiness(input: OriginCoordinatorReadinessInput): Promise<OriginCoordinatorReadinessResult>;
}

export interface OriginCoordinatorInitializeOptions {
  readonly releaseId: string;
  readonly registrationUrl: string;
  readonly scope: string;
  readonly activeWorkerTimeoutMs: number;
  readonly messageTimeoutMs: number;
}

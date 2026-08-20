import type {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
} from './constants.js';

export type OriginCoordinatorProtocolVersion = typeof ORIGIN_COORDINATOR_PROTOCOL_VERSION;
export type OriginCoordinatorFoundationCapability = typeof ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY;

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
  readonly capabilities: readonly [OriginCoordinatorFoundationCapability];
}

export interface OriginCoordinatorMessageTarget {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

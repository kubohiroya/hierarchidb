import type { NodeId, NodeType } from '@hierarchidb/core-types';

export type CanonicalBuildRuntimeErrorCode =
  | 'CANONICAL_BUILD_RUNTIME_ADAPTER_NOT_REGISTERED'
  | 'CANONICAL_BUILD_RUNTIME_ADAPTER_DUPLICATE_NODE_TYPE'
  | 'CANONICAL_BUILD_RUNTIME_ADAPTER_INVALID_NODE_TYPE'
  | 'CANONICAL_BUILD_RUNTIME_ADAPTER_METHOD_MISSING'
  | 'CANONICAL_BUILD_RUNTIME_RECORD_NODE_TYPE_MISMATCH'
  | 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_STATUS'
  | 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_REVISION'
  | 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_ACTIVE_STATE';

export type CanonicalBuildRuntimeErrorDetails = {
  code: CanonicalBuildRuntimeErrorCode;
  nodeType?: NodeType;
  nodeId?: NodeId;
  field?: string;
};

export class CanonicalBuildRuntimeError extends Error {
  readonly code: CanonicalBuildRuntimeErrorCode;
  readonly details: CanonicalBuildRuntimeErrorDetails;

  constructor(message: string, details: CanonicalBuildRuntimeErrorDetails) {
    super(message);
    this.name = 'CanonicalBuildRuntimeError';
    this.code = details.code;
    this.details = details;
  }
}

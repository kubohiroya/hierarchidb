export type CanonicalBuildInputErrorCode =
  | 'CANONICAL_BUILD_INPUT_MISSING_SLOT'
  | 'CANONICAL_BUILD_INPUT_NODE_ID_MISMATCH'
  | 'CANONICAL_BUILD_INPUT_NODE_TYPE_MISMATCH'
  | 'CANONICAL_BUILD_INPUT_INCOMPLETE_PAYLOAD'
  | 'CANONICAL_BUILD_INPUT_UNSUPPORTED_SOURCE';

export type CanonicalBuildInputErrorDetails = {
  code: CanonicalBuildInputErrorCode;
  field?: string;
  nodeId?: string;
  nodeType?: string;
  source?: string;
};

export class CanonicalBuildInputError extends Error {
  readonly code: CanonicalBuildInputErrorCode;
  readonly details: CanonicalBuildInputErrorDetails;

  constructor(message: string, details: CanonicalBuildInputErrorDetails) {
    super(message);
    this.name = 'CanonicalBuildInputError';
    this.code = details.code;
    this.details = details;
  }
}

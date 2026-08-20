export type OriginCoordinatorClientErrorCode =
  | 'COORDINATOR_UNSUPPORTED'
  | 'INVALID_INITIALIZE_OPTIONS'
  | 'REGISTRATION_FAILED'
  | 'ACTIVE_WORKER_TIMEOUT'
  | 'MESSAGE_TIMEOUT'
  | 'INVALID_COORDINATOR_RESPONSE'
  | 'HELLO_REJECTED'
  | 'INVALID_READINESS_INPUT';

export class OriginCoordinatorClientError extends Error {
  constructor(readonly code: OriginCoordinatorClientErrorCode) {
    super(`Origin coordinator failed: ${code}`);
    this.name = 'OriginCoordinatorClientError';
  }
}

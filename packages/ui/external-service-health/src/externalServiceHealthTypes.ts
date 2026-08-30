export type ExternalServiceHealthStatus =
  | 'incomplete'
  | 'checking'
  | 'healthy'
  | 'unhealthy'
  | 'authentication-required'
  | 'incompatible';

export interface ExternalServiceHealthResult {
  readonly status: ExternalServiceHealthStatus;
  readonly checkedAt?: number;
  readonly code?: string;
}

export interface ExternalServiceHealthChecker<TInput> {
  readonly checkHealth: (
    input: TInput,
    signal: AbortSignal
  ) => Promise<ExternalServiceHealthResult>;
}

import type {
  ExternalServiceHealthChecker,
  ExternalServiceHealthResult,
  ExternalServiceHealthStatus,
} from '@hierarchidb/ui-external-service-health';
import type { ReactNode } from 'react';

export type ExternalServiceConnectionHealthStatus = ExternalServiceHealthStatus;

export interface ExternalServiceNamedConnectionSummary {
  readonly name: string;
  readonly label: string;
  readonly hostLabel: string;
  readonly portLabel: string;
}

export interface ExternalServiceConnectionInput {
  readonly connectionName: string;
}

export interface ExternalServiceConnectionDraft extends ExternalServiceConnectionInput {
  readonly manualTargetEnabled: boolean;
  readonly manualHost: string;
  readonly manualPort: string;
  readonly useCorsProxy: boolean;
}

export type ExternalServiceConnectionHealthResult = ExternalServiceHealthResult;

export interface ExternalServiceConnectionRuntimeProvider
  extends ExternalServiceHealthChecker<ExternalServiceConnectionInput> {
  readonly listConnections: () => Promise<ReadonlyArray<ExternalServiceNamedConnectionSummary>>;
  readonly resolveManualTarget?: (
    input: Pick<ExternalServiceConnectionDraft, 'manualHost' | 'manualPort' | 'useCorsProxy'>
  ) => Promise<ExternalServiceConnectionInput>;
}

export interface ExternalServiceConnectionStepLabels {
  readonly connectionName?: string;
  readonly manualTarget?: string;
  readonly host?: string;
  readonly port?: string;
  readonly corsProxy?: string;
  readonly health?: string;
}

export interface ExternalServiceConnectionStepProps {
  readonly value: ExternalServiceConnectionDraft;
  readonly provider: ExternalServiceConnectionRuntimeProvider;
  readonly disabled?: boolean;
  readonly labels?: ExternalServiceConnectionStepLabels;
  readonly healthDebounceMs?: number;
  readonly children?: (state: {
    readonly persistedValue: ExternalServiceConnectionInput | null;
    readonly health: ExternalServiceConnectionHealthResult;
  }) => ReactNode;
  readonly onChange: (next: ExternalServiceConnectionDraft) => void;
  readonly onPersistedValueChange?: (next: ExternalServiceConnectionInput | null) => void;
  readonly onHealthChange?: (next: ExternalServiceConnectionHealthResult) => void;
}

export type ExternalServiceConnectionValidationCode =
  | 'CONNECTION_NAME_REQUIRED'
  | 'MANUAL_TARGET_UNAVAILABLE'
  | 'CONNECTION_UNAVAILABLE';

export type ExternalServiceConnectionValidationResult =
  | Readonly<{ readonly ok: true; readonly value: ExternalServiceConnectionInput }>
  | Readonly<{ readonly ok: false; readonly code: ExternalServiceConnectionValidationCode }>;

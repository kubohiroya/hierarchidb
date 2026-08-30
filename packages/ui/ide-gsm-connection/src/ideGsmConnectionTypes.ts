import type {
  ExternalServiceHealthChecker,
  ExternalServiceHealthResult,
  ExternalServiceHealthStatus,
} from '@hierarchidb/ui-external-service-health';
import type { ReactNode } from 'react';

export type IdeGsmConnectionHealthStatus = ExternalServiceHealthStatus;

export interface IdeGsmNamedConnectionSummary {
  readonly name: string;
  readonly label: string;
  readonly hostLabel: string;
  readonly portLabel: string;
}

export interface IdeGsmConnectionInput {
  readonly connectionName: string;
}

export interface IdeGsmConnectionDraft extends IdeGsmConnectionInput {
  readonly manualTargetEnabled: boolean;
  readonly manualHost: string;
  readonly manualPort: string;
  readonly useCorsProxy: boolean;
}

export type IdeGsmConnectionHealthResult = ExternalServiceHealthResult;

export interface IdeGsmConnectionRuntimeProvider
  extends ExternalServiceHealthChecker<IdeGsmConnectionInput> {
  readonly listConnections: () => Promise<ReadonlyArray<IdeGsmNamedConnectionSummary>>;
  readonly resolveManualTarget?: (
    input: Pick<IdeGsmConnectionDraft, 'manualHost' | 'manualPort' | 'useCorsProxy'>
  ) => Promise<IdeGsmConnectionInput>;
}

export interface IdeGsmConnectionStepLabels {
  readonly connectionName?: string;
  readonly manualTarget?: string;
  readonly host?: string;
  readonly port?: string;
  readonly corsProxy?: string;
  readonly health?: string;
}

export interface IdeGsmConnectionStepProps {
  readonly value: IdeGsmConnectionDraft;
  readonly provider: IdeGsmConnectionRuntimeProvider;
  readonly disabled?: boolean;
  readonly labels?: IdeGsmConnectionStepLabels;
  readonly healthDebounceMs?: number;
  readonly children?: (state: {
    readonly persistedValue: IdeGsmConnectionInput | null;
    readonly health: IdeGsmConnectionHealthResult;
  }) => ReactNode;
  readonly onChange: (next: IdeGsmConnectionDraft) => void;
  readonly onPersistedValueChange?: (next: IdeGsmConnectionInput | null) => void;
  readonly onHealthChange?: (next: IdeGsmConnectionHealthResult) => void;
}

export type IdeGsmConnectionValidationCode =
  | 'CONNECTION_NAME_REQUIRED'
  | 'MANUAL_TARGET_UNAVAILABLE'
  | 'CONNECTION_UNAVAILABLE';

export type IdeGsmConnectionValidationResult =
  | Readonly<{ readonly ok: true; readonly value: IdeGsmConnectionInput }>
  | Readonly<{ readonly ok: false; readonly code: IdeGsmConnectionValidationCode }>;

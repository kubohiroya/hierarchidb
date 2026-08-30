import type { FdmDashboardPort, FdmDialogData, FdmRuntimePort } from '@hierarchidb/fdm-api';
import type { IdeGsmConnectionRuntimeProvider } from '@hierarchidb/ui-ide-gsm-connection';

export interface FdmPluginRuntime {
  readonly enabled: boolean;
  readonly connectionRuntime?: IdeGsmConnectionRuntimeProvider;
  readonly fdmRuntime?: FdmRuntimePort;
  readonly dashboardRuntime?: FdmDashboardPort;
}

export interface FdmPluginRuntimeGlobal {
  readonly __HDB_FDM__?: FdmPluginRuntime;
}

export type FdmPluginDialogData = FdmDialogData;

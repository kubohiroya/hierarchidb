import { assertFdmNodeData } from '@hierarchidb/fdm-api';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { Alert } from '@mui/material';
import { FdmDashboardView } from '../../dashboard/FdmDashboardView.js';
import type { FdmPluginDialogData, FdmPluginRuntime } from '../fdmStepProviderTypes.js';

export interface FdmDashboardStepProps extends PluginStepProps<FdmPluginDialogData> {
  readonly runtime: FdmPluginRuntime;
}

export function FdmDashboardStep({ data, disabled, onChange, runtime }: FdmDashboardStepProps) {
  if (!runtime.dashboardRuntime) {
    return <Alert severity="error">FDM_DASHBOARD_RUNTIME_UNAVAILABLE</Alert>;
  }
  try {
    assertFdmNodeData(data);
  } catch (error) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : 'FDM_DASHBOARD_NODE_DATA_INVALID'}
      </Alert>
    );
  }
  return (
    <FdmDashboardView
      node={data}
      port={runtime.dashboardRuntime}
      disabled={disabled}
      onNodeDataChange={onChange}
    />
  );
}

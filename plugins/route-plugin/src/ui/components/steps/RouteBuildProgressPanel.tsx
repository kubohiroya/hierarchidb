import type { ComponentProps } from 'react';
import { BuildSessionProgressPanelShell } from '@hierarchidb/ui-build-progress';

export type RouteBuildProgressPanelProps = ComponentProps<typeof BuildSessionProgressPanelShell>;

export const RouteBuildProgressPanel = (props: RouteBuildProgressPanelProps) => {
  return <BuildSessionProgressPanelShell {...props} />;
};


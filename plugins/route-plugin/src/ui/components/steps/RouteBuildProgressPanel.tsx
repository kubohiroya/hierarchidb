import type { ComponentProps } from 'react';
import { BuildSessionProgressPanel } from '@hierarchidb/ui-build-progress';

export type RouteBuildProgressPanelProps = ComponentProps<typeof BuildSessionProgressPanel>;

export const RouteBuildProgressPanel = (props: RouteBuildProgressPanelProps) => {
  return <BuildSessionProgressPanel {...props} />;
};


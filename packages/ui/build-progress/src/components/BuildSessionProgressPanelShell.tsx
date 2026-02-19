import { type ComponentProps, type FC } from 'react';
import { BuildSessionProgressPanel } from '@hierarchidb/components';

type BuildSessionProgressPanelShellProps = ComponentProps<typeof BuildSessionProgressPanel>;

export const BuildSessionProgressPanelShell: FC<BuildSessionProgressPanelShellProps> = (props) => {
  return <BuildSessionProgressPanel {...props} />;
};

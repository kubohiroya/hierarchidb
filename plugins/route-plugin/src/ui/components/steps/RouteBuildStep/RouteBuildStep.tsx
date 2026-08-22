import { RouteBuildStepView } from './RouteBuildStepView.js';
import type { RouteBuildStepProps } from './types.js';
import { useRouteBuildStepState } from './useRouteBuildStepState.js';

export const RouteBuildStep = (props: RouteBuildStepProps) => {
  const viewProps = useRouteBuildStepState(props);
  return <RouteBuildStepView {...viewProps} />;
};

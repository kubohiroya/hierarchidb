// Container component for GeometryConfigSection.

import type { ShapeBuildConfig } from '~/common/types/index';
import { GeometryConfigSectionView } from './GeometryConfigSectionView.tsx';
import { useGeometryConfigSectionState } from './useGeometryConfigSectionState.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const GeometryConfigSection: React.FC<Props> = (props) => {
  const state = useGeometryConfigSectionState(props);
  return <GeometryConfigSectionView {...state} />;
};

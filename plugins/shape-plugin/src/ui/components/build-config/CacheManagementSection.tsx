// Container component for CacheManagementSection.
// Calls the state hook and passes props to the View.

import type { ShapeBuildConfig } from '~/common/types/index';
import type { SourceConfigSectionState } from '~/ui/hooks/useSourceConfigSection';
import { CacheManagementSectionView } from './CacheManagementSectionView.tsx';
import { useCacheManagementSectionState } from './useCacheManagementSectionState.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  fetchState: SourceConfigSectionState;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const CacheManagementSection: React.FC<Props> = (props) => {
  const state = useCacheManagementSectionState(props);
  return <CacheManagementSectionView {...state} />;
};

import {
  BuildSessionProgressPanelViewModel,
  resolveBuildSessionProgressPanelSplitViewProps,
} from '@hierarchidb/ui-build-progress';

export type RouteBuildProgressPanelViewModel =
  BuildSessionProgressPanelViewModel;

type RouteBuildProgressPanelViewModelArgs = RouteBuildProgressPanelViewModel & {
  stagesLength: number;
};

export const useRouteBuildProgressPanelViewModel = ({
  stagesLength,
  ...props
}: RouteBuildProgressPanelViewModelArgs): RouteBuildProgressPanelViewModel => ({
  ...props,
  ...resolveBuildSessionProgressPanelSplitViewProps({ stagesLength }),
});

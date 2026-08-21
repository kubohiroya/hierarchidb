import type { RouteEntity } from '@hierarchidb/route-api';
import type { BuildSessionProgressPanelProps } from '@hierarchidb/ui-build-progress';

export interface RouteBuildStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: string;
  parentId?: string;
  mode: 'create' | 'edit';
}

export type RouteBuildStepSummaryItem = {
  id: string;
  label: string;
  value: string;
};

export type RouteBuildStepViewProps = {
  reviewText: string;
  summaryItems: RouteBuildStepSummaryItem[];
  missingInputMessage: string | null;
  visibleError: string | null;
  progressTitle: string;
  progressPanelProps: BuildSessionProgressPanelProps;
};

import { lazy, memo } from 'react';
import type { TreeConsoleIntegrationProps } from '~/router/pages/tree/console/TreeConsoleIntegration';

const LazyTreeConsoleIntegration = lazy(async () => {
  const mod = await import('~/router/pages/tree/console/TreeConsoleIntegration');
  return { default: mod.TreeConsoleIntegration };
});

export const MemoizedTreeConsoleIntegration = memo<TreeConsoleIntegrationProps>(
  (props) => <LazyTreeConsoleIntegration {...props} />,
  (prev, next) =>
    prev.treeId === next.treeId &&
    prev.pageNodeId === next.pageNodeId &&
    (prev.pageTreeNode?.id ?? null) === (next.pageTreeNode?.id ?? null) &&
    prev.initialViewMode === next.initialViewMode &&
    prev.initialSortMode === next.initialSortMode &&
    prev.initialZoomLevel === next.initialZoomLevel &&
    prev.columnTargetNodeId === next.columnTargetNodeId
);

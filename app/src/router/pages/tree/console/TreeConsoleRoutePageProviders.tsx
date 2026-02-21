import type { ReactNode } from 'react';
import {
  BuildSessionRuntimeContextProvider,
  PageNodeContextProvider,
  TargetNodeBuildSessionContextProvider,
  TargetNodeContextProvider,
  TreeContextProvider,
} from '@hierarchidb/ui-batch-progress';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import type { TargetContextState } from './hooks/useTreeTargetContextState';
import { TreeConsoleRouteThemeBoundary } from './TreeConsoleRouteThemeBoundary';

type TreeConsoleRoutePageProvidersProps = {
  data: LoadPageNodeReturn;
  targetContext: TargetContextState;
  children: ReactNode;
};

export function TreeConsoleRoutePageProviders({
  data,
  targetContext,
  children,
}: TreeConsoleRoutePageProvidersProps) {
  return (
    <TreeConsoleRouteThemeBoundary treeId={data.tree?.id}>
      <TreeContextProvider treeId={data.tree?.id}>
        <PageNodeContextProvider pageNodeId={data.pageNodeId} pageNode={data.pageNode}>
          <TargetNodeContextProvider
            targetNodeId={targetContext.targetNodeId}
            targetNode={targetContext.targetNode}
            nodeType={targetContext.targetNodeType}
          >
            <BuildSessionRuntimeContextProvider>
              <TargetNodeBuildSessionContextProvider>{children}</TargetNodeBuildSessionContextProvider>
            </BuildSessionRuntimeContextProvider>
          </TargetNodeContextProvider>
        </PageNodeContextProvider>
      </TreeContextProvider>
    </TreeConsoleRouteThemeBoundary>
  );
}
